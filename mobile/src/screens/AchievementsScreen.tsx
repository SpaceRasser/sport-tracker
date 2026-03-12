import React, { useCallback, useMemo, useState } from "react";
import {
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { getAchievements, AchievementItem } from "../api/achievementsApi";

const palette = {
  bg: "#F5F2FF",
  bg2: "#EEE9FF",
  card: "#FFFFFF",
  cardSoft: "#F4F0FF",

  purple: "#6D4CFF",
  purpleDark: "#5137D7",
  purpleSoft: "#B8A8FF",

  text: "#2D244D",
  subtext: "#7D739D",
  muted: "#9D95BA",
  line: "#E6E0FA",

  cyan: "#7CE7FF",
  pink: "#FF8DD8",
  orange: "#FFB36B",
  green: "#24A865",
  greenSoft: "rgba(36,168,101,0.10)",
  purpleSoftBg: "rgba(109,76,255,0.10)",
  danger: "#D64562",
  dangerSoft: "rgba(214,69,98,0.10)",
};

function formatDateShort(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString();
}

function FilterChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
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
            { color: active ? "#FFFFFF" : palette.purple },
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
      <View style={[styles.summaryStatIcon, { backgroundColor: tint }]}>
        {icon}
      </View>
      <Text style={styles.summaryStatValue}>{value}</Text>
      <Text style={styles.summaryStatLabel}>{label}</Text>
    </View>
  );
}

function StatusBadge({ achieved }: { achieved: boolean }) {
  return (
    <View
      style={[
        styles.statusBadge,
        {
          backgroundColor: achieved ? palette.greenSoft : palette.purpleSoftBg,
          borderColor: achieved ? "rgba(36,168,101,0.18)" : palette.line,
        },
      ]}
    >
      <Text
        style={[
          styles.statusBadgeText,
          { color: achieved ? palette.green : palette.purple },
        ]}
      >
        {achieved ? "Получено" : "В процессе"}
      </Text>
    </View>
  );
}

function SkeletonCard() {
  return (
    <View style={styles.achievementCard}>
      <View style={styles.skeletonRow}>
        <View style={styles.skeletonIcon} />
        <View style={{ flex: 1 }}>
          <View style={[styles.skeletonLine, { width: "55%" }]} />
          <View style={[styles.skeletonLine, { width: "90%", marginTop: 10 }]} />
          <View style={[styles.skeletonLine, { width: "68%", marginTop: 10 }]} />
        </View>
      </View>

      <View style={[styles.skeletonLine, { width: "36%", marginTop: 14 }]} />
    </View>
  );
}

function AchievementCard({ item }: { item: AchievementItem }) {
  const achieved = item.achieved;

  return (
    <View
      style={[
        styles.achievementCard,
        achieved && {
          borderColor: "rgba(36,168,101,0.18)",
        },
      ]}
    >
      <View style={styles.cardTopRow}>
        <View
          style={[
            styles.achievementIconWrap,
            {
              backgroundColor: achieved ? palette.greenSoft : palette.cardSoft,
            },
          ]}
        >
          {achieved ? (
            <Ionicons name="trophy" size={20} color={palette.green} />
          ) : (
            <MaterialCommunityIcons
              name="trophy-outline"
              size={20}
              color={palette.purple}
            />
          )}
        </View>

        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <StatusBadge achieved={achieved} />
          </View>

          {item.description ? (
            <Text style={styles.cardDescription}>{item.description}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.cardMetaRow}>
        <View style={styles.metaPill}>
          <Ionicons
            name={achieved ? "checkmark-circle" : "time-outline"}
            size={14}
            color={achieved ? palette.green : palette.purple}
          />
          <Text style={styles.metaPillText}>
            {achieved
              ? `Получено: ${formatDateShort(item.achievedAt) || "—"}`
              : "Ещё не получено"}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function AchievementsScreen() {
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
      setError(e?.message ?? "Не удалось загрузить достижения");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData("initial");
    }, [fetchData])
  );

  const earnedCount = useMemo(() => items.filter((x) => x.achieved).length, [items]);
  const totalCount = items.length;
  const lockedCount = Math.max(0, totalCount - earnedCount);
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
    <View style={styles.screen}>
      <LinearGradient
        colors={[palette.bg, palette.bg2]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.blobTopRight} pointerEvents="none" />
      <View style={styles.blobLeft} pointerEvents="none" />
      <View style={styles.blobBottom} pointerEvents="none" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchData("refresh")}
            tintColor={palette.purple}
          />
        }
      >
        <LinearGradient
          colors={[palette.purple, palette.purpleDark, "#7B61FF"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroBlobTop} />
          <View style={styles.heroBlobBottom} />

          <Text style={styles.heroKicker}>SPORTTRACKER</Text>
          <Text style={styles.heroTitle}>Ваши достижения</Text>
          <Text style={styles.heroSubtitle}>
            Бейджи за регулярность, прогресс и спортивные результаты.
          </Text>

          <View style={styles.heroProgressRow}>
            <View style={styles.heroProgressTrack}>
              <View style={[styles.heroProgressFill, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.heroProgressText}>{progress}%</Text>
          </View>
        </LinearGradient>

        <View style={styles.statsRow}>
          <SummaryStat
            value={String(earnedCount)}
            label="получено"
            tint="rgba(124,231,255,0.28)"
            icon={<Ionicons name="trophy" size={18} color={palette.purple} />}
          />
          <SummaryStat
            value={String(lockedCount)}
            label="в процессе"
            tint="rgba(255,179,107,0.28)"
            icon={<Ionicons name="time-outline" size={18} color={palette.purple} />}
          />
          <SummaryStat
            value={String(totalCount)}
            label="всего"
            tint="rgba(255,141,216,0.28)"
            icon={<Ionicons name="apps" size={18} color={palette.purple} />}
          />
        </View>

        <View style={styles.mainCard}>
          <Text style={styles.sectionKicker}>ДОСТИЖЕНИЯ</Text>
          <Text style={styles.sectionTitle}>Прогресс и бейджи</Text>
          <Text style={styles.sectionDescription}>
            Следите за тем, какие достижения уже открыты, а какие ещё впереди.
          </Text>

          <View style={styles.badgesRow}>
            <InfoBadge
              icon={<Ionicons name="flash" size={14} color={palette.purple} />}
              label="Прогресс"
            />
            <InfoBadge
              icon={<Ionicons name="trophy-outline" size={14} color={palette.purple} />}
              label="Бейджи"
            />
            <InfoBadge
              icon={<Ionicons name="sparkles" size={14} color={palette.purple} />}
              label="Мотивация"
            />
          </View>

          <View style={styles.filtersRow}>
            <FilterChip
              active={filter === "all"}
              label="Все"
              onPress={() => setFilter("all")}
            />
            <FilterChip
              active={filter === "earned"}
              label="Полученные"
              onPress={() => setFilter("earned")}
            />
            <FilterChip
              active={filter === "locked"}
              label="Закрытые"
              onPress={() => setFilter("locked")}
            />
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorTitle}>Не получилось загрузить</Text>
              <Text style={styles.errorText}>{error}</Text>
              <Text style={styles.errorHint}>Потяните экран вниз, чтобы повторить.</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.listWrap}>
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : shown.length === 0 ? (
            <View style={styles.emptyBox}>
              <View style={styles.emptyIcon}>
                <Ionicons name="medal-outline" size={22} color={palette.purple} />
              </View>
              <Text style={styles.emptyTitle}>{emptyText}</Text>
              <Text style={styles.emptySub}>
                Продолжайте тренироваться — новые достижения появятся автоматически.
              </Text>
            </View>
          ) : (
            shown.map((a) => <AchievementCard key={a.id} item={a} />)
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.bg,
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
  },

  blobTopRight: {
    position: "absolute",
    top: -20,
    right: -10,
    width: 140,
    height: 100,
    backgroundColor: "rgba(109,76,255,0.14)",
    borderBottomLeftRadius: 56,
    borderBottomRightRadius: 22,
    borderTopLeftRadius: 80,
    borderTopRightRadius: 12,
  },

  blobLeft: {
    position: "absolute",
    left: -28,
    top: 240,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(184,168,255,0.16)",
  },

  blobBottom: {
    position: "absolute",
    right: -20,
    bottom: 150,
    width: 120,
    height: 76,
    backgroundColor: "rgba(124,231,255,0.16)",
    borderTopLeftRadius: 40,
    borderTopRightRadius: 26,
    borderBottomLeftRadius: 60,
    borderBottomRightRadius: 60,
  },

  heroCard: {
    minHeight: 210,
    borderRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
    overflow: "hidden",
    marginBottom: 16,
    shadowColor: "#6D4CFF",
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },

  heroBlobTop: {
    position: "absolute",
    top: -20,
    right: -12,
    width: 120,
    height: 84,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderBottomLeftRadius: 56,
    borderBottomRightRadius: 26,
    borderTopLeftRadius: 70,
    borderTopRightRadius: 16,
  },

  heroBlobBottom: {
    position: "absolute",
    bottom: -12,
    left: -10,
    width: 128,
    height: 64,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 36,
    borderBottomLeftRadius: 80,
    borderBottomRightRadius: 38,
  },

  heroKicker: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.6,
    marginBottom: 12,
  },

  heroTitle: {
    color: "#FFFFFF",
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "900",
    marginBottom: 10,
    maxWidth: "86%",
  },

  heroSubtitle: {
    color: "rgba(255,255,255,0.84)",
    fontSize: 14.5,
    lineHeight: 21,
    fontWeight: "600",
    maxWidth: "92%",
    marginBottom: 18,
  },

  heroProgressRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  heroProgressTrack: {
    flex: 1,
    height: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.22)",
    overflow: "hidden",
    marginRight: 10,
  },

  heroProgressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
  },

  heroProgressText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },

  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 16,
  },

  summaryStat: {
    flex: 1,
    backgroundColor: palette.card,
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: palette.line,
  },

  summaryStatIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },

  summaryStatValue: {
    color: palette.text,
    fontSize: 18,
    fontWeight: "900",
  },

  summaryStatLabel: {
    color: palette.subtext,
    fontSize: 12,
    fontWeight: "700",
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
    fontWeight: "900",
    letterSpacing: 1.6,
    marginBottom: 8,
  },

  sectionTitle: {
    color: palette.text,
    fontSize: 29,
    lineHeight: 32,
    fontWeight: "900",
    marginBottom: 8,
  },

  sectionDescription: {
    color: palette.subtext,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
    marginBottom: 16,
  },

  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },

  infoBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.cardSoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  infoBadgeText: {
    color: palette.purple,
    fontSize: 12.5,
    fontWeight: "800",
    marginLeft: 6,
  },

  filtersRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },

  filterChipActive: {
    backgroundColor: palette.purple,
  },

  filterChipInactive: {
    backgroundColor: palette.cardSoft,
  },

  filterChipText: {
    fontSize: 12.5,
    fontWeight: "800",
  },

  errorBox: {
    marginTop: 14,
    borderRadius: 18,
    padding: 14,
    backgroundColor: palette.dangerSoft,
    borderWidth: 1,
    borderColor: "rgba(214,69,98,0.12)",
  },

  errorTitle: {
    color: palette.danger,
    fontSize: 13.5,
    fontWeight: "900",
  },

  errorText: {
    color: palette.subtext,
    marginTop: 4,
    fontSize: 12.5,
    fontWeight: "700",
    lineHeight: 18,
  },

  errorHint: {
    color: palette.subtext,
    marginTop: 8,
    fontSize: 12,
    fontWeight: "800",
  },

  listWrap: {
    gap: 12,
  },

  achievementCard: {
    backgroundColor: palette.card,
    borderRadius: 24,
    padding: 14,
    borderWidth: 1,
    borderColor: palette.line,
    ...(Platform.OS === "ios"
      ? {
          shadowColor: "#000",
          shadowOpacity: 0.04,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 8 },
        }
      : { elevation: 1 }),
  },

  cardTopRow: {
    flexDirection: "row",
    gap: 12,
  },

  achievementIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },

  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "flex-start",
  },

  cardTitle: {
    flex: 1,
    color: palette.text,
    fontSize: 15.5,
    fontWeight: "900",
    paddingTop: 2,
  },

  cardDescription: {
    color: palette.subtext,
    marginTop: 6,
    fontSize: 12.5,
    fontWeight: "700",
    lineHeight: 18,
  },

  statusBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },

  statusBadgeText: {
    fontSize: 12,
    fontWeight: "900",
  },

  cardMetaRow: {
    marginTop: 12,
  },

  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: palette.cardSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },

  metaPillText: {
    color: palette.subtext,
    fontSize: 12.5,
    fontWeight: "800",
    marginLeft: 6,
  },

  emptyBox: {
    backgroundColor: palette.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: 18,
    paddingVertical: 24,
    alignItems: "center",
  },

  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: palette.cardSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  emptyTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: "900",
    textAlign: "center",
  },

  emptySub: {
    color: palette.subtext,
    marginTop: 6,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: "700",
    textAlign: "center",
  },

  skeletonRow: {
    flexDirection: "row",
    gap: 12,
  },

  skeletonIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: palette.cardSoft,
  },

  skeletonLine: {
    height: 12,
    borderRadius: 10,
    backgroundColor: palette.cardSoft,
  },
});