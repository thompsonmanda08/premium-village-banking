import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useGroup } from '@/features/group/GroupContext';
import { friendlyError } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { useToast } from '@/ui';

/** A settings write: on success refresh everything that shows members or the group, buzz, and confirm. */
export function useAction<T>(fn: (arg: T) => Promise<unknown>, success: string | ((arg: T) => string)) {
  const qc = useQueryClient();
  const toast = useToast();
  const { group } = useGroup();
  return useMutation({
    mutationFn: fn,
    onSuccess: async (_data, arg) => {
      haptic();
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['admin-members', group.id] }),
        qc.invalidateQueries({ queryKey: ['group-members', group.id] }),
        qc.invalidateQueries({ queryKey: ['cycles', group.id] }),
        qc.invalidateQueries({ queryKey: ['membership'] }),
      ]);
      toast(typeof success === 'function' ? success(arg) : success, { tone: 'success' });
    },
    onError: (err) => toast(friendlyError(err), { tone: 'danger' }),
  });
}
