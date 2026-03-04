// mobile/src/screens/HealthConnectScreen.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';

import { api } from '../api/client';

import {
  initialize,
  getSdkStatus,
  requestPermission,
  readRecords,
  openHealthConnectSettings,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';

type Period = 'today' | '7d';

type ActivityType = { id: string; code: string; name: string };

type HcSession = {
  id: string;
  startTime: string;
  endTime: string;
  exerciseTypeText?: string; // нормализованная строка
};

const HC_LAST_IMPORT_KEY = 'hc_last_import_end_time';
const MAX_LIMIT = 50;

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
    successBg: isDark ? 'rgba(46,125,50,0.18)' : 'rgba(46,125,50,0.12)',
    successText: isDark ? '#7CF08D' : '#1F7A2E',
    warnBg: isDark ? 'rgba(255,209,102,0.16)' : 'rgba(255,209,102,0.12)',
    warnText: isDark ? '#FFD166' : '#8A5A00',
  };
}

// ---- helpers ----
function toIso(d: Date) {
  return d.toISOString();
}

function rangeFor(period: Period) {
  const now = new Date();
  if (period === 'today') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { startTime: toIso(start), endTime: toIso(now) };
  }
  const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return { startTime: toIso(start), endTime: toIso(now) };
}

function formatLocal(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function safeNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizeExerciseTypeToString(exerciseType: any): string {
  if (exerciseType == null) return '';
  if (typeof exerciseType === 'string') return exerciseType;

  if (typeof exerciseType === 'object') {
    if (typeof (exerciseType as any).name === 'string') return (exerciseType as any).name;
    if (typeof (exerciseType as any).type === 'string') return (exerciseType as any).type;
    try {
      return JSON.stringify(exerciseType);
    } catch {
      return String(exerciseType);
    }
  }
  return String(exerciseType);
}

function mapExerciseToActivityCode(exerciseTypeText?: string | null): 'WALK' | 'RUN' | 'BIKE' {
  const t = (exerciseTypeText ?? '').toUpperCase();

  if (t.includes('RUN')) return 'RUN';
  if (t.includes('BIKE') || t.includes('BICY') || t.includes('CYCL')) return 'BIKE';
  if (t.includes('WALK') || t.includes('HIK')) return 'WALK';

  return 'WALK';
}

function iconFor(code: 'WALK' | 'RUN' | 'BIKE') {
  if (code === 'BIKE') return 'bicycle-outline';
  return 'walk-outline';
}

function titleFor(code: 'WALK' | 'RUN' | 'BIKE') {
  if (code === 'RUN') return 'Бег';
  if (code === 'BIKE') return 'Велосипед';
  return 'Ходьба';
}

function estimateCalories(opts: {
  activityCode: 'WALK' | 'RUN' | 'BIKE';
  distanceKm?: number;
  steps?: number;
  durationSec?: number;
}) {
  const { activityCode, distanceKm, steps, durationSec } = opts;

  const kcalPerKm = activityCode === 'RUN' ? 70 : activityCode === 'BIKE' ? 35 : 45;

  if (distanceKm && distanceKm > 0) return Math.round(distanceKm * kcalPerKm);

  if (steps && steps > 0) {
    const km = (steps * 0.7) / 1000;
    return Math.round(km * 45);
  }

  const kcalPerMin = activityCode === 'RUN' ? 10 : activityCode === 'BIKE' ? 6 : 5;
  if (durationSec && durationSec > 0) return Math.round((durationSec / 60) * kcalPerMin);

  return 0;
}

async function getActivitiesMap(): Promise<Map<string, ActivityType>> {
  const res = await api.get('/activities');
  const items: ActivityType[] = res?.data?.items ?? [];
  return new Map(items.map((a) => [a.code, a]));
}

// readRecords pageSize <= 50
async function readAll(recordType: string, timeRange: { startTime: string; endTime: string }) {
  const all: any[] = [];
  let pageToken: string | undefined = undefined;

  for (let i = 0; i < 50; i++) {
    const res: any = await readRecords(recordType as any, {
      timeRangeFilter: timeRange as any,
      pageSize: MAX_LIMIT,
      pageToken,
    } as any);

    const records = res?.records ?? res ?? [];
    if (Array.isArray(records)) all.push(...records);

    const next = res?.pageToken ?? res?.nextPageToken;
    if (!next) break;
    pageToken = next;
  }

  return all;
}

// мягкая проверка “дубликата” по marker в notes
async function alreadyImportedByMarker(marker: string) {
  try {
    const now = new Date();
    const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const res = await api.get('/workouts', { params: { from, limit: 200, page: 1 } });
    const items = res?.data?.items ?? [];
    return items.some((w: any) => String(w?.notes ?? '').includes(marker));
  } catch {
    return false;
  }
}

function HeaderStat({
  icon,
  value,
  label,
  palette,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
  palette: ReturnType<typeof makePalette>;
}) {
  return (
    <View style={[styles.statCard, { borderColor: palette.border, backgroundColor: palette.inputBg }]}>
      <Ionicons name={icon} size={16} color={palette.primary} />
      <Text style={[styles.statValue, { color: palette.text }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: palette.subtext }]}>{label}</Text>
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
  palette,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  palette: ReturnType<typeof makePalette>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: active ? palette.softPrimary : palette.inputBg,
          borderColor: active ? palette.primary : palette.border,
          opacity: pressed ? 0.86 : 1,
        },
      ]}
    >
      <Text style={{ color: active ? palette.primary : palette.text, fontWeight: '900' }}>{label}</Text>
    </Pressable>
  );
}

export default function HealthConnectScreen() {
  const scheme = useColorScheme();
  const palette = useMemo(() => makePalette(scheme === 'dark'), [scheme]);

  const [period, setPeriod] = useState<Period>('7d');

  const [screenLoading, setScreenLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [status, setStatus] = useState<'INIT' | 'NEED_INSTALL' | 'NEED_PERMS' | 'READY' | 'ERROR'>('INIT');

  const [lastImportEnd, setLastImportEnd] = useState<string | null>(null);

  const [sessions, setSessions] = useState<HcSession[]>([]);
  const [previewDistanceKm, setPreviewDistanceKm] = useState<number>(0);
  const [previewSteps, setPreviewSteps] = useState<number>(0);
  const [previewCalories, setPreviewCalories] = useState<number>(0);

  const [importing, setImporting] = useState(false);
  const [importIndex, setImportIndex] = useState(0); // прогресс импортирования
  const [importTotal, setImportTotal] = useState(0);

  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // load last import cursor
  useEffect(() => {
    (async () => {
      const saved = await SecureStore.getItemAsync(HC_LAST_IMPORT_KEY);
      if (mounted.current) setLastImportEnd(saved ?? null);
    })();
  }, []);

  const ensureReady = useCallback(async () => {
    setStatus('INIT');

    if (Platform.OS !== 'android') {
      setStatus('ERROR');
      Alert.alert('Health Connect', 'Доступно только на Android.');
      return false;
    }

    await initialize();

    const sdk = await getSdkStatus();
    if (sdk !== SdkAvailabilityStatus.SDK_AVAILABLE) {
      setStatus('NEED_INSTALL');
      return false;
    }

    const granted = await requestPermission([
      { accessType: 'read', recordType: 'ExerciseSession' },
      { accessType: 'read', recordType: 'Steps' },
      { accessType: 'read', recordType: 'Distance' },
      { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
    ] as any);

    const cnt = Array.isArray(granted) ? granted.length : 0;
    if (cnt === 0) {
      setStatus('NEED_PERMS');
      return false;
    }

    setStatus('READY');
    return true;
  }, []);

  const loadSessionsInternal = useCallback(
    async (p: Period) => {
      const base = rangeFor(p);

      // курсор: импортируем только после lastImportEnd
      const start = lastImportEnd
        ? new Date(Math.max(new Date(base.startTime).getTime(), new Date(lastImportEnd).getTime()))
        : new Date(base.startTime);

      const timeRange = { startTime: start.toISOString(), endTime: base.endTime };

      const rawSessions = await readAll('ExerciseSession', timeRange);

      const list: HcSession[] = (rawSessions ?? [])
        .map((s: any) => {
          const id = String(s?.metadata?.id ?? s?.id ?? '');
          const startTime = String(s?.startTime ?? '');
          const endTime = String(s?.endTime ?? '');
          const raw = s?.exerciseType;
          const text = normalizeExerciseTypeToString(raw);
          return { id, startTime, endTime, exerciseTypeText: text };
        })
        .filter((s) => s.id && s.startTime && s.endTime)
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

      if (!mounted.current) return;

      setSessions(list);

      // превью метрик по периоду (не по каждой сессии)
      const [stepsRecs, distRecs, calRecs] = await Promise.all([
        readAll('Steps', timeRange),
        readAll('Distance', timeRange),
        readAll('ActiveCaloriesBurned', timeRange),
      ]);

      const totalSteps = stepsRecs.reduce((acc, r: any) => acc + safeNum(r?.count), 0);
      const totalDistM = distRecs.reduce((acc, r: any) => acc + safeNum(r?.distance?.inMeters ?? r?.distance), 0);
      const totalDistKm = totalDistM / 1000;
      const totalCals = calRecs.reduce((acc, r: any) => acc + safeNum(r?.energy?.inKilocalories ?? r?.energy), 0);

      setPreviewSteps(Math.round(totalSteps));
      setPreviewDistanceKm(Math.round(totalDistKm * 100) / 100);
      setPreviewCalories(Math.round(totalCals));
    },
    [lastImportEnd],
  );

  const refreshAll = useCallback(
    async (p: Period) => {
      // авто-обновление без кнопки: просто используем этот метод в нужных местах
      const ok = await ensureReady();
      if (!ok) return;

      await loadSessionsInternal(p);
    },
    [ensureReady, loadSessionsInternal],
  );

  // bootstrap on mount
  useEffect(() => {
    (async () => {
      try {
        setScreenLoading(true);
        await refreshAll(period);
      } catch (e: any) {
        setStatus('ERROR');
        Alert.alert('Ошибка', e?.message ?? 'Не удалось инициализировать Health Connect');
      } finally {
        if (mounted.current) setScreenLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // auto refresh on period change (no button)
  useEffect(() => {
    if (status !== 'READY') return;
    (async () => {
      try {
        setRefreshing(true);
        await loadSessionsInternal(period);
      } catch (e: any) {
        Alert.alert('Ошибка', e?.message ?? 'Не удалось обновить данные');
      } finally {
        if (mounted.current) setRefreshing(false);
      }
    })();
  }, [period, status, loadSessionsInternal]);

  const importOneSession = useCallback(async (s: HcSession) => {
    const marker = `HC_SESSION:${s.id}`;

    const exists = await alreadyImportedByMarker(marker);
    if (exists) return { ok: true, skipped: true };

    const code = mapExerciseToActivityCode(s.exerciseTypeText);

    const actMap = await getActivitiesMap();
    const activity = actMap.get(code) ?? actMap.get('WALK');
    if (!activity) throw new Error('Нет activityType для WALK/RUN/BIKE. Проверь seed activities.');

    const startTime = new Date(s.startTime);
    const endTime = new Date(s.endTime);
    const durationSec = Math.max(0, Math.round((endTime.getTime() - startTime.getTime()) / 1000));

    const sessionRange = { startTime: s.startTime, endTime: s.endTime };

    const [stepsRecs, distRecs, calRecs] = await Promise.all([
      readAll('Steps', sessionRange),
      readAll('Distance', sessionRange),
      readAll('ActiveCaloriesBurned', sessionRange),
    ]);

    const steps = Math.round(stepsRecs.reduce((acc, r: any) => acc + safeNum(r?.count), 0));
    const distM = distRecs.reduce((acc, r: any) => acc + safeNum(r?.distance?.inMeters ?? r?.distance), 0);
    const distKm = distM / 1000;

    const cals = calRecs.reduce((acc, r: any) => acc + safeNum(r?.energy?.inKilocalories ?? r?.energy), 0);
    const calories =
      cals > 0
        ? Math.round(cals)
        : estimateCalories({
            activityCode: code,
            distanceKm: distKm > 0 ? distKm : undefined,
            steps: steps > 0 ? steps : undefined,
            durationSec: durationSec > 0 ? durationSec : undefined,
          });

    const metrics: any[] = [];
    if (steps > 0) metrics.push({ key: 'steps', value: steps, unit: 'шаг' });
    if (distKm > 0) metrics.push({ key: 'distance_km', value: Number(distKm.toFixed(3)), unit: 'км' });
    if (calories > 0) metrics.push({ key: 'calories', value: calories, unit: 'ккал' });
    if (durationSec > 0) metrics.push({ key: 'duration_sec', value: durationSec, unit: 'сек' });

    const notes = `Импорт из Health Connect\n${marker}\nexerciseType=${s.exerciseTypeText ?? ''}`;

    const body = {
      activityTypeId: activity.id,
      startedAt: s.startTime,
      durationSec: durationSec > 0 ? durationSec : undefined,
      notes,
      metrics,
    };

    await api.post('/workouts', body);

    return { ok: true, skipped: false };
  }, []);

  const afterImportRefreshAndCursor = useCallback(
    async (importedSessions: HcSession[], createdCount: number) => {
      // обновим cursor по максимальному endTime только если реально что-то создали
      const maxEnd = importedSessions
        .map((x) => new Date(x.endTime).getTime())
        .filter((t) => Number.isFinite(t));

      if (createdCount > 0 && maxEnd.length) {
        const maxIso = new Date(Math.max(...maxEnd)).toISOString();
        await SecureStore.setItemAsync(HC_LAST_IMPORT_KEY, maxIso);
        setLastImportEnd(maxIso);
      }

      // авто-рефреш списка (вместо кнопки)
      setRefreshing(true);
      try {
        await loadSessionsInternal(period);
      } finally {
        setRefreshing(false);
      }
    },
    [loadSessionsInternal, period],
  );

  const importAll = useCallback(async () => {
    if (!sessions.length) {
      Alert.alert('Нет данных', 'За выбранный период нет новых сессий.');
      return;
    }

    try {
      setImporting(true);
      setImportIndex(0);
      setImportTotal(sessions.length);

      let created = 0;
      let skipped = 0;

      for (let i = 0; i < sessions.length; i++) {
        setImportIndex(i + 1);
        const s = sessions[i];
        const r = await importOneSession(s);
        if (r.skipped) skipped++;
        else created++;
      }

      await afterImportRefreshAndCursor(sessions, created);

      Alert.alert('Импорт завершён', `Добавлено: ${created}\nПропущено (уже было): ${skipped}`);
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? 'Не удалось импортировать';
      Alert.alert('Ошибка', String(msg));
    } finally {
      setImporting(false);
      setImportIndex(0);
      setImportTotal(0);
    }
  }, [sessions, importOneSession, afterImportRefreshAndCursor]);

  const importSingle = useCallback(
    async (s: HcSession) => {
      try {
        setImporting(true);
        setImportIndex(1);
        setImportTotal(1);

        const r = await importOneSession(s);

        if (r.skipped) {
          Alert.alert('Уже импортировано', 'Эта сессия уже есть в дневнике.');
        } else {
          Alert.alert('Готово', 'Сессия импортирована в дневник.');
        }

        await afterImportRefreshAndCursor([s], r.skipped ? 0 : 1);
      } catch (e: any) {
        const msg = e?.response?.data?.message ?? e?.message ?? 'Не удалось импортировать';
        Alert.alert('Ошибка', String(msg));
      } finally {
        setImporting(false);
        setImportIndex(0);
        setImportTotal(0);
      }
    },
    [importOneSession, afterImportRefreshAndCursor],
  );

  // ---- UI states ----
  if (screenLoading) {
    return (
      <View style={[styles.screen, { backgroundColor: palette.bg }]}>
        <View style={{ padding: 16 }}>
          <Text style={{ color: palette.subtext, fontWeight: '900' }}>Подключаю Health Connect…</Text>
        </View>
      </View>
    );
  }

  if (status === 'NEED_INSTALL') {
    return (
      <View style={[styles.screen, { backgroundColor: palette.bg, padding: 16 }]}>
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.title, { color: palette.text }]}>Нужен Health Connect</Text>
          <Text style={[styles.sub, { color: palette.subtext }]}>
            Установи/обнови Health Connect и дай доступ к данным, чтобы импортировать тренировки.
          </Text>

          <View style={{ height: 12 }} />

          <Pressable
            onPress={() => openHealthConnectSettings()}
            style={({ pressed }) => [
              styles.btnPrimary,
              { backgroundColor: palette.primary, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={styles.btnPrimaryText}>Открыть Health Connect</Text>
          </Pressable>

          <View style={{ height: 10 }} />

          <Pressable
            onPress={async () => {
              try {
                setScreenLoading(true);
                await refreshAll(period);
              } finally {
                setScreenLoading(false);
              }
            }}
            style={({ pressed }) => [
              styles.btn,
              { backgroundColor: palette.inputBg, borderColor: palette.border, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={[styles.btnText, { color: palette.text }]}>Проверить снова</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (status === 'NEED_PERMS') {
    return (
      <View style={[styles.screen, { backgroundColor: palette.bg, padding: 16 }]}>
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.title, { color: palette.text }]}>Нужны разрешения</Text>
          <Text style={[styles.sub, { color: palette.subtext }]}>
            Разреши доступ к Exercise Session, Steps, Distance и Calories — иначе импорт не заработает.
          </Text>

          <View style={{ height: 12 }} />

          <Pressable
            onPress={async () => {
              try {
                setScreenLoading(true);
                await refreshAll(period);
              } finally {
                setScreenLoading(false);
              }
            }}
            style={({ pressed }) => [
              styles.btnPrimary,
              { backgroundColor: palette.primary, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={styles.btnPrimaryText}>Запросить разрешения</Text>
          </Pressable>

          <View style={{ height: 10 }} />

          <Pressable
            onPress={() => openHealthConnectSettings()}
            style={({ pressed }) => [
              styles.btn,
              { backgroundColor: palette.inputBg, borderColor: palette.border, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={[styles.btnText, { color: palette.text }]}>Открыть настройки доступа</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // READY
  const importingLabel =
    importing && importTotal > 0 ? `Импорт… ${importIndex}/${importTotal}` : importing ? 'Импорт…' : null;

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={{ marginBottom: 12 }}>
          <Text style={[styles.pageTitle, { color: palette.text }]}>Импорт из Health Connect</Text>
          <Text style={[styles.pageSubtitle, { color: palette.subtext }]}>
            Найденные сессии можно добавить в дневник тренировок в один тап.
          </Text>
        </View>

        {/* Period */}
        <View style={[styles.section, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Период</Text>
              <Text style={[styles.sectionSubtitle, { color: palette.subtext }]}>
                Импортируются только новые сессии
              </Text>
            </View>

            {refreshing ? <ActivityIndicator color={palette.primary} /> : null}
          </View>

          <View style={{ height: 10 }} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Chip label="Сегодня" active={period === 'today'} onPress={() => setPeriod('today')} palette={palette} />
            <Chip label="7 дней" active={period === '7d'} onPress={() => setPeriod('7d')} palette={palette} />
          </View>

          <Text style={[styles.smallMeta, { color: palette.subtext, marginTop: 10 }]}>
            Последний импорт: {lastImportEnd ? formatLocal(lastImportEnd) : '—'}
          </Text>
        </View>

        {/* Preview */}
        <View style={[styles.section, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Сводка</Text>
          <Text style={[styles.sectionSubtitle, { color: palette.subtext }]}>
            По выбранному периоду (после последнего импорта)
          </Text>

          <View style={{ height: 12 }} />
          <View style={styles.statsRow}>
            <HeaderStat icon="time-outline" value={String(sessions.length)} label="сессий" palette={palette} />
            <HeaderStat icon="map-outline" value={previewDistanceKm.toFixed(2)} label="км" palette={palette} />
            <HeaderStat icon="walk-outline" value={String(previewSteps)} label="шагов" palette={palette} />
            <HeaderStat icon="flame-outline" value={String(previewCalories)} label="ккал" palette={palette} />
          </View>

          <View style={{ height: 12 }} />

          <Pressable
            onPress={importAll}
            disabled={importing || sessions.length === 0}
            style={({ pressed }) => [
              styles.btnPrimary,
              {
                backgroundColor: palette.primary,
                opacity: importing || sessions.length === 0 ? 0.65 : pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text style={styles.btnPrimaryText}>
              {importingLabel ? importingLabel : sessions.length ? 'Импортировать всё' : 'Нет новых сессий'}
            </Text>
          </Pressable>

          <View style={{ height: 10 }} />

          <View style={[styles.hint, { backgroundColor: palette.successBg, borderColor: palette.border }]}>
            <Text style={[styles.hintText, { color: palette.successText }]}>
              Если калорий нет в Health Connect — мы оценим их автоматически.
            </Text>
          </View>
        </View>

        {/* Sessions list */}
        <View style={[styles.section, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Сессии</Text>
          <Text style={[styles.sectionSubtitle, { color: palette.subtext }]}>
            Можно импортировать по одной
          </Text>

          <View style={{ height: 10 }} />

          {sessions.length === 0 ? (
            <View style={[styles.empty, { backgroundColor: palette.inputBg, borderColor: palette.border }]}>
              <Text style={{ color: palette.subtext, fontWeight: '800' }}>
                Новых сессий пока нет.
              </Text>
              <Text style={{ color: palette.subtext, fontWeight: '800', marginTop: 6, lineHeight: 18 }}>
                Попробуй: запусти тренировку на часах/в Google Fit → дождись синхронизации → открой этот экран снова.
              </Text>

              <View style={{ height: 10 }} />

              <View style={[styles.warn, { backgroundColor: palette.warnBg, borderColor: palette.border }]}>
                <Text style={[styles.warnText, { color: palette.warnText }]}>
                  Важно: иногда Health Connect синхронизирует данные с задержкой 1–5 минут.
                </Text>
              </View>
            </View>
          ) : (
            sessions.map((s) => {
              const code = mapExerciseToActivityCode(s.exerciseTypeText);
              const title = titleFor(code);

              return (
                <View
                  key={s.id}
                  style={[styles.sessionCard, { backgroundColor: palette.inputBg, borderColor: palette.border }]}
                >
                  <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                    <View style={[styles.sessionIcon, { backgroundColor: palette.softPrimary }]}>
                      <Ionicons name={iconFor(code)} size={18} color={palette.primary} />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={{ color: palette.text, fontWeight: '900' }} numberOfLines={1}>
                        {title}
                      </Text>
                      <Text style={{ color: palette.subtext, fontWeight: '800', marginTop: 2 }} numberOfLines={2}>
                        {formatLocal(s.startTime)} → {formatLocal(s.endTime)}
                      </Text>
                    </View>

                    <Pressable
                      onPress={() => importSingle(s)}
                      disabled={importing}
                      style={({ pressed }) => [
                        styles.smallBtn,
                        { backgroundColor: palette.primary, opacity: importing ? 0.65 : pressed ? 0.85 : 1 },
                      ]}
                    >
                      <Text style={{ color: '#fff', fontWeight: '900' }}>Импорт</Text>
                    </Pressable>
                  </View>

                  {/* для пользователя полезно: показать “что распознали” */}
                  <Text style={{ color: palette.subtext, fontWeight: '800', marginTop: 8 }} numberOfLines={2}>
                    Распознано: {s.exerciseTypeText ? s.exerciseTypeText : 'тип не указан'}
                  </Text>
                </View>
              );
            })
          )}
        </View>

        <View style={{ height: 18 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, paddingTop: 18, paddingBottom: 24 },

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

  card: { borderRadius: 18, borderWidth: 1, padding: 14 },
  title: { fontSize: 18, fontWeight: '900' },
  sub: { marginTop: 6, fontSize: 13, fontWeight: '800', lineHeight: 18 },

  btn: { borderRadius: 14, borderWidth: 1, paddingVertical: 12, alignItems: 'center' },
  btnText: { fontSize: 14, fontWeight: '900' },

  btnPrimary: { borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  btnPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '900' },

  chip: { flex: 1, borderRadius: 999, borderWidth: 1, paddingVertical: 10, alignItems: 'center' },

  smallMeta: { fontSize: 12, fontWeight: '800', opacity: 0.9 },

  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    width: '48%',
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    minHeight: 98,
    justifyContent: 'center',
    gap: 6,
  },
  statValue: { fontSize: 18, fontWeight: '900' },
  statLabel: { fontSize: 12, fontWeight: '800' },

  hint: { borderWidth: 1, borderRadius: 16, padding: 12 },
  hintText: { fontSize: 12.5, fontWeight: '800', lineHeight: 18 },

  warn: { borderWidth: 1, borderRadius: 14, padding: 10 },
  warnText: { fontSize: 12.5, fontWeight: '900', lineHeight: 18 },

  empty: { borderWidth: 1, borderRadius: 16, padding: 12 },

  sessionCard: { borderWidth: 1, borderRadius: 16, padding: 12, marginTop: 10 },
  sessionIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  smallBtn: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
});