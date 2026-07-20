import { supabase } from './client';
import type { User } from '../types';

export const getUserProfile = async (userId: number): Promise<User> => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error) throw error;
  if (!data) throw new Error('User not found');
  return data as User;
};

/**
 * Returns all active staff members (HOUSEKEEPING role) for reassignment picker.
 */
export const getStaffList = async (): Promise<User[]> => {
  const { data, error } = await supabase
    .from('users')
    .select('user_id, full_name, username, role, assigned_floor, is_active')
    .eq('is_active', true)
    .order('full_name', { ascending: true });
  if (error) {
    console.error('[getStaffList]', error.message);
    return [];
  }
  return (data ?? []) as User[];
};

/**
 * Password change is handled server-side via the change_password RPC.
 */
export const updateUserPassword = async (
  userId: number,
  currentPassword: string,
  newPassword: string,
): Promise<{ success: boolean; message: string }> => {
  const { data, error } = await supabase
    .rpc('change_password', {
      p_user_id: userId,
      p_current: currentPassword,
      p_new:     newPassword,
    });

  if (error) {
    console.error('[updateUserPassword]', error.message);
    throw new Error(error.message);
  }

  if (data === false) {
    return { success: false, message: 'Current password is incorrect' };
  }

  return { success: true, message: 'Password updated successfully' };
};
