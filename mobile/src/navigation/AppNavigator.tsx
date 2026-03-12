import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuth } from '../auth/AuthContext';
import AuthNavigator from './AuthNavigator';
import DrawerNavigator from './DrawerNavigator';
import WorkoutDetailsScreen from '../screens/WorkoutDetailsScreen';
import EditWorkoutScreen from '../screens/EditWorkoutScreen';
import ProfileScreen from '../screens/ProfileScreen';

import * as Notifications from 'expo-notifications';
import { registerPushIfNeeded } from '../notifications/push';
import { navigate } from './navigationRef';
import { syncTimezone } from '../notifications/syncTimezone';
import { getMe } from '../api/userApi';

export type RootStackParamList = {
  Drawer: undefined;
  WorkoutDetails: { workoutId: string };
  EditWorkout: { workoutId: string };
  ProfileSetup: { forcedSetup?: boolean } | undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function AuthedStack({ requireProfileSetup }: { requireProfileSetup: boolean }) {
  return (
    <Stack.Navigator
      initialRouteName={requireProfileSetup ? 'ProfileSetup' : 'Drawer'}
      screenOptions={{ headerTitleAlign: 'center' }}
    >
      <Stack.Screen
        name="Drawer"
        component={DrawerNavigator}
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="WorkoutDetails"
        component={WorkoutDetailsScreen}
        options={{ title: 'Тренировка' }}
      />

      <Stack.Screen
        name="EditWorkout"
        component={EditWorkoutScreen}
        options={{ title: 'Редактировать' }}
      />

      <Stack.Screen
        name="ProfileSetup"
        component={ProfileScreen}
        initialParams={{ forcedSetup: true }}
        options={{
          headerShown: false,
          gestureEnabled: false,
        }}
      />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const { accessToken, isLoading } = useAuth();

  const [gateLoading, setGateLoading] = useState(false);
  const [requireProfileSetup, setRequireProfileSetup] = useState(false);

  const checkProfileCompletion = useCallback(async () => {
    if (!accessToken) {
      setRequireProfileSetup(false);
      return;
    }

    try {
      setGateLoading(true);

      const data = await getMe();
      const p = data?.user?.profile;

      // Минимально обязательные физ. данные
      const isComplete =
        !!p &&
        p.heightCm != null &&
        p.weightKg != null &&
        p.gender != null &&
        p.gender !== 'unknown';

      setRequireProfileSetup(!isComplete);
    } catch (e) {
      // Если API временно не ответил — не блокируем пользователя насмерть
      setRequireProfileSetup(false);
    } finally {
      setGateLoading(false);
    }
  }, [accessToken]);

  // клики по пуш-уведомлениям
  useEffect(() => {
    const handle = (data: any) => {
      const workoutId = data?.workoutId;
      if (typeof workoutId === 'string' && workoutId.length > 0) {
        navigate('WorkoutDetails', { workoutId });
      }
    };

    Notifications.getLastNotificationResponseAsync().then((resp) => {
      if (resp?.notification?.request?.content?.data) {
        handle(resp.notification.request.content.data);
      }
    });

    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      handle(resp.notification.request.content.data);
    });

    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!accessToken) return;

    registerPushIfNeeded().catch((e) => console.log('[push] error:', e?.message ?? e));
    syncTimezone().catch((e) => console.log('[tz] error:', e?.message ?? e));
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) {
      setRequireProfileSetup(false);
      setGateLoading(false);
      return;
    }

    checkProfileCompletion().catch(() => {});
  }, [accessToken, checkProfileCompletion]);

  if (isLoading || (accessToken && gateLoading)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return accessToken ? (
    <AuthedStack requireProfileSetup={requireProfileSetup} />
  ) : (
    <AuthNavigator />
  );
}