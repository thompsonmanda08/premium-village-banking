import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLedgerAction } from '@/features/ledger/actions';
import { supabase } from '@/lib/supabase';
import type { Ratification } from './ratifications';

export function useRatifications(cycleId: string | undefined) {
  return useQuery({
    queryKey: ['ratifications', cycleId],
    enabled: !!cycleId,
    queryFn: async (): Promise<Ratification[]> => {
      const { data, error } = await supabase
        .from('rule_ratifications')
        .select('id, rule_key, cycle_id, passed, votes_for, votes_total, decided_on, created_at')
        .eq('cycle_id', cycleId ?? '');
      if (error) throw error;
      return data;
    },
  });
}

export type RatificationArg = { cycleId: string; ruleKey: string; decidedOn: string; votesFor: number; votesTotal: number; meetingRef?: string; note?: string };

export function useRecordRatification() {
  const qc = useQueryClient();
  return useLedgerAction(async (a: RatificationArg) => {
    const { error } = await supabase.rpc('record_ratification', {
      p_cycle: a.cycleId, p_rule_key: a.ruleKey, p_decided_on: a.decidedOn, p_votes_for: a.votesFor, p_votes_total: a.votesTotal,
      p_meeting_ref: a.meetingRef, p_note: a.note,
    });
    if (error) throw error;
    await qc.invalidateQueries({ queryKey: ['ratifications', a.cycleId] });
  }, 'Vote recorded.');
}
