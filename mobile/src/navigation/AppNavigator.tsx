import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuth } from '../auth/AuthContext';
import AuthNavigator from './AuthNavigator';
import DrawerNavigator from './DrawerNavigator';
import WorkoutDetailsScreen from '../screens/WorkoutDetailsScreen';
import EditWorkoutScreen from '../screens/EditWorkoutScreen';

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
      <Stack.Screen
        name="WorkoutDetails"
        component={WorkoutDetailsScreen}
        options={{ title: 'Тренировка' }}
      />
      <Stack.Screen name="EditWorkout" component={EditWorkoutScreen} options={{ title: 'Редактировать' }} />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const { accessToken, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return accessToken ? <AuthedStack /> : <AuthNavigator />;
}
