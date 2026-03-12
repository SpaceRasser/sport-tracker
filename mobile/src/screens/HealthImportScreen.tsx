import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as SecureStore from 'expo-secure-store';
import { useFocusEffect } from '@react-navigation/native';

import { api } from '../api/client';
import { useOnboarding } from '../onboarding/OnboardingContext';

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
  exerciseTypeText?: string;
};

const HC_LAST_IMPORT_KEY = 'hc_last_import_end_time';
const MAX_LIMIT = 50;

const palette = {
  bg: '#F5F2FF',
  bg2: '#EEE9FF',
  card: '#FFFFFF',
  cardSoft: '#F4F0FF',

  purple: '#6D4CFF',
  purpleDark: '#5137D7',

  text: '#2D244D',
  subtext: '#7D739D',
  muted: '#9D95BA',
  line: '#E6E0FA',

  cyan: '#7CE7FF',
  pink: '#FF8DD8',
  orange: '#FFB36B',
  green: '#24A865',
  greenSoft: 'rgba(36,168,101,0.10)',
  purpleSoftBg: 'rgba(109,76,255,0.10)',
  warnBg: 'rgba(255,179,107,0.12)',
  warnText: '#8A5A00',
};

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
  if (code === 'BIKE') return 'bicycle-outline' as const;
  return 'walk-outline' as const;
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

async function getImportedHealthConnectSessionIds(): Promise<Set<string>> {
  const ids = new Set<string>();

  try {
    const now = new Date();
    const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    for (let page = 1; page <= 5; page++) {
      const res = await api.get('/workouts', {
        params: { from, limit: 200, page },
      });

      const items = res?.data?.items ?? [];
      if (!Array.isArray(items) || items.length === 0) break;

      for (const w of items) {
        const notes = String(w?.notes ?? '');
        const match = notes.match(/HC_SESSION:([^\s]+)/);
        if (match?.[1]) {
          ids.add(match[1]);
        }
      }

      if (items.length < 200) break;
    }
  } catch {
    // тихо
  }

  return ids;
}

function StatusBadge({
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

function StatCard({
  icon,
  value,
  label,
  tint,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  tint: string;
}) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIconWrap, { backgroundColor: tint }]}>{icon}</View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.88 : 1 }]}>
      <View
        style={[
          styles.filterChip,
          active ? styles.filterChipActive : styles.filterChipInactive,
        ]}
      >
        <Text
          style={[
            styles.filterChipText,
            { color: active ? '#FFFFFF' : palette.purple },
          ]}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

function PrimaryButton({
  title,
  onPress,
  disabled,
  loading,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.primaryButton,
        { opacity: disabled ? 0.6 : pressed ? 0.92 : 1 },
      ]}
    >
      <LinearGradient
        colors={[palette.purple, palette.purpleDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.primaryButtonGradient}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>{title}</Text>}
      </LinearGradient>
    </Pressable>
  );
}

function SecondaryButton({
  title,
  onPress,
  disabled,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.secondaryButton,
        { opacity: disabled ? 0.6 : pressed ? 0.92 : 1 },
      ]}
    >
      <Text style={styles.secondaryButtonText}>{title}</Text>
    </Pressable>
  );
}

function CoachCard({
  title,
  text,
  primaryLabel = 'Понятно',
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
        colors={['rgba(109,76,255,0.14)', 'rgba(123,97,255,0.08)']}
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
          <Pressable onPress={onSkip} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1, flex: 1 }]}>
            <View style={styles.coachGhostBtn}>
              <Text style={styles.coachGhostBtnText}>Пропустить</Text>
            </View>
          </Pressable>
        ) : null}

        <Pressable onPress={onNext} style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1, flex: 1 }]}>
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

export default function HealthConnectScreen() {
  const { step, nextStep, skipOnboarding } = useOnboarding();

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
  const [importIndex, setImportIndex] = useState(0);
  const [importTotal, setImportTotal] = useState(0);

  const [coachStage, setCoachStage] = useState<0 | 1 | 2 | 3>(0);

  const mounted = useRef(true);

  const isHealthConnectOnboarding = step === 'healthConnect';
  const showConnectCoach = isHealthConnectOnboarding && status !== 'READY' && coachStage === 0;
  const showPeriodCoach = isHealthConnectOnboarding && status === 'READY' && coachStage === 1;
  const showImportCoach = isHealthConnectOnboarding && status === 'READY' && coachStage === 2;
  const showListCoach = isHealthConnectOnboarding && status === 'READY' && coachStage === 3;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (isHealthConnectOnboarding) {
      setCoachStage(0);
    }
  }, [isHealthConnectOnboarding]);

  useEffect(() => {
    if (isHealthConnectOnboarding && status === 'READY' && coachStage === 0) {
      setCoachStage(1);
    }
  }, [isHealthConnectOnboarding, status, coachStage]);

  useEffect(() => {
    (async () => {
      const saved = await SecureStore.getItemAsync(HC_LAST_IMPORT_KEY);
      if (mounted.current) setLastImportEnd(saved ?? null);
    })();
  }, []);

  const openSettingsSafe = useCallback(async () => {
    try {
      await openHealthConnectSettings();
    } catch {
      Alert.alert(
        'Health Connect',
        'Не удалось открыть Health Connect автоматически. Откройте его вручную в настройках устройства.'
      );
    }
  }, []);

  const ensureReady = useCallback(async () => {
    setStatus('INIT');

    if (Platform.OS !== 'android') {
      setStatus('ERROR');
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

      const start = lastImportEnd
        ? new Date(Math.max(new Date(base.startTime).getTime(), new Date(lastImportEnd).getTime()))
        : new Date(base.startTime);

      const timeRange = { startTime: start.toISOString(), endTime: base.endTime };

      const rawSessions = await readAll('ExerciseSession', timeRange);
      const importedIds = await getImportedHealthConnectSessionIds();

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
        .filter((s) => !importedIds.has(s.id))
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

      if (!mounted.current) return;

      setSessions(list);

      const [stepsRecs, distRecs, calRecs] = await Promise.all([
        readAll('Steps', timeRange),
        readAll('Distance', timeRange),
        readAll('ActiveCaloriesBurned', timeRange),
      ]);

      const totalSteps = stepsRecs.reduce((acc, r: any) => acc + safeNum(r?.count), 0);
      const totalDistM = distRecs.reduce(
        (acc, r: any) => acc + safeNum(r?.distance?.inMeters ?? r?.distance),
        0
      );
      const totalDistKm = totalDistM / 1000;
      const totalCals = calRecs.reduce(
        (acc, r: any) => acc + safeNum(r?.energy?.inKilocalories ?? r?.energy),
        0
      );

      setPreviewSteps(Math.round(totalSteps));
      setPreviewDistanceKm(Math.round(totalDistKm * 100) / 100);
      setPreviewCalories(Math.round(totalCals));
    },
    [lastImportEnd]
  );

  const refreshAll = useCallback(
    async (p: Period, mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'refresh') setRefreshing(true);

      try {
        const ok = await ensureReady();

        if (!ok) {
          setSessions([]);
          setPreviewDistanceKm(0);
          setPreviewSteps(0);
          setPreviewCalories(0);
          return;
        }

        await loadSessionsInternal(p);
      } finally {
        if (mode === 'refresh' && mounted.current) setRefreshing(false);
      }
    },
    [ensureReady, loadSessionsInternal]
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      (async () => {
        try {
          setScreenLoading(true);
          await refreshAll(period, 'initial');
        } catch (e: any) {
          if (!cancelled) {
            setStatus('ERROR');
            Alert.alert('Ошибка', e?.message ?? 'Не удалось инициализировать Health Connect');
          }
        } finally {
          if (!cancelled && mounted.current) setScreenLoading(false);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [period, refreshAll])
  );

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
    if (!activity) throw new Error('Нет activityType для WALK/RUN/BIKE. Проверьте seed activities.');

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
    const distM = distRecs.reduce(
      (acc, r: any) => acc + safeNum(r?.distance?.inMeters ?? r?.distance),
      0
    );
    const distKm = distM / 1000;

    const cals = calRecs.reduce(
      (acc, r: any) => acc + safeNum(r?.energy?.inKilocalories ?? r?.energy),
      0
    );
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
      const maxEnd = importedSessions
        .map((x) => new Date(x.endTime).getTime())
        .filter((t) => Number.isFinite(t));

      if (createdCount > 0 && maxEnd.length) {
        const maxIso = new Date(Math.max(...maxEnd)).toISOString();
        await SecureStore.setItemAsync(HC_LAST_IMPORT_KEY, maxIso);
        setLastImportEnd(maxIso);
      }

      setRefreshing(true);
      try {
        await loadSessionsInternal(period);
      } finally {
        setRefreshing(false);
      }
    },
    [loadSessionsInternal, period]
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

      if (showImportCoach) {
        setCoachStage(3);
      }

      Alert.alert('Импорт завершён', `Добавлено: ${created}\nПропущено: ${skipped}`);
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? 'Не удалось импортировать';
      Alert.alert('Ошибка', String(msg));
    } finally {
      setImporting(false);
      setImportIndex(0);
      setImportTotal(0);
    }
  }, [sessions, importOneSession, afterImportRefreshAndCursor, showImportCoach]);

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

        if (showListCoach) {
          nextStep();
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
    [importOneSession, afterImportRefreshAndCursor, showListCoach, nextStep]
  );

  const importingLabel =
    importing && importTotal > 0 ? `Импорт… ${importIndex}/${importTotal}` : importing ? 'Импорт…' : null;

  const statusTitle =
    status === 'NEED_INSTALL'
      ? 'Подключите Health Connect'
      : status === 'NEED_PERMS'
      ? 'Нужны разрешения'
      : status === 'ERROR'
      ? 'Что-то пошло не так'
      : 'Проверяем Health Connect';

  const statusSubtitle =
    status === 'NEED_INSTALL'
      ? 'На этом устройстве Health Connect недоступен или не установлен. После подключения вернитесь сюда, и импорт заработает.'
      : status === 'NEED_PERMS'
      ? 'Чтобы читать тренировки, шаги, дистанцию и калории, приложению нужен доступ к данным Health Connect.'
      : status === 'ERROR'
      ? 'Не удалось проверить состояние Health Connect. Повторите попытку ещё раз.'
      : 'Подождите немного, приложение проверяет доступ к данным Health Connect.';

  if (screenLoading) {
    return (
      <View style={styles.screen}>
        <StatusBar barStyle="dark-content" backgroundColor={palette.bg} />
        <LinearGradient colors={[palette.bg, palette.bg2]} style={StyleSheet.absoluteFill} />
        <View style={styles.blobTopRight} pointerEvents="none" />
        <View style={styles.blobLeft} pointerEvents="none" />
        <View style={styles.blobBottom} pointerEvents="none" />

        <View style={styles.centerWrap}>
          <LinearGradient
            colors={[palette.purple, palette.purpleDark, '#7B61FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.heroBlobTop} />
            <View style={styles.heroBlobBottom} />

            <Text style={styles.heroKicker}>SPORTTRACKER</Text>
            <Text style={styles.heroTitle}>Health Connect</Text>
            <Text style={styles.heroSubtitle}>Проверяем доступ и подключение…</Text>

            <View style={styles.heroCircle}>
              <ActivityIndicator color={palette.purple} />
            </View>
          </LinearGradient>
        </View>
      </View>
    );
  }

  if (status !== 'READY') {
    return (
      <View style={styles.screen}>
        <StatusBar barStyle="dark-content" backgroundColor={palette.bg} />
        <LinearGradient colors={[palette.bg, palette.bg2]} style={StyleSheet.absoluteFill} />
        <View style={styles.blobTopRight} pointerEvents="none" />
        <View style={styles.blobLeft} pointerEvents="none" />
        <View style={styles.blobBottom} pointerEvents="none" />

        <ScrollView contentContainerStyle={styles.gateScrollContent} showsVerticalScrollIndicator={false}>
          <LinearGradient
            colors={[palette.purple, palette.purpleDark, '#7B61FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.heroBlobTop} />
            <View style={styles.heroBlobBottom} />

            <Text style={styles.heroKicker}>SPORTTRACKER</Text>
            <Text style={styles.heroTitle}>Health Connect</Text>
            <Text style={styles.heroSubtitle}>{statusTitle}</Text>

            <View style={styles.heroCircle}>
              <Ionicons
                name={status === 'NEED_PERMS' ? 'shield-checkmark' : 'fitness'}
                size={30}
                color={palette.purple}
              />
            </View>
          </LinearGradient>

          <View style={styles.mainCard}>
            <Text style={styles.sectionKicker}>ПОДКЛЮЧЕНИЕ</Text>
            <Text style={styles.sectionTitle}>{statusTitle}</Text>
            <Text style={styles.sectionDescription}>{statusSubtitle}</Text>

            {showConnectCoach ? (
              <CoachCard
                title="Подключите Health Connect"
                text="Сначала дайте доступ к данным. После этого приложение сможет читать тренировки, шаги, дистанцию и калории."
                primaryLabel="Проверить доступ"
                onNext={async () => {
                  try {
                    setScreenLoading(true);
                    await refreshAll(period, 'initial');
                  } finally {
                    setScreenLoading(false);
                  }
                }}
                onSkip={skipOnboarding}
              />
            ) : null}

            <View style={styles.badgesRow}>
              <StatusBadge
                icon={<Ionicons name="flash" size={14} color={palette.purple} />}
                label="Импорт тренировок"
              />
              <StatusBadge
                icon={<Ionicons name="walk" size={14} color={palette.purple} />}
                label="Шаги и дистанция"
              />
              <StatusBadge
                icon={<Ionicons name="flame" size={14} color={palette.purple} />}
                label="Калории"
              />
            </View>

            <PrimaryButton
              title={status === 'NEED_PERMS' ? 'Запросить доступ' : 'Проверить снова'}
              onPress={async () => {
                try {
                  setScreenLoading(true);
                  await refreshAll(period, 'initial');
                } finally {
                  setScreenLoading(false);
                }
              }}
            />

            <View style={{ height: 10 }} />

            <SecondaryButton title="Открыть Health Connect" onPress={openSettingsSafe} />

            <View style={styles.warnBox}>
              <Text style={styles.warnText}>
                После подключения Вы сможете импортировать данные из других совместимых приложений и часов через Health Connect.
              </Text>
            </View>
          </View>
        </ScrollView>
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
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => refreshAll(period, 'refresh')}
            tintColor={palette.purple}
          />
        }
      >
        <LinearGradient
          colors={[palette.purple, palette.purpleDark, '#7B61FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroBlobTop} />
          <View style={styles.heroBlobBottom} />

          <Text style={styles.heroKicker}>SPORTTRACKER</Text>
          <Text style={styles.heroTitle}>Health Connect</Text>
          <Text style={styles.heroSubtitle}>
            Импортируйте найденные сессии в дневник и управляйте источниками данных в одном месте.
          </Text>

          <View style={styles.heroPillsRow}>
            <View style={styles.heroMiniPill}>
              <Ionicons name="calendar-outline" size={14} color={palette.purple} />
              <Text style={styles.heroMiniPillText}>{period === 'today' ? 'Сегодня' : '7 дней'}</Text>
            </View>

            <View style={styles.heroMiniPill}>
              <Ionicons name="checkmark-circle" size={14} color={palette.purple} />
              <Text style={styles.heroMiniPillText}>Подключено</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.statsRow}>
          <StatCard
            value={String(sessions.length)}
            label="сессий"
            tint="rgba(124,231,255,0.28)"
            icon={<Ionicons name="time-outline" size={18} color={palette.purple} />}
          />
          <StatCard
            value={previewDistanceKm.toFixed(2)}
            label="км"
            tint="rgba(255,179,107,0.28)"
            icon={<Ionicons name="map-outline" size={18} color={palette.purple} />}
          />
          <StatCard
            value={String(previewSteps)}
            label="шагов"
            tint="rgba(255,141,216,0.28)"
            icon={<Ionicons name="walk-outline" size={18} color={palette.purple} />}
          />
        </View>

        <View style={styles.mainCard}>
          <Text style={styles.sectionKicker}>ИСТОЧНИКИ</Text>
          <Text style={styles.sectionTitle}>Связанные приложения</Text>
          <Text style={styles.sectionDescription}>
            Через Health Connect можно объединять данные из других совместимых приложений, часов и фитнес-сервисов.
          </Text>

          <View style={styles.badgesRow}>
            <StatusBadge
              icon={<Ionicons name="watch-outline" size={14} color={palette.purple} />}
              label="Часы"
            />
            <StatusBadge
              icon={<Ionicons name="fitness-outline" size={14} color={palette.purple} />}
              label="Фитнес-приложения"
            />
            <StatusBadge
              icon={<Ionicons name="sync-outline" size={14} color={palette.purple} />}
              label="Синхронизация"
            />
          </View>

          <SecondaryButton title="Открыть Health Connect" onPress={openSettingsSafe} />

          <Text style={styles.metaText}>
            Последний импорт: {lastImportEnd ? formatLocal(lastImportEnd) : '—'}
          </Text>
        </View>

        <View style={styles.mainCard}>
          <Text style={styles.sectionKicker}>ИМПОРТ</Text>
          <Text style={styles.sectionTitle}>Новые сессии</Text>
          <Text style={styles.sectionDescription}>
            Импортируются только данные после последнего успешного импорта.
          </Text>

          {showPeriodCoach ? (
            <CoachCard
              title="Смените период"
              text="Можно смотреть только сегодняшние данные или сразу последние 7 дней. Это влияет на список сессий ниже."
              onNext={() => setCoachStage(2)}
              onSkip={skipOnboarding}
            />
          ) : null}

          <View style={styles.filtersRow}>
            <FilterChip
              label="Сегодня"
              active={period === 'today'}
              onPress={() => {
                setPeriod('today');
                if (showPeriodCoach) setCoachStage(2);
              }}
            />
            <FilterChip
              label="7 дней"
              active={period === '7d'}
              onPress={() => {
                setPeriod('7d');
                if (showPeriodCoach) setCoachStage(2);
              }}
            />
          </View>

          <View style={{ height: 12 }} />

          <View style={styles.importSummaryBox}>
            <Text style={styles.importSummaryText}>
              Калории из Health Connect используются напрямую. Если они отсутствуют, приложение оценит их автоматически.
            </Text>
          </View>

          <Text style={styles.metaText}>Калории за период: {previewCalories} ккал</Text>

          {showImportCoach ? (
            <View style={{ marginTop: 12 }}>
              <CoachCard
                title="Импортируйте всё разом"
                text="Эта кнопка добавит все найденные сессии в дневник. Уже импортированные записи будут автоматически пропущены."
                primaryLabel={sessions.length ? 'Импортировать' : 'Далее'}
                onNext={() => {
                  if (sessions.length) {
                    importAll().catch(() => {});
                  } else {
                    setCoachStage(3);
                  }
                }}
                onSkip={skipOnboarding}
              />
            </View>
          ) : null}

          <View style={{ height: 12 }} />

          <PrimaryButton
            title={importingLabel ? importingLabel : sessions.length ? 'Импортировать всё' : 'Нет новых сессий'}
            onPress={importAll}
            disabled={importing || sessions.length === 0}
            loading={false}
          />
        </View>

        <View style={styles.mainCard}>
          <Text style={styles.sectionKicker}>СПИСОК</Text>
          <Text style={styles.sectionTitle}>Сессии для импорта</Text>
          <Text style={styles.sectionDescription}>Можно импортировать каждую запись отдельно.</Text>

          {showListCoach ? (
            <CoachCard
              title="Можно импортировать по одной"
              text="Если не хотите загружать всё сразу, импортируйте отдельные сессии вручную кнопкой справа."
              primaryLabel="Завершить"
              onNext={nextStep}
              onSkip={skipOnboarding}
            />
          ) : null}

          {sessions.length === 0 ? (
            <View style={styles.emptyBox}>
              <View style={styles.emptyIcon}>
                <Ionicons name="cloud-offline-outline" size={22} color={palette.purple} />
              </View>
              <Text style={styles.emptyTitle}>Новых сессий пока нет</Text>
              <Text style={styles.emptySub}>
                Попробуйте запустить тренировку на часах или в другом приложении, дождаться синхронизации и открыть экран ещё раз.
              </Text>

              <View style={styles.warnBox}>
                <Text style={styles.warnText}>
                  Иногда синхронизация в Health Connect появляется с задержкой в несколько минут.
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.sessionsList}>
              {sessions.map((s) => {
                const code = mapExerciseToActivityCode(s.exerciseTypeText);
                const title = titleFor(code);

                return (
                  <View key={s.id} style={styles.sessionCard}>
                    <View style={styles.sessionRowTop}>
                      <View style={styles.sessionIcon}>
                        <Ionicons name={iconFor(code)} size={18} color={palette.purple} />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.sessionTitle} numberOfLines={1}>
                          {title}
                        </Text>
                        <Text style={styles.sessionTime} numberOfLines={2}>
                          {formatLocal(s.startTime)} → {formatLocal(s.endTime)}
                        </Text>
                      </View>

                      <Pressable
                        onPress={() => importSingle(s)}
                        disabled={importing}
                        style={({ pressed }) => [
                          styles.smallActionBtn,
                          { opacity: importing ? 0.65 : pressed ? 0.88 : 1 },
                        ]}
                      >
                        <Text style={styles.smallActionBtnText}>Импорт</Text>
                      </Pressable>
                    </View>

                    <View style={styles.sessionTypePill}>
                      <Text style={styles.sessionTypePillText}>
                        Распознано: {s.exerciseTypeText ? s.exerciseTypeText : 'тип не указан'}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.bg,
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
  },

  gateScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
    minHeight: '100%',
    justifyContent: 'center',
  },

  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },

  blobTopRight: {
    position: 'absolute',
    top: -20,
    right: -10,
    width: 140,
    height: 100,
    backgroundColor: 'rgba(109,76,255,0.14)',
    borderBottomLeftRadius: 56,
    borderBottomRightRadius: 22,
    borderTopLeftRadius: 80,
    borderTopRightRadius: 12,
  },

  blobLeft: {
    position: 'absolute',
    left: -28,
    top: 240,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(184,168,255,0.16)',
  },

  blobBottom: {
    position: 'absolute',
    right: -20,
    bottom: 150,
    width: 120,
    height: 76,
    backgroundColor: 'rgba(124,231,255,0.16)',
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
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#6D4CFF',
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },

  heroBlobTop: {
    position: 'absolute',
    top: -20,
    right: -12,
    width: 120,
    height: 84,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderBottomLeftRadius: 56,
    borderBottomRightRadius: 26,
    borderTopLeftRadius: 70,
    borderTopRightRadius: 16,
  },

  heroBlobBottom: {
    position: 'absolute',
    bottom: -12,
    left: -10,
    width: 128,
    height: 64,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 36,
    borderBottomLeftRadius: 80,
    borderBottomRightRadius: 38,
  },

  heroKicker: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.6,
    marginBottom: 12,
  },

  heroTitle: {
    color: '#FFFFFF',
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '900',
    marginBottom: 10,
    maxWidth: '86%',
  },

  heroSubtitle: {
    color: 'rgba(255,255,255,0.84)',
    fontSize: 14.5,
    lineHeight: 21,
    fontWeight: '600',
    maxWidth: '92%',
    marginBottom: 18,
  },

  heroCircle: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    shadowColor: '#2D244D',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },

  heroPillsRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },

  heroMiniPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  heroMiniPillText: {
    color: palette.purple,
    fontSize: 12.5,
    fontWeight: '800',
    marginLeft: 6,
  },

  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 16,
  },

  statCard: {
    flex: 1,
    backgroundColor: palette.card,
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.line,
  },

  statIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },

  statValue: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '900',
  },

  statLabel: {
    color: palette.subtext,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
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
    fontWeight: '900',
    letterSpacing: 1.6,
    marginBottom: 8,
  },

  sectionTitle: {
    color: palette.text,
    fontSize: 29,
    lineHeight: 32,
    fontWeight: '900',
    marginBottom: 8,
  },

  sectionDescription: {
    color: palette.subtext,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    marginBottom: 16,
  },

  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },

  infoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.cardSoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  infoBadgeText: {
    color: palette.purple,
    fontSize: 12.5,
    fontWeight: '800',
    marginLeft: 6,
  },

  coachCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(109,76,255,0.16)',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    padding: 12,
    marginBottom: 12,
  },

  coachHeader: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },

  coachIcon: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
  },

  coachTitle: {
    color: palette.text,
    fontSize: 14.5,
    fontWeight: '900',
  },

  coachText: {
    color: palette.subtext,
    fontSize: 12.8,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 4,
  },

  coachActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },

  coachGhostBtn: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.line,
    paddingVertical: 11,
    alignItems: 'center',
    backgroundColor: palette.cardSoft,
  },

  coachGhostBtnText: {
    color: palette.subtext,
    fontSize: 13.5,
    fontWeight: '900',
  },

  coachPrimaryBtn: {
    borderRadius: 16,
    paddingVertical: 11,
    alignItems: 'center',
  },

  coachPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '900',
  },

  filterChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexGrow: 1,
  },

  filterChipActive: {
    backgroundColor: palette.purple,
  },

  filterChipInactive: {
    backgroundColor: palette.cardSoft,
  },

  filterChipText: {
    fontSize: 12.5,
    fontWeight: '800',
    textAlign: 'center',
  },

  filtersRow: {
    flexDirection: 'row',
    gap: 8,
  },

  primaryButton: {
    borderRadius: 22,
    overflow: 'hidden',
  },

  primaryButtonGradient: {
    minHeight: 58,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '900',
  },

  secondaryButton: {
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: palette.cardSoft,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },

  secondaryButtonText: {
    color: palette.purple,
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
  },

  metaText: {
    color: palette.subtext,
    marginTop: 12,
    fontSize: 12.5,
    fontWeight: '800',
  },

  importSummaryBox: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.cardSoft,
    padding: 12,
  },

  importSummaryText: {
    color: palette.subtext,
    fontSize: 12.5,
    fontWeight: '800',
    lineHeight: 18,
  },

  sessionsList: {
    gap: 12,
  },

  sessionCard: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 20,
    padding: 12,
    backgroundColor: palette.cardSoft,
  },

  sessionRowTop: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },

  sessionIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  sessionTitle: {
    color: palette.text,
    fontWeight: '900',
    fontSize: 14.5,
  },

  sessionTime: {
    color: palette.subtext,
    fontWeight: '800',
    marginTop: 2,
    lineHeight: 18,
  },

  smallActionBtn: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: palette.purple,
  },

  smallActionBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },

  sessionTypePill: {
    marginTop: 10,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: palette.line,
    maxWidth: '100%',
  },

  sessionTypePillText: {
    color: palette.subtext,
    fontWeight: '800',
    fontSize: 12,
  },

  emptyBox: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 16,
    alignItems: 'center',
    backgroundColor: palette.cardSoft,
  },

  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },

  emptyTitle: {
    color: palette.text,
    fontSize: 14.5,
    fontWeight: '900',
    textAlign: 'center',
  },

  emptySub: {
    color: palette.subtext,
    marginTop: 6,
    fontSize: 12.5,
    fontWeight: '700',
    lineHeight: 18,
    textAlign: 'center',
  },

  warnBox: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.warnBg,
    padding: 12,
  },

  warnText: {
    color: palette.warnText,
    fontSize: 12.5,
    fontWeight: '800',
    lineHeight: 18,
  },
});