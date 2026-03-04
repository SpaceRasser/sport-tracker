import React, { useCallback, useMemo, useEffect, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import Svg, { Polyline, Circle } from "react-native-svg";
import { useFocusEffect } from "@react-navigation/native";

import { api } from "../api/client";
import { getRecords } from "../api/recordsApi";
import { getProgress } from "../api/analyticsApi";

type Field =
  | { key: string; label: string; type: "number"; unit?: string; required?: boolean }
  | { key: string; label: string; type: "text" }
  | { key: string; label: string; type: "select" };

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
    bg: isDark ? "#0B0D12" : "#F4F6FA",
    card: isDark ? "#121625" : "#FFFFFF",
    text: isDark ? "#E9ECF5" : "#121722",
    subtext: isDark ? "#A9B1C7" : "#5C667A",
    border: isDark ? "rgba(255,255,255,0.10)" : "rgba(16,24,40,0.10)",
    primary: "#2D6BFF",
    inputBg: isDark ? "rgba(255,255,255,0.06)" : "#F2F4F7",
    softPrimary: isDark ? "rgba(45,107,255,0.16)" : "rgba(45,107,255,0.10)",
    softCard: isDark ? "rgba(255,255,255,0.04)" : "rgba(16,24,40,0.03)",
  };
}

function metricLabel(key: string) {
  const map: Record<string, string> = {
    distance_km: "Дистанция",
    distance_m: "Дистанция",
    duration_sec: "Длительность",
    avg_pace_min_km: "Темп",
    avg_speed_kmh: "Скорость",
    steps: "Шаги",
    calories: "Калории",
    weight_kg: "Вес",
    reps: "Повторы",
    sets: "Подходы",
    volume_kg: "Объём",
    elevation_m: "Набор высоты",
    rounds: "Раунды",
    work_sec: "Работа",
    rest_sec: "Отдых",
  };
  return map[key] ?? key;
}

function metricUnitGuess(key: string) {
  const map: Record<string, string> = {
    distance_km: "км",
    distance_m: "м",
    duration_sec: "сек",
    avg_pace_min_km: "мин/км",
    avg_speed_kmh: "км/ч",
    steps: "шаг",
    calories: "ккал",
    weight_kg: "кг",
    volume_kg: "кг",
    elevation_m: "м",
    reps: "шт",
    sets: "шт",
    rounds: "шт",
    work_sec: "сек",
    rest_sec: "сек",
  };
  return map[key] ?? "";
}

function formatDateShort(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function formatMetricValue(metricKey: string, value: number, unit?: string | null) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";

  if (metricKey === "distance_m") {
    if (n >= 1000) return `${(n / 1000).toFixed(2)} км`;
    return `${Math.round(n)} м`;
  }
  if (metricKey === "distance_km") return `${n.toFixed(n % 1 === 0 ? 0 : 2)} км`;
  if (metricKey === "avg_speed_kmh") return `${n.toFixed(1)} км/ч`;
  if (metricKey === "avg_pace_min_km") {
    const totalSec = Math.round(n * 60);
    const mm = Math.floor(totalSec / 60);
    const ss = totalSec % 60;
    return `${mm}:${String(ss).padStart(2, "0")} мин/км`;
  }
  if (metricKey === "calories") return `${Math.round(n)} ккал`;
  if (metricKey === "steps") return `${Math.round(n)} шагов`;
  if (metricKey === "weight_kg") return `${n.toFixed(1)} кг`;
  if (metricKey === "volume_kg") return `${Math.round(n)} кг`;
  if (metricKey === "elevation_m") return `${Math.round(n)} м`;

  const base = n % 1 === 0 ? String(Math.round(n)) : String(n);
  return unit ? `${base} ${unit}` : base;
}

function groupByActivity(items: RecordItem[]) {
  const map = new Map<string, { activity: RecordItem["activityType"]; records: RecordItem[] }>();
  for (const r of items) {
    const k = r.activityType.id;
    if (!map.has(k)) map.set(k, { activity: r.activityType, records: [] });
    map.get(k)!.records.push(r);
  }
  return Array.from(map.values()).sort((a, b) => a.activity.name.localeCompare(b.activity.name));
}

function Chip({
  label,
  active,
  onPress,
  palette,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  palette: ReturnType<typeof makePalette>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          borderColor: active ? palette.primary : palette.border,
          backgroundColor: active ? palette.softPrimary : palette.inputBg,
          opacity: pressed ? 0.86 : 1,
        },
      ]}
    >
      <Text style={[styles.chipText, { color: active ? palette.primary : palette.text }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function PickerModal({
  visible,
  title,
  items,
  selectedId,
  onSelect,
  onClose,
  palette,
}: {
  visible: boolean;
  title: string;
  items: { id: string; label: string; sub?: string }[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
  palette: ReturnType<typeof makePalette>;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.modalTitle, { color: palette.text }]}>{title}</Text>

          <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ paddingTop: 10, gap: 8 }}>
            {items.map((it) => {
              const active = it.id === selectedId;
              return (
                <Pressable
                  key={it.id}
                  onPress={() => onSelect(it.id)}
                  style={({ pressed }) => [
                    styles.modalRow,
                    {
                      borderColor: active ? "rgba(45,107,255,0.45)" : palette.border,
                      backgroundColor: active ? palette.softPrimary : palette.inputBg,
                      opacity: pressed ? 0.9 : 1,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modalRowTitle, { color: active ? palette.primary : palette.text }]} numberOfLines={1}>
                      {it.label}
                    </Text>
                    {it.sub ? (
                      <Text style={[styles.modalRowSub, { color: palette.subtext }]} numberOfLines={1}>
                        {it.sub}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={[styles.modalRowChevron, { color: palette.subtext }]}>{active ? "✓" : "›"}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={{ height: 12 }} />
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.modalBtn,
              { borderColor: palette.border, backgroundColor: palette.inputBg, opacity: pressed ? 0.86 : 1 },
            ]}
          >
            <Text style={[styles.modalBtnText, { color: palette.text }]}>Готово</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function LineChart({
  points,
  palette,
  unitLabel,
}: {
  points: { date: string; value: number }[];
  palette: ReturnType<typeof makePalette>;
  unitLabel?: string | null;
}) {
  const [w, setW] = useState(Math.min(Dimensions.get("window").width - 32 - 28, 420)); // screen padding 16 + card padding 14
  const H = 150;
  const P = 12;

  const onLayout = (ev: any) => {
    const width = ev?.nativeEvent?.layout?.width;
    if (width && width > 0) setW(width);
  };

  if (!points.length) {
    return (
      <View onLayout={onLayout} style={[styles.chartEmpty, { backgroundColor: palette.inputBg, borderColor: palette.border }]}>
        <Text style={{ color: palette.subtext, fontWeight: "800" }}>Нет данных для графика</Text>
        <Text style={{ color: palette.subtext, fontWeight: "700", marginTop: 6, textAlign: "center" }}>
          Добавь тренировки с этой метрикой — и тут появится линия прогресса.
        </Text>
      </View>
    );
  }

  const vals = points.map((p) => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;

  const toX = (i: number) => P + (i * (w - P * 2)) / Math.max(1, points.length - 1);
  const toY = (v: number) => P + (H - P * 2) * (1 - (v - min) / range);

  const poly = points.map((p, i) => `${toX(i)},${toY(p.value)}`).join(" ");
  const last = points[points.length - 1];

  return (
    <View onLayout={onLayout} style={[styles.chartWrap, { borderColor: palette.border, backgroundColor: palette.inputBg }]}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
        <Text style={[styles.chartCaption, { color: palette.subtext }]}>
          min: {Number.isFinite(min) ? min : "—"}{unitLabel ? ` ${unitLabel}` : ""}
        </Text>
        <Text style={[styles.chartCaption, { color: palette.subtext }]}>
          max: {Number.isFinite(max) ? max : "—"}{unitLabel ? ` ${unitLabel}` : ""}
        </Text>
      </View>

      <Svg width={w} height={H}>
        <Polyline
          points={poly}
          fill="none"
          stroke={palette.primary}
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <Circle cx={toX(points.length - 1)} cy={toY(last.value)} r={5} fill={palette.primary} />
      </Svg>
    </View>
  );
}

export default function AnalyticsScreen() {
  const scheme = useColorScheme();
  const palette = useMemo(() => makePalette(scheme === "dark"), [scheme]);

  // global refresh
  const [refreshing, setRefreshing] = useState(false);

  // Records state
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

  // picker modals
  const [actPickerOpen, setActPickerOpen] = useState(false);
  const [metricPickerOpen, setMetricPickerOpen] = useState(false);

  const selectedActivity = useMemo(
    () => activities.find((a) => a.id === activityId) ?? null,
    [activities, activityId]
  );

  const numericMetrics = useMemo(() => {
    const fields = (selectedActivity?.fieldsSchema?.fields ?? []) as Field[];
    return fields
      .filter((f) => f.type === "number")
      .map((f) => ({
        key: f.key,
        label: f.label,
        unit: (f as any).unit as string | undefined,
      }));
  }, [selectedActivity]);

  const resolveDefaultMetric = useCallback(
    (a: ActivityType | null) => {
      if (!a) return null;
      const fields = (a.fieldsSchema?.fields ?? []) as Field[];
      const firstNum = fields.find((f) => f.type === "number") as any;
      return firstNum?.key ? String(firstNum.key) : null;
    },
    []
  );

  const loadRecords = useCallback(async () => {
    setRecordsLoading(true);
    try {
      const res = await getRecords();
      setRecords(res.items ?? []);
    } catch (e: any) {
      Alert.alert("Ошибка", e?.message ?? "Не удалось загрузить PR");
    } finally {
      setRecordsLoading(false);
    }
  }, []);

  const loadActivities = useCallback(async () => {
    try {
      const res = await api.get("/activities");
      const list: ActivityType[] = res?.data?.items ?? [];
      setActivities(list);

      // если ещё не выбрано — выберем первую активность и дефолтную метрику
      if (!activityId && list.length) {
        const a0 = list[0];
        setActivityId(a0.id);
        const mk = resolveDefaultMetric(a0);
        setMetricKey(mk);
      } else {
        // если активность выбрана, но metricKey уже не существует — подберем новую
        const act = list.find((x) => x.id === activityId) ?? null;
        if (act) {
          const fields = (act.fieldsSchema?.fields ?? []) as Field[];
          const hasMetric = !!fields.find((f: any) => f.type === "number" && String(f.key) === String(metricKey));
          if (!hasMetric) setMetricKey(resolveDefaultMetric(act));
        }
      }
    } catch (e: any) {
      Alert.alert("Ошибка", e?.message ?? "Не удалось загрузить активности");
    }
  }, [activityId, metricKey, resolveDefaultMetric]);

  const loadProgress = useCallback(
    async (aId: string, mKey: string, d: 7 | 30 | 90) => {
      setProgLoading(true);
      try {
        const res = await getProgress({ activityTypeId: aId, metricKey: mKey, days: d });
        setProgPoints(res.points ?? []);
        setProgUnit(res.unit ?? null);
        setProgSummary(res.summary ?? { min: null, max: null, last: null });
      } catch (e: any) {
        Alert.alert("Ошибка", e?.message ?? "Не удалось загрузить прогресс");
        setProgPoints([]);
        setProgUnit(null);
        setProgSummary({ min: null, max: null, last: null });
      } finally {
        setProgLoading(false);
      }
    },
    []
  );

  const loadAll = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (mode === "refresh") setRefreshing(true);

      // 1) активности + PR параллельно
      await Promise.all([loadActivities(), loadRecords()]);

      // 2) прогресс если можно
      // (берём актуальные значения из стейта после loadActivities — не гарантируется сразу,
      // поэтому делаем "best effort": если уже есть aId/mKey — грузим)
      if (activityId && metricKey) {
        await loadProgress(activityId, metricKey, days);
      }

      if (mode === "refresh") setRefreshing(false);
    },
    [activityId, metricKey, days, loadActivities, loadRecords, loadProgress]
  );

  // авто-обновление при заходе на экран
  useFocusEffect(
    useCallback(() => {
      loadAll("initial");
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  // когда меняются activity/metric/days — перезагрузим прогресс
  useEffect(() => {
    if (!activityId || !metricKey) return;
    loadProgress(activityId, metricKey, days);
  }, [activityId, metricKey, days, loadProgress]);

  const activityPickerItems = useMemo(
    () => activities.map((a) => ({ id: a.id, label: a.name, sub: a.code })),
    [activities]
  );

  const metricPickerItems = useMemo(
    () =>
      numericMetrics.map((m) => ({
        id: m.key,
        label: m.label,
        sub: m.unit ? `Ед.: ${m.unit}` : metricUnitGuess(m.key) ? `Ед.: ${metricUnitGuess(m.key)}` : undefined,
      })),
    [numericMetrics]
  );

  const unitLabel = useMemo(() => {
    if (progUnit) return progUnit;
    if (metricKey) return metricUnitGuess(metricKey);
    return null;
  }, [progUnit, metricKey]);

  const progressHeadline = useMemo(() => {
    const aName = selectedActivity?.name ?? "Активность";
    const mName = metricKey ? metricLabel(metricKey) : "Метрика";
    return `${aName} • ${mName}`;
  }, [selectedActivity, metricKey]);

  const summaryCards = useMemo(() => {
    const mk = metricKey ?? "";
    return [
      { k: "MIN", v: progSummary.min, text: progSummary.min == null ? "—" : formatMetricValue(mk, progSummary.min, unitLabel) },
      { k: "MAX", v: progSummary.max, text: progSummary.max == null ? "—" : formatMetricValue(mk, progSummary.max, unitLabel) },
      { k: "LAST", v: progSummary.last, text: progSummary.last == null ? "—" : formatMetricValue(mk, progSummary.last, unitLabel) },
    ];
  }, [progSummary, metricKey, unitLabel]);

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 18, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadAll("refresh")} tintColor={palette.primary} />}
      >
        <View style={{ marginBottom: 12 }}>
          <Text style={[styles.pageTitle, { color: palette.text }]}>Аналитика</Text>
          <Text style={[styles.pageSubtitle, { color: palette.subtext }]}>Прогресс по метрике + личные рекорды</Text>
        </View>

        {/* PROGRESS */}
        <View style={[styles.section, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Прогресс</Text>
              <Text style={[styles.sectionSubtitle, { color: palette.subtext }]}>
                {progressHeadline}
              </Text>
            </View>

            {progLoading ? <ActivityIndicator color={palette.primary} /> : null}
          </View>

          {/* pickers */}
          <View style={{ marginTop: 12, gap: 10 }}>
            <Pressable
              onPress={() => setActPickerOpen(true)}
              style={({ pressed }) => [
                styles.pickerRow,
                { borderColor: palette.border, backgroundColor: palette.inputBg, opacity: pressed ? 0.88 : 1 },
              ]}
            >
              <Text style={[styles.pickerLabel, { color: palette.subtext }]}>Активность</Text>
              <View style={{ flex: 1, alignItems: "flex-end" }}>
                <Text style={[styles.pickerValue, { color: palette.text }]} numberOfLines={1}>
                  {selectedActivity?.name ?? "Выбрать…"}
                </Text>
              </View>
              <Text style={[styles.pickerChevron, { color: palette.subtext }]}>›</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                if (!selectedActivity) return;
                if (numericMetrics.length === 0) {
                  Alert.alert("Метрики", "У этой активности нет числовых метрик.");
                  return;
                }
                setMetricPickerOpen(true);
              }}
              style={({ pressed }) => [
                styles.pickerRow,
                {
                  borderColor: palette.border,
                  backgroundColor: palette.inputBg,
                  opacity: pressed ? 0.88 : 1,
                },
              ]}
            >
              <Text style={[styles.pickerLabel, { color: palette.subtext }]}>Метрика</Text>
              <View style={{ flex: 1, alignItems: "flex-end" }}>
                <Text style={[styles.pickerValue, { color: palette.text }]} numberOfLines={1}>
                  {metricKey ? metricLabel(metricKey) : "Выбрать…"}
                </Text>
              </View>
              <Text style={[styles.pickerChevron, { color: palette.subtext }]}>›</Text>
            </Pressable>

            {/* period */}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Chip label="7 дней" active={days === 7} onPress={() => setDays(7)} palette={palette} />
              <Chip label="30 дней" active={days === 30} onPress={() => setDays(30)} palette={palette} />
              <Chip label="90 дней" active={days === 90} onPress={() => setDays(90)} palette={palette} />
            </View>
          </View>

          <View style={{ marginTop: 12 }}>
            <LineChart points={progPoints} palette={palette} unitLabel={unitLabel} />

            <View style={styles.summaryRow}>
              {summaryCards.map((c) => (
                <View key={c.k} style={[styles.summaryCard, { backgroundColor: palette.inputBg, borderColor: palette.border }]}>
                  <Text style={[styles.summaryLabel, { color: palette.subtext }]}>{c.k}</Text>
                  <Text style={[styles.summaryVal, { color: palette.text }]} numberOfLines={1}>
                    {c.text}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* PR */}
        <View style={[styles.section, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Личные рекорды</Text>
          <Text style={[styles.sectionSubtitle, { color: palette.subtext }]}>
            Лучшие значения по метрикам (обновляются после сохранения тренировки)
          </Text>

          {recordsLoading ? (
            <View style={[styles.inlineInfo, { backgroundColor: palette.inputBg, borderColor: palette.border }]}>
              <ActivityIndicator color={palette.primary} />
              <Text style={[styles.inlineInfoText, { color: palette.subtext }]}>Загружаем рекорды…</Text>
            </View>
          ) : records.length === 0 ? (
            <View style={[styles.emptyInline, { backgroundColor: palette.inputBg, borderColor: palette.border }]}>
              <Text style={[styles.emptyInlineTitle, { color: palette.text }]}>Пока нет рекордов</Text>
              <Text style={[styles.emptyInlineSub, { color: palette.subtext }]}>
                Добавь тренировки с метриками — здесь появятся PR 🙂
              </Text>
            </View>
          ) : (
            <View style={{ marginTop: 14, gap: 12 }}>
              {grouped.map((g) => (
                <View key={g.activity.id} style={[styles.groupCard, { borderColor: palette.border, backgroundColor: palette.inputBg }]}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <Text style={[styles.groupTitle, { color: palette.text }]} numberOfLines={1}>
                      {g.activity.name}
                    </Text>

                    <View style={[styles.pill, { borderColor: palette.border, backgroundColor: palette.softPrimary }]}>
                      <Text style={[styles.pillText, { color: palette.primary }]} numberOfLines={1}>
                        {g.activity.code}
                      </Text>
                    </View>
                  </View>

                  <View style={{ marginTop: 10, gap: 8 }}>
                    {g.records.map((r) => (
                      <View key={r.id} style={[styles.recordRow, { borderColor: palette.border, backgroundColor: palette.card }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.recordKey, { color: palette.subtext }]} numberOfLines={1}>
                            {metricLabel(r.metricKey)}
                          </Text>
                          <Text style={[styles.recordMeta, { color: palette.subtext }]}>{formatDateShort(r.achievedAt)}</Text>
                        </View>
                        <Text style={[styles.recordVal, { color: palette.text }]} numberOfLines={1}>
                          {formatMetricValue(r.metricKey, r.bestValueNum, metricUnitGuess(r.metricKey))}
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

      {/* pickers */}
      <PickerModal
        visible={actPickerOpen}
        title="Выбери активность"
        items={activityPickerItems}
        selectedId={activityId}
        palette={palette}
        onSelect={(id) => {
          setActPickerOpen(false);
          setActivityId(id);

          const act = activities.find((a) => a.id === id) ?? null;
          const mk = resolveDefaultMetric(act);
          setMetricKey(mk);
        }}
        onClose={() => setActPickerOpen(false)}
      />

      <PickerModal
        visible={metricPickerOpen}
        title="Выбери метрику"
        items={metricPickerItems}
        selectedId={metricKey}
        palette={palette}
        onSelect={(id) => {
          setMetricPickerOpen(false);
          setMetricKey(id);
        }}
        onClose={() => setMetricPickerOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },

  pageTitle: { fontSize: 22, fontWeight: "900" },
  pageSubtitle: { marginTop: 6, fontSize: 13, fontWeight: "700" },

  section: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
    ...(Platform.OS === "ios"
      ? { shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } }
      : { elevation: 1 }),
  },
  sectionTitle: { fontSize: 15.5, fontWeight: "900" },
  sectionSubtitle: { marginTop: 4, fontSize: 12.5, fontWeight: "700", lineHeight: 18 },

  chip: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, flexGrow: 1 },
  chipText: { fontSize: 13, fontWeight: "800", textAlign: "center" },

  pickerRow: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  pickerLabel: { fontSize: 12.5, fontWeight: "900" },
  pickerValue: { fontSize: 13.5, fontWeight: "900" },
  pickerChevron: { fontSize: 24, fontWeight: "900" },

  chartWrap: { borderWidth: 1, borderRadius: 16, padding: 10 },
  chartEmpty: { borderWidth: 1, borderRadius: 16, padding: 14, alignItems: "center", justifyContent: "center" },
  chartCaption: { fontSize: 11.5, fontWeight: "900" },

  summaryRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  summaryCard: { flex: 1, borderWidth: 1, borderRadius: 16, padding: 10 },
  summaryLabel: { fontSize: 11.5, fontWeight: "900" },
  summaryVal: { marginTop: 4, fontSize: 13.5, fontWeight: "900" },

  groupCard: { borderRadius: 16, borderWidth: 1, padding: 12 },
  groupTitle: { fontSize: 14.5, fontWeight: "900" },

  pill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, maxWidth: 120 },
  pillText: { fontSize: 12, fontWeight: "900" },

  recordRow: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  recordKey: { fontSize: 12.5, fontWeight: "900" },
  recordMeta: { marginTop: 2, fontSize: 11.5, fontWeight: "800", opacity: 0.9 },
  recordVal: { fontSize: 14.5, fontWeight: "900" },

  inlineInfo: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  inlineInfoText: { fontSize: 12.5, fontWeight: "800" },

  emptyInline: { marginTop: 12, borderRadius: 16, borderWidth: 1, padding: 12 },
  emptyInlineTitle: { fontSize: 13.5, fontWeight: "900" },
  emptyInlineSub: { marginTop: 4, fontSize: 12.5, fontWeight: "700", lineHeight: 18 },

  // modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", padding: 16 },
  modalCard: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    ...(Platform.OS === "ios"
      ? { shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 12 } }
      : { elevation: 4 }),
  },
  modalTitle: { fontSize: 15.5, fontWeight: "900" },
  modalRow: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  modalRowTitle: { fontSize: 13.5, fontWeight: "900" },
  modalRowSub: { marginTop: 2, fontSize: 12, fontWeight: "800", opacity: 0.9 },
  modalRowChevron: { fontSize: 18, fontWeight: "900" },
  modalBtn: { borderRadius: 16, borderWidth: 1, paddingVertical: 12, alignItems: "center" },
  modalBtnText: { fontSize: 14, fontWeight: "900" },
});