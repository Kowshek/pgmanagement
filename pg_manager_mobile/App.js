import React, { useCallback, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { Bed, CreditCard, Home, Users } from 'lucide-react-native';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';

import ConfirmDialog from './src/components/ConfirmDialog';
import ErrorBoundary from './src/components/ErrorBoundary';
import CreatePropertyScreen from './src/screens/CreatePropertyScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import GuestDetailScreen from './src/screens/GuestDetailScreen';
import GuestFormModal from './src/screens/GuestFormModal';
import GuestsScreen from './src/screens/GuestsScreen';
import LoginScreen from './src/screens/LoginScreen';
import PaymentsScreen from './src/screens/PaymentsScreen';
import RecordPaymentModal from './src/screens/RecordPaymentModal';
import RegisterScreen from './src/screens/RegisterScreen';
import RoomFormModal from './src/screens/RoomFormModal';
import RoomsScreen from './src/screens/RoomsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { useStore } from './src/store/useStore';
import { theme } from './src/theme/theme';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Keep the splash screen visible until fonts and persisted state are ready.
SplashScreen.preventAutoHideAsync().catch(() => {});

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textTertiary,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          elevation: 0,
          height: 65,
          paddingBottom: 10,
          paddingTop: 8,
        },
        headerShown: false,
        tabBarLabelStyle: {
          fontFamily: 'PlusJakartaSans_600SemiBold',
          fontSize: 11,
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ tabBarIcon: ({ color }) => <Home color={color} size={22} /> }}
      />
      <Tab.Screen
        name="Guests"
        component={GuestsScreen}
        options={{ tabBarIcon: ({ color }) => <Users color={color} size={22} /> }}
      />
      <Tab.Screen
        name="Rooms"
        component={RoomsScreen}
        options={{ tabBarIcon: ({ color }) => <Bed color={color} size={22} /> }}
      />
      <Tab.Screen
        name="Payments"
        component={PaymentsScreen}
        options={{ tabBarIcon: ({ color }) => <CreditCard color={color} size={22} /> }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });
  const authChecked = useStore((s) => s.authChecked);
  const user = useStore((s) => s.user);
  const properties = useStore((s) => s.properties);
  const bootstrap = useStore((s) => s.bootstrap);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  // If fonts fail to load we still start — text falls back to system fonts.
  const ready = (fontsLoaded || !!fontError) && authChecked;

  const onLayoutRootView = useCallback(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <ErrorBoundary>
      <SafeAreaProvider onLayout={onLayoutRootView}>
        <StatusBar style="dark" />
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            {!user ? (
              <>
                <Stack.Screen name="Login" component={LoginScreen} />
                <Stack.Screen name="Register" component={RegisterScreen} />
              </>
            ) : properties.length === 0 ? (
              <Stack.Screen name="CreateProperty" component={CreatePropertyScreen} />
            ) : (
              <>
                <Stack.Screen name="Main" component={MainTabs} />
                <Stack.Screen name="GuestDetail" component={GuestDetailScreen} />
                <Stack.Screen name="Settings" component={SettingsScreen} />
                <Stack.Group screenOptions={{ presentation: 'modal' }}>
                  <Stack.Screen name="GuestForm" component={GuestFormModal} />
                  <Stack.Screen name="RoomForm" component={RoomFormModal} />
                  <Stack.Screen name="RecordPayment" component={RecordPaymentModal} />
                </Stack.Group>
              </>
            )}
          </Stack.Navigator>
        </NavigationContainer>
        <ConfirmDialog />
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
