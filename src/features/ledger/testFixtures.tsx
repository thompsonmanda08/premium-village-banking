import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { GroupProvider } from '@/features/group/GroupContext';
import type { GroupRow, MemberRow } from '@/features/group/useMembership';
import { ToastProvider } from '@/ui';
import type { EntryRow, InstalmentRow, LoanRow, StatementRow } from './memberViews';
import type { DeclarationRow, PeriodRow } from './model';
import type { CloseMember, ClosePreview, MemberStatusRow } from './queries';

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
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  // A wrapper (not wrapped JSX) so `rerender(<Page />)` keeps the providers and the same client.
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter>
          <GroupProvider value={{ group: GROUP, member, isAdmin: opts.isAdmin ?? false }}>{children}</GroupProvider>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
  return render(ui, { wrapper });
}

export const statement = (o: Partial<StatementRow> = {}): StatementRow => ({
  id: 's8', created_at: '2026-10-01T00:00:00Z', group_id: 'g1', period_id: 'p8', member_id: 'm1',
  opening_owed: 0, saving: 250, cum_savings: 2000, loan_principal_sent: 0, loan_interest_charged: 0, excess_charged: 0,
  penalties_charged: 0, paid_total: 250, paid_to_excess: 0, paid_to_penalties: 0, paid_to_interest: 0, paid_to_principal: 0,
  closing_owed: 0, next_minimum: 0, unpaid_minimum: 0, interest_earned: 0, interest_earned_to_date: 0, source: 'import', ...o,
});

export const entry = (o: Partial<EntryRow> = {}): EntryRow => ({
  id: 'e1', created_at: '2026-09-05T08:00:00Z', group_id: 'g1', period_id: 'p8', member_id: 'm1', kind: 'saving', amount: 250,
  loan_id: null, wallet_id: null, source: 'import', declaration_id: null, corrects_entry_id: null, reason: null, created_by: null, ...o,
});

export const loan = (o: Partial<LoanRow> = {}): LoanRow => ({
  id: 'l1', created_at: '2026-09-02T09:00:00Z', group_id: 'g1', member_id: 'm1', period_id: 'p8', principal: 1000, interest: 150,
  term_months: 3, sent_at: '2026-09-02T09:00:00Z', wallet_id: null, cap_warning: null, arrears_warning: null, approved_reason: null,
  status: 'open', ...o,
});

export const instalment = (o: Partial<InstalmentRow> = {}): InstalmentRow => ({
  id: 'i1', created_at: '2026-09-02T09:00:00Z', group_id: 'g1', loan_id: 'l1', period_id: 'p9', amount_due: 383.33, ...o,
});

export const closeMember = (o: Partial<CloseMember> = {}): CloseMember => ({
  member_id: 'm1', short_name: 'Eve', opening_owed: 0, saving: 250, cum_savings: 2250, loan_principal_sent: 0, loan_interest_charged: 0,
  excess_charged: 0, penalties_charged: 0, paid_total: 250, paid_to_excess: 0, paid_to_penalties: 0, paid_to_interest: 0, paid_to_principal: 0,
  closing_owed: 0, next_minimum: 300, interest_earned: 0, interest_earned_to_date: 0, ...o,
});

export const closePreview = (o: Partial<ClosePreview> = {}): ClosePreview => ({
  period_id: 'p9', label: 'Oct 2026', month_index: 9, committed: false,
  group: {
    opening_cash: 5000, received: 900, savings: 3000, loans_sent: 1000, idle_cash: 7000, excess_billed: 700, interest_collected: 120,
    fee_pot_balance: 40, meeting_pot_balance: 900, total_savings: 40500, total_owed: 2300,
  },
  members: [closeMember(), closeMember({ member_id: 'm2', short_name: 'Ann' })],
  diff: [], unexplained: 0, ...o,
});

export const memberStatus = (o: Partial<MemberStatusRow> = {}): MemberStatusRow => ({
  id: 'ms1', created_at: '2026-10-08T08:00:00Z', group_id: 'g1', member_id: 'm1', cycle_id: 'c1', defaulted: true,
  changed_at: '2026-10-08T08:00:00Z', changed_by: null, reason: 'Missed three months', ...o,
});
