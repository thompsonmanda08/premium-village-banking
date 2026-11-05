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

  it('keeps the unclear phrases out', () => {
    const text = RULE_CATALOG.map((r) => r.text).join(' ');
    expect(text).not.toContain('(from November 2026)');
    expect(text).not.toContain('its own schedule');
  });
});
