export type TaskStatus = "PENDING" | "IN_PROGRESS" | "CLEANED" | "DELAYED" | "MAINTENANCE_HOLD";
export type TaskPriority = 1 | 2 | 3 | 4;
export type RoomType = "SINGLE" | "DOUBLE" | "SUITE" | "DELUXE" | "PRESIDENTIAL";
export type RoomStatus = "AVAILABLE" | "OCCUPIED" | "RESERVED" | "MAINTENANCE" | "OUT_OF_SERVICE";
export type CleanStatus = "CLEAN" | "DIRTY" | "INSPECTED";

export type IssueType = "ELECTRICAL" | "PLUMBING" | "FURNITURE" | "HVAC" | "APPLIANCE" | "CLEANLINESS" | "OTHER";
export type IssueSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type IssueStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

export interface MaintenanceIssue {
  issue_id: number;
  room_id: number;
  reported_by: number;
  task_id?: number | null;
  linked_task_id?: number | null;
  issue_type: IssueType;
  description: string;
  photo_urls: string[];
  severity: IssueSeverity;
  status: IssueStatus;
  cannot_complete: boolean;
  room_blocked: boolean;
  resolved_at?: string | null;
  resolved_by?: number | null;
  resolution_notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateIssueInput {
  room_id: number;
  reported_by: number;
  task_id?: number;
  issue_type: IssueType;
  description: string;
  severity: IssueSeverity;
  cannot_complete: boolean;
  photo_urls?: string[];
}

export interface Task {
  task_id: number;
  room_id: number;
  room_number: string;
  room_type: string;
  floor_number: number;
  floor_display_name?: string;
  assigned_to?: number;
  status: TaskStatus;
  priority: TaskPriority;
  estimated_minutes: number;
  due_time?: string;
  started_at?: string | null;
  completed_at?: string | null;
  notes?: string | null;
  photos?: string[] | null;
  created_at: string;
  updated_at?: string;
  is_my_floor?: boolean;
  floor_distance?: number;
  minutes_in_progress?: number | null;
}

export interface TaskDetailResponse {
  task_id: number;
  room_id: number;
  room_number: string;
  room_type: string;
  floor_number: number;
  floor_display_name: string;
  room_status: RoomStatus;
  clean_status: CleanStatus;
  task_status: TaskStatus;
  priority: TaskPriority;
  estimated_minutes: number;
  due_time: string | null;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
  photos: string[] | null;
  minutes_in_progress: number | null;
}

export interface TaskStats {
  total_tasks: number;
  pending_tasks: number;
  in_progress_tasks: number;
  completed_tasks: number;
}

export interface StaffWorkload {
  user_id: number;
  username: string;
  full_name: string;
  total_tasks: number;
  pending_tasks: number;
  in_progress_tasks: number;
  completed_tasks: number;
  avg_floor: number;
  floors_covered: string;
}

export interface CreateTaskInput {
  room_id: number;
  assigned_to?: number;
  priority?: TaskPriority;
  estimated_minutes?: number;
  due_time?: string;
  notes?: string;
}

export interface UpdateTaskInput {
  status?: TaskStatus;
  priority?: TaskPriority;
  notes?: string;
  photos?: string[];
}
