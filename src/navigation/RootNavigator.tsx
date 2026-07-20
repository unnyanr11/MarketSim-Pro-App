/**
 * RootNavigator — role-aware navigation.
 */
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import type { RoomPriorityLabel } from '../types';

// ─── Screen imports ───────────────────────────────────────────────────────────
import LoginScreen                from '../screens/LoginScreen';
import HomeScreen                 from '../screens/HomeScreen';
import SupervisorHomeScreen       from '../screens/SupervisorHomeScreen';
import ManagerHomeScreen          from '../screens/ManagerHomeScreen';
import { TaskListScreen }         from '../screens/TaskListScreen';
import { TaskDetailScreen }       from '../screens/TaskDetailScreen';
import ProfileScreen              from '../screens/ProfileScreen';
import { SupervisorScreen }       from '../screens/SupervisorScreen';
import { PhotoUploadScreen }      from '../screens/PhotoUploadScreen';
import { PerformanceScreen }      from '../screens/PerformanceScreen';
import { ShiftScheduleScreen }    from '../screens/ShiftScheduleScreen';
import { ShiftSummaryScreen }     from '../screens/ShiftSummaryScreen';
import ReportIssueScreen          from '../screens/ReportIssueScreen';
import RoomIssueHistoryScreen     from '../screens/RoomIssueHistoryScreen';
import { StaffPerformanceScreen } from '../screens/StaffPerformanceScreen';

// ─── Param list ───────────────────────────────────────────────────────────────
export type RootStackParamList = {
  Login:            undefined;
  Home:             undefined;
  SupervisorHome:   undefined;
  ManagerHome:      undefined;
  TaskList:         undefined;
  TaskDetail:       { task: import('../types').HousekeepingTask };
  Profile:          undefined;
  Supervisor:       undefined;
  PhotoUpload:      { taskId: number; roomNumber: string; existingPhotos: string[] };
  Performance:      undefined;
  ShiftSchedule:    undefined;
  ShiftSummary:     undefined;
  ReportIssue:      { task_id: number; room_id: number; room_number: string };
  RoomIssueHistory: { room_id: number; room_number: string };
  StaffPerformance: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const darkHeader = {
  headerStyle:      { backgroundColor: '#0f172a' },
  headerTintColor:  '#f1f5f9',
  headerTitleStyle: { fontWeight: '700' as const, fontSize: 17 },
  headerShadowVisible: false,
};

function RoleHomeScreen() {
  const { isOneOf } = usePermissions();
  if (isOneOf('MANAGER', 'ADMIN')) return <ManagerHomeScreen />;
  if (isOneOf('SUPERVISOR'))        return <SupervisorHomeScreen />;
  return <HomeScreen />;
}

const RootNavigator = () => {
  const { user, loading } = useAuth();
  if (loading) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={darkHeader}>
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="Home" component={RoleHomeScreen} options={{ headerShown: false }} />
            <Stack.Screen name="SupervisorHome" component={SupervisorHomeScreen} options={{ headerShown: false }} />
            <Stack.Screen name="ManagerHome" component={ManagerHomeScreen} options={{ headerShown: false }} />

            {/* Task flow */}
            <Stack.Screen name="TaskList"   component={TaskListScreen}   options={{ title: 'My Tasks' }} />
            <Stack.Screen name="TaskDetail" component={TaskDetailScreen} options={{ title: 'Task Details' }} />
            <Stack.Screen name="PhotoUpload" component={PhotoUploadScreen} options={{ title: 'Upload Photos', presentation: 'modal' }} />

            {/* Maintenance reporting */}
            <Stack.Screen
              name="ReportIssue"
              component={ReportIssueScreen}
              options={{ headerShown: false, presentation: 'modal', animation: 'slide_from_bottom' }}
            />
            <Stack.Screen
              name="RoomIssueHistory"
              component={RoomIssueHistoryScreen}
              options={{ headerShown: false }}
            />

            {/* Profile */}
            <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'My Profile', headerShown: false, presentation: 'modal', animation: 'slide_from_bottom' }} />

            {/* Performance / shift */}
            <Stack.Screen name="Performance"      component={PerformanceScreen}      options={{ title: 'My Performance' }} />
            <Stack.Screen name="StaffPerformance" component={StaffPerformanceScreen} options={{ title: 'Staff Performance' }} />
            <Stack.Screen name="ShiftSchedule"    component={ShiftScheduleScreen}    options={{ title: 'Shift Schedule' }} />
            <Stack.Screen name="ShiftSummary"     component={ShiftSummaryScreen}     options={{ title: "Today's Shift" }} />

            {/* Supervisor / Manager */}
            <Stack.Screen name="Supervisor" component={SupervisorScreen} options={{ title: 'Supervisor View' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default RootNavigator;
