import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { timeoutFetch } from './timeoutFetch';

/** localStorage key (and prefix of its siblings) where supabase-js keeps the session. signOutEverywhere clears it by name. */
export const AUTH_STORAGE_KEY = 'pvb-auth';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!url || !anonKey) throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see .env.example)');

export const supabase = createClient<Database>(url, anonKey, {
  global: { fetch: timeoutFetch }, // a request that never answers fails after 20 s instead of hanging the screen
  auth: { storageKey: AUTH_STORAGE_KEY, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
