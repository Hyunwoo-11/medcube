import { Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';

import { getHistory, getMe, HistoryItem, toLocalDate, todayLocal } from '../../api';
import { Button, Capsule } from '../../components/ui';
import { useSession } from '../../session';
import { colors, radius } from '../../theme';
import { errorMessage } from '../../utils';

// ───────────── 화면에 보여줄 이름/색 (DB 값 → 한글) ─────────────

interface PeriodInfo {
  label: string;
  color: string;
  order: number; // 하루 안에서 보여줄 순서
}

// DB에 새 값이 생겨도 화면이 깨지지 않게, 모르는 값은 그대로 보여줌
const PERIODS: Record<string, PeriodInfo | undefined> = {
  morning: { label: '아침', color: colors.morning, order: 0 },
  noon: { label: '점심', color: colors.noon, order: 1 },
  lunch: { label: '점심', color: colors.noon, order: 1 },
  evening: { label: '저녁', color: colors.evening, order: 2 },
};
const UNKNOWN_ORDER = 9;

const METHOD_LABELS: Record<string, string | undefined> = {
  sensor: '약통에서 큐브를 꺼냄',
};

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

// ───────────── 데이터 모양 ─────────────

interface Row {
  key: string; // 날짜|시간대. 같은 날 같은 시간대는 한 번 먹은 것으로 봄
  date: string; // 'YYYY-MM-DD' (기기 시간 기준)
  period: string;
  method: string;
  confirmedAt: Date;
}

interface Section {
  title: string;
  isToday: boolean;
  data: Row[];
}

const pad = (n: number) => String(n).padStart(2, '0');

function formatDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${m}월 ${d}일 ${WEEKDAYS[new Date(y, m - 1, d).getDay()]}요일`;
}

function formatTime(d: Date): string {
  const h = d.getHours();
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${pad(d.getMinutes())}`;
}

function periodOrder(period: string): number {
  return PERIODS[period]?.order ?? UNKNOWN_ORDER;
}

// 서버가 준 기록 목록을 "날짜별 묶음"으로 바꿈
function groupByDate(items: HistoryItem[]): Section[] {
  // ESP32가 같은 칸을 10초 간격으로 여러 번 보낸 기록이 DB에 있어서,
  // 같은 날짜+시간대는 가장 이른 기록 하나만 남김 (서버에서 막는 건 따로 고칠 예정)
  const doses = new Map<string, Row>();
  for (const item of items) {
    const date = toLocalDate(item.target_date);
    const key = `${date}|${item.period}`;
    const at = new Date(item.confirmed_at);
    const prev = doses.get(key);
    if (!prev || at < prev.confirmedAt) {
      doses.set(key, { key, date, period: item.period, method: item.method, confirmedAt: at });
    }
  }

  const byDate = new Map<string, Row[]>();
  for (const row of doses.values()) {
    const rows = byDate.get(row.date) ?? [];
    rows.push(row);
    byDate.set(row.date, rows);
  }

  const today = todayLocal();
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1)) // 최신 날짜가 위로
    .map(([date, rows]) => ({
      title: formatDay(date),
      isToday: date === today,
      data: rows.sort(
        (a, b) => periodOrder(a.period) - periodOrder(b.period) || a.confirmedAt.getTime() - b.confirmedAt.getTime(),
      ),
    }));
}

// ───────────── 화면 ─────────────

// 복약자는 내 이력을, 보호자는 연결된 복약자의 이력을 보여주는 공용 화면
export default function History() {
  const { user } = useSession();

  const [loading, setLoading] = useState(true); // 처음 불러오는 중
  const [refreshing, setRefreshing] = useState(false); // 당겨서 새로고침 중
  const [sections, setSections] = useState<Section[]>([]);
  const [ownerName, setOwnerName] = useState('');
  const [noLink, setNoLink] = useState(false); // 보호자인데 연결된 복약자가 없음
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      let targetId = user.id;
      let name = user.name;

      if (user.role === 'guardian') {
        // 로그인 응답에는 연결 정보가 없어서 /api/me로 따로 조회
        const { user: me } = await getMe(user.id);
        if (me.linked_user_id == null) {
          setNoLink(true);
          setSections([]);
          setError(null);
          return;
        }
        targetId = me.linked_user_id;
        name = (await getMe(targetId)).user.name;
      }

      const res = await getHistory(targetId);
      setOwnerName(name);
      setSections(groupByDate(res.history));
      setNoLink(false);
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

  if (loading) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: '복약 이력' }} />
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const isGuardian = user.role === 'guardian';
  const total = sections.reduce((n, s) => n + s.data.length, 0);
  const showHeader = !noLink && !(error && sections.length === 0);

  return (
    <>
      <Stack.Screen options={{ title: '복약 이력' }} />
      <SectionList<Row, Section>
        sections={sections}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListHeaderComponent={
          showHeader ? (
            <View>
              <Text style={styles.title}>{isGuardian ? `${ownerName}님의 복약 이력` : '내 복약 이력'}</Text>
              {total > 0 ? <Text style={styles.subtitle}>총 {total}회 기록</Text> : null}
              {/* 새로고침에 실패해도 이미 불러온 목록은 그대로 두고 안내만 보여줌 */}
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </View>
          ) : null
        }
        ListEmptyComponent={
          error ? (
            <Notice title="불러오지 못했어요" desc={error}>
              <Button title="다시 시도" onPress={onRefresh} />
            </Notice>
          ) : noLink ? (
            <Notice title="연결된 복약자가 없어요" desc="복약자의 초대코드로 연결하면 이력을 볼 수 있어요" />
          ) : (
            <Notice title="아직 복약 기록이 없어요" desc="큐브에서 약을 꺼내면 여기에 기록돼요" />
          )
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.isToday ? (
              <View style={styles.todayPill}>
                <Text style={styles.todayPillText}>오늘</Text>
              </View>
            ) : null}
          </View>
        )}
        renderItem={({ item }) => <HistoryRow row={item} />}
      />
    </>
  );
}

function HistoryRow({ row }: { row: Row }) {
  const period = PERIODS[row.period];

  return (
    <View style={styles.row}>
      <View style={[styles.stripe, { backgroundColor: period?.color ?? colors.muted }]} />
      <View style={styles.rowBody}>
        <Text style={styles.period}>{period?.label ?? row.period}</Text>
        <Text style={styles.method}>{METHOD_LABELS[row.method] ?? row.method}</Text>
      </View>
      <Text style={styles.time}>{formatTime(row.confirmedAt)}</Text>
    </View>
  );
}

// 목록이 비었을 때, 불러오기에 실패했을 때 보여주는 안내
function Notice({ title, desc, children }: { title: string; desc: string; children?: React.ReactNode }) {
  return (
    <View style={styles.notice}>
      <Capsule size={96} leftColor={colors.primary} style={styles.tilt} />
      <Text style={styles.noticeTitle}>{title}</Text>
      <Text style={styles.noticeDesc}>{desc}</Text>
      {children ? <View style={styles.noticeAction}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { flexGrow: 1, padding: 24, paddingTop: 8, paddingBottom: 40 },

  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, color: colors.text },
  subtitle: { marginTop: 6, fontSize: 14, color: colors.muted },
  errorText: { marginTop: 8, fontSize: 13, lineHeight: 19, color: colors.danger },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 26, marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  todayPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
  },
  todayPillText: { fontSize: 11, fontWeight: '700', color: colors.white },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 8,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  stripe: { width: 5, height: 38, borderRadius: 3 },
  rowBody: { flex: 1, gap: 2 },
  period: { fontSize: 16, fontWeight: '700', color: colors.text },
  method: { fontSize: 13, color: colors.muted },
  time: { fontSize: 15, fontWeight: '600', color: colors.text },

  notice: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, gap: 10 },
  tilt: { transform: [{ rotate: '-30deg' }], marginBottom: 18 },
  noticeTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  noticeDesc: { fontSize: 14, lineHeight: 21, color: colors.muted, textAlign: 'center' },
  noticeAction: { alignSelf: 'stretch', marginTop: 10 },
});