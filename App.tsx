import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { PopupHost } from './src/components/Popup';

export default function App() {
  return (
    <SafeAreaProvider>
      <AppNavigator />
      <PopupHost />
    </SafeAreaProvider>
  );
}
