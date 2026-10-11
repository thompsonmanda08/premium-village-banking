import { Link, useNavigate } from 'react-router';
import { useEffect, useState, type ReactNode } from 'react';
import { useGroup } from '@/features/group/GroupContext';
import { useGroupMembers } from '@/features/group/GroupPage';
import { useLedgerAction } from '@/features/ledger/actions';
import { closeChecklist } from '@/features/ledger/closeChecklist';
import { activeMembers, currentPeriod } from '@/features/ledger/model';
import { useClosePreview, useDeclarations, useLedgerCycle, useMonthLoans, useMonthPenalties, useSuggestedPenalties } from '@/features/ledger/queries';
import { NotFound } from '@/features/shells/NotFound';
import { friendlyError } from '@/lib/errors';
import { formatDate, localISODate } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { Alert, Badge, Button, Card, EmptyState, PageHeader, Skeleton, TextField, useConfirmTap, type Tone } from '@/ui';
import { ClosePreviewView } from './ClosePreviewView';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const inline = 'font-semibold text-accent underline underline-offset-4';

function Item({ tone, badge, children }: { tone: Tone; badge: string; children: ReactNode }) {
  return (
    <li className="flex flex-wrap items-start gap-2 py-3 text-sm text-fg">
      <Badge tone={tone}>{badge}</Badge>
      <span className="min-w-0 flex-1">{children}</span>
    </li>
  );
}

function CloseBody() {
  const { group } = useGroup();
  const navigate = useNavigate();
  const cycle = useLedgerCycle(group.id);
  const open = cycle.data ? currentPeriod(cycle.data.periods) : null;
  const declarations = useDeclarations(group.id, open?.id);
  const membersQuery = useGroupMembers(group.id);
  const suggestions = useSuggestedPenalties(group.id, open?.id);
  const applied = useMonthPenalties(group.id, open?.id);
  const loans = useMonthLoans(group.id, open?.id);
  const preview = useClosePreview(open?.id);
  const [reason, setReason] = useState('');
  // The month stops being open the moment the close lands; keep its name so the page can say what it is doing.
  const [closingLabel, setClosingLabel] = useState('');

  const label = open?.label ?? 'the month';
  const closing = useLedgerAction<void>(async () => {
    const { error } = await supabase.rpc('close_month', { p_period: open!.id, p_commit: true, p_reason: reason.trim() || undefined });
    if (error) throw error;
  }, `${label} is closed.`);
  const confirm = useConfirmTap(() => {
    setClosingLabel(label);
    closing.mutate(undefined, { onSuccess: () => navigate('/desk') });
  });
  const { reset: disarm } = confirm;

  const ready = declarations.data && membersQuery.data && suggestions.data && applied.data && loans.data;
  const checklist = open && ready
    ? closeChecklist({
        declarations: declarations.data!,
        members: activeMembers(membersQuery.data!),
        suggestions: suggestions.data!,
        appliedEntries: applied.data!,
        loans: loans.data!,
        deadline: open.deadline,
        today: localISODate(new Date()),
      })
    : null;
  const failed = [declarations, membersQuery, suggestions, applied, loans].find((q) => q.isError && !q.data);
  const needsReason = (preview.data?.unexplained ?? 0) > 0;
  const previewReady = preview.isSuccess && !preview.isFetching && !preview.isPlaceholderData && Boolean(preview.data);
  const canClose = previewReady && checklist !== null && !checklist.blocked && (!needsReason || reason.trim().length > 0) && reason.trim().length <= 500;
  const why = !previewReady
    ? 'The close can be sent once the preview has loaded.'
    : checklist === null
      ? 'The close can be sent once the checklist has loaded.'
      : checklist.blocked
        ? 'Resolve the waiting declarations to enable this.'
        : needsReason && reason.trim().length === 0
          ? 'Add a reason to enable this.'
          : null;

  // Anything that makes the close unavailable (a background refetch of the preview, a block, another month) disarms the second tap,
  // so one tap can never commit figures the treasurer did not just confirm.
  useEffect(() => {
    if (!canClose) disarm();
  }, [canClose, disarm]);

  if (cycle.data === undefined) {
    return cycle.isError ? (
      <Alert tone="danger" action={<Button size="sm" variant="secondary" onClick={() => void cycle.refetch()}>Try again</Button>}>
        {friendlyError(cycle.error)}
      </Alert>
    ) : (
      <div role="status" className="grid gap-3">
        <span className="sr-only">Loading the close</span>
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (!open && closing.isPending) {
    return (
      <div role="status" className="grid gap-3">
        <span>{`Closing ${closingLabel}…`}</span>
        <Skeleton className="h-32" />
      </div>
    );
  }
  if (!open) {
    return (
      <EmptyState title="No month is open to close.">
        Open the next month from the Desk first. <Link to="/desk" className={inline}>Go to the Desk</Link>
      </EmptyState>
    );
  }

  return (
    <div className="grid gap-4 md:gap-5 lg:max-w-3xl">
      <Card>
        <section aria-labelledby="before-close">
          <h2 id="before-close" className="text-lg font-semibold text-fg">Before you close</h2>
          {failed ? (
            <div className="mt-2">
              <Alert
                tone="danger"
                action={<Button size="sm" variant="secondary" onClick={() => { void declarations.refetch(); void membersQuery.refetch(); void suggestions.refetch(); void applied.refetch(); void loans.refetch(); }}>Try again</Button>}
              >
                {friendlyError(failed.error)}
              </Alert>
            </div>
          ) : checklist === null ? (
            <div role="status" className="mt-2"><span className="sr-only">Loading the checklist</span><Skeleton className="h-32" /></div>
          ) : (
            <ul role="list" className="divide-y divide-line">
              {checklist.waiting > 0 ? (
                <Item tone="danger" badge="Blocks the close">
                  {`${plural(checklist.waiting, 'declaration is', 'declarations are')} waiting. Approve or return ${checklist.waiting === 1 ? 'it' : 'them'} on the Desk first.`}{' '}
                  <Link to="/desk" className={inline}>Go to the Desk</Link>
                </Item>
              ) : (
                <Item tone="success" badge="Ready">No declarations are waiting.</Item>
              )}
              {checklist.notDeclared.length > 0 ? (
                <Item tone="warning" badge="Check">
                  {`${plural(checklist.notDeclared.length, 'member has', 'members have')} not declared: ${checklist.notDeclared.map((m) => m.short_name).join(', ')}. They will close with nothing paid in.`}
                </Item>
              ) : checklist.returned.length === 0 ? (
                <Item tone="success" badge="Ready">Everyone has declared.</Item>
              ) : null}
              {checklist.returned.length > 0 ? (
                <Item tone="warning" badge="Check">
                  {`${plural(checklist.returned.length, 'member has', 'members have')} a returned declaration that was not sent again: ${checklist.returned.map((m) => m.short_name).join(', ')}. Nothing in ${checklist.returned.length === 1 ? 'it is' : 'them is'} counted.`}
                </Item>
              ) : null}
              {checklist.penaltiesPending > 0 ? (
                <Item tone="warning" badge="Check">{`${plural(checklist.penaltiesPending, 'suggested penalty has', 'suggested penalties have')} not been applied.`}</Item>
              ) : (
                <Item tone="success" badge="Ready">No suggested penalties are waiting.</Item>
              )}
              {checklist.requestsUnsent > 0 ? (
                <Item tone="info" badge="Note">{`${plural(checklist.requestsUnsent, 'borrowing request has', 'borrowing requests have')} not been sent.`}</Item>
              ) : (
                <Item tone="success" badge="Ready">No borrowing requests are waiting.</Item>
              )}
              <Item tone={checklist.deadline.tone} badge={checklist.deadline.text}>{`Declarations due ${formatDate(open.deadline)}.`}</Item>
            </ul>
          )}
        </section>
      </Card>

      <section aria-labelledby="close-preview-title" className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="close-preview-title" className="text-xl font-semibold text-fg">What the close will write</h2>
          <Button
            size="sm"
            variant="secondary"
            isLoading={preview.isFetching}
            onClick={() => {
              confirm.reset();
              void preview.refetch();
            }}
          >
            Refresh preview
          </Button>
        </div>
        <p className="text-sm text-muted">Figures change if anything is recorded before you close. The close always uses the figures at the moment you commit.</p>
        {preview.isError && !preview.data ? (
          <Alert tone="danger" action={<Button size="sm" variant="secondary" onClick={() => void preview.refetch()}>Try again</Button>}>
            {friendlyError(preview.error)}
          </Alert>
        ) : preview.data ? (
          <ClosePreviewView preview={preview.data} />
        ) : (
          <div role="status"><span className="sr-only">Loading the preview</span><Skeleton className="h-64" /></div>
        )}
      </section>

      <Card>
        <section aria-labelledby="commit-title" className="grid gap-3">
          <h2 id="commit-title" className="text-lg font-semibold text-fg">{`Close ${open.label}`}</h2>
          <p className="text-sm text-muted">
            {`This writes ${preview.data?.members.length ?? 0} statements and locks ${open.label}. Anything you correct later goes into the next month.`}
          </p>
          {needsReason ? (
            <TextField
              label="Why the differences are acceptable"
              maxLength={500}
              autoComplete="off"
              value={reason}
              onChange={(e) => {
                confirm.reset();
                setReason(e.target.value);
              }}
            />
          ) : null}
          <Button fullWidth disabled={!canClose} isLoading={closing.isPending} onClick={confirm.tap}>
            {confirm.armed ? `Tap again to close ${open.label}` : `Close ${open.label}`}
          </Button>
          {why ? <p className="text-sm text-muted">{why}</p> : null}
        </section>
      </Card>
    </div>
  );
}

export function ClosePage() {
  const { isAdmin } = useGroup();
  if (!isAdmin) return <NotFound title="This page is for admins" body="Ask your treasurer if you think you should have access." />;
  return (
    <>
      <PageHeader title="Close the month" actions={<Link to="/desk" className={inline}>Back to the Desk</Link>} />
      <CloseBody />
    </>
  );
}
