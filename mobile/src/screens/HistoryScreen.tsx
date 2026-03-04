import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/client';

type ActivityType = {
  id: string;
  code: string;
  name: string;
};

type WorkoutMetric = {
  id: string;
  metricKey: string;
  valueNum: number;
  unit?: string | null;
};

type Workout = {
  id: string;
  startedAt: string;
  durationSec?: number | null;
  notes?: string | null;
  activityType: ActivityType;
  metrics: WorkoutMetric[];
};

type Period = 'all' | 'week' | 'month';

function makePalette(isDark: boolean) {
  return {
    bg: isDark ? '#0B0D12' : '#F4F6FA',
    card: isDark ? '#121625' : '#FFFFFF',
    text: isDark ? '#E9ECF5' : '#121722',
    subtext: isDark ? '#A9B1C7' : '#5C667A',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(16,24,40,0.08)',
    primary: '#2D6BFF',
    inputBg: isDark ? 'rgba(255,255,255,0.06)' : '#F2F4F7',
    softPrimary: isDark ? 'rgba(45,107,255,0.16)' : 'rgba(45,107,255,0.10)',
    danger: '#E5484D',
  };
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function formatDuration(sec?: number | null) {
  if (!sec || sec <= 0) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}ч ${m}м`;
  if (m > 0) return `${m}м ${s}с`;
  return `${s}с`;
}

function metricLabel(key: string) {
  const map: Record<string, string> = {
    distance_km: 'Дистанция',
    distance_m: 'Дистанция',
    duration_sec: 'Длительность',
    avg_pace_min_km: 'Темп',
    avg_speed_kmh: 'Скорость',
    steps: 'Шаги',
    calories: 'Калории',
    weight_kg: 'Вес',
    reps: 'Повторы',
    sets: 'Подходы',
    volume_kg: 'Объём',
    elevation_m: 'Высота',
    rounds: 'Раунды',
  };
  return map[key] ?? key;
}

function Segment({
  items,
  value,
  onChange,
  palette,
}: {
  items: { label: string; value: Period }[];
  value: Period;
  onChange: (v: Period) => void;
  palette: ReturnType<typeof makePalette>;
}) {
  return (
    <View style={[styles.segmentWrap, { backgroundColor: palette.inputBg, borderColor: palette.border }]}>
      {items.map((it) => {
        const active = it.value === value;
        return (
          <Pressable
            key={it.value}
            onPress={() => onChange(it.value)}
            style={({ pressed }) => [
              styles.segmentBtn,
              {
                backgroundColor: active ? palette.card : 'transparent',
                borderColor: active ? palette.border : 'transparent',
                opacity: pressed ? 0.86 : 1,
              },
            ]}
          >
            <Text style={[styles.segmentText, { color: active ? palette.text : palette.subtext }]}>
              {it.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ActivityChip({
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
          borderColor: active ? palette.primary : palette.border,
          backgroundColor: active ? palette.softPrimary : palette.inputBg,
          opacity: pressed ? 0.86 : 1,
        },
      ]}
    >
      <Text style={[styles.chipText, { color: active ? palette.primary : palette.text }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function HistoryScreen({ navigation }: any) {
  const scheme = useColorScheme();
  const palette = useMemo(() => makePalette(scheme === 'dark'), [scheme]);

  const [period, setPeriod] = useState<Period>('all');
  const [activityId, setActivityId] = useState<string | 'all'>('all');

  const [activities, setActivities] = useState<ActivityType[]>([]);
  const [items, setItems] = useState<Workout[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const mountedRef = useRef(true);
  const requestSeq = useRef(0);

  const buildParams = useCallback(
    (p: number) => {
      const params: any = { page: p, limit: 12, period };
      if (activityId !== 'all') params.activityTypeId = activityId;
      return params;
    },
    [period, activityId],
  );

  const loadActivities = useCallback(async () => {
    const res = await api.get('/activities');
    const list: ActivityType[] = res?.data?.items ?? [];
    setActivities(list);
  }, []);

  const fetchPage = useCallback(
    async (p: number, mode: 'replace' | 'append') => {
      const seq = ++requestSeq.current;

      const res = await api.get('/workouts', { params: buildParams(p) });
      if (!mountedRef.current) return;
      if (seq !== requestSeq.current) return; // игнорируем устаревшие ответы

      const data = res?.data;
      const newItems: Workout[] = data?.items ?? [];
      const more = !!data?.hasMore;

      setHasMore(more);
      setPage(p);
      setItems((prev) => (mode === 'replace' ? newItems : [...prev, ...newItems]));
    },
    [buildParams],
  );

  const initialLoad = useCallback(async () => {
    setLoading(true);
    try {
      await loadActivities();
      await fetchPage(1, 'replace');
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось загрузить историю');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [fetchPage, loadActivities]);

  // mount + unmount
  useFocusEffect(
    useCallback(() => {
      mountedRef.current = true;
      // авто-обновление при входе на экран
      initialLoad().catch(() => {});
      return () => {
        mountedRef.current = false;
      };
    }, [initialLoad]),
  );

  // авто-перезагрузка при смене фильтров (без кнопок)
  useFocusEffect(
    useCallback(() => {
      // когда экран уже в фокусе и фильтры поменялись — обновим
      fetchPage(1, 'replace').catch(() => {});
    }, [period, activityId, fetchPage]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchPage(1, 'replace');
    } finally {
      setRefreshing(false);
    }
  }, [fetchPage]);

  const onEndReached = useCallback(async () => {
    if (!hasMore || loadingMore || loading || refreshing) return;
    setLoadingMore(true);
    try {
      await fetchPage(page + 1, 'append');
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, loading, refreshing, fetchPage, page]);

  const renderItem = useCallback(
    ({ item }: { item: Workout }) => {
      const topMetrics = (item.metrics ?? []).slice(0, 3);

      return (
        <Pressable
          onPress={() => navigation.navigate('WorkoutDetails', { workoutId: item.id })}
          style={({ pressed }) => [{ opacity: pressed ? 0.88 : 1 }]}
        >
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: palette.text }]} numberOfLines={1}>
                  {item.activityType?.name ?? 'Тренировка'}
                </Text>
                <Text style={[styles.cardSubtitle, { color: palette.subtext }]} numberOfLines={1}>
                  {formatDate(item.startedAt)} • {formatDuration(item.durationSec)}
                </Text>
              </View>

              <View
                style={[
                  styles.badge,
                  { borderColor: palette.border, backgroundColor: palette.softPrimary },
                ]}
              >
                <Text style={[styles.badgeText, { color: palette.primary }]}>{item.activityType?.code}</Text>
              </View>
            </View>

            {topMetrics.length ? (
              <View style={styles.metricsRow}>
                {topMetrics.map((m) => (
                  <View
                    key={m.id}
                    style={[
                      styles.metricPill,
                      { borderColor: palette.border, backgroundColor: palette.inputBg },
                    ]}
                  >
                    <Text style={[styles.metricKey, { color: palette.subtext }]} numberOfLines={1}>
                      {metricLabel(m.metricKey)}
                    </Text>
                    <Text style={[styles.metricVal, { color: palette.text }]} numberOfLines={1}>
                      {Number(m.valueNum).toString()}
                      {m.unit ? ` ${m.unit}` : ''}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {item.notes ? (
              <Text style={[styles.notes, { color: palette.subtext }]} numberOfLines={2}>
                {item.notes}
              </Text>
            ) : null}
          </View>
        </Pressable>
      );
    },
    [navigation, palette],
  );

  const header = useMemo(() => {
    return (
      <View style={[styles.headerCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <Text style={[styles.title, { color: palette.text }]}>История</Text>
        <Text style={[styles.subtitle, { color: palette.subtext }]}>Тренировки по датам</Text>

        <View style={{ marginTop: 12 }}>
          <Text style={[styles.filterLabel, { color: palette.subtext }]}>Период</Text>
          <Segment
            items={[
              { label: 'Все', value: 'all' },
              { label: '7 дней', value: 'week' },
              { label: '30 дней', value: 'month' },
            ]}
            value={period}
            onChange={setPeriod}
            palette={palette}
          />
        </View>

        <View style={{ marginTop: 12 }}>
          <Text style={[styles.filterLabel, { color: palette.subtext }]}>Активность</Text>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <ActivityChip
              label="Все"
              active={activityId === 'all'}
              onPress={() => setActivityId('all')}
              palette={palette}
            />
            <FlatList
              horizontal
              data={activities}
              keyExtractor={(a) => a.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingRight: 4 }}
              renderItem={({ item }) => (
                <ActivityChip
                  label={item.name}
                  active={activityId === item.id}
                  onPress={() => setActivityId(item.id)}
                  palette={palette}
                />
              )}
            />
          </View>
        </View>

        <View style={{ marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[styles.meta, { color: palette.subtext }]}>
            {loading ? 'Загрузка…' : `Показано: ${items.length}${hasMore ? '+' : ''}`}
          </Text>
          {refreshing ? <ActivityIndicator color={palette.primary} /> : null}
        </View>
      </View>
    );
  }, [palette, period, activityId, activities, loading, items.length, hasMore, refreshing]);

  const empty = useMemo(() => {
    if (loading) {
      return (
        <Text style={{ color: palette.subtext, textAlign: 'center', marginTop: 20, fontWeight: '800' }}>
          Загрузка…
        </Text>
      );
    }

    return (
      <View style={{ alignItems: 'center', marginTop: 18, paddingHorizontal: 24 }}>
        <Text style={{ color: palette.subtext, textAlign: 'center', fontWeight: '800', lineHeight: 18 }}>
          Пока нет тренировок. Добавь первую 🙂
        </Text>

        <Pressable
          onPress={() => navigation.navigate('Drawer', { screen: 'AddWorkout' })}
          style={({ pressed }) => [
            styles.ctaBtn,
            { backgroundColor: palette.primary, opacity: pressed ? 0.86 : 1 },
          ]}
        >
          <Text style={styles.ctaText}>Добавить тренировку</Text>
        </Pressable>
      </View>
    );
  }, [loading, palette, navigation]);

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        ListHeaderComponent={header}
        contentContainerStyle={{ padding: 16, paddingTop: 16, paddingBottom: 18 }}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.35}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={empty}
        ListFooterComponent={
          loadingMore ? (
            <View style={{ paddingVertical: 10 }}>
              <Text style={{ color: palette.subtext, textAlign: 'center', fontWeight: '800' }}>
                Загружаю ещё…
              </Text>
            </View>
          ) : (
            <View style={{ height: 6 }} />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },

  headerCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    ...(Platform.OS === 'ios'
      ? { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } }
      : { elevation: 1 }),
  },

  title: { fontSize: 18, fontWeight: '900' },
  subtitle: { marginTop: 4, fontSize: 12.5, fontWeight: '700' },
  filterLabel: { fontSize: 12.5, fontWeight: '900' },
  meta: { fontSize: 12, fontWeight: '800', opacity: 0.9 },

  segmentWrap: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 999,
    padding: 4,
    flexDirection: 'row',
    gap: 6,
  },
  segmentBtn: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  segmentText: { fontSize: 13, fontWeight: '900' },

  chip: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    maxWidth: 160,
  },
  chipText: { fontSize: 13, fontWeight: '900' },

  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    ...(Platform.OS === 'ios'
      ? { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } }
      : { elevation: 1 }),
  },
  cardTitle: { fontSize: 15.5, fontWeight: '900' },
  cardSubtitle: { marginTop: 4, fontSize: 12.5, fontWeight: '700' },

  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 12, fontWeight: '900' },

  metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  metricPill: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8, maxWidth: '48%' },
  metricKey: { fontSize: 11.5, fontWeight: '900' },
  metricVal: { marginTop: 2, fontSize: 13.5, fontWeight: '900' },

  notes: { marginTop: 10, fontSize: 12.5, fontWeight: '700', lineHeight: 18 },

  ctaBtn: { marginTop: 12, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 16 },
  ctaText: { color: '#fff', fontSize: 14.5, fontWeight: '900' },
});