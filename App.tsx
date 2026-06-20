import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SymbolView } from 'expo-symbols';
import { initHealthKit } from './src/services/healthkit';
import { requestLocationPermission } from './src/services/gps';
import { WorkoutScreen } from './src/screens/WorkoutScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { RouteScreen } from './src/screens/RouteScreen';
import { SplashScreen } from './src/screens/SplashScreen';

const Tab = createBottomTabNavigator();

const NavTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: '#000000' },
};

export default function App() {
  const [ready, setReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        await initHealthKit();
        const ok = await requestLocationPermission();
        if (!ok) Alert.alert('GPS erforderlich', 'Bitte erlaube den Standortzugriff in den Einstellungen.');
      } catch {
        // HealthKit nicht verfügbar im Simulator
      } finally {
        setReady(true);
      }
    };
    init();
  }, []);

  // Splash first — nothing else renders until both animation done AND init complete
  if (showSplash) {
    return <SplashScreen onDone={() => setShowSplash(false)} />;
  }

  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: '#000' }} />;
  }

  return (
    <NavigationContainer theme={NavTheme}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: 'rgba(18,18,18,0.95)',
            borderTopColor: '#2C2C2E',
            borderTopWidth: StyleSheet.hairlineWidth,
          },
          tabBarActiveTintColor: '#FF3B30',
          tabBarInactiveTintColor: '#48484A',
          tabBarLabelStyle: { fontSize: 10, fontWeight: '600', letterSpacing: 0.2 },
        }}
      >
        <Tab.Screen
          name="Training"
          component={WorkoutScreen}
          options={{
            tabBarIcon: ({ color, size }) => (
              <SymbolView name="figure.run.circle.fill" size={size + 2} tintColor={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Routen"
          component={RouteScreen}
          options={{
            tabBarIcon: ({ color, size }) => (
              <SymbolView name="map.fill" size={size + 2} tintColor={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Verlauf"
          component={HistoryScreen}
          options={{
            tabBarIcon: ({ color, size }) => (
              <SymbolView name="chart.bar.fill" size={size + 2} tintColor={color} />
            ),
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({});
