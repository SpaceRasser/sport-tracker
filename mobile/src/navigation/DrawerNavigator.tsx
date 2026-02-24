import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  Platform,
  Pressable,
  Image,
} from 'react-native';
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerItemList,
} from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import HomeScreen from '../screens/HomeScreen';
import AddWorkoutScreen from '../screens/AddWorkoutScreen';
import HistoryScreen from '../screens/HistoryScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import AchievementsScreen from '../screens/AchievementsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import RecommendationsScreen from '../screens/RecommendationsScreen';

import { getMe } from '../api/userApi'; // <-- тот же getMe, что ты уже используешь в ProfileScreen

export type DrawerParamList = {
  Home: undefined;
  AddWorkout: undefined;
  History: undefined;
  Analytics: undefined;
  Achievements: undefined;
  Profile: undefined;
  Recommendations: undefined;
};

const Drawer = createDrawerNavigator<DrawerParamList>();

function makePalette(isDark: boolean) {
  return {
    bg: isDark ? '#0B0D12' : '#F4F6FA',
    card: isDark ? '#121625' : '#FFFFFF',
    text: isDark ? '#E9ECF5' : '#121722',
    subtext: isDark ? '#A9B1C7' : '#5C667A',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(16,24,40,0.08)',
    primary: '#2D6BFF',
  };
}

function initialsFromName(name?: string | null) {
  const n = (name ?? '').trim();
  if (!n) return 'U';
  const parts = n.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? 'U';
  const b = parts[1]?.[0] ?? '';
  return (a + b).toUpperCase();
}

function DrawerHeader({
  palette,
  onGoProfile,
  name,
  avatarUrl,
}: {
  palette: ReturnType<typeof makePalette>;
  onGoProfile: () => void;
  name?: string | null;
  avatarUrl?: string | null;
}) {
  const initials = initialsFromName(name);

  return (
    <Pressable onPress={onGoProfile} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}>
      <View style={[styles.drawerHeader, { borderColor: palette.border }]}>
        <View
          style={[
            styles.drawerAvatar,
            {
              borderColor: palette.border,
              backgroundColor: 'rgba(45,107,255,0.12)',
              overflow: 'hidden',
            },
          ]}
        >
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
          ) : (
            <Text style={[styles.drawerAvatarText, { color: palette.primary }]}>{initials}</Text>
          )}
        </View>

        <View style={{ flex: 1 }}>
          <Text style={[styles.drawerName, { color: palette.text }]} numberOfLines={1}>
            {name?.trim() ? name : 'SportTracker'}
          </Text>
          <Text style={[styles.drawerMeta, { color: palette.subtext }]} numberOfLines={1}>
            Нажми, чтобы открыть профиль
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={18} color={palette.subtext} />
      </View>
    </Pressable>
  );
}

function CustomDrawerContent(props: any) {
  const scheme = useColorScheme();
  const palette = useMemo(() => makePalette(scheme === 'dark'), [scheme]);
  const insets = useSafeAreaInsets();

  const [name, setName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const loadMe = async () => {
    try {
      const data = await getMe();
      const u = data?.user;
      setName(u?.name ?? null);
      setAvatarUrl(u?.avatarUrl ?? null);
    } catch {
      // не мешаем UI, просто оставим дефолт
    }
  };

  // 1) первый раз при монтировании
  useEffect(() => {
    loadMe();
  }, []);

  // 2) обновлять, когда Drawer экран снова в фокусе (например после смены аватара)
  useFocusEffect(
    React.useCallback(() => {
      loadMe();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.card }} edges={['top', 'bottom']}>
      <DrawerContentScrollView
        {...props}
        // ВАЖНО: учитываем вырез/чёлку сверху
        contentContainerStyle={{ paddingTop: Math.max(insets.top, 10), paddingBottom: 10 }}
        style={{ backgroundColor: palette.card }}
      >
        <View style={{ paddingHorizontal: 14, paddingBottom: 10 }}>
          <DrawerHeader
            palette={palette}
            name={name}
            avatarUrl={avatarUrl ? `${avatarUrl}?v=${Date.now()}` : null} // лёгкий bust кеша
            onGoProfile={() => props.navigation.navigate('Profile')}
          />
        </View>

        <View style={{ paddingHorizontal: 10 }}>
          <DrawerItemList {...props} />
        </View>

        <View style={{ height: 14 }} />
        <View style={[styles.drawerFooter, { borderTopColor: palette.border }]}>
          <Text style={[styles.drawerFooterText, { color: palette.subtext }]}>v0.1 • Demo build</Text>
        </View>
      </DrawerContentScrollView>
    </SafeAreaView>
  );
}

export default function DrawerNavigator() {
  const scheme = useColorScheme();
  const palette = useMemo(() => makePalette(scheme === 'dark'), [scheme]);

  return (
    <Drawer.Navigator
      initialRouteName="Home"
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={({ route, navigation }) => ({
        headerTitleAlign: 'center',

        // Хедер: аккуратный, без "наезда" на вырезы.
        // SafeArea для header React Navigation сам учитывает на iOS,
        // но мы дополнительно делаем визуально лёгкий header.
        headerStyle: {
          backgroundColor: palette.card,
          ...(Platform.OS === 'ios'
            ? { shadowOpacity: 0, shadowColor: 'transparent' }
            : { elevation: 0 }),
        },
        headerTitleStyle: { fontWeight: '900', color: palette.text },
        headerTintColor: palette.text,
        headerLeft: () => (
          <Pressable
            onPress={() => navigation.toggleDrawer()}
            style={({ pressed }) => [{ paddingHorizontal: 14, opacity: pressed ? 0.65 : 1 }]}
          >
            <Ionicons name="menu" size={22} color={palette.text} />
          </Pressable>
        ),

        drawerType: 'front',
        drawerStyle: { width: 300, backgroundColor: palette.card },
        drawerActiveTintColor: palette.primary,
        drawerInactiveTintColor: palette.text,
        drawerLabelStyle: { fontSize: 14, fontWeight: '800' },
        drawerItemStyle: { borderRadius: 14, marginHorizontal: 6, marginVertical: 4 },
        drawerActiveBackgroundColor: 'rgba(45,107,255,0.14)',

        drawerIcon: ({ color, size, focused }) => {
          const s = size ?? 20;
          const c = focused ? palette.primary : color;

          switch (route.name) {
            case 'Home':
              return <Ionicons name="home-outline" size={s} color={c} />;
            case 'AddWorkout':
              return <Ionicons name="add-circle-outline" size={s} color={c} />;
            case 'History':
              return <Ionicons name="time-outline" size={s} color={c} />;
            case 'Analytics':
              return <Ionicons name="stats-chart-outline" size={s} color={c} />;
            case 'Achievements':
              return <Ionicons name="trophy-outline" size={s} color={c} />;
            case 'Profile':
              return <Ionicons name="person-outline" size={s} color={c} />;
              case 'Recommendations':
  return <Ionicons name="sparkles-outline" size={s} color={c} />;
            default:
              return <Ionicons name="ellipse-outline" size={s} color={c} />;
          }
        },
      })}
    >
      <Drawer.Screen name="Home" component={HomeScreen} options={{ title: 'Главная' }} />
      <Drawer.Screen name="Recommendations" component={RecommendationsScreen} options={{ title: 'Советы' }} />
      <Drawer.Screen name="AddWorkout" component={AddWorkoutScreen} options={{ title: 'Добавить тренировку' }} />
      <Drawer.Screen name="History" component={HistoryScreen} options={{ title: 'История' }} />
      <Drawer.Screen name="Analytics" component={AnalyticsScreen} options={{ title: 'Аналитика' }} />
      <Drawer.Screen name="Achievements" component={AchievementsScreen} options={{ title: 'Достижения' }} />
      <Drawer.Screen name="Profile" component={ProfileScreen} options={{ title: 'Профиль' }} />
    </Drawer.Navigator>
  );
}

const styles = StyleSheet.create({
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
  },
  drawerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  drawerAvatarText: { fontSize: 16, fontWeight: '900' },
  drawerName: { fontSize: 14.5, fontWeight: '900' },
  drawerMeta: { marginTop: 2, fontSize: 12, fontWeight: '700' },

  drawerFooter: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  drawerFooterText: { fontSize: 12, fontWeight: '700' },
});