import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { getAchievements, AchievementItem } from '../api/achievementsApi';

function makePalette(isDark: boolean) {
  return {
    bg: isDark ? '#0B0D12' : '#F4F6FA',
    card: isDark ? '#121625' : '#FFFFFF',
    text: isDark ? '#E9ECF5' : '#121722',
    subtext: isDark ? '#A9B1C7' : '#5C667A',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(16,24,40,0.08)',
    primary: '#2D6BFF',
    success: '#1F7A2E',
    danger: '#E5484D',
    inputBg: isDark ? 'rgba(255,255,255,0.06)' : '#F2F4F7',
    softPrimary: isDark ? 'rgba(45,107,255,0.16)' : 'rgba(45,107,255,0.10)',
    softSuccess: isDark ? 'rgba(31,122,46,0.18)' : 'rgba(31,122,46,0.10)',
  };
}

function formatDateShort(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString();
}

function Badge({
  text,
  kind,
  palette,
}: {
  text: string;
  kind: 'done' | 'new';
  palette: ReturnType<typeof makePalette>;
}) {
  const bg = kind === 'done' ? palette.softSuccess : palette.softPrimary;
  const color = kind === 'done' ? palette.success : palette.primary;

  return (
    <View style={[styles.badge, { borderColor: palette.border, backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color }]}>{text}</Text>
    </View>
  );
}

export default function AchievementsScreen() {
  const scheme = useColorScheme();
  const palette = useMemo(() => makePalette(scheme === 'dark'), [scheme]);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AchievementItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'earned' | 'locked'>('all');

  const load = async () => {
    setLoading(true);
    try {
      const res = await getAchievements();
      setItems(res.items ?? []);
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось загрузить достижения');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const earnedCount = useMemo(() => items.filter((x) => x.achieved).length, [items]);
  const totalCount = items.length;
  const progress = totalCount ? Math.round((earnedCount / totalCount) * 100) : 0;

  const shown = useMemo(() => {
    const base =
      filter === 'earned' ? items.filter((x) => x.achieved) :
      filter === 'locked' ? items.filter((x) => !x.achieved) :
      items;

    // сначала полученные (или наоборот) — делаем красиво:
    return [...base].sort((a, b) => Number(b.achieved) - Number(a.achieved));
  }, [items, filter]);

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 18, paddingBottom: 24 }}>
        <View style={{ marginBottom: 12 }}>
          <Text style={[styles.pageTitle, { color: palette.text }]}>Достижения</Text>
          <Text style={[styles.pageSubtitle, { color: palette.subtext }]}>
            Бейджи за прогресс и регулярность
          </Text>
        </View>

        {/* Summary */}
        <View style={[styles.section, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Прогресс</Text>
              <Text style={[styles.sectionSubtitle, { color: palette.subtext }]}>
                Получено {earnedCount} из {totalCount || '—'}
              </Text>
            </View>

            <Pressable onPress={load} style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]}>
              <Text style={[styles.link, { color: palette.primary }]}>{loading ? '...' : 'Обновить'}</Text>
            </Pressable>
          </View>

          <View style={{ marginTop: 12 }}>
            <View style={[styles.progressTrack, { backgroundColor: palette.inputBg, borderColor: palette.border }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${progress}%`,
                    backgroundColor: palette.primary,
                  },
                ]}
              />
            </View>
            <Text style={[styles.progressText, { color: palette.subtext }]}>{progress}%</Text>
          </View>

          {/* Filters */}
          <View style={{ marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Pressable
              onPress={() => setFilter('all')}
              style={[
                styles.chip,
                {
                  borderColor: filter === 'all' ? palette.primary : palette.border,
                  backgroundColor: filter === 'all' ? palette.softPrimary : palette.inputBg,
                },
              ]}
            >
              <Text style={[styles.chipText, { color: filter === 'all' ? palette.primary : palette.text }]}>Все</Text>
            </Pressable>

            <Pressable
              onPress={() => setFilter('earned')}
              style={[
                styles.chip,
                {
                  borderColor: filter === 'earned' ? palette.success : palette.border,
                  backgroundColor: filter === 'earned' ? palette.softSuccess : palette.inputBg,
                },
              ]}
            >
              <Text style={[styles.chipText, { color: filter === 'earned' ? palette.success : palette.text }]}>
                Полученные
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setFilter('locked')}
              style={[
                styles.chip,
                {
                  borderColor: filter === 'locked' ? palette.primary : palette.border,
                  backgroundColor: filter === 'locked' ? palette.softPrimary : palette.inputBg,
                },
              ]}
            >
              <Text style={[styles.chipText, { color: filter === 'locked' ? palette.primary : palette.text }]}>
                Закрытые
              </Text>
            </Pressable>
          </View>
        </View>

        {/* List */}
        <View style={{ gap: 12 }}>
          {loading ? (
            <Text style={{ color: palette.subtext, fontWeight: '800', textAlign: 'center', marginTop: 12 }}>
              Загрузка…
            </Text>
          ) : shown.length === 0 ? (
            <Text style={{ color: palette.subtext, fontWeight: '800', textAlign: 'center', marginTop: 12 }}>
              Пусто
            </Text>
          ) : (
            shown.map((a) => {
              const achieved = a.achieved;
              return (
                <View
                  key={a.id}
                  style={[
                    styles.card,
                    {
                      backgroundColor: palette.card,
                      borderColor: achieved ? 'rgba(31,122,46,0.35)' : palette.border,
                      opacity: achieved ? 1 : 0.92,
                    },
                  ]}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cardTitle, { color: palette.text }]}>{a.title}</Text>
                      {a.description ? (
                        <Text style={[styles.cardSubtitle, { color: palette.subtext }]}>{a.description}</Text>
                      ) : null}
                    </View>

                    {achieved ? (
                      <Badge text="Получено" kind="done" palette={palette} />
                    ) : (
                      <Badge text="В процессе" kind="new" palette={palette} />
                    )}
                  </View>

                  <View style={{ marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                    <Text style={[styles.meta, { color: palette.subtext }]}>{a.code}</Text>
                    {achieved ? (
                      <Text style={[styles.meta, { color: palette.subtext }]}>
                        {formatDateShort(a.achievedAt)}
                      </Text>
                    ) : (
                      <Text style={[styles.meta, { color: palette.subtext }]}>—</Text>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View style={{ height: 8 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },

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
  link: { fontSize: 13.5, fontWeight: '900' },

  progressTrack: {
    height: 12,
    borderRadius: 999,
    borderWidth: 1,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 999 },
  progressText: { marginTop: 8, fontSize: 12.5, fontWeight: '800', textAlign: 'right' },

  chip: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  chipText: { fontSize: 13, fontWeight: '800' },

  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    ...(Platform.OS === 'ios'
      ? { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } }
      : { elevation: 1 }),
  },
  cardTitle: { fontSize: 15.5, fontWeight: '900' },
  cardSubtitle: { marginTop: 6, fontSize: 12.5, fontWeight: '700', lineHeight: 18 },

  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontWeight: '900' },

  meta: { fontSize: 12, fontWeight: '800', opacity: 0.95 },
});