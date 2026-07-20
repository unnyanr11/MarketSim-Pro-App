// src/types/User.ts
export interface User {
  id: number;
  user_id: number;
  auth_id?: string;
  name: string;
  username?: string;
  full_name?: string;
  email: string;
  phone?: string | null;
  phone_number?: string | null;
  role: string;
  shift?: string | null;
  shift_timing?: string | null;
  assigned_floor?: number | null;  // floor assigned to this staff member
  salary?: number | null;
  is_active: boolean;
  push_token?: string | null;
  created_at?: string;
}
