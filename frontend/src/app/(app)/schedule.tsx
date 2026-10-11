import DateTimePicker from '@react-native-community/datetimepicker';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  createSchedule,
  CubeSlot,
  deleteSchedule,
  getCubeSlots,
  getHistory,
  getSchedules,
  HistoryItem,
  Period,
  Schedule,
  setCubeMapping,
  toLocalDate,
} from '../../api';
import { Button } from '../../components/ui';
import { useSession } from '../../session';
import { colors, radius } from '../../theme';
import { errorMessage } from '../../utils';

// ───────────── 시간대 정보 ─────────────

interface SlotInfo {
  period: Period;
  label: string;
  color: string;
  defaultTime: string; // 처음 등록할 때 보여줄 시간
}

const SLOTS: SlotInfo[] = [
  { period: 'morning', label: '아침', color: colors.morning, defaultTime: '08:00' },
  { period: 'noon', label: '점심', color: colors.noon, defaultTime: '12:30' },
  { period: 'evening', label: '저녁', color: colors.evening, defaultTime: '19:00' },
];

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

// ───────────── 날짜/시간 도우미 ─────────────

const pad = (n: number) => String(n).padStart(2, '0');

/** '08:30' → 오늘 날짜의 08:30 (시간 선택기에 넘겨줄 값) */
function timeToDate(time: string): Date {
  const [h, m] = time.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

/** 시간 선택기에서 고른 값 → '08:30' (서버가 요구하는 형식) */
function dateToTime(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** '19:00' → '오후 7:00' */
function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${pad(m)}`;
}

function addDays(base: Date, n: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

/** 서버로 보낼 'YYYY-MM-DD' (기기 시간 기준) */
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const md = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;

/** 서버가 준 날짜("2026-10-10T15:00:00.000Z")를 기기 시간 기준의 그날 0시 Date로 */
function dateOf(iso: string): Date {
  const [y, m, d] = toLocalDate(iso).split('-').map(Number);
  return new Date(y, m - 1, d);
}

// ───────────── 큐브 7칸 표시 ─────────────

// first = 새로 시작할 기간의 첫날, taken = 그날 약을 모두 꺼냄, partial = 일부만 꺼냄,
// today = 오늘(아직 안 꺼냄), missed = 지난 날인데 안 꺼냄, future = 아직 안 온 날
type DotKind = 'first' | 'taken' | 'partial' | 'today' | 'missed' | 'future';

interface DotItem {
  key: string;
  label: string;
  date: string; // '10/11'
  weekday: string;
  kind: DotKind;
}

// ───────────── 화면 ─────────────

// 복약자가 하루 복약 시간(아침/점심/저녁)을 정하고, 큐브 7칸에 날짜를 연결해 복약 기간을 시작하는 화면
export default function ScheduleScreen() {
  const { user } = useSession();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [slots, setSlots] = useState<CubeSlot[]>([]); // 현재 등록된 복약 기간(7칸)
  const [history, setHistory] = useState<HistoryItem[]>([]); // 칸별로 약을 먹었는지 확인하는 데 사용

  const [editing, setEditing] = useState<Period | null>(null); // 시간 선택기가 펼쳐진 시간대
  const [draft, setDraft] = useState(() => new Date()); // 선택기에서 고르는 중인 시간
  const [saving, setSaving] = useState(false);

  const [today] = useState(() => new Date());
  const [startOffset, setStartOffset] = useState<0 | 1>(0); // 0 = 오늘부터, 1 = 내일부터
  const [starting, setStarting] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [sch, cube, hist] = await Promise.all([getSchedules(user.id), getCubeSlots(user.id), getHistory(user.id)]);
      setSchedules(sch.schedules);
      setSlots(cube.slots);
      setHistory(hist.history);
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [user]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (!user) return null;

  if (user.role === 'guardian') {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: '복약 일정' }} />
        <Text style={styles.guardianNote}>복약 일정은 복약자 계정에서 등록해요</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: '복약 일정' }} />
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const userId = user.id;
  const registeredCount = SLOTS.filter((s) => schedules.some((x) => x.period === s.period)).length;
  const hasSchedule = registeredCount > 0;

  // ── 현재 복약 기간: 날짜별로 "그날 꺼낸 시간대 수"를 세서 칸 상태를 정함 ──
  // (칸의 status는 지금 큐브에 들어 있는지만 알려줘서, 먹었는지는 복약 이력으로 판단)
  const takenByDate = new Map<string, Set<string>>();
  for (const h of history) {
    const key = ymd(dateOf(h.target_date));
    const periods = takenByDate.get(key) ?? new Set<string>();
    periods.add(h.period);
    takenByDate.set(key, periods);
  }
  const todayKey = ymd(today);
  const needed = Math.max(registeredCount, 1); // 하루에 먹어야 하는 횟수

  const course = [...slots]
    .sort((a, b) => a.cube_id - b.cube_id)
    .map((slot) => {
      const date = dateOf(slot.target_date);
      const key = ymd(date);
      const count = takenByDate.get(key)?.size ?? 0;

      let kind: DotKind;
      if (count >= needed) kind = 'taken';
      else if (count > 0) kind = 'partial';
      else if (key === todayKey) kind = 'today';
      else if (key < todayKey) kind = 'missed';
      else kind = 'future';

      const label = kind === 'taken' ? '✓' : kind === 'partial' ? `${count}/${needed}` : String(slot.cube_id);
      return { key, dot: { key: String(slot.cube_id), label, date: md(date), weekday: WEEKDAYS[date.getDay()], kind } };
    });

  let courseRange = '';
  let courseProgress = '';
  if (course.length > 0) {
    const firstKey = course[0].key;
    const lastKey = course[course.length - 1].key;
    const todayIndex = course.findIndex((c) => c.key === todayKey);
    courseRange = `${course[0].dot.date} ~ ${course[course.length - 1].dot.date}`;
    courseProgress =
      todayKey > lastKey ? '기간이 끝났어요' : todayKey < firstKey ? '아직 시작 전이에요' : todayIndex >= 0 ? `${todayIndex + 1}일째` : '진행 중';
  }

  // ── 새로 시작할 기간 미리보기 ──
  const startDate = addDays(today, startOffset);
  const days = Array.from({ length: 7 }, (_, i) => addDays(startDate, i));
  const preview: DotItem[] = days.map((d, i) => ({
    key: String(i),
    label: String(i + 1),
    date: md(d),
    weekday: WEEKDAYS[d.getDay()],
    kind: i === 0 ? 'first' : 'future',
  }));

  function onToggle(slot: SlotInfo, existing: Schedule | undefined) {
    if (editing === slot.period) {
      setEditing(null);
      return;
    }
    setDraft(timeToDate(existing?.time ?? slot.defaultTime));
    setEditing(slot.period);
  }

  async function onSave(period: Period) {
    setSaving(true);
    try {
      await createSchedule({ user_id: userId, time: dateToTime(draft), period });
      setEditing(null);
      await load();
    } catch (e) {
      Alert.alert('저장 실패', errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  function onDelete(slot: SlotInfo, existing: Schedule) {
    Alert.alert(`${slot.label} 복약 시간을 삭제할까요?`, '삭제해도 이미 기록된 이력은 그대로 남아요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteSchedule(existing.id);
            setEditing(null);
            await load();
          } catch (e) {
            Alert.alert('삭제 실패', errorMessage(e));
          }
        },
      },
    ]);
  }

  function onStart() {
    const range = `${md(days[0])}부터 ${md(days[6])}까지`;
    Alert.alert('복약 기간을 시작할까요?', `${range} 7일, 큐브 7칸에 날짜를 연결해요.\n이미 등록된 복약 기간은 새로 덮어써요.`, [
      { text: '취소', style: 'cancel' },
      {
        text: '시작',
        onPress: async () => {
          setStarting(true);
          try {
            await setCubeMapping({ user_id: userId, start_date: ymd(startDate) });
            await load(); // 위의 "현재 복약 기간"이 바로 바뀌도록
            Alert.alert('복약 기간을 등록했어요', `${range} 사용해요.\n큐브의 1번 칸부터 하루에 한 칸씩 써요.`);
          } catch (e) {
            Alert.alert('시작하지 못했어요', errorMessage(e));
          } finally {
            setStarting(false);
          }
        },
      },
    ]);
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
      <Stack.Screen options={{ title: '복약 일정' }} />

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Button title="다시 시도" variant="outline" onPress={load} />
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>복약 시간</Text>
      <Text style={styles.sectionDesc}>약을 먹는 시간대를 눌러서 시간을 정하세요. 먹지 않는 시간대는 비워두면 돼요.</Text>

      <View style={styles.list}>
        {SLOTS.map((slot) => {
          const existing = schedules.find((s) => s.period === slot.period);
          const open = editing === slot.period;

          return (
            <View key={slot.period} style={styles.card}>
              <Pressable
                onPress={() => onToggle(slot, existing)}
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                style={styles.cardHead}>
                <View style={[styles.stripe, { backgroundColor: slot.color }]} />
                <Text style={styles.slotLabel}>{slot.label}</Text>
                <View style={styles.spacer} />
                <Text style={[styles.slotTime, !existing && styles.slotTimeEmpty]}>
                  {existing ? formatTime(existing.time) : '설정 안 함'}
                </Text>
                <Text style={styles.slotAction}>{open ? '닫기' : existing ? '변경' : '추가'}</Text>
              </Pressable>

              {open ? (
                <View style={styles.editor}>
                  <DateTimePicker
                    value={draft}
                    mode="time"
                    display="spinner"
                    minuteInterval={5}
                    locale="ko-KR"
                    themeVariant="light"
                    onChange={(_, picked) => {
                      if (picked) setDraft(picked);
                    }}
                  />
                  <View style={styles.editorActions}>
                    {existing ? (
                      <View style={styles.flex1}>
                        <Button title="삭제" variant="outline" onPress={() => onDelete(slot, existing)} />
                      </View>
                    ) : null}
                    <View style={styles.flex2}>
                      <Button title="저장" onPress={() => onSave(slot.period)} loading={saving} />
                    </View>
                  </View>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      <Text style={[styles.sectionTitle, styles.sectionGap]}>복약 기간</Text>

      <View style={styles.courseCard}>
        {course.length > 0 ? (
          <>
            <View style={styles.courseHead}>
              <Text style={styles.courseRange}>{courseRange}</Text>
              <Text style={styles.courseProgress}>{courseProgress}</Text>
            </View>
            <CubeDots items={course.map((c) => c.dot)} />
            <Text style={styles.caption}>{'✓ : 모두 꺼냄\n1/2 : 일부만 꺼냄\n⭕ : 꺼내지 않음'}</Text>
          </>
        ) : (
          <Text style={styles.courseEmpty}>등록된 복약 기간이 없어요. 아래에서 새로 시작하세요.</Text>
        )}
      </View>

      <Text style={[styles.subTitle, styles.sectionGap]}>새 복약 기간 시작</Text>
      <Text style={styles.sectionDesc}>큐브 7칸에 날짜를 연결해요. 칸은 하루에 하나씩, 시작일부터 7일 동안 써요.</Text>

      <View style={styles.segment}>
        <SegmentItem label="오늘부터" selected={startOffset === 0} onPress={() => setStartOffset(0)} />
        <SegmentItem label="내일부터" selected={startOffset === 1} onPress={() => setStartOffset(1)} />
      </View>

      <CubeDots items={preview} />

      <Button title="복약 시작" onPress={onStart} loading={starting} disabled={!hasSchedule} />
      {!hasSchedule ? <Text style={styles.hint}>먼저 복약 시간을 한 개 이상 정해주세요</Text> : null}
    </ScrollView>
  );
}

function CubeDots({ items }: { items: DotItem[] }) {
  return (
    <View style={styles.cubeRow}>
      {items.map((item) => {
        const look = dotLook(item.kind);
        return (
          <View key={item.key} style={styles.cubeItem}>
            <View style={[styles.cubeCircle, look.circle]}>
              <Text style={[styles.cubeNumber, look.text]}>{item.label}</Text>
            </View>
            <Text style={styles.cubeDate}>{item.date}</Text>
            <Text style={styles.cubeWeekday}>{item.weekday}</Text>
          </View>
        );
      })}
    </View>
  );
}

function dotLook(kind: DotKind) {
  switch (kind) {
    case 'first':
    case 'taken':
      return { circle: styles.dotSolid, text: styles.dotTextSolid };
    case 'partial':
      return { circle: styles.dotPartial, text: styles.dotTextSmall };
    case 'today':
      return { circle: styles.dotToday, text: undefined };
    case 'missed':
      return { circle: styles.dotMissed, text: styles.dotTextMissed };
    default:
      return { circle: undefined, text: undefined };
  }
}

function SegmentItem({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[styles.segItem, selected && styles.segItemOn]}>
      <Text style={[styles.segText, selected && styles.segTextOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  guardianNote: { fontSize: 15, color: colors.muted, textAlign: 'center' },
  content: { padding: 24, paddingTop: 8, paddingBottom: 48, gap: 12 },
  flex1: { flex: 1 },
  flex2: { flex: 2 },
  spacer: { flex: 1 },

  errorBox: { gap: 10, padding: 14, borderRadius: radius.md, backgroundColor: colors.surface },
  errorText: { fontSize: 13, lineHeight: 19, color: colors.danger },

  sectionTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4, color: colors.text },
  subTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  sectionGap: { marginTop: 28 },
  sectionDesc: { fontSize: 14, lineHeight: 21, color: colors.muted },

  list: { gap: 10, marginTop: 4 },
  card: { borderRadius: radius.md, backgroundColor: colors.surface, overflow: 'hidden' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  stripe: { width: 5, height: 30, borderRadius: 3 },
  slotLabel: { fontSize: 17, fontWeight: '700', color: colors.text },
  slotTime: { fontSize: 16, fontWeight: '600', color: colors.text },
  slotTimeEmpty: { fontWeight: '400', color: colors.placeholder },
  slotAction: { fontSize: 13, fontWeight: '700', color: colors.primary, minWidth: 28, textAlign: 'right' },
  editor: { paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
  editorActions: { flexDirection: 'row', gap: 10 },

  courseCard: { gap: 6, padding: 16, borderRadius: radius.md, backgroundColor: colors.surface },
  courseHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  courseRange: { fontSize: 18, fontWeight: '800', color: colors.text },
  courseProgress: { fontSize: 14, fontWeight: '700', color: colors.primary },
  courseEmpty: { fontSize: 14, lineHeight: 21, color: colors.muted },
  caption: { fontSize: 12, lineHeight: 18, color: colors.muted },

  segment: {
    flexDirection: 'row',
    padding: 4,
    marginTop: 4,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
  },
  segItem: { flex: 1, height: 42, borderRadius: radius.sm + 2, alignItems: 'center', justifyContent: 'center' },
  segItemOn: { backgroundColor: colors.surface },
  segText: { fontSize: 14, color: colors.muted },
  segTextOn: { fontWeight: '700', color: colors.primary },

  cubeRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 8 },
  cubeItem: { alignItems: 'center', gap: 4 },
  cubeCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
  },
  cubeNumber: { fontSize: 15, fontWeight: '700', color: colors.primary },
  cubeDate: { fontSize: 12, fontWeight: '600', color: colors.text },
  cubeWeekday: { fontSize: 11, color: colors.muted },

  dotSolid: { backgroundColor: colors.primary },
  dotTextSolid: { color: colors.white },
  dotPartial: { borderWidth: 2, borderColor: colors.primary },
  dotTextSmall: { fontSize: 12 },
  dotToday: { backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.primary },
  dotMissed: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.danger },
  dotTextMissed: { color: colors.danger },

  hint: { fontSize: 13, color: colors.muted, textAlign: 'center' },
});