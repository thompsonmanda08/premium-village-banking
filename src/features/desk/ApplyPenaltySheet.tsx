import { useState } from 'react';
import { useLedgerAction } from '@/features/ledger/actions';
import { groundLabel, type PenaltySuggestion } from '@/features/ledger/deskMoney';
import type { ActiveMember } from '@/features/ledger/model';
import { parseKwacha } from '@/features/ledger/money';
import { money } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { Button, SelectField, Sheet, TextField, useConfirmTap } from '@/ui';

type Props = { periodId: string; members: ActiveMember[]; suggestion?: PenaltySuggestion; onClose: () => void };
type Errors = { member?: string; amount?: string; reason?: string };

export function ApplyPenaltySheet({ periodId, members, suggestion, onClose }: Props) {
  const [memberId, setMemberId] = useState(suggestion?.member_id ?? '');
  const [amount, setAmount] = useState(suggestion ? String(suggestion.amount) : '');
  const [reason, setReason] = useState(suggestion?.detail ?? '');
  const [errors, setErrors] = useState<Errors>({});
  const ground = suggestion?.ground ?? 'other';
  const name = members.find((m) => m.id === memberId)?.short_name ?? '';

  const apply = useLedgerAction(async (a: { amount: number; reason: string }) => {
    const { error } = await supabase.rpc('apply_penalty', {
      p_member: memberId,
      p_period: periodId,
      p_amount: a.amount,
      p_ground: ground,
      p_reason: a.reason,
    });
    if (error) throw error;
  }, 'Penalty applied.');

  const confirm = useConfirmTap(() => {
    apply.mutate({ amount: parseKwacha(amount) ?? 0, reason: reason.trim() }, { onSuccess: onClose });
  });
  // Any edit disarms the second tap, so what is applied is always what was last seen.
  const edit = <T,>(set: (v: T) => void) => (v: T) => {
    confirm.reset();
    set(v);
  };

  const tap = () => {
    const value = parseKwacha(amount);
    const next: Errors = {};
    if (!memberId) next.member = 'Choose a member.';
    if (value === null) next.amount = 'Use kwacha and ngwee, like 250 or 250.50.';
    else if (value <= 0) next.amount = 'Enter an amount above zero.';
    if (!reason.trim()) next.reason = 'Say why.';
    else if (reason.trim().length > 500) next.reason = 'Keep the reason to 500 characters or fewer.';
    setErrors(next);
    if (next.member || next.amount || next.reason) {
      confirm.reset();
      return;
    }
    confirm.tap();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title="Apply a penalty"
      description="It is charged to the member this month and recorded with your reason."
      footer={
        <Button fullWidth isLoading={apply.isPending} onClick={tap}>
          {confirm.armed ? `Tap again to apply ${money(parseKwacha(amount) ?? 0)} to ${name}` : 'Apply penalty'}
        </Button>
      }
    >
      <form className="grid gap-4" noValidate onSubmit={(e) => e.preventDefault()}>
        {suggestion ? (
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-muted">Member</dt>
            <dd className="text-right font-semibold text-fg">{suggestion.short_name}</dd>
            <dt className="text-muted">Ground</dt>
            <dd className="text-right text-fg">{groundLabel(suggestion.ground)}</dd>
          </dl>
        ) : (
          <SelectField label="Member" value={memberId} error={errors.member} onChange={(e) => edit(setMemberId)(e.target.value)}>
            <option value="">Choose a member</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.short_name}</option>)}
          </SelectField>
        )}
        <TextField
          label="Amount"
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
