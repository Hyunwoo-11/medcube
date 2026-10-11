// frontend/src/api.ts
// 복약지킴이(MedCube) 백엔드 API 클라이언트
//
// 서버 주소는 frontend/.env.local 의 EXPO_PUBLIC_API_URL 로 지정합니다.
//   예) EXPO_PUBLIC_API_URL=http://172.20.10.8:3000
// (핫스팟이 바뀌면 맥 IP가 바뀌므로 이 한 줄만 고치면 됩니다. 값을 바꾸면 expo를 재시작하세요.)

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
const TIMEOUT_MS = 8000;

// ───────────────────────── 타입 ─────────────────────────

export type Role = 'user' | 'guardian'; // user = 복약자
export type CubeStatus = 'inserted' | 'removed';

export interface User {
  id: number;
  name: string;
  role: Role;
  invite_code: string | null; // 복약자만 값이 있음, 보호자는 null
}

// /api/me 응답. 로그인 응답에는 없는 email, linked_user_id가 포함됨
export interface Me extends User {
  email: string;
  linked_user_id: number | null; // 보호자가 연결한 복약자의 id
}

export interface Guardian {
  id: number;
  name: string;
  email: string;
}

// schedules 테이블 한 행 (SELECT * 라서 다른 컬럼이 더 있을 수 있음)
export interface Schedule {
  id: number;
  user_id: number;
  time: string;
  period: string;
}

export interface HistoryItem {
  id: number;
  cube_id: number;
  target_date: string; // 예: "2026-09-30T15:00:00.000Z" → toLocalDate()로 변환
  period: string;
  confirmed_at: string;
  method: string; // 예: "sensor"
}

// ───────────────────────── 공통 요청 ─────────────────────────

export class ApiError extends Error {
  status: number; // 0 = 서버에 연결 자체가 안 됨, 그 외 = HTTP 상태 코드(401, 410 등)

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  // fetch에는 기본 타임아웃이 없어서, 주소가 틀리면 한참 멈춰 있게 됨 → 직접 끊어줌
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(
      `서버에 연결할 수 없습니다. 서버 주소(${BASE_URL})와 같은 네트워크인지 확인하세요.`,
      0,
    );
  } finally {
    clearTimeout(timer);
  }

  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    message?: string;
  };

  // 이 서버는 실패 메시지를 error 필드로, 성공 메시지를 message 필드로 보냄
  if (!res.ok || data.ok === false) {
    throw new ApiError(data.error ?? data.message ?? `요청 실패 (${res.status})`, res.status);
  }
  return data as T;
}

// ───────────────────────── 인증 (auth.js) ─────────────────────────

export const signup = (p: { name: string; email: string; password: string; role: Role }) =>
  request<{ ok: true; userId: number; invite_code: string | null }>('/api/signup', {
    method: 'POST',
    body: p,
  });

export const login = (p: { email: string; password: string }) =>
  request<{ ok: true; user: User }>('/api/login', { method: 'POST', body: p });

// ───────────────────────── 사용자 (users.js) ─────────────────────────

export const getMe = (userId: number) => request<{ ok: true; user: Me }>(`/api/me/${userId}`);

// 주의: 이 API만 body 키가 camelCase(guardianUserId)임
export const linkGuardian = (p: { guardianUserId: number; invite_code: string }) =>
  request<{ ok: true; linkedTo: { id: number; name: string } }>('/api/link-guardian', {
    method: 'POST',
    body: {
      guardianUserId: p.guardianUserId,
      invite_code: p.invite_code.trim().toUpperCase(), // 초대코드는 대문자+숫자만 사용
    },
  });

export const getGuardians = (userId: number) =>
  request<{ ok: true; guardians: Guardian[] }>(`/api/guardians/${userId}`);

// ───────────────────────── 복약 일정 (schedule.js) ─────────────────────────

export const createSchedule = (p: { user_id: number; time: string; period: string }) =>
  request<{ ok: true; scheduleId: number }>('/api/schedule', { method: 'POST', body: p });

export const getSchedules = (userId: number) =>
  request<{ ok: true; schedules: Schedule[] }>(`/api/schedule/${userId}`);

// ───────────────────────── 큐브 / 복약 기록 (cube.js, history.js) ─────────────────────────

// 복약 시작일로 7일 코스 매핑. start_date는 todayLocal() 같은 'YYYY-MM-DD' 문자열
export const setCubeMapping = (p: { user_id: number; start_date: string }) =>
  request<{ ok: true; message: string }>('/api/cube-mapping', { method: 'POST', body: p });

// 보통은 ESP32가 호출하지만, 앱에서 수동 테스트할 때도 사용 가능. 복약 기간이 지나면 status 410
export const updateCubeStatus = (p: { user_id: number; cube_id: number; status: CubeStatus }) =>
  request<{ ok: true; message: string }>('/api/cube-status', { method: 'POST', body: p });

export const getHistory = (userId: number) =>
  request<{ ok: true; history: HistoryItem[] }>(`/api/history/${userId}`);

// ───────────────────────── 날짜 도우미 ─────────────────────────

const pad = (n: number) => String(n).padStart(2, '0');

/** 오늘 날짜를 기기 시간 기준 'YYYY-MM-DD'로. (toISOString()은 UTC 기준이라 한국 새벽 0~9시에 어제 날짜가 나옴) */
export function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 서버가 준 "2026-09-30T15:00:00.000Z" 같은 값을 기기 시간 기준 'YYYY-MM-DD'로 (한국이면 2026-10-01) */
export function toLocalDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 서버가 준 시각을 기기 시간 기준 'YYYY-MM-DD HH:mm'로 */
export function toLocalDateTime(iso: string): string {
  const d = new Date(iso);
  return `${toLocalDate(iso)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}