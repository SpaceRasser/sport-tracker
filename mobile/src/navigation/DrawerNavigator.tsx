import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';

import HomeScreen from '../screens/HomeScreen';
import AddWorkoutScreen from '../screens/AddWorkoutScreen';
import HistoryScreen from '../screens/HistoryScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import ProfileScreen from '../screens/ProfileScreen';

export type DrawerParamList = {
  Home: undefined;
  AddWorkout: undefined;
  History: undefined;
  Analytics: undefined;
  Profile: undefined;
};

const Drawer = createDrawerNavigator<DrawerParamList>();

export default function DrawerNavigator() {
  return (
    <Drawer.Navigator
      initialRouteName="Home"
      screenOptions={{ headerTitleAlign: 'center', drawerType: 'front' }}
    >
      <Drawer.Screen name="Home" component={HomeScreen} options={{ title: 'Главная' }} />
      <Drawer.Screen name="AddWorkout" component={AddWorkoutScreen} options={{ title: 'Добавить тренировку' }} />
      <Drawer.Screen name="History" component={HistoryScreen} options={{ title: 'История' }} />
      <Drawer.Screen name="Analytics" component={AnalyticsScreen} options={{ title: 'Аналитика' }} />
      <Drawer.Screen name="Profile" component={ProfileScreen} options={{ title: 'Профиль' }} />
    </Drawer.Navigator>
  );
}
