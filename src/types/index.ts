export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'CLEANED' | 'DELAYED' | 'SKIPPED';
export type AccessStatus = 'ACCESSIBLE' | 'DND' | 'GUEST_PRESENT' | 'REFUSED_SERVICE';
export type RoomStatus = 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE' | 'RESERVED';
export type CleanStatus = 'CLEAN' | 'DIRTY' | 'CLEANING' | 'INSPECTED';
export type UserRole = 'ADMIN' | 'MANAGER' | 'RECEPTIONIST' | 'HOUSEKEEPING' | 'SUPERVISOR';
export type RoomType = 'SINGLE' | 'DOUBLE' | 'SUITE' | 'DELUXE' | 'PRESIDENTIAL';
export type MaintenanceSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type MaintenanceIssueType = 'ELECTRICAL' | 'PLUMBING' | 'FURNITURE' | 'HVAC' | 'APPLIANCE' | 'CLEANLINESS' | 'OTHER';
export type RoomPriorityLabel = 'CHECKOUT' | 'VIP_GUEST' | 'EARLY_CHECKIN' | 'STAYIN' | 'STANDARD';

// Matches the actual `users` table columns exactly
export interface User {
  user_id: number;
  username: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  shift_timing: string | null;
  assigned_floor: number | null;
  salary: number | null;
  is_active: boolean;
  failed_login_attempts: number;
  locked_until: string | null;
  last_login: string | null;
  push_token: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Shape returned by the authenticate_user RPC.
 * Now returns ALL user fields — no second HTTP fetch needed.
 * is_authenticated = false means login failed (message explains why).
 */
export interface AuthRPCResult extends Omit<User, 'role'> {
  role: string | null;          // RPC returns role as text, cast to UserRole after validation
  is_authenticated: boolean;
  message: string;
}

export interface Room {
  room_id: number;
  room_number: string;
  room_type: RoomType;
  floor_number: number;
  status: RoomStatus;
  clean_status: CleanStatus;
  has_ac: boolean;
  has_wifi: boolean;
  has_tv: boolean;
  has_balcony: boolean;
  has_mini_bar: boolean;
  last_cleaned_at: string | null;
  last_cleaned_by: number | null;
  base_price: number;
  current_price: number;
  max_occupancy: number;
}

export interface HousekeepingTask {
  task_id: number;
  room_id: number;
  assigned_to: number | null;
  priority: number;
  priority_label: RoomPriorityLabel | null;
  status: TaskStatus;
  access_status: AccessStatus;
  notes: string | null;
  photos: string[] | null;
  estimated_minutes: number;
  actual_minutes: number | null;
  due_time: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  checklist_data: ChecklistItem[];
  completion_notes: string | null;
  rooms?: Room;
  staff?: { full_name: string; username: string } | null;
}

export interface OrderedTask {
  task_id: number;
  room_number: string;
  room_type: RoomType;
  floor_number: number;
  priority: number;
  priority_label: RoomPriorityLabel | null;
  status: TaskStatus;
  access_status: AccessStatus;
  due_time: string | null;
  estimated_minutes: number;
  cleaning_priority_order: number;
  room_status: RoomStatus;
  clean_status: CleanStatus;
  started_at: string | null;
  order_position: number;
}

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
  category: 'bed' | 'bathroom' | 'amenities' | 'general';
}

export const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { id: 'bed_made',            label: 'Bed made & linens changed',    done: false, category: 'bed' },
  { id: 'pillows',             label: 'Pillows fluffed & arranged',   done: false, category: 'bed' },
  { id: 'bathroom_clean',      label: 'Bathroom cleaned & sanitized', done: false, category: 'bathroom' },
  { id: 'towels',              label: 'Towels replaced',              done: false, category: 'bathroom' },
  { id: 'toiletries',          label: 'Toiletries restocked',         done: false, category: 'bathroom' },
  { id: 'minibar',             label: 'Minibar restocked',            done: false, category: 'amenities' },
  { id: 'amenities_restocked', label: 'Amenities topped up',          done: false, category: 'amenities' },
  { id: 'trash_empty',         label: 'Trash emptied & bins lined',   done: false, category: 'general' },
  { id: 'floor_vacuumed',      label: 'Floor vacuumed / mopped',      done: false, category: 'general' },
  { id: 'surfaces_dusted',     label: 'Surfaces dusted',              done: false, category: 'general' },
  { id: 'ac_set',              label: 'AC set to default (24°C)',     done: false, category: 'general' },
  { id: 'lights_checked',      label: 'All lights working',           done: false, category: 'general' },
];

export const PRIORITY_LABELS: {
  label: string;
  value: RoomPriorityLabel;
  color: string;
  emoji: string;
  desc: string;
}[] = [
  { label: 'Checkout',       value: 'CHECKOUT',      color: '#ef4444', emoji: '🏃', desc: 'Must be ready for new guest' },
  { label: 'VIP Guest',      value: 'VIP_GUEST',     color: '#a855f7', emoji: '👑', desc: 'Immediate attention required' },
  { label: 'Early Check-in', value: 'EARLY_CHECKIN', color: '#f59e0b', emoji: '⏰', desc: 'Guest arriving before 2 pm' },
  { label: 'Stay-over',      value: 'STAYIN',        color: '#0ea5e9', emoji: '🛏', desc: 'Guest continuing their stay' },
  { label: 'Standard',       value: 'STANDARD',      color: '#475569', emoji: '🧹', desc: 'Regular daily cleaning' },
];

export interface MaintenanceIssue {
  issue_id: number;
  room_id: number;
  reported_by: number;
  linked_task_id: number | null;
  issue_type: MaintenanceIssueType;
  description: string;
  severity: MaintenanceSeverity;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  photo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface HelpRequest {
  request_id: number;
  task_id: number;
  requested_by: number;
  status: 'PENDING' | 'ACKNOWLEDGED' | 'RESOLVED';
  created_at: string;
}

export interface ShiftSummary {
  total_assigned: number;
  completed: number;
  pending: number;
  in_progress: number;
  delayed: number;
  skipped: number;
  dnd_count: number;
  avg_minutes: number | null;
  total_minutes: number;
  on_time_rate: number;
  overdue_tasks: HousekeepingTask[];
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  timestamp: number;
  read: boolean;
  type: 'task_assigned' | 'task_update' | 'maintenance' | 'general' | 'overdue' | 'dnd_flag';
  taskId?: number;
  roomNumber?: string;
}
