import { ReactNode, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { linkGuardian, Role, signup } from '../../api';
import { Button, Capsule, Field } from '../../components/ui';
import { useSession } from '../../session';
import { colors, radius } from '../../theme';
import { errorMessage } from '../../utils';

const MIN_PASSWORD_LENGTH = 6; // 서버에는 길이 규칙이 없어서 앱에서만 확인

export default function SignupScreen() {
  const { signIn } = useSession();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('user'); // user = 본인 복약
  const [inviteCode, setInviteCode] = useState('');
  const [busy, setBusy] = useState(false);

  const isGuardian = role === 'guardian';

  async function onSubmit() {
    if (!name.trim() || !email.trim() || !password) {
      Alert.alert('입력 확인', '이름, 이메일, 비밀번호를 모두 입력해주세요.');
      return;
    }
    if (!email.includes('@')) {
      Alert.alert('입력 확인', '이메일 형식을 확인해주세요.');
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      Alert.alert('입력 확인', `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상으로 입력해주세요.`);
      return;
    }
    if (isGuardian && !inviteCode.trim()) {
      Alert.alert('입력 확인', '연결할 복약자에게 받은 초대코드를 입력해주세요.');
      return;
    }

    setBusy(true);
    try {
      const res = await signup({ name: name.trim(), email: email.trim(), password, role });

      // 보호자는 가입 직후 초대코드로 복약자와 연결 (연결 API가 따로 있음)
      if (isGuardian) {
        try {
          await linkGuardian({ guardianUserId: res.userId, invite_code: inviteCode });
        } catch (e) {
          // 계정은 이미 만들어졌으므로 가입 자체는 성공으로 처리하고 알려줌
          Alert.alert('가입은 완료됐어요', `보호자 연결에는 실패했어요.\n${errorMessage(e)}`);
        }
      }

      // 회원가입 응답에는 사용자 정보가 일부만 있어서, 입력한 값과 합쳐서 로그인 상태로 만듦
      await signIn({ id: res.userId, name: name.trim(), role, invite_code: res.invite_code });
    } catch (e) {
      Alert.alert('회원가입 실패', errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>계정 만들기</Text>

        <View style={styles.fields}>
          <Field label="이름" value={name} onChangeText={setName} placeholder="홍길동" returnKeyType="next" />
          <Field
            label="이메일"
            value={email}
            onChangeText={setEmail}
            placeholder="example@email.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            returnKeyType="next"
          />
          <Field
            label="비밀번호"
            secure
            value={password}
            onChangeText={setPassword}
            placeholder={`${MIN_PASSWORD_LENGTH}자 이상`}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <Text style={styles.sectionTitle}>어떻게 사용하시나요?</Text>
        <View style={styles.roles}>
          <RoleCard
            title="본인 복약"
            desc="내가 먹는 약을 큐브로 기록해요"
            selected={!isGuardian}
            onPress={() => setRole('user')}
            glyph={<Capsule size={36} leftColor={colors.primary} style={styles.tilt} />}
          />
          <RoleCard
            title="보호자"
            desc="가족이 약을 먹었는지 확인해요"
            selected={isGuardian}
            onPress={() => setRole('guardian')}
            glyph={<PersonGlyph />}
          />
        </View>

        {isGuardian ? (
          <View style={styles.inviteBox}>
            <Field
              label="초대코드"
              value={inviteCode}
              onChangeText={(t) => setInviteCode(t.toUpperCase())}
              placeholder="예: A3F9K2"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
            />
            <Text style={styles.help}>복약자의 홈 화면에 있는 6자리 코드예요</Text>
          </View>
        ) : (
          <Text style={styles.help}>가입하면 가족에게 보낼 수 있는 초대코드가 만들어져요</Text>
        )}

        <Button title="가입하기" onPress={onSubmit} loading={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

interface RoleCardProps {
  title: string;
  desc: string;
  selected: boolean;
  onPress: () => void;
  glyph: ReactNode;
}

function RoleCard({ title, desc, selected, onPress, glyph }: RoleCardProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[styles.roleCard, selected && styles.roleCardSelected]}>
      <View style={[styles.glyphBox, selected && styles.glyphBoxSelected]}>{glyph}</View>
      <View style={styles.roleBody}>
        <Text style={styles.roleTitle}>{title}</Text>
        <Text style={styles.roleDesc}>{desc}</Text>
      </View>
      <View style={[styles.check, selected && styles.checkOn]}>
        {selected ? <Text style={styles.checkMark}>✓</Text> : null}
      </View>
    </Pressable>
  );
}

// 사람 모양 (머리 + 어깨). 이미지 파일 없이 도형만으로 그림.
function PersonGlyph() {
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: 13, height: 13, borderRadius: 7, backgroundColor: colors.primary }} />
      <View
        style={{
          marginTop: 3,
          width: 26,
          height: 12,
          borderTopLeftRadius: 13,
          borderTopRightRadius: 13,
          backgroundColor: colors.primary,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 24, paddingTop: 8, paddingBottom: 40, gap: 20 },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5, color: colors.text },
  fields: { gap: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 4 },
  roles: { gap: 12, marginTop: -8 },
  tilt: { transform: [{ rotate: '-35deg' }] },

  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  roleCardSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  glyphBox: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
  },
  glyphBoxSelected: { backgroundColor: colors.surface },
  roleBody: { flex: 1, gap: 2 },
  roleTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  roleDesc: { fontSize: 13, color: colors.muted },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  checkMark: { color: colors.white, fontSize: 14, fontWeight: '800' },

  inviteBox: {
    gap: 10,
    padding: 16,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  help: { fontSize: 13, lineHeight: 19, color: colors.muted },
});