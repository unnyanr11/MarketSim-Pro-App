import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import { User } from "../types/User";
import { supabase, setSessionUserId } from "../api/client";

type AuthContextType = {
  user: User | null;
  loading: boolean;
  /** Alias for loading — used by some screens as isLoading */
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Explicit column list — avoids the duplicate-column bug.
const USER_COLUMNS = [
  'user_id',
  'username',
  'password_hash',
  'full_name',
  'role',
  'assigned_floor',
  'shift_timing',
  'salary',
  'is_active',
  'locked_until',
  'push_token',
  'created_at',
].join(',');

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log(
      'Auth state:',
      user
        ? `LOGGED_IN (${user.username} | ${user.role} | floor=${user.assigned_floor})`
        : 'LOGGED_OUT',
    );
  }, [user]);

  // ── On mount: restore session + set RLS context ──────────────────────────
  useEffect(() => {
    loadUser();

    // Re-apply session user_id when app comes back to foreground
    // (Supabase opens a fresh connection on resume, clearing the GUC)
    const sub = AppState.addEventListener('change', async (state) => {
      if (state === 'active') {
        const raw = await AsyncStorage.getItem('user').catch(() => null);
        if (raw) {
          const parsed = JSON.parse(raw) as User;
          await setSessionUserId(parsed.user_id);
        }
      }
    });
    return () => sub.remove();
  }, []);

  const loadUser = async () => {
    try {
      const storedUser = await AsyncStorage.getItem('user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser) as User;
        console.log('User loaded from storage:', parsed.username, '| role:', parsed.role, '| floor:', parsed.assigned_floor);

        // ── KEY FIX: tell Postgres who this user is so RLS works ──────────
        await setSessionUserId(parsed.user_id);

        setUser(parsed);
      }
    } catch (err) {
      console.error('Error loading user:', err);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    try {
      setLoading(true);

      // Step 1: fetch only explicit columns — no wildcard
      const { data: rows, error: fetchErr } = await supabase
        .from('users')
        .select(USER_COLUMNS)
        .eq('username', username.trim())
        .limit(1);

      if (fetchErr) throw new Error('Login service unavailable. Please try again.');

      const row = rows?.[0] as any;
      if (!row) throw new Error('Invalid username or password.');

      console.log('Raw DB row — role:', row.role, '| assigned_floor:', row.assigned_floor);

      if (!row.is_active)
        throw new Error('Your account is inactive. Contact an administrator.');
      if (row.locked_until && new Date(row.locked_until) > new Date())
        throw new Error('Account is temporarily locked. Please try again later.');

      // Step 2: verify password
      const { data: pwOk, error: pwErr } = await supabase
        .rpc('verify_password', { password, password_hash: row.password_hash });
      if (pwErr) throw new Error('Login service unavailable. Please try again.');
      if (!pwOk)  throw new Error('Invalid username or password.');

      // Step 3: build normalized user
      const normalizedUser: User = {
        id:             row.user_id,
        user_id:        row.user_id,
        auth_id:        undefined,
        name:           row.full_name || row.username,
        username:       row.username,
        full_name:      row.full_name || row.username,
        email:          '',
        phone:          null,
        phone_number:   null,
        role:           (row.role as string) || 'HOUSEKEEPING',
        shift:          null,
        shift_timing:   row.shift_timing  ?? null,
        assigned_floor: row.assigned_floor ?? null,
        salary:         row.salary        ?? null,
        is_active:      row.is_active     ?? true,
        push_token:     row.push_token    ?? null,
        created_at:     row.created_at    ?? new Date().toISOString(),
      };

      // ── KEY FIX: set RLS session context immediately after login ─────────
      await setSessionUserId(normalizedUser.user_id);

      console.log('Normalized — role:', normalizedUser.role, '| floor:', normalizedUser.assigned_floor);
      setUser(normalizedUser);
      await AsyncStorage.setItem('user', JSON.stringify(normalizedUser));
      console.log('✅ Login successful — RLS context set for user_id:', normalizedUser.user_id);
    } catch (err: any) {
      console.error('❌ Login error:', err);
      throw new Error(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setUser(null);
    await AsyncStorage.removeItem('user');
    // Clear the Postgres session GUC so stale user_id can't leak
    await supabase.rpc('set_config', {
      setting_name: 'app.user_id',
      setting_value: '',
      is_local: false,
    }).catch(() => {});
  };

  const signOut = logout;

  return (
    <AuthContext.Provider value={{ user, loading, isLoading: loading, login, logout, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
