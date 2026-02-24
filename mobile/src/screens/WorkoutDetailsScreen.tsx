import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
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
    border: isDark ? "rgba(255,255,255,0.08)" : "rgba(16,24,40,0.08)",
    primary: "#2D6BFF",
    danger: "#E5484D",
    inputBg: isDark ? "rgba(255,255,255,0.06)" : "#F2F4F7",
  };
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function formatDuration(sec?: number | null) {
  if (!sec || sec <= 0) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
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
    elevation_m: "Высота",
    rounds: "Раунды",
  };
  return map[key] ?? key;
}

export default function WorkoutDetailsScreen({ route, navigation }: any) {
  const { workoutId } = route.params as { workoutId: string };

  const scheme = useColorScheme();
  const palette = useMemo(() => makePalette(scheme === "dark"), [scheme]);

  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/workouts/${workoutId}`);
      setItem(res?.data?.workout ?? null);
    } catch (e: any) {
      Alert.alert("Ошибка", e?.message ?? "Не удалось загрузить тренировку");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => {});
  }, [workoutId]);

  useFocusEffect(
    React.useCallback(() => {
      load().catch(() => {});
    }, [workoutId]),
  );

  const onDelete = async () => {
    Alert.alert("Удалить тренировку?", "Действие необратимо.", [
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

  if (loading) {
    return (
      <View
        style={[styles.screen, { backgroundColor: palette.bg, padding: 16 }]}
      >
        <Text style={{ color: palette.subtext, fontWeight: "800" }}>
          Загрузка…
        </Text>
      </View>
    );
  }

  if (!item) {
    return (
      <View
        style={[styles.screen, { backgroundColor: palette.bg, padding: 16 }]}
      >
        <Text style={{ color: palette.subtext, fontWeight: "800" }}>
          Не найдено
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 18 }}>
        <View
          style={[
            styles.card,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          <Text style={[styles.title, { color: palette.text }]}>
            {item.activityType?.name}
          </Text>
          <Text style={[styles.subtitle, { color: palette.subtext }]}>
            {formatDate(item.startedAt)} • {formatDuration(item.durationSec)}
          </Text>

          <View style={{ height: 12 }} />

          {(item.metrics ?? []).map((m: any) => (
            <View
              key={m.id}
              style={[
                styles.metricRow,
                {
                  backgroundColor: palette.inputBg,
                  borderColor: palette.border,
                },
              ]}
            >
              <Text style={[styles.metricKey, { color: palette.subtext }]}>
                {metricLabel(m.metricKey)}
              </Text>
              <Text style={[styles.metricVal, { color: palette.text }]}>
                {Number(m.valueNum).toString()}
                {m.unit ? ` ${m.unit}` : ""}
              </Text>
            </View>
          ))}

          {item.notes ? (
            <View style={{ marginTop: 12 }}>
              <Text style={[styles.sectionLabel, { color: palette.subtext }]}>
                Заметки
              </Text>
              <Text style={[styles.notes, { color: palette.text }]}>
                {item.notes}
              </Text>
            </View>
          ) : null}
        </View>

        <Pressable
          onPress={() => navigation.navigate("EditWorkout", { workoutId })}
          style={[
            styles.primaryBtn,
            { backgroundColor: palette.primary, opacity: 1 },
          ]}
        >
          <Text style={styles.primaryBtnText}>Редактировать</Text>
        </Pressable>

        <Pressable
  onPress={() => {
    const w = item;
    if (!w) return;

    const prefill = {
      activityTypeId: w.activityTypeId ?? w.activityType?.id,
      durationSec: w.durationSec ?? null,
      notes: w.notes ?? '',
      metrics: (w.metrics ?? []).map((m: any) => ({
        metricKey: m.metricKey,
        valueNum: Number(m.valueNum),
        unit: m.unit ?? null,
      })),
    };

    // ВАЖНО: Drawer у тебя — это экран Stack с именем "Drawer"
    // А AddWorkout — экран внутри DrawerNavigator
    navigation.navigate('Drawer', {
      screen: 'AddWorkout',
      params: { prefill },
    });
  }}
  style={[styles.secondaryBtn, { borderColor: palette.border, backgroundColor: palette.card }]}
>
  <Text style={[styles.secondaryBtnText, { color: palette.text }]}>Дублировать</Text>
</Pressable>

        <Pressable
          onPress={onDelete}
          disabled={deleting}
          style={[
            styles.dangerBtn,
            {
              backgroundColor: palette.card,
              borderColor: palette.border,
              opacity: deleting ? 0.6 : 1,
            },
          ]}
        >
          <Text style={[styles.dangerText, { color: palette.danger }]}>
            {deleting ? "Удаляю…" : "Удалить тренировку"}
          </Text>
        </Pressable>
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
      ? {
          shadowColor: "#000",
          shadowOpacity: 0.06,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 8 },
        }
      : { elevation: 1 }),
  },
  title: { fontSize: 18, fontWeight: "900" },
  subtitle: { marginTop: 4, fontSize: 12.5, fontWeight: "800" },

  metricRow: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  metricKey: { fontSize: 12.5, fontWeight: "900" },
  metricVal: { fontSize: 13.5, fontWeight: "900" },

  sectionLabel: { fontSize: 12.5, fontWeight: "900" },
  notes: { marginTop: 6, fontSize: 14.5, fontWeight: "800", lineHeight: 20 },

  dangerBtn: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: "center",
  },
  dangerText: { fontSize: 15, fontWeight: "900" },

  primaryBtn: {
    marginTop: 12,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "900" },

  secondaryBtn: {
    marginTop: 10,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryBtnText: { fontSize: 15, fontWeight: "900" },
});
