import * as Clipboard from 'expo-clipboard';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadow } from '../theme';

const COPIED_MS = 2000; // 버튼이 "복사됨"으로 바뀌어 있는 시간

// 복약자 홈의 "내 초대코드" 카드. 코드를 한 글자씩 칸에 보여주고, 복사하기 버튼을 둠.
// 복사 결과 안내는 화면의 토스트로 띄우도록 onNotify로 부모에게 넘김.
export function InviteCodeCard({ code, onNotify }: { code: string; onNotify: (message: string) => void }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function onCopy() {
    try {
      await Clipboard.setStringAsync(code);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), COPIED_MS);
      onNotify('초대코드를 복사했어요');
    } catch {
      onNotify('복사하지 못했어요. 다시 시도해 주세요');
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>내 초대코드</Text>
        <Pressable
          onPress={onCopy}
          accessibilityRole="button"
          accessibilityLabel="초대코드 복사하기"
          style={({ pressed }) => [styles.copyBtn, copied && styles.copyBtnDone, pressed && styles.copyBtnPressed]}>
          <Text style={[styles.copyText, copied && styles.copyTextDone]}>{copied ? '✓ 복사됨' : '복사하기'}</Text>
        </Pressable>
      </View>

      {/* 큐브의 칸처럼, 글자마다 한 칸씩 */}
      <View style={styles.slots}>
        {code.split('').map((ch, i) => (
          <View key={i} style={styles.slot}>
            <Text style={styles.slotChar}>{ch}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.hint}>가족이 이 코드로 가입하면 보호자로 연결돼요</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 20,
    gap: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...shadow,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },

  copyBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
  },
  copyBtnDone: { backgroundColor: colors.primary },
  copyBtnPressed: { opacity: 0.7 },
  copyText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  copyTextDone: { color: colors.white },

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
  hint: { fontSize: 13, lineHeight: 19, color: colors.muted },
});