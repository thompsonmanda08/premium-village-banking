import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/lib/database.types';

export type CycleWithRules = Tables<'cycles'> & { rules: Tables<'cycle_rules'> | null };

export function useCycles(groupId: string) {
  return useQuery({
    queryKey: ['cycles', groupId],
    queryFn: async (): Promise<CycleWithRules[]> => {
      const { data, error } = await supabase.from('cycles').select('*, cycle_rules(*)').eq('group_id', groupId).order('starts_on');
      if (error) throw error;
      return data.map(({ cycle_rules, ...c }) => ({
        ...c,
        rules: (Array.isArray(cycle_rules) ? cycle_rules[0] : cycle_rules) ?? null,
      })) as CycleWithRules[];
    },
  });
}
