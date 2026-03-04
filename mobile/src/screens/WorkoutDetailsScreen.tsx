import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { api } from "../api/client";
import { useFocusEffect } from "@react-navigation/native";

function makePalette(isDark: boolean) {
  return {
    bg: isDark ? "#0B0D12" : "#F4F6FA",
    card: isDark ? "#121625" : "#FFFFFF",
    text: isDark ? "#E9ECF5" : "#121722",
    subtext: isDark ? "#A9B1C7" : "#5C667A",
    border: isDark ? "rgba(255,255,255,0.10)" : "rgba(16,24,40,0.10)",
    primary: "#2D6BFF",
    danger: "#E5484D",
    inputBg: isDark ? "rgba(255,255,255,0.06)" : "#F2F4F7",
    softPrimary: isDark ? "rgba(45,107,255,0.16)" : "rgba(45,107,255,0.10)",
    softDanger: isDark ? "rgba(229,72,77,0.14)" : "rgba(229,72,77,0.10)",
    success: "#1F7A2E",
  };
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} • ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function formatDuration(sec?: number | null) {
  if (!sec || sec <= 0) return "—";
  const total = Math.round(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}ч ${m}м`;
  if (m > 0) return `${m}м ${s}с`;
  return `${s}с`;
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
  };
  return map[key] ?? key;
}

function formatMetricValue(metricKey: string, valueNum: any, unit?: string | null) {
  const n = Number(valueNum);
  if (!Number.isFinite(n)) return String(valueNum ?? "—");

  // легкие форматеры для UX
  if (metricKey === "distance_m") {
    if (n >= 1000) return `${(n / 1000).toFixed(2)} км`;
    return `${Math.round(n)} м`;
  }
  if (metricKey === "distance_km") return `${n.toFixed(n % 1 === 0 ? 0 : 2)} км`;
  if (metricKey === "avg_speed_kmh") return `${n.toFixed(1)} км/ч`;
  if (metricKey === "avg_pace_min_km") {
    // ожидаем float минут. превращаем в m:ss
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

  // fallback — показываем unit если пришёл
  const base = n % 1 === 0 ? String(Math.round(n)) : String(n);
  return unit ? `${base} ${unit}` : base;
}

function PrimaryButton({
  title,
  subtitle,
  onPress,
  palette,
  loading,
}: {
  title: string;
  subtitle?: string;
  onPress: () => void;
  palette: ReturnType<typeof makePalette>;
  loading?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => [
        styles.primaryBtn,
        {
          backgroundColor: palette.primary,
          opacity: loading ? 0.55 : pressed ? 0.86 : 1,
        },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.primaryBtnTitle}>{title}</Text>
        {subtitle ? <Text style={styles.primaryBtnSub}>{subtitle}</Text> : null}
      </View>
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.chevWhite}>›</Text>}
    </Pressable>
  );
}

function SecondaryButton({
  title,
  subtitle,
  onPress,
  palette,
  loading,
}: {
  title: string;
  subtitle?: string;
  onPress: () => void;
  palette: ReturnType<typeof makePalette>;
  loading?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => [
        styles.secondaryBtn,
        {
          backgroundColor: palette.card,
          borderColor: palette.border,
          opacity: loading ? 0.55 : pressed ? 0.86 : 1,
        },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.secondaryBtnTitle, { color: palette.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.secondaryBtnSub, { color: palette.subtext }]}>{subtitle}</Text> : null}
      </View>
      {loading ? <ActivityIndicator color={palette.text} /> : <Text style={[styles.chev, { color: palette.subtext }]}>›</Text>}
    </Pressable>
  );
}

function DangerButton({
  title,
  onPress,
  palette,
  loading,
}: {
  title: string;
  onPress: () => void;
  palette: ReturnType<typeof makePalette>;
  loading?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => [
        styles.dangerBtn,
        {
          borderColor: "rgba(229,72,77,0.35)",
          backgroundColor: palette.softDanger,
          opacity: loading ? 0.55 : pressed ? 0.86 : 1,
        },
      ]}
    >
      <Text style={[styles.dangerText, { color: palette.danger }]}>{title}</Text>
      {loading ? <ActivityIndicator color={palette.danger} /> : null}
    </Pressable>
  );
}

export default function WorkoutDetailsScreen({ route, navigation }: any) {
  const { workoutId } = route.params as { workoutId: string };

  const scheme = useColorScheme();
  const palette = useMemo(() => makePalette(scheme === "dark"), [scheme]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [item, setItem] = useState<any>(null);

  const [deleting, setDeleting] = useState(false);

  const load = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (mode === "initial") setLoading(true);
      if (mode === "refresh") setRefreshing(true);

      try {
        const res = await api.get(`/workouts/${workoutId}`);
        setItem(res?.data?.workout ?? null);
      } catch (e: any) {
        Alert.alert("Ошибка", e?.message ?? "Не удалось загрузить тренировку");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [workoutId]
  );

  useFocusEffect(
    useCallback(() => {
      load("initial");
    }, [load])
  );

  const onDelete = async () => {
    Alert.alert("Удалить тренировку?", "Действие необратимо. Тренировка исчезнет из истории.", [
      { text: "Отмена", style: "cancel" },
      {
        text: "Удалить",
        style: "destructive",
        onPress: async () => {
          try {
            setDeleting(true);
            await api.delete(`/workouts/${workoutId}`);
            navigation.goBack();
          } catch (e: any) {
            Alert.alert("Ошибка", e?.message ?? "Не удалось удалить");
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  const header = useMemo(() => {
    const name = item?.activityType?.name ?? "Тренировка";
    const dt = item?.startedAt ? formatDate(item.startedAt) : "—";
    const dur = formatDuration(item?.durationSec);
    return { name, dt, dur };
  }, [item]);

  const metrics = useMemo(() => {
    const raw = (item?.metrics ?? []) as any[];
    // показываем только те, у кого есть значение
    return raw
      .filter((m) => m && m.metricKey != null && m.valueNum != null)
      .map((m) => ({
        id: m.id ?? `${m.metricKey}-${String(m.valueNum)}`,
        key: String(m.metricKey),
        label: metricLabel(String(m.metricKey)),
        value: formatMetricValue(String(m.metricKey), m.valueNum, m.unit),
      }));
  }, [item]);

  if (loading) {
    return (
      <View style={[styles.screen, { backgroundColor: palette.bg }]}>
        <View style={{ padding: 16 }}>
          <View style={[styles.skelCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={[styles.skelLine, { backgroundColor: palette.inputBg, width: "62%" }]} />
            <View style={[styles.skelLine, { backgroundColor: palette.inputBg, width: "82%", marginTop: 10 }]} />
            <View style={[styles.skelLine, { backgroundColor: palette.inputBg, width: "54%", marginTop: 10 }]} />
          </View>

          <View style={{ height: 12 }} />
          <View style={[styles.skelCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={[styles.skelLine, { backgroundColor: palette.inputBg, width: "45%" }]} />
            <View style={[styles.skelLine, { backgroundColor: palette.inputBg, width: "88%", marginTop: 10 }]} />
            <View style={[styles.skelLine, { backgroundColor: palette.inputBg, width: "76%", marginTop: 10 }]} />
          </View>
        </View>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={[styles.screen, { backgroundColor: palette.bg }]}>
        <View style={{ padding: 16 }}>
          <View style={[styles.emptyBox, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.emptyTitle, { color: palette.text }]}>Не найдено</Text>
            <Text style={[styles.emptySub, { color: palette.subtext }]}>
              Возможно, тренировка была удалена или недоступна.
            </Text>

            <View style={{ height: 12 }} />
            <SecondaryButton
              title="Назад"
              subtitle="Вернуться в список"
              onPress={() => navigation.goBack()}
              palette={palette}
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 22 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load("refresh")}
            tintColor={palette.primary}
          />
        }
      >
        {/* Header card */}
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={[styles.headerBadge, { backgroundColor: palette.softPrimary, borderColor: palette.border }]}>
            <Text style={[styles.headerBadgeText, { color: palette.primary }]}>Тренировка</Text>
          </View>

          <Text style={[styles.title, { color: palette.text }]} numberOfLines={2}>
            {header.name}
          </Text>

          <Text style={[styles.subtitle, { color: palette.subtext }]}>
            {header.dt} • {header.dur}
          </Text>

          {item?.activityType?.code ? (
            <Text style={[styles.code, { color: palette.subtext }]}>{item.activityType.code}</Text>
          ) : null}
        </View>

        {/* Metrics */}
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border, marginTop: 12 }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Показатели</Text>
          <Text style={[styles.sectionSub, { color: palette.subtext }]}>
            Ключевые метрики этой тренировки
          </Text>

          <View style={{ marginTop: 10, gap: 8 }}>
            {metrics.length === 0 ? (
              <View style={[styles.emptyInline, { backgroundColor: palette.inputBg, borderColor: palette.border }]}>
                <Text style={[styles.emptyInlineTitle, { color: palette.text }]}>Нет метрик</Text>
                <Text style={[styles.emptyInlineSub, { color: palette.subtext }]}>
                  Для этой активности не сохранены показатели.
                </Text>
              </View>
            ) : (
              metrics.map((m) => (
                <View
                  key={m.id}
                  style={[
                    styles.metricRow,
                    { backgroundColor: palette.inputBg, borderColor: palette.border },
                  ]}
                >
                  <Text style={[styles.metricKey, { color: palette.subtext }]} numberOfLines={1}>
                    {m.label}
                  </Text>
                  <Text style={[styles.metricVal, { color: palette.text }]} numberOfLines={1}>
                    {m.value}
                  </Text>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Notes */}
        {item?.notes ? (
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border, marginTop: 12 }]}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Заметки</Text>
            <Text style={[styles.notes, { color: palette.text }]}>{item.notes}</Text>
          </View>
        ) : null}

        {/* Actions */}
        <View style={{ marginTop: 12, gap: 10 }}>
          <PrimaryButton
            title="Редактировать"
            subtitle="Изменить дату, длительность и метрики"
            onPress={() => navigation.navigate("EditWorkout", { workoutId })}
            palette={palette}
          />

          <SecondaryButton
            title="Дублировать"
            subtitle="Создать новую тренировку на основе этой"
            onPress={() => {
              const w = item;
              if (!w) return;

              const prefill = {
                activityTypeId: w.activityTypeId ?? w.activityType?.id,
                durationSec: w.durationSec ?? null,
                notes: w.notes ?? "",
                metrics: (w.metrics ?? []).map((m: any) => ({
                  metricKey: m.metricKey,
                  valueNum: Number(m.valueNum),
                  unit: m.unit ?? null,
                })),
              };

              // если у тебя Drawer-роутинг: "Drawer" -> screen "AddWorkout"
              navigation.navigate("Drawer", {
                screen: "AddWorkout",
                params: { prefill },
              });
            }}
            palette={palette}
          />

          <DangerButton title={deleting ? "Удаляю…" : "Удалить тренировку"} onPress={onDelete} palette={palette} loading={deleting} />
        </View>

        <View style={{ height: 6 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },

  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    ...(Platform.OS === "ios"
      ? { shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } }
      : { elevation: 1 }),
  },

  headerBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
  },
  headerBadgeText: { fontSize: 12, fontWeight: "900" },

  title: { fontSize: 18, fontWeight: "900" },
  subtitle: { marginTop: 4, fontSize: 12.5, fontWeight: "800" },
  code: { marginTop: 6, fontSize: 12, fontWeight: "900", opacity: 0.9 },

  sectionTitle: { fontSize: 14.5, fontWeight: "900" },
  sectionSub: { marginTop: 4, fontSize: 12.5, fontWeight: "700", lineHeight: 18 },

  metricRow: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  metricKey: { flex: 1, fontSize: 12.5, fontWeight: "900" },
  metricVal: { fontSize: 13.5, fontWeight: "900" },

  notes: { marginTop: 10, fontSize: 14.5, fontWeight: "800", lineHeight: 20 },

  primaryBtn: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  primaryBtnTitle: { color: "#fff", fontSize: 15.5, fontWeight: "900" },
  primaryBtnSub: { marginTop: 2, color: "rgba(255,255,255,0.85)", fontSize: 12.5, fontWeight: "800" },
  chevWhite: { color: "#fff", fontSize: 24, fontWeight: "900" },

  secondaryBtn: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  secondaryBtnTitle: { fontSize: 15, fontWeight: "900" },
  secondaryBtnSub: { marginTop: 2, fontSize: 12.5, fontWeight: "800" },
  chev: { fontSize: 24, fontWeight: "900" },

  dangerBtn: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dangerText: { fontSize: 13.5, fontWeight: "900" },

  emptyBox: { borderRadius: 18, borderWidth: 1, padding: 14 },
  emptyTitle: { fontSize: 15.5, fontWeight: "900" },
  emptySub: { marginTop: 6, fontSize: 12.5, fontWeight: "700", lineHeight: 18 },

  emptyInline: { borderRadius: 16, borderWidth: 1, padding: 12 },
  emptyInlineTitle: { fontSize: 13.5, fontWeight: "900" },
  emptyInlineSub: { marginTop: 4, fontSize: 12.5, fontWeight: "700", lineHeight: 18 },

  skelCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    ...(Platform.OS === "ios"
      ? { shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } }
      : { elevation: 1 }),
  },
  skelLine: { height: 14, borderRadius: 10 },
});