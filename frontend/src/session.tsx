// frontend/src/session.tsx
// 로그인한 사용자 정보를 앱 전체에서 쓰고, 앱을 껐다 켜도 유지되게 저장합니다.
// (지금 서버에는 토큰이 없어서 사용자 정보(id, 이름, 역할, 초대코드)만 저장합니다.
//  나중에 JWT를 붙이면 여기에 token 필드만 추가하면 됩니다.)

import * as SecureStore from 'expo-secure-store';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

import type { User } from './api';

const STORAGE_KEY = 'medcube.user';

interface SessionValue {
  user: User | null;
  loading: boolean; // 저장된 로그인 정보를 읽는 중
  signIn: (user: User) => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // 앱을 켤 때 저장된 로그인 정보가 있으면 복원
  useEffect(() => {
    let alive = true;
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((raw) => {
        if (alive && raw) setUser(JSON.parse(raw) as User);
      })
      .catch(() => {
        // 저장소를 못 읽으면 로그아웃 상태로 시작
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  async function signIn(next: User) {
    setUser(next); // 화면 전환이 먼저, 저장은 뒤에서
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }

  async function signOut() {
    setUser(null);
    await SecureStore.deleteItemAsync(STORAGE_KEY).catch(() => {});
  }

  return (
    <SessionContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession은 SessionProvider 안에서만 쓸 수 있어요.');
  return ctx;
}