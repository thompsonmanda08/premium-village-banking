import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { friendlyError } from '@/lib/errors';
import { useToast } from '@/ui';
import { signOutEverywhere } from './signOut';

/**
 * The one Sign out action. When the network sign-out fails (offline), supabase-js never emits SIGNED_OUT, so the session
 * provider would keep the previous member in memory; a full reload drops that state and any pending timers. If the local
 * wipe itself fails the person stays put with a message and can try again.
 */
export function useSignOut() {
  const qc = useQueryClient();
  const toast = useToast();
  const [pending, setPending] = useState(false);

  const signOut = useCallback(async () => {
    setPending(true);
    try {
      await signOutEverywhere(qc);
      window.location.replace('/sign-in'); // stay "pending" until the page unloads
    } catch (err) {
      toast(friendlyError(err), { tone: 'danger' });
      setPending(false);
    }
  }, [qc, toast]);

  return { signOut, pending };
}
