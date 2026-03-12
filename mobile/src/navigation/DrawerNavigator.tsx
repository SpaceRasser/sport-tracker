import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Pressable,
  Image,
  ActivityIndicator,
  Dimensions,
  StatusBar,
} from "react-native";
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerItemList,
  useDrawerStatus,
} from "@react-navigation/drawer";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

import HomeScreen from "../screens/HomeScreen";
import AddWorkoutScreen from "../screens/AddWorkoutScreen";
import HistoryScreen from "../screens/HistoryScreen";
import AnalyticsScreen from "../screens/AnalyticsScreen";
import AchievementsScreen from "../screens/AchievementsScreen";
import ProfileScreen from "../screens/ProfileScreen";
import RecommendationsScreen from "../screens/RecommendationsScreen";
import HealthImportScreen from "../screens/HealthImportScreen";

import { getMe } from "../api/userApi";

export type DrawerParamList = {
  Home: undefined;
  Recommendations: undefined;
  AddWorkout: undefined;
  History: undefined;
  Analytics: undefined;
  Achievements: undefined;
  HealthImport: undefined;
  Profile: undefined;
};

const Drawer = createDrawerNavigator<DrawerParamList>();

const palette = {
  bg: "#F5F2FF",
  bg2: "#EEE9FF",
  card: "#FFFFFF",
  cardSoft: "#F4F0FF",

  purple: "#6D4CFF",
  purpleDark: "#5137D7",

  text: "#2D244D",
  subtext: "#7D739D",
  muted: "#9D95BA",
  line: "#E6E0FA",

  cyan: "#7CE7FF",
  pink: "#FF8DD8",
  orange: "#FFB36B",
};

function initialsFromName(name?: string | null) {
  const n = (name ?? "").trim();
  if (!n) return "U";
  const parts = n.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "U";
  const b = parts[1]?.[0] ?? "";
  return (a + b).toUpperCase();
}

function DrawerHeader({
  onGoProfile,
  onReload,
  loading,
  name,
  avatarUrl,
}: {
  onGoProfile: () => void;
  onReload: () => void;
  loading: boolean;
  name?: string | null;
  avatarUrl?: string | null;
}) {
  const initials = initialsFromName(name);

  return (
    <LinearGradient
      colors={[palette.purple, palette.purpleDark, "#7B61FF"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.heroCard}
    >
      <View style={styles.heroBlobTop} />
      <View style={styles.heroBlobBottom} />

      <Text style={styles.heroKicker}>SPORTTRACKER</Text>
      <Text style={styles.heroTitle}>Меню</Text>
      <Text style={styles.heroSubtitle}>
        Быстрый доступ к разделам, профилю и настройкам приложения.
      </Text>

      <Pressable
        onPress={onGoProfile}
        style={({ pressed }) => [{ opacity: pressed ? 0.88 : 1 }]}
      >
        <View style={styles.profileRow}>
          <View style={styles.avatarWrap}>
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="cover"
              />
            ) : (
              <Text style={styles.avatarText}>{initials}</Text>
            )}
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.profileName} numberOfLines={1}>
              {name?.trim() ? name : "Пользователь"}
            </Text>
            <Text style={styles.profileMeta} numberOfLines={1}>
              Профиль и настройки
            </Text>
          </View>

          <View style={styles.heroActionIcon}>
            <Ionicons name="chevron-forward" size={18} color={palette.purpleDark} />
          </View>
        </View>
      </Pressable>

      <View style={styles.headerActionRow}>
        <Pressable
          onPress={onReload}
          disabled={loading}
          style={({ pressed }) => [
            styles.smallActionBtn,
            { opacity: loading ? 0.65 : pressed ? 0.85 : 1 },
          ]}
        >
          {loading ? (
            <ActivityIndicator color={palette.purpleDark} />
          ) : (
            <>
              <Ionicons name="refresh" size={16} color={palette.purpleDark} />
              <Text style={styles.smallActionText}>Обновить</Text>
            </>
          )}
        </Pressable>
      </View>
    </LinearGradient>
  );
}

function DrawerFooter() {
  return (
    <View style={styles.drawerFooter}>
      <View style={styles.footerBadge}>
        <MaterialCommunityIcons name="lightning-bolt-outline" size={14} color={palette.purple} />
        <Text style={styles.footerBadgeText}>Aurora Sport</Text>
      </View>

      <Text style={styles.drawerFooterText}>SportTracker</Text>
    </View>
  );
}

function CustomDrawerContent(props: any) {
  const insets = useSafeAreaInsets();
  const drawerStatus = useDrawerStatus();

  const mounted = useRef(true);

  const [loading, setLoading] = useState(false);
  const [name, setName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const loadMe = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getMe();
      const u = data?.user;
      setName(u?.name ?? null);
      setAvatarUrl(u?.avatarUrl ?? null);
    } catch {
      // тихо, чтобы drawer не ломал UX
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    loadMe();
    return () => {
      mounted.current = false;
    };
  }, [loadMe]);

  useEffect(() => {
    if (drawerStatus === "open") {
      loadMe();
    }
  }, [drawerStatus, loadMe]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor={palette.bg} />

      <DrawerContentScrollView
        {...props}
        contentContainerStyle={{
          paddingTop: Math.max(insets.top, 10),
          paddingBottom: 10,
        }}
        style={styles.drawerScroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.drawerBgBlobTop} pointerEvents="none" />
        <View style={styles.drawerBgBlobBottom} pointerEvents="none" />

        <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}>
          <DrawerHeader
            name={name}
            avatarUrl={avatarUrl}
            loading={loading}
            onReload={loadMe}
            onGoProfile={() => props.navigation.navigate("Profile")}
          />
        </View>

        <View style={styles.listWrap}>
          <DrawerItemList {...props} />
        </View>

        <DrawerFooter />
      </DrawerContentScrollView>
    </SafeAreaView>
  );
}

export default function DrawerNavigator() {
  const drawerWidth = Math.min(320, Math.round(Dimensions.get("window").width * 0.82));

  return (
    <Drawer.Navigator
      initialRouteName="Home"
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={({ route, navigation }) => ({
        headerTitleAlign: "center",
        headerStyle: {
          backgroundColor: palette.card,
          ...(Platform.OS === "ios"
            ? { shadowOpacity: 0, shadowColor: "transparent" }
            : { elevation: 0 }),
        },
        headerTitleStyle: {
          fontWeight: "900",
          color: palette.text,
          fontSize: 17,
        },
        headerTintColor: palette.text,

        headerLeft: () => (
          <Pressable
            onPress={() => navigation.toggleDrawer()}
            style={({ pressed }) => [
              styles.headerMenuBtn,
              { opacity: pressed ? 0.68 : 1 },
            ]}
          >
            <Ionicons name="menu" size={22} color={palette.text} />
          </Pressable>
        ),

        drawerType: "front",
        drawerStyle: {
          width: drawerWidth,
          backgroundColor: palette.bg,
          borderTopRightRadius: 28,
          borderBottomRightRadius: 28,
        },

        overlayColor: "rgba(45,36,77,0.22)",
        sceneContainerStyle: {
          backgroundColor: palette.bg,
        },

        swipeEnabled: true,
        swipeEdgeWidth: 72,

        drawerActiveTintColor: palette.purple,
        drawerInactiveTintColor: palette.text,
        drawerLabelStyle: {
          fontSize: 14,
          fontWeight: "800",
          marginLeft: -6,
        },
        drawerItemStyle: {
          borderRadius: 18,
          marginHorizontal: 6,
          marginVertical: 4,
          paddingHorizontal: 4,
        },
        drawerActiveBackgroundColor: "rgba(109,76,255,0.14)",

        drawerIcon: ({ color, size, focused }) => {
          const s = size ?? 20;
          const c = focused ? palette.purple : color;

          switch (route.name) {
            case "Home":
              return <Ionicons name="home-outline" size={s} color={c} />;
            case "Recommendations":
              return <Ionicons name="sparkles-outline" size={s} color={c} />;
            case "AddWorkout":
              return <Ionicons name="add-circle-outline" size={s} color={c} />;
            case "History":
              return <Ionicons name="time-outline" size={s} color={c} />;
            case "Analytics":
              return <Ionicons name="stats-chart-outline" size={s} color={c} />;
            case "Achievements":
              return <Ionicons name="trophy-outline" size={s} color={c} />;
            case "HealthImport":
              return <Ionicons name="heart-outline" size={s} color={c} />;
            case "Profile":
              return <Ionicons name="person-outline" size={s} color={c} />;
            default:
              return <Ionicons name="ellipse-outline" size={s} color={c} />;
          }
        },
      })}
    >
      <Drawer.Screen name="Home" component={HomeScreen} options={{ title: "Главная" }} />
      <Drawer.Screen
        name="Recommendations"
        component={RecommendationsScreen}
        options={{ title: "Советы" }}
      />
      <Drawer.Screen
        name="AddWorkout"
        component={AddWorkoutScreen}
        options={{ title: "Добавить тренировку" }}
      />
      <Drawer.Screen name="History" component={HistoryScreen} options={{ title: "История" }} />
      <Drawer.Screen
        name="Analytics"
        component={AnalyticsScreen}
        options={{ title: "Аналитика" }}
      />
      <Drawer.Screen
        name="Achievements"
        component={AchievementsScreen}
        options={{ title: "Достижения" }}
      />
      <Drawer.Screen
        name="HealthImport"
        component={HealthImportScreen}
        options={{ title: "Health Connect" }}
      />
      <Drawer.Screen name="Profile" component={ProfileScreen} options={{ title: "Профиль" }} />
    </Drawer.Navigator>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: palette.bg,
  },

  drawerScroll: {
    backgroundColor: palette.bg,
  },

  drawerBgBlobTop: {
    position: "absolute",
    top: 120,
    right: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(124,231,255,0.14)",
  },

  drawerBgBlobBottom: {
    position: "absolute",
    left: -30,
    bottom: 120,
    width: 120,
    height: 90,
    backgroundColor: "rgba(255,141,216,0.12)",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 60,
    borderBottomLeftRadius: 60,
    borderBottomRightRadius: 30,
  },

  heroCard: {
    minHeight: 220,
    borderRadius: 30,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    overflow: "hidden",
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
    fontSize: 32,
    lineHeight: 36,
    fontWeight: "900",
    marginBottom: 10,
    maxWidth: "92%",
  },

  heroSubtitle: {
    color: "rgba(255,255,255,0.84)",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    marginBottom: 16,
    maxWidth: "94%",
  },

  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  avatarWrap: {
    width: 52,
    height: 52,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  avatarText: {
    color: palette.purple,
    fontSize: 18,
    fontWeight: "900",
  },

  profileName: {
    color: "#FFFFFF",
    fontSize: 15.5,
    fontWeight: "900",
  },

  profileMeta: {
    color: "rgba(255,255,255,0.84)",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },

  heroActionIcon: {
    width: 34,
    height: 34,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  headerActionRow: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "flex-end",
  },

  smallActionBtn: {
    minWidth: 110,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
  },

  smallActionText: {
    color: palette.purpleDark,
    fontSize: 12.5,
    fontWeight: "900",
  },

  listWrap: {
    paddingHorizontal: 10,
    paddingTop: 4,
  },

  drawerFooter: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 18,
  },

  footerBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: palette.cardSoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },

  footerBadgeText: {
    color: palette.purple,
    fontSize: 12.5,
    fontWeight: "800",
    marginLeft: 6,
  },

  drawerFooterText: {
    color: palette.subtext,
    fontSize: 12,
    fontWeight: "700",
  },

  headerMenuBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
});