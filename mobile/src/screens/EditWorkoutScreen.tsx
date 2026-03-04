import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { api } from "../api/client";
import { getAchievements } from "../api/achievementsApi";

type Field =
  | {
      key: string;
      label: string;
      type: "number";
      min?: number;
      max?: number;
      unit?: string;
      step?: number;
      required?: boolean;
    }
  | { key: string; label: string; type: "text"; required?: boolean }
  | {
      key: string;
      label: string;
      type: "select";
      options: { label: string; value: string }[];
      required?: boolean;
    };

type ActivityType = {
  id: string;
  code: string;
  name: string;
  fieldsSchema?: { fields?: Field[] } | null;
};

function makePalette(isDark: boolean) {
  return {
    bg: isDark ? "#0B0D12" : "#F4F6FA",
    card: isDark ? "#121625" : "#FFFFFF",
    text: isDark ? "#E9ECF5" : "#121722",
    subtext: isDark ? "#A9B1C7" : "#5C667A",
    border: isDark ? "rgba(255,255,255,0.10)" : "rgba(16,24,40,0.10)",
    primary: "#2D6BFF",
    danger: "#E5484D",
    success: "#1F7A2E",
    inputBg: isDark ? "rgba(255,255,255,0.06)" : "#F2F4F7",
    softPrimary: isDark ? "rgba(45,107,255,0.16)" : "rgba(45,107,255,0.10)",
    softSuccess: isDark ? "rgba(31,122,46,0.18)" : "rgba(31,122,46,0.10)",
  };
}

function clampNumStr(value: string) {
  return value.replace(/[^\d.,-]/g, "").replace(",", ".");
}

function isoNow() {
  return new Date().toISOString();
}

function formatLocalShort(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} • ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function secToMinStr(sec?: number | null) {
  if (sec == null) return "";
  const n = Number(sec);
  if (!Number.isFinite(n) || n < 0) return "";
  return String(Math.round(n / 60));
}

function minToSec(minStr: string) {
  const m = Number(minStr);
  if (!Number.isFinite(m) || m < 0) return undefined;
  return Math.round(m * 60);
}

/** Конфетти без библиотек */
function ConfettiBurst({ show }: { show: boolean }) {
  const { width } = Dimensions.get("window");
  const pieces = useRef(
    Array.from({ length: 22 }).map((_, idx) => {
      const x = Math.random() * (Math.min(width, 420) - 40) + 20;
      const size = 6 + Math.random() * 8;
      const delay = Math.random() * 220;
      const drift = (Math.random() - 0.5) * 90;
      const fall = 220 + Math.random() * 140;

      return {
        key: `p_${idx}`,
        x,
        size,
        delay,
        drift,
        fall,
        y: new Animated.Value(-30),
        r: new Animated.Value(0),
        o: new Animated.Value(0),
      };
    })
  ).current;

  React.useEffect(() => {
    if (!show) return;

    pieces.forEach((p) => {
      p.y.setValue(-30);
      p.r.setValue(0);
      p.o.setValue(0);

      Animated.parallel([
        Animated.timing(p.o, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(p.delay),
          Animated.timing(p.y, {
            toValue: p.fall,
            duration: 1100,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.delay(p.delay),
          Animated.timing(p.r, {
            toValue: 1,
            duration: 1100,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.delay(p.delay + 680),
          Animated.timing(p.o, { toValue: 0, duration: 520, useNativeDriver: true }),
        ]),
      ]).start();
    });
  }, [show, pieces]);

  const colors = ["#2D6BFF", "#7CF08D", "#FFD166", "#EF476F", "#06D6A0", "#8B5CF6"];

  return (
    <View pointerEvents="none" style={styles.confettiLayer}>
      {pieces.map((p, idx) => {
        const rotate = p.r.interpolate({
          inputRange: [0, 1],
          outputRange: ["0deg", `${360 + Math.random() * 720}deg`],
        });

        return (
          <Animated.View
            key={p.key}
            style={{
              position: "absolute",
              left: p.x,
              top: 0,
              width: p.size,
              height: p.size * 1.6,
              borderRadius: 3,
              backgroundColor: colors[idx % colors.length],
              opacity: p.o,
              transform: [
                { translateY: p.y },
                {
                  translateX: p.y.interpolate({
                    inputRange: [-30, p.fall],
                    outputRange: [0, p.drift],
                  }),
                },
                { rotate },
              ],
            }}
          />
        );
      })}
    </View>
  );
}

function PrimaryButton({
  title,
  subtitle,
  onPress,
  palette,
  loading,
  disabled,
}: {
  title: string;
  subtitle?: string;
  onPress: () => void;
  palette: ReturnType<typeof makePalette>;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.primaryBtn,
        {
          backgroundColor: palette.primary,
          opacity: disabled || loading ? 0.55 : pressed ? 0.86 : 1,
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
          backgroundColor: "rgba(229,72,77,0.12)",
          opacity: loading ? 0.55 : pressed ? 0.86 : 1,
        },
      ]}
    >
      <Text style={[styles.dangerBtnText, { color: palette.danger }]}>{title}</Text>
      {loading ? <ActivityIndicator color={palette.danger} /> : null}
    </Pressable>
  );
}

function NumberField({
  label,
  unit,
  value,
  onChange,
  palette,
  required,
}: {
  label: string;
  unit?: string;
  value: string;
  onChange: (v: string) => void;
  palette: ReturnType<typeof makePalette>;
  required?: boolean;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={[styles.label, { color: palette.subtext }]}>
        {label}
        {unit ? ` (${unit})` : ""}
        {required ? <Text style={{ color: palette.danger }}> *</Text> : null}
      </Text>

      <TextInput
        value={value}
        onChangeText={(v) => onChange(clampNumStr(v))}
        keyboardType="numeric"
        placeholder=""
        placeholderTextColor={palette.subtext}
        style={[
          styles.input,
          {
            backgroundColor: palette.inputBg,
            borderColor: palette.border,
            color: palette.text,
          },
        ]}
      />
    </View>
  );
}

export default function EditWorkoutScreen({ route, navigation }: any) {
  const { workoutId } = route.params as { workoutId: string };

  const scheme = useColorScheme();
  const palette = useMemo(() => makePalette(scheme === "dark"), [scheme]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [activity, setActivity] = useState<ActivityType | null>(null);

  const [startedAtIso, setStartedAtIso] = useState<string>(isoNow());
  const [durationMin, setDurationMin] = useState<string>(""); // UX: минуты
  const [notes, setNotes] = useState<string>("");

  const [values, setValues] = useState<Record<string, string>>({});
  const fields = (activity?.fieldsSchema?.fields ?? []) as Field[];
  const numberFields = fields.filter((f) => f.type === "number") as Extract<Field, { type: "number" }>[];

  const [toastVisible, setToastVisible] = useState(false);
  const [grantedTitles, setGrantedTitles] = useState<string[]>([]);
  const [confettiOn, setConfettiOn] = useState(false);

  const load = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") setLoading(true);
    if (mode === "refresh") setRefreshing(true);

    try {
      const [wRes, aRes] = await Promise.all([api.get(`/workouts/${workoutId}`), api.get("/activities")]);

      const w = wRes?.data?.workout;
      const list: ActivityType[] = aRes?.data?.items ?? [];

      if (!w) throw new Error("Тренировка не найдена");

      const act = list.find((x) => x.id === w.activityTypeId) ?? null;
      setActivity(act);

      setStartedAtIso(w.startedAt);
      setDurationMin(secToMinStr(w.durationSec));
      setNotes(w.notes ?? "");

      const next: Record<string, string> = {};
      (act?.fieldsSchema?.fields ?? []).forEach((f: any) => (next[f.key] = ""));

      (w.metrics ?? []).forEach((m: any) => {
        next[m.metricKey] = String(Number(m.valueNum));
      });

      setValues(next);
    } catch (e: any) {
      Alert.alert("Ошибка", e?.message ?? "Не удалось загрузить тренировку");
      navigation.goBack();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [navigation, workoutId]);

  useFocusEffect(
    useCallback(() => {
      load("initial");
    }, [load])
  );

  const validate = () => {
    const startedAt = new Date(startedAtIso);
    if (Number.isNaN(startedAt.getTime())) return "Дата/время некорректны";

    const dur = durationMin.trim();
    if (dur) {
      const n = Number(dur);
      if (Number.isNaN(n) || n < 0) return "Длительность должна быть числом (минуты)";
      if (n > 24 * 60) return "Слишком большая длительность";
    }

    for (const f of numberFields) {
      const v = (values[f.key] ?? "").trim();
      if (f.required && !v) return `${f.label}: обязательное поле`;
      if (v) {
        const n = Number(v);
        if (Number.isNaN(n)) return `${f.label}: должно быть числом`;
        if (typeof f.min === "number" && n < f.min) return `${f.label}: минимум ${f.min}`;
        if (typeof f.max === "number" && n > f.max) return `${f.label}: максимум ${f.max}`;
      }
    }

    return null;
  };

  const onSave = async () => {
    const err = validate();
    if (err) return Alert.alert("Проверь форму", err);
    if (!activity) return;

    try {
      setSaving(true);

      const metrics = numberFields
        .map((f) => {
          const raw = (values[f.key] ?? "").trim();
          if (!raw) return null;
          const n = Number(raw);
          if (!Number.isFinite(n)) return null;
          return { key: f.key, value: n, unit: (f as any).unit ?? undefined };
        })
        .filter(Boolean) as { key: string; value: number; unit?: string }[];

      const durNum = durationMin.trim() ? minToSec(durationMin.trim()) : undefined;

      const body = {
        startedAt: startedAtIso,
        durationSec: durNum,
        notes: notes.trim() || undefined,
        metrics,
      };

      const res = await api.put(`/workouts/${workoutId}`, body);
      const granted: string[] = res?.data?.grantedAchievements ?? [];

      if (granted.length > 0) {
        try {
          const all = await getAchievements();
          const map = new Map((all.items ?? []).map((a: any) => [a.code, a.title]));
          setGrantedTitles(granted.map((c) => map.get(c) ?? c));
        } catch {
          setGrantedTitles(granted);
        }

        setToastVisible(true);
        setConfettiOn(true);
        setTimeout(() => setConfettiOn(false), 1600);
      } else {
        navigation.goBack();
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? "Не удалось сохранить изменения";
      Alert.alert("Ошибка", String(msg));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    Alert.alert(
      "Удалить тренировку?",
      "Действие необратимо. Тренировка исчезнет из истории и аналитики.",
      [
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
              const msg =
                e?.response?.data?.message ?? e?.message ?? "Не удалось удалить тренировку";
              Alert.alert("Ошибка", String(msg));
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: palette.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load("refresh")}
            tintColor={palette.primary}
          />
        }
      >
        <View style={{ marginBottom: 12 }}>
          <Text style={[styles.pageTitle, { color: palette.text }]}>Редактировать</Text>
          <Text style={[styles.pageSubtitle, { color: palette.subtext }]}>
            {activity ? `${activity.name} • ${activity.code}` : loading ? "Загрузка…" : "—"}
          </Text>
        </View>

        {/* Основное */}
        <View style={[styles.section, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Основное</Text>
          <Text style={[styles.sectionSubtitle, { color: palette.subtext }]}>
            Дата, длительность и заметки
          </Text>

          <View style={{ marginTop: 12 }}>
            <Text style={[styles.label, { color: palette.subtext }]}>Дата и время</Text>
            <View style={[styles.readonlyRow, { backgroundColor: palette.inputBg, borderColor: palette.border }]}>
              <Text style={[styles.readonlyText, { color: palette.text }]}>{formatLocalShort(startedAtIso)}</Text>
              <Pressable
                onPress={() => setStartedAtIso(isoNow())}
                style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]}
              >
                <Text style={[styles.readonlyAction, { color: palette.primary }]}>сейчас</Text>
              </Pressable>
            </View>

            <Text style={[styles.label, { color: palette.subtext, marginTop: 12 }]}>Длительность (мин)</Text>
            <TextInput
              value={durationMin}
              onChangeText={(v) => setDurationMin(clampNumStr(v))}
              placeholder="например 45"
              placeholderTextColor={palette.subtext}
              keyboardType="numeric"
              style={[
                styles.input,
                { backgroundColor: palette.inputBg, borderColor: palette.border, color: palette.text },
              ]}
            />

            <Text style={[styles.label, { color: palette.subtext, marginTop: 12 }]}>Заметки</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="как прошло, самочувствие, что заметил…"
              placeholderTextColor={palette.subtext}
              multiline
              style={[
                styles.textarea,
                { backgroundColor: palette.inputBg, borderColor: palette.border, color: palette.text },
              ]}
            />
          </View>
        </View>

        {/* Метрики */}
        <View style={[styles.section, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Метрики</Text>
          <Text style={[styles.sectionSubtitle, { color: palette.subtext }]}>
            Числовые параметры выбранной активности
          </Text>

          <View style={{ marginTop: 12 }}>
            {loading ? (
              <Text style={{ color: palette.subtext, fontWeight: "800" }}>Загрузка…</Text>
            ) : numberFields.length === 0 ? (
              <View style={[styles.emptyBox, { backgroundColor: palette.inputBg, borderColor: palette.border }]}>
                <Text style={[styles.emptyTitle, { color: palette.text }]}>Нет метрик</Text>
                <Text style={[styles.emptySub, { color: palette.subtext }]}>
                  Для этой активности не задано числовых параметров.
                </Text>
              </View>
            ) : (
              numberFields.map((f) => (
                <NumberField
                  key={f.key}
                  label={f.label}
                  unit={(f as any).unit}
                  required={f.required}
                  value={values[f.key] ?? ""}
                  onChange={(v) => setValues((p) => ({ ...p, [f.key]: v }))}
                  palette={palette}
                />
              ))
            )}
          </View>
        </View>

        <PrimaryButton
          title={saving ? "Сохраняю…" : "Сохранить изменения"}
          subtitle="История и аналитика обновятся"
          onPress={onSave}
          palette={palette}
          loading={saving}
          disabled={saving || loading}
        />

        <View style={{ height: 10 }} />

        <DangerButton title="Удалить тренировку" onPress={onDelete} palette={palette} loading={deleting} />

        <View style={{ height: 18 }} />
      </ScrollView>

      {/* Success modal */}
      <Modal visible={toastVisible} transparent animationType="fade" onRequestClose={() => setToastVisible(false)}>
        <View style={styles.toastOverlay}>
          <View style={[styles.toastCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <ConfettiBurst show={confettiOn} />
            <View style={[styles.toastGlow, { backgroundColor: "rgba(45,107,255,0.16)" }]} />
            <View style={[styles.toastGlow2, { backgroundColor: "rgba(124,240,141,0.12)" }]} />

            <Text style={[styles.toastTitle, { color: palette.text }]}>🎉 Новое достижение!</Text>
            <Text style={[styles.toastSubtitle, { color: palette.subtext }]}>
              Ты открыл{grantedTitles.length > 1 ? " сразу несколько" : ""}{" "}
              бейдж{grantedTitles.length > 1 ? "ей" : ""}.
            </Text>

            <View style={{ marginTop: 12, gap: 8 }}>
              {grantedTitles.map((t) => (
                <View key={t} style={[styles.toastPill, { backgroundColor: palette.inputBg, borderColor: palette.border }]}>
                  <Text style={[styles.toastPillText, { color: palette.text }]} numberOfLines={1}>
                    {t}
                  </Text>
                </View>
              ))}
            </View>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
              <Pressable
                onPress={() => {
                  setToastVisible(false);
                  navigation.goBack();
                }}
                style={[styles.toastBtn, { backgroundColor: palette.inputBg, borderColor: palette.border }]}
              >
                <Text style={[styles.toastBtnText, { color: palette.text }]}>Ок</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setToastVisible(false);
                  navigation.navigate("Achievements");
                }}
                style={[styles.toastBtn, { backgroundColor: palette.primary, borderColor: "transparent" }]}
              >
                <Text style={[styles.toastBtnText, { color: "#fff" }]}>Достижения</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, paddingTop: 18, paddingBottom: 24 },

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
  sectionSubtitle: { marginTop: 4, fontSize: 12.5, fontWeight: "700" },

  label: { fontSize: 12.5, fontWeight: "800", marginBottom: 6 },

  input: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    fontSize: 15.5,
    fontWeight: "800",
  },
  textarea: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: "800",
    minHeight: 96,
    textAlignVertical: "top",
  },

  readonlyRow: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  readonlyText: { fontSize: 15.5, fontWeight: "900" },
  readonlyAction: { fontSize: 13.5, fontWeight: "900" },

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

  dangerBtn: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dangerBtnText: { fontSize: 13.5, fontWeight: "900" },

  emptyBox: { borderRadius: 16, borderWidth: 1, padding: 12 },
  emptyTitle: { fontSize: 13.5, fontWeight: "900" },
  emptySub: { marginTop: 4, fontSize: 12.5, fontWeight: "700", lineHeight: 18 },

  toastOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  toastCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    overflow: "hidden",
    ...(Platform.OS === "ios"
      ? { shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 12 } }
      : { elevation: 4 }),
  },

  toastGlow: { position: "absolute", top: -90, left: -60, width: 200, height: 200, borderRadius: 100 },
  toastGlow2: { position: "absolute", top: -110, right: -90, width: 240, height: 240, borderRadius: 120 },

  toastTitle: { fontSize: 16, fontWeight: "900" },
  toastSubtitle: { marginTop: 6, fontSize: 12.5, fontWeight: "700", lineHeight: 18 },

  toastPill: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  toastPillText: { fontSize: 13.5, fontWeight: "900" },

  toastBtn: { flex: 1, borderRadius: 14, borderWidth: 1, paddingVertical: 12, alignItems: "center" },
  toastBtnText: { fontSize: 14, fontWeight: "900" },

  confettiLayer: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
});