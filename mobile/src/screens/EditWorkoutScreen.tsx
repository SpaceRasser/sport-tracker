import React, { useEffect, useMemo, useRef, useState } from 'react';
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
} from 'react-native';

import { api } from '../api/client';
import { getAchievements } from '../api/achievementsApi';

type Field =
  | { key: string; label: string; type: 'number'; min?: number; max?: number; unit?: string; step?: number; required?: boolean }
  | { key: string; label: string; type: 'text'; required?: boolean }
  | { key: string; label: string; type: 'select'; options: { label: string; value: string }[]; required?: boolean };

type ActivityType = {
  id: string;
  code: string;
  name: string;
  fieldsSchema?: { fields?: Field[] } | null;
};

function makePalette(isDark: boolean) {
  return {
    bg: isDark ? '#0B0D12' : '#F4F6FA',
    card: isDark ? '#121625' : '#FFFFFF',
    text: isDark ? '#E9ECF5' : '#121722',
    subtext: isDark ? '#A9B1C7' : '#5C667A',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(16,24,40,0.08)',
    primary: '#2D6BFF',
    danger: '#E5484D',
    inputBg: isDark ? 'rgba(255,255,255,0.06)' : '#F2F4F7',
    softPrimary: isDark ? 'rgba(45,107,255,0.16)' : 'rgba(45,107,255,0.10)',
  };
}

function clampNumStr(value: string) {
  return value.replace(/[^\d.,-]/g, '').replace(',', '.');
}

function formatLocal(dtIso: string) {
  const d = new Date(dtIso);
  if (Number.isNaN(d.getTime())) return dtIso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isoNow() {
  return new Date().toISOString();
}

/** Конфетти без библиотек */
function ConfettiBurst({ show }: { show: boolean }) {
  const { width } = Dimensions.get('window');
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
    }),
  ).current;

  useEffect(() => {
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

  const colors = ['#2D6BFF', '#7CF08D', '#FFD166', '#EF476F', '#06D6A0', '#8B5CF6'];

  return (
    <View pointerEvents="none" style={styles.confettiLayer}>
      {pieces.map((p, idx) => {
        const rotate = p.r.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', `${360 + Math.random() * 720}deg`],
        });

        return (
          <Animated.View
            key={p.key}
            style={{
              position: 'absolute',
              left: p.x,
              top: 0,
              width: p.size,
              height: p.size * 1.6,
              borderRadius: 3,
              backgroundColor: colors[idx % colors.length],
              opacity: p.o,
              transform: [
                { translateY: p.y },
                { translateX: p.y.interpolate({ inputRange: [-30, p.fall], outputRange: [0, p.drift] }) },
                { rotate },
              ],
            }}
          />
        );
      })}
    </View>
  );
}

function FieldInput({
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
        {unit ? ` (${unit})` : ''}
        {required ? <Text style={{ color: palette.danger }}> *</Text> : null}
      </Text>

      <TextInput
        value={value}
        onChangeText={(v) => onChange(clampNumStr(v))}
        placeholder=""
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
    </View>
  );
}

export default function EditWorkoutScreen({ route, navigation }: any) {
  const { workoutId } = route.params as { workoutId: string };

  const scheme = useColorScheme();
  const palette = useMemo(() => makePalette(scheme === 'dark'), [scheme]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [activities, setActivities] = useState<ActivityType[]>([]);
  const [activity, setActivity] = useState<ActivityType | null>(null);

  const [startedAtIso, setStartedAtIso] = useState<string>(isoNow());
  const [durationSec, setDurationSec] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const [values, setValues] = useState<Record<string, string>>({});
  const fields = (activity?.fieldsSchema?.fields ?? []) as Field[];
  const numberFields = fields.filter((f) => f.type === 'number') as Extract<Field, { type: 'number' }>[];

  const [toastVisible, setToastVisible] = useState(false);
  const [grantedTitles, setGrantedTitles] = useState<string[]>([]);
  const [confettiOn, setConfettiOn] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [wRes, aRes] = await Promise.all([
        api.get(`/workouts/${workoutId}`),
        api.get('/activities'),
      ]);

      const w = wRes?.data?.workout;
      const list: ActivityType[] = aRes?.data?.items ?? [];
      setActivities(list);

      if (!w) throw new Error('Тренировка не найдена');

      const act = list.find((x) => x.id === w.activityTypeId) ?? null;
      setActivity(act);

      setStartedAtIso(w.startedAt);
      setDurationSec(w.durationSec != null ? String(w.durationSec) : '');
      setNotes(w.notes ?? '');

      // prefill metrics -> values (только number поля)
      const next: Record<string, string> = {};
      (act?.fieldsSchema?.fields ?? []).forEach((f: any) => (next[f.key] = ''));

      (w.metrics ?? []).forEach((m: any) => {
        next[m.metricKey] = String(Number(m.valueNum));
      });

      setValues(next);
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось загрузить тренировку');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [workoutId]);

  const validate = () => {
    const startedAt = new Date(startedAtIso);
    if (Number.isNaN(startedAt.getTime())) return 'Дата/время некорректны';

    const dur = durationSec.trim();
    if (dur) {
      const n = Number(dur);
      if (Number.isNaN(n) || n < 0) return 'Длительность должна быть числом (секунды)';
    }

    for (const f of numberFields) {
      const v = (values[f.key] ?? '').trim();
      if (f.required && !v) return `${f.label}: обязательное поле`;
      if (v) {
        const n = Number(v);
        if (Number.isNaN(n)) return `${f.label}: должно быть числом`;
        if (typeof f.min === 'number' && n < f.min) return `${f.label}: минимум ${f.min}`;
        if (typeof f.max === 'number' && n > f.max) return `${f.label}: максимум ${f.max}`;
      }
    }

    return null;
  };

  const onSave = async () => {
    const err = validate();
    if (err) return Alert.alert('Проверь форму', err);
    if (!activity) return;

    try {
      setSaving(true);

      const metrics = numberFields
        .map((f) => {
          const raw = (values[f.key] ?? '').trim();
          if (!raw) return null;
          const n = Number(raw);
          if (!Number.isFinite(n)) return null;
          return { key: f.key, value: n, unit: (f as any).unit ?? undefined };
        })
        .filter(Boolean) as { key: string; value: number; unit?: string }[];

      const dur = durationSec.trim();
      const durNum = dur ? Number(dur) : undefined;

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
          const titles = granted.map((c) => map.get(c) ?? c);
          setGrantedTitles(titles);
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
      const msg = e?.response?.data?.message ?? e?.message ?? 'Не удалось сохранить изменения';
      Alert.alert('Ошибка', String(msg));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: palette.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={{ marginBottom: 12 }}>
          <Text style={[styles.pageTitle, { color: palette.text }]}>Редактировать</Text>
          <Text style={[styles.pageSubtitle, { color: palette.subtext }]}>
            {activity ? `${activity.name} (${activity.code})` : 'Загрузка…'}
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Основное</Text>

          <View style={{ marginTop: 12 }}>
            <Text style={[styles.label, { color: palette.subtext }]}>Дата и время</Text>
            <View style={[styles.readonlyRow, { backgroundColor: palette.inputBg, borderColor: palette.border }]}>
              <Text style={[styles.readonlyText, { color: palette.text }]}>{formatLocal(startedAtIso)}</Text>
              <Pressable
                onPress={() => setStartedAtIso(isoNow())}
                style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]}
              >
                <Text style={[styles.readonlyAction, { color: palette.primary }]}>сейчас</Text>
              </Pressable>
            </View>

            <Text style={[styles.label, { color: palette.subtext, marginTop: 12 }]}>Длительность (сек)</Text>
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

            <Text style={[styles.label, { color: palette.subtext, marginTop: 12 }]}>Заметки</Text>
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

        <View style={[styles.section, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Метрики</Text>
          <Text style={[styles.sectionSubtitle, { color: palette.subtext }]}>
            Редактируем числовые поля (как в AddWorkout)
          </Text>

          <View style={{ marginTop: 12 }}>
            {loading ? (
              <Text style={{ color: palette.subtext, fontWeight: '800' }}>Загрузка…</Text>
            ) : numberFields.length === 0 ? (
              <Text style={{ color: palette.subtext, fontWeight: '800' }}>Для этой активности нет числовых метрик.</Text>
            ) : (
              numberFields.map((f) => (
                <FieldInput
                  key={f.key}
                  label={f.label}
                  unit={(f as any).unit}
                  required={f.required}
                  value={values[f.key] ?? ''}
                  onChange={(v) => setValues((p) => ({ ...p, [f.key]: v }))}
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
          <Text style={styles.primaryBtnText}>{saving ? 'Сохраняю…' : 'Сохранить изменения'}</Text>
        </Pressable>

        <View style={{ height: 18 }} />
      </ScrollView>

      {/* toast + confetti */}
      <Modal
        visible={toastVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setToastVisible(false)}
      >
        <View style={styles.toastOverlay}>
          <View style={[styles.toastCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <ConfettiBurst show={confettiOn} />
            <View style={[styles.toastGlow, { backgroundColor: 'rgba(45,107,255,0.16)' }]} />
            <View style={[styles.toastGlow2, { backgroundColor: 'rgba(124,240,141,0.12)' }]} />

            <Text style={[styles.toastTitle, { color: palette.text }]}>🎉 Новое достижение!</Text>
            <Text style={[styles.toastSubtitle, { color: palette.subtext }]}>
              Ты открыл{grantedTitles.length > 1 ? ' сразу несколько' : ''} бейдж{grantedTitles.length > 1 ? 'ей' : ''}.
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

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
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
                  navigation.navigate('Achievements');
                }}
                style={[styles.toastBtn, { backgroundColor: palette.primary, borderColor: 'transparent' }]}
              >
                <Text style={[styles.toastBtnText, { color: '#fff' }]}>Достижения</Text>
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

  pageTitle: { fontSize: 22, fontWeight: '900' },
  pageSubtitle: { marginTop: 6, fontSize: 13, fontWeight: '700' },

  section: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
    ...(Platform.OS === 'ios'
      ? { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } }
      : { elevation: 1 }),
  },
  sectionTitle: { fontSize: 15.5, fontWeight: '900' },
  sectionSubtitle: { marginTop: 4, fontSize: 12.5, fontWeight: '700' },

  label: { fontSize: 12.5, fontWeight: '800', marginBottom: 6 },

  input: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 15.5,
    fontWeight: '700',
  },

  textarea: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '700',
    minHeight: 92,
    textAlignVertical: 'top',
  },

  readonlyRow: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  readonlyText: { fontSize: 15.5, fontWeight: '800' },
  readonlyAction: { fontSize: 13.5, fontWeight: '900' },

  primaryBtn: { borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 15.5, fontWeight: '900' },

  toastOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  toastCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    overflow: 'hidden',
    ...(Platform.OS === 'ios'
      ? { shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 12 } }
      : { elevation: 4 }),
  },

  toastGlow: {
    position: 'absolute',
    top: -90,
    left: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  toastGlow2: {
    position: 'absolute',
    top: -110,
    right: -90,
    width: 240,
    height: 240,
    borderRadius: 120,
  },

  toastTitle: { fontSize: 16, fontWeight: '900' },
  toastSubtitle: { marginTop: 6, fontSize: 12.5, fontWeight: '700', lineHeight: 18 },

  toastPill: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  toastPillText: { fontSize: 13.5, fontWeight: '900' },

  toastBtn: { flex: 1, borderRadius: 14, borderWidth: 1, paddingVertical: 12, alignItems: 'center' },
  toastBtnText: { fontSize: 14, fontWeight: '900' },

  confettiLayer: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
});