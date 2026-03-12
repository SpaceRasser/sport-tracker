import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';

import {
  dismissRecommendation,
  getRecommendations,
  RecommendationItem,
} from '../api/recommendationsApi';
import { getAnalyticsSummary, AnalyticsSummary } from '../api/analyticsApi';
import { getLatestWorkout } from '../api/workoutsApi';

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
  danger: '#E5484D',
};

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString();
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

function formatMetricValue(m: any) {
  const n = Number(m?.valueNum);
  if (!Number.isFinite(n)) return '—';

  if (m?.metricKey === 'distance_m') {
    if (n >= 1000) return `${(n / 1000).toFixed(2)} км`;
    return `${Math.round(n)} м`;
  }

  if (m?.metricKey === 'distance_km') {
    return `${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)} км`;
  }

  if (m?.metricKey === 'calories') return `${Math.round(n)} ккал`;
  if (m?.metricKey === 'steps') return `${Math.round(n)} шагов`;
  if (m?.metricKey === 'weight_kg') return `${n.toFixed(1)} кг`;
  if (m?.metricKey === 'avg_speed_kmh') return `${n.toFixed(1)} км/ч`;

  return `${n % 1 === 0 ? Math.round(n) : n}${m?.unit ? ` ${m.unit}` : ''}`;
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
  title,
  value,
  subtitle,
  icon,
  tint,
  onPress,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  tint: string;
  onPress?: () => void;
}) {
  const body = (
    <View style={styles.summaryStat}>
      <View style={[styles.summaryStatIcon, { backgroundColor: tint }]}>{icon}</View>
      <Text style={styles.summaryStatValue}>{value}</Text>
      <Text style={styles.summaryStatTitle}>{title}</Text>
      <Text style={styles.summaryStatSubtitle}>{subtitle}</Text>
    </View>
  );

  if (!onPress) return body;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}>
      {body}
    </Pressable>
  );
}

function PrimaryButton({
  icon,
  label,
  onPress,
  loading,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  loading?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!!loading}
      style={({ pressed }) => [
        styles.primaryButtonWrap,
        { opacity: loading ? 0.65 : pressed ? 0.9 : 1 },
      ]}
    >
      <LinearGradient
        colors={[palette.purple, palette.purpleDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.primaryButton}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <View style={styles.primaryButtonIcon}>
              <Ionicons name={icon} size={18} color={palette.purpleDark} />
            </View>
            <Text style={styles.primaryButtonText}>{label}</Text>
          </>
        )}
      </LinearGradient>
    </Pressable>
  );
}

function SecondaryButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1, flex: 1 }]}>
      <View style={styles.secondaryButton}>
        <View style={styles.secondaryButtonIcon}>
          <Ionicons name={icon} size={18} color={palette.purple} />
        </View>
        <Text style={styles.secondaryButtonText}>{label}</Text>
      </View>
    </Pressable>
  );
}

export default function HomeScreen({ navigation }: any) {
  const mountedRef = useRef(true);

  const [refreshing, setRefreshing] = useState(false);

  const [loadingRec, setLoadingRec] = useState(true);
  const [recItems, setRecItems] = useState<RecommendationItem[]>([]);
  const topRec = recItems[0] ?? null;

  const [loadingSum, setLoadingSum] = useState(true);
  const [sum, setSum] = useState<AnalyticsSummary | null>(null);

  const [loadingLatest, setLoadingLatest] = useState(true);
  const [latest, setLatest] = useState<any | null>(null);

  const loadRecommendations = useCallback(async () => {
    setLoadingRec(true);
    try {
      const res = await getRecommendations();
      if (!mountedRef.current) return;
      setRecItems(res.items ?? []);
    } catch {
      if (!mountedRef.current) return;
      setRecItems([]);
    } finally {
      if (mountedRef.current) setLoadingRec(false);
    }
  }, []);

  const loadLatest = useCallback(async () => {
    setLoadingLatest(true);
    try {
      const data = await getLatestWorkout();
      if (!mountedRef.current) return;
      setLatest(data.workout ?? null);
    } catch {
      if (!mountedRef.current) return;
      setLatest(null);
    } finally {
      if (mountedRef.current) setLoadingLatest(false);
    }
  }, []);

  const loadSummary = useCallback(async () => {
    setLoadingSum(true);
    try {
      const data = await getAnalyticsSummary();
      if (!mountedRef.current) return;
      setSum(data);
    } catch {
      if (!mountedRef.current) return;
      setSum(null);
    } finally {
      if (mountedRef.current) setLoadingSum(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.allSettled([loadRecommendations(), loadSummary(), loadLatest()]);
  }, [loadRecommendations, loadSummary, loadLatest]);

  useFocusEffect(
    useCallback(() => {
      mountedRef.current = true;
      refreshAll().catch(() => {});
      return () => {
        mountedRef.current = false;
      };
    }, [refreshAll])
  );

  const onPullRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshAll();
    } finally {
      setRefreshing(false);
    }
  }, [refreshAll]);

  const onDismissTop = useCallback(async () => {
    if (!topRec) return;
    try {
      await dismissRecommendation(topRec.id);
      await loadRecommendations();
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось скрыть совет');
    }
  }, [topRec, loadRecommendations]);

  const workouts7 = loadingSum ? '—' : String(sum?.workoutsLast7 ?? '—');
  const prCount = loadingSum ? '—' : String(sum?.prCount ?? '—');
  const achValue = loadingSum ? '—' : `${sum?.achievementsEarned ?? 0}/${sum?.achievementsTotal ?? 0}`;

  const totalWorkoutsLabel = useMemo(() => {
    if (loadingSum) return '—';
    return String(sum?.workoutsTotal ?? '—');
  }, [loadingSum, sum]);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={palette.bg} />
      <LinearGradient colors={[palette.bg, palette.bg2]} style={StyleSheet.absoluteFill} />

      <View style={styles.blobTopRight} pointerEvents="none" />
      <View style={styles.blobLeft} pointerEvents="none" />
      <View style={styles.blobBottom} pointerEvents="none" />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} tintColor={palette.purple} />}
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
          <Text style={styles.heroTitle}>Главная</Text>
          <Text style={styles.heroSubtitle}>
            Сводка, советы и быстрые действия для Ваших тренировок — всё в одном месте.
          </Text>

          <View style={styles.heroMiniRow}>
            <View style={styles.heroMiniPill}>
              <Ionicons name="calendar-outline" size={14} color={palette.purple} />
              <Text style={styles.heroMiniPillText}>{workouts7} за 7 дней</Text>
            </View>

            <View style={styles.heroMiniPill}>
              <Ionicons name="trophy-outline" size={14} color={palette.purple} />
              <Text style={styles.heroMiniPillText}>{prCount} PR</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.mainCard}>
          <Text style={styles.sectionKicker}>ДЕЙСТВИЯ</Text>
          <Text style={styles.sectionTitle}>Быстрый старт</Text>
          <Text style={styles.sectionDescription}>
            Самые частые действия под рукой — добавление тренировки, аналитика и достижения.
          </Text>

          <View style={styles.badgesRow}>
            <InfoBadge
              icon={<Ionicons name="flash" size={14} color={palette.purple} />}
              label="Быстро"
            />
            <InfoBadge
              icon={<Ionicons name="stats-chart" size={14} color={palette.purple} />}
              label="Аналитика"
            />
            <InfoBadge
              icon={<Ionicons name="trophy-outline" size={14} color={palette.purple} />}
              label="Прогресс"
            />
          </View>

          <PrimaryButton
            icon="add-circle-outline"
            label="Добавить тренировку"
            onPress={() => navigation.navigate('AddWorkout')}
          />

          <View style={styles.secondaryRow}>
            <SecondaryButton
              icon="stats-chart-outline"
              label="Аналитика"
              onPress={() => navigation.navigate('Analytics')}
            />
            <SecondaryButton
              icon="trophy-outline"
              label="Достижения"
              onPress={() => navigation.navigate('Achievements')}
            />
          </View>
        </View>

        <View style={styles.statsRow}>
          <SummaryStat
            title="Тренировок"
            value={workouts7}
            subtitle="за 7 дней"
            tint="rgba(124,231,255,0.28)"
            icon={<Ionicons name="calendar-outline" size={18} color={palette.purple} />}
            onPress={() => navigation.navigate('History')}
          />
          <SummaryStat
            title="PR"
            value={prCount}
            subtitle="личных рекордов"
            tint="rgba(255,179,107,0.28)"
            icon={<Ionicons name="flash-outline" size={18} color={palette.purple} />}
            onPress={() => navigation.navigate('Analytics')}
          />
        </View>

        <View style={styles.fullWidthStat}>
          <SummaryStat
            title="Достижения"
            value={achValue}
            subtitle={`Всего тренировок: ${totalWorkoutsLabel}`}
            tint="rgba(255,141,216,0.28)"
            icon={<Ionicons name="trophy-outline" size={18} color={palette.purple} />}
            onPress={() => navigation.navigate('Achievements')}
          />
        </View>

        <View style={styles.mainCard}>
          <Text style={styles.sectionKicker}>СОВЕТ</Text>
          <Text style={styles.sectionTitle}>Совет дня</Text>
          <Text style={styles.sectionDescription}>
            Персональная рекомендация на основе Ваших тренировок и текущего прогресса.
          </Text>

          <View style={{ marginTop: 4 }}>
            {loadingRec ? (
              <View style={styles.skeletonCard} />
            ) : topRec ? (
              <View style={styles.tipCard}>
                <View style={styles.tipHeader}>
                  <View style={styles.tipIcon}>
                    <Ionicons name="sparkles-outline" size={18} color={palette.purple} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.tipTitle} numberOfLines={2}>
                      {topRec.template.title}
                    </Text>
                    <Text style={styles.tipMeta} numberOfLines={1}>
                      {formatTime(topRec.createdAt)}
                    </Text>
                  </View>
                </View>

                <Text style={styles.tipText}>{topRec.text}</Text>

                <View style={styles.tipActionsRow}>
                  <Pressable onPress={onDismissTop} style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1, flex: 1 }]}>
                    <View style={styles.tipGhostBtn}>
                      <Text style={styles.tipGhostBtnText}>Скрыть</Text>
                    </View>
                  </Pressable>

                  <Pressable
                    onPress={() => navigation.navigate('Recommendations')}
                    style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1, flex: 1 }]}
                  >
                    <LinearGradient
                      colors={[palette.purple, palette.purpleDark]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.tipPrimaryBtn}
                    >
                      <Text style={styles.tipPrimaryBtnText}>Все советы</Text>
                    </LinearGradient>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <View style={styles.emptyMiniIcon}>
                  <Ionicons name="sparkles-outline" size={18} color={palette.purple} />
                </View>
                <Text style={styles.emptyCardText}>
                  Пока нет активных советов. Добавьте несколько тренировок — и рекомендации появятся автоматически.
                </Text>

                <Pressable
                  onPress={() => navigation.navigate('Recommendations')}
                  style={({ pressed }) => [{ marginTop: 10, opacity: pressed ? 0.85 : 1 }]}
                >
                  <Text style={styles.linkText}>Открыть экран советов →</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>

        <View style={styles.mainCard}>
          <Text style={styles.sectionKicker}>ПОСЛЕДНЕЕ</Text>
          <Text style={styles.sectionTitle}>Последняя тренировка</Text>
          <Text style={styles.sectionDescription}>
            Быстрый переход к последней сохранённой тренировке и её основным метрикам.
          </Text>

          <View style={{ marginTop: 4 }}>
            {loadingLatest ? (
              <View style={styles.skeletonSmall} />
            ) : latest ? (
              <Pressable
                onPress={() => navigation.navigate('WorkoutDetails', { workoutId: latest.id })}
                style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
              >
                <View style={styles.latestCard}>
                  <View style={styles.latestTopRow}>
                    <View style={styles.latestIcon}>
                      <MaterialCommunityIcons name="dumbbell" size={18} color={palette.purple} />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.latestTitle} numberOfLines={1}>
                        {latest.activityType?.name ?? 'Тренировка'}
                      </Text>
                      <Text style={styles.latestMeta} numberOfLines={1}>
                        {formatTime(latest.startedAt)}
                      </Text>
                    </View>

                    <Ionicons name="chevron-forward" size={18} color={palette.subtext} />
                  </View>

                  <View style={styles.latestMetricsRow}>
                    {(latest.metrics ?? []).slice(0, 3).map((m: any) => (
                      <View key={m.id ?? m.metricKey} style={styles.latestMetric}>
                        <Text style={styles.latestMetricKey} numberOfLines={1}>
                          {metricLabel(m.metricKey)}
                        </Text>
                        <Text style={styles.latestMetricVal} numberOfLines={1}>
                          {formatMetricValue(m)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              </Pressable>
            ) : (
              <View style={styles.emptyCard}>
                <View style={styles.emptyMiniIcon}>
                  <Ionicons name="barbell-outline" size={18} color={palette.purple} />
                </View>
                <Text style={styles.emptyCardText}>
                  Пока нет тренировок. Добавьте первую, и здесь появится быстрый доступ к последней записи.
                </Text>

                <Pressable
                  onPress={() => navigation.navigate('AddWorkout')}
                  style={({ pressed }) => [{ marginTop: 10, opacity: pressed ? 0.85 : 1 }]}
                >
                  <Text style={styles.linkText}>Добавить тренировку →</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>

        <View style={{ height: 16 }} />
      </ScrollView>
    </View>
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

  primaryButtonWrap: {
    borderRadius: 22,
    overflow: 'hidden',
  },

  primaryButton: {
    minHeight: 58,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  primaryButtonIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '900',
  },

  secondaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },

  secondaryButton: {
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.cardSoft,
    justifyContent: 'center',
  },

  secondaryButtonIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  secondaryButtonText: {
    color: palette.text,
    fontSize: 13.8,
    fontWeight: '900',
  },

  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },

  fullWidthStat: {
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

  summaryStatTitle: {
    color: palette.subtext,
    marginTop: 2,
    fontSize: 12,
    fontWeight: '900',
  },

  summaryStatSubtitle: {
    color: palette.subtext,
    marginTop: 2,
    fontSize: 11.5,
    fontWeight: '800',
    textAlign: 'center',
  },

  skeletonCard: {
    height: 120,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.cardSoft,
  },

  skeletonSmall: {
    height: 92,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.cardSoft,
  },

  tipCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 12,
    backgroundColor: palette.cardSoft,
  },

  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  tipIcon: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  tipTitle: {
    color: palette.text,
    fontSize: 14.5,
    fontWeight: '900',
  },

  tipMeta: {
    color: palette.subtext,
    marginTop: 2,
    fontSize: 11.5,
    fontWeight: '800',
  },

  tipText: {
    color: palette.text,
    marginTop: 10,
    fontSize: 13.5,
    fontWeight: '800',
    lineHeight: 18,
  },

  tipActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },

  tipGhostBtn: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.line,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: palette.card,
  },

  tipGhostBtnText: {
    color: palette.danger,
    fontSize: 14,
    fontWeight: '900',
  },

  tipPrimaryBtn: {
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },

  tipPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },

  emptyCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 12,
    backgroundColor: palette.cardSoft,
  },

  emptyMiniIcon: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },

  emptyCardText: {
    color: palette.subtext,
    fontWeight: '800',
    lineHeight: 18,
  },

  linkText: {
    color: palette.purple,
    fontSize: 13.5,
    fontWeight: '900',
  },

  latestCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 12,
    backgroundColor: palette.cardSoft,
  },

  latestTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    alignItems: 'center',
  },

  latestIcon: {
    width: 38,
    height: 38,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  latestTitle: {
    color: palette.text,
    fontSize: 14.5,
    fontWeight: '900',
  },

  latestMeta: {
    color: palette.subtext,
    marginTop: 2,
    fontSize: 11.5,
    fontWeight: '800',
  },

  latestMetricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },

  latestMetric: {
    flex: 1,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: palette.card,
  },

  latestMetricKey: {
    color: palette.subtext,
    fontSize: 11.5,
    fontWeight: '900',
  },

  latestMetricVal: {
    color: palette.text,
    marginTop: 4,
    fontSize: 12.5,
    fontWeight: '900',
  },
});