import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { PopupHost } from './src/components/Popup';
import { refreshApiUrl } from './src/services/server';

// Find a reachable CricScore server as soon as the app opens
refreshApiUrl().catch(() => {});

export default function App() {
  return (
    <SafeAreaProvider>
      <AppNavigator />
      <PopupHost />
    </SafeAreaProvider>
  );
}
