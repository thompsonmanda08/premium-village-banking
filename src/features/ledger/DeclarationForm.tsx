import { useId, useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { Alert, Button, TextField } from '@/ui';
import { cn } from '@/ui/cn';
import { useLedgerAction } from './actions';
import { AMOUNTS, EMPTY_FORM, fromDeclaration, validateDeclaration, type DeclarationArgs, type FormErrors, type FormValues } from './declarationForm';
import type { DeclarationRow, Wallet } from './model';

type Props = { periodId: string; memberId: string; wallets: Wallet[]; initial?: DeclarationRow | null; onDone: () => void };

export function DeclarationForm({ periodId, memberId, wallets, initial, onDone }: Props) {
  const [values, setValues] = useState<FormValues>(initial ? fromDeclaration(initial) : EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const walletId = useId();

  const submit = useLedgerAction(async (a: DeclarationArgs) => {
    const { error } = await supabase.rpc('submit_declaration', {
      p_period: periodId,
      p_member: memberId,
      p_saving: a.saving,
      p_loan_repayment: a.loan_repayment,
      p_excess: a.excess,
      p_membership: a.membership,
      p_penalty: a.penalty,
      p_txn_fee: a.txn_fee,
      p_borrowing_request: a.borrowing_request,
      p_wallet: a.wallet,
      p_note: a.note,
    });
    if (error) throw error;
  }, 'Declaration sent to the treasurer.');

  const set = (k: keyof FormValues) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [k]: e.target.value }));

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const result = validateDeclaration(values);
    if ('errors' in result) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    submit.mutate(result.args, { onSuccess: onDone });
  };

  return (
    <form className="grid gap-4" noValidate onSubmit={onSubmit}>
      {errors.form ? <Alert tone="danger">{errors.form}</Alert> : null}
      {AMOUNTS.map((a) => (
        <TextField
          key={a.key}
          label={a.label}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          error={errors[a.key]}
          value={values[a.key]}
          onChange={set(a.key)}
        />
      ))}
      <div className="grid gap-1.5">
        <label htmlFor={walletId} className="text-sm font-medium text-fg">Wallet</label>
        <select
          id={walletId}
          value={values.wallet}
          onChange={set('wallet')}
          aria-invalid={errors.wallet ? true : undefined}
          aria-describedby={errors.wallet ? `${walletId}-error` : undefined}
          className={cn(
            'h-12 w-full rounded-xl border bg-surface px-3.5 text-base text-fg transition focus-visible:border-accent',
            errors.wallet ? 'border-danger' : 'border-line',
          )}
        >
          <option value="">Choose a wallet</option>
          {wallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        {errors.wallet ? <p id={`${walletId}-error`} role="alert" className="text-sm text-danger">{errors.wallet}</p> : null}
      </div>
      <TextField label="Note (optional)" maxLength={500} autoComplete="off" error={errors.note} value={values.note} onChange={set('note')} />
      <Button type="submit" fullWidth isLoading={submit.isPending}>Submit declaration</Button>
    </form>
  );
}
