import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { login } from '../../api';
import { Button, Capsule, Field } from '../../components/ui';
import { useSession } from '../../session';
import { colors, radius } from '../../theme';
import { errorMessage } from '../../utils';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signIn } = useSession();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  // 앱을 열 때 캡슐이 위에서 떨어져 기울어지는 연출 (한 번만)
  const [drop] = useState(() => new Animated.Value(0));
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce) {
        drop.setValue(1); // 움직임 줄이기 설정이면 바로 최종 위치
      } else {
        Animated.spring(drop, { toValue: 1, friction: 6, tension: 40, useNativeDriver: true }).start();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [drop]);

  const capsuleStyle = {
    opacity: drop.interpolate({ inputRange: [0, 0.3], outputRange: [0, 1], extrapolate: 'clamp' }),
    transform: [
      { translateY: drop.interpolate({ inputRange: [0, 1], outputRange: [-60, 0] }) },
      { rotate: drop.interpolate({ inputRange: [0, 1], outputRange: ['-80deg', '-26deg'] }) },
    ],
  };

  async function onLogin() {
    if (!email.trim() || !password) {
      Alert.alert('입력 확인', '이메일과 비밀번호를 입력해주세요.');
      return;
    }
    setBusy(true);
    try {
      const res = await login({ email: email.trim(), password });
      await signIn(res.user); // 로그인 정보가 저장되면 (auth) 레이아웃이 알아서 홈으로 보냄
    } catch (e) {
      Alert.alert('로그인 실패', errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {/* 위쪽 청록 패널: 상태바 영역까지 색이 이어지도록 위 여백을 직접 계산 */}
        <View style={[styles.hero, { paddingTop: insets.top + 24 }]}>
          <View style={styles.heroCircle} />
          <Animated.View style={[styles.capsule, { top: insets.top + 36 }, capsuleStyle]}>
            <Capsule size={184} />
          </Animated.View>

          <Text style={styles.brand}>복약지킴이</Text>
          <Text style={styles.tagline}>약을 기록하다</Text>
        </View>

        <View style={styles.form}>
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
            placeholder="비밀번호"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={onLogin}
          />
          <View style={styles.gap} />
          <Button title="로그인" onPress={onLogin} loading={busy} />

          <View style={styles.signupRow}>
            <Text style={styles.signupHint}>계정이 없으신가요?</Text>
            <Pressable onPress={() => router.push('/signup')} hitSlop={12} accessibilityRole="link">
              <Text style={styles.signupLink}>회원가입</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1 },

  hero: {
    minHeight: 310,
    justifyContent: 'flex-end',
    paddingHorizontal: 28,
    paddingBottom: 36,
    backgroundColor: colors.primary,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    overflow: 'hidden',
  },
  heroCircle: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    left: -120,
    bottom: -170,
    backgroundColor: colors.primaryDark,
    opacity: 0.6,
  },
  capsule: { position: 'absolute', right: -14 },
  brand: { fontSize: 36, fontWeight: '800', letterSpacing: -1, color: colors.white },
  tagline: { marginTop: 8, fontSize: 15, color: 'rgba(255,255,255,0.85)' },

  form: { padding: 28, paddingTop: 32, gap: 18 },
  gap: { height: 2 },
  signupRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 4 },
  signupHint: { fontSize: 14, color: colors.muted },
  signupLink: { fontSize: 14, fontWeight: '700', color: colors.primary },
});