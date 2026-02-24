import React, { useEffect, useMemo, useState } from 'react';
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
} from 'react-native';
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
  // чуть “по-человечески”
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
      style={[
        styles.chip,
        {
          borderColor: active ? palette.primary : palette.border,
          backgroundColor: active ? 'rgba(45,107,255,0.14)' : palette.inputBg,
        },
      ]}
    >
      <Text style={[styles.chipText, { color: active ? palette.primary : palette.text }]}>
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

  const loadActivities = async () => {
    const res = await api.get('/activities');
    setActivities(res?.data?.items ?? []);
  };

  const fetchPage = async (p: number, mode: 'replace' | 'append') => {
    const params: any = { page: p, limit: 12, period };
    if (activityId !== 'all') params.activityTypeId = activityId;

    const res = await api.get('/workouts', { params });
    const data = res?.data;

    const newItems: Workout[] = data?.items ?? [];
    const more = !!data?.hasMore;

    setHasMore(more);
    setPage(p);
    setItems((prev) => (mode === 'replace' ? newItems : [...prev, ...newItems]));
  };

  const load = async () => {
    setLoading(true);
    try {
      await loadActivities();
      await fetchPage(1, 'replace');
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось загрузить историю');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // при смене фильтра — перезагрузка
  useEffect(() => {
    if (!loading) {
      fetchPage(1, 'replace').catch(() => {});
    }
  }, [period, activityId]);

  useEffect(() => {
  const unsub = navigation.addListener('focus', () => {
    // когда вернулись с деталей назад — обновим список
    fetchPage(1, 'replace').catch(() => {});
  });
  return unsub;
}, [navigation, period, activityId]);


  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchPage(1, 'replace');
    } finally {
      setRefreshing(false);
    }
  };

  const onEndReached = async () => {
    if (!hasMore || loadingMore || loading || refreshing) return;
    setLoadingMore(true);
    try {
      await fetchPage(page + 1, 'append');
    } finally {
      setLoadingMore(false);
    }
  };

  const renderItem = ({ item }: { item: Workout }) => {
    const topMetrics = (item.metrics ?? []).slice(0, 3);

    return (
  <Pressable
    onPress={() => navigation.navigate('WorkoutDetails', { workoutId: item.id })}
    style={({ pressed }) => [{ opacity: pressed ? 0.88 : 1 }]}
  >
    <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
      {/* ВЕСЬ твой текущий UI карточки оставь как есть */}
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
            { borderColor: palette.border, backgroundColor: 'rgba(45,107,255,0.10)' },
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
              style={[styles.metricPill, { borderColor: palette.border, backgroundColor: palette.inputBg }]}
            >
              <Text style={[styles.metricKey, { color: palette.subtext }]}>{metricLabel(m.metricKey)}</Text>
              <Text style={[styles.metricVal, { color: palette.text }]}>
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

  };

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      <View style={[styles.headerCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <Text style={[styles.title, { color: palette.text }]}>История</Text>
        <Text style={[styles.subtitle, { color: palette.subtext }]}>
          Фильтруй по периоду и активности
        </Text>

        <View style={{ marginTop: 12 }}>
          <Text style={[styles.filterLabel, { color: palette.subtext }]}>Период</Text>
          <View style={styles.rowWrap}>
            <Chip label="Все" active={period === 'all'} onPress={() => setPeriod('all')} palette={palette} />
            <Chip label="7 дней" active={period === 'week'} onPress={() => setPeriod('week')} palette={palette} />
            <Chip label="30 дней" active={period === 'month'} onPress={() => setPeriod('month')} palette={palette} />
          </View>
        </View>

        <View style={{ marginTop: 12 }}>
          <Text style={[styles.filterLabel, { color: palette.subtext }]}>Активность</Text>
          <View style={styles.rowWrap}>
            <Chip label="Все" active={activityId === 'all'} onPress={() => setActivityId('all')} palette={palette} />
            {activities.map((a) => (
              <Chip
                key={a.id}
                label={a.name}
                active={activityId === a.id}
                onPress={() => setActivityId(a.id)}
                palette={palette}
              />
            ))}
          </View>
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, paddingTop: 10, paddingBottom: 18 }}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          loading ? (
            <Text style={{ color: palette.subtext, textAlign: 'center', marginTop: 20, fontWeight: '700' }}>
              Загрузка…
            </Text>
          ) : (
            <Text style={{ color: palette.subtext, textAlign: 'center', marginTop: 20, fontWeight: '700' }}>
              Пока нет тренировок. Добавь первую 🙂
            </Text>
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <Text style={{ color: palette.subtext, textAlign: 'center', marginTop: 10, fontWeight: '700' }}>
              Загружаю ещё…
            </Text>
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
    margin: 16,
    marginBottom: 0,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    ...(Platform.OS === 'ios'
      ? { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } }
      : { elevation: 1 }),
  },

  title: { fontSize: 18, fontWeight: '900' },
  subtitle: { marginTop: 4, fontSize: 12.5, fontWeight: '700' },

  filterLabel: { fontSize: 12.5, fontWeight: '900', marginBottom: 8 },

  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  chip: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  chipText: { fontSize: 13, fontWeight: '800' },

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
  metricPill: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  metricKey: { fontSize: 11.5, fontWeight: '900' },
  metricVal: { marginTop: 2, fontSize: 13.5, fontWeight: '900' },

  notes: { marginTop: 10, fontSize: 12.5, fontWeight: '700', lineHeight: 18 },
});
