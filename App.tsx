// App.tsx
import 'react-native-url-polyfill/auto';
import 'react-native-get-random-values';
import { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { supabase } from './src/supabase/client';
import type { Session } from '@supabase/supabase-js';

// Auth screens
import LoginPage from './src/pages/Login';
import RegisterPage from './src/pages/Register';

// App screens
import DashboardPage from './src/pages/Dashboard';

export type RootStackParamList = {
  // Auth
  Login: undefined;
  Register: undefined;
  // App
  Dashboard: undefined;
  Demands: { filter?: 'buy' | 'sell' } | undefined;
  DemandDetail: { demandId: string };
  CreateDemand: undefined;
  MyBids: undefined;
  Profile: { userId?: string } | undefined;
  Notifications: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const queryClient = new QueryClient();

function AppNavigator({ session }: { session: Session | null }) {
  return (
    <Stack.Navigator
      initialRouteName={session ? 'Dashboard' : 'Login'}
      screenOptions={{ headerShown: false }}
    >
      {session ? (
        <>
          <Stack.Screen name="Dashboard" component={DashboardPage} />
        </>
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginPage} />
          <Stack.Screen name="Register" component={RegisterPage} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' }}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <NavigationContainer>
        <StatusBar style="light" />
        <AppNavigator session={session} />
      </NavigationContainer>
    </QueryClientProvider>
  );
}
