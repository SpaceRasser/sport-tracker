import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuth } from '../auth/AuthContext';
import AuthNavigator from './AuthNavigator';
import DrawerNavigator from './DrawerNavigator';
import WorkoutDetailsScreen from '../screens/WorkoutDetailsScreen';
import EditWorkoutScreen from '../screens/EditWorkoutScreen';

import * as Notifications from 'expo-notifications';
import { registerPushIfNeeded } from '../notifications/push';
import { navigate } from './navigationRef';
import { syncTimezone } from '../notifications/syncTimezone';

export type RootStackParamList = {
  Drawer: undefined;
  WorkoutDetails: { workoutId: string };
  EditWorkout: { workoutId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function AuthedStack() {
  return (
    <Stack.Navigator screenOptions={{ headerTitleAlign: 'center' }}>
      <Stack.Screen name="Drawer" component={DrawerNavigator} options={{ headerShown: false }} />
      <Stack.Screen name="WorkoutDetails" component={WorkoutDetailsScreen} options={{ title: 'Тренировка' }} />
      <Stack.Screen name="EditWorkout" component={EditWorkoutScreen} options={{ title: 'Редактировать' }} />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const { accessToken, isLoading } = useAuth();

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

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return accessToken ? <AuthedStack /> : <AuthNavigator />;
}