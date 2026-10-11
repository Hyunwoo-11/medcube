import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useSession } from '../session';
import { colors } from '../theme';

// 앱을 처음 열 때 들어오는 곳: 로그인 정보를 읽은 뒤 홈 또는 로그인 화면으로 보냄
export default function Index() {
  const { user, loading } = useSession();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return <Redirect href={user ? '/home' : '/login'} />;
}