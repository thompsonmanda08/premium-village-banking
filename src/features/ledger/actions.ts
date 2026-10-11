import { useMutation } from '@tanstack/react-query';
import { useGroup } from '@/features/group/GroupContext';
import { friendlyError } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { useToast } from '@/ui';
import { useRefreshLedger } from './queries';

/**
 * A ledger write: buzz, refresh the month and its declarations, confirm with a toast.
 * A refusal toasts the friendly sentence and refreshes too, since the screen may be stale (month closed, declaration already handled).
 */
export function useLedgerAction<T>(fn: (arg: T) => Promise<unknown>, success: string) {
  const { group } = useGroup();
  const refresh = useRefreshLedger(group.id);
  const toast = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      haptic();
      await refresh();
      toast(success, { tone: 'success' });
    },
    onError: (err) => {
      toast(friendlyError(err), { tone: 'danger' });
      void refresh();
    },
  });
}
