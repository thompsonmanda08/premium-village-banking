import { expect, test } from 'vitest';
import type { MemberStat } from './groupStats';
import type { PayoutRow } from './memberViews';
import { memberRows, poolLines, sortRows } from './poolStats';

const p = (id: string, savings: number, interest_earned: number, owed: number, payout: number): PayoutRow => ({ member_id: id, short_name: id, savings, interest_earned, owed, pot_share: 12.5, payout });
const rows = [p('a', 1000, 10, 0, 1022.5), p('b', 2000, 20, 0, 2032.5), p('c', 400, 6, 200, 218.5)];
const stat = (id: string, name: string, savings: number): MemberStat => ({ id, name, savings, share: 0, loans: 0, interestCharged: 0, penalties: 0, earned: 0, net: 0, roi: 0, due: 0, rank: 1 });

test('pool lines add up to the estimated payout', () => {
  const l = poolLines(rows);
  expect(l).toEqual({ savings: 3400, interest: 36, entitled: 3436, owed: 200, pots: 37.5, estimated: 3273.5 });
  expect(l.entitled - l.owed + l.pots).toBe(l.estimated);
  expect(poolLines([])).toEqual({ savings: 0, interest: 0, entitled: 0, owed: 0, pots: 0, estimated: 0 });
});

test('member rows carry the payout and the default flag; a missing payout is null', () => {
  const r = memberRows([stat('a', 'Ann', 1), stat('z', 'Zed', 2)], rows, new Set(['z']));
  expect(r.map((x) => [x.payout, x.defaulted])).toEqual([[1022.5, false], [null, true]]);
});

test('sorting is stable, reversible, keeps null payouts last and leaves the input alone', () => {
  const input = memberRows([stat('a', 'Ann', 5), stat('z', 'Zed', 5), stat('b', 'Bo', 9)], [p('a', 5, 0, 0, 7), p('b', 9, 0, 0, 3)], new Set());
  const copy = [...input];
  expect(sortRows(input, 'savings', 'desc').map((x) => x.id)).toEqual(['b', 'a', 'z']);
  expect(sortRows(input, 'savings', 'asc').map((x) => x.id)).toEqual(['a', 'z', 'b']);
  expect(sortRows(input, 'name', 'asc').map((x) => x.id)).toEqual(['a', 'b', 'z']);
  expect(sortRows(input, 'payout', 'asc').map((x) => x.id)).toEqual(['b', 'a', 'z']);
  expect(sortRows(input, 'payout', 'desc').map((x) => x.id)).toEqual(['a', 'b', 'z']);
  expect(input).toEqual(copy);
});
