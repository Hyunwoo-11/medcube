import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { CubeSlot, getCubeSlots, getMe, toLocalDate, todayLocal } from '../api';
import { useSession } from '../session';
import { colors, radius, shadow } from '../theme';

const POLL_MS = 5000; // 서버에 큐브 상태를 다시 물어보는 간격
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const pad = (n: number) => String(n).padStart(2, '0');

function formatTime(d: Date): string {
  const h = d.getHours();
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// 큐브 7칸이 지금 제자리에 있는지(초록불) 빠져 있는지(빨간불)를 보여주는 카드.
// 화면이 보이는 동안 5초마다 서버에서 다시 읽어와서, 큐브를 꺼내면 바로 불이 바뀜.
// 복약자는 자기 큐브, 보호자는 연결된 복약자의 큐브를 봄.
export function CubeStatusCard() {
  const { user } = useSession();
  const userId = user?.id;
  const role = user?.role;

  const [slots, setSlots] = useState<CubeSlot[] | null>(null); // null = 아직 한 번도 못 받음
  const [noLink, setNoLink] = useState(false); // 보호자인데 연결된 복약자가 없음
  const [offline, setOffline] = useState(false); // 마지막 요청이 실패함
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  // 이 화면이 보이는 동안만 돌고, 다른 화면으로 가면 멈춤
  useFocusEffect(
    useCallback(() => {
      if (userId === undefined) return;
      const myId: number = userId;

      let alive = true;
      let busy = false; // 이전 요청이 안 끝났으면 건너뜀
      // 복약자는 내 id, 보호자는 연결된 복약자 id (처음 한 번만 서버에 물어봄. undefined = 아직 모름)
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
          const res = await getCubeSlots(patientId);
          if (!alive) return;
          setNoLink(false);
          setSlots(res.slots);
          setUpdatedAt(new Date());
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

  if (!user) return null;

  const title = user.role === 'guardian' ? '복약자의 큐브' : '내 큐브';
  const today = todayLocal();

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>{title}</Text>
        {slots !== null && !noLink ? (
          <View style={[styles.pill, offline && styles.pillOff]}>
            <View style={[styles.pillDot, offline && styles.pillDotOff]} />
            <Text style={[styles.pillText, offline && styles.pillTextOff]}>{offline ? '연결 끊김' : '실시간'}</Text>
          </View>
        ) : null}
      </View>

      {noLink ? (
        <Text style={styles.empty}>연결된 복약자가 없어요</Text>
      ) : slots === null ? (
        offline ? (
          <Text style={styles.empty}>서버에 연결할 수 없어요. 계속 다시 시도하고 있어요.</Text>
        ) : (
          <ActivityIndicator color={colors.primary} style={styles.spinner} />
        )
      ) : slots.length === 0 ? (
        <Text style={styles.empty}>등록된 복약 기간이 없어요</Text>
      ) : (
        <>
          <View style={styles.tiles}>
            {slots.map((slot) => {
              const out = slot.status === 'removed';
              const date = toLocalDate(slot.target_date);
              const [y, m, d] = date.split('-').map(Number);
              const isToday = date === today;
              const tone = out ? colors.danger : colors.ok;
              return (
                <View
                  key={slot.cube_id}
                  accessible
                  accessibilityLabel={`${slot.cube_id}번 칸, ${m}월 ${d}일, ${out ? '빠져 있음' : '제자리'}${isToday ? ', 오늘' : ''}`}
                  style={[styles.tile, { backgroundColor: out ? colors.dangerLight : colors.okLight }, isToday && styles.tileToday]}>
                  <View style={[styles.light, { backgroundColor: tone, shadowColor: tone }]} />
                  <Text style={styles.tileNumber}>{slot.cube_id}</Text>
                  <Text style={styles.tileDate}>
                    {m}/{d}
                  </Text>
                  <Text style={[styles.tileSub, isToday && styles.tileSubToday]}>
                    {isToday ? '오늘' : WEEKDAYS[new Date(y, m - 1, d).getDay()]}
                  </Text>
                </View>
              );
            })}
          </View>

          <View style={styles.legend}>
            <View style={[styles.legendDot, { backgroundColor: colors.ok }]} />
            <Text style={styles.legendText}>제자리</Text>
            <View style={[styles.legendDot, { backgroundColor: colors.danger }]} />
            <Text style={styles.legendText}>빠져 있음</Text>
          </View>

          <Text style={styles.footer}>
            {offline
              ? '연결이 끊겨서 마지막으로 받은 상태를 보여주고 있어요'
              : updatedAt
                ? `${formatTime(updatedAt)} 확인 · 5초마다 자동으로 갱신해요`
                : ''}
          </Text>
        </>
      )}
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

  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.lg,
    backgroundColor: colors.okLight,
  },
  pillOff: { backgroundColor: colors.bg },
  pillDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.ok },
  pillDotOff: { backgroundColor: colors.placeholder },
  pillText: { fontSize: 12, fontWeight: '700', color: colors.ok },
  pillTextOff: { color: colors.muted },

  spinner: { paddingVertical: 24 },
  empty: { paddingVertical: 12, fontSize: 14, lineHeight: 21, color: colors.muted },

  tiles: { flexDirection: 'row', gap: 6 },
  tile: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: 10,
    borderRadius: radius.sm + 2,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tileToday: { borderColor: colors.primary },
  light: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginBottom: 2,
    // 불이 켜진 것처럼 같은 색으로 번지는 빛
    shadowOpacity: 0.7,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  tileNumber: { fontSize: 18, fontWeight: '800', color: colors.text },
  tileDate: { fontSize: 11, fontWeight: '600', color: colors.text },
  tileSub: { fontSize: 10, color: colors.muted },
  tileSubToday: { fontWeight: '800', color: colors.primary },

  legend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { marginRight: 10, fontSize: 12, color: colors.muted },
  footer: { fontSize: 12, color: colors.placeholder },
});