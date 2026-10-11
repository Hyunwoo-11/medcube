import { Redirect, Stack } from 'expo-router';

import { useSession } from '../../session';
import { colors } from '../../theme';

// 로그인 전 화면들(로그인, 회원가입). 이미 로그인된 상태면 홈으로 보냄.
export default function AuthLayout() {
  const { user, loading } = useSession();

  if (loading) return null;
  if (user) return <Redirect href="/home" />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false, // 헤더 아래 구분선 없앰
        headerTintColor: colors.primary, // 뒤로 가기 화살표 색
        headerTitle: '', // 제목은 화면 안의 큰 글씨로 보여줌
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.bg },
      }}>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="signup" options={{ title: '회원가입' }} />
    </Stack>
  );
}