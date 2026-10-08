import type { QueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { wipeLocalData } from '@/lib/queryClient';

/**
 * Signing out must always clear cached group data (shared family phones), even offline.
 * A failed network sign-out is logged and swallowed; a failed wipe propagates so it never looks like success.
 */
export async function signOutEverywhere(qc: QueryClient): Promise<void> {
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    console.warn('Sign-out request failed; clearing local data anyway.');
  }
  await wipeLocalData(qc);
}
