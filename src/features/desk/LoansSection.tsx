import { useState } from 'react';
import { useGroup } from '@/features/group/GroupContext';
import { loanRequests } from '@/features/ledger/deskMoney';
import type { ActiveMember, DeclarationRow, Wallet } from '@/features/ledger/model';
import { useMonthLoans } from '@/features/ledger/queries';
import { friendlyError } from '@/lib/errors';
import { money } from '@/lib/format';
import { Alert, Badge, Button, Card, Skeleton } from '@/ui';
import { SendLoanSheet } from './SendLoanSheet';

type Props = { periodId: string; declarations: DeclarationRow[]; members: ActiveMember[]; wallets: Wallet[] };

export function LoansSection({ periodId, declarations, members, wallets }: Props) {
  const { group } = useGroup();
  const loans = useMonthLoans(group.id, periodId);
  const [sheet, setSheet] = useState<{ memberId?: string; amount?: number } | null>(null);
  const nameOf = (id: string) => members.find((m) => m.id === id)?.short_name ?? 'Former member';
  const walletOf = (id: string | null) => wallets.find((w) => w.id === id)?.name;

  if (loans.data === undefined) {
    return loans.isError ? (
      <Alert tone="danger" action={<Button size="sm" variant="secondary" onClick={() => void loans.refetch()}>Try again</Button>}>
        {friendlyError(loans.error)}
      </Alert>
    ) : (
      <div role="status"><span className="sr-only">Loading loans</span><Skeleton className="h-40" /></div>
    );
  }
  const requests = loanRequests(declarations, loans.data);

  return (
    <section aria-labelledby="loans-title" className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="loans-title" className="text-xl font-semibold text-fg">Loans</h2>
        <Button size="sm" onClick={() => setSheet({})}>Send a loan</Button>
      </div>

      <Card>
        <h3 className="text-lg font-semibold text-fg">Borrowing requests</h3>
        {requests.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No borrowing requests this month.</p>
        ) : (
          <ul role="list" className="divide-y divide-line">
            {requests.map((r) => (
              <li key={r.declaration.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-semibold text-fg">{nameOf(r.memberId)}</p>
                  <p className="tabular text-sm text-muted">{money(r.amount)}</p>
                </div>
                {r.sent > 0 ? (
                  <Badge tone="success">Sent {money(r.sent)}</Badge>
                ) : (
                  <Button size="sm" aria-label={`Send loan to ${nameOf(r.memberId)}`} onClick={() => setSheet({ memberId: r.memberId, amount: r.amount })}>
                    Send loan
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <div>
          <h3 className="text-lg font-semibold text-fg">Loans sent this month ({loans.data.length})</h3>
          {loans.data.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No loans sent yet this month.</p>
          ) : (
            <ul role="list" className="divide-y divide-line">
              {loans.data.map((l) => (
                <li key={l.id} className="grid gap-1 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold text-fg">{nameOf(l.member_id)}</span>
                    <span className="tabular font-semibold text-fg">{money(l.principal)}</span>
                  </div>
                  <p className="text-sm text-muted">
                    Interest {money(l.interest)} · {l.term_months} month{l.term_months === 1 ? '' : 's'}
                    {walletOf(l.wallet_id) ? ` · ${walletOf(l.wallet_id)}` : ''}
                  </p>
                  {l.cap_warning ? <p className="text-sm text-muted">{l.cap_warning}</p> : null}
                  {l.arrears_warning ? <p className="text-sm text-muted">{l.arrears_warning}</p> : null}
                  {l.approved_reason ? <p className="text-sm text-muted">Reason: {l.approved_reason}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {sheet ? (
        <SendLoanSheet members={members} wallets={wallets} initialMemberId={sheet.memberId} initialAmount={sheet.amount} onClose={() => setSheet(null)} />
      ) : null}
    </section>
  );
}
