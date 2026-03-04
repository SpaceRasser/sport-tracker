// mobile/src/navigation/DrawerNavigator.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  Platform,
  Pressable,
  Image,
  ActivityIndicator,
} from "react-native";
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerItemList,
  useDrawerStatus,
} from "@react-navigation/drawer";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";

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

function makePalette(isDark: boolean) {
  return {
    bg: isDark ? "#0B0D12" : "#F4F6FA",
    card: isDark ? "#121625" : "#FFFFFF",
    text: isDark ? "#E9ECF5" : "#121722",
    subtext: isDark ? "#A9B1C7" : "#5C667A",
    border: isDark ? "rgba(255,255,255,0.08)" : "rgba(16,24,40,0.08)",
    primary: "#2D6BFF",
    softPrimary: isDark ? "rgba(45,107,255,0.16)" : "rgba(45,107,255,0.10)",
    inputBg: isDark ? "rgba(255,255,255,0.06)" : "#F2F4F7",
  };
}

function initialsFromName(name?: string | null) {
  const n = (name ?? "").trim();
  if (!n) return "U";
  const parts = n.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "U";
  const b = parts[1]?.[0] ?? "";
  return (a + b).toUpperCase();
}

function DrawerHeader({
  palette,
  onGoProfile,
  onReload,
  loading,
  name,
  avatarUrl,
}: {
  palette: ReturnType<typeof makePalette>;
  onGoProfile: () => void;
  onReload: () => void;
  loading: boolean;
  name?: string | null;
  avatarUrl?: string | null;
}) {
  const initials = initialsFromName(name);

  return (
    <View style={[styles.headerCard, { borderColor: palette.border, backgroundColor: palette.card }]}>
      {/* glow */}
      <View pointerEvents="none" style={[styles.glow1, { backgroundColor: "rgba(45,107,255,0.18)" }]} />
      <View pointerEvents="none" style={[styles.glow2, { backgroundColor: "rgba(45,107,255,0.10)" }]} />

      <Pressable onPress={onGoProfile} style={({ pressed }) => [{ opacity: pressed ? 0.86 : 1 }]}>
        <View style={styles.headerRow}>
          <View
            style={[
              styles.avatar,
              {
                borderColor: palette.border,
                backgroundColor: "rgba(45,107,255,0.12)",
                overflow: "hidden",
              },
            ]}
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
            ) : (
              <Text style={[styles.avatarText, { color: palette.primary }]}>{initials}</Text>
            )}
          </View>

          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: palette.text }]} numberOfLines={1}>
              {name?.trim() ? name : "SportTracker"}
            </Text>
            <Text style={[styles.meta, { color: palette.subtext }]} numberOfLines={1}>
              Профиль и настройки
            </Text>
          </View>

          <Ionicons name="chevron-forward" size={18} color={palette.subtext} />
        </View>
      </Pressable>

      <View style={styles.headerActions}>
        <Pressable
          onPress={onReload}
          disabled={loading}
          style={({ pressed }) => [
            styles.iconBtn,
            {
              backgroundColor: palette.inputBg,
              borderColor: palette.border,
              opacity: loading ? 0.6 : pressed ? 0.85 : 1,
            },
          ]}
        >
          {loading ? (
            <ActivityIndicator />
          ) : (
            <Ionicons name="refresh" size={16} color={palette.primary} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

function CustomDrawerContent(props: any) {
  const scheme = useColorScheme();
  const palette = useMemo(() => makePalette(scheme === "dark"), [scheme]);
  const insets = useSafeAreaInsets();
  const drawerStatus = useDrawerStatus(); // "open" | "closed"

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

      // ВАЖНО: Drawer читает именно avatarUrl (как и ProfileScreen).
      // Если после VK логина ты возвращаешь "avatar" вместо "avatarUrl" — здесь будет null.
      setAvatarUrl(u?.avatarUrl ?? null);
    } catch {
      // тихо: Drawer не должен ломать UX
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

  // авто-обновление при открытии Drawer (прод-UX)
  useEffect(() => {
    if (drawerStatus === "open") {
      loadMe();
    }
  }, [drawerStatus, loadMe]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.card }} edges={["top", "bottom"]}>
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={{
          paddingTop: Math.max(insets.top, 10),
          paddingBottom: 10,
        }}
        style={{ backgroundColor: palette.card }}
      >
        <View style={{ paddingHorizontal: 14, paddingBottom: 10 }}>
          <DrawerHeader
            palette={palette}
            name={name}
            avatarUrl={avatarUrl}
            loading={loading}
            onReload={loadMe}
            onGoProfile={() => props.navigation.navigate("Profile")}
          />
        </View>

        <View style={{ paddingHorizontal: 10 }}>
          <DrawerItemList {...props} />
        </View>

        <View style={{ height: 14 }} />

        <View style={[styles.drawerFooter, { borderTopColor: palette.border }]}>
          <Text style={[styles.drawerFooterText, { color: palette.subtext }]}>SportTracker</Text>
        </View>
      </DrawerContentScrollView>
    </SafeAreaView>
  );
}

export default function DrawerNavigator() {
  const scheme = useColorScheme();
  const palette = useMemo(() => makePalette(scheme === "dark"), [scheme]);

  return (
    <Drawer.Navigator
      initialRouteName="Home"
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={({ route, navigation }) => ({
        headerTitleAlign: "center",
        headerStyle: {
          backgroundColor: palette.card,
          ...(Platform.OS === "ios" ? { shadowOpacity: 0, shadowColor: "transparent" } : { elevation: 0 }),
        },
        headerTitleStyle: { fontWeight: "900", color: palette.text },
        headerTintColor: palette.text,
        headerLeft: () => (
          <Pressable
            onPress={() => navigation.toggleDrawer()}
            style={({ pressed }) => [{ paddingHorizontal: 14, opacity: pressed ? 0.65 : 1 }]}
          >
            <Ionicons name="menu" size={22} color={palette.text} />
          </Pressable>
        ),

        drawerType: "front",
        drawerStyle: { width: 300, backgroundColor: palette.card },
        drawerActiveTintColor: palette.primary,
        drawerInactiveTintColor: palette.text,
        drawerLabelStyle: { fontSize: 14, fontWeight: "800" },
        drawerItemStyle: { borderRadius: 14, marginHorizontal: 6, marginVertical: 4 },
        drawerActiveBackgroundColor: "rgba(45,107,255,0.14)",

        drawerIcon: ({ color, size, focused }) => {
          const s = size ?? 20;
          const c = focused ? palette.primary : color;

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
      <Drawer.Screen name="Recommendations" component={RecommendationsScreen} options={{ title: "Советы" }} />
      <Drawer.Screen name="AddWorkout" component={AddWorkoutScreen} options={{ title: "Добавить тренировку" }} />
      <Drawer.Screen name="History" component={HistoryScreen} options={{ title: "История" }} />
      <Drawer.Screen name="Analytics" component={AnalyticsScreen} options={{ title: "Аналитика" }} />
      <Drawer.Screen name="Achievements" component={AchievementsScreen} options={{ title: "Достижения" }} />
      <Drawer.Screen name="HealthImport" component={HealthImportScreen} options={{ title: "Health Connect" }} />
      <Drawer.Screen name="Profile" component={ProfileScreen} options={{ title: "Профиль" }} />
    </Drawer.Navigator>
  );
}

const styles = StyleSheet.create({
  headerCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 12,
    overflow: "hidden",
    ...(Platform.OS === "ios"
      ? { shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 10 } }
      : { elevation: 2 }),
  },
  glow1: {
    position: "absolute",
    top: -90,
    left: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  glow2: {
    position: "absolute",
    top: -110,
    right: -90,
    width: 240,
    height: 240,
    borderRadius: 120,
  },

  headerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerActions: { marginTop: 10, flexDirection: "row", justifyContent: "flex-end" },

  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  avatar: {
    width: 46,
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 16, fontWeight: "900" },

  name: { fontSize: 14.5, fontWeight: "900" },
  meta: { marginTop: 2, fontSize: 12, fontWeight: "700" },

  drawerFooter: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  drawerFooterText: { fontSize: 12, fontWeight: "700" },
});