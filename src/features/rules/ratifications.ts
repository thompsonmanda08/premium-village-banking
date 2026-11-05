import { RULE_CATALOG } from './ruleCatalog';

export type Ratification = {
  rule_key: string;
  cycle_id: string;
  passed: boolean;
  votes_for: number;
  votes_total: number;
  decided_on: string;
  created_at: string;
};

export type RuleStatus = {
  state: 'ratified' | 'failed' | 'not_voted';
  row: Ratification | null;
};

// The latest row for the rule in this cycle decides; a later failed vote replaces an earlier pass.
export function ruleStatus(rows: Ratification[], key: string, cycleId: string): RuleStatus {
  let latest: Ratification | null = null;
  for (const r of rows) {
    if (r.rule_key !== key || r.cycle_id !== cycleId) continue;
    if (!latest || r.created_at > latest.created_at) latest = r;
  }
  if (!latest) return { state: 'not_voted', row: null };
  return { state: latest.passed ? 'ratified' : 'failed', row: latest };
}

export function unratifiedCount(rows: Ratification[], cycleId: string): number {
  return RULE_CATALOG.filter((r) => ruleStatus(rows, r.key, cycleId).state !== 'ratified').length;
}
