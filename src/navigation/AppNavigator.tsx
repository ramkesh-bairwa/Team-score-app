import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Welcome1 from '../screens/Welcome1';
import Welcome2 from '../screens/Welcome2';
import Welcome3 from '../screens/Welcome3';
import HomeScreen from '../screens/HomeScreen';
import SetupTeamScreen from '../screens/SetupTeamScreen';
import BetScreen from '../screens/BetScreen';
import TossScreen from '../screens/TossScreen';
import ScoringScreen from '../screens/ScoringScreen';
import ScorecardScreen from '../screens/ScorecardScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Stack.Screen name="Welcome1" component={Welcome1} />
        <Stack.Screen name="Welcome2" component={Welcome2} />
        <Stack.Screen name="Welcome3" component={Welcome3} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="SetupTeam" component={SetupTeamScreen} options={{ gestureEnabled: false }} />
        <Stack.Screen name="Toss" component={TossScreen} options={{ gestureEnabled: false }} />
        <Stack.Screen name="Bet" component={BetScreen} options={{ gestureEnabled: false }} />
        <Stack.Screen name="Scoring" component={ScoringScreen} options={{ gestureEnabled: false }} />
        <Stack.Screen name="Scorecard" component={ScorecardScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
