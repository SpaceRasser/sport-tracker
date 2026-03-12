import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';

import {
  dismissRecommendation,
  getRecommendations,
  RecommendationItem,
} from '../api/recommendationsApi';

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
  danger: '#E5484D',
  dangerSoft: 'rgba(229,72,77,0.10)',
};

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString();
}

function isDismissed(it: any): boolean {
  return Boolean(it?.dismissedAt) || Boolean(it?.isDismissed) || Boolean(it?.dismissed);
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

function RecommendationCard({
  item,
  hidden,
  onDismiss,
}: {
  item: any;
  hidden: boolean;
  onDismiss: () => void;
}) {
  return (
    <View style={styles.tipCard}>
      <View style={styles.tipHeader}>
        <View style={styles.tipIcon}>
          <Ionicons
            name={hidden ? 'eye-off-outline' : 'sparkles-outline'}
            size={18}
            color={hidden ? palette.danger : palette.purple}
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.tipTitle} numberOfLines={2}>
            {item?.template?.title ?? 'Совет'}
          </Text>
          <Text style={styles.tipMeta} numberOfLines={1}>
            {formatTime(item.createdAt)}
          </Text>
        </View>

        {hidden ? (
          <View style={styles.hiddenBadge}>
            <Text style={styles.hiddenBadgeText}>Скрыто</Text>
          </View>
        ) : (
          <Pressable onPress={onDismiss} style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1, padding: 4 }]}>
            <Ionicons name="close-circle-outline" size={22} color={palette.danger} />
          </Pressable>
        )}
      </View>

      <Text style={styles.tipText}>{item.text}</Text>

      {item.reason ? (
        <View style={styles.reasonBox}>
          <Text style={styles.reasonLabel}>Почему этот совет</Text>
          <Text style={styles.reasonText}>{item.reason}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function RecommendationsScreen() {
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
      load().catch(() => {});
    }, [load])
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
      const prev = items;
      setItems((p) => p.filter((x) => x.id !== id));

      try {
        await dismissRecommendation(id);
      } catch (e: any) {
        setItems(prev);
        Alert.alert('Ошибка', e?.message ?? 'Не удалось скрыть совет');
      }
    },
    [items]
  );

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={palette.bg} />
      <LinearGradient colors={[palette.bg, palette.bg2]} style={StyleSheet.absoluteFill} />

      <View style={styles.blobTopRight} pointerEvents="none" />
      <View style={styles.blobLeft} pointerEvents="none" />
      <View style={styles.blobBottom} pointerEvents="none" />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.purple} />}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
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
          <Text style={styles.heroTitle}>Советы</Text>
          <Text style={styles.heroSubtitle}>
            Персональные рекомендации на основе Ваших тренировок, активности и текущего прогресса.
          </Text>

          <View style={styles.heroMiniRow}>
            <View style={styles.heroMiniPill}>
              <Ionicons name="sparkles-outline" size={14} color={palette.purple} />
              <Text style={styles.heroMiniPillText}>{activeItems.length} активных</Text>
            </View>

            <View style={styles.heroMiniPill}>
              <Ionicons name="eye-off-outline" size={14} color={palette.purple} />
              <Text style={styles.heroMiniPillText}>{hiddenItems.length} скрытых</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.statsRow}>
          <SummaryStat
            value={String(activeItems.length)}
            label="активных"
            tint="rgba(124,231,255,0.28)"
            icon={<Ionicons name="flash-outline" size={18} color={palette.purple} />}
          />
          <SummaryStat
            value={String(hiddenItems.length)}
            label="скрытых"
            tint="rgba(255,141,216,0.28)"
            icon={<Ionicons name="eye-off-outline" size={18} color={palette.purple} />}
          />
          <SummaryStat
            value={String(filtered.length)}
            label="показано"
            tint="rgba(255,179,107,0.28)"
            icon={<Ionicons name="list-outline" size={18} color={palette.purple} />}
          />
        </View>

        <View style={styles.mainCard}>
          <Text style={styles.sectionKicker}>ФИЛЬТРЫ</Text>
          <Text style={styles.sectionTitle}>Поиск и категории</Text>
          <Text style={styles.sectionDescription}>
            Ищите советы по тексту и переключайтесь между активными и скрытыми рекомендациями.
          </Text>

          <View style={styles.badgesRow}>
            <InfoBadge
              icon={<Ionicons name="search-outline" size={14} color={palette.purple} />}
              label="Поиск"
            />
            <InfoBadge
              icon={<Ionicons name="sparkles-outline" size={14} color={palette.purple} />}
              label="Рекомендации"
            />
            <InfoBadge
              icon={<Ionicons name="eye-off-outline" size={14} color={palette.purple} />}
              label="Скрытие"
            />
          </View>

          <View style={styles.searchRow}>
            <Ionicons name="search-outline" size={18} color={palette.subtext} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Поиск по советам…"
              placeholderTextColor={palette.subtext}
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {query ? (
              <Pressable onPress={() => setQuery('')} style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1, padding: 4 }]}>
                <Ionicons name="close-circle" size={18} color={palette.subtext} />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.filtersRow}>
            <FilterChip
              label={`Активные (${activeItems.length})`}
              active={tab === 'active'}
              onPress={() => setTab('active')}
            />
            <FilterChip
              label={`Скрытые (${hiddenItems.length})`}
              active={tab === 'hidden'}
              onPress={() => setTab('hidden')}
            />
          </View>

          <Text style={styles.smallMeta}>
            {tab === 'active'
              ? 'Активные советы можно скрывать — они перестанут показываться в списке.'
              : 'Скрытые советы оставлены для истории, если сервер продолжает их возвращать.'}
          </Text>
        </View>

        <View style={styles.listWrap}>
          {loading ? (
            <>
              <View style={styles.skeleton} />
              <View style={styles.skeleton} />
              <View style={styles.skeleton} />
            </>
          ) : filtered.length === 0 ? (
            <View style={styles.emptyBox}>
              <View style={styles.emptyIcon}>
                <Ionicons name="sparkles-outline" size={20} color={palette.purple} />
              </View>

              <Text style={styles.emptyTitle}>
                {query
                  ? 'Ничего не найдено'
                  : tab === 'active'
                  ? 'Пока нет активных советов'
                  : 'Пока нет скрытых советов'}
              </Text>

              <Text style={styles.emptyText}>
                {query
                  ? 'Попробуйте изменить поисковый запрос.'
                  : 'Добавляйте тренировки — система будет подбирать рекомендации автоматически.'}
              </Text>
            </View>
          ) : (
            filtered.map((it: any) => (
              <RecommendationCard
                key={it.id}
                item={it}
                hidden={tab === 'hidden'}
                onDismiss={() => onDismiss(it.id)}
              />
            ))
          )}
        </View>

        <View style={{ height: 10 }} />
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
    textAlign: 'center',
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

  searchRow: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.cardSoft,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  searchInput: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '800',
    color: palette.text,
  },

  filtersRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },

  filterChip: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },

  filterChipActive: {
    backgroundColor: palette.purple,
  },

  filterChipInactive: {
    backgroundColor: palette.cardSoft,
  },

  filterChipText: {
    fontSize: 12.8,
    fontWeight: '900',
    textAlign: 'center',
  },

  smallMeta: {
    color: palette.subtext,
    fontSize: 12,
    fontWeight: '800',
    opacity: 0.9,
    marginTop: 12,
    lineHeight: 18,
  },

  listWrap: {
    gap: 12,
  },

  tipCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 14,
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

  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  tipIcon: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.cardSoft,
  },

  tipTitle: {
    color: palette.text,
    fontSize: 14.8,
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

  reasonBox: {
    marginTop: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 10,
    backgroundColor: palette.cardSoft,
  },

  reasonLabel: {
    color: palette.subtext,
    fontSize: 11.5,
    fontWeight: '900',
  },

  reasonText: {
    color: palette.text,
    marginTop: 4,
    fontSize: 12.8,
    fontWeight: '800',
    lineHeight: 18,
  },

  emptyBox: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 18,
    alignItems: 'center',
    backgroundColor: palette.card,
  },

  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.cardSoft,
  },

  emptyTitle: {
    color: palette.text,
    marginTop: 10,
    fontSize: 14.8,
    fontWeight: '900',
    textAlign: 'center',
  },

  emptyText: {
    color: palette.subtext,
    marginTop: 6,
    fontSize: 12.8,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 18,
  },

  skeleton: {
    height: 118,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card,
  },

  hiddenBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: palette.dangerSoft,
  },

  hiddenBadgeText: {
    color: palette.danger,
    fontSize: 12,
    fontWeight: '900',
  },
});