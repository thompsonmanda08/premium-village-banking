import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Tables } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import type { PenaltySuggestion } from './deskMoney';
import type { EntryRow, LoanRow, LoanWithInstalments, PayoutRow, StatementRow } from './memberViews';
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
      qc.invalidateQueries({ queryKey: ['month-loans', groupId] }),
      qc.invalidateQueries({ queryKey: ['month-penalties', groupId] }),
      qc.invalidateQueries({ queryKey: ['suggested-penalties', groupId] }),
      qc.invalidateQueries({ queryKey: ['loan-check'] }),
      qc.invalidateQueries({ queryKey: ['close-preview'] }),
      qc.invalidateQueries({ queryKey: ['statements'] }),
      qc.invalidateQueries({ queryKey: ['entries'] }),
      qc.invalidateQueries({ queryKey: ['loans'] }),
      qc.invalidateQueries({ queryKey: ['payout-preview'] }),
      qc.invalidateQueries({ queryKey: ['minimum-payable'] }),
      qc.invalidateQueries({ queryKey: ['member-statuses', groupId] }),
    ]);
}

/** The member's own statements, one per closed month. Always filtered by member: open-visibility groups let RLS return everyone's. */
export function useMyStatements(memberId: string | undefined) {
  return useQuery({
    queryKey: ['statements', memberId],
    enabled: Boolean(memberId),
    queryFn: async (): Promise<StatementRow[]> => {
      const { data, error } = await supabase.from('statements').select('*').eq('member_id', memberId!);
      if (error) throw error;
      return data;
    },
  });
}

export function useMyEntries(memberId: string | undefined) {
  return useQuery({
    queryKey: ['entries', memberId],
    enabled: Boolean(memberId),
    queryFn: async (): Promise<EntryRow[]> => {
      const { data, error } = await supabase.from('entries').select('*').eq('member_id', memberId!).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

/** The member's open loans, each with its instalments. */
export function useMyLoans(memberId: string | undefined) {
  return useQuery({
    queryKey: ['loans', memberId],
    enabled: Boolean(memberId),
    queryFn: async (): Promise<LoanWithInstalments[]> => {
      const loans = await supabase.from('loans').select('*').eq('member_id', memberId!).eq('status', 'open').order('sent_at');
      if (loans.error) throw loans.error;
      if (loans.data.length === 0) return [];
      const instalments = await supabase.from('loan_instalments').select('*').in('loan_id', loans.data.map((l) => l.id));
      if (instalments.error) throw instalments.error;
      return loans.data.map((l) => ({ ...l, instalments: instalments.data.filter((i) => i.loan_id === l.id) }));
    },
  });
}

/** What the member would receive if the cycle paid out now: their own row of payout_preview, or null. */
export function usePayoutPreview(cycleId: string | undefined, memberId: string | undefined) {
  return useQuery({
    queryKey: ['payout-preview', cycleId, memberId],
    enabled: Boolean(cycleId && memberId),
    queryFn: async (): Promise<PayoutRow | null> => {
      const { data, error } = await supabase.rpc('payout_preview', { p_cycle: cycleId! });
      if (error) throw error;
      return data.find((r) => r.member_id === memberId) ?? null;
    },
  });
}

export type LoanCheck = {
  period_id: string;
  label: string;
  month_index: number;
  loans_open: boolean;
  lending_cash: number;
  multiple: number;
  cum_savings: number;
  loans_owed: number;
  cap: number;
  headroom: number;
  arrears: string | null;
  principal?: number;
  interest?: number;
  term_months?: number | null;
  over_cap?: boolean;
  insufficient_cash?: boolean;
};

/** Cash, cap and arrears for a member, and, with an amount, whether send_loan would take it. Never cached: cash moves. */
export function useLoanCheck(memberId: string | undefined, principal: number | null) {
  return useQuery({
    queryKey: ['loan-check', memberId, principal],
    enabled: Boolean(memberId),
    staleTime: 0,
    // While a new amount loads, keep this member's last answer on screen; never another member's.
    placeholderData: (previous, previousQuery) => (previousQuery?.queryKey[1] === memberId ? previous : undefined),
    queryFn: async (): Promise<LoanCheck> => {
      const { data, error } = await supabase.rpc('loan_check', principal === null ? { p_member: memberId! } : { p_member: memberId!, p_principal: principal });
      if (error) throw error;
      return data as unknown as LoanCheck;
    },
  });
}

/** Loans sent in the month (admin RLS shows them all). */
export function useMonthLoans(groupId: string, periodId: string | undefined) {
  return useQuery({
    queryKey: ['month-loans', groupId, periodId],
    enabled: Boolean(periodId),
    queryFn: async (): Promise<LoanRow[]> => {
      const { data, error } = await supabase.from('loans').select('*').eq('period_id', periodId!).order('sent_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

/** What the engine would charge for the month so far. It keeps suggesting after a penalty is applied; see openSuggestions. */
export function useSuggestedPenalties(groupId: string, periodId: string | undefined) {
  return useQuery({
    queryKey: ['suggested-penalties', groupId, periodId],
    enabled: Boolean(periodId),
    queryFn: async (): Promise<PenaltySuggestion[]> => {
      const { data, error } = await supabase.rpc('suggest_penalties', { p_period: periodId! });
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Penalty entries of the month plus every correction landed in it: a waiver is stored as kind 'waiver' and a reduction as
 * 'adjustment', so filtering on kind = 'penalty' alone could never see them. Callers match corrections to penalties by id.
 */
export function useMonthPenalties(groupId: string, periodId: string | undefined) {
  return useQuery({
    queryKey: ['month-penalties', groupId, periodId],
    enabled: Boolean(periodId),
    queryFn: async (): Promise<EntryRow[]> => {
      const { data, error } = await supabase.from('entries').select('*').eq('period_id', periodId!).or('kind.eq.penalty,source.eq.correction').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export type CloseGroup = {
  opening_cash: number;
  received: number;
  savings: number;
  loans_sent: number;
  idle_cash: number;
  excess_billed: number;
  interest_collected: number;
  fee_pot_balance: number;
  meeting_pot_balance: number;
  total_savings: number;
  total_owed: number;
};
export type CloseMember = {
  member_id: string;
  short_name: string;
  opening_owed: number;
  saving: number;
  cum_savings: number;
  loan_principal_sent: number;
  loan_interest_charged: number;
  excess_charged: number;
  penalties_charged: number;
  paid_total: number;
  paid_to_excess: number;
  paid_to_penalties: number;
  paid_to_interest: number;
  paid_to_principal: number;
  closing_owed: number;
  next_minimum: number;
  interest_earned: number;
  interest_earned_to_date: number;
};
export type CloseDiff = {
  member_id: string | null;
  short_name: string | null;
  field: string;
  app: number | null;
  workbook: number;
  difference: number | null;
  reason_code: string;
};
export type ClosePreview = {
  period_id: string;
  label: string;
  month_index: number;
  committed: boolean;
  group: CloseGroup;
  members: CloseMember[];
  diff: CloseDiff[];
  unexplained: number;
};

/**
 * What closing the month would write, computed by the engine and written to nothing. It holds every member's figures, so it is
 * dropped from memory when unused and never persisted; a refusal (declarations waiting, previous month open) will not fix itself, so no retry.
 */
export function useClosePreview(periodId: string | undefined) {
  return useQuery({
    queryKey: ['close-preview', periodId],
    enabled: Boolean(periodId),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    queryFn: async (): Promise<ClosePreview> => {
      const { data, error } = await supabase.rpc('close_month', { p_period: periodId!, p_commit: false });
      if (error) throw error;
      return data as unknown as ClosePreview;
    },
  });
}

export type MemberStatusRow = Tables<'member_status'>;

/** Who is marked as defaulted in the cycle (one row per member and cycle; no row means in good standing). */
export function useMemberStatuses(groupId: string, cycleId: string | undefined) {
  return useQuery({
    queryKey: ['member-statuses', groupId, cycleId],
    enabled: Boolean(cycleId),
    queryFn: async (): Promise<MemberStatusRow[]> => {
      const { data, error } = await supabase.from('member_status').select('*').eq('cycle_id', cycleId!);
      if (error) throw error;
      return data;
    },
  });
}

/** Names for account ids (admin RLS lets an admin read members.user_id; the roster view hides it), to say who made a change. */
export function useActorNames(groupId: string) {
  return useQuery({
    queryKey: ['actor-names', groupId],
    queryFn: async (): Promise<Array<{ user_id: string; short_name: string }>> => {
      const { data, error } = await supabase.from('members').select('user_id, short_name').eq('group_id', groupId).not('user_id', 'is', null);
      if (error) throw error;
      return data.flatMap((m) => (m.user_id ? [{ user_id: m.user_id, short_name: m.short_name }] : []));
    },
  });
}
