// frontend/src/components/ui.tsx
// 여러 화면에서 같이 쓰는 버튼, 입력칸, 캡슐 모양

import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';

import { colors, radius } from '../theme';

type ButtonVariant = 'primary' | 'outline' | 'ghost';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
}

export function Button({ title, onPress, variant = 'primary', loading = false, disabled = false }: ButtonProps) {
  const inactive = disabled || loading;
  const spinnerColor = variant === 'primary' ? colors.white : colors.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'outline' && styles.buttonOutline,
        pressed && styles.buttonPressed, // 누르면 살짝 작아짐
        inactive && styles.buttonInactive,
      ]}>
      {loading ? (
        <ActivityIndicator color={spinnerColor} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            variant === 'outline' && { color: colors.primary },
            variant === 'ghost' && { color: colors.muted, fontWeight: '600' },
          ]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

interface FieldProps extends TextInputProps {
  label: string;
  secure?: boolean; // true면 비밀번호 칸 (오른쪽에 표시/숨김 버튼)
}

export function Field({ label, secure = false, style, onFocus, onBlur, ...inputProps }: FieldProps) {
  const [hidden, setHidden] = useState(secure);
  const [focused, setFocused] = useState(false);

  // 포커스 이벤트 타입은 RN 버전마다 달라서, TextInput이 요구하는 타입을 그대로 가져다 씀
  const handleFocus: NonNullable<TextInputProps['onFocus']> = (e) => {
    setFocused(true);
    onFocus?.(e);
  };
  const handleBlur: NonNullable<TextInputProps['onBlur']> = (e) => {
    setFocused(false);
    onBlur?.(e);
  };

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrap, focused && styles.inputFocused]}>
        <TextInput
          {...inputProps}
          secureTextEntry={hidden}
          placeholderTextColor={colors.placeholder}
          onFocus={handleFocus}
          onBlur={handleBlur}
          style={[styles.input, style]}
        />
        {secure && (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={10} accessibilityRole="button">
            <Text style={styles.toggle}>{hidden ? '표시' : '숨김'}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

interface CapsuleProps {
  size?: number; // 가로 길이 (세로는 비율로 계산)
  leftColor?: string;
  rightColor?: string;
  style?: StyleProp<ViewStyle>;
}

// 약 캡슐 모양. 두 가지 색 반쪽으로 이루어진 둥근 막대.
export function Capsule({ size = 120, leftColor = colors.white, rightColor = colors.accent, style }: CapsuleProps) {
  const height = size * 0.42;

  return (
    <View
      style={[
        {
          width: size,
          height,
          borderRadius: height / 2,
          shadowColor: '#032A2F',
          shadowOpacity: 0.28,
          shadowRadius: size * 0.08,
          shadowOffset: { width: 0, height: size * 0.05 },
          elevation: 6,
        },
        style,
      ]}>
      {/* 안쪽: 반쪽씩 색을 칠하고 둥근 모서리로 잘라냄 */}
      <View style={{ flex: 1, flexDirection: 'row', borderRadius: height / 2, overflow: 'hidden' }}>
        <View style={{ flex: 1, backgroundColor: leftColor }} />
        <View style={{ flex: 1, backgroundColor: rightColor }} />
        {/* 윗부분에 빛이 비치는 느낌의 얇은 줄 */}
        <View
          style={{
            position: 'absolute',
            top: height * 0.16,
            left: height * 0.5,
            right: height * 0.5,
            height: height * 0.1,
            borderRadius: height * 0.05,
            backgroundColor: 'rgba(255,255,255,0.45)',
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 56,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonOutline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.primary },
  buttonPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  buttonInactive: { opacity: 0.55 },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '700' },

  field: { gap: 8 },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 54,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  inputFocused: { borderColor: colors.primary },
  input: { flex: 1, fontSize: 16, color: colors.text },
  toggle: { fontSize: 13, fontWeight: '700', color: colors.primary, marginLeft: 8 },
});