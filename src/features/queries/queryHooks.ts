import { useQuery } from '@tanstack/react-query';
import { useLedgerAction } from '@/features/ledger/actions';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/lib/database.types';

export type FigureQuery = Tables<'figure_queries'>;
export type OpenQuery = FigureQuery & { short_name: string };

/** The statement figures a member may question, in plain words. Must match the list in the database. */
export const QUERY_FIELDS = {
  cum_savings: 'Total saved',
  closing_owed: 'Closing balance',
  next_minimum: 'Next minimum',
  excess_charged: 'Excess charged',
  interest_earned_to_date: 'Interest earned to date',
  paid_total: 'Paid in total',
} as const;
export type QueryField = keyof typeof QUERY_FIELDS;
export const fieldLabel = (field: string): string => (QUERY_FIELDS as Record<string, string>)[field] ?? field;

/** What the minimum is made of. A month the app closed is itemised; an imported one is not; no statement gives `none`. */
export type MinimumBreakdown =
  | { none: true }
  | { imported: true; minimum: number }
  | { instalments: number; excess: number; earlier_shortfall: number; capped_to_owed: boolean; minimum: number };

export function useMinimumBreakdown(memberId: string | undefined, periodId: string | undefined) {
  return useQuery({
    queryKey: ['minimum-breakdown', memberId, periodId],
    enabled: Boolean(memberId && periodId),
    queryFn: async (): Promise<MinimumBreakdown> => {
      const { data, error } = await supabase.rpc('minimum_breakdown', { p_member: memberId!, p_period: periodId! });
      if (error) throw error;
      return data as MinimumBreakdown;
    },
  });
}

export function useMyQueries(memberId: string | undefined) {
  return useQuery({
    queryKey: ['my-queries', memberId],
    enabled: Boolean(memberId),
    queryFn: async (): Promise<FigureQuery[]> => {
      const { data, error } = await supabase.from('figure_queries').select('*').eq('member_id', memberId!).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

/** Open questions of the group, oldest first, with the asker's short name. Admins only (RLS lets a member see just their own). */
export function useOpenQueries(groupId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['open-queries', groupId],
    enabled,
    queryFn: async (): Promise<OpenQuery[]> => {
      const [qs, ms] = await Promise.all([
        supabase.from('figure_queries').select('*').eq('group_id', groupId).eq('status', 'open').order('created_at'),
        supabase.from('members').select('id, short_name').eq('group_id', groupId),
      ]);
      if (qs.error) throw qs.error;
      if (ms.error) throw ms.error;
      const names = new Map(ms.data.map((m) => [m.id, m.short_name]));
      return qs.data.map((q) => ({ ...q, short_name: names.get(q.member_id) ?? 'A member' }));
    },
  });
}

export function useRaiseQuery() {
  return useLedgerAction(async (a: { periodId: string; field: string; note: string }) => {
    const { error } = await supabase.rpc('raise_query', { p_period: a.periodId, p_field: a.field, p_note: a.note });
    if (error) throw error;
  }, 'Question sent.');
}

export function useAnswerQuery() {
  return useLedgerAction(async (a: { queryId: string; reply: string }) => {
    const { error } = await supabase.rpc('answer_query', { p_query: a.queryId, p_reply: a.reply });
    if (error) throw error;
  }, 'Answer sent.');
}
