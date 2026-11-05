import { describe, expect, test } from 'vitest';
import { GROUPS, PEOPLE, PERIODS, S, STATEMENTS } from './groupFixtures';
import { groupStatement, year } from './testFixtures';
import {
  atRiskIds, closedPeriods, followUp, healthIndicators, medianSavings, memberStats, monthStats,
  type MemberStat, type MonthStat,
} from './groupStats';

describe('month series', () => {
  const months = monthStats(PERIODS, GROUPS, STATEMENTS, 250);

  test('one entry per closed month with the group statement’s figures', () => {
    expect(months.map((m) => m.label)).toEqual(['Feb 2026', 'Mar 2026', 'Apr 2026', 'May 2026']);
    expect(months[3]).toMatchObject({ saved: 1100, cum: 4700, loans: 0, owed: 600, idle: 2400, excessBilled: 240, interestCollected: 40 });
  });

  test('how much of the pool is working is owed ÷ (owed + idle), and 0 when both are 0', () => {
    expect(months[3]!.use).toBeCloseTo(0.2, 10);
    const empty = monthStats(PERIODS, [groupStatement({ period_id: 'p1', total_owed: 0, idle_cash: 0 })], null, 250);
    expect(empty[0]!.use).toBe(0);
  });

  test('members who saved the minimum, and who met a minimum that was due', () => {
    expect(months[3]).toMatchObject({ count: 4, savers: 3, minDue: 2, minMet: 1, metPct: 0.5 });
    expect(months[0]).toMatchObject({ savers: 3, minDue: 0, minMet: 0, metPct: null }); // the first month has nothing due
    expect(months[1]).toMatchObject({ minDue: 1, minMet: 1, metPct: 1 }); // Bob's 400 was due and paid
    expect(months[2]).toMatchObject({ minDue: 2, minMet: 0, metPct: 0 });
  });

  test('without member statements only the group figures are filled', () => {
    const groupOnly = monthStats(PERIODS, GROUPS, null, 250);
    expect(groupOnly[3]).toMatchObject({ saved: 1100, count: null, savers: null, minDue: null, minMet: null, metPct: null });
  });

  test('a month with no group statement is skipped, and open or planned months are not months yet', () => {
    expect(monthStats(PERIODS, GROUPS.filter((g) => g.period_id !== 'p2'), STATEMENTS, 250).map((m) => m.label)).toEqual(['Feb 2026', 'Apr 2026', 'May 2026']);
    expect(closedPeriods(year(2, 'open')).map((p) => p.label)).toEqual(['Feb 2026', 'Mar 2026']);
  });
});

describe('members', () => {
  const members = memberStats(PERIODS, STATEMENTS, PEOPLE);
  const by = (name: string) => members.find((m) => m.name === name)!;

  test('ranked by savings, ties by name, shares add up to the whole', () => {
    expect(members.map((m) => [m.name, m.rank])).toEqual([['Ann', 1], ['Cy', 2], ['Eve', 3], ['Bob', 4]]);
    expect(members.reduce((s, m) => s + m.share, 0)).toBeCloseTo(1, 10);
    expect(by('Ann').share).toBeCloseTo(2000 / 4700, 10);
  });

  test('net is interest earned less loan interest, excess interest and penalties charged', () => {
    expect(by('Bob')).toMatchObject({ savings: 700, loans: 1000, interestCharged: 190, earned: 6, net: -184, due: 200 });
    expect(by('Ann')).toMatchObject({ earned: 20, net: 20 });
    expect(by('Ann').roi).toBeCloseTo(0.01, 10);
    expect(by('Eve').net).toBe(10);
  });

  test('a member with no savings has a return of 0, not NaN, and someone with no statement is left out', () => {
    const none = memberStats(PERIODS, [S('p1', 'm1', { saving: 0, cum_savings: 0, excess_charged: 5 })], PEOPLE);
    expect(none).toHaveLength(1);
    expect(none[0]!.roi).toBe(0);
    expect(none[0]!.share).toBe(0);
  });

  test('the typical member’s saving each month is the median', () => {
    expect(medianSavings(PERIODS, STATEMENTS)).toEqual([250, 250, 250, 250]);
    expect(medianSavings(PERIODS, STATEMENTS.filter((s) => s.period_id !== 'p2'))).toEqual([250, null, 250, 250]);
  });
});

describe('members at risk and who to follow up', () => {
  test('paid nothing on the last two statements while a minimum was due', () => {
    expect(atRiskIds(PERIODS, STATEMENTS)).toEqual(['m4']);
  });

  test('fewer than three closed months cannot show a pattern', () => {
    expect(atRiskIds(year(2), STATEMENTS)).toEqual([]);
  });

  test('the follow-up list names who owes and who saved too little, at-risk first', () => {
    expect(followUp({ periods: PERIODS, statements: STATEMENTS, people: PEOPLE, minSaving: 250 })).toEqual([
      { id: 'm4', name: 'Cy', why: 'No payment on the last two statements', amount: 400, kind: 'owes' },
      { id: 'm3', name: 'Bob', why: 'Saved less than K 250 in May 2026', amount: 100, kind: 'saved' },
    ]);
  });

  test('nobody to follow up is an empty list', () => {
    const fine = STATEMENTS.filter((s) => s.member_id === 'm1' || s.member_id === 'm2');
    expect(followUp({ periods: PERIODS, statements: fine, people: PEOPLE, minSaving: 250 })).toEqual([]);
  });
});

describe('health check', () => {
  const months = monthStats(PERIODS, GROUPS, STATEMENTS, 250);
  const members = memberStats(PERIODS, STATEMENTS, PEOPLE);
  const atRisk = members.filter((m) => m.id === 'm4');
  const result = healthIndicators({ months, members, atRisk, minSaving: 250 });

  test('the worked group: pool and minimums red, the rest amber or green, so it needs attention', () => {
    expect(result.indicators.map((i) => [i.key, i.status])).toEqual([
      ['pool', 'bad'], ['minimums', 'bad'], ['atRisk', 'watch'], ['savers', 'watch'], ['ahead', 'good'], ['concentration', 'watch'],
    ]);
    expect(result.verdict).toMatchObject({ status: 'bad', title: 'Needs attention' });
    expect(result.indicators.find((i) => i.key === 'atRisk')!.value).toBeCloseTo(400 / 4700, 10);
    expect(result.indicators.find((i) => i.key === 'savers')!.value).toBe(0.75);
    expect(result.indicators.find((i) => i.key === 'minimums')!.say).toContain('1 of 2');
  });

  // Hand-made inputs to test the edges of each target.
  const ms = (o: Partial<MonthStat>): MonthStat => ({
    period: PERIODS[0]!, label: 'May 2026', saved: 0, cum: 1000, loans: 0, owed: 0, idle: 0, use: 0.8, excessBilled: 0, interestCollected: 0,
    count: 5, savers: 5, minDue: 4, minMet: 4, metPct: 1, ...o,
  });
  const mem = (id: string, o: Partial<MemberStat> = {}): MemberStat => ({
    id, name: id, savings: 200, share: 0.2, loans: 0, interestCharged: 0, penalties: 0, earned: 5, net: 5, roi: 0.02, due: 0, rank: 1, ...o,
  });
  const five = ['a', 'b', 'c', 'd', 'e'].map((id) => mem(id));
  const grade = (months: MonthStat[], members = five, atRisk: MemberStat[] = []) => healthIndicators({ months, members, atRisk, minSaving: 250 });

  test('the targets are inclusive at the good line and strict where lower is better', () => {
    expect(grade([ms({ use: 0.7 })]).indicators[0]!.status).toBe('good');
    expect(grade([ms({ use: 0.5 })]).indicators[0]!.status).toBe('watch');
    expect(grade([ms({ use: 0.4999 })]).indicators[0]!.status).toBe('bad');
    const risk = (due: number) => grade([ms({ cum: 1000 })], five, [mem('x', { due })]).indicators.find((i) => i.key === 'atRisk')!.status;
    expect(risk(49)).toBe('good');
    expect(risk(50)).toBe('watch'); // exactly 5% is not "under 5%"
    expect(risk(150)).toBe('bad');
  });

  test('members behind: two is still fine, three needs watching, six is red', () => {
    const behind = (n: number) => grade([ms({})], Array.from({ length: 8 }, (_, i) => mem(`m${i}`, { net: i < n ? -1 : 1, share: 0.125 })));
    const s = (n: number) => behind(n).indicators.find((i) => i.key === 'ahead')!.status;
    expect([s(2), s(3), s(5), s(6)]).toEqual(['good', 'watch', 'watch', 'bad']);
  });

  test('the verdict: any red is attention, two ambers is watching, otherwise healthy', () => {
    expect(grade([ms({})]).verdict.title).toBe('Healthy');
    expect(grade([ms({ use: 0.6, metPct: 0.7 })]).verdict).toMatchObject({ status: 'watch', title: 'Worth watching' });
    expect(grade([ms({ use: 0.6 })]).verdict.title).toBe('Healthy'); // one amber alone is fine
    expect(grade([ms({ use: 0.1 })]).verdict.title).toBe('Needs attention');
  });

  test('the share who saved the minimum uses the members of that month, not today’s roster', () => {
    const r = grade([ms({ savers: 3, count: 4 })], five); // five members now, but four had statements that month
    expect(r.indicators.find((i) => i.key === 'savers')!.value).toBe(0.75);
  });

  test('a sign with no data is left out, and no data at all says so instead of “healthy”', () => {
    expect(grade([ms({ metPct: null, minDue: 0, minMet: 0 })]).indicators.map((i) => i.key)).not.toContain('minimums');
    const none = healthIndicators({ months: [], members: [], atRisk: [], minSaving: 250 });
    expect(none.indicators).toEqual([]);
    expect(none.verdict.title).toBe('Not enough data yet');
  });

  test('the minimums sign looks at the latest month that had a minimum due', () => {
    const r = grade([ms({ metPct: 0.9, minDue: 4, minMet: 4 }), ms({ metPct: null, minDue: 0, minMet: 0 })]);
    expect(r.indicators.find((i) => i.key === 'minimums')!.value).toBe(0.9);
  });

  test('nothing in the sentences is NaN', () => {
    expect(result.indicators.map((i) => i.say).join(' ')).not.toMatch(/NaN|Infinity|undefined/);
  });

});
