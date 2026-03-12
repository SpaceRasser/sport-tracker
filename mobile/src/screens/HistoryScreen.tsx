import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
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
};

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

function formatMetricValue(metric: WorkoutMetric) {
  const n = Number(metric.valueNum);
  if (!Number.isFinite(n)) return '—';

  if (metric.metricKey === 'distance_m') {
    if (n >= 1000) return `${(n / 1000).toFixed(2)} км`;
    return `${Math.round(n)} м`;
  }

  if (metric.metricKey === 'distance_km') {
    return `${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)} км`;
  }

  if (metric.metricKey === 'calories') return `${Math.round(n)} ккал`;
  if (metric.metricKey === 'steps') return `${Math.round(n)} шагов`;
  if (metric.metricKey === 'weight_kg') return `${n.toFixed(1)} кг`;
  if (metric.metricKey === 'avg_speed_kmh') return `${n.toFixed(1)} км/ч`;

  return `${n % 1 === 0 ? Math.round(n) : n}${metric.unit ? ` ${metric.unit}` : ''}`;
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
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
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

function WorkoutCard({
  item,
  onPress,
}: {
  item: Workout;
  onPress: () => void;
}) {
  const topMetrics = (item.metrics ?? []).slice(0, 3);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}>
      <View style={styles.workoutCard}>
        <View style={styles.workoutTopRow}>
          <View style={styles.workoutIcon}>
            <MaterialCommunityIcons name="dumbbell" size={18} color={palette.purple} />
          </View>

          <View style={{ flex: 1 }}>
            <View style={styles.workoutHeaderRow}>
              <Text style={styles.workoutTitle} numberOfLines={1}>
                {item.activityType?.name ?? 'Тренировка'}
              </Text>

              <View style={styles.codePill}>
                <Text style={styles.codePillText}>{item.activityType?.code}</Text>
              </View>
            </View>

            <Text style={styles.workoutSub} numberOfLines={2}>
              {formatDate(item.startedAt)} • {formatDuration(item.durationSec)}
            </Text>
          </View>
        </View>

        {topMetrics.length ? (
          <View style={styles.metricsRow}>
            {topMetrics.map((m) => (
              <View key={m.id} style={styles.metricPill}>
                <Text style={styles.metricKey} numberOfLines={1}>
                  {metricLabel(m.metricKey)}
                </Text>
                <Text style={styles.metricVal} numberOfLines={1}>
                  {formatMetricValue(m)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {item.notes ? (
          <Text style={styles.notes} numberOfLines={2}>
            {item.notes}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <View style={styles.emptyBox}>
      <View style={styles.emptyIcon}>
        <Ionicons name="calendar-outline" size={22} color={palette.purple} />
      </View>

      <Text style={styles.emptyTitle}>Пока нет тренировок</Text>
      <Text style={styles.emptySub}>
        Добавьте первую тренировку, чтобы здесь появилась история занятий.
      </Text>

      <Pressable onPress={onAdd} style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}>
        <LinearGradient
          colors={[palette.purple, palette.purpleDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.emptyCta}
        >
          <Text style={styles.emptyCtaText}>Добавить тренировку</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

export default function HistoryScreen({ navigation }: any) {
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
  const initializedRef = useRef(false);

  const buildParams = useCallback(
    (p: number) => {
      const params: any = { page: p, limit: 12, period };
      if (activityId !== 'all') params.activityTypeId = activityId;
      return params;
    },
    [period, activityId]
  );

  const loadActivities = useCallback(async () => {
    const res = await api.get('/activities');
    const list: ActivityType[] = res?.data?.items ?? [];
    if (mountedRef.current) setActivities(list);
  }, []);

  const fetchPage = useCallback(
    async (p: number, mode: 'replace' | 'append') => {
      const seq = ++requestSeq.current;

      const res = await api.get('/workouts', { params: buildParams(p) });
      if (!mountedRef.current) return;
      if (seq !== requestSeq.current) return;

      const data = res?.data;
      const newItems: Workout[] = data?.items ?? [];
      const more = !!data?.hasMore;

      setHasMore(more);
      setPage(p);
      setItems((prev) => (mode === 'replace' ? newItems : [...prev, ...newItems]));
    },
    [buildParams]
  );

  const initialLoad = useCallback(async () => {
    setLoading(true);
    try {
      await loadActivities();
      await fetchPage(1, 'replace');
      initializedRef.current = true;
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось загрузить историю');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [fetchPage, loadActivities]);

  useFocusEffect(
    useCallback(() => {
      mountedRef.current = true;
      initialLoad().catch(() => {});
      return () => {
        mountedRef.current = false;
      };
    }, [initialLoad])
  );

  useEffect(() => {
    if (!initializedRef.current) return;

    (async () => {
      try {
        setLoading(true);
        await fetchPage(1, 'replace');
      } catch (e: any) {
        Alert.alert('Ошибка', e?.message ?? 'Не удалось обновить историю');
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();
  }, [period, activityId, fetchPage]);

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

  const loadedCountLabel = useMemo(() => {
    if (loading) return 'Загрузка…';
    return `Показано: ${items.length}${hasMore ? '+' : ''}`;
  }, [loading, items.length, hasMore]);

  const header = useMemo(() => {
    return (
      <View>
        <LinearGradient
          colors={[palette.purple, palette.purpleDark, '#7B61FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroBlobTop} />
          <View style={styles.heroBlobBottom} />

          <Text style={styles.heroKicker}>SPORTTRACKER</Text>
          <Text style={styles.heroTitle}>История</Text>
          <Text style={styles.heroSubtitle}>
            Просматривайте прошлые тренировки, фильтруйте занятия по периоду и активности.
          </Text>

          <View style={styles.heroMiniRow}>
            <View style={styles.heroMiniPill}>
              <Ionicons name="calendar-outline" size={14} color={palette.purple} />
              <Text style={styles.heroMiniPillText}>
                {period === 'all' ? 'Все даты' : period === 'week' ? '7 дней' : '30 дней'}
              </Text>
            </View>

            <View style={styles.heroMiniPill}>
              <Ionicons name="albums-outline" size={14} color={palette.purple} />
              <Text style={styles.heroMiniPillText}>{items.length}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.statsRow}>
          <SummaryStat
            value={String(items.length)}
            label="загружено"
            tint="rgba(124,231,255,0.28)"
            icon={<Ionicons name="list" size={18} color={palette.purple} />}
          />
          <SummaryStat
            value={String(activities.length)}
            label="активностей"
            tint="rgba(255,179,107,0.28)"
            icon={<Ionicons name="barbell" size={18} color={palette.purple} />}
          />
          <SummaryStat
            value={hasMore ? 'Да' : 'Нет'}
            label="ещё данные"
            tint="rgba(255,141,216,0.28)"
            icon={<Ionicons name="chevron-down-circle-outline" size={18} color={palette.purple} />}
          />
        </View>

        <View style={styles.mainCard}>
          <Text style={styles.sectionKicker}>ФИЛЬТРЫ</Text>
          <Text style={styles.sectionTitle}>История тренировок</Text>
          <Text style={styles.sectionDescription}>
            Быстро находите нужные тренировки по периоду и типу активности.
          </Text>

          <View style={styles.badgesRow}>
            <InfoBadge
              icon={<Ionicons name="time-outline" size={14} color={palette.purple} />}
              label="Период"
            />
            <InfoBadge
              icon={<Ionicons name="fitness-outline" size={14} color={palette.purple} />}
              label="Активности"
            />
            <InfoBadge
              icon={<Ionicons name="flash" size={14} color={palette.purple} />}
              label="Быстрый поиск"
            />
          </View>

          <Text style={styles.filterLabel}>Период</Text>
          <View style={styles.filtersRow}>
            <FilterChip label="Все" active={period === 'all'} onPress={() => setPeriod('all')} />
            <FilterChip label="7 дней" active={period === 'week'} onPress={() => setPeriod('week')} />
            <FilterChip label="30 дней" active={period === 'month'} onPress={() => setPeriod('month')} />
          </View>

          <Text style={[styles.filterLabel, { marginTop: 14 }]}>Активность</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.activityRow}
          >
            <FilterChip label="Все" active={activityId === 'all'} onPress={() => setActivityId('all')} />
            {activities.map((item) => (
              <FilterChip
                key={item.id}
                label={item.name}
                active={activityId === item.id}
                onPress={() => setActivityId(item.id)}
              />
            ))}
          </ScrollView>

          <View style={styles.metaRow}>
            <Text style={styles.metaText}>{loadedCountLabel}</Text>
            {refreshing ? <ActivityIndicator color={palette.purple} /> : null}
          </View>
        </View>
      </View>
    );
  }, [period, items.length, hasMore, activities, activityId, loadedCountLabel, refreshing]);

  const empty = useMemo(() => {
    if (loading) {
      return (
        <Text style={styles.loadingText}>Загрузка…</Text>
      );
    }

    return (
      <EmptyState onAdd={() => navigation.navigate('Drawer', { screen: 'AddWorkout' })} />
    );
  }, [loading, navigation]);

  const renderItem = useCallback(
    ({ item }: { item: Workout }) => (
      <WorkoutCard
        item={item}
        onPress={() => navigation.navigate('WorkoutDetails', { workoutId: item.id })}
      />
    ),
    [navigation]
  );

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={palette.bg} />
      <LinearGradient colors={[palette.bg, palette.bg2]} style={StyleSheet.absoluteFill} />

      <View style={styles.blobTopRight} pointerEvents="none" />
      <View style={styles.blobLeft} pointerEvents="none" />
      <View style={styles.blobBottom} pointerEvents="none" />

      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        contentContainerStyle={styles.listContent}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.35}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.purple} />}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoading}>
              <Text style={styles.footerLoadingText}>Загружаем ещё…</Text>
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
  screen: {
    flex: 1,
    backgroundColor: palette.bg,
  },

  listContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 20,
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

  heroMiniRow: {
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

  summaryStat: {
    flex: 1,
    backgroundColor: palette.card,
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.line,
  },

  summaryStatIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },

  summaryStatValue: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '900',
  },

  summaryStatLabel: {
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

  filterLabel: {
    color: palette.subtext,
    fontSize: 12.5,
    fontWeight: '900',
  },

  filtersRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },

  activityRow: {
    gap: 8,
    paddingTop: 8,
    paddingRight: 4,
  },

  filterChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: 160,
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

  metaRow: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  metaText: {
    color: palette.subtext,
    fontSize: 12,
    fontWeight: '800',
  },

  workoutCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 14,
    marginBottom: 12,
    backgroundColor: palette.card,
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: '#000',
          shadowOpacity: 0.04,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 8 },
        }
      : { elevation: 1 }),
  },

  workoutTopRow: {
    flexDirection: 'row',
    gap: 12,
  },

  workoutIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: palette.cardSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  workoutHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    alignItems: 'flex-start',
  },

  workoutTitle: {
    flex: 1,
    color: palette.text,
    fontSize: 15.5,
    fontWeight: '900',
    paddingTop: 2,
  },

  workoutSub: {
    color: palette.subtext,
    marginTop: 4,
    fontSize: 12.5,
    fontWeight: '700',
    lineHeight: 18,
  },

  codePill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: palette.cardSoft,
    borderWidth: 1,
    borderColor: palette.line,
    alignSelf: 'flex-start',
    maxWidth: 110,
  },

  codePillText: {
    color: palette.purple,
    fontSize: 12,
    fontWeight: '900',
  },

  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },

  metricPill: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: palette.cardSoft,
    maxWidth: '48%',
  },

  metricKey: {
    color: palette.subtext,
    fontSize: 11.5,
    fontWeight: '900',
  },

  metricVal: {
    color: palette.text,
    marginTop: 2,
    fontSize: 13.5,
    fontWeight: '900',
  },

  notes: {
    color: palette.subtext,
    marginTop: 10,
    fontSize: 12.5,
    fontWeight: '700',
    lineHeight: 18,
  },

  emptyBox: {
    backgroundColor: palette.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: 18,
    paddingVertical: 24,
    alignItems: 'center',
    marginTop: 6,
  },

  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: palette.cardSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  emptyTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },

  emptySub: {
    color: palette.subtext,
    marginTop: 6,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '700',
    textAlign: 'center',
  },

  emptyCta: {
    marginTop: 14,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },

  emptyCtaText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '900',
  },

  loadingText: {
    color: palette.subtext,
    textAlign: 'center',
    marginTop: 20,
    fontWeight: '800',
  },

  footerLoading: {
    paddingVertical: 10,
  },

  footerLoadingText: {
    color: palette.subtext,
    textAlign: 'center',
    fontWeight: '800',
  },
});