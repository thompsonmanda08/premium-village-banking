import { useState, type ReactNode } from 'react';
import { useLedgerAction } from '@/features/ledger/actions';
import { kindLabel, type EntryRow } from '@/features/ledger/memberViews';
import { parseKwacha } from '@/features/ledger/money';
import { money } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { Button, Sheet, TextField, useConfirmTap } from '@/ui';

type Props = { entry: EntryRow; current: number; memberName: string; monthLabel: string; onClose: () => void };
type Errors = { amount?: string; reason?: string };

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <>
    <dt className="text-muted">{label}</dt>
    <dd className="tabular text-right text-fg">{children}</dd>
  </>
);

/** Waive part or all of a charge. The waiver lands in the open month; the original stays where it was. */
export function WaiveEntrySheet({ entry, current, memberName, monthLabel, onClose }: Props) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const value = parseKwacha(amount);

  const post = useLedgerAction(async (a: { amount: number; reason: string }) => {
    const { error } = await supabase.rpc('post_waiver', { p_entry: entry.id, p_amount: a.amount, p_reason: a.reason });
    if (error) throw error;
  }, 'Waiver posted.');
  const confirm = useConfirmTap(() => post.mutate({ amount: value ?? 0, reason: reason.trim() }, { onSuccess: onClose }));
  // Closing mid-request would let the same waiver be posted again from the list behind it.
  const close = () => {
    if (!post.isPending) onClose();
  };
  const edit = <T,>(set: (v: T) => void) => (v: T) => {
    confirm.reset();
    set(v);
  };

  const tap = () => {
    const next: Errors = {};
    if (value === null) next.amount = 'Use kwacha and ngwee, like 250 or 250.50.';
    else if (value <= 0) next.amount = 'Enter an amount above zero.';
    else if (Math.round(value * 100) > Math.round(current * 100)) next.amount = `You can waive at most ${money(current)}.`;
    if (!reason.trim()) next.reason = 'Say why.';
    else if (reason.trim().length > 500) next.reason = 'Keep the reason to 500 characters or fewer.';
    setErrors(next);
    if (next.amount || next.reason) {
      confirm.reset();
      return;
    }
    confirm.tap();
  };

  return (
    <Sheet
      open
      onClose={close}
      title="Waive a charge"
      description="The waiver is added to the open month with your reason. The original charge stays in its own month."
      footer={
        <Button fullWidth isLoading={post.isPending} onClick={tap}>
          {confirm.armed ? `Tap again to waive ${money(value ?? 0)} of ${money(current)}` : 'Post waiver'}
        </Button>
      }
    >
      <form className="grid gap-4" noValidate onSubmit={(e) => e.preventDefault()}>
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
          <Row label="Member">{memberName}</Row>
          <Row label="Month">{monthLabel}</Row>
          <dt className="text-muted">Charge</dt>
          <dd className="text-right font-semibold text-fg">{kindLabel(entry.kind)}</dd>
          <Row label="Still charged">{money(current)}</Row>
        </dl>
        <TextField
          label="Amount to waive"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          error={errors.amount}
          value={amount}
          onChange={(e) => edit(setAmount)(e.target.value)}
        />
        <TextField label="Reason" maxLength={500} autoComplete="off" error={errors.reason} value={reason} onChange={(e) => edit(setReason)(e.target.value)} />
      </form>
    </Sheet>
  );
}
