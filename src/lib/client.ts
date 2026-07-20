// src/lib/client.ts
// Re-export from the canonical client so both import paths resolve to the
// SAME singleton — prevents duplicate Supabase connections.
export { supabase } from '../api/client';
