import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';
import { GroupProvider } from '@/features/group/GroupContext';
import type { GroupRow, MemberRow } from '@/features/group/useMembership';
import { ToastProvider } from '@/ui';
import type { DeclarationRow, PeriodRow } from './model';

export const GROUP: GroupRow = { id: 'g1', name: 'Test Group', currency: 'ZMW', owner_user_id: 'u0', figures_visibility: 'open' };
export const MEMBER: MemberRow = { id: 'm1', group_id: 'g1', full_name: 'Eve Example', short_name: 'Eve', role: 'member', status: 'active', email: 'eve@example.test' };

export const period = (o: Partial<PeriodRow> = {}): PeriodRow => ({
  id: 'p9', cycle_id: 'c1', month_index: 9, label: 'Oct 2026', starts_on: '2026-10-01', deadline: '2026-10-07', status: 'open', ...o,
});

export const declaration = (o: Partial<DeclarationRow> = {}): DeclarationRow => ({
  id: 'd1', created_at: '2026-10-05T08:00:00Z', group_id: 'g1', period_id: 'p9', member_id: 'm1',
  saving: 250, loan_repayment: 0, excess: 0, membership: 0, penalty: 0, txn_fee: 0, borrowing_request: 0,
  wallet_id: 'w1', note: null, status: 'submitted', submitted_at: '2026-10-05T08:00:00Z', submitted_by: null,
  decided_at: null, decided_by: null, return_reason: null, supersedes_id: null, ...o,
});

const LABELS = ['Feb 2026', 'Mar 2026', 'Apr 2026', 'May 2026', 'Jun 2026', 'Jul 2026', 'Aug 2026', 'Sep 2026', 'Oct 2026', 'Nov 2026', 'Dec 2026', 'Jan 2027'];
const STARTS = ['2026-02-01', '2026-03-01', '2026-04-01', '2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01', '2026-11-01', '2026-12-01', '2027-01-01'];

/** Months of the 2026 cycle in order (Feb = 1 … Jan = 12), one status each. Oct 2026 is month 9 with id `p9`. */
export const cycleMonths = (statuses: PeriodRow['status'][]): PeriodRow[] =>
  statuses.map((status, i) => {
    const start = STARTS[i] ?? '';
    return period({ id: `p${i + 1}`, month_index: i + 1, label: LABELS[i] ?? '', starts_on: start, deadline: `${start.slice(0, 8)}07`, status });
  });

/** Twelve months: the first `closed` closed, the next one `next`, the rest planned. `year(8)` is Feb–Sep closed, Oct planned. */
export const year = (closed: number, next: PeriodRow['status'] = 'planned'): PeriodRow[] =>
  cycleMonths(Array.from({ length: 12 }, (_, i): PeriodRow['status'] => (i < closed ? 'closed' : i === closed ? next : 'planned')));

export function renderLedger(ui: ReactElement, opts: { isAdmin?: boolean; member?: MemberRow | null } = {}) {
  const member = opts.member === undefined ? MEMBER : opts.member;
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <ToastProvider>
        <MemoryRouter>
          <GroupProvider value={{ group: GROUP, member, isAdmin: opts.isAdmin ?? false }}>{ui}</GroupProvider>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}
