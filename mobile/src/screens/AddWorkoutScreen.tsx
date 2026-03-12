import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  Dimensions,
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
import { useOnboarding } from "../onboarding/OnboardingContext";

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
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function minutesToSecondsStr(minStr: string) {
  const m = Number(minStr);
  if (!Number.isFinite(m) || m < 0) return undefined;
  return Math.round(m * 60);
}

function getAchievementCode(value: any): string {
  if (typeof value === "string") return value.trim();
  if (typeof value?.code === "string") return value.code.trim();
  if (typeof value?.achievementCode === "string")
    return value.achievementCode.trim();
  if (typeof value?.id === "string") return value.id.trim();
  return "";
}

function getAchievementLabel(value: any): string {
  if (typeof value?.title === "string" && value.title.trim())
    return value.title.trim();
  if (typeof value?.name === "string" && value.name.trim())
    return value.name.trim();
  if (typeof value?.label === "string" && value.label.trim())
    return value.label.trim();
  return "";
}

function resolveGrantedTitles(
  granted: any[],
  allAchievements?: any[],
): string[] {
  const labelMap = new Map<string, string>();

  for (const item of allAchievements ?? []) {
    const code = getAchievementCode(item);
    const label = getAchievementLabel(item) || code;
    if (code) {
      labelMap.set(code, label);
    }
  }

  return granted.map((item, index) => {
    const directLabel = getAchievementLabel(item);
    const code = getAchievementCode(item);

    const resolved =
      directLabel ||
      (code ? labelMap.get(code) : "") ||
      code ||
      `Новое достижение ${index + 1}`;

    return resolved.trim();
  });
}

function InfoBadge({ icon, label }: { icon: React.ReactNode; label: string }) {
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
      <View style={[styles.summaryStatIcon, { backgroundColor: tint }]}>
        {icon}
      </View>
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
            <Ionicons
              name="add-circle-outline"
              size={18}
              color={palette.purpleDark}
            />
          )}
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.primaryButtonTitle}>{title}</Text>
          {subtitle ? (
            <Text style={styles.primaryButtonSub}>{subtitle}</Text>
          ) : null}
        </View>
      </LinearGradient>
    </Pressable>
  );
}

function SecondaryButton({
  title,
  onPress,
}: {
  title: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1, flex: 1 }]}
    >
      <View style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonText}>{title}</Text>
      </View>
    </Pressable>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: string;
  onChange: (v: string) => void;
}) {
  if (field.type === "select") {
    return (
      <View style={{ marginBottom: 12 }}>
        <Text style={styles.label}>
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
                style={({ pressed }) => [
                  styles.chip,
                  {
                    borderColor: active ? palette.purple : palette.line,
                    backgroundColor: active ? palette.purple : palette.cardSoft,
                    opacity: pressed ? 0.88 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: active ? "#FFFFFF" : palette.text },
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

  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>
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
        placeholder={field.placeholder ?? ""}
        placeholderTextColor={palette.subtext}
        keyboardType={keyboardType as any}
        style={styles.input}
      />
    </View>
  );
}

function BottomSheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const { height } = Dimensions.get("window");

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.sheetRoot}>
        <Pressable style={styles.sheetOverlay} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              maxHeight: Math.min(680, Math.round(height * 0.84)),
            },
          ]}
        >
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={styles.sheetClose}>✕</Text>
            </Pressable>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

function CoachCard({
  title,
  text,
  primaryLabel = "Понятно",
  onNext,
  onSkip,
}: {
  title: string;
  text: string;
  primaryLabel?: string;
  onNext: () => void;
  onSkip?: () => void;
}) {
  return (
    <View style={styles.coachCard}>
      <LinearGradient
        colors={["rgba(109,76,255,0.14)", "rgba(123,97,255,0.08)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.coachHeader}>
        <View style={styles.coachIcon}>
          <Ionicons name="sparkles-outline" size={18} color={palette.purple} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.coachTitle}>{title}</Text>
          <Text style={styles.coachText}>{text}</Text>
        </View>
      </View>

      <View style={styles.coachActions}>
        {onSkip ? (
          <Pressable
            onPress={onSkip}
            style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1, flex: 1 }]}
          >
            <View style={styles.coachGhostBtn}>
              <Text style={styles.coachGhostBtnText}>Пропустить</Text>
            </View>
          </Pressable>
        ) : null}

        <Pressable
          onPress={onNext}
          style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1, flex: 1 }]}
        >
          <LinearGradient
            colors={[palette.purple, palette.purpleDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.coachPrimaryBtn}
          >
            <Text style={styles.coachPrimaryBtnText}>{primaryLabel}</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

export default function AddWorkoutScreen({ navigation, route }: any) {
  const { step, nextStep, skipOnboarding } = useOnboarding();

  const prefill = route?.params?.prefill ?? null;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [items, setItems] = useState<ActivityType[]>([]);
  const [selected, setSelected] = useState<ActivityType | null>(null);

  const [startedAtIso, setStartedAtIso] = useState<string>(isoNow());
  const [durationMin, setDurationMin] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [values, setValues] = useState<Record<string, string>>({});

  const fields = (selected?.fieldsSchema?.fields ?? []) as Field[];

  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [recentIds, setRecentIds] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);

  const [successOpen, setSuccessOpen] = useState(false);
  const [grantedTitles, setGrantedTitles] = useState<string[]>([]);

  const [coachStage, setCoachStage] = useState<0 | 1 | 2>(0);
  const [saveCoachHidden, setSaveCoachHidden] = useState(false);

  const isAddWorkoutOnboarding = step === "addWorkout";

  useEffect(() => {
    if (isAddWorkoutOnboarding) {
      setCoachStage(0);
      setSaveCoachHidden(false);
    }
  }, [isAddWorkoutOnboarding]);

  const initFormForActivity = useCallback((a: ActivityType) => {
    const next: Record<string, string> = {};
    (a.fieldsSchema?.fields ?? []).forEach((f: any) => {
      next[f.key] = "";
    });
    setValues(next);
  }, []);

  const applyPrefillIfAny = useCallback(
    (list: ActivityType[]) => {
      if (!prefill) return;
      const act = list.find((a) => a.id === prefill.activityTypeId);
      if (!act) return;

      setSelected(act);

      const next: Record<string, string> = {};
      (act.fieldsSchema?.fields ?? []).forEach((f: any) => {
        next[f.key] = "";
      });
      (prefill.metrics ?? []).forEach((m: any) => {
        next[m.metricKey] = String(m.valueNum);
      });

      setValues(next);

      if (prefill.durationSec != null) {
        setDurationMin(String(Math.round(Number(prefill.durationSec) / 60)));
      }

      setNotes(prefill.notes ?? "");
      setStartedAtIso(isoNow());

      navigation?.setParams?.({ prefill: null });
    },
    [navigation, prefill],
  );

  const load = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (mode === "initial") setLoading(true);
      if (mode === "refresh") setRefreshing(true);

      try {
        const res = await api.get("/activities");
        const list: ActivityType[] = res?.data?.items ?? [];
        setItems(list);
        applyPrefillIfAny(list);
      } catch (e: any) {
        Alert.alert("Ошибка", e?.message ?? "Не удалось загрузить активности");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [applyPrefillIfAny],
  );

  useFocusEffect(
    useCallback(() => {
      load("initial");
    }, [load]),
  );

  const pickActivity = (a: ActivityType) => {
    setSelected(a);
    initFormForActivity(a);
    setStartedAtIso(isoNow());
    setDurationMin("");
    setNotes("");
    setPickerOpen(false);

    setRecentIds((prev) => {
      const next = [a.id, ...prev.filter((x) => x !== a.id)];
      return next.slice(0, 6);
    });

    if (isAddWorkoutOnboarding) {
      setCoachStage(1);
    }
  };

  const setField = (key: string, v: string) => {
    setValues((prev) => ({ ...prev, [key]: v }));
  };

  const validate = () => {
    if (!selected) return "Выберите активность";

    const startedAt = new Date(startedAtIso);
    if (Number.isNaN(startedAt.getTime())) return "Дата и время некорректны";

    if (durationMin.trim()) {
      const n = Number(durationMin.trim());
      if (!Number.isFinite(n) || n < 0)
        return "Длительность должна быть числом в минутах";
      if (n > 24 * 60) return "Слишком большая длительность";
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

      if (f.type === "select" && f.required && !v) {
        return `${f.label}: выберите значение`;
      }
    }

    return null;
  };

  const clearInputsKeepActivity = () => {
    if (!selected) return;
    initFormForActivity(selected);
    setStartedAtIso(isoNow());
    setDurationMin("");
    setNotes("");
  };

  const onSave = async () => {
    const err = validate();
    if (err) {
      Alert.alert("Проверьте форму", err);
      return;
    }
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

      const durSec = minutesToSecondsStr(durationMin.trim());

      const body = {
        activityTypeId: selected.id,
        startedAt: startedAtIso,
        durationSec: durSec,
        notes: notes.trim() || undefined,
        metrics,
      };

      const res = await api.post("/workouts", body);
      const granted: any[] = Array.isArray(res?.data?.grantedAchievements)
        ? res.data.grantedAchievements
        : [];

      if (isAddWorkoutOnboarding) {
        nextStep();
      }

      clearInputsKeepActivity();

      if (granted.length > 0) {
        try {
          const all = await getAchievements();
          const resolvedTitles = resolveGrantedTitles(granted, all.items ?? []);
          setGrantedTitles(resolvedTitles);
        } catch {
          const resolvedTitles = resolveGrantedTitles(granted, []);
          setGrantedTitles(resolvedTitles);
        }

        setSuccessOpen(true);
      } else if (isAddWorkoutOnboarding) {
        navigation.navigate("Analytics");
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    const base = q
      ? items.filter(
          (a) =>
            a.name.toLowerCase().includes(q) ||
            a.code.toLowerCase().includes(q),
        )
      : items;

    const recentSet = new Set(recentIds);
    const recents = base.filter((a) => recentSet.has(a.id));
    const rest = base.filter((a) => !recentSet.has(a.id));

    return [...recents, ...rest];
  }, [items, recentIds, search]);

  const fieldsCount = fields.length;
  const requiredCount = fields.filter((f) => f.required).length;

  const showActivityCoach = isAddWorkoutOnboarding && coachStage === 0;
  const showFieldsCoach =
    isAddWorkoutOnboarding && coachStage === 1 && !!selected;
  const showSaveCoach =
    isAddWorkoutOnboarding &&
    coachStage === 2 &&
    !!selected &&
    !saveCoachHidden;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar barStyle="dark-content" backgroundColor={palette.bg} />
      <LinearGradient
        colors={[palette.bg, palette.bg2]}
        style={StyleSheet.absoluteFill}
      />

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
          <Text style={styles.heroTitle}>Добавить тренировку</Text>
          <Text style={styles.heroSubtitle}>
            Выберите активность, заполните основные параметры и сохраните новую
            запись в дневник.
          </Text>

          <View style={styles.heroMiniRow}>
            <View style={styles.heroMiniPill}>
              <Ionicons
                name="calendar-outline"
                size={14}
                color={palette.purple}
              />
              <Text style={styles.heroMiniPillText}>
                {formatLocalShort(startedAtIso)}
              </Text>
            </View>

            {selected ? (
              <View style={styles.heroMiniPill}>
                <Ionicons
                  name="fitness-outline"
                  size={14}
                  color={palette.purple}
                />
                <Text style={styles.heroMiniPillText}>{selected.code}</Text>
              </View>
            ) : null}
          </View>
        </LinearGradient>

        <View style={styles.statsRow}>
          <SummaryStat
            value={String(items.length)}
            label="активностей"
            tint="rgba(124,231,255,0.28)"
            icon={
              <Ionicons name="list-outline" size={18} color={palette.purple} />
            }
          />
          <SummaryStat
            value={selected ? String(fieldsCount) : "—"}
            label="полей"
            tint="rgba(255,179,107,0.28)"
            icon={
              <Ionicons
                name="options-outline"
                size={18}
                color={palette.purple}
              />
            }
          />
          <SummaryStat
            value={selected ? String(requiredCount) : "—"}
            label="обязательных"
            tint="rgba(255,141,216,0.28)"
            icon={
              <Ionicons
                name="checkmark-circle-outline"
                size={18}
                color={palette.purple}
              />
            }
          />
        </View>

        <View style={styles.mainCard}>
          <Text style={styles.sectionKicker}>АКТИВНОСТЬ</Text>
          <Text style={styles.sectionTitle}>Выбор типа</Text>
          <Text style={styles.sectionDescription}>
            Выберите вид активности. После этого форма автоматически подстроится
            под нужные поля.
          </Text>

          <View style={styles.badgesRow}>
            <InfoBadge
              icon={
                <Ionicons
                  name="search-outline"
                  size={14}
                  color={palette.purple}
                />
              }
              label="Поиск"
            />
            <InfoBadge
              icon={
                <Ionicons
                  name="time-outline"
                  size={14}
                  color={palette.purple}
                />
              }
              label="Недавние"
            />
            <InfoBadge
              icon={<Ionicons name="flash" size={14} color={palette.purple} />}
              label="Быстрое заполнение"
            />
          </View>

          {showActivityCoach ? (
            <CoachCard
              title="Шаг 1. Выберите активность"
              text="Сначала выберите тип тренировки. После этого появятся только нужные поля — бег, зал, плавание и так далее."
              primaryLabel="Выбрать"
              onNext={() => setPickerOpen(true)}
              onSkip={skipOnboarding}
            />
          ) : null}

          <Pressable
            onPress={() => setPickerOpen(true)}
            style={({ pressed }) => [
              styles.pickRow,
              { opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.pickTitle} numberOfLines={1}>
                {selected
                  ? selected.name
                  : loading
                    ? "Загрузка…"
                    : "Выбрать активность"}
              </Text>
              <Text style={styles.pickSub} numberOfLines={1}>
                {selected ? selected.code : "Поиск по названию и коду"}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={palette.subtext}
            />
          </Pressable>

          {selected ? (
            <View style={styles.actionRow}>
              <SecondaryButton
                title="Сменить"
                onPress={() => setPickerOpen(true)}
              />
              <SecondaryButton
                title="Очистить поля"
                onPress={clearInputsKeepActivity}
              />
            </View>
          ) : null}
        </View>

        {selected ? (
          <>
            <View style={styles.mainCard}>
              <Text style={styles.sectionKicker}>ОСНОВНОЕ</Text>
              <Text style={styles.sectionTitle}>Дата и заметки</Text>
              <Text style={styles.sectionDescription}>
                Укажите время, длительность и при необходимости добавьте
                комментарий.
              </Text>

              <Text style={styles.label}>Дата и время</Text>
              <View style={styles.readonlyRow}>
                <Text style={styles.readonlyText}>
                  {formatLocalShort(startedAtIso)}
                </Text>
                <Pressable
                  onPress={() => setStartedAtIso(isoNow())}
                  style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
                >
                  <Text style={styles.readonlyAction}>сейчас</Text>
                </Pressable>
              </View>

              <Text style={[styles.label, { marginTop: 12 }]}>
                Длительность (мин)
              </Text>
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
              <Text style={styles.sectionKicker}>ПАРАМЕТРЫ</Text>
              <Text style={styles.sectionTitle}>Поля активности</Text>
              <Text style={styles.sectionDescription}>
                Эти параметры зависят от выбранного типа тренировки.
              </Text>

              {showFieldsCoach ? (
                <CoachCard
                  title="Шаг 2. Заполните параметры"
                  text="Здесь вводятся метрики тренировки: дистанция, подходы, повторения, калории и другие значения в зависимости от выбранной активности."
                  onNext={() => setCoachStage(2)}
                  onSkip={skipOnboarding}
                />
              ) : null}

              <View style={{ marginTop: 4 }}>
                {fields.length === 0 ? (
                  <View style={styles.emptyFields}>
                    <Text style={styles.emptyFieldsTitle}>Нет параметров</Text>
                    <Text style={styles.emptyFieldsSub}>
                      Для этой активности не задана схема полей. Можно сохранить
                      тренировку только с заметкой.
                    </Text>
                  </View>
                ) : (
                  fields.map((f) => (
                    <FieldInput
                      key={f.key}
                      field={f}
                      value={values[f.key] ?? ""}
                      onChange={(v) => setField(f.key, v)}
                    />
                  ))
                )}
              </View>
            </View>

            {showSaveCoach ? (
              <CoachCard
                title="Шаг 3. Сохраните тренировку"
                text="Когда всё заполнено, нажмите кнопку сохранения. После этого запись попадёт в историю, аналитику и рекомендации."
                primaryLabel="Сохраню"
                onNext={() => setSaveCoachHidden(true)}
                onSkip={skipOnboarding}
              />
            ) : null}

            <PrimaryButton
              title={saving ? "Сохраняем…" : "Сохранить тренировку"}
              subtitle="После сохранения форма очистится"
              onPress={onSave}
              loading={saving}
              disabled={saving}
            />

            <View style={{ height: 18 }} />
          </>
        ) : null}

        {!selected && !loading ? (
          <View style={styles.mainCard}>
            <Text style={styles.sectionKicker}>ПОДСКАЗКА</Text>
            <Text style={styles.sectionTitle}>Сначала выберите активность</Text>
            <Text style={styles.sectionDescription}>
              После выбора появятся только нужные поля. Это ускоряет заполнение
              и помогает избежать ошибок.
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <BottomSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Выбор активности"
      >
        <View style={{ padding: 14 }}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Поиск: бег, присед, swim, run…"
            placeholderTextColor={palette.subtext}
            style={styles.searchInput}
          />

          <Text style={styles.sheetHint}>
            {recentIds.length
              ? "Недавние активности показаны первыми."
              : "Начните вводить, чтобы быстрее найти нужный вариант."}
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 14, paddingTop: 0, gap: 10 }}
        >
          {filtered.map((a) => {
            const count = a.fieldsSchema?.fields?.length ?? 0;
            const active = selected?.id === a.id;

            return (
              <Pressable
                key={a.id}
                onPress={() => pickActivity(a)}
                style={({ pressed }) => [
                  styles.activityCard,
                  {
                    borderColor: active
                      ? "rgba(109,76,255,0.55)"
                      : palette.line,
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}
              >
                <View style={styles.activityIcon}>
                  <MaterialCommunityIcons
                    name="dumbbell"
                    size={18}
                    color={palette.purple}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.activityTitle} numberOfLines={1}>
                    {a.name}
                  </Text>
                  <Text style={styles.activitySub} numberOfLines={1}>
                    {a.code} • полей: {count}
                  </Text>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={palette.subtext}
                />
              </Pressable>
            );
          })}

          {!loading && filtered.length === 0 ? (
            <View style={styles.emptyFields}>
              <Text style={styles.emptyFieldsTitle}>Ничего не найдено</Text>
              <Text style={styles.emptyFieldsSub}>
                Попробуйте другое слово или код активности.
              </Text>
            </View>
          ) : null}

          <View style={{ height: 10 }} />
        </ScrollView>
      </BottomSheet>

      <BottomSheet
        visible={successOpen}
        onClose={() => setSuccessOpen(false)}
        title="Готово!"
      >
        <View style={{ padding: 14 }}>
          <View style={styles.successBox}>
            <Text style={styles.successTitle}>🎉 Новое достижение</Text>
            <Text style={styles.successSub}>
              Вы открыли{" "}
              {grantedTitles.length > 1 ? "несколько бейджей" : "бейдж"}:
            </Text>

            <View style={{ marginTop: 10, gap: 8 }}>
              {grantedTitles.map((t, index) => {
                const label =
                  typeof t === "string" && t.trim()
                    ? t.trim()
                    : `Достижение ${index + 1}`;

                return (
                  <View key={`${label}-${index}`} style={styles.successPill}>
                    <Text style={styles.successPillText} numberOfLines={1}>
                      {label}
                    </Text>
                  </View>
                );
              })}
            </View>

            <View style={styles.successActions}>
              <Pressable
                onPress={() => {
                  setSuccessOpen(false);
                  if (isAddWorkoutOnboarding) {
                    navigation?.navigate?.("Analytics");
                  }
                }}
                style={({ pressed }) => [
                  styles.successActionPressable,
                  { opacity: pressed ? 0.9 : 1 },
                ]}
              >
                <View style={styles.successSecondaryBtn}>
                  <Text style={styles.successSecondaryBtnText}>Ок</Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => {
                  setSuccessOpen(false);
                  navigation?.navigate?.("Achievements");
                }}
                style={({ pressed }) => [
                  styles.successActionPressable,
                  { opacity: pressed ? 0.9 : 1 },
                ]}
              >
                <LinearGradient
                  colors={[palette.purple, palette.purpleDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.successPrimaryBtn}
                >
                  <Text style={styles.successPrimaryBtnText}>Открыть</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </View>
      </BottomSheet>
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

  coachCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(109,76,255,0.16)",
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    padding: 12,
    marginBottom: 12,
  },

  coachHeader: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },

  coachIcon: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: "center",
    justifyContent: "center",
  },

  coachTitle: {
    color: palette.text,
    fontSize: 14.5,
    fontWeight: "900",
  },

  coachText: {
    color: palette.subtext,
    fontSize: 12.8,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 4,
  },

  coachActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },

  coachGhostBtn: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.line,
    paddingVertical: 11,
    alignItems: "center",
    backgroundColor: palette.cardSoft,
  },

  coachGhostBtnText: {
    color: palette.subtext,
    fontSize: 13.5,
    fontWeight: "900",
  },

  coachPrimaryBtn: {
    borderRadius: 16,
    paddingVertical: 11,
    alignItems: "center",
  },

  coachPrimaryBtnText: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontWeight: "900",
  },

  pickRow: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.cardSoft,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  pickTitle: {
    color: palette.text,
    fontSize: 15.5,
    fontWeight: "900",
  },

  pickSub: {
    color: palette.subtext,
    marginTop: 3,
    fontSize: 12.5,
    fontWeight: "700",
  },

  actionRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 10,
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

  secondaryButton: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.line,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: palette.cardSoft,
  },

  secondaryButtonText: {
    color: palette.text,
    fontSize: 13.5,
    fontWeight: "900",
  },

  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 2,
  },

  chip: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },

  chipText: {
    fontSize: 13,
    fontWeight: "900",
  },

  emptyFields: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 12,
    backgroundColor: palette.cardSoft,
  },

  emptyFieldsTitle: {
    color: palette.text,
    fontSize: 13.5,
    fontWeight: "900",
  },

  emptyFieldsSub: {
    color: palette.subtext,
    marginTop: 4,
    fontSize: 12.5,
    fontWeight: "700",
    lineHeight: 18,
  },

  sheetRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },

  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },

  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card,
    overflow: "hidden",
  },

  sheetHeader: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  sheetTitle: {
    color: palette.text,
    fontSize: 14.5,
    fontWeight: "900",
  },

  sheetClose: {
    color: palette.subtext,
    fontSize: 16,
    fontWeight: "900",
  },

  searchInput: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.cardSoft,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14.5,
    fontWeight: "800",
    color: palette.text,
  },

  sheetHint: {
    color: palette.subtext,
    marginTop: 8,
    fontSize: 12.5,
    fontWeight: "700",
  },

  activityCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: palette.card,
  },

  activityIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: palette.cardSoft,
    alignItems: "center",
    justifyContent: "center",
  },

  activityTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: "900",
  },

  activitySub: {
    color: palette.subtext,
    marginTop: 3,
    fontSize: 12.5,
    fontWeight: "700",
  },

  successBox: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 12,
    backgroundColor: palette.greenSoft,
  },

  successTitle: {
    color: palette.green,
    fontSize: 14.5,
    fontWeight: "900",
  },

  successSub: {
    color: palette.subtext,
    marginTop: 4,
    fontSize: 12.5,
    fontWeight: "700",
    lineHeight: 18,
  },

  successPill: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: palette.card,
  },

  successPillText: {
    color: palette.text,
    fontSize: 13.5,
    fontWeight: "900",
  },

  successActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },

  successActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },

  successActionPressable: {
    flex: 1,
  },

  successSecondaryBtn: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },

  successSecondaryBtnText: {
    color: palette.text,
    fontSize: 14,
    fontWeight: "900",
    includeFontPadding: false,
  },

  successPrimaryBtn: {
    minHeight: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },

  successPrimaryBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
    includeFontPadding: false,
  },
});
