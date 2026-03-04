// mobile/src/screens/RecommendationsScreen.tsx
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { dismissRecommendation, getRecommendations, RecommendationItem } from '../api/recommendationsApi';

function makePalette(isDark: boolean) {
  return {
    bg: isDark ? '#0B0D12' : '#F4F6FA',
    card: isDark ? '#121625' : '#FFFFFF',
    text: isDark ? '#E9ECF5' : '#121722',
    subtext: isDark ? '#A9B1C7' : '#5C667A',
    border: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(16,24,40,0.10)',
    primary: '#2D6BFF',
    danger: '#E5484D',
    inputBg: isDark ? 'rgba(255,255,255,0.06)' : '#F2F4F7',
    softPrimary: isDark ? 'rgba(45,107,255,0.16)' : 'rgba(45,107,255,0.10)',
    softDanger: isDark ? 'rgba(229,72,77,0.18)' : 'rgba(229,72,77,0.10)',
  };
}

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString();
}

function isDismissed(it: any): boolean {
  // поддержим разные варианты бэка (на будущее)
  return Boolean(it?.dismissedAt) || Boolean(it?.isDismissed) || Boolean(it?.dismissed);
}

function SegButton({
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
        styles.segBtn,
        {
          borderColor: active ? palette.primary : palette.border,
          backgroundColor: active ? 'rgba(45,107,255,0.14)' : palette.inputBg,
          opacity: pressed ? 0.86 : 1,
        },
      ]}
    >
      <Text style={[styles.segText, { color: active ? palette.primary : palette.text }]}>{label}</Text>
    </Pressable>
  );
}

export default function RecommendationsScreen() {
  const scheme = useColorScheme();
  const palette = useMemo(() => makePalette(scheme === 'dark'), [scheme]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [items, setItems] = useState<RecommendationItem[]>([]);

  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'active' | 'hidden'>('active');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRecommendations();
      setItems(res.items ?? []);
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось загрузить советы');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      // авто-обновление при входе/возврате на экран
      load().catch(() => {});
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const activeItems = useMemo(() => items.filter((x: any) => !isDismissed(x)), [items]);
  const hiddenItems = useMemo(() => items.filter((x: any) => isDismissed(x)), [items]);

  const base = tab === 'active' ? activeItems : hiddenItems;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return base;

    return base.filter((it: any) => {
      const title = String(it?.template?.title ?? '').toLowerCase();
      const text = String(it?.text ?? '').toLowerCase();
      const reason = String(it?.reason ?? '').toLowerCase();
      return title.includes(q) || text.includes(q) || reason.includes(q);
    });
  }, [base, query]);

  const onDismiss = useCallback(
    async (id: string) => {
      // optimistic UI: сразу убираем из active
      const prev = items;
      setItems((p) => p.filter((x) => x.id !== id));

      try {
        await dismissRecommendation(id);
      } catch (e: any) {
        // откат
        setItems(prev);
        Alert.alert('Ошибка', e?.message ?? 'Не удалось скрыть');
      }
    },
    [items],
  );

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 18, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ marginBottom: 12 }}>
          <Text style={[styles.pageTitle, { color: palette.text }]}>Советы</Text>
          <Text style={[styles.pageSubtitle, { color: palette.subtext }]}>
            Персональные рекомендации на основе твоих тренировок
          </Text>
        </View>

        {/* Controls */}
        <View style={[styles.section, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={[styles.searchRow, { backgroundColor: palette.inputBg, borderColor: palette.border }]}>
            <Ionicons name="search-outline" size={18} color={palette.subtext} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Поиск по советам…"
              placeholderTextColor={palette.subtext}
              style={[styles.searchInput, { color: palette.text }]}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {query ? (
              <Pressable
                onPress={() => setQuery('')}
                style={({ pressed }) => [{ padding: 6, opacity: pressed ? 0.75 : 1 }]}
              >
                <Ionicons name="close-circle" size={18} color={palette.subtext} />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.segRow}>
            <SegButton
              label={`Активные (${activeItems.length})`}
              active={tab === 'active'}
              onPress={() => setTab('active')}
              palette={palette}
            />
            <SegButton
              label={`Скрытые (${hiddenItems.length})`}
              active={tab === 'hidden'}
              onPress={() => setTab('hidden')}
              palette={palette}
            />
          </View>

          <View style={{ marginTop: 10 }}>
            <Text style={[styles.smallMeta, { color: palette.subtext }]}>
              {tab === 'active'
                ? 'Можно скрывать советы — они перестанут появляться.'
                : 'Скрытые советы показаны для истории (если бэк их отдаёт).'}
            </Text>
          </View>
        </View>

        {/* List */}
        <View style={{ gap: 10 }}>
          {loading ? (
            <>
              <View style={[styles.skeleton, { backgroundColor: palette.card, borderColor: palette.border }]} />
              <View style={[styles.skeleton, { backgroundColor: palette.card, borderColor: palette.border }]} />
              <View style={[styles.skeleton, { backgroundColor: palette.card, borderColor: palette.border }]} />
            </>
          ) : filtered.length === 0 ? (
            <View style={[styles.empty, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <View style={[styles.emptyIcon, { backgroundColor: palette.softPrimary }]}>
                <Ionicons name="sparkles-outline" size={20} color={palette.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: palette.text }]}>
                {query ? 'Ничего не найдено' : tab === 'active' ? 'Пока нет активных советов' : 'Пока нет скрытых советов'}
              </Text>
              <Text style={[styles.emptyText, { color: palette.subtext }]}>
                {query
                  ? 'Попробуй изменить запрос.'
                  : 'Добавляй тренировки — система будет подбирать рекомендации.'}
              </Text>
            </View>
          ) : (
            filtered.map((it: any) => (
              <View key={it.id} style={[styles.tip, { backgroundColor: palette.card, borderColor: palette.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={[styles.icon, { backgroundColor: palette.softPrimary }]}>
                    <Ionicons name="sparkles-outline" size={18} color={palette.primary} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.tipTitle, { color: palette.text }]} numberOfLines={2}>
                      {it?.template?.title ?? 'Совет'}
                    </Text>
                    <Text style={[styles.tipMeta, { color: palette.subtext }]} numberOfLines={1}>
                      {formatTime(it.createdAt)}
                    </Text>
                  </View>

                  {tab === 'active' ? (
                    <Pressable
                      onPress={() => onDismiss(it.id)}
                      style={({ pressed }) => [{ padding: 6, opacity: pressed ? 0.75 : 1 }]}
                    >
                      <Ionicons name="close-circle-outline" size={22} color={palette.danger} />
                    </Pressable>
                  ) : (
                    <View style={[styles.hiddenBadge, { backgroundColor: palette.softDanger, borderColor: palette.border }]}>
                      <Text style={[styles.hiddenBadgeText, { color: palette.danger }]}>Скрыто</Text>
                    </View>
                  )}
                </View>

                <Text style={[styles.tipText, { color: palette.text }]}>{it.text}</Text>

                {it.reason ? (
                  <View style={[styles.reasonBox, { backgroundColor: palette.inputBg, borderColor: palette.border }]}>
                    <Text style={[styles.reasonLabel, { color: palette.subtext }]}>Почему этот совет</Text>
                    <Text style={[styles.reasonText, { color: palette.text }]}>{it.reason}</Text>
                  </View>
                ) : null}
              </View>
            ))
          )}
        </View>

        <View style={{ height: 10 }} />
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

  searchRow: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 14.5, fontWeight: '800' },

  segRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  segBtn: { flex: 1, borderWidth: 1, borderRadius: 999, paddingVertical: 10, alignItems: 'center' },
  segText: { fontSize: 12.8, fontWeight: '900' },

  smallMeta: { fontSize: 12, fontWeight: '800', opacity: 0.9 },

  tip: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    ...(Platform.OS === 'ios'
      ? { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 8 } }
      : { elevation: 1 }),
  },

  icon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tipTitle: { fontSize: 14.8, fontWeight: '900' },
  tipMeta: { marginTop: 2, fontSize: 11.5, fontWeight: '800' },
  tipText: { marginTop: 10, fontSize: 13.5, fontWeight: '800', lineHeight: 18 },

  reasonBox: { marginTop: 10, borderRadius: 16, borderWidth: 1, padding: 10 },
  reasonLabel: { fontSize: 11.5, fontWeight: '900' },
  reasonText: { marginTop: 4, fontSize: 12.8, fontWeight: '800', lineHeight: 18 },

  empty: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
  },
  emptyIcon: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { marginTop: 10, fontSize: 14.8, fontWeight: '900', textAlign: 'center' },
  emptyText: { marginTop: 6, fontSize: 12.8, fontWeight: '800', textAlign: 'center', lineHeight: 18 },

  skeleton: { height: 110, borderRadius: 18, borderWidth: 1 },

  hiddenBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  hiddenBadgeText: { fontSize: 12, fontWeight: '900' },
});