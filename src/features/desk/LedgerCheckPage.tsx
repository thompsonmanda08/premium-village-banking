import { ClipboardCheck } from 'lucide-react';
import { useGroup } from '@/features/group/GroupContext';
import { NotFound } from '@/features/shells/NotFound';
import { friendlyError } from '@/lib/errors';
import { money } from '@/lib/format';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, PageHeader, Skeleton, type Tone } from '@/ui';
import { useLedgerCheck, type LedgerGroupFigures, type LedgerPeriod } from './useLedgerCheck';

const STATUS: Record<string, { tone: Tone; label: string }> = {
  open: { tone: 'info', label: 'Open' },
  closing: { tone: 'warning', label: 'Closing' },
  closed: { tone: 'neutral', label: 'Closed' },
};

// The spec's fixed reason codes, in the order the treasurer should read them.
const REASONS: { code: string; label: string; tone: Tone }[] = [
  { code: 'unexplained', label: 'Unexplained', tone: 'danger' },
  { code: 'workbook_missed_loan', label: 'Workbook left a loan out of the minimum', tone: 'warning' },
  { code: 'workbook_term_differs', label: 'Workbook used a different repayment term', tone: 'warning' },
  { code: 'penalty_not_charged', label: 'Workbook asked for a charge the app does not raise', tone: 'warning' },
  { code: 'waiver', label: 'Waived by the treasurer', tone: 'info' },
  { code: 'fee_pot_vs_cash', label: 'Loan fees paid from the fee pot, not lending cash', tone: 'info' },
  { code: 'workbook_rounded', label: 'Workbook rounding', tone: 'neutral' },
];

// A code the page does not know is still shown, never dropped.
const OTHER = { code: '*', label: 'Other differences', tone: 'warning' as Tone };
const KNOWN = new Set(REASONS.map((r) => r.code));

const FIELDS: Record<string, string> = {
  cum_savings: 'Savings to date',
  excess_charged: 'Excess charge',
  closing_owed: 'Owed',
  next_minimum: 'Minimum due',
  opening_cash: 'Opening cash',
  idle_cash: 'Idle cash',
  excess_billed: 'Excess billed',
};

const GROUP_FIGURES: { key: keyof LedgerGroupFigures; label: string }[] = [
  { key: 'opening_cash', label: 'Opening cash' },
  { key: 'idle_cash', label: 'Idle cash' },
  { key: 'excess_billed', label: 'Excess billed' },
  { key: 'interest_collected', label: 'Interest collected' },
  { key: 'fee_pot_balance', label: 'Fee pot' },
  { key: 'meeting_pot_balance', label: 'Meeting pot' },
];

// money() puts the minus after the K (K −50); a difference reads better as −K 50.
const signed = (n: number | null) => (n === null ? 'not available' : n < 0 ? `−${money(-n)}` : money(n));
// A figure the app has none for (the workbook lists a member the close does not).
const orNone = (n: number | null) => (n === null ? 'none' : money(n));

function summary(periods: LedgerPeriod[]) {
  const checked = periods.filter((p) => p.checked);
  const diffs = checked.flatMap((p) => p.diff);
  const unexplained = diffs.filter((d) => d.reason_code === 'unexplained').length;
  return { unexplained, text: `${checked.length} of ${periods.length} months checked · ${diffs.length} ${diffs.length === 1 ? 'difference' : 'differences'}` };
}

function Differences({ period }: { period: LedgerPeriod }) {
  if (!period.checked) return <p className="mt-4 text-sm text-muted">No workbook figures for this month.</p>;
  if (period.diff.length === 0) {
    return (
      <div className="mt-4">
        <Alert tone="success">Matches the workbook.</Alert>
      </div>
    );
  }
  return (
    <div className="mt-4 grid gap-4">
      {[...REASONS, OTHER].map(({ code, label, tone }) => {
        const rows = period.diff.filter((d) => (code === OTHER.code ? !KNOWN.has(d.reason_code) : d.reason_code === code));
        if (rows.length === 0) return null;
        return (
          <section key={code}>
            <h3 className="mb-2 flex items-center gap-2 text-base font-semibold text-fg">
              {label}
              <Badge tone={tone}>{rows.length}</Badge>
            </h3>
            <ul role="list" className="grid gap-2">
              {rows.map((d) => (
                <li key={`${d.member_id ?? 'group'}-${d.field}`} className="rounded-xl bg-surface-2 p-3 text-sm text-fg">
                  <p className="font-semibold">{`${d.short_name ?? 'Group'} · ${FIELDS[d.field] ?? d.field}`}</p>
                  <p className="tabular text-muted">{`App ${orNone(d.app)} · Workbook ${money(d.workbook)} · Difference ${signed(d.difference)}`}</p>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function PeriodCard({ period }: { period: LedgerPeriod }) {
  const status = STATUS[period.status] ?? STATUS.open!;
  const group = period.group;
  const headingId = `ledger-${period.id}`;
  return (
    <section aria-labelledby={headingId}>
      <Card>
        <CardHeader title={<span id={headingId}>{period.label}</span>} action={<Badge tone={status.tone}>{status.label}</Badge>} />
        {group ? (
          <dl className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {GROUP_FIGURES.map(({ key, label }) => (
              <div key={key}>
                <dt className="text-sm text-muted">{label}</dt>
                <dd className="tabular text-base font-semibold text-fg">{money(group[key])}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-base text-muted">Figures appear once this month is closed.</p>
        )}
        <Differences period={period} />
      </Card>
    </section>
  );
}

export function LedgerCheckPage() {
  const { group, isAdmin } = useGroup();
  const query = useLedgerCheck(group.id, isAdmin);
  if (!isAdmin) return <NotFound title="This page is for admins" body="Ask your treasurer if you think you should have access." />;
  const { data } = query;
  const refetch = () => void query.refetch();

  return (
    <>
      <PageHeader title="Ledger check" subtitle={data?.cycle_label ?? undefined} />
      {data === undefined ? (
        // Data wins over a failed background refetch: the error state is only for when there is nothing to show.
        query.isError ? (
          <Alert tone="danger" action={<Button size="sm" variant="secondary" onClick={refetch}>Try again</Button>}>
            {friendlyError(query.error)}
          </Alert>
        ) : (
          <div role="status" className="grid gap-4">
            <span className="sr-only">Loading the ledger check…</span>
            <Skeleton className="h-44" />
            <Skeleton className="h-44" />
          </div>
        )
      ) : data.periods.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck className="size-7" />}
          title="No months to check yet"
          action={<Button size="sm" variant="secondary" onClick={refetch}>Check again</Button>}
        >
          Months appear here once workbook figures are imported or a month is opened.
        </EmptyState>
      ) : (
        <div className="grid gap-4">
          {(() => {
            const { unexplained, text } = summary(data.periods);
            const checked = data.periods.filter((p) => p.checked).length;
            if (checked === 0) return <p className="text-sm text-muted">No workbook figures have been uploaded yet.</p>;
            return unexplained > 0 ? (
              <Alert tone="danger">{`${unexplained} unexplained · ${text}`}</Alert>
            ) : (
              <p className="text-sm text-muted">{text}</p>
            );
          })()}
          {data.periods.map((p) => (
            <PeriodCard key={p.id} period={p} />
          ))}
        </div>
      )}
    </>
  );
}
