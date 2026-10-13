// @vitest-environment node
// The real loader and the real builder together, with another member's data sitting in every table the loader reads.
import { beforeEach, expect, test, vi } from 'vitest';
import { closeMember, entry, loan, memberStatus, statement, year } from '@/features/ledger/testFixtures';
import { readBack, rowsOf } from './exportFixtures';
import { db, resetDb } from './testSupabase';

vi.mock('@/lib/supabase', async () => ({ supabase: (await import('./testSupabase')).fakeClient }));
const { exportMember } = await import('./exportActions');

const periods = year(3, 'open');
const ctx = { groupId: 'g1', groupName: 'Test Group', cycle: { id: 'c1', label: 'Cycle 2026' }, periods };
const ZED = 777777.77;
const group = (period_id: string) => ({
  id: `gs-${period_id}`, group_id: 'g1', period_id, source: 'close', created_at: 'x', opening_cash: 5000, received: 900, savings: 850, loans_sent: 0,
  idle_cash: 5000, excess_rate: 0.1, excess_billed: 500, interest_collected: 0, fee_pot_in: 0, fee_pot_out: 0, fee_pot_balance: 10,
  meeting_pot_in: 0, meeting_pot_balance: 90, total_savings: 850, total_owed: 0,
});

beforeEach(() => {
  resetDb(
    {
      members: [
        { id: 'm3', short_name: 'Bob', full_name: 'Bob Example', status: 'active', email: 'bob@example.test', phone: '0003', user_id: 'u3', group_id: 'g1' },
        { id: 'm9', short_name: 'Zed', full_name: 'Zed Sentinel', status: 'active', email: 'zed@example.test', phone: '0009', user_id: 'u9', group_id: 'g1' },
      ],
      periods: periods.slice(0, 3).map((p) => ({ id: p.id, closed_at: '2026-04-07T10:00:00Z' })),
      statements: periods.slice(0, 3).flatMap((p, i) => [
        statement({ id: `b${i}`, period_id: p.id, member_id: 'm3', saving: 100, cum_savings: 100 * (i + 1) }),
        statement({ id: `z${i}`, period_id: p.id, member_id: 'm9', saving: ZED, cum_savings: ZED * (i + 1), closing_owed: ZED }),
      ]),
      group_statements: periods.slice(0, 3).map((p) => group(p.id)),
      entries: [
        entry({ id: 'eb', member_id: 'm3', period_id: 'p2', kind: 'saving', amount: 100, source: 'app' }),
        entry({ id: 'ez', member_id: 'm9', period_id: 'p2', kind: 'saving', amount: ZED, source: 'app', reason: 'Zed’s own note' }),
      ],
      loans: [loan({ id: 'lb', member_id: 'm3', period_id: 'p1', principal: 1000 }), loan({ id: 'lz', member_id: 'm9', period_id: 'p1', principal: ZED })],
      member_status: [
        memberStatus({ id: 'sb', member_id: 'm3', cycle_id: 'c1', defaulted: false }),
        memberStatus({ id: 'sz', member_id: 'm9', cycle_id: 'c1', defaulted: true, reason: 'Zed’s secret reason' }),
      ],
    },
    {
      close_month: () => ({
        data: {
          period_id: 'p4', label: 'May 2026', month_index: 4, committed: false, group: group('p4'),
          members: [closeMember({ member_id: 'm3', short_name: 'Bob', cum_savings: 400 }), closeMember({ member_id: 'm9', short_name: 'Zed', cum_savings: ZED })],
          diff: [], unexplained: 0,
        },
      }),
      payout_preview: () => ({
        data: [
          { member_id: 'm3', short_name: 'Bob', savings: 400, interest_earned: 6, owed: 200, pot_share: 12.5, payout: 218.5 },
          { member_id: 'm9', short_name: 'Zed', savings: ZED, interest_earned: 1, owed: 0, pot_share: 12.5, payout: ZED },
        ],
      }),
    },
  );
});

test('Bob’s finished file holds Bob and nothing of Zed: no name, no amount, no note, no contact detail', async () => {
  const { bytes } = await exportMember(ctx, 'm3');
  const wb = await readBack(bytes);
  const everything = wb.worksheets.flatMap((w) => rowsOf(w).flat()).map(String).join('\n');
  expect(everything).toContain('Bob Example');
  expect(everything).toContain('400'); // Bob's own figures are there
  for (const leak of ['Zed', '777777', 'secret reason', 'own note', 'example.test', '0009', 'u9']) expect(everything).not.toContain(leak);
  // …and the tables really did hold Zed's data, so the scan above could have caught it.
  expect(db.tables.statements!.some((r) => r.member_id === 'm9')).toBe(true);
});
