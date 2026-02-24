// mobile/src/screens/AddWorkoutScreen.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";

import { api } from "../api/client";
import { getAchievements } from "../api/achievementsApi";

type Field =
  | {
      key: string;
      label: string;
      type: "number";
      min?: number;
      max?: number;
      step?: number;
      unit?: string;
      placeholder?: string;
      required?: boolean;
    }
  | {
      key: string;
      label: string;
      type: "text";
      placeholder?: string;
      required?: boolean;
    }
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
    border: isDark ? "rgba(255,255,255,0.08)" : "rgba(16,24,40,0.08)",
    primary: "#2D6BFF",
    danger: "#E5484D",
    inputBg: isDark ? "rgba(255,255,255,0.06)" : "#F2F4F7",
    chipBg: isDark ? "rgba(255,255,255,0.06)" : "#EEF2F6",
    successBg: isDark ? "rgba(46,125,50,0.18)" : "rgba(46,125,50,0.12)",
    successText: isDark ? "#7CF08D" : "#1F7A2E",
  };
}

function clampNumStr(value: string) {
  return value.replace(/[^\d.,-]/g, "").replace(",", ".");
}

function isoNow() {
  return new Date().toISOString();
}

function formatLocal(dtIso: string) {
  const d = new Date(dtIso);
  if (Number.isNaN(d.getTime())) return dtIso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`;
}

function Card({
  title,
  subtitle,
  right,
  onPress,
  palette,
  active,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  palette: ReturnType<typeof makePalette>;
  active?: boolean;
}) {
  const body = (
    <View
      style={[
        styles.card,
        {
          backgroundColor: palette.card,
          borderColor: active ? "rgba(45,107,255,0.55)" : palette.border,
        },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={[styles.cardTitle, { color: palette.text }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[styles.cardSubtitle, { color: palette.subtext }]}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? (
        <Text style={[styles.chevron, { color: palette.subtext }]}>{"›"}</Text>
      )}
    </View>
  );

  if (!onPress) return body;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{ opacity: pressed ? 0.88 : 1 }]}
    >
      {body}
    </Pressable>
  );
}

function Pill({
  text,
  palette,
}: {
  text: string;
  palette: ReturnType<typeof makePalette>;
}) {
  return (
    <View
      style={[
        styles.pill,
        {
          borderColor: palette.border,
          backgroundColor: "rgba(45,107,255,0.12)",
        },
      ]}
    >
      <Text style={[styles.pillText, { color: palette.primary }]}>{text}</Text>
    </View>
  );
}

function FieldInput({
  field,
  value,
  onChange,
  palette,
}: {
  field: Field;
  value: string;
  onChange: (v: string) => void;
  palette: ReturnType<typeof makePalette>;
}) {
  if (field.type === "select") {
    return (
      <View style={{ marginBottom: 12 }}>
        <Text style={[styles.label, { color: palette.subtext }]}>
          {field.label}
          {field.required ? (
            <Text style={{ color: palette.danger }}> *</Text>
          ) : null}
        </Text>

        <View style={styles.chipRow}>
          {field.options.map((opt) => {
            const active = value === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => onChange(opt.value)}
                style={[
                  styles.chip,
                  {
                    borderColor: active ? palette.primary : palette.border,
                    backgroundColor: active
                      ? "rgba(45,107,255,0.14)"
                      : palette.chipBg,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: active ? palette.primary : palette.text },
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  const keyboardType = field.type === "number" ? "numeric" : "default";
  const placeholder = field.placeholder ?? "";

  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={[styles.label, { color: palette.subtext }]}>
        {field.label}
        {field.unit ? ` (${field.unit})` : ""}
        {field.required ? (
          <Text style={{ color: palette.danger }}> *</Text>
        ) : null}
      </Text>

      <TextInput
        value={value}
        onChangeText={(v) =>
          onChange(field.type === "number" ? clampNumStr(v) : v)
        }
        placeholder={placeholder}
        placeholderTextColor={palette.subtext}
        keyboardType={keyboardType as any}
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

/**
 * Конфетти без библиотек:
 * набор кусочков, которые разлетаются вниз + вращение + fade out
 */
function ConfettiBurst({ show }: { show: boolean }) {
  const { width } = Dimensions.get("window");
  const pieces = useRef(
    Array.from({ length: 26 }).map((_, idx) => {
      const x = Math.random() * (Math.min(width, 420) - 40) + 20; // внутри карточки
      const size = 6 + Math.random() * 8;
      const delay = Math.random() * 260;
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
    }),
  ).current;

  useEffect(() => {
    if (!show) return;

    pieces.forEach((p) => {
      p.y.setValue(-30);
      p.r.setValue(0);
      p.o.setValue(0);

      Animated.parallel([
        Animated.timing(p.o, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(p.delay),
          Animated.timing(p.y, {
            toValue: p.fall,
            duration: 1200,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.delay(p.delay),
          Animated.timing(p.r, {
            toValue: 1,
            duration: 1200,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.delay(p.delay + 760),
          Animated.timing(p.o, {
            toValue: 0,
            duration: 520,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    });
  }, [show, pieces]);

  // цвета под “конфетти”
  const colors = [
    "#2D6BFF",
    "#7CF08D",
    "#FFD166",
    "#EF476F",
    "#06D6A0",
    "#8B5CF6",
  ];

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

export default function AddWorkoutScreen({ navigation, route }: any) {
  const scheme = useColorScheme();
  const palette = useMemo(() => makePalette(scheme === "dark"), [scheme]);
  const prefill = route?.params?.prefill ?? null;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [items, setItems] = useState<ActivityType[]>([]);
  const itemsRef = useRef<ActivityType[]>([]);
  const [selected, setSelected] = useState<ActivityType | null>(null);

  const [startedAtIso, setStartedAtIso] = useState<string>(isoNow());
  const [durationSec, setDurationSec] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const [values, setValues] = useState<Record<string, string>>({});
  const fields = (selected?.fieldsSchema?.fields ?? []) as Field[];

  const [toastVisible, setToastVisible] = useState(false);
  const [grantedTitles, setGrantedTitles] = useState<string[]>([]);
  const [confettiOn, setConfettiOn] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/activities");
      const list: ActivityType[] = res?.data?.items ?? [];
      setItems(list);
      itemsRef.current = list;
    } catch (e: any) {
      Alert.alert("Ошибка", e?.message ?? "Не удалось загрузить активности");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await load();

      if (prefill) {
        const act = (itemsRef.current ?? []).find(
          (a) => a.id === prefill.activityTypeId,
        );
        if (act) {
          setSelected(act);

          const next: Record<string, string> = {};
          (act.fieldsSchema?.fields ?? []).forEach(
            (f: any) => (next[f.key] = ""),
          );

          (prefill.metrics ?? []).forEach((m: any) => {
            next[m.metricKey] = String(m.valueNum);
          });

          setValues(next);
          setDurationSec(
            prefill.durationSec != null ? String(prefill.durationSec) : "",
          );
          setNotes(prefill.notes ?? "");
          setStartedAtIso(isoNow());
        }

        navigation.setParams({ prefill: null });
      }
    })().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill]);

  const initFormForActivity = (a: ActivityType) => {
    const next: Record<string, string> = {};
    (a.fieldsSchema?.fields ?? []).forEach((f: any) => {
      next[f.key] = "";
    });
    setValues(next);
  };

  const onPick = (a: ActivityType) => {
    setSelected(a);
    initFormForActivity(a);
    setStartedAtIso(isoNow());
    setDurationSec("");
    setNotes("");
  };

  const onBackToList = () => {
    setSelected(null);
    setValues({});
    setDurationSec("");
    setNotes("");
  };

  const clearInputsKeepActivity = () => {
    if (selected) initFormForActivity(selected);
    setStartedAtIso(isoNow());
    setDurationSec("");
    setNotes("");
  };

  const setField = (key: string, v: string) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  const validate = () => {
    if (!selected) return "Не выбрана активность";

    const startedAt = new Date(startedAtIso);
    if (Number.isNaN(startedAt.getTime())) return "Дата/время некорректны";

    const dur = durationSec.trim();
    if (dur) {
      const n = Number(dur);
      if (Number.isNaN(n) || n < 0)
        return "Длительность должна быть числом (секунды)";
    }

    for (const f of fields) {
      const v = (values[f.key] ?? "").trim();

      if (f.required && !v) return `${f.label}: обязательное поле`;

      if (f.type === "number" && v) {
        const n = Number(v);
        if (Number.isNaN(n)) return `${f.label}: должно быть числом`;
        if (typeof f.min === "number" && n < f.min)
          return `${f.label}: минимум ${f.min}`;
        if (typeof f.max === "number" && n > f.max)
          return `${f.label}: максимум ${f.max}`;
      }

      if (f.type === "select" && f.required && !v)
        return `${f.label}: выбери значение`;
    }

    return null;
  };

  const onSave = async () => {
    const err = validate();
    if (err) return Alert.alert("Проверь форму", err);
    if (!selected) return;

    try {
      setSaving(true);

      const metrics = fields
        .filter((f) => f.type === "number")
        .map((f) => {
          const raw = (values[f.key] ?? "").trim();
          if (!raw) return null;
          const n = Number(raw);
          if (!Number.isFinite(n)) return null;
          return { key: f.key, value: n, unit: (f as any).unit ?? undefined };
        })
        .filter(Boolean) as { key: string; value: number; unit?: string }[];

      const dur = durationSec.trim();
      const durNum = dur ? Number(dur) : undefined;

      const body = {
        activityTypeId: selected.id,
        startedAt: startedAtIso,
        durationSec: durNum,
        notes: notes.trim() || undefined,
        metrics,
      };

      const res = await api.post("/workouts", body);
      const granted: string[] = res?.data?.grantedAchievements ?? [];

      clearInputsKeepActivity();

      if (granted.length > 0) {
        try {
          const all = await getAchievements();
          const map = new Map(
            (all.items ?? []).map((a: any) => [a.code, a.title]),
          );
          const titles = granted.map((c) => map.get(c) ?? c);
          setGrantedTitles(titles);
        } catch {
          setGrantedTitles(granted);
        }

        setToastVisible(true);
        setConfettiOn(true);
        // выключим конфетти чуть раньше закрытия/сброса
        setTimeout(() => setConfettiOn(false), 1600);
      } else {
      }
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ??
        e?.message ??
        "Не удалось сохранить тренировку";
      Alert.alert("Ошибка", String(msg));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: palette.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ marginBottom: 12 }}>
          <Text style={[styles.pageTitle, { color: palette.text }]}>
            Добавить тренировку
          </Text>
          <Text style={[styles.pageSubtitle, { color: palette.subtext }]}>
            Быстрое добавление: выбери активность и заполни параметры.
          </Text>
        </View>

        {!selected ? (
          <>
            <View
              style={[
                styles.section,
                { backgroundColor: palette.card, borderColor: palette.border },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: palette.text }]}>
                Виды активности
              </Text>
              <Text
                style={[styles.sectionSubtitle, { color: palette.subtext }]}
              >
                {loading
                  ? "Загружаю…"
                  : "Нажми на вид спорта, чтобы заполнить тренировку."}
              </Text>
            </View>

            <View style={{ gap: 10 }}>
              {items.map((a) => {
                const count = a.fieldsSchema?.fields?.length ?? 0;
                return (
                  <Card
                    key={a.id}
                    title={a.name}
                    subtitle={`${a.code} • полей: ${count}`}
                    palette={palette}
                    onPress={() => onPick(a)}
                  />
                );
              })}
            </View>
          </>
        ) : (
          <>
            <View
              style={[
                styles.section,
                {
                  backgroundColor: palette.card,
                  borderColor: palette.border,
                  paddingBottom: 12,
                },
              ]}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sectionTitle, { color: palette.text }]}>
                    {selected.name}
                  </Text>
                  <Text
                    style={[styles.sectionSubtitle, { color: palette.subtext }]}
                  >
                    Заполни параметры тренировки
                  </Text>
                </View>
                <Pill text={selected.code} palette={palette} />
              </View>

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  marginTop: 10,
                }}
              >
                <Pressable
                  onPress={onBackToList}
                  style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                >
                  <Text style={[styles.link, { color: palette.primary }]}>
                    ← выбрать другую
                  </Text>
                </Pressable>

                <Pressable
                  onPress={clearInputsKeepActivity}
                  style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                >
                  <Text style={[styles.link, { color: palette.subtext }]}>
                    сбросить поля
                  </Text>
                </Pressable>
              </View>
            </View>

            <View
              style={[
                styles.section,
                { backgroundColor: palette.card, borderColor: palette.border },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: palette.text }]}>
                Основное
              </Text>
              <Text
                style={[styles.sectionSubtitle, { color: palette.subtext }]}
              >
                Дата/время и заметки
              </Text>

              <View style={{ marginTop: 12 }}>
                <Text style={[styles.label, { color: palette.subtext }]}>
                  Дата и время
                </Text>
                <View
                  style={[
                    styles.readonlyRow,
                    {
                      backgroundColor: palette.inputBg,
                      borderColor: palette.border,
                    },
                  ]}
                >
                  <Text style={[styles.readonlyText, { color: palette.text }]}>
                    {formatLocal(startedAtIso)}
                  </Text>
                  <Pressable
                    onPress={() => setStartedAtIso(isoNow())}
                    style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]}
                  >
                    <Text
                      style={[
                        styles.readonlyAction,
                        { color: palette.primary },
                      ]}
                    >
                      сейчас
                    </Text>
                  </Pressable>
                </View>

                <Text
                  style={[
                    styles.label,
                    { color: palette.subtext, marginTop: 12 },
                  ]}
                >
                  Длительность (сек)
                </Text>
                <TextInput
                  value={durationSec}
                  onChangeText={(v) => setDurationSec(clampNumStr(v))}
                  placeholder="например 3600"
                  placeholderTextColor={palette.subtext}
                  keyboardType="numeric"
                  style={[
                    styles.input,
                    {
                      backgroundColor: palette.inputBg,
                      borderColor: palette.border,
                      color: palette.text,
                    },
                  ]}
                />

                <Text
                  style={[
                    styles.label,
                    { color: palette.subtext, marginTop: 12 },
                  ]}
                >
                  Заметки
                </Text>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="как прошло, самочувствие, что заметил…"
                  placeholderTextColor={palette.subtext}
                  multiline
                  style={[
                    styles.textarea,
                    {
                      backgroundColor: palette.inputBg,
                      borderColor: palette.border,
                      color: palette.text,
                    },
                  ]}
                />
              </View>
            </View>

            <View
              style={[
                styles.section,
                { backgroundColor: palette.card, borderColor: palette.border },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: palette.text }]}>
                Параметры
              </Text>
              <Text
                style={[styles.sectionSubtitle, { color: palette.subtext }]}
              >
                Поля берутся из schema активности
              </Text>

              <View style={{ marginTop: 12 }}>
                {fields.length === 0 ? (
                  <Text style={{ color: palette.subtext, fontWeight: "700" }}>
                    Для этой активности нет полей schema.
                  </Text>
                ) : (
                  fields.map((f) => (
                    <FieldInput
                      key={f.key}
                      field={f}
                      value={values[f.key] ?? ""}
                      onChange={(v) => setField(f.key, v)}
                      palette={palette}
                    />
                  ))
                )}
              </View>
            </View>

            <Pressable
              onPress={onSave}
              disabled={saving}
              style={({ pressed }) => [
                styles.primaryBtn,
                {
                  backgroundColor: palette.primary,
                  opacity: saving ? 0.65 : pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text style={styles.primaryBtnText}>
                {saving ? "Сохраняю…" : "Сохранить тренировку"}
              </Text>
            </Pressable>

            <View
              style={[
                styles.successHint,
                {
                  backgroundColor: palette.successBg,
                  borderColor: palette.border,
                },
              ]}
            >
              <Text
                style={[styles.successHintText, { color: palette.successText }]}
              >
                После сохранения поля очистятся, а активность останется
                выбранной — удобно для быстрого ввода.
              </Text>
            </View>

            <View style={{ height: 18 }} />
          </>
        )}
      </ScrollView>

      {/* Toast modal + confetti */}
      <Modal
        visible={toastVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setToastVisible(false)}
      >
        <View style={styles.toastOverlay}>
          <View
            style={[
              styles.toastCard,
              { backgroundColor: palette.card, borderColor: palette.border },
            ]}
          >
            {/* Конфетти поверх карточки */}
            <ConfettiBurst show={confettiOn} />

            {/* glow */}
            <View
              style={[
                styles.toastGlow,
                { backgroundColor: "rgba(45,107,255,0.16)" },
              ]}
            />
            <View
              style={[
                styles.toastGlow2,
                { backgroundColor: "rgba(124,240,141,0.12)" },
              ]}
            />

            <Text style={[styles.toastTitle, { color: palette.text }]}>
              🎉 Новое достижение!
            </Text>
            <Text style={[styles.toastSubtitle, { color: palette.subtext }]}>
              Ты открыл{grantedTitles.length > 1 ? " сразу несколько" : ""}{" "}
              бейдж{grantedTitles.length > 1 ? "ей" : ""}.
            </Text>

            <View style={{ marginTop: 12, gap: 8 }}>
              {grantedTitles.map((t) => (
                <View
                  key={t}
                  style={[
                    styles.toastPill,
                    {
                      backgroundColor: palette.inputBg,
                      borderColor: palette.border,
                    },
                  ]}
                >
                  <Text
                    style={[styles.toastPillText, { color: palette.text }]}
                    numberOfLines={1}
                  >
                    {t}
                  </Text>
                </View>
              ))}
            </View>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
              <Pressable
                onPress={() => setToastVisible(false)}
                style={[
                  styles.toastBtn,
                  {
                    backgroundColor: palette.inputBg,
                    borderColor: palette.border,
                  },
                ]}
              >
                <Text style={[styles.toastBtnText, { color: palette.text }]}>
                  Ок
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setToastVisible(false);
                  navigation?.navigate?.("Achievements");
                }}
                style={[
                  styles.toastBtn,
                  {
                    backgroundColor: palette.primary,
                    borderColor: "transparent",
                  },
                ]}
              >
                <Text style={[styles.toastBtnText, { color: "#fff" }]}>
                  Открыть
                </Text>
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
  content: { padding: 16, paddingTop: 18 },

  pageTitle: { fontSize: 22, fontWeight: "900" },
  pageSubtitle: { marginTop: 6, fontSize: 13, fontWeight: "700" },

  section: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
    ...(Platform.OS === "ios"
      ? {
          shadowColor: "#000",
          shadowOpacity: 0.06,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 8 },
        }
      : { elevation: 1 }),
  },
  sectionTitle: { fontSize: 15.5, fontWeight: "900" },
  sectionSubtitle: { marginTop: 4, fontSize: 12.5, fontWeight: "700" },

  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    ...(Platform.OS === "ios"
      ? {
          shadowColor: "#000",
          shadowOpacity: 0.06,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 8 },
        }
      : { elevation: 1 }),
  },
  cardTitle: { fontSize: 15.5, fontWeight: "900" },
  cardSubtitle: { marginTop: 4, fontSize: 12.5, fontWeight: "700" },
  chevron: { marginLeft: 12, fontSize: 22, fontWeight: "900" },

  pill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pillText: { fontSize: 12, fontWeight: "900" },

  link: { fontSize: 13.5, fontWeight: "900" },

  label: { fontSize: 12.5, fontWeight: "800", marginBottom: 6 },

  input: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    fontSize: 15.5,
    fontWeight: "700",
  },

  textarea: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: "700",
    minHeight: 92,
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
  readonlyText: { fontSize: 15.5, fontWeight: "800" },
  readonlyAction: { fontSize: 13.5, fontWeight: "900" },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 },
  chip: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  chipText: { fontSize: 13, fontWeight: "800" },

  primaryBtn: { borderRadius: 16, paddingVertical: 14, alignItems: "center" },
  primaryBtnText: { color: "#fff", fontSize: 15.5, fontWeight: "900" },

  successHint: { marginTop: 10, borderRadius: 16, borderWidth: 1, padding: 12 },
  successHintText: { fontSize: 12.5, fontWeight: "800", lineHeight: 18 },

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
      ? {
          shadowColor: "#000",
          shadowOpacity: 0.18,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 12 },
        }
      : { elevation: 4 }),
  },

  toastGlow: {
    position: "absolute",
    top: -90,
    left: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  toastGlow2: {
    position: "absolute",
    top: -110,
    right: -90,
    width: 240,
    height: 240,
    borderRadius: 120,
  },

  toastTitle: { fontSize: 16, fontWeight: "900" },
  toastSubtitle: {
    marginTop: 6,
    fontSize: 12.5,
    fontWeight: "700",
    lineHeight: 18,
  },

  toastPill: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  toastPillText: { fontSize: 13.5, fontWeight: "900" },

  toastBtn: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  toastBtnText: { fontSize: 14, fontWeight: "900" },

  confettiLayer: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
});
