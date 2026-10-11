// frontend/src/theme.ts
// 앱 전체에서 쓰는 색, 모서리 둥글기, 그림자.
// 색은 "약 캡슐" 두 가지 색(청록 + 호박)에서 가져왔습니다.

import type { ViewStyle } from 'react-native';

export const colors = {
  primary: '#0B7A85', // 청록: 헤더 패널, 주요 버튼
  primaryDark: '#075760', // 청록의 진한 톤: 패널 위 장식
  primaryLight: '#DCEFEF', // 청록의 연한 톤: 선택된 카드, 코드 칸 배경
  accent: '#FFB547', // 호박: 캡슐의 다른 쪽 색, 포인트
  text: '#0F2A35',
  muted: '#5F7480',
  placeholder: '#93A4AC',
  border: '#D3E0E0',
  bg: '#F3F7F6', // 살짝 민트빛이 도는 연한 회색
  surface: '#FFFFFF', // 카드
  danger: '#D6453D', // 미복약 표시
  white: '#FFFFFF',

  // 하루 중 복약 시간대 색 (일정/현황 화면에서 사용 예정)
  morning: '#F5A524',
  noon: '#12A594',
  evening: '#6E56CF',
};

// 위계에 따라 둥글기를 다르게: 작은 요소는 작게, 큰 패널은 크게
export const radius = {
  sm: 10,
  md: 16,
  lg: 24,
  xl: 36,
};

// 회색 대신 청록 계열의 옅은 그림자
export const shadow: ViewStyle = {
  shadowColor: '#06353B',
  shadowOpacity: 0.1,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 8 },
  elevation: 3,
};