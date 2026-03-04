import React, { useCallback, useMemo, useRef, useState } from "react";
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
    border: isDark ? "rgba(255,255,255,0.10)" : "rgba(16,24,40,0.10)",
    primary: "#2D6BFF",
    success: "#1F7A2E",
    danger: "#E5484D",
    inputBg: isDark ? "rgba(255,255,255,0.06)" : "#F2F4F7",
    chipBg: isDark ? "rgba(255,255,255,0.06)" : "#EEF2F6",
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

function minutesToSecondsStr(minStr: string) {
  const m = Number(minStr);
  if (!Number.isFinite(m) || m < 0) return undefined;
  return Math.round(m * 60);
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

function SecondaryButton({
  title,
  onPress,
  palette,
}: {
  title: string;
  onPress: () => void;
  palette: ReturnType<typeof makePalette>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryBtn,
        {
          backgroundColor: palette.inputBg,
          borderColor: palette.border,
          opacity: pressed ? 0.86 : 1,
        },
      ]}
    >
      <Text style={[styles.secondaryBtnText, { color: palette.text }]}>{title}</Text>
    </Pressable>
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
          {field.required ? <Text style={{ color: palette.danger }}> *</Text> : null}
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
                    borderColor: active ? palette.primary : palette.border,
                    backgroundColor: active ? palette.softPrimary : palette.chipBg,
                    opacity: pressed ? 0.86 : 1,
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: active ? palette.primary : palette.text }]}>
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
      <Text style={[styles.label, { color: palette.subtext }]}>
        {field.label}
        {field.unit ? ` (${field.unit})` : ""}
        {field.required ? <Text style={{ color: palette.danger }}> *</Text> : null}
      </Text>

      <TextInput
        value={value}
        onChangeText={(v) => onChange(field.type === "number" ? clampNumStr(v) : v)}
        placeholder={field.placeholder ?? ""}
        placeholderTextColor={palette.subtext}
        keyboardType={keyboardType as any}
        style={[
          styles.input,
          { backgroundColor: palette.inputBg, borderColor: palette.border, color: palette.text },
        ]}
      />
    </View>
  );
}

function BottomSheet({
  visible,
  onClose,
  palette,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  palette: ReturnType<typeof makePalette>;
  title: string;
  children: React.ReactNode;
}) {
  const { height } = Dimensions.get("window");
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.sheetOverlay} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          {
            maxHeight: Math.min(680, Math.round(height * 0.84)),
            backgroundColor: palette.card,
            borderColor: palette.border,
          },
        ]}
      >
        <View style={[styles.sheetHeader, { borderColor: palette.border }]}>
          <Text style={[styles.sheetTitle, { color: palette.text }]}>{title}</Text>
          <Pressable onPress={onClose} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
            <Text style={[styles.sheetClose, { color: palette.subtext }]}>✕</Text>
          </Pressable>
        </View>

        {children}
      </View>
    </Modal>
  );
}

export default function AddWorkoutScreen({ navigation, route }: any) {
  const scheme = useColorScheme();
  const palette = useMemo(() => makePalette(scheme === "dark"), [scheme]);

  const prefill = route?.params?.prefill ?? null;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [items, setItems] = useState<ActivityType[]>([]);
  const itemsRef = useRef<ActivityType[]>([]);
  const [selected, setSelected] = useState<ActivityType | null>(null);

  const [startedAtIso, setStartedAtIso] = useState<string>(isoNow());
  const [durationMin, setDurationMin] = useState<string>(""); // UX: минуты, не секунды
  const [notes, setNotes] = useState<string>("");
  const [values, setValues] = useState<Record<string, string>>({});

  const fields = (selected?.fieldsSchema?.fields ?? []) as Field[];

  // Activity picker UX
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [recentIds, setRecentIds] = useState<string[]>([]);

  // Save UX
  const [saving, setSaving] = useState(false);

  // Success sheet (achievements)
  const [successOpen, setSuccessOpen] = useState(false);
  const [grantedTitles, setGrantedTitles] = useState<string[]>([]);

  const initFormForActivity = useCallback((a: ActivityType) => {
    const next: Record<string, string> = {};
    (a.fieldsSchema?.fields ?? []).forEach((f: any) => (next[f.key] = ""));
    setValues(next);
  }, []);

  const applyPrefillIfAny = useCallback(
    (list: ActivityType[]) => {
      if (!prefill) return;
      const act = list.find((a) => a.id === prefill.activityTypeId);
      if (!act) return;

      setSelected(act);
      const next: Record<string, string> = {};
      (act.fieldsSchema?.fields ?? []).forEach((f: any) => (next[f.key] = ""));
      (prefill.metrics ?? []).forEach((m: any) => {
        next[m.metricKey] = String(m.valueNum);
      });
      setValues(next);

      if (prefill.durationSec != null) setDurationMin(String(Math.round(Number(prefill.durationSec) / 60)));
      setNotes(prefill.notes ?? "");
      setStartedAtIso(isoNow());

      // очистим param, чтобы не применять повторно
      navigation?.setParams?.({ prefill: null });
    },
    [navigation, prefill]
  );

  const load = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") setLoading(true);
    if (mode === "refresh") setRefreshing(true);

    try {
      const res = await api.get("/activities");
      const list: ActivityType[] = res?.data?.items ?? [];
      setItems(list);
      itemsRef.current = list;

      // если зашли с prefill — применим
      applyPrefillIfAny(list);
    } catch (e: any) {
      Alert.alert("Ошибка", e?.message ?? "Не удалось загрузить активности");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [applyPrefillIfAny]);

  // ✅ авто-загрузка (без кнопки)
  useFocusEffect(
    useCallback(() => {
      load("initial");
    }, [load])
  );

  const pickActivity = (a: ActivityType) => {
    setSelected(a);
    initFormForActivity(a);
    setStartedAtIso(isoNow());
    setDurationMin("");
    setNotes("");
    setPickerOpen(false);

    // recent (в рамках сессии — без стораджа)
    setRecentIds((prev) => {
      const next = [a.id, ...prev.filter((x) => x !== a.id)];
      return next.slice(0, 6);
    });
  };

  const setField = (key: string, v: string) => setValues((prev) => ({ ...prev, [key]: v }));

  const validate = () => {
    if (!selected) return "Выбери активность";
    const startedAt = new Date(startedAtIso);
    if (Number.isNaN(startedAt.getTime())) return "Дата/время некорректны";

    if (durationMin.trim()) {
      const n = Number(durationMin.trim());
      if (!Number.isFinite(n) || n < 0) return "Длительность должна быть числом (минуты)";
      if (n > 24 * 60) return "Слишком большая длительность";
    }

    for (const f of fields) {
      const v = (values[f.key] ?? "").trim();
      if (f.required && !v) return `${f.label}: обязательное поле`;
      if (f.type === "number" && v) {
        const n = Number(v);
        if (Number.isNaN(n)) return `${f.label}: должно быть числом`;
        if (typeof f.min === "number" && n < f.min) return `${f.label}: минимум ${f.min}`;
        if (typeof f.max === "number" && n > f.max) return `${f.label}: максимум ${f.max}`;
      }
      if (f.type === "select" && f.required && !v) return `${f.label}: выбери значение`;
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

      // text/select тоже могут быть важны — если бэк их поддерживает, добавим как metadata позже.
      const durSec = minutesToSecondsStr(durationMin.trim());

      const body = {
        activityTypeId: selected.id,
        startedAt: startedAtIso,
        durationSec: durSec,
        notes: notes.trim() || undefined,
        metrics,
      };

      const res = await api.post("/workouts", body);

      const granted: string[] = res?.data?.grantedAchievements ?? [];
      clearInputsKeepActivity();

      if (granted.length > 0) {
        try {
          const all = await getAchievements();
          const map = new Map((all.items ?? []).map((a: any) => [a.code, a.title]));
          setGrantedTitles(granted.map((c) => map.get(c) ?? c));
        } catch {
          setGrantedTitles(granted);
        }
        setSuccessOpen(true);
      } else {
        // лёгкий UX: если нет достижений — просто остаёмся на экране (всё уже очищено)
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? "Не удалось сохранить тренировку";
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
            a.code.toLowerCase().includes(q)
        )
      : items;

    // Поднимем recent вверх (приятный UX)
    const recentSet = new Set(recentIds);
    const recents = base.filter((a) => recentSet.has(a.id));
    const rest = base.filter((a) => !recentSet.has(a.id));
    return [...recents, ...rest];
  }, [items, recentIds, search]);

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
        {/* Header */}
        <View style={{ marginBottom: 12 }}>
          <Text style={[styles.pageTitle, { color: palette.text }]}>Добавить тренировку</Text>
          <Text style={[styles.pageSubtitle, { color: palette.subtext }]}>
            Выбери активность и быстро заполни параметры.
          </Text>
        </View>

        {/* Activity selector */}
        <View style={[styles.section, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Активность</Text>
          <Text style={[styles.sectionSubtitle, { color: palette.subtext }]}>
            {selected ? "Можно сменить активность в любой момент" : "Нажми, чтобы выбрать"}
          </Text>

          <View style={{ marginTop: 12 }}>
            <Pressable
              onPress={() => setPickerOpen(true)}
              style={({ pressed }) => [
                styles.pickRow,
                {
                  backgroundColor: palette.inputBg,
                  borderColor: palette.border,
                  opacity: pressed ? 0.86 : 1,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.pickTitle, { color: palette.text }]} numberOfLines={1}>
                  {selected ? selected.name : loading ? "Загрузка…" : "Выбрать активность"}
                </Text>
                <Text style={[styles.pickSub, { color: palette.subtext }]} numberOfLines={1}>
                  {selected ? selected.code : "Поиск по названию и коду"}
                </Text>
              </View>
              <Text style={[styles.chev, { color: palette.subtext }]}>›</Text>
            </Pressable>

            {selected ? (
              <View style={{ marginTop: 10, flexDirection: "row", gap: 10 }}>
                <SecondaryButton title="Сменить" onPress={() => setPickerOpen(true)} palette={palette} />
                <SecondaryButton title="Очистить поля" onPress={clearInputsKeepActivity} palette={palette} />
              </View>
            ) : null}
          </View>
        </View>

        {/* Form */}
        {selected ? (
          <>
            <View style={[styles.section, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Основное</Text>
              <Text style={[styles.sectionSubtitle, { color: palette.subtext }]}>
                Дата, длительность и заметки
              </Text>

              <View style={{ marginTop: 12 }}>
                <Text style={[styles.label, { color: palette.subtext }]}>Дата и время</Text>

                <View
                  style={[
                    styles.readonlyRow,
                    { backgroundColor: palette.inputBg, borderColor: palette.border },
                  ]}
                >
                  <Text style={[styles.readonlyText, { color: palette.text }]}>
                    {formatLocalShort(startedAtIso)}
                  </Text>

                  <Pressable
                    onPress={() => setStartedAtIso(isoNow())}
                    style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]}
                  >
                    <Text style={[styles.readonlyAction, { color: palette.primary }]}>сейчас</Text>
                  </Pressable>
                </View>

                <Text style={[styles.label, { color: palette.subtext, marginTop: 12 }]}>
                  Длительность (мин)
                </Text>
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

            <View style={[styles.section, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Параметры</Text>
              <Text style={[styles.sectionSubtitle, { color: palette.subtext }]}>
                Поля зависят от выбранной активности
              </Text>

              <View style={{ marginTop: 12 }}>
                {fields.length === 0 ? (
                  <View
                    style={[
                      styles.emptyFields,
                      { backgroundColor: palette.inputBg, borderColor: palette.border },
                    ]}
                  >
                    <Text style={[styles.emptyFieldsTitle, { color: palette.text }]}>
                      Нет параметров
                    </Text>
                    <Text style={[styles.emptyFieldsSub, { color: palette.subtext }]}>
                      Для этой активности не задана схема полей — можно просто сохранить тренировку с заметкой.
                    </Text>
                  </View>
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

            <PrimaryButton
              title={saving ? "Сохраняю…" : "Сохранить тренировку"}
              subtitle="После сохранения поля очистятся"
              onPress={onSave}
              palette={palette}
              loading={saving}
              disabled={saving}
            />

            <View style={{ height: 18 }} />
          </>
        ) : null}

        {!selected && !loading ? (
          <View style={[styles.hintCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.hintTitle, { color: palette.text }]}>Совет</Text>
            <Text style={[styles.hintText, { color: palette.subtext }]}>
              Сначала выбери активность — затем появятся поля для ввода. Это ускоряет заполнение и уменьшает ошибки.
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Activity picker bottom sheet */}
      <BottomSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        palette={palette}
        title="Выбор активности"
      >
        <View style={{ padding: 14 }}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Поиск: бег, присед, swim, run…"
            placeholderTextColor={palette.subtext}
            style={[
              styles.searchInput,
              { backgroundColor: palette.inputBg, borderColor: palette.border, color: palette.text },
            ]}
          />

          <Text style={[styles.sheetHint, { color: palette.subtext }]}>
            {recentIds.length ? "Недавние сверху. Потяни вниз на главном экране для обновления." : "Начни вводить для поиска."}
          </Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 14, paddingTop: 0, gap: 10 }}>
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
                    backgroundColor: palette.card,
                    borderColor: active ? "rgba(45,107,255,0.55)" : palette.border,
                    opacity: pressed ? 0.88 : 1,
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.activityTitle, { color: palette.text }]} numberOfLines={1}>
                    {a.name}
                  </Text>
                  <Text style={[styles.activitySub, { color: palette.subtext }]} numberOfLines={1}>
                    {a.code} • полей: {count}
                  </Text>
                </View>
                <Text style={[styles.chev, { color: palette.subtext }]}>›</Text>
              </Pressable>
            );
          })}

          {!loading && filtered.length === 0 ? (
            <View style={[styles.emptyFields, { backgroundColor: palette.inputBg, borderColor: palette.border }]}>
              <Text style={[styles.emptyFieldsTitle, { color: palette.text }]}>Ничего не найдено</Text>
              <Text style={[styles.emptyFieldsSub, { color: palette.subtext }]}>
                Попробуй другое слово или код активности.
              </Text>
            </View>
          ) : null}

          <View style={{ height: 10 }} />
        </ScrollView>
      </BottomSheet>

      {/* Success sheet */}
      <BottomSheet
        visible={successOpen}
        onClose={() => setSuccessOpen(false)}
        palette={palette}
        title="Готово!"
      >
        <View style={{ padding: 14 }}>
          <View style={[styles.successBox, { backgroundColor: palette.softSuccess, borderColor: palette.border }]}>
            <Text style={[styles.successTitle, { color: palette.success }]}>🎉 Новое достижение</Text>
            <Text style={[styles.successSub, { color: palette.subtext }]}>
              Ты открыл(а) {grantedTitles.length > 1 ? "несколько бейджей" : "бейдж"}:
            </Text>

            <View style={{ marginTop: 10, gap: 8 }}>
              {grantedTitles.map((t) => (
                <View
                  key={t}
                  style={[
                    styles.successPill,
                    { backgroundColor: palette.card, borderColor: palette.border },
                  ]}
                >
                  <Text style={[styles.successPillText, { color: palette.text }]} numberOfLines={1}>
                    {t}
                  </Text>
                </View>
              ))}
            </View>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
              <SecondaryButton title="Ок" onPress={() => setSuccessOpen(false)} palette={palette} />
              <Pressable
                onPress={() => {
                  setSuccessOpen(false);
                  navigation?.navigate?.("Achievements");
                }}
                style={({ pressed }) => [
                  styles.goAchievements,
                  {
                    backgroundColor: palette.primary,
                    opacity: pressed ? 0.86 : 1,
                  },
                ]}
              >
                <Text style={styles.goAchievementsText}>Открыть</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </BottomSheet>
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

  pickRow: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  pickTitle: { fontSize: 15.5, fontWeight: "900" },
  pickSub: { marginTop: 3, fontSize: 12.5, fontWeight: "700" },

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

  secondaryBtn: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryBtnText: { fontSize: 13.5, fontWeight: "900" },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 },
  chip: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  chipText: { fontSize: 13, fontWeight: "900" },

  emptyFields: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  emptyFieldsTitle: { fontSize: 13.5, fontWeight: "900" },
  emptyFieldsSub: { marginTop: 4, fontSize: 12.5, fontWeight: "700", lineHeight: 18 },

  hintCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },
  hintTitle: { fontSize: 14.5, fontWeight: "900" },
  hintText: { marginTop: 6, fontSize: 12.5, fontWeight: "700", lineHeight: 18 },

  // bottom sheet
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  sheetHeader: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetTitle: { fontSize: 14.5, fontWeight: "900" },
  sheetClose: { fontSize: 16, fontWeight: "900" },

  searchInput: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14.5,
    fontWeight: "800",
  },
  sheetHint: { marginTop: 8, fontSize: 12.5, fontWeight: "700" },

  activityCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  activityTitle: { fontSize: 15, fontWeight: "900" },
  activitySub: { marginTop: 3, fontSize: 12.5, fontWeight: "700" },

  // success
  successBox: { borderRadius: 16, borderWidth: 1, padding: 12 },
  successTitle: { fontSize: 14.5, fontWeight: "900" },
  successSub: { marginTop: 4, fontSize: 12.5, fontWeight: "700", lineHeight: 18 },
  successPill: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  successPillText: { fontSize: 13.5, fontWeight: "900" },
  goAchievements: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: "center" },
  goAchievementsText: { color: "#fff", fontSize: 13.5, fontWeight: "900" },

  chev: { fontSize: 24, fontWeight: "900" },
  chevWhite: { color: "#fff", fontSize: 24, fontWeight: "900" },
});