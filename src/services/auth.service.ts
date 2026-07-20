/**
 * auth.service.ts — React Native
 * Ported from AuthContext.tsx (web).
 *
 * Provides login, register, logout, resetPassword, updateUserProfile,
 * refreshProfile as plain async functions — no React context needed.
 *
 * KEY FIX for "invalid credentials":
 *   register() now calls supabase.auth.setSession() with the tokens returned
 *   by signUp() BEFORE upserting UserProfile, then signs out so the user must
 *   log in explicitly. This matches the web AuthContext flow exactly.
 */

import { supabase } from '../supabase/client';
import type { User } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface UserProfile {
  userId: string;
  email: string;
  displayName: string;
  companyName: string;
  region: string;
  bio?: string;
  avatarURL?: string;
  preferences: {
    notificationSettings: {
      emailNotifications: boolean;
      pushNotifications: boolean;
      newDemands: boolean;
      priceChanges: boolean;
      messages: boolean;
    };
    preferredRegions: string[];
    language: string;
    theme: string;
  };
  createdAt: Date;
  updatedAt: Date;
  isEmailVerified: boolean;
  isActive: boolean;
}

export interface RegisterData {
  email: string;
  password: string;
  displayName: string;
  companyName: string;
  region: string;
  bio?: string;
  preferences?: Partial<UserProfile['preferences']>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const mapDbToProfile = (row: any, user: User): UserProfile => ({
  userId: row.user_id,
  email: row.email,
  displayName: row.display_name,
  companyName: row.company_name,
  region: row.region,
  bio: row.bio ?? '',
  avatarURL: row.avatar_url ?? '',
  preferences: {
    notificationSettings: {
      emailNotifications: row.preferences?.notificationSettings?.emailNotifications ?? true,
      pushNotifications: row.preferences?.notificationSettings?.pushNotifications ?? true,
      newDemands: row.preferences?.notificationSettings?.newDemands ?? true,
      priceChanges: row.preferences?.notificationSettings?.priceChanges ?? true,
      messages: row.preferences?.notificationSettings?.messages ?? true,
    },
    preferredRegions: row.preferences?.preferredRegions ?? [row.region].filter(Boolean),
    language: row.preferences?.language ?? 'en',
    theme: row.preferences?.theme ?? 'system',
  },
  createdAt: row.created_at ? new Date(row.created_at) : new Date(),
  updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
  isEmailVerified: !!user.email_confirmed_at,
  isActive: true,
});

const buildFallbackProfileRow = (user: User) => ({
  user_id: user.id,
  email: user.email,
  display_name:
    user.user_metadata?.display_name ||
    user.user_metadata?.full_name ||
    user.email?.split('@')[0] ||
    'User',
  company_name: user.user_metadata?.company_name ?? user.user_metadata?.companyName ?? '',
  region: user.user_metadata?.region ?? 'US',
  bio: user.user_metadata?.bio ?? '',
  avatar_url: user.user_metadata?.avatar_url ?? '',
  preferences: {
    preferredRegions: [user.user_metadata?.region ?? 'US'],
    notificationSettings: {
      emailNotifications: true,
      pushNotifications: true,
      newDemands: true,
      priceChanges: true,
      messages: true,
    },
    language: 'en',
    theme: 'system',
  },
});

// ---------------------------------------------------------------------------
// Auth Service
// ---------------------------------------------------------------------------
export const authService = {
  /**
   * Sign in with email + password.
   * Returns the logged-in User and their profile.
   */
  async login(email: string, password: string): Promise<{ user: User; profile: UserProfile | null }> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error || !data.user) throw error ?? new Error('Invalid login credentials');

    let profile: UserProfile | null = null;
    try {
      const { data: row, error: profErr } = await supabase
        .from('UserProfile')
        .select('*')
        .eq('user_id', data.user.id)
        .single();

      if (!profErr && row) {
        profile = mapDbToProfile(row, data.user);
      } else if (profErr?.code === 'PGRST116') {
        // Profile missing — auto-create from user_metadata
        const { data: newRow } = await supabase
          .from('UserProfile')
          .insert(buildFallbackProfileRow(data.user))
          .select()
          .single();
        if (newRow) profile = mapDbToProfile(newRow, data.user);
      }
    } catch (e) {
      console.warn('[authService.login] profile fetch failed (non-blocking):', e);
    }

    return { user: data.user, profile };
  },

  /**
   * Register a new user.
   *
   * FIX: calls setSession() with the tokens from signUp() BEFORE upserting
   * UserProfile so that auth.uid() is available for the RLS INSERT policy.
   * Then signs out so the user must log in explicitly (matches web flow).
   */
  async register(userData: RegisterData): Promise<User> {
    const { data, error } = await supabase.auth.signUp({
      email: userData.email.trim(),
      password: userData.password,
      options: {
        data: {
          display_name: userData.displayName,
          company_name: userData.companyName,
          companyName: userData.companyName,
          region: userData.region,
          bio: userData.bio ?? '',
        },
      },
    });

    if (error || !data.user) throw error ?? new Error('Registration failed');

    // Establish session BEFORE touching DB so RLS passes
    if (data.session?.access_token) {
      await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
    }

    // Upsert profile row
    const profileRow = {
      user_id: data.user.id,
      email: userData.email.trim(),
      display_name: userData.displayName,
      company_name: userData.companyName,
      region: userData.region,
      bio: userData.bio ?? '',
      avatar_url: '',
      preferences: {
        preferredRegions: [userData.region],
        notificationSettings: {
          emailNotifications: userData.preferences?.notificationSettings?.emailNotifications ?? true,
          pushNotifications: true,
          newDemands: userData.preferences?.notificationSettings?.newDemands ?? true,
          priceChanges: userData.preferences?.notificationSettings?.priceChanges ?? true,
          messages: userData.preferences?.notificationSettings?.messages ?? true,
        },
        language: 'en',
        theme: 'system',
        ...userData.preferences,
      },
    };

    const { error: upsertErr } = await supabase
      .from('UserProfile')
      .upsert(profileRow, { onConflict: 'user_id' });

    if (upsertErr) {
      console.error('[authService.register] UserProfile upsert failed:', upsertErr);
      throw new Error('Failed to create profile: ' + upsertErr.message);
    }

    // Sign out after registration — user must log in explicitly
    try { await supabase.auth.signOut(); } catch { }

    return data.user;
  },

  /** Sign out of current session. */
  async logout(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) console.warn('[authService.logout]', error.message);
  },

  /** Send a password reset email. */
  async resetPassword(email: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    if (error) throw error;
  },

  /** Update profile fields in UserProfile table. */
  async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<void> {
    const payload: any = { updated_at: new Date().toISOString() };
    if (updates.displayName) payload.display_name = updates.displayName;
    if (updates.companyName) payload.company_name = updates.companyName;
    if (updates.region) payload.region = updates.region;
    if (updates.bio !== undefined) payload.bio = updates.bio;
    if (updates.avatarURL !== undefined) payload.avatar_url = updates.avatarURL;
    if (updates.preferences) payload.preferences = updates.preferences;

    const { error } = await supabase.from('UserProfile').update(payload).eq('user_id', userId);
    if (error) throw error;
  },

  /** Refresh profile from DB. */
  async refreshProfile(user: User): Promise<UserProfile | null> {
    const { data, error } = await supabase
      .from('UserProfile')
      .select('*')
      .eq('user_id', user.id)
      .single();
    if (error || !data) return null;
    return mapDbToProfile(data, user);
  },

  /** Get currently authenticated user (from active session). */
  async getCurrentUser(): Promise<User | null> {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  },

  /** Change password for currently logged-in user. */
  async changePassword(newPassword: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  },

  /** Resend signup confirmation email. */
  async resendConfirmation(email: string): Promise<void> {
    const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim() });
    if (error) throw error;
  },
};

export default authService;
