import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type LedgerDiff = {
  member_id: string | null;
  short_name: string | null;
  field: string;
  /** Null when the workbook lists a figure the app has none for (then difference is null too, and the code is unexplained). */
  app: number | null;
  workbook: number;
  difference: number | null;
  reason_code: string;
};
// The RPC returns the whole group_statements row (minus ids); these are the figures the page shows.
export type LedgerGroupFigures = {
  opening_cash: number;
  idle_cash: number;
  excess_billed: number;
  interest_collected: number;
  fee_pot_balance: number;
  meeting_pot_balance: number;
};
export type LedgerPeriod = {
  id: string;
  label: string;
  month_index: number;
  status: string;
  group: LedgerGroupFigures | null;
  checked: boolean;
  diff: LedgerDiff[];
};
export type LedgerCheck = { cycle_label: string | null; periods: LedgerPeriod[] };

/** Every opened month of the group's active cycle with its group statement and its differences from the workbook. */
export function useLedgerCheck(groupId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['ledger-check', groupId],
    enabled,
    queryFn: async (): Promise<LedgerCheck> => {
      const { data, error } = await supabase.rpc('ledger_check', { p_group: groupId });
      if (error) throw error;
      return data as unknown as LedgerCheck;
    },
  });
}
