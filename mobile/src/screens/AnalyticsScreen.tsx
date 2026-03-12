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
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Polyline, Circle } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
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

const palette = {
  bg: "#F5F2FF",
  bg2: "#EEE9FF",
  card: "#FFFFFF",
  cardSoft: "#F4F0FF",

  purple: "#6D4CFF",
  purpleDark: "#5137D7",

  text: "#2D244D",
  subtext: "#7D739D",
  muted: "#9D95BA",
  line: "#E6E0FA",

  cyan: "#7CE7FF",
  pink: "#FF8DD8",
  orange: "#FFB36B",
  green: "#24A865",
  greenSoft: "rgba(36,168,101,0.10)",
  purpleSoftBg: "rgba(109,76,255,0.10)",
};

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

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.88 : 1 }]}>
      <View
        style={[
          styles.filterChip,
          active ? styles.filterChipActive : styles.filterChipInactive,
        ]}
      >
        <Text
          style={[
            styles.filterChipText,
            { color: active ? "#FFFFFF" : palette.purple },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

function InfoBadge({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <View style={styles.infoBadge}>
      {icon}
      <Text style={styles.infoBadgeText}>{label}</Text>
    </View>
  );
}

function SummaryStat({
  value,
  label,
  tint,
  icon,
}: {
  value: string;
  label: string;
  tint: string;
  icon: React.ReactNode;
}) {
  return (
    <View style={styles.summaryStat}>
      <View style={[styles.summaryStatIcon, { backgroundColor: tint }]}>{icon}</View>
      <Text style={styles.summaryStatValue}>{value}</Text>
      <Text style={styles.summaryStatLabel}>{label}</Text>
    </View>
  );
}

function PickerModal({
  visible,
  title,
  items,
  selectedId,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  items: { id: string; label: string; sub?: string }[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{title}</Text>

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
                      borderColor: active ? "rgba(109,76,255,0.28)" : palette.line,
                      backgroundColor: active ? palette.cardSoft : "#FBFAFF",
                      opacity: pressed ? 0.9 : 1,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modalRowTitle, { color: active ? palette.purple : palette.text }]} numberOfLines={1}>
                      {it.label}
                    </Text>
                    {it.sub ? (
                      <Text style={styles.modalRowSub} numberOfLines={1}>
                        {it.sub}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={[styles.modalRowChevron, { color: active ? palette.purple : palette.subtext }]}>
                    {active ? "✓" : "›"}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={{ height: 12 }} />
          <Pressable onPress={onClose} style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}>
            <View style={styles.modalBtn}>
              <Text style={styles.modalBtnText}>Готово</Text>
            </View>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function LineChart({
  points,
  unitLabel,
}: {
  points: { date: string; value: number }[];
  unitLabel?: string | null;
}) {
  const [w, setW] = useState(Math.min(Dimensions.get("window").width - 32 - 28, 420));
  const H = 150;
  const P = 12;

  const onLayout = (ev: any) => {
    const width = ev?.nativeEvent?.layout?.width;
    if (width && width > 0) setW(width);
  };

  if (!points.length) {
    return (
      <View onLayout={onLayout} style={styles.chartEmpty}>
        <Text style={styles.chartEmptyTitle}>Нет данных для графика</Text>
        <Text style={styles.chartEmptySub}>
          Добавьте тренировки с этой метрикой — и здесь появится линия прогресса.
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
    <View onLayout={onLayout} style={styles.chartWrap}>
      <View style={styles.chartHeader}>
        <Text style={styles.chartCaption}>
          min: {Number.isFinite(min) ? min : "—"}
          {unitLabel ? ` ${unitLabel}` : ""}
        </Text>
        <Text style={styles.chartCaption}>
          max: {Number.isFinite(max) ? max : "—"}
          {unitLabel ? ` ${unitLabel}` : ""}
        </Text>
      </View>

      <Svg width={w} height={H}>
        <Polyline
          points={poly}
          fill="none"
          stroke={palette.purple}
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <Circle cx={toX(points.length - 1)} cy={toY(last.value)} r={5} fill={palette.purple} />
      </Svg>
    </View>
  );
}

function RecordStatusPill({ code }: { code: string }) {
  return (
    <View style={styles.recordCodePill}>
      <Text style={styles.recordCodePillText} numberOfLines={1}>
        {code}
      </Text>
    </View>
  );
}

export default function AnalyticsScreen() {
  const [refreshing, setRefreshing] = useState(false);

  const [recordsLoading, setRecordsLoading] = useState(true);
  const [records, setRecords] = useState<RecordItem[]>([]);

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

  const [actPickerOpen, setActPickerOpen] = useState(false);
  const [metricPickerOpen, setMetricPickerOpen] = useState(false);

  const grouped = useMemo(() => groupByActivity(records), [records]);

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

  const resolveDefaultMetric = useCallback((a: ActivityType | null) => {
    if (!a) return null;
    const fields = (a.fieldsSchema?.fields ?? []) as Field[];
    const firstNum = fields.find((f) => f.type === "number") as any;
    return firstNum?.key ? String(firstNum.key) : null;
  }, []);

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

      if (!activityId && list.length) {
        const first = list[0];
        setActivityId(first.id);
        setMetricKey(resolveDefaultMetric(first));
      } else {
        const act = list.find((x) => x.id === activityId) ?? null;
        if (act) {
          const fields = (act.fieldsSchema?.fields ?? []) as Field[];
          const hasMetric = !!fields.find(
            (f: any) => f.type === "number" && String(f.key) === String(metricKey)
          );
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

      await Promise.all([loadActivities(), loadRecords()]);

      if (activityId && metricKey) {
        await loadProgress(activityId, metricKey, days);
      }

      if (mode === "refresh") setRefreshing(false);
    },
    [activityId, metricKey, days, loadActivities, loadRecords, loadProgress]
  );

  useFocusEffect(
    useCallback(() => {
      loadAll("initial");
    }, [loadAll])
  );

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
      {
        k: "MIN",
        text: progSummary.min == null ? "—" : formatMetricValue(mk, progSummary.min, unitLabel),
        tint: "rgba(124,231,255,0.28)",
        icon: <Ionicons name="arrow-down" size={16} color={palette.purple} />,
      },
      {
        k: "MAX",
        text: progSummary.max == null ? "—" : formatMetricValue(mk, progSummary.max, unitLabel),
        tint: "rgba(255,179,107,0.28)",
        icon: <Ionicons name="arrow-up" size={16} color={palette.purple} />,
      },
      {
        k: "LAST",
        text: progSummary.last == null ? "—" : formatMetricValue(mk, progSummary.last, unitLabel),
        tint: "rgba(255,141,216,0.28)",
        icon: <Ionicons name="time-outline" size={16} color={palette.purple} />,
      },
    ];
  }, [progSummary, metricKey, unitLabel]);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={palette.bg} />

      <LinearGradient
        colors={[palette.bg, palette.bg2]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.blobTopRight} pointerEvents="none" />
      <View style={styles.blobLeft} pointerEvents="none" />
      <View style={styles.blobBottom} pointerEvents="none" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadAll("refresh")}
            tintColor={palette.purple}
          />
        }
      >
        <LinearGradient
          colors={[palette.purple, palette.purpleDark, "#7B61FF"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroBlobTop} />
          <View style={styles.heroBlobBottom} />

          <Text style={styles.heroKicker}>SPORTTRACKER</Text>
          <Text style={styles.heroTitle}>Аналитика</Text>
          <Text style={styles.heroSubtitle}>
            Следите за прогрессом по метрикам и личными рекордами в удобном формате.
          </Text>

          <View style={styles.heroStatsMiniRow}>
            <View style={styles.heroMiniPill}>
              <Ionicons name="trending-up" size={14} color={palette.purple} />
              <Text style={styles.heroMiniPillText}>{metricKey ? metricLabel(metricKey) : "Метрика"}</Text>
            </View>

            <View style={styles.heroMiniPill}>
              <Ionicons name="calendar-outline" size={14} color={palette.purple} />
              <Text style={styles.heroMiniPillText}>{days} дней</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.statsRow}>
          <SummaryStat
            value={String(grouped.length)}
            label="активностей"
            tint="rgba(124,231,255,0.28)"
            icon={<Ionicons name="barbell" size={18} color={palette.purple} />}
          />
          <SummaryStat
            value={String(records.length)}
            label="рекордов"
            tint="rgba(255,179,107,0.28)"
            icon={<Ionicons name="trophy-outline" size={18} color={palette.purple} />}
          />
          <SummaryStat
            value={String(progPoints.length)}
            label="точек"
            tint="rgba(255,141,216,0.28)"
            icon={<Ionicons name="analytics" size={18} color={palette.purple} />}
          />
        </View>

        <View style={styles.mainCard}>
          <Text style={styles.sectionKicker}>ПРОГРЕСС</Text>
          <Text style={styles.sectionTitle}>Динамика по метрике</Text>
          <Text style={styles.sectionDescription}>{progressHeadline}</Text>

          <View style={styles.badgesRow}>
            <InfoBadge
              icon={<Ionicons name="flash" size={14} color={palette.purple} />}
              label="Динамика"
            />
            <InfoBadge
              icon={<Ionicons name="stats-chart" size={14} color={palette.purple} />}
              label="График"
            />
            <InfoBadge
              icon={<Ionicons name="sparkles" size={14} color={palette.purple} />}
              label="Итоги"
            />
          </View>

          <View style={styles.controlsBlock}>
            <Pressable
              onPress={() => setActPickerOpen(true)}
              style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
            >
              <View style={styles.pickerRow}>
                <View style={styles.pickerIcon}>
                  <Ionicons name="fitness" size={18} color={palette.purple} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.pickerLabel}>Активность</Text>
                  <Text style={styles.pickerValue} numberOfLines={1}>
                    {selectedActivity?.name ?? "Выбрать…"}
                  </Text>
                </View>

                <Text style={styles.pickerChevron}>›</Text>
              </View>
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
              style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
            >
              <View style={styles.pickerRow}>
                <View style={styles.pickerIcon}>
                  <Ionicons name="options" size={18} color={palette.purple} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.pickerLabel}>Метрика</Text>
                  <Text style={styles.pickerValue} numberOfLines={1}>
                    {metricKey ? metricLabel(metricKey) : "Выбрать…"}
                  </Text>
                </View>

                <Text style={styles.pickerChevron}>›</Text>
              </View>
            </Pressable>

            <View style={styles.filtersRow}>
              <FilterChip label="7 дней" active={days === 7} onPress={() => setDays(7)} />
              <FilterChip label="30 дней" active={days === 30} onPress={() => setDays(30)} />
              <FilterChip label="90 дней" active={days === 90} onPress={() => setDays(90)} />
            </View>
          </View>

          <View style={styles.chartSection}>
            {progLoading ? (
              <View style={styles.inlineInfo}>
                <ActivityIndicator color={palette.purple} />
                <Text style={styles.inlineInfoText}>Загружаем прогресс…</Text>
              </View>
            ) : (
              <LineChart points={progPoints} unitLabel={unitLabel} />
            )}

            <View style={styles.summaryRow}>
              {summaryCards.map((c) => (
                <View key={c.k} style={styles.summaryCard}>
                  <View style={[styles.summaryStatIcon, { backgroundColor: c.tint }]}>
                    {c.icon}
                  </View>
                  <Text style={styles.summaryLabel}>{c.k}</Text>
                  <Text style={styles.summaryVal} numberOfLines={1}>
                    {c.text}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.mainCard}>
          <Text style={styles.sectionKicker}>PR</Text>
          <Text style={styles.sectionTitle}>Личные рекорды</Text>
          <Text style={styles.sectionDescription}>
            Лучшие значения по метрикам обновляются после сохранения тренировки.
          </Text>

          {recordsLoading ? (
            <View style={styles.inlineInfo}>
              <ActivityIndicator color={palette.purple} />
              <Text style={styles.inlineInfoText}>Загружаем рекорды…</Text>
            </View>
          ) : records.length === 0 ? (
            <View style={styles.emptyInline}>
              <View style={styles.emptyInlineIcon}>
                <Ionicons name="trophy-outline" size={20} color={palette.purple} />
              </View>
              <Text style={styles.emptyInlineTitle}>Пока нет рекордов</Text>
              <Text style={styles.emptyInlineSub}>
                Добавьте тренировки с метриками — здесь появятся Ваши PR.
              </Text>
            </View>
          ) : (
            <View style={styles.recordsGroups}>
              {grouped.map((g) => (
                <View key={g.activity.id} style={styles.groupCard}>
                  <View style={styles.groupHeader}>
                    <Text style={styles.groupTitle} numberOfLines={1}>
                      {g.activity.name}
                    </Text>
                    <RecordStatusPill code={g.activity.code} />
                  </View>

                  <View style={styles.groupRecords}>
                    {g.records.map((r) => (
                      <View key={r.id} style={styles.recordRow}>
                        <View style={styles.recordIcon}>
                          <MaterialCommunityIcons
                            name="medal-outline"
                            size={18}
                            color={palette.purple}
                          />
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={styles.recordKey} numberOfLines={1}>
                            {metricLabel(r.metricKey)}
                          </Text>
                          <Text style={styles.recordMeta}>{formatDateShort(r.achievedAt)}</Text>
                        </View>

                        <Text style={styles.recordVal} numberOfLines={1}>
                          {formatMetricValue(
                            r.metricKey,
                            r.bestValueNum,
                            metricUnitGuess(r.metricKey)
                          )}
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

      <PickerModal
        visible={actPickerOpen}
        title="Выберите активность"
        items={activityPickerItems}
        selectedId={activityId}
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
        title="Выберите метрику"
        items={metricPickerItems}
        selectedId={metricKey}
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
  screen: {
    flex: 1,
    backgroundColor: palette.bg,
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
  },

  blobTopRight: {
    position: "absolute",
    top: -20,
    right: -10,
    width: 140,
    height: 100,
    backgroundColor: "rgba(109,76,255,0.14)",
    borderBottomLeftRadius: 56,
    borderBottomRightRadius: 22,
    borderTopLeftRadius: 80,
    borderTopRightRadius: 12,
  },

  blobLeft: {
    position: "absolute",
    left: -28,
    top: 240,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(184,168,255,0.16)",
  },

  blobBottom: {
    position: "absolute",
    right: -20,
    bottom: 150,
    width: 120,
    height: 76,
    backgroundColor: "rgba(124,231,255,0.16)",
    borderTopLeftRadius: 40,
    borderTopRightRadius: 26,
    borderBottomLeftRadius: 60,
    borderBottomRightRadius: 60,
  },

  heroCard: {
    minHeight: 220,
    borderRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
    overflow: "hidden",
    marginBottom: 16,
    shadowColor: "#6D4CFF",
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },

  heroBlobTop: {
    position: "absolute",
    top: -20,
    right: -12,
    width: 120,
    height: 84,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderBottomLeftRadius: 56,
    borderBottomRightRadius: 26,
    borderTopLeftRadius: 70,
    borderTopRightRadius: 16,
  },

  heroBlobBottom: {
    position: "absolute",
    bottom: -12,
    left: -10,
    width: 128,
    height: 64,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 36,
    borderBottomLeftRadius: 80,
    borderBottomRightRadius: 38,
  },

  heroKicker: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.6,
    marginBottom: 12,
  },

  heroTitle: {
    color: "#FFFFFF",
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "900",
    marginBottom: 10,
    maxWidth: "86%",
  },

  heroSubtitle: {
    color: "rgba(255,255,255,0.84)",
    fontSize: 14.5,
    lineHeight: 21,
    fontWeight: "600",
    maxWidth: "92%",
    marginBottom: 18,
  },

  heroStatsMiniRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },

  heroMiniPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  heroMiniPillText: {
    color: palette.purple,
    fontSize: 12.5,
    fontWeight: "800",
    marginLeft: 6,
  },

  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 16,
  },

  summaryStat: {
    flex: 1,
    backgroundColor: palette.card,
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: palette.line,
  },

  summaryStatIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },

  summaryStatValue: {
    color: palette.text,
    fontSize: 18,
    fontWeight: "900",
  },

  summaryStatLabel: {
    color: palette.subtext,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },

  mainCard: {
    backgroundColor: palette.card,
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 20,
    borderWidth: 1,
    borderColor: palette.line,
    marginBottom: 16,
  },

  sectionKicker: {
    color: palette.purple,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.6,
    marginBottom: 8,
  },

  sectionTitle: {
    color: palette.text,
    fontSize: 29,
    lineHeight: 32,
    fontWeight: "900",
    marginBottom: 8,
  },

  sectionDescription: {
    color: palette.subtext,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
    marginBottom: 16,
  },

  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },

  infoBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.cardSoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  infoBadgeText: {
    color: palette.purple,
    fontSize: 12.5,
    fontWeight: "800",
    marginLeft: 6,
  },

  controlsBlock: {
    gap: 10,
  },

  pickerRow: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.cardSoft,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  pickerIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  pickerLabel: {
    color: palette.subtext,
    fontSize: 12.5,
    fontWeight: "800",
  },

  pickerValue: {
    color: palette.text,
    fontSize: 14,
    fontWeight: "900",
    marginTop: 2,
  },

  pickerChevron: {
    color: palette.subtext,
    fontSize: 24,
    fontWeight: "900",
  },

  filtersRow: {
    flexDirection: "row",
    gap: 8,
  },

  filterChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexGrow: 1,
  },

  filterChipActive: {
    backgroundColor: palette.purple,
  },

  filterChipInactive: {
    backgroundColor: palette.cardSoft,
  },

  filterChipText: {
    fontSize: 12.5,
    fontWeight: "800",
    textAlign: "center",
  },

  chartSection: {
    marginTop: 14,
  },

  chartWrap: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 20,
    padding: 10,
    backgroundColor: palette.cardSoft,
  },

  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },

  chartCaption: {
    color: palette.subtext,
    fontSize: 11.5,
    fontWeight: "900",
  },

  chartEmpty: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 20,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.cardSoft,
  },

  chartEmptyTitle: {
    color: palette.text,
    fontWeight: "900",
    fontSize: 13.5,
  },

  chartEmptySub: {
    color: palette.subtext,
    fontWeight: "700",
    marginTop: 6,
    textAlign: "center",
    lineHeight: 18,
    fontSize: 12.5,
  },

  summaryRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },

  summaryCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 18,
    padding: 10,
    backgroundColor: palette.cardSoft,
    alignItems: "center",
  },

  summaryLabel: {
    color: palette.subtext,
    fontSize: 11.5,
    fontWeight: "900",
  },

  summaryVal: {
    color: palette.text,
    marginTop: 4,
    fontSize: 13.5,
    fontWeight: "900",
    textAlign: "center",
  },

  inlineInfo: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: palette.cardSoft,
  },

  inlineInfoText: {
    color: palette.subtext,
    fontSize: 12.5,
    fontWeight: "800",
  },

  emptyInline: {
    marginTop: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 16,
    alignItems: "center",
    backgroundColor: palette.cardSoft,
  },

  emptyInlineIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },

  emptyInlineTitle: {
    color: palette.text,
    fontSize: 14,
    fontWeight: "900",
    textAlign: "center",
  },

  emptyInlineSub: {
    color: palette.subtext,
    marginTop: 4,
    fontSize: 12.5,
    fontWeight: "700",
    lineHeight: 18,
    textAlign: "center",
  },

  recordsGroups: {
    marginTop: 14,
    gap: 12,
  },

  groupCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 12,
    backgroundColor: palette.cardSoft,
  },

  groupHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },

  groupTitle: {
    color: palette.text,
    fontSize: 14.5,
    fontWeight: "900",
    flex: 1,
  },

  recordCodePill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: palette.line,
    maxWidth: 120,
  },

  recordCodePillText: {
    color: palette.purple,
    fontSize: 12,
    fontWeight: "900",
  },

  groupRecords: {
    marginTop: 10,
    gap: 8,
  },

  recordRow: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: palette.card,
  },

  recordIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.cardSoft,
    alignItems: "center",
    justifyContent: "center",
  },

  recordKey: {
    color: palette.text,
    fontSize: 12.5,
    fontWeight: "900",
  },

  recordMeta: {
    color: palette.subtext,
    marginTop: 2,
    fontSize: 11.5,
    fontWeight: "800",
  },

  recordVal: {
    color: palette.text,
    fontSize: 14.5,
    fontWeight: "900",
    maxWidth: 130,
    textAlign: "right",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(45,36,77,0.35)",
    justifyContent: "center",
    padding: 16,
  },

  modalCard: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card,
    padding: 14,
    ...(Platform.OS === "ios"
      ? {
          shadowColor: "#000",
          shadowOpacity: 0.18,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 12 },
        }
      : { elevation: 4 }),
  },

  modalTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: "900",
  },

  modalRow: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  modalRowTitle: {
    fontSize: 13.5,
    fontWeight: "900",
  },

  modalRowSub: {
    color: palette.subtext,
    marginTop: 2,
    fontSize: 12,
    fontWeight: "800",
  },

  modalRowChevron: {
    fontSize: 18,
    fontWeight: "900",
  },

  modalBtn: {
    borderRadius: 18,
    paddingVertical: 13,
    alignItems: "center",
    backgroundColor: palette.cardSoft,
    borderWidth: 1,
    borderColor: palette.line,
  },

  modalBtnText: {
    color: palette.text,
    fontSize: 14,
    fontWeight: "900",
  },
});