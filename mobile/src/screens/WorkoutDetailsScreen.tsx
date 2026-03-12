import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { api } from "../api/client";
import { useFocusEffect } from "@react-navigation/native";

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
  danger: "#E5484D",
  dangerSoft: "rgba(229,72,77,0.10)",
};

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

function PrimaryButton({
  title,
  subtitle,
  onPress,
  loading,
}: {
  title: string;
  subtitle?: string;
  onPress: () => void;
  loading?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => [
        styles.primaryButtonWrap,
        { opacity: loading ? 0.6 : pressed ? 0.9 : 1 },
      ]}
    >
      <LinearGradient
        colors={[palette.purple, palette.purpleDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.primaryButton}
      >
        <View style={styles.primaryButtonIcon}>
          {loading ? (
            <ActivityIndicator color={palette.purpleDark} />
          ) : (
            <Ionicons name="create-outline" size={18} color={palette.purpleDark} />
          )}
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.primaryButtonText}>{title}</Text>
          {subtitle ? <Text style={styles.primaryButtonSub}>{subtitle}</Text> : null}
        </View>
      </LinearGradient>
    </Pressable>
  );
}

function SecondaryButton({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle?: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}>
      <View style={styles.secondaryButton}>
        <View style={styles.secondaryButtonIcon}>
          <Ionicons name="copy-outline" size={18} color={palette.purple} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.secondaryButtonTitle}>{title}</Text>
          {subtitle ? <Text style={styles.secondaryButtonSub}>{subtitle}</Text> : null}
        </View>

        <Ionicons name="chevron-forward" size={18} color={palette.subtext} />
      </View>
    </Pressable>
  );
}

function DangerButton({
  title,
  onPress,
  loading,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => [
        styles.dangerButton,
        { opacity: loading ? 0.6 : pressed ? 0.9 : 1 },
      ]}
    >
      <MaterialCommunityIcons name="trash-can-outline" size={18} color={palette.danger} />
      <Text style={styles.dangerButtonText}>{title}</Text>
      {loading ? <ActivityIndicator color={palette.danger} /> : null}
    </Pressable>
  );
}

export default function WorkoutDetailsScreen({ route, navigation }: any) {
  const { workoutId } = route.params as { workoutId: string };

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
      <View style={styles.screen}>
        <StatusBar barStyle="dark-content" backgroundColor={palette.bg} />
        <LinearGradient colors={[palette.bg, palette.bg2]} style={StyleSheet.absoluteFill} />

        <View style={styles.blobTopRight} pointerEvents="none" />
        <View style={styles.blobLeft} pointerEvents="none" />
        <View style={styles.blobBottom} pointerEvents="none" />

        <View style={{ padding: 16 }}>
          <View style={styles.skeletonCard}>
            <View style={[styles.skeletonLine, { width: "62%" }]} />
            <View style={[styles.skeletonLine, { width: "82%", marginTop: 10 }]} />
            <View style={[styles.skeletonLine, { width: "54%", marginTop: 10 }]} />
          </View>

          <View style={{ height: 12 }} />

          <View style={styles.skeletonCard}>
            <View style={[styles.skeletonLine, { width: "45%" }]} />
            <View style={[styles.skeletonLine, { width: "88%", marginTop: 10 }]} />
            <View style={[styles.skeletonLine, { width: "76%", marginTop: 10 }]} />
          </View>
        </View>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.screen}>
        <StatusBar barStyle="dark-content" backgroundColor={palette.bg} />
        <LinearGradient colors={[palette.bg, palette.bg2]} style={StyleSheet.absoluteFill} />

        <View style={styles.blobTopRight} pointerEvents="none" />
        <View style={styles.blobLeft} pointerEvents="none" />
        <View style={styles.blobBottom} pointerEvents="none" />

        <View style={{ padding: 16 }}>
          <View style={styles.mainCard}>
            <Text style={styles.sectionKicker}>ТРЕНИРОВКА</Text>
            <Text style={styles.sectionTitle}>Не найдено</Text>
            <Text style={styles.sectionDescription}>
              Возможно, тренировка была удалена или сейчас недоступна.
            </Text>

            <SecondaryButton
              title="Назад"
              subtitle="Вернуться в историю тренировок"
              onPress={() => navigation.goBack()}
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={palette.bg} />
      <LinearGradient colors={[palette.bg, palette.bg2]} style={StyleSheet.absoluteFill} />

      <View style={styles.blobTopRight} pointerEvents="none" />
      <View style={styles.blobLeft} pointerEvents="none" />
      <View style={styles.blobBottom} pointerEvents="none" />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load("refresh")}
            tintColor={palette.purple}
          />
        }
        showsVerticalScrollIndicator={false}
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
          <Text style={styles.heroTitle}>{header.name}</Text>
          <Text style={styles.heroSubtitle}>
            {header.dt} • {header.dur}
          </Text>

          <View style={styles.heroMiniRow}>
            <View style={styles.heroMiniPill}>
              <Ionicons name="time-outline" size={14} color={palette.purple} />
              <Text style={styles.heroMiniPillText}>{header.dur}</Text>
            </View>

            {item?.activityType?.code ? (
              <View style={styles.heroMiniPill}>
                <Ionicons name="fitness-outline" size={14} color={palette.purple} />
                <Text style={styles.heroMiniPillText}>{item.activityType.code}</Text>
              </View>
            ) : null}
          </View>
        </LinearGradient>

        <View style={styles.statsRow}>
          <SummaryStat
            value={String(metrics.length)}
            label="метрик"
            tint="rgba(124,231,255,0.28)"
            icon={<Ionicons name="stats-chart-outline" size={18} color={palette.purple} />}
          />
          <SummaryStat
            value={item?.notes ? "Да" : "Нет"}
            label="заметки"
            tint="rgba(255,141,216,0.28)"
            icon={<Ionicons name="document-text-outline" size={18} color={palette.purple} />}
          />
          <SummaryStat
            value={item?.activityType?.code ?? "—"}
            label="код"
            tint="rgba(255,179,107,0.28)"
            icon={<Ionicons name="pricetag-outline" size={18} color={palette.purple} />}
          />
        </View>

        <View style={styles.mainCard}>
          <Text style={styles.sectionKicker}>ОБЗОР</Text>
          <Text style={styles.sectionTitle}>Детали тренировки</Text>
          <Text style={styles.sectionDescription}>
            Основная информация, показатели и заметки по выбранной тренировке.
          </Text>

          <View style={styles.badgesRow}>
            <InfoBadge
              icon={<Ionicons name="flash" size={14} color={palette.purple} />}
              label="Показатели"
            />
            <InfoBadge
              icon={<Ionicons name="document-text-outline" size={14} color={palette.purple} />}
              label="Заметки"
            />
            <InfoBadge
              icon={<Ionicons name="create-outline" size={14} color={palette.purple} />}
              label="Редактирование"
            />
          </View>
        </View>

        <View style={styles.mainCard}>
          <Text style={styles.sectionKicker}>МЕТРИКИ</Text>
          <Text style={styles.sectionTitle}>Показатели</Text>
          <Text style={styles.sectionDescription}>
            Ключевые значения, сохранённые для этой тренировки.
          </Text>

          <View style={{ gap: 10, marginTop: 4 }}>
            {metrics.length === 0 ? (
              <View style={styles.emptyInline}>
                <Text style={styles.emptyInlineTitle}>Нет метрик</Text>
                <Text style={styles.emptyInlineSub}>
                  Для этой активности не сохранены показатели.
                </Text>
              </View>
            ) : (
              metrics.map((m) => (
                <View key={m.id} style={styles.metricRow}>
                  <Text style={styles.metricKey} numberOfLines={1}>
                    {m.label}
                  </Text>
                  <Text style={styles.metricVal} numberOfLines={1}>
                    {m.value}
                  </Text>
                </View>
              ))
            )}
          </View>
        </View>

        {item?.notes ? (
          <View style={styles.mainCard}>
            <Text style={styles.sectionKicker}>ЗАМЕТКИ</Text>
            <Text style={styles.sectionTitle}>Комментарий</Text>
            <Text style={styles.sectionDescription}>
              Дополнительная информация, которую Вы сохранили к тренировке.
            </Text>

            <View style={styles.notesBox}>
              <Text style={styles.notes}>{item.notes}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.mainCard}>
          <Text style={styles.sectionKicker}>ДЕЙСТВИЯ</Text>
          <Text style={styles.sectionTitle}>Управление записью</Text>
          <Text style={styles.sectionDescription}>
            Можно изменить, продублировать или удалить эту тренировку.
          </Text>

          <View style={{ gap: 10 }}>
            <PrimaryButton
              title="Редактировать"
              subtitle="Изменить дату, длительность и показатели"
              onPress={() => navigation.navigate("EditWorkout", { workoutId })}
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

                navigation.navigate("Drawer", {
                  screen: "AddWorkout",
                  params: { prefill },
                });
              }}
            />

            <DangerButton
              title={deleting ? "Удаляем…" : "Удалить тренировку"}
              onPress={onDelete}
              loading={deleting}
            />
          </View>
        </View>

        <View style={{ height: 6 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.bg,
  },

  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 22,
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
    maxWidth: "92%",
  },

  heroSubtitle: {
    color: "rgba(255,255,255,0.84)",
    fontSize: 14.5,
    lineHeight: 21,
    fontWeight: "600",
    maxWidth: "92%",
    marginBottom: 18,
  },

  heroMiniRow: {
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
    textAlign: "center",
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

  metricRow: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    backgroundColor: palette.cardSoft,
  },

  metricKey: {
    flex: 1,
    color: palette.subtext,
    fontSize: 12.5,
    fontWeight: "900",
  },

  metricVal: {
    color: palette.text,
    fontSize: 13.5,
    fontWeight: "900",
    maxWidth: "48%",
    textAlign: "right",
  },

  notesBox: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 18,
    padding: 12,
    backgroundColor: palette.cardSoft,
  },

  notes: {
    color: palette.text,
    fontSize: 14.5,
    fontWeight: "800",
    lineHeight: 20,
  },

  primaryButtonWrap: {
    borderRadius: 22,
    overflow: "hidden",
  },

  primaryButton: {
    minHeight: 62,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
  },

  primaryButtonIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15.5,
    fontWeight: "900",
  },

  primaryButtonSub: {
    marginTop: 2,
    color: "rgba(255,255,255,0.85)",
    fontSize: 12.5,
    fontWeight: "800",
  },

  secondaryButton: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.line,
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: palette.cardSoft,
  },

  secondaryButtonIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  secondaryButtonTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: "900",
  },

  secondaryButtonSub: {
    color: palette.subtext,
    marginTop: 2,
    fontSize: 12.5,
    fontWeight: "800",
  },

  dangerButton: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(229,72,77,0.35)",
    paddingVertical: 13,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: palette.dangerSoft,
  },

  dangerButtonText: {
    color: palette.danger,
    fontSize: 13.8,
    fontWeight: "900",
  },

  emptyInline: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 12,
    backgroundColor: palette.cardSoft,
  },

  emptyInlineTitle: {
    color: palette.text,
    fontSize: 13.5,
    fontWeight: "900",
  },

  emptyInlineSub: {
    color: palette.subtext,
    marginTop: 4,
    fontSize: 12.5,
    fontWeight: "700",
    lineHeight: 18,
  },

  skeletonCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 14,
    backgroundColor: palette.card,
    ...(Platform.OS === "ios"
      ? { shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } }
      : { elevation: 1 }),
  },

  skeletonLine: {
    height: 14,
    borderRadius: 10,
    backgroundColor: palette.cardSoft,
  },
});