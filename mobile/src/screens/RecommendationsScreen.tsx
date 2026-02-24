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
import { Ionicons } from '@expo/vector-icons';
import { dismissRecommendation, getRecommendations, RecommendationItem } from '../api/recommendationsApi';

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
  };
}

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString();
}

export default function RecommendationsScreen() {
  const scheme = useColorScheme();
  const palette = useMemo(() => makePalette(scheme === 'dark'), [scheme]);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<RecommendationItem[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getRecommendations();
      setItems(res.items ?? []);
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось загрузить советы');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onDismiss = async (id: string) => {
    try {
      await dismissRecommendation(id);
      await load();
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось скрыть');
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 18, paddingBottom: 24 }}>
        <View style={{ marginBottom: 12 }}>
          <Text style={[styles.pageTitle, { color: palette.text }]}>Советы</Text>
          <Text style={[styles.pageSubtitle, { color: palette.subtext }]}>
            Персональные рекомендации на основе твоих данных
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Активные советы</Text>
              <Text style={[styles.sectionSubtitle, { color: palette.subtext }]}>
                Можно скрыть — тогда он не будет мешать
              </Text>
            </View>

            <Pressable onPress={load} style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]}>
              <Text style={[styles.link, { color: palette.primary }]}>{loading ? '...' : 'Обновить'}</Text>
            </Pressable>
          </View>

          {loading ? (
            <Text style={{ marginTop: 12, color: palette.subtext, fontWeight: '800' }}>Загрузка…</Text>
          ) : items.length === 0 ? (
            <View style={[styles.empty, { backgroundColor: palette.inputBg, borderColor: palette.border }]}>
              <Text style={{ color: palette.subtext, fontWeight: '800' }}>
                Пока нет активных советов. Добавляй тренировки — система будет подбирать рекомендации.
              </Text>
            </View>
          ) : (
            <View style={{ marginTop: 12, gap: 10 }}>
              {items.map((it) => (
                <View
                  key={it.id}
                  style={[styles.tip, { backgroundColor: palette.inputBg, borderColor: palette.border }]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={[styles.icon, { backgroundColor: palette.softPrimary }]}>
                      <Ionicons name="sparkles-outline" size={18} color={palette.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.tipTitle, { color: palette.text }]} numberOfLines={2}>
                        {it.template.title}
                      </Text>
                      <Text style={[styles.tipMeta, { color: palette.subtext }]} numberOfLines={1}>
                        {formatTime(it.createdAt)}
                      </Text>
                    </View>

                    <Pressable
                      onPress={() => onDismiss(it.id)}
                      style={({ pressed }) => [{ padding: 6, opacity: pressed ? 0.75 : 1 }]}
                    >
                      <Ionicons name="close-circle-outline" size={22} color={palette.danger} />
                    </Pressable>
                  </View>

                  <Text style={[styles.tipText, { color: palette.text }]}>{it.text}</Text>

                  {it.reason ? (
                    <Text style={[styles.reason, { color: palette.subtext }]}>Причина: {it.reason}</Text>
                  ) : null}
                </View>
              ))}
            </View>
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
    ...(Platform.OS === 'ios'
      ? { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } }
      : { elevation: 1 }),
  },

  sectionTitle: { fontSize: 15.5, fontWeight: '900' },
  sectionSubtitle: { marginTop: 4, fontSize: 12.5, fontWeight: '700' },
  link: { fontSize: 13.5, fontWeight: '900' },

  empty: { marginTop: 12, borderRadius: 16, borderWidth: 1, padding: 12 },

  tip: { borderRadius: 16, borderWidth: 1, padding: 12 },
  icon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tipTitle: { fontSize: 14.5, fontWeight: '900' },
  tipMeta: { marginTop: 2, fontSize: 11.5, fontWeight: '800' },
  tipText: { marginTop: 10, fontSize: 13.5, fontWeight: '800', lineHeight: 18 },
  reason: { marginTop: 8, fontSize: 12, fontWeight: '800', opacity: 0.9 },
});