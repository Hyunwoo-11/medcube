import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { getMe } from '../../api';
import { Button } from '../../components/ui';
import { CubeStatusCard } from '../../components/CubeStatusCard';
import { GuardiansCard } from '../../components/GuardiansCard';
import { InviteCodeCard } from '../../components/InviteCodeCard';
import { TodayMedsCard } from '../../components/TodayMedsCard';
import { useToast } from '../../components/Toast';
import { useSession } from '../../session';
import { colors, radius } from '../../theme';

// 임시 홈 화면: 역할(복약자/보호자)에 따라 다른 내용을 보여주는 틀만 잡아둔 상태.
// 다음 단계에서 복약자 홈(오늘의 복약, 내 보호자, 초대코드)과
// 보호자 화면(복약 현황)으로 각각 교체할 예정.
export default function Home() {
  const router = useRouter();
  const { user, signOut } = useSession();
  const { show, toast } = useToast();
  const userId = user?.id;
  const role = user?.role;

  // 보호자 화면에 보여줄 "연결된 복약자 이름"
  const [patientName, setPatientName] = useState<string | null>(null);
  useEffect(() => {
    if (userId === undefined || role !== 'guardian') return;
    let alive = true;
    (async () => {
      try {
        const me = await getMe(userId);
        if (me.user.linked_user_id === null) return;
        const patient = await getMe(me.user.linked_user_id);
        if (alive) setPatientName(patient.user.name);
      } catch {
        // 이름은 없어도 화면이 동작하니 조용히 넘어감
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId, role]);

  if (!user) return null;

  const isGuardian = user.role === 'guardian';

  return (
    // 토스트는 스크롤 안쪽이 아니라 바깥 View에 둬야, 스크롤해도 화면 아래에 떠 있음
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Stack.Screen options={{ title: isGuardian ? '복약 현황' : '오늘의 복약' }} />

        <View style={styles.greetingRow}>
          <View>
            <Text style={styles.hello}>안녕하세요,</Text>
            <Text style={styles.name}>{user.name}님</Text>
          </View>
          <View style={styles.rolePill}>
            <Text style={styles.rolePillText}>{isGuardian ? '보호자' : '복약자'}</Text>
          </View>
        </View>

        {isGuardian && patientName ? (
          <View style={styles.patientRow}>
            <Text style={styles.patientLabel}>보호 중인 복약자</Text>
            <Text style={styles.patientName}>{patientName}님</Text>
          </View>
        ) : null}

        {/* 오늘 아침/점심/저녁별로 큐브에서 꺼냈는지 */}
        <TodayMedsCard />

        {/* 큐브 7칸의 실시간 상태 (초록불 = 제자리, 빨간불 = 빠져 있음) */}
        <CubeStatusCard />

        {/* 나를 보호하는 사람들 (복약자 계정에서만 보임) */}
        <GuardiansCard />

        {!isGuardian && user.invite_code ? <InviteCodeCard code={user.invite_code} onNotify={show} /> : null}

        <Button title="복약 이력 보기" onPress={() => router.push('/history')} />
        {!isGuardian ? (
          <Button title="복약 일정 관리" variant="outline" onPress={() => router.push('/schedule')} />
        ) : null}

        <View style={styles.spacer} />
        <Button title="로그아웃" variant="ghost" onPress={signOut} />
      </ScrollView>

      {toast}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  // ScrollView 안쪽: flexGrow로 화면이 남을 땐 spacer가 로그아웃을 아래로 밀고, 모자랄 땐 스크롤됨
  container: { flexGrow: 1, padding: 24, paddingTop: 8, paddingBottom: 32, gap: 20 },
  greetingRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  hello: { fontSize: 15, color: colors.muted },
  name: { marginTop: 2, fontSize: 28, fontWeight: '800', letterSpacing: -0.5, color: colors.text },
  rolePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
  },
  rolePillText: { fontSize: 13, fontWeight: '700', color: colors.primary },

  patientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
  },
  patientLabel: { fontSize: 13, color: colors.muted },
  patientName: { fontSize: 17, fontWeight: '800', color: colors.primary },

  spacer: { flex: 1 },
});