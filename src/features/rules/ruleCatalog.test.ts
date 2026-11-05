import { describe, expect, it } from 'vitest';
import { RULE_CATALOG } from './ruleCatalog';

describe('RULE_CATALOG', () => {
  it('has well-formed, unique keys', () => {
    const keys = RULE_CATALOG.map((r) => r.key);
    for (const k of keys) expect(k).toMatch(/^[a-z][a-z_]{2,39}$/);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('gives every rule a title and text', () => {
    for (const r of RULE_CATALOG) {
      expect(r.title.trim()).not.toBe('');
      expect(r.text.trim()).not.toBe('');
    }
  });

  it('uses each of the three bases at least once', () => {
    const bases = new Set(RULE_CATALOG.map((r) => r.basis));
    expect(bases).toEqual(new Set(['as_written', 'differs', 'not_in_constitution']));
  });

  it('has a clause exactly when the constitution covers the rule', () => {
    for (const r of RULE_CATALOG) expect(r.clause === null, r.key).toBe(r.basis === 'not_in_constitution');
  });

  it('does not call the practice-only rules as written', () => {
    for (const key of ['penalty_basis', 'minimum_payable', 'payment_order', 'deadlines_and_extensions']) {
      const rule = RULE_CATALOG.find((r) => r.key === key);
      expect(rule, key).toBeDefined();
      expect(rule?.basis, key).not.toBe('as_written');
    }
  });

  it('says what the constitution says wherever the app differs from it or the constitution is silent', () => {
    for (const r of RULE_CATALOG.filter((x) => x.basis !== 'as_written')) expect(r.text, r.key).toMatch(/constitution/i);
  });

  const text = (key: string) => RULE_CATALOG.find((r) => r.key === key)?.text ?? '';

  it('states the loan bands without overlap and the payout share as the app computes it', () => {
    expect(text('loan_terms')).not.toContain('up to K10,000');
    expect(text('loan_terms')).toContain('under K10,000 in 3 months; K10,000 or more in 4 months');
    expect(text('payout_and_pots')).toMatch(/cumulative savings/);
    expect(text('payout_and_pots')).toMatch(/default/);
    expect(text('payout_and_pots')).not.toContain('by each month');
  });

  it('does not claim a minimum the treasurer can change, and owns up to the extra flat penalties', () => {
    expect(text('minimum_payable')).not.toMatch(/treasurer can change/);
    expect(text('minimum_payable')).toMatch(/K50/);
    expect(text('penalty_basis')).toMatch(/under the minimum|below the minimum/);
    expect(text('penalty_basis')).toMatch(/missing the minimum payment|minimum payment/);
  });

  it('does not say the group chose the membership months', () => {
    expect(text('membership_fee')).not.toContain('chosen by the group');
    expect(text('membership_fee')).toMatch(/February, May, August and November/);
  });

  it('keeps the unclear phrases out', () => {
    const text = RULE_CATALOG.map((r) => r.text).join(' ');
    expect(text).not.toContain('(from November 2026)');
    expect(text).not.toContain('its own schedule');
  });
});
