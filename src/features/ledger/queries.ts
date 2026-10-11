import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { DeclarationRow, PeriodRow, Wallet } from './model';

export type LedgerCycle = { cycle: { id: string; label: string } | null; periods: PeriodRow[] };

/** The group's active cycle and its months (RLS: any member can read periods). */
export function useLedgerCycle(groupId: string) {
  return useQuery({
    queryKey: ['ledger-cycle', groupId],
    queryFn: async (): Promise<LedgerCycle> => {
      const cycles = await supabase
        .from('cycles')
        .select('id, label')
        .eq('group_id', groupId)
        .eq('status', 'active')
        .order('starts_on', { ascending: false })
        .limit(1);
      if (cycles.error) throw cycles.error;
      const cycle = cycles.data[0];
      if (!cycle) return { cycle: null, periods: [] };
      const periods = await supabase
        .from('periods')
        .select('id, cycle_id, month_index, label, starts_on, deadline, status')
        .eq('cycle_id', cycle.id)
        .order('month_index');
      if (periods.error) throw periods.error;
      return { cycle, periods: periods.data };
    },
  });
}

export function useWallets(groupId: string) {
  return useQuery({
    queryKey: ['wallets', groupId],
    queryFn: async (): Promise<Wallet[]> => {
      const { data, error } = await supabase.from('wallets').select('id, name').eq('group_id', groupId).eq('active', true).order('name');
      if (error) throw error;
      return data;
    },
  });
}

/** Declarations for one month, newest first. Pass `memberId` for the member screen: open-visibility groups let members read each other's rows. */
export function useDeclarations(groupId: string, periodId: string | undefined, memberId?: string) {
  return useQuery({
    queryKey: ['declarations', groupId, periodId, memberId ?? 'all'],
    enabled: Boolean(periodId),
    queryFn: async (): Promise<DeclarationRow[]> => {
      let q = supabase.from('declarations').select('*').eq('period_id', periodId!);
      if (memberId) q = q.eq('member_id', memberId);
      const { data, error } = await q.order('submitted_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

/** What the member owes at minimum this month, from the last closed month's statement. A hint only. */
export function useMinimumPayable(memberId: string | undefined, periodId: string | undefined) {
  return useQuery({
    queryKey: ['minimum-payable', memberId, periodId],
    enabled: Boolean(memberId && periodId),
    queryFn: async (): Promise<number | null> => {
      const { data, error } = await supabase
        .from('statements')
        .select('next_minimum')
        .eq('member_id', memberId!)
        .eq('period_id', periodId!)
        .maybeSingle();
      if (error) throw error;
      return data?.next_minimum ?? null;
    },
  });
}

export function useRefreshLedger(groupId: string) {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['declarations', groupId] }),
      qc.invalidateQueries({ queryKey: ['ledger-cycle', groupId] }),
    ]);
}
