import { useState, type ReactNode } from 'react';
import { useLedgerAction } from '@/features/ledger/actions';
import { kindLabel, type EntryRow } from '@/features/ledger/memberViews';
import { parseKwacha, sumKwacha } from '@/features/ledger/money';
import { money } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { Button, Sheet, TextField, useConfirmTap } from '@/ui';

type Props = { entry: EntryRow; current: number; onClose: () => void };
type Errors = { total?: string; reason?: string };

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <>
    <dt className="text-muted">{label}</dt>
    <dd className="tabular text-right text-fg">{children}</dd>
  </>
);

/** Set an entry's total to a new amount. The correction lands in the open month; the original stays where it was. */
export function CorrectEntrySheet({ entry, current, onClose }: Props) {
  const [total, setTotal] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const value = parseKwacha(total);

  const post = useLedgerAction(async (a: { amount: number; reason: string }) => {
    const { error } = await supabase.rpc('post_correction', { p_entry: entry.id, p_new_amount: a.amount, p_reason: a.reason });
    if (error) throw error;
  }, 'Correction posted.');
  const confirm = useConfirmTap(() => post.mutate({ amount: value ?? 0, reason: reason.trim() }, { onSuccess: onClose }));
  // Closing mid-request would let the same correction be posted again from the list behind it.
  const close = () => {
    if (!post.isPending) onClose();
  };
  // Any edit disarms the second tap, so what is posted is always what was last seen.
  const edit = <T,>(set: (v: T) => void) => (v: T) => {
    confirm.reset();
    set(v);
  };

  const tap = () => {
    const next: Errors = {};
    if (total.trim() === '') next.total = 'Enter the new total.';
    else if (value === null) next.total = 'Use kwacha and ngwee, like 250 or 250.50.';
    else if (sumKwacha(value, -current) === 0) next.total = 'That is already the amount.';
    if (!reason.trim()) next.reason = 'Say why.';
    else if (reason.trim().length > 500) next.reason = 'Keep the reason to 500 characters or fewer.';
    setErrors(next);
    if (next.total || next.reason) {
      confirm.reset();
      return;
    }
    confirm.tap();
  };

  return (
    <Sheet
      open
      onClose={close}
      title="Correct an entry"
      description="The correction is added to the open month with your reason. The original stays in its own month."
      footer={
        <Button fullWidth isLoading={post.isPending} onClick={tap}>
          {confirm.armed ? `Tap again to change ${money(current)} to ${money(value ?? 0)}` : 'Post correction'}
        </Button>
      }
    >
      <form className="grid gap-4" noValidate onSubmit={(e) => e.preventDefault()}>
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-muted">Entry</dt>
          <dd className="text-right font-semibold text-fg">{kindLabel(entry.kind)}</dd>
          <Row label="Recorded">{money(entry.amount)}</Row>
          <Row label="Now">{money(current)}</Row>
        </dl>
        <TextField
          label="New total"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          error={errors.total}
          value={total}
          onChange={(e) => edit(setTotal)(e.target.value)}
        />
        <TextField label="Reason" maxLength={500} autoComplete="off" error={errors.reason} value={reason} onChange={(e) => edit(setReason)(e.target.value)} />
      </form>
    </Sheet>
  );
}
