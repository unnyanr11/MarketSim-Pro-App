// src/lib/supabase.ts
// Re-export from the canonical client so nothing breaks if this path is imported.
// All new code should import from '../api/client' or '../lib/client'.
export { supabase } from '../api/client';
