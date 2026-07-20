import { supabase } from './client';

export type IssueSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type IssueType = 'ELECTRICAL' | 'PLUMBING' | 'FURNITURE' | 'HVAC' | 'APPLIANCE' | 'CLEANLINESS' | 'OTHER';

export interface MaintenanceIssue {
  issue_id: number;
  room_id: number;
  reported_by: number;
  task_id?: number | null;
  linked_task_id?: number | null;
  issue_type: IssueType;
  description: string;
  severity: IssueSeverity;
  status: string;
  cannot_complete: boolean;
  room_blocked: boolean;
  photo_urls: string[];
  reporter_name?: string;
  created_at: string;
  resolved_at?: string | null;
  resolution_notes?: string | null;
}

export interface ReportIssuePayload {
  room_id: number;
  reported_by: number;
  task_id?: number | null;
  linked_task_id?: number | null;
  issue_type: IssueType;
  description: string;
  severity: IssueSeverity;
  cannot_complete: boolean;
  photo_urls?: string[];
}

export async function reportIssue(payload: ReportIssuePayload): Promise<MaintenanceIssue | null> {
  const { data, error } = await supabase
    .from('maintenance_issues')
    .insert({
      ...payload,
      photo_urls: payload.photo_urls ?? [],
      status: 'OPEN',
    })
    .select()
    .single();

  if (error) {
    console.error('reportIssue error:', error);
    return null;
  }
  return data as MaintenanceIssue;
}

export async function getRoomIssueHistory(roomId: number): Promise<MaintenanceIssue[]> {
  const { data, error } = await supabase
    .rpc('get_room_issue_history', { p_room_id: roomId });

  if (error) {
    console.error('getRoomIssueHistory error:', error);
    return [];
  }
  return (data ?? []) as MaintenanceIssue[];
}

export async function getActiveIssuesForRoom(roomId: number): Promise<MaintenanceIssue[]> {
  const { data, error } = await supabase
    .from('maintenance_issues')
    .select('*')
    .eq('room_id', roomId)
    .in('status', ['OPEN', 'IN_PROGRESS'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('getActiveIssuesForRoom error:', error);
    return [];
  }
  return (data ?? []) as MaintenanceIssue[];
}
