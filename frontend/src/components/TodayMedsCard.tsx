import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { CubeSlot, getCubeSlots, getHistory, getMe, getSchedules, HistoryItem, Schedule, toLocalDate, todayLocal } from '../api';
import { useSession } from '../session';
import { colors, radius, shadow } from '../theme';
import { Button } from './ui';

const POLL_MS = 5000; // 서버에 다시 물어보는 간격

// DB 값 → 화면에 보여줄 이름/색
const PERIODS: Record<string, { label: string; color: string } | undefined> = {
  morning: { label: '아침', color: colors.morning },
  noon: { label: '점심', color: colors.noon },
  evening: { label: '저녁', color: colors.evening },
};

// 예전 기록에 lunch가 섞여 있을 수 있어서 noon으로 합쳐서 비교
const normPeriod = (p: string) => (p === 'lunch' ? 'noon' : p);

const pad = (n: number) => String(n).padStart(2, '0');

/** '19:00' → '오후 7:00' */
function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${pad(m)}`;
}

function formatClock(d: Date): string {
  return formatTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
}

/** 복약 시간이 지난 정도: 25분 지남 / 2시간 지남 */
function formatLate(minutes: number): string {
  return minutes < 60 ? `${minutes}분 지남` : `${Math.floor(minutes / 60)}시간 지남`;
}

interface Data {
  schedules: Schedule[];
  slots: CubeSlot[];
  history: HistoryItem[];
}

// 오늘 아침/점심/저녁별로 "큐브에서 꺼냈는지"를 보여주는 카드.
// 복약자는 자기 기록, 보호자는 연결된 복약자의 기록을 봄. 큐브 카드처럼 5초마다 자동 갱신.
export function TodayMedsCard() {
  const router = useRouter();
  const { user } = useSession();
  const userId = user?.id;
  const role = user?.role;

  const [data, setData] = useState<Data | null>(null); // null = 아직 한 번도 못 받음
  const [noLink, setNoLink] = useState(false); // 보호자인데 연결된 복약자가 없음
  const [offline, setOffline] = useState(false);

  // 이 화면이 보이는 동안만 돌고, 다른 화면으로 가면 멈춤
  useFocusEffect(
    useCallback(() => {
      if (userId === undefined) return;
      const myId: number = userId;

      let alive = true;
      let busy = false;
      let patientId: number | null | undefined = role === 'guardian' ? undefined : myId;

      async function tick() {
        if (busy) return;
        busy = true;
        try {
          if (patientId === undefined) {
            const me = await getMe(myId);
            patientId = me.user.linked_user_id;
          }
          if (patientId === null) {
            if (alive) {
              setNoLink(true);
              setOffline(false);
            }
            return;
          }
          const [sch, cube, hist] = await Promise.all([getSchedules(patientId), getCubeSlots(patientId), getHistory(patientId)]);
          if (!alive) return;
          setNoLink(false);
          setData({ schedules: sch.schedules, slots: cube.slots, history: hist.history });
          setOffline(false);
        } catch {
          if (alive) setOffline(true);
        } finally {
          busy = false;
        }
      }

      tick();
      const timer = setInterval(tick, POLL_MS);
      return () => {
        alive = false;
        clearInterval(timer);
      };
    }, [userId, role]),
  );

  // 연결된 복약자가 없으면 큐브 카드가 이미 안내해서, 여기서는 아무것도 안 보여줌
  if (!user || noLink) return null;

  const isGuardian = user.role === 'guardian';
  const today = todayLocal();
  const now = new Date();

  // ── 오늘 시간대별 상태 계산 ──
  let body: React.ReactNode;
  let progress = '';

  if (data === null) {
    body = offline ? (
      <Text style={styles.empty}>서버에 연결할 수 없어요. 계속 다시 시도하고 있어요.</Text>
    ) : (
      <ActivityIndicator color={colors.primary} style={styles.spinner} />
    );
  } else if (data.schedules.length === 0) {
    body = isGuardian ? (
      <Text style={styles.empty}>복약자가 아직 복약 시간을 등록하지 않았어요</Text>
    ) : (
      <>
        <Text style={styles.empty}>복약 시간을 먼저 등록해 주세요</Text>
        <Button title="복약 시간 등록하기" variant="outline" onPress={() => router.push('/schedule')} />
      </>
    );
  } else if (!data.slots.some((s) => toLocalDate(s.target_date) === today)) {
    body = (
      <Text style={styles.empty}>
        {isGuardian ? '오늘은 복약 기간이 아니에요' : '오늘은 복약 기간이 아니에요. 복약 일정에서 새 기간을 시작하세요.'}
      </Text>
    );
  } else {
    // 오늘 기록 중, 시간대마다 가장 먼저 꺼낸 시각만 사용 (ESP32가 같은 신호를 반복해서 보내기도 함)
    const takenAt = new Map<string, Date>();
    for (const h of data.history) {
      if (toLocalDate(h.target_date) !== today) continue;
      const key = normPeriod(h.period);
      const at = new Date(h.confirmed_at);
      const prev = takenAt.get(key);
      if (!prev || at < prev) takenAt.set(key, at);
    }

    const doses = [...data.schedules]
      .sort((a, b) => a.time.localeCompare(b.time))
      .map((s) => {
        const [hh, mm] = s.time.split(':').map(Number);
        const due = new Date(now);
        due.setHours(hh, mm, 0, 0);
        return { id: s.id, period: s.period, time: s.time, due, at: takenAt.get(normPeriod(s.period)) ?? null };
      });

    const takenCount = doses.filter((d) => d.at).length;
    progress = `${takenCount}/${doses.length}`;

    body = (
      <>
        {doses.map((d) => {
          const info = PERIODS[normPeriod(d.period)];
          const late = d.at === null && now > d.due;
          const lateMin = Math.floor((now.getTime() - d.due.getTime()) / 60000);
          return (
            <View key={d.id} style={styles.row}>
              <View style={[styles.stripe, { backgroundColor: info?.color ?? colors.placeholder }]} />
              <View style={styles.rowText}>
                <Text style={styles.label}>{info?.label ?? d.period}</Text>
                <Text style={styles.sched}>{formatTime(d.time)}</Text>
              </View>
              {d.at ? (
                <View style={styles.takenWrap}>
                  <View style={styles.check}>
                    <Text style={styles.checkMark}>✓</Text>
                  </View>
                  <Text style={styles.takenText}>{formatClock(d.at)} 꺼냄</Text>
                </View>
              ) : late ? (
                <View style={[styles.chip, styles.chipLate]}>
                  <Text style={styles.chipLateText}>안 꺼냄 · {formatLate(lateMin)}</Text>
                </View>
              ) : (
                <View style={[styles.chip, styles.chipSoon]}>
                  <Text style={styles.chipSoonText}>예정</Text>
                </View>
              )}
            </View>
          );
        })}
      </>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>{isGuardian ? '오늘의 복약 현황' : '오늘의 복약'}</Text>
        {offline && data !== null ? (
          <View style={styles.offPill}>
            <Text style={styles.offPillText}>연결 끊김</Text>
          </View>
        ) : progress ? (
          <Text style={styles.progress}>{progress}</Text>
        ) : null}
      </View>

      {body}

    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 18,
    gap: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...shadow,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  progress: { fontSize: 15, fontWeight: '800', color: colors.primary },
  offPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.lg, backgroundColor: colors.bg },
  offPillText: { fontSize: 12, fontWeight: '700', color: colors.muted },

  spinner: { paddingVertical: 24 },
  empty: { paddingVertical: 4, fontSize: 14, lineHeight: 21, color: colors.muted },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  stripe: { width: 5, height: 36, borderRadius: 3 },
  rowText: { flex: 1, gap: 2 },
  label: { fontSize: 17, fontWeight: '700', color: colors.text },
  sched: { fontSize: 13, color: colors.muted },

  takenWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  checkMark: { fontSize: 13, fontWeight: '800', color: colors.white },
  takenText: { fontSize: 14, fontWeight: '700', color: colors.primary },

  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.lg },
  chipSoon: { backgroundColor: colors.primaryLight },
  chipSoonText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  chipLate: { backgroundColor: `${colors.accent}40` },
  chipLateText: { fontSize: 13, fontWeight: '700', color: colors.text },

});