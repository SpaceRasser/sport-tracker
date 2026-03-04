import React, { useCallback, useMemo, useRef, useState } from 'react';
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
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import {
  dismissRecommendation,
  getRecommendations,
  RecommendationItem,
} from '../api/recommendationsApi';
import { getAnalyticsSummary, AnalyticsSummary } from '../api/analyticsApi';
import { getLatestWorkout } from '../api/workoutsApi';

function makePalette(isDark: boolean) {
  return {
    bg: isDark ? '#0B0D12' : '#F4F6FA',
    card: isDark ? '#121625' : '#FFFFFF',
    text: isDark ? '#E9ECF5' : '#121722',
    subtext: isDark ? '#A9B1C7' : '#5C667A',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(16,24,40,0.08)',
    primary: '#2D6BFF',
    inputBg: isDark ? 'rgba(255,255,255,0.06)' : '#F2F4F7',
    danger: '#E5484D',
    success: '#20B26B',
    softPrimary: isDark ? 'rgba(45,107,255,0.16)' : 'rgba(45,107,255,0.10)',
  };
}

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString();
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  palette,
  onPress,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  palette: ReturnType<typeof makePalette>;
  onPress?: () => void;
}) {
  const body = (
    <View style={[styles.statCard, { backgroundColor: palette.inputBg, borderColor: palette.border }]}>
      <View style={[styles.statIcon, { backgroundColor: palette.softPrimary }]}>
        <Ionicons name={icon} size={16} color={palette.primary} />
      </View>

      <Text style={[styles.statValue, { color: palette.text }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.statTitle, { color: palette.subtext }]} numberOfLines={1}>
        {title}
      </Text>
      <Text style={[styles.statSub, { color: palette.subtext }]} numberOfLines={1}>
        {subtitle}
      </Text>
    </View>
  );

  if (!onPress) return body;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.86 : 1 }]}>
      {body}
    </Pressable>
  );
}

function PrimaryButton({
  icon,
  label,
  palette,
  onPress,
  loading,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  palette: ReturnType<typeof makePalette>;
  onPress: () => void;
  loading?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!!loading}
      style={({ pressed }) => [
        styles.primaryBtn,
        { backgroundColor: palette.primary, opacity: loading ? 0.65 : pressed ? 0.88 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <>
          <Ionicons name={icon} size={20} color="#fff" />
          <Text style={[styles.primaryBtnText, { color: '#fff' }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

function SecondaryButton({
  icon,
  label,
  palette,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  palette: ReturnType<typeof makePalette>;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryBtn,
        { backgroundColor: palette.inputBg, borderColor: palette.border, opacity: pressed ? 0.88 : 1 },
      ]}
    >
      <Ionicons name={icon} size={18} color={palette.primary} />
      <Text style={[styles.secondaryBtnText, { color: palette.text }]}>{label}</Text>
    </Pressable>
  );
}

export default function HomeScreen({ navigation }: any) {
  const scheme = useColorScheme();
  const palette = useMemo(() => makePalette(scheme === 'dark'), [scheme]);

  const mountedRef = useRef(true);

  const [refreshing, setRefreshing] = useState(false);

  // Recommendations
  const [loadingRec, setLoadingRec] = useState(true);
  const [recItems, setRecItems] = useState<RecommendationItem[]>([]);
  const topRec = recItems[0] ?? null;

  // Summary
  const [loadingSum, setLoadingSum] = useState(true);
  const [sum, setSum] = useState<AnalyticsSummary | null>(null);

  // Latest workout
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
    }, [refreshAll]),
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

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} />}
      >
        {/* Header */}
        <View style={styles.headerWrap}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.pageTitle, { color: palette.text }]}>Главная</Text>
            <Text style={[styles.pageSubtitle, { color: palette.subtext }]}>
              Сводка, советы и быстрые действия
            </Text>
          </View>

          <Pressable
            onPress={onPullRefresh}
            style={({ pressed }) => [
              styles.refreshBtn,
              { backgroundColor: palette.card, borderColor: palette.border, opacity: pressed ? 0.86 : 1 },
            ]}
          >
            <Ionicons name="refresh" size={18} color={palette.primary} />
          </Pressable>
        </View>

        {/* Quick actions */}
        <View style={[styles.section, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Быстрые действия</Text>
          <Text style={[styles.sectionSubtitle, { color: palette.subtext }]}>Самое частое — под рукой</Text>

          <View style={{ marginTop: 12, gap: 10 }}>
            <PrimaryButton
              icon="add-circle-outline"
              label="Добавить тренировку"
              palette={palette}
              onPress={() => navigation.navigate('AddWorkout')}
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <SecondaryButton
                  icon="stats-chart-outline"
                  label="Аналитика"
                  palette={palette}
                  onPress={() => navigation.navigate('Analytics')}
                />
              </View>
              <View style={{ flex: 1 }}>
                <SecondaryButton
                  icon="trophy-outline"
                  label="Достижения"
                  palette={palette}
                  onPress={() => navigation.navigate('Achievements')}
                />
              </View>
            </View>
          </View>
        </View>

        {/* Summary */}
        <View style={[styles.section, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.sectionHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Сводка</Text>
              <Text style={[styles.sectionSubtitle, { color: palette.subtext }]}>Быстрые цифры по прогрессу</Text>
            </View>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statsRow2}>
              <View style={{ flex: 1 }}>
                <StatCard
                  title="Тренировок"
                  value={workouts7}
                  subtitle="за 7 дней"
                  icon="calendar-outline"
                  palette={palette}
                  onPress={() => navigation.navigate('History')}
                />
              </View>

              <View style={{ width: 10 }} />

              <View style={{ flex: 1 }}>
                <StatCard
                  title="PR"
                  value={prCount}
                  subtitle="личных рекордов"
                  icon="flash-outline"
                  palette={palette}
                  onPress={() => navigation.navigate('Analytics')}
                />
              </View>
            </View>

            <View style={{ height: 10 }} />

            <StatCard
              title="Достижения"
              value={achValue}
              subtitle="получено"
              icon="trophy-outline"
              palette={palette}
              onPress={() => navigation.navigate('Achievements')}
            />

            <Text style={[styles.smallMeta, { color: palette.subtext, marginTop: 10 }]}>
              Всего тренировок: {loadingSum ? '—' : String(sum?.workoutsTotal ?? '—')}
            </Text>
          </View>
        </View>

        {/* Tip of the day */}
        <View style={[styles.section, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.sectionHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Совет дня</Text>
              <Text style={[styles.sectionSubtitle, { color: palette.subtext }]}>
                На основе профиля и тренировок
              </Text>
            </View>
          </View>

          <View style={{ marginTop: 12 }}>
            {loadingRec ? (
              <View style={[styles.skeleton, { backgroundColor: palette.inputBg, borderColor: palette.border }]} />
            ) : topRec ? (
              <View style={[styles.tipCard, { backgroundColor: palette.inputBg, borderColor: palette.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={[styles.tipIcon, { backgroundColor: palette.softPrimary }]}>
                    <Ionicons name="sparkles-outline" size={18} color={palette.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.tipTitle, { color: palette.text }]} numberOfLines={2}>
                      {topRec.template.title}
                    </Text>
                    <Text style={[styles.tipMeta, { color: palette.subtext }]} numberOfLines={1}>
                      {formatTime(topRec.createdAt)}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.tipText, { color: palette.text }]}>{topRec.text}</Text>

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                  <Pressable
                    onPress={onDismissTop}
                    style={({ pressed }) => [
                      styles.btn,
                      { backgroundColor: palette.card, borderColor: palette.border, opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    <Text style={[styles.btnText, { color: palette.danger }]}>Скрыть</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => navigation.navigate('Recommendations')}
                    style={({ pressed }) => [
                      styles.btn,
                      { backgroundColor: palette.primary, borderColor: 'transparent', opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    <Text style={[styles.btnText, { color: '#fff' }]}>Все советы</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={[styles.emptyCard, { backgroundColor: palette.inputBg, borderColor: palette.border }]}>
                <Text style={{ color: palette.subtext, fontWeight: '800' }}>
                  Пока нет активных советов. Добавь пару тренировок — и появятся рекомендации 🙂
                </Text>

                <Pressable
                  onPress={() => navigation.navigate('Recommendations')}
                  style={({ pressed }) => [{ marginTop: 10, opacity: pressed ? 0.8 : 1 }]}
                >
                  <Text style={[styles.link, { color: palette.primary }]}>Открыть экран советов →</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>

        {/* Latest workout */}
        <View style={[styles.section, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.sectionHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Последняя тренировка</Text>
              <Text style={[styles.sectionSubtitle, { color: palette.subtext }]}>Быстрый переход к деталям</Text>
            </View>
          </View>

          <View style={{ marginTop: 12 }}>
            {loadingLatest ? (
              <View style={[styles.skeletonSmall, { backgroundColor: palette.inputBg, borderColor: palette.border }]} />
            ) : latest ? (
              <Pressable
                onPress={() => navigation.navigate('WorkoutDetails', { workoutId: latest.id })}
                style={({ pressed }) => [{ opacity: pressed ? 0.88 : 1 }]}
              >
                <View style={[styles.latestCard, { backgroundColor: palette.inputBg, borderColor: palette.border }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.latestTitle, { color: palette.text }]} numberOfLines={1}>
                        {latest.activityType?.name ?? 'Тренировка'}
                      </Text>
                      <Text style={[styles.latestMeta, { color: palette.subtext }]} numberOfLines={1}>
                        {formatTime(latest.startedAt)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={palette.subtext} />
                  </View>

                  <View style={styles.latestMetricsRow}>
                    {(latest.metrics ?? []).slice(0, 3).map((m: any) => (
                      <View
                        key={m.id ?? m.metricKey}
                        style={[styles.latestMetric, { borderColor: palette.border, backgroundColor: palette.card }]}
                      >
                        <Text style={[styles.latestMetricKey, { color: palette.subtext }]} numberOfLines={1}>
                          {m.metricKey}
                        </Text>
                        <Text style={[styles.latestMetricVal, { color: palette.text }]} numberOfLines={1}>
                          {Number(m.valueNum).toString()}
                          {m.unit ? ` ${m.unit}` : ''}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              </Pressable>
            ) : (
              <View style={[styles.emptyCard, { backgroundColor: palette.inputBg, borderColor: palette.border }]}>
                <Text style={{ color: palette.subtext, fontWeight: '800' }}>
                  Пока нет тренировок. Добавь первую — и тут появится быстрый доступ.
                </Text>

                <Pressable
                  onPress={() => navigation.navigate('AddWorkout')}
                  style={({ pressed }) => [{ marginTop: 10, opacity: pressed ? 0.8 : 1 }]}
                >
                  <Text style={[styles.link, { color: palette.primary }]}>Добавить тренировку →</Text>
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
  screen: { flex: 1 },
  content: { padding: 16, paddingTop: 18, paddingBottom: 24 },

  headerWrap: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  refreshBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

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

  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    alignItems: 'center',
  },

  sectionTitle: { fontSize: 15.5, fontWeight: '900' },
  sectionSubtitle: { marginTop: 4, fontSize: 12.5, fontWeight: '700' },

  link: { fontSize: 13.5, fontWeight: '900' },

  statsGrid: { marginTop: 12 },
  statsRow2: { flexDirection: 'row' },

  statCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    minHeight: 108,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  statIcon: {
    width: 30,
    height: 30,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statValue: { fontSize: 18, fontWeight: '900' },
  statTitle: { marginTop: 2, fontSize: 12, fontWeight: '900' },
  statSub: { marginTop: 2, fontSize: 11.5, fontWeight: '800' },
  smallMeta: { fontSize: 12, fontWeight: '800', opacity: 0.9 },

  skeleton: { height: 120, borderRadius: 16, borderWidth: 1 },
  skeletonSmall: { height: 92, borderRadius: 16, borderWidth: 1 },

  tipCard: { borderRadius: 16, borderWidth: 1, padding: 12 },
  tipIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tipTitle: { fontSize: 14.5, fontWeight: '900' },
  tipMeta: { marginTop: 2, fontSize: 11.5, fontWeight: '800' },
  tipText: { marginTop: 10, fontSize: 13.5, fontWeight: '800', lineHeight: 18 },

  btn: { flex: 1, borderRadius: 14, borderWidth: 1, paddingVertical: 12, alignItems: 'center' },
  btnText: { fontSize: 14, fontWeight: '900' },

  emptyCard: { borderRadius: 16, borderWidth: 1, padding: 12 },

  primaryBtn: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryBtnText: { fontSize: 14.5, fontWeight: '900' },

  secondaryBtn: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
  },
  secondaryBtnText: { fontSize: 13.8, fontWeight: '900' },

  latestCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  latestTitle: { fontSize: 14.5, fontWeight: '900' },
  latestMeta: { marginTop: 2, fontSize: 11.5, fontWeight: '800' },

  latestMetricsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  latestMetric: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  latestMetricKey: { fontSize: 11.5, fontWeight: '900' },
  latestMetricVal: { marginTop: 4, fontSize: 12.5, fontWeight: '900' },
});