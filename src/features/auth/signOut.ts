import type { QueryClient } from '@tanstack/react-query';
import { AUTH_STORAGE_KEY, supabase } from '@/lib/supabase';
import { wipeLocalData } from '@/lib/queryClient';

/**
 * supabase-js leaves the session in storage when its sign-out request fails (offline with an expired token), so the next
 * person to open the app online would be refreshed into the previous member's account. Remove everything it keeps under its
 * storage key: the session, the user copy and the PKCE verifiers (`<key>-user`, `<key>-code-verifier`, `<key>-flow-…`).
 */
function clearStoredSession(): void {
  let keys: string[] = [];
  try {
    keys = Object.keys(localStorage);
  } catch {
    return; // storage unavailable (blocked site data): nothing was persisted there either
  }
  for (const key of keys) {
    if (key !== AUTH_STORAGE_KEY && !key.startsWith(`${AUTH_STORAGE_KEY}-`)) continue;
    try {
      localStorage.removeItem(key);
    } catch {
      // storage can throw; keep clearing the rest
    }
  }
}

/**
 * Signing out must always clear the stored session and cached group data (shared family phones), even offline.
 * supabase-js resolves `{ error }` rather than throwing, so both shapes are treated as a failed network sign-out:
 * logged with a fixed string (never the error, which can carry tokens) and not rethrown. A failed wipe propagates so it
 * never looks like success.
 */
export async function signOutEverywhere(qc: QueryClient): Promise<void> {
  try {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) console.warn('Sign-out request failed; clearing local data anyway.');
  } catch {
    console.warn('Sign-out request failed; clearing local data anyway.');
  }
  clearStoredSession();
  await wipeLocalData(qc);
}
