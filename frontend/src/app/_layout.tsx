import { Stack } from 'expo-router';

import { SessionProvider } from '../session';

// 앱 전체를 SessionProvider로 감싸서 어느 화면에서든 로그인 정보를 쓸 수 있게 함.
// 실제 헤더는 (auth), (app) 폴더의 _layout.tsx에서 각각 그림.
export default function RootLayout() {
  return (
    <SessionProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </SessionProvider>
  );
}