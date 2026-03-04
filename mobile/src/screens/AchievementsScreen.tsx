import React, { useCallback, useMemo, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  RefreshControl,
  Pressable,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { getAchievements, AchievementItem } from "../api/achievementsApi";

function makePalette(isDark: boolean) {
  return {
    bg: isDark ? "#0B0D12" : "#F4F6FA",
    card: isDark ? "#121625" : "#FFFFFF",
    text: isDark ? "#E9ECF5" : "#121722",
    subtext: isDark ? "#A9B1C7" : "#5C667A",
    border: isDark ? "rgba(255,255,255,0.08)" : "rgba(16,24,40,0.08)",
    primary: "#2D6BFF",
    success: "#1F7A2E",
    danger: "#E5484D",
    inputBg: isDark ? "rgba(255,255,255,0.06)" : "#F2F4F7",
    softPrimary: isDark ? "rgba(45,107,255,0.16)" : "rgba(45,107,255,0.10)",
    softSuccess: isDark ? "rgba(31,122,46,0.18)" : "rgba(31,122,46,0.10)",
    softDanger: isDark ? "rgba(229,72,77,0.18)" : "rgba(229,72,77,0.10)",
  };
}

function formatDateShort(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString();
}

function Badge({
  text,
  kind,
  palette,
}: {
  text: string;
  kind: "done" | "progress";
  palette: ReturnType<typeof makePalette>;
}) {
  const bg = kind === "done" ? palette.softSuccess : palette.softPrimary;
  const color = kind === "done" ? palette.success : palette.primary;

  return (
    <View
      style={[
        styles.badge,
        { borderColor: palette.border, backgroundColor: bg },
      ]}
    >
      <Text style={[styles.badgeText, { color }]}>{text}</Text>
    </View>
  );
}

function Chip({
  active,
  label,
  palette,
  tone,
}: {
  active: boolean;
  label: string;
  palette: ReturnType<typeof makePalette>;
  tone: "primary" | "success";
}) {
  const borderColor = active
    ? tone === "success"
      ? palette.success
      : palette.primary
    : palette.border;

  const bg = active
    ? tone === "success"
      ? palette.softSuccess
      : palette.softPrimary
    : palette.inputBg;

  const color = active
    ? tone === "success"
      ? palette.success
      : palette.primary
    : palette.text;

  return (
    <View style={[styles.chip, { borderColor, backgroundColor: bg }]}>
      <Text style={[styles.chipText, { color }]}>{label}</Text>
    </View>
  );
}

function SkeletonRow({ palette }: { palette: ReturnType<typeof makePalette> }) {
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: palette.card, borderColor: palette.border },
      ]}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <View
            style={[
              styles.skelLine,
              { width: "70%", backgroundColor: palette.inputBg },
            ]}
          />
          <View
            style={[
              styles.skelLine,
              { width: "92%", backgroundColor: palette.inputBg, marginTop: 10 },
            ]}
          />
        </View>
        <View
          style={[
            styles.skelPill,
            { backgroundColor: palette.inputBg, borderColor: palette.border },
          ]}
        />
      </View>

      <View
        style={[
          styles.skelLine,
          { width: "40%", backgroundColor: palette.inputBg, marginTop: 12 },
        ]}
      />
    </View>
  );
}

export default function AchievementsScreen() {
  const scheme = useColorScheme();
  const palette = useMemo(() => makePalette(scheme === "dark"), [scheme]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<AchievementItem[]>([]);
  const [filter, setFilter] = useState<"all" | "earned" | "locked">("all");

  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") setLoading(true);
    if (mode === "refresh") setRefreshing(true);

    try {
      setError(null);
      const res = await getAchievements();
      setItems(res.items ?? []);
    } catch (e: any) {
      // production-friendly: не Alert, а аккуратное состояние
      setError(e?.message ?? "Не удалось загрузить достижения");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // ✅ авто-загрузка при первом входе на экран + при каждом возврате (focus)
  useFocusEffect(
    useCallback(() => {
      fetchData("initial");
    }, [fetchData])
  );

  const earnedCount = useMemo(() => items.filter((x) => x.achieved).length, [items]);
  const totalCount = items.length;
  const progress = totalCount ? Math.round((earnedCount / totalCount) * 100) : 0;

  const shown = useMemo(() => {
    const base =
      filter === "earned"
        ? items.filter((x) => x.achieved)
        : filter === "locked"
        ? items.filter((x) => !x.achieved)
        : items;

    return [...base].sort((a, b) => Number(b.achieved) - Number(a.achieved));
  }, [items, filter]);

  const emptyText = useMemo(() => {
    if (filter === "earned") return "Пока нет полученных достижений";
    if (filter === "locked") return "Все достижения уже получены";
    return "Достижений пока нет";
  }, [filter]);

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 18, paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchData("refresh")}
            tintColor={palette.primary}
          />
        }
      >
        <View style={{ marginBottom: 12 }}>
          <Text style={[styles.pageTitle, { color: palette.text }]}>Достижения</Text>
          <Text style={[styles.pageSubtitle, { color: palette.subtext }]}>
            Бейджи за прогресс и регулярность
          </Text>
        </View>

        {/* Summary */}
        <View style={[styles.section, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Прогресс</Text>
              <Text style={[styles.sectionSubtitle, { color: palette.subtext }]}>
                {totalCount ? `Получено ${earnedCount} из ${totalCount}` : "Пока нет данных"}
              </Text>
            </View>

            <View style={[styles.progressPill, { borderColor: palette.border, backgroundColor: palette.inputBg }]}>
              <Text style={[styles.progressPillText, { color: palette.text }]}>{progress}%</Text>
            </View>
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
          </View>

          {/* Filters */}
          <View style={{ marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Pressable onPress={() => setFilter("all")} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}>
              <Chip active={filter === "all"} label="Все" palette={palette} tone="primary" />
            </Pressable>

            <Pressable onPress={() => setFilter("earned")} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}>
              <Chip active={filter === "earned"} label="Полученные" palette={palette} tone="success" />
            </Pressable>

            <Pressable onPress={() => setFilter("locked")} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}>
              <Chip active={filter === "locked"} label="Закрытые" palette={palette} tone="primary" />
            </Pressable>
          </View>

          {/* Error banner */}
          {error ? (
            <View style={[styles.errorBox, { backgroundColor: palette.softDanger, borderColor: palette.border }]}>
              <Text style={[styles.errorTitle, { color: palette.danger }]}>Не получилось загрузить</Text>
              <Text style={[styles.errorText, { color: palette.subtext }]}>{error}</Text>
              <Text style={[styles.errorHint, { color: palette.subtext }]}>
                Потяни вниз, чтобы повторить.
              </Text>
            </View>
          ) : null}
        </View>

        {/* List */}
        <View style={{ gap: 12 }}>
          {loading ? (
            <>
              <SkeletonRow palette={palette} />
              <SkeletonRow palette={palette} />
              <SkeletonRow palette={palette} />
            </>
          ) : shown.length === 0 ? (
            <View style={[styles.emptyBox, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <Text style={[styles.emptyTitle, { color: palette.text }]}>{emptyText}</Text>
              <Text style={[styles.emptySub, { color: palette.subtext }]}>
                Продолжай тренироваться — новые бейджи появятся автоматически.
              </Text>
            </View>
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
                      borderColor: achieved ? "rgba(31,122,46,0.35)" : palette.border,
                      opacity: achieved ? 1 : 0.94,
                    },
                  ]}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cardTitle, { color: palette.text }]}>{a.title}</Text>
                      {a.description ? (
                        <Text style={[styles.cardSubtitle, { color: palette.subtext }]} numberOfLines={3}>
                          {a.description}
                        </Text>
                      ) : null}
                    </View>

                    {achieved ? (
                      <Badge text="Получено" kind="done" palette={palette} />
                    ) : (
                      <Badge text="В процессе" kind="progress" palette={palette} />
                    )}
                  </View>

                  <View style={{ marginTop: 10, flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
                    {/* убрали “code” как дебаг-метрику — но если это часть UX, оставь. 
                        Сейчас делаем прод: показываем дату только если есть */}
                    <Text style={[styles.meta, { color: palette.subtext }]}>
                      {achieved ? `Получено: ${formatDateShort(a.achievedAt) || "—"}` : "Ещё не получено"}
                    </Text>
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

  pageTitle: { fontSize: 22, fontWeight: "900" },
  pageSubtitle: { marginTop: 6, fontSize: 13, fontWeight: "700" },

  section: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
    ...(Platform.OS === "ios"
      ? { shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } }
      : { elevation: 1 }),
  },

  sectionTitle: { fontSize: 15.5, fontWeight: "900" },
  sectionSubtitle: { marginTop: 4, fontSize: 12.5, fontWeight: "700" },

  progressPill: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  progressPillText: { fontSize: 12.5, fontWeight: "900" },

  progressTrack: {
    height: 12,
    borderRadius: 999,
    borderWidth: 1,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 999 },

  chip: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  chipText: { fontSize: 13, fontWeight: "800" },

  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    ...(Platform.OS === "ios"
      ? { shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } }
      : { elevation: 1 }),
  },
  cardTitle: { fontSize: 15.5, fontWeight: "900" },
  cardSubtitle: { marginTop: 6, fontSize: 12.5, fontWeight: "700", lineHeight: 18 },

  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
  badgeText: { fontSize: 12, fontWeight: "900" },

  meta: { fontSize: 12.5, fontWeight: "800", opacity: 0.95 },

  emptyBox: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  emptyTitle: { fontSize: 14.5, fontWeight: "900" },
  emptySub: { marginTop: 6, fontSize: 12.5, fontWeight: "700", lineHeight: 18 },

  errorBox: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  errorTitle: { fontSize: 13.5, fontWeight: "900" },
  errorText: { marginTop: 4, fontSize: 12.5, fontWeight: "700", lineHeight: 18 },
  errorHint: { marginTop: 8, fontSize: 12, fontWeight: "800", opacity: 0.9 },

  // skeleton
  skelLine: { height: 12, borderRadius: 10 },
  skelPill: { width: 86, height: 28, borderRadius: 999, borderWidth: 1 },
});