import { Redirect, Stack } from 'expo-router';
import { StatusBar } from 'react-native';

import { useSession } from '../../session';
import { colors } from '../../theme';

// 로그인 후 화면들. 로그인이 안 된 상태(또는 로그아웃 직후)면 로그인 화면으로 보냄.
export default function AppLayout() {
  const { user, loading } = useSession();

  if (loading) return null;
  if (!user) return <Redirect href="/login" />;

  return (
    <>
      <StatusBar barStyle="light-content" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: colors.white,
          headerTitleStyle: { fontWeight: '700' },
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: colors.bg },
        }}
      />
    </>
  );
}