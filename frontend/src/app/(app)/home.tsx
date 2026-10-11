import { Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/ui';
import { useSession } from '../../session';
import { colors, radius, shadow } from '../../theme';

// 임시 홈 화면: 역할(복약자/보호자)에 따라 다른 내용을 보여주는 틀만 잡아둔 상태.
// 다음 단계에서 복약자 홈(오늘의 복약, 내 보호자, 초대코드)과
// 보호자 화면(복약 현황)으로 각각 교체할 예정.
export default function Home() {
  const { user, signOut } = useSession();
  if (!user) return null;

  const isGuardian = user.role === 'guardian';
  const codeChars = (user.invite_code ?? '').split('');

  return (
    <View style={styles.container}>
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

      {!isGuardian && codeChars.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>내 초대코드</Text>
          {/* 큐브의 칸처럼, 글자마다 한 칸씩 */}
          <View style={styles.slots}>
            {codeChars.map((ch, i) => (
              <View key={i} style={styles.slot}>
                <Text style={styles.slotChar}>{ch}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.cardHint}>가족이 이 코드로 가입하면 보호자로 연결돼요</Text>
        </View>
      ) : null}

      <View style={styles.spacer} />
      <Button title="로그아웃" variant="ghost" onPress={signOut} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 8, gap: 20 },
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

  card: {
    padding: 20,
    gap: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...shadow,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  slots: { flexDirection: 'row', gap: 8 },
  slot: {
    flex: 1,
    height: 58,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
  },
  slotChar: { fontSize: 26, fontWeight: '800', color: colors.primary },
  cardHint: { fontSize: 13, lineHeight: 19, color: colors.muted },

  spacer: { flex: 1 },
});