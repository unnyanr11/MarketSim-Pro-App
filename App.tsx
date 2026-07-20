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
import DemandsPage from './src/pages/Demands';
import DemandDetailPage from './src/pages/DemandDetail';
import CreateDemandPage from './src/pages/CreateDemand';
import MyBidsPage from './src/pages/MyBids';
import ProfilePage from './src/pages/Profile';
import NotificationsPage from './src/pages/Notifications';
import MessagesPage from './src/pages/Messages';
import MessageThreadPage from './src/pages/MessageThread';
import OrdersPage from './src/pages/Orders';
import SettingsPage from './src/pages/Settings';
import UsersPage from './src/pages/Users';
import WatchlistPage from './src/pages/Watchlist';
import AllianceHubPage from './src/pages/AllianceHub';
import AllianceCreatePage from './src/pages/AllianceCreate';
import AllianceDashboardPage from './src/pages/AllianceDashboard';
import AllianceChatPage from './src/pages/AllianceChat';
import AllianceSettingsPage from './src/pages/AllianceSettings';

export type RootStackParamList = {
  // Auth
  Login: undefined;
  Register: undefined;
  // Core
  Dashboard: undefined;
  Demands: { filter?: 'buy' | 'sell' } | undefined;
  DemandDetail: { demandId: string };
  CreateDemand: undefined;
  MyBids: undefined;
  Profile: { userId?: string } | undefined;
  Notifications: undefined;
  // Messaging
  Messages: undefined;
  MessageThread: { threadId: string; otherUserName: string };
  // Commerce
  Orders: undefined;
  // User
  Settings: undefined;
  Users: undefined;
  Watchlist: undefined;
  // Alliance
  AllianceHub: undefined;
  AllianceCreate: undefined;
  AllianceDashboard: { allianceId: string };
  AllianceChat: { allianceId: string; allianceName: string };
  AllianceSettings: { allianceId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const queryClient = new QueryClient();

/**
 * All screens are ALWAYS registered — no conditional wrapping.
 * React Navigation requires every screen to be mounted unconditionally inside
 * Stack.Navigator. The session prop only controls initialRouteName.
 */
function AppNavigator({ session }: { session: Session | null }) {
  return (
    <Stack.Navigator
      initialRouteName={session ? 'Dashboard' : 'Login'}
      screenOptions={{ headerShown: false }}
    >
      {/* ── Auth ─────────────────────────────────────────────── */}
      <Stack.Screen name="Login" component={LoginPage} />
      <Stack.Screen name="Register" component={RegisterPage} />

      {/* ── Core ─────────────────────────────────────────────── */}
      <Stack.Screen name="Dashboard" component={DashboardPage} />
      <Stack.Screen name="Demands" component={DemandsPage} />
      <Stack.Screen name="DemandDetail" component={DemandDetailPage} />
      <Stack.Screen name="CreateDemand" component={CreateDemandPage} />
      <Stack.Screen name="MyBids" component={MyBidsPage} />
      <Stack.Screen name="Profile" component={ProfilePage} />
      <Stack.Screen name="Notifications" component={NotificationsPage} />

      {/* ── Messaging ────────────────────────────────────────── */}
      <Stack.Screen name="Messages" component={MessagesPage} />
      <Stack.Screen name="MessageThread" component={MessageThreadPage} />

      {/* ── Commerce / User ──────────────────────────────────── */}
      <Stack.Screen name="Orders" component={OrdersPage} />
      <Stack.Screen name="Settings" component={SettingsPage} />
      <Stack.Screen name="Users" component={UsersPage} />
      <Stack.Screen name="Watchlist" component={WatchlistPage} />

      {/* ── Alliance ─────────────────────────────────────────── */}
      <Stack.Screen name="AllianceHub" component={AllianceHubPage} />
      <Stack.Screen name="AllianceCreate" component={AllianceCreatePage} />
      <Stack.Screen name="AllianceDashboard" component={AllianceDashboardPage} />
      <Stack.Screen name="AllianceChat" component={AllianceChatPage} />
      <Stack.Screen name="AllianceSettings" component={AllianceSettingsPage} />
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
