import { describe, expect, it } from 'vitest';
import { RULE_CATALOG } from './ruleCatalog';
import { ruleStatus, unratifiedCount, type Ratification } from './ratifications';

const row = (over: Partial<Ratification>): Ratification => ({
  rule_key: 'loan_cap',
  cycle_id: 'c1',
  passed: true,
  votes_for: 8,
  votes_total: 10,
  decided_on: '2026-11-01',
  created_at: '2026-11-01T10:00:00Z',
  ...over,
});

describe('ruleStatus', () => {
  it('is not_voted with no rows', () => {
    expect(ruleStatus([], 'loan_cap', 'c1')).toEqual({ state: 'not_voted', row: null });
  });

  it('is ratified after a pass', () => {
    const r = row({});
    expect(ruleStatus([r], 'loan_cap', 'c1')).toEqual({ state: 'ratified', row: r });
  });

  it('a later fail replaces an earlier pass', () => {
    const rows = [row({}), row({ passed: false, created_at: '2026-11-02T10:00:00Z' })];
    expect(ruleStatus(rows, 'loan_cap', 'c1').state).toBe('failed');
  });

  it('a later pass replaces an earlier fail, whatever the row order', () => {
    const rows = [row({ created_at: '2026-11-02T10:00:00Z' }), row({ passed: false })];
    expect(ruleStatus(rows, 'loan_cap', 'c1').state).toBe('ratified');
  });

  it('compares instants, not strings, when offsets are mixed', () => {
    // 10:00:00Z is later than 10:30 at +02:00 (08:30Z), though it sorts lower as text.
    const rows = [row({ passed: false, created_at: '2026-11-02T10:30:00+02:00' }), row({ created_at: '2026-11-02T10:00:00Z' })];
    expect(ruleStatus(rows, 'loan_cap', 'c1').state).toBe('ratified');
    expect(ruleStatus([...rows].reverse(), 'loan_cap', 'c1').state).toBe('ratified');
  });

  it('treats +00:00 and Z as the same instant, so the later decided_on wins a tie', () => {
    const rows = [
      row({ passed: true, decided_on: '2026-11-03', created_at: '2026-11-02T10:00:00+00:00' }),
      row({ passed: false, decided_on: '2026-11-04', created_at: '2026-11-02T10:00:00Z' }),
    ];
    expect(ruleStatus(rows, 'loan_cap', 'c1').state).toBe('failed');
    expect(ruleStatus([...rows].reverse(), 'loan_cap', 'c1').state).toBe('failed');
  });

  it('still tied after decided_on: the row later in the input wins', () => {
    const rows = [row({ passed: true }), row({ passed: false })];
    expect(ruleStatus(rows, 'loan_cap', 'c1').state).toBe('failed');
  });

  it('ignores other cycles and other rules', () => {
    const rows = [row({ cycle_id: 'c2' }), row({ rule_key: 'loan_terms' })];
    expect(ruleStatus(rows, 'loan_cap', 'c1').state).toBe('not_voted');
  });
});

describe('unratifiedCount', () => {
  it('is the catalog size minus ratified keys', () => {
    const rows = [
      row({ rule_key: 'loan_cap' }),
      row({ rule_key: 'loan_terms', passed: false }),
      row({ rule_key: 'saving_minimum', cycle_id: 'c2' }),
    ];
    expect(unratifiedCount(rows, 'c1')).toBe(RULE_CATALOG.length - 1);
    expect(unratifiedCount([], 'c1')).toBe(RULE_CATALOG.length);
  });
});
