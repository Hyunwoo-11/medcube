import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getGuardians, Guardian } from '../api';
import { useSession } from '../session';
import { colors, radius, shadow } from '../theme';

const POLL_MS = 5000; // 서버에 다시 물어보는 간격

// 복약자 홈에서 "나를 보호하는 사람들"을 보여주는 카드.
// 보호자가 초대코드로 가입하면 몇 초 안에 이름이 나타남. (복약자 계정에서만 보임)
export function GuardiansCard() {
  const { user } = useSession();
  const userId = user?.id;
  const isPatient = user?.role === 'user';

  const [guardians, setGuardians] = useState<Guardian[] | null>(null); // null = 아직 한 번도 못 받음
  const [failed, setFailed] = useState(false);

  // 이 화면이 보이는 동안만 돌고, 다른 화면으로 가면 멈춤
  useFocusEffect(
    useCallback(() => {
      if (userId === undefined || !isPatient) return;
      const myId: number = userId;

      let alive = true;
      let busy = false; // 이전 요청이 안 끝났으면 건너뜀

      async function tick() {
        if (busy) return;
        busy = true;
        try {
          const res = await getGuardians(myId);
          if (!alive) return;
          setGuardians(res.guardians);
          setFailed(false);
        } catch {
          if (alive) setFailed(true);
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
    }, [userId, isPatient]),
  );

  if (!user || !isPatient) return null;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>내 보호자</Text>
        {guardians !== null && guardians.length > 0 ? <Text style={styles.count}>{guardians.length}명</Text> : null}
      </View>

      {guardians === null ? (
        <Text style={styles.empty}>{failed ? '보호자 목록을 불러오지 못했어요' : '불러오는 중이에요'}</Text>
      ) : guardians.length === 0 ? (
        <Text style={styles.empty}>아직 연결된 보호자가 없어요. 아래 초대코드를 가족에게 알려주세요.</Text>
      ) : (
        guardians.map((g) => (
          <View key={g.id} style={styles.row}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{g.name.trim().charAt(0)}</Text>
            </View>
            <View style={styles.rowText}>
              <Text style={styles.name}>{g.name}</Text>
              <Text style={styles.email}>{g.email}</Text>
            </View>
          </View>
        ))
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
  count: { fontSize: 15, fontWeight: '800', color: colors.primary },

  empty: { paddingVertical: 4, fontSize: 14, lineHeight: 21, color: colors.muted },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
  },
  avatarText: { fontSize: 18, fontWeight: '800', color: colors.primary },
  rowText: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  email: { fontSize: 12, color: colors.muted },
});