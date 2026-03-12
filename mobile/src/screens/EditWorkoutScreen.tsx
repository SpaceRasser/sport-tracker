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
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
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
  danger: "#E5484D",
  dangerSoft: "rgba(229,72,77,0.10)",
};

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
  disabled,
}: {
  title: string;
  subtitle?: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.primaryButtonWrap,
        { opacity: disabled || loading ? 0.58 : pressed ? 0.9 : 1 },
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
            <Ionicons name="save-outline" size={18} color={palette.purpleDark} />
          )}
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.primaryButtonTitle}>{title}</Text>
          {subtitle ? <Text style={styles.primaryButtonSub}>{subtitle}</Text> : null}
        </View>
      </LinearGradient>
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
        { opacity: loading ? 0.58 : pressed ? 0.9 : 1 },
      ]}
    >
      <MaterialCommunityIcons name="trash-can-outline" size={18} color={palette.danger} />
      <Text style={styles.dangerButtonText}>{title}</Text>
      {loading ? <ActivityIndicator color={palette.danger} /> : null}
    </Pressable>
  );
}

function NumberField({
  label,
  unit,
  value,
  onChange,
  required,
}: {
  label: string;
  unit?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>
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
        style={styles.input}
      />
    </View>
  );
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

export default function EditWorkoutScreen({ route, navigation }: any) {
  const { workoutId } = route.params as { workoutId: string };

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [activity, setActivity] = useState<ActivityType | null>(null);

  const [startedAtIso, setStartedAtIso] = useState<string>(isoNow());
  const [durationMin, setDurationMin] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const [values, setValues] = useState<Record<string, string>>({});
  const fields = (activity?.fieldsSchema?.fields ?? []) as Field[];
  const numberFields = fields.filter((f) => f.type === "number") as Extract<Field, { type: "number" }>[];

  const [toastVisible, setToastVisible] = useState(false);
  const [grantedTitles, setGrantedTitles] = useState<string[]>([]);
  const [confettiOn, setConfettiOn] = useState(false);

  const load = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (mode === "initial") setLoading(true);
      if (mode === "refresh") setRefreshing(true);

      try {
        const [wRes, aRes] = await Promise.all([
          api.get(`/workouts/${workoutId}`),
          api.get("/activities"),
        ]);

        const w = wRes?.data?.workout;
        const list: ActivityType[] = aRes?.data?.items ?? [];

        if (!w) throw new Error("Тренировка не найдена");

        const act = list.find((x) => x.id === (w.activityTypeId ?? w.activityType?.id)) ?? null;
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
    },
    [navigation, workoutId]
  );

  useFocusEffect(
    useCallback(() => {
      load("initial");
    }, [load])
  );

  const validate = () => {
    const startedAt = new Date(startedAtIso);
    if (Number.isNaN(startedAt.getTime())) return "Дата и время некорректны";

    const dur = durationMin.trim();
    if (dur) {
      const n = Number(dur);
      if (Number.isNaN(n) || n < 0) return "Длительность должна быть числом в минутах";
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
    if (err) return Alert.alert("Проверьте форму", err);
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

  const requiredCount = numberFields.filter((f) => f.required).length;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar barStyle="dark-content" backgroundColor={palette.bg} />
      <LinearGradient colors={[palette.bg, palette.bg2]} style={StyleSheet.absoluteFill} />

      <View style={styles.blobTopRight} pointerEvents="none" />
      <View style={styles.blobLeft} pointerEvents="none" />
      <View style={styles.blobBottom} pointerEvents="none" />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load("refresh")}
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
          <Text style={styles.heroTitle}>Редактировать</Text>
          <Text style={styles.heroSubtitle}>
            {activity ? `${activity.name} • ${activity.code}` : loading ? "Загрузка…" : "—"}
          </Text>

          <View style={styles.heroMiniRow}>
            <View style={styles.heroMiniPill}>
              <Ionicons name="calendar-outline" size={14} color={palette.purple} />
              <Text style={styles.heroMiniPillText}>{formatLocalShort(startedAtIso)}</Text>
            </View>

            {activity ? (
              <View style={styles.heroMiniPill}>
                <Ionicons name="fitness-outline" size={14} color={palette.purple} />
                <Text style={styles.heroMiniPillText}>{activity.code}</Text>
              </View>
            ) : null}
          </View>
        </LinearGradient>

        <View style={styles.statsRow}>
          <SummaryStat
            value={activity ? String(numberFields.length) : "—"}
            label="метрик"
            tint="rgba(124,231,255,0.28)"
            icon={<Ionicons name="stats-chart-outline" size={18} color={palette.purple} />}
          />
          <SummaryStat
            value={activity ? String(requiredCount) : "—"}
            label="обязательных"
            tint="rgba(255,179,107,0.28)"
            icon={<Ionicons name="checkmark-circle-outline" size={18} color={palette.purple} />}
          />
          <SummaryStat
            value={notes.trim() ? "Да" : "Нет"}
            label="заметки"
            tint="rgba(255,141,216,0.28)"
            icon={<Ionicons name="document-text-outline" size={18} color={palette.purple} />}
          />
        </View>

        <View style={styles.mainCard}>
          <Text style={styles.sectionKicker}>ОБЗОР</Text>
          <Text style={styles.sectionTitle}>Редактирование тренировки</Text>
          <Text style={styles.sectionDescription}>
            Измените дату, длительность, заметки и числовые показатели выбранной активности.
          </Text>

          <View style={styles.badgesRow}>
            <InfoBadge
              icon={<Ionicons name="time-outline" size={14} color={palette.purple} />}
              label="Дата"
            />
            <InfoBadge
              icon={<Ionicons name="stats-chart-outline" size={14} color={palette.purple} />}
              label="Метрики"
            />
            <InfoBadge
              icon={<Ionicons name="create-outline" size={14} color={palette.purple} />}
              label="Изменения"
            />
          </View>
        </View>

        <View style={styles.mainCard}>
          <Text style={styles.sectionKicker}>ОСНОВНОЕ</Text>
          <Text style={styles.sectionTitle}>Дата и заметки</Text>
          <Text style={styles.sectionDescription}>
            Здесь можно быстро обновить время тренировки, её длительность и комментарий.
          </Text>

          <Text style={styles.label}>Дата и время</Text>
          <View style={styles.readonlyRow}>
            <Text style={styles.readonlyText}>{formatLocalShort(startedAtIso)}</Text>
            <Pressable
              onPress={() => setStartedAtIso(isoNow())}
              style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
            >
              <Text style={styles.readonlyAction}>сейчас</Text>
            </Pressable>
          </View>

          <Text style={[styles.label, { marginTop: 12 }]}>Длительность (мин)</Text>
          <TextInput
            value={durationMin}
            onChangeText={(v) => setDurationMin(clampNumStr(v))}
            placeholder="например 45"
            placeholderTextColor={palette.subtext}
            keyboardType="numeric"
            style={styles.input}
          />

          <Text style={[styles.label, { marginTop: 12 }]}>Заметки</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Как прошло, самочувствие, что заметили…"
            placeholderTextColor={palette.subtext}
            multiline
            style={styles.textarea}
          />
        </View>

        <View style={styles.mainCard}>
          <Text style={styles.sectionKicker}>МЕТРИКИ</Text>
          <Text style={styles.sectionTitle}>Показатели</Text>
          <Text style={styles.sectionDescription}>
            Отредактируйте числовые значения, связанные с этой активностью.
          </Text>

          <View style={{ marginTop: 4 }}>
            {loading ? (
              <Text style={styles.loadingText}>Загрузка…</Text>
            ) : numberFields.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>Нет метрик</Text>
                <Text style={styles.emptySub}>
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
                />
              ))
            )}
          </View>
        </View>

        <PrimaryButton
          title={saving ? "Сохраняем…" : "Сохранить изменения"}
          subtitle="История и аналитика обновятся"
          onPress={onSave}
          loading={saving}
          disabled={saving || loading}
        />

        <View style={{ height: 10 }} />

        <DangerButton
          title={deleting ? "Удаляем…" : "Удалить тренировку"}
          onPress={onDelete}
          loading={deleting}
        />

        <View style={{ height: 18 }} />
      </ScrollView>

      <Modal visible={toastVisible} transparent animationType="fade" onRequestClose={() => setToastVisible(false)}>
        <View style={styles.toastOverlay}>
          <View style={styles.toastCard}>
            <ConfettiBurst show={confettiOn} />

            <View style={styles.toastGlow} />
            <View style={styles.toastGlow2} />

            <Text style={styles.toastTitle}>🎉 Новое достижение!</Text>
            <Text style={styles.toastSubtitle}>
              Вы открыли{grantedTitles.length > 1 ? " сразу несколько" : ""} бейдж
              {grantedTitles.length > 1 ? "ей" : ""}.
            </Text>

            <View style={{ marginTop: 12, gap: 8 }}>
              {grantedTitles.map((t) => (
                <View key={t} style={styles.toastPill}>
                  <Text style={styles.toastPillText} numberOfLines={1}>
                    {t}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.toastButtons}>
              <Pressable
                onPress={() => {
                  setToastVisible(false);
                  navigation.goBack();
                }}
                style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1, flex: 1 }]}
              >
                <View style={styles.toastSecondaryBtn}>
                  <Text style={styles.toastSecondaryBtnText}>Ок</Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => {
                  setToastVisible(false);
                  navigation.navigate("Achievements");
                }}
                style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1, flex: 1 }]}
              >
                <LinearGradient
                  colors={[palette.purple, palette.purpleDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.toastPrimaryBtn}
                >
                  <Text style={styles.toastPrimaryBtnText}>Достижения</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
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

  label: {
    color: palette.subtext,
    fontSize: 12.5,
    fontWeight: "800",
    marginBottom: 6,
  },

  input: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.cardSoft,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    fontSize: 15.5,
    fontWeight: "800",
    color: palette.text,
  },

  textarea: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.cardSoft,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: "800",
    minHeight: 96,
    textAlignVertical: "top",
    color: palette.text,
  },

  readonlyRow: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.cardSoft,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  readonlyText: {
    color: palette.text,
    fontSize: 15.5,
    fontWeight: "900",
  },

  readonlyAction: {
    color: palette.purple,
    fontSize: 13.5,
    fontWeight: "900",
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

  primaryButtonTitle: {
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

  dangerButton: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(229,72,77,0.35)",
    backgroundColor: palette.dangerSoft,
    paddingVertical: 13,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },

  dangerButtonText: {
    color: palette.danger,
    fontSize: 13.8,
    fontWeight: "900",
  },

  loadingText: {
    color: palette.subtext,
    fontWeight: "800",
  },

  emptyBox: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 12,
    backgroundColor: palette.cardSoft,
  },

  emptyTitle: {
    color: palette.text,
    fontSize: 13.5,
    fontWeight: "900",
  },

  emptySub: {
    color: palette.subtext,
    marginTop: 4,
    fontSize: 12.5,
    fontWeight: "700",
    lineHeight: 18,
  },

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
    borderRadius: 22,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 14,
    overflow: "hidden",
    backgroundColor: palette.card,
    ...(Platform.OS === "ios"
      ? { shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 12 } }
      : { elevation: 4 }),
  },

  toastGlow: {
    position: "absolute",
    top: -90,
    left: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(109,76,255,0.16)",
  },

  toastGlow2: {
    position: "absolute",
    top: -110,
    right: -90,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(36,168,101,0.12)",
  },

  toastTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: "900",
  },

  toastSubtitle: {
    color: palette.subtext,
    marginTop: 6,
    fontSize: 12.5,
    fontWeight: "700",
    lineHeight: 18,
  },

  toastPill: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: palette.cardSoft,
  },

  toastPillText: {
    color: palette.text,
    fontSize: 13.5,
    fontWeight: "900",
  },

  toastButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },

  toastSecondaryBtn: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.line,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: palette.cardSoft,
  },

  toastSecondaryBtnText: {
    color: palette.text,
    fontSize: 14,
    fontWeight: "900",
  },

  toastPrimaryBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },

  toastPrimaryBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900",
  },

  confettiLayer: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
});