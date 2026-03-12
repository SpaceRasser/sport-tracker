import 'react-native-gesture-handler';
import 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import { AuthProvider } from './src/auth/AuthContext';
import { setupInterceptors } from './src/api/setupInterceptors';
import { navigationRef } from './src/navigation/navigationRef';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();
setupInterceptors();

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer ref={navigationRef}>
        <StatusBar style="dark" />
        <AppNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}