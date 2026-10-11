import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius } from '../theme';

const SHOW_MS = 2000; // 메시지가 떠 있는 시간

// 화면 아래에 잠깐 떴다 사라지는 안내 메시지(토스트).
// 사용법: const { show, toast } = useToast(); → 화면 JSX 안에 {toast}를 넣고, show('메시지')를 부르면 됨.
// 스크롤 화면 안쪽이 아니라 화면 바깥 View 안에 넣어야 스크롤해도 그 자리에 떠 있음.
export function useToast() {
  const [message, setMessage] = useState('');
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((text: string) => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(text);
    setVisible(true);
    AccessibilityInfo.announceForAccessibility(text); // 화면 낭독(VoiceOver)을 쓰는 사람에게도 알려줌
    timer.current = setTimeout(() => setVisible(false), SHOW_MS);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return { show, toast: <ToastView message={message} visible={visible} /> };
}

function ToastView({ message, visible }: { message: string; visible: boolean }) {
  const insets = useSafeAreaInsets();
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(opacity, { toValue: visible ? 1 : 0, duration: 180, useNativeDriver: true }).start();
  }, [visible, opacity]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        {
          bottom: insets.bottom + 28,
          opacity,
          transform: [{ translateY: opacity.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
        },
      ]}>
      <View style={styles.pill}>
        <Text style={styles.text}>{message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 24, right: 24, alignItems: 'center' },
  pill: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.text,
  },
  text: { fontSize: 14, fontWeight: '700', color: colors.white },
});