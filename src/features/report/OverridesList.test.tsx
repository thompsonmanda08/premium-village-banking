import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { OverridesList } from './OverridesList';
import type { OverrideKind, OverrideRow } from './reportQueries';

const row = (o: Partial<OverrideRow> = {}): OverrideRow => ({
  at: '2026-11-10T08:00:00Z', kind: 'waiver', member_id: 'm1', member: 'Ann', amount: 50, reason: 'Hospital stay', ...o,
});

test('each kind reads in plain English with member, amount and reason', () => {
  const kinds: Array<[OverrideKind, string]> = [
    ['correction', 'Correction posted'], ['waiver', 'Charge waived'], ['penalty_applied', 'Penalty applied'], ['penalty_waived', 'Penalty waived'],
    ['loan_over_cap', 'Loan sent over the limit'], ['default_set', 'Marked as in default'], ['default_cleared', 'Default cleared'],
  ];
  render(<OverridesList recorded overrides={kinds.map(([kind]) => row({ kind }))} />);
  for (const [, label] of kinds) expect(screen.getByText(new RegExp(`^${label} · Ann$`))).toBeInTheDocument();
  expect(screen.getAllByText('Hospital stay')).toHaveLength(kinds.length);
  expect(screen.getAllByText('K 50').length).toBe(kinds.length);
});

test('a deadline extension has no member or amount', () => {
  render(<OverridesList recorded overrides={[row({ kind: 'deadline_extended', member_id: null, member: null, amount: null })]} />);
  expect(screen.getByText('Deadline extended')).toBeInTheDocument();
  expect(screen.queryByText(/A member/)).toBeNull();
});

test('a hidden row says "A member" with no amount or reason, plus a short note', () => {
  render(<OverridesList recorded overrides={[row({ member_id: null, member: null, amount: null, reason: null })]} />);
  expect(screen.getByText('Charge waived · A member')).toBeInTheDocument();
  expect(screen.queryByText('Hospital stay')).toBeNull();
  expect(screen.getByText('Other members’ details are kept private.')).toBeInTheDocument();
});

test('a correction of an entry with no member is a group-level row, not a private one', () => {
  render(<OverridesList recorded overrides={[row({ kind: 'correction', member_id: null, member: null, amount: -20, reason: 'Fee posted twice' })]} />);
  expect(screen.getByText('Correction posted')).toBeInTheDocument();
  expect(screen.queryByText(/A member/)).toBeNull();
  expect(screen.getByText('Fee posted twice')).toBeInTheDocument();
  expect(screen.queryByText('Other members’ details are kept private.')).toBeNull();
});

test('a missing short name in an open group is not called private', () => {
  render(<OverridesList recorded overrides={[row({ member_id: 'm1', member: null })]} />);
  expect(screen.getByText('Charge waived · A member')).toBeInTheDocument();
  expect(screen.queryByText('Other members’ details are kept private.')).toBeNull();
});

test('recorded but empty reads "No overrides this month"; not recorded says so', () => {
  const { rerender } = render(<OverridesList recorded overrides={[]} />);
  expect(screen.getByText('No overrides this month.')).toBeInTheDocument();
  rerender(<OverridesList recorded={false} overrides={[]} />);
  expect(screen.getByText('Overrides were not recorded before November 2026.')).toBeInTheDocument();
});
