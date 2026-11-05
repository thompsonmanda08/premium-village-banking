import { useQuery } from '@tanstack/react-query';
import type { Tables } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export type OverrideKind =
  | 'correction' | 'waiver' | 'penalty_applied' | 'penalty_waived'
  | 'loan_over_cap' | 'default_set' | 'default_cleared' | 'deadline_extended';

/** In a private group another member's row arrives with the member, amount and reason all null. */
export type OverrideRow = { at: string; kind: OverrideKind; member_id: string | null; member: string | null; amount: number | null; reason: string | null };

// The RPC returns jsonb, so this shape is written by hand (see month_report in the 20261105000200 migration).
export type MonthReport = {
  period: { id: string; label: string; month_index: number; closed_at: string | null };
  group: Tables<'group_statements'> | null;
  loans: { sent_count: number; sent_principal: number; members_owing: number; total_owed: number | null };
  arrears: { count: number; total: number; members: Array<{ member_id: string; name: string; unpaid: number }> | null };
  overrides: OverrideRow[];
  overrides_recorded: boolean;
  rules: { ratified_by_close: number };
};

export function useMonthReport(periodId: string | undefined) {
  return useQuery({
    queryKey: ['month-report', periodId],
    enabled: !!periodId,
    queryFn: async (): Promise<MonthReport> => {
      const { data, error } = await supabase.rpc('month_report', { p_period: periodId ?? '' });
      if (error) throw error;
      return data as unknown as MonthReport;
    },
  });
}
