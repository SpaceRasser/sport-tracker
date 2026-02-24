import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import Svg, { Polyline, Circle } from 'react-native-svg';

import { api } from '../api/client';
import { getRecords } from '../api/recordsApi';
import { getProgress } from '../api/analyticsApi';

type Field =
  | { key: string; label: string; type: 'number'; unit?: string; required?: boolean }
  | { key: string; label: string; type: 'text' }
  | { key: string; label: string; type: 'select' };

type ActivityType = {
  id: string;
  code: string;
  name: string;
  fieldsSchema?: { fields?: Field[] } | null;
};

type RecordItem = {
  id: string;
  metricKey: string;
  bestValueNum: number;
  achievedAt: string;
  activityType: { id: string; code: string; name: string };
};

function makePalette(isDark: boolean) {
  return {
    bg: isDark ? '#0B0D12' : '#F4F6FA',
    card: isDark ? '#121625' : '#FFFFFF',
    text: isDark ? '#E9ECF5' : '#121722',
    subtext: isDark ? '#A9B1C7' : '#5C667A',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(16,24,40,0.08)',
    primary: '#2D6BFF',
    inputBg: isDark ? 'rgba(255,255,255,0.06)' : '#F2F4F7',
    softPrimary: isDark ? 'rgba(45,107,255,0.16)' : 'rgba(45,107,255,0.10)',
  };
}

function metricLabel(key: string) {
  const map: Record<string, string> = {
    distance_km: 'Дистанция',
    distance_m: 'Дистанция',
    duration_sec: 'Длительность',
    avg_pace_min_km: 'Темп',
    avg_speed_kmh: 'Скорость',
    steps: 'Шаги',
    calories: 'Калории',
    weight_kg: 'Вес',
    reps: 'Повторы',
    sets: 'Подходы',
    volume_kg: 'Объём',
    elevation_m: 'Набор высоты',
    rounds: 'Раунды',
    work_sec: 'Работа',
    rest_sec: 'Отдых',
  };
  return map[key] ?? key;
}

function metricUnitGuess(key: string) {
  const map: Record<string, string> = {
    distance_km: 'км',
    distance_m: 'м',
    duration_sec: 'сек',
    avg_pace_min_km: 'мин/км',
    avg_speed_kmh: 'км/ч',
    steps: 'шаг',
    calories: 'ккал',
    weight_kg: 'кг',
    volume_kg: 'кг',
    elevation_m: 'м',
    reps: 'шт',
    sets: 'шт',
    rounds: 'шт',
    work_sec: 'сек',
    rest_sec: 'сек',
  };
  return map[key] ?? '';
}

function formatDateShort(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString();
}

function groupByActivity(items: RecordItem[]) {
  const map = new Map<string, { activity: RecordItem['activityType']; records: RecordItem[] }>();
  for (const r of items) {
    const k = r.activityType.id;
    if (!map.has(k)) map.set(k, { activity: r.activityType, records: [] });
    map.get(k)!.records.push(r);
  }
  return Array.from(map.values()).sort((a, b) => a.activity.name.localeCompare(b.activity.name));
}

function Chip({ label, active, onPress, palette }: any) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          borderColor: active ? palette.primary : palette.border,
          backgroundColor: active ? palette.softPrimary : palette.inputBg,
        },
      ]}
    >
      <Text style={[styles.chipText, { color: active ? palette.primary : palette.text }]}>{label}</Text>
    </Pressable>
  );
}

function LineChart({
  points,
  palette,
}: {
  points: { date: string; value: number }[];
  palette: ReturnType<typeof makePalette>;
}) {
  const W = 320;
  const H = 140;
  const P = 12;

  if (!points.length) {
    return (
      <View style={[styles.chartEmpty, { backgroundColor: palette.inputBg, borderColor: palette.border }]}>
        <Text style={{ color: palette.subtext, fontWeight: '800' }}>Нет данных для графика</Text>
      </View>
    );
  }

  const vals = points.map((p) => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;

  const toX = (i: number) => P + (i * (W - P * 2)) / Math.max(1, points.length - 1);
  const toY = (v: number) => P + (H - P * 2) * (1 - (v - min) / range);

  const poly = points.map((p, i) => `${toX(i)},${toY(p.value)}`).join(' ');
  const last = points[points.length - 1];

  return (
    <View style={[styles.chartWrap, { borderColor: palette.border, backgroundColor: palette.inputBg }]}>
      <Svg width={W} height={H}>
        <Polyline points={poly} fill="none" stroke={palette.primary} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
        {/* last point */}
        <Circle cx={toX(points.length - 1)} cy={toY(last.value)} r={5} fill={palette.primary} />
      </Svg>
    </View>
  );
}

export default function AnalyticsScreen() {
  const scheme = useColorScheme();
  const palette = useMemo(() => makePalette(scheme === 'dark'), [scheme]);

  const [recordsLoading, setRecordsLoading] = useState(true);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const grouped = useMemo(() => groupByActivity(records), [records]);

  // Progress state
  const [activities, setActivities] = useState<ActivityType[]>([]);
  const [activityId, setActivityId] = useState<string | null>(null);
  const [metricKey, setMetricKey] = useState<string | null>(null);
  const [days, setDays] = useState<7 | 30 | 90>(30);

  const [progLoading, setProgLoading] = useState(false);
  const [progPoints, setProgPoints] = useState<{ date: string; value: number }[]>([]);
  const [progUnit, setProgUnit] = useState<string | null>(null);
  const [progSummary, setProgSummary] = useState<{ min: number | null; max: number | null; last: number | null }>({
    min: null,
    max: null,
    last: null,
  });

  const selectedActivity = useMemo(
    () => activities.find((a) => a.id === activityId) ?? null,
    [activities, activityId],
  );

  const numericMetrics = useMemo(() => {
    const fields = (selectedActivity?.fieldsSchema?.fields ?? []) as Field[];
    return fields.filter((f) => f.type === 'number').map((f) => ({ key: f.key, label: f.label, unit: (f as any).unit }));
  }, [selectedActivity]);

  const loadRecords = async () => {
    setRecordsLoading(true);
    try {
      const res = await getRecords();
      setRecords(res.items ?? []);
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось загрузить PR');
    } finally {
      setRecordsLoading(false);
    }
  };

  const loadActivities = async () => {
    const res = await api.get('/activities');
    const list: ActivityType[] = res?.data?.items ?? [];
    setActivities(list);

    if (!activityId && list.length) {
      setActivityId(list[0].id);
    }
  };

  const loadProgress = async (aId: string, mKey: string, d: 7 | 30 | 90) => {
    setProgLoading(true);
    try {
      const res = await getProgress({ activityTypeId: aId, metricKey: mKey, days: d });
      setProgPoints(res.points ?? []);
      setProgUnit(res.unit ?? null);
      setProgSummary(res.summary ?? { min: null, max: null, last: null });
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось загрузить прогресс');
    } finally {
      setProgLoading(false);
    }
  };

  useEffect(() => {
    loadActivities().catch(() => {});
    loadRecords().catch(() => {});
  }, []);

  // когда выбрали активность — подберём дефолтную метрику
  useEffect(() => {
    if (!selectedActivity) return;
    if (numericMetrics.length && !metricKey) setMetricKey(numericMetrics[0].key);
  }, [selectedActivity, numericMetrics, metricKey]);

  // грузим график при изменениях
  useEffect(() => {
    if (!activityId || !metricKey) return;
    loadProgress(activityId, metricKey, days).catch(() => {});
  }, [activityId, metricKey, days]);

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 18, paddingBottom: 24 }}>
        <View style={{ marginBottom: 12 }}>
          <Text style={[styles.pageTitle, { color: palette.text }]}>Аналитика</Text>
          <Text style={[styles.pageSubtitle, { color: palette.subtext }]}>PR + прогресс по метрике</Text>
        </View>

        {/* PROGRESS */}
        <View style={[styles.section, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Прогресс</Text>
              <Text style={[styles.sectionSubtitle, { color: palette.subtext }]}>
                Выбери метрику — и увидишь динамику по дням
              </Text>
            </View>
            <Pressable onPress={() => activityId && metricKey && loadProgress(activityId, metricKey, days)} style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]}>
              <Text style={[styles.link, { color: palette.primary }]}>{progLoading ? '...' : 'Обновить'}</Text>
            </Pressable>
          </View>

          <Text style={[styles.smallLabel, { color: palette.subtext, marginTop: 12 }]}>Активность</Text>
          <View style={styles.rowWrap}>
            {activities.map((a) => (
              <Chip
                key={a.id}
                label={a.name}
                active={activityId === a.id}
                onPress={() => setActivityId(a.id)}
                palette={palette}
              />
            ))}
          </View>

          <Text style={[styles.smallLabel, { color: palette.subtext, marginTop: 12 }]}>Метрика</Text>
          <View style={styles.rowWrap}>
            {numericMetrics.map((m) => (
              <Chip
                key={m.key}
                label={m.label}
                active={metricKey === m.key}
                onPress={() => setMetricKey(m.key)}
                palette={palette}
              />
            ))}
          </View>

          <Text style={[styles.smallLabel, { color: palette.subtext, marginTop: 12 }]}>Период</Text>
          <View style={styles.rowWrap}>
            <Chip label="7 дней" active={days === 7} onPress={() => setDays(7)} palette={palette} />
            <Chip label="30 дней" active={days === 30} onPress={() => setDays(30)} palette={palette} />
            <Chip label="90 дней" active={days === 90} onPress={() => setDays(90)} palette={palette} />
          </View>

          <View style={{ marginTop: 12 }}>
            <LineChart points={progPoints} palette={palette} />

            <View style={styles.summaryRow}>
              <View style={[styles.summaryCard, { backgroundColor: palette.inputBg, borderColor: palette.border }]}>
                <Text style={[styles.summaryLabel, { color: palette.subtext }]}>MIN</Text>
                <Text style={[styles.summaryVal, { color: palette.text }]}>
                  {progSummary.min ?? '—'} {progUnit ?? metricUnitGuess(metricKey ?? '')}
                </Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: palette.inputBg, borderColor: palette.border }]}>
                <Text style={[styles.summaryLabel, { color: palette.subtext }]}>MAX</Text>
                <Text style={[styles.summaryVal, { color: palette.text }]}>
                  {progSummary.max ?? '—'} {progUnit ?? metricUnitGuess(metricKey ?? '')}
                </Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: palette.inputBg, borderColor: palette.border }]}>
                <Text style={[styles.summaryLabel, { color: palette.subtext }]}>LAST</Text>
                <Text style={[styles.summaryVal, { color: palette.text }]}>
                  {progSummary.last ?? '—'} {progUnit ?? metricUnitGuess(metricKey ?? '')}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* PR */}
        <View style={[styles.section, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Личные рекорды</Text>
              <Text style={[styles.sectionSubtitle, { color: palette.subtext }]}>Обновляются после сохранения тренировки</Text>
            </View>
            <Pressable onPress={loadRecords} style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]}>
              <Text style={[styles.link, { color: palette.primary }]}>{recordsLoading ? '...' : 'Обновить'}</Text>
            </Pressable>
          </View>

          {recordsLoading ? (
            <Text style={{ marginTop: 12, color: palette.subtext, fontWeight: '800' }}>Загрузка…</Text>
          ) : records.length === 0 ? (
            <Text style={{ marginTop: 12, color: palette.subtext, fontWeight: '800' }}>
              Пока нет рекордов. Добавь тренировки с метриками 🙂
            </Text>
          ) : (
            <View style={{ marginTop: 14, gap: 12 }}>
              {grouped.map((g) => (
                <View key={g.activity.id} style={[styles.groupCard, { borderColor: palette.border, backgroundColor: palette.inputBg }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <Text style={[styles.groupTitle, { color: palette.text }]}>{g.activity.name}</Text>
                    <View style={[styles.pill, { borderColor: palette.border, backgroundColor: palette.softPrimary }]}>
                      <Text style={[styles.pillText, { color: palette.primary }]}>{g.activity.code}</Text>
                    </View>
                  </View>

                  <View style={{ marginTop: 10, gap: 8 }}>
                    {g.records.map((r) => (
                      <View key={r.id} style={[styles.recordRow, { borderColor: palette.border, backgroundColor: palette.card }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.recordKey, { color: palette.subtext }]}>{metricLabel(r.metricKey)}</Text>
                          <Text style={[styles.recordMeta, { color: palette.subtext }]}>{formatDateShort(r.achievedAt)}</Text>
                        </View>
                        <Text style={[styles.recordVal, { color: palette.text }]}>
                          {r.bestValueNum} {metricUnitGuess(r.metricKey)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },

  pageTitle: { fontSize: 22, fontWeight: '900' },
  pageSubtitle: { marginTop: 6, fontSize: 13, fontWeight: '700' },

  section: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
    ...(Platform.OS === 'ios'
      ? { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } }
      : { elevation: 1 }),
  },
  sectionTitle: { fontSize: 15.5, fontWeight: '900' },
  sectionSubtitle: { marginTop: 4, fontSize: 12.5, fontWeight: '700' },
  link: { fontSize: 13.5, fontWeight: '900' },

  smallLabel: { fontSize: 12.5, fontWeight: '900', marginBottom: 8 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  chip: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  chipText: { fontSize: 13, fontWeight: '800' },

  chartWrap: { borderWidth: 1, borderRadius: 16, padding: 10, alignItems: 'center', justifyContent: 'center' },
  chartEmpty: { borderWidth: 1, borderRadius: 16, padding: 14, alignItems: 'center', justifyContent: 'center' },

  summaryRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  summaryCard: { flex: 1, borderWidth: 1, borderRadius: 16, padding: 10 },
  summaryLabel: { fontSize: 11.5, fontWeight: '900' },
  summaryVal: { marginTop: 4, fontSize: 13.5, fontWeight: '900' },

  groupCard: { borderRadius: 16, borderWidth: 1, padding: 12 },
  groupTitle: { fontSize: 14.5, fontWeight: '900' },

  pill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  pillText: { fontSize: 12, fontWeight: '900' },

  recordRow: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  recordKey: { fontSize: 12.5, fontWeight: '900' },
  recordMeta: { marginTop: 2, fontSize: 11.5, fontWeight: '800', opacity: 0.9 },
  recordVal: { fontSize: 14.5, fontWeight: '900' },
});