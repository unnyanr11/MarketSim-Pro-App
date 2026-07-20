# HMS Housekeeping — Improvements Log

## 🔐 Security Fixes
- Moved Supabase credentials to env vars (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`)
- Deprecated `src/api/auth.ts` (plaintext password comparison removed)
- All auth now goes through `authenticate_user` RPC (server-side secure)

## 🗃️ Database Changes (Migration: `add_housekeeping_features_v2`)
- Added `access_status`, `dnd_noted_at`, `checklist_done`, `completion_notes` to `housekeeping_tasks`
- New table: `maintenance_issues` (report broken items from within a task)
- New table: `shift_summaries` (daily performance tracking)
- New RPCs:
  - `report_maintenance_issue` — logs issue & auto-sets room to MAINTENANCE if critical
  - `update_task_access_status` — DND / Guest Present / Refused Service
  - `complete_task_with_checklist` — marks task CLEANED + updates room.clean_status
  - `get_shift_summary` — today's stats for a staff member
  - `get_ordered_tasks_for_staff` — smart-ordered task list (checkout first, then priority)
- New view: `v_cleaning_order` — ordering logic for tasks

## 🏗️ Architecture Changes
- `src/lib/logger.ts` — DEV-only logger, replaces all `console.log` calls
- `src/lib/client.ts` — Supabase client now uses env vars + AsyncStorage session
- `src/types/index.ts` — Fully typed models (User, Task, Room, MaintenanceIssue, ShiftSummary, etc.)
- `src/hooks/useAuth.tsx` — Session persisted to AsyncStorage (survives app restarts)
- `src/hooks/useRealtimeRooms.ts` — Unique channel name per user (no event loss)
- `src/services/notifications.ts` — Push token registration extracted from HomeScreen
- `src/services/notificationStorage.ts` — Notifications persisted to AsyncStorage
- `src/components/ErrorBoundary.tsx` — Wraps NavigationContainer, catches crashes
- `src/components/NotificationPanel.tsx` — Notification modal with read/unread/clear

## 📱 New Screens
- `TaskListScreen.tsx` — Smart-sorted task list with realtime updates + pull-to-refresh
- `TaskDetailScreen.tsx` — Full task detail with checklist, DND buttons, completion, maintenance report
- `ShiftSummaryScreen.tsx` — Daily shift stats (completion %, avg time, DND count, etc.)

## 🧹 Code Quality
- `tsconfig.json` — strict mode enabled
- `app.json` — EAS project ID, notifications plugin, dark splash
- `auth.ts` — deprecated, stub only
