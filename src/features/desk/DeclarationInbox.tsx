import { useState, type FormEvent } from 'react';
import { DeclarationSummary } from '@/features/ledger/DeclarationSummary';
import { useLedgerAction } from '@/features/ledger/actions';
import { liveDeclarations, type ActiveMember, type DeclarationRow, type Wallet } from '@/features/ledger/model';
import { formatDate } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { Badge, Button, Card, Sheet, TextField, useConfirmTap } from '@/ui';

type RowProps = { d: DeclarationRow; name: string; walletName?: string };

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

function WaitingRow({ d, name, walletName }: RowProps) {
  const approve = useLedgerAction(async (id: string) => {
    const { error } = await supabase.rpc('approve_declaration', { p_declaration: id });
    if (error) throw error;
  }, 'Declaration approved.');
  const confirm = useConfirmTap(() => approve.mutate(d.id));
  const [returning, setReturning] = useState(false);
  return (
    <li className="grid gap-3 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-semibold text-fg">{name}</p>
        <Badge tone="warning">{formatDate(d.submitted_at)}</Badge>
      </div>
      <DeclarationSummary d={d} walletName={walletName} />
      <div className="flex gap-2">
        <Button size="sm" isLoading={approve.isPending} onClick={confirm.tap}>{confirm.armed ? 'Tap again to approve' : 'Approve'}</Button>
        <Button size="sm" variant="secondary" onClick={() => setReturning(true)}>Return</Button>
      </div>
      {returning ? <ReturnSheet d={d} name={name} onClose={() => setReturning(false)} /> : null}
    </li>
  );
}

const PlainRow = ({ d, name, walletName }: RowProps) => (
  <li className="grid gap-2 py-4">
    <p className="font-semibold text-fg">{name}</p>
    <DeclarationSummary d={d} walletName={walletName} />
    {d.status === 'returned' && d.return_reason ? <p className="text-sm text-muted">Returned: {d.return_reason}</p> : null}
  </li>
);

export function DeclarationInbox({ declarations, members, wallets }: { declarations: DeclarationRow[]; members: ActiveMember[]; wallets: Wallet[] }) {
  const live = liveDeclarations(declarations);
  const nameOf = (id: string) => members.find((m) => m.id === id)?.short_name ?? 'Former member';
  const walletOf = (id: string | null) => wallets.find((w) => w.id === id)?.name;
  const waiting = live.filter((d) => d.status === 'submitted');
  const returned = live.filter((d) => d.status === 'returned');
  const approved = live.filter((d) => d.status === 'approved');

  if (live.length === 0) return <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted">No declarations yet this month.</p>;

  return (
    <div className="grid gap-4">
      <Card>
        <h3 className="text-lg font-semibold text-fg">Waiting ({waiting.length})</h3>
        <ul role="list" className="divide-y divide-line">
          {waiting.map((d) => <WaitingRow key={d.id} d={d} name={nameOf(d.member_id)} walletName={walletOf(d.wallet_id)} />)}
        </ul>
      </Card>
      {returned.length > 0 ? (
        <Card>
          <h3 className="text-lg font-semibold text-fg">Returned ({returned.length})</h3>
          <ul role="list" className="divide-y divide-line">
            {returned.map((d) => <PlainRow key={d.id} d={d} name={nameOf(d.member_id)} walletName={walletOf(d.wallet_id)} />)}
          </ul>
        </Card>
      ) : null}
      {approved.length > 0 ? (
        <Card>
          <details>
            <summary className="cursor-pointer text-lg font-semibold text-fg">Approved ({approved.length})</summary>
            <ul role="list" className="divide-y divide-line">
              {approved.map((d) => <PlainRow key={d.id} d={d} name={nameOf(d.member_id)} walletName={walletOf(d.wallet_id)} />)}
            </ul>
          </details>
        </Card>
      ) : null}
    </div>
  );
}
