import { useId, useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { Alert, Button, TextField, useToast } from '@/ui';
import { cn } from '@/ui/cn';
import { ChevronDown } from 'lucide-react';
import { money } from '@/lib/format';
import { friendlyError } from '@/lib/errors';
import { prepareProof, uploadProof } from '@/lib/proof';
import { useLedgerAction } from './actions';
import { ProofPicker } from './Proofs';
import { parseKwacha, sumKwacha } from './money';
import { AMOUNTS, EMPTY_FORM, fromDeclaration, validateDeclaration, type AmountKey, type DeclarationArgs, type FormErrors, type FormValues } from './declarationModel';
import type { DeclarationRow, Wallet } from './model';

const PRIMARY: AmountKey[] = ['saving', 'loan_repayment'];
const OTHER: AmountKey[] = ['excess', 'membership', 'penalty', 'txn_fee'];
const BORROW: AmountKey[] = ['borrowing_request'];
const MONEY: AmountKey[] = [...PRIMARY, ...OTHER];

// What each box is for, in the member's words, so nobody has to guess where an amount goes.
const COPY: Record<AmountKey, { hint: string; info: string }> = {
  saving: { hint: 'Added to your savings this month.', info: 'Your savings earn a share of the group’s interest when the cycle pays out. The monthly minimum is in the group rules.' },
  loan_repayment: { hint: 'Paid towards a loan you already have.', info: 'This reduces what you owe. It does not change your savings. The Plan page lists your loans.' },
  excess: { hint: 'Your share of the charge on idle cash.', info: 'Cash the group has not lent out is charged excess interest, shared by members by their savings. Your statement shows your share.' },
  membership: { hint: 'The membership fee, if it is due.', info: 'The amount is in the group rules. Leave it empty if you have already paid it.' },
  penalty: { hint: 'A penalty the treasurer charged you.', info: 'Only enter a penalty that is on your statement or that the treasurer told you about.' },
  txn_fee: { hint: 'The fee you paid to send this money.', info: 'Mobile-money transfer fees are kept outside the lending pool, so they are recorded on their own.' },
  borrowing_request: { hint: 'What you would like to borrow next.', info: 'This is only a request. The treasurer decides, and what you can borrow depends on your savings.' },
};

/** A collapsed group of fields: the common path stays short, and the rest is one tap away. */
function More({ title, hint, filled, children }: { title: string; hint: string; filled: boolean; children: React.ReactNode }) {
  // Open by hand or because it holds a figure; once opened it stays open, so clearing a box never folds the group away.
  const [opened, setOpened] = useState(false);
  return (
    <details open={opened || filled} onToggle={(e) => setOpened(e.currentTarget.open)} className="group rounded-xl border border-line">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2">
        <span>
          <span className="block text-base font-medium text-fg">{title}</span>
          <span className="block text-sm text-muted">{hint}</span>
        </span>
        <ChevronDown aria-hidden className="size-5 shrink-0 text-muted transition-transform duration-150 group-open:rotate-180" />
      </summary>
      <div className="grid gap-4 px-4 pb-4">{children}</div>
    </details>
  );
}

type Props = { periodId: string; memberId: string; wallets: Wallet[]; initial?: DeclarationRow | null; onDone: () => void };

export function DeclarationForm({ periodId, memberId, wallets, initial, onDone }: Props) {
  const [values, setValues] = useState<FormValues>(initial ? fromDeclaration(initial) : EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const walletId = useId();
  const toast = useToast();
  const [proof, setProof] = useState<File | null>(null);
  const [proofError, setProofError] = useState<string>();

  const submit = useLedgerAction(async (a: DeclarationArgs & { proof: Blob | null }) => {
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
    // The declaration is already sent; a proof that fails to upload must not read as a failed declaration.
    if (a.proof) {
      try {
        await uploadProof(periodId, memberId, a.proof);
      } catch (e) {
        toast(`Declaration sent, but the proof was not attached. ${friendlyError(e)} Edit your declaration to try again.`, { tone: 'danger' });
      }
    }
  }, 'Declaration sent to the treasurer.');

  const set = (k: keyof FormValues) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [k]: e.target.value }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    let prepared: Blob | null = null;
    if (proof) {
      try {
        prepared = await prepareProof(proof);
        setProofError(undefined);
      } catch (err) {
        setProofError(friendlyError(err));
        return;
      }
    }
    const result = validateDeclaration(values);
    if ('errors' in result) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    submit.mutate({ ...result.args, proof: prepared }, { onSuccess: onDone });
  };

  const lookup = (k: AmountKey) => AMOUNTS.find((a) => a.key === k)!;
  const field = (k: AmountKey) => (
    <TextField key={k} label={lookup(k).label} hint={COPY[k].hint} info={COPY[k].info} prefix="K" inputMode="decimal" autoComplete="off" placeholder="0" error={errors[k]} value={values[k]} onChange={set(k)} />
  );
  // A group opens when it already holds a figure or an error, so nothing typed is ever hidden.
  const filled = (keys: readonly AmountKey[]) => keys.some((k) => values[k].trim() !== '' || errors[k]);
  const sending = sumKwacha(...MONEY.map((k) => parseKwacha(values[k]) ?? 0));

  return (
    <form className="@container grid gap-4" noValidate onSubmit={onSubmit}>
      {errors.form ? <Alert tone="danger">{errors.form}</Alert> : null}
      <div className="grid gap-4 @md:grid-cols-2">{PRIMARY.map(field)}</div>

      <More title="Other charges" hint="Excess, membership, penalty or the mobile-money fee" filled={filled(OTHER)}>
        <div className="grid gap-4 @md:grid-cols-2">{OTHER.map(field)}</div>
      </More>
      <More title="Ask to borrow" hint="A request for the treasurer, not money you send" filled={filled(BORROW)}>
        {BORROW.map(field)}
      </More>

      <p className="flex items-baseline justify-between gap-3 rounded-xl bg-surface-2 px-4 py-3">
        <span className="text-sm text-muted">You are sending</span>
        <span className="tabular text-lg font-semibold text-fg">{money(sending)}</span>
      </p>

      <div className="grid gap-1.5">
        <label htmlFor={walletId} className="text-sm font-medium text-fg">Wallet</label>
        <p className="-mt-1 text-sm text-muted">Where you sent the money from.</p>
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
      <ProofPicker file={proof} onChange={(f) => { setProof(f); setProofError(undefined); }} error={proofError} />
      <TextField label="Note (optional)" maxLength={500} autoComplete="off" error={errors.note} value={values.note} onChange={set('note')} />
      <Button type="submit" fullWidth isLoading={submit.isPending}>Submit declaration</Button>
    </form>
  );
}
