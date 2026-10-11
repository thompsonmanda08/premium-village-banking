import { useState, type FormEvent } from 'react';
import { DeclarationSummary } from '@/features/ledger/DeclarationSummary';
import { useLedgerAction } from '@/features/ledger/actions';
import { sentTotal } from '@/features/ledger/declarationForm';
import { liveDeclarations, submittedLabel, type ActiveMember, type DeclarationRow, type Wallet } from '@/features/ledger/model';
import { sumKwacha } from '@/features/ledger/money';
import { money } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { Badge, Button, Card, Sheet, TextField, useConfirmTap } from '@/ui';
import { DeclareForMemberSheet } from './DeclareForMemberSheet';

type RowProps = { d: DeclarationRow; name: string; walletName?: string; deadline: string; alsoApproved?: number; onDeclare?: () => void };

function ReturnSheet({ d, name, onClose }: { d: DeclarationRow; name: string; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string>();
  const send = useLedgerAction(async (text: string) => {
    const { error: e } = await supabase.rpc('return_declaration', { p_declaration: d.id, p_reason: text });
    if (e) throw e;
  }, 'Declaration returned.');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = reason.trim();
    if (!text) return setError('Say what the member should fix.');
    if (text.length > 500) return setError('Keep the reason to 500 characters or fewer.');
    setError(undefined);
    send.mutate(text, { onSuccess: onClose });
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Return ${name}’s declaration`}
      description="They will see your reason and can send a corrected declaration."
      footer={<Button type="submit" form={`return-${d.id}`} fullWidth isLoading={send.isPending}>Return declaration</Button>}
    >
      <form id={`return-${d.id}`} noValidate onSubmit={submit}>
        <TextField label="Reason" maxLength={500} autoComplete="off" value={reason} error={error} onChange={(e) => setReason(e.target.value)} />
      </form>
    </Sheet>
  );
}

function WaitingRow({ d, name, walletName, deadline, alsoApproved }: RowProps) {
  const approve = useLedgerAction(async (id: string) => {
    const { error } = await supabase.rpc('approve_declaration', { p_declaration: id });
    if (error) throw error;
  }, 'Declaration approved.');
  const confirm = useConfirmTap(() => approve.mutate(d.id));
  const [returning, setReturning] = useState(false);
  const arrived = submittedLabel(d.submitted_at, deadline);
  return (
    <li className="grid gap-3 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-semibold text-fg">{name}</p>
        <Badge tone={arrived.late ? 'danger' : 'neutral'}>{arrived.late ? `Late · ${arrived.text}` : arrived.text}</Badge>
      </div>
      {alsoApproved ? <p className="text-sm text-muted"><Badge tone="info">Also approved: {money(alsoApproved)}</Badge> this month, so check this is a separate payment.</p> : null}
      <DeclarationSummary d={d} walletName={walletName} />
      <div className="flex gap-2">
        <Button size="sm" isLoading={approve.isPending} onClick={confirm.tap}>{confirm.armed ? 'Tap again to approve' : 'Approve'}</Button>
        <Button size="sm" variant="secondary" onClick={() => setReturning(true)}>Return</Button>
      </div>
      {returning ? <ReturnSheet d={d} name={name} onClose={() => setReturning(false)} /> : null}
    </li>
  );
}

const PlainRow = ({ d, name, walletName, onDeclare }: RowProps) => (
  <li className="grid gap-2 py-4">
    <p className="font-semibold text-fg">{name}</p>
    <DeclarationSummary d={d} walletName={walletName} />
    {d.status === 'returned' && d.return_reason ? <p className="text-sm text-muted">Returned: {d.return_reason}</p> : null}
    {onDeclare ? (
      <div>
        <Button size="sm" variant="secondary" aria-label={d.status === 'returned' ? `Declare for ${name}` : `Add a payment for ${name}`} onClick={onDeclare}>
          {d.status === 'returned' ? 'Enter their correction' : 'Add a payment'}
        </Button>
      </div>
    ) : null}
  </li>
);

type InboxProps = { periodId: string; deadline: string; declarations: DeclarationRow[]; members: ActiveMember[]; wallets: Wallet[] };

export function DeclarationInbox({ periodId, deadline, declarations, members, wallets }: InboxProps) {
  const [declaring, setDeclaring] = useState<DeclarationRow | null>(null);
  const live = liveDeclarations(declarations);
  const nameOf = (id: string) => members.find((m) => m.id === id)?.short_name ?? 'Former member';
  const walletOf = (id: string | null) => wallets.find((w) => w.id === id)?.name;
  const waiting = live.filter((d) => d.status === 'submitted');
  const returned = live.filter((d) => d.status === 'returned');
  const approved = live.filter((d) => d.status === 'approved');
  const approvedFor = (memberId: string) => sumKwacha(...approved.filter((d) => d.member_id === memberId).map(sentTotal));
  const declaringMember = declaring ? members.find((m) => m.id === declaring.member_id) : undefined;

  if (live.length === 0) return <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted">No declarations yet this month.</p>;

  return (
    <div className="grid gap-4">
      <Card>
        <h3 className="text-lg font-semibold text-fg">Waiting ({waiting.length})</h3>
        <ul role="list" className="divide-y divide-line">
          {waiting.map((d) => <WaitingRow key={d.id} d={d} name={nameOf(d.member_id)} walletName={walletOf(d.wallet_id)} deadline={deadline} alsoApproved={approvedFor(d.member_id)} />)}
        </ul>
      </Card>
      {returned.length > 0 ? (
        <Card>
          <h3 className="text-lg font-semibold text-fg">Returned ({returned.length})</h3>
          <ul role="list" className="divide-y divide-line">
            {returned.map((d) => <PlainRow key={d.id} d={d} name={nameOf(d.member_id)} walletName={walletOf(d.wallet_id)} deadline={deadline} onDeclare={() => setDeclaring(d)} />)}
          </ul>
        </Card>
      ) : null}
      {approved.length > 0 ? (
        <Card>
          <details>
            <summary className="cursor-pointer text-lg font-semibold text-fg">Approved ({approved.length})</summary>
            <ul role="list" className="divide-y divide-line">
              {approved.map((d) => <PlainRow key={d.id} d={d} name={nameOf(d.member_id)} walletName={walletOf(d.wallet_id)} deadline={deadline} onDeclare={() => setDeclaring(d)} />)}
            </ul>
          </details>
        </Card>
      ) : null}
      {declaring && declaringMember ? (
        <DeclareForMemberSheet
          periodId={periodId}
          member={declaringMember}
          wallets={wallets}
          initial={declaring.status === 'returned' ? declaring : null}
          onClose={() => setDeclaring(null)}
        />
      ) : null}
    </div>
  );
}
