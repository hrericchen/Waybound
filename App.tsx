import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { PostHogProvider } from 'posthog-react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, AuthContext } from './src/context/AuthContext';
import { RevenueCatProvider } from './src/context/RevenueCatContext';
import { RootNavigator } from './src/navigation';
import { ThemeProvider } from './src/theme/theme';
import { adService } from './src/services/adService';
import { posthog } from './src/config/posthog';

export default function App() {
  useEffect(() => {
    adService.init();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <RevenueCatProvider>
            <AuthProvider>
              <NavigationContainer>
                {posthog ? (
                  <PostHogProvider client={posthog}>
                    <RootNavigator />
                  </PostHogProvider>
                ) : (
                  <RootNavigator />
                )}
              </NavigationContainer>
              <StatusBar style="dark" />
            </AuthProvider>
          </RevenueCatProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
