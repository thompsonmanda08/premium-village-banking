import { useState, type ReactNode } from 'react';
import { useLedgerAction } from '@/features/ledger/actions';
import type { ActiveMember, Wallet } from '@/features/ledger/model';
import { parseKwacha } from '@/features/ledger/money';
import { useLoanCheck } from '@/features/ledger/queries';
import { useDebouncedValue } from '@/features/ledger/useDebouncedValue';
import { friendlyError } from '@/lib/errors';
import { money } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { Alert, Button, SelectField, Sheet, TextField, useConfirmTap } from '@/ui';

type Props = { members: ActiveMember[]; wallets: Wallet[]; initialMemberId?: string; initialAmount?: number; onClose: () => void };

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <>
    <dt className="text-muted">{label}</dt>
    <dd className="tabular text-right text-fg">{children}</dd>
  </>
);

export function SendLoanSheet({ members, wallets, initialMemberId = '', initialAmount, onClose }: Props) {
  const [memberId, setMemberId] = useState(initialMemberId);
  const [amount, setAmount] = useState(initialAmount ? String(initialAmount) : '');
  const [walletId, setWalletId] = useState('');
  const [fee, setFee] = useState('');
  const [reason, setReason] = useState('');

  const parsed = parseKwacha(amount);
  const principal = parsed !== null && parsed > 0 ? parsed : null;
  const feeValue = parseKwacha(fee);
  const asked = useDebouncedValue(principal, 300);
  const check = useLoanCheck(memberId || undefined, asked);
  const data = check.data;
  const name = members.find((m) => m.id === memberId)?.short_name ?? '';

  // Send only on a fresh, successful answer to exactly what is typed: a kept answer (another amount, a failed re-check, an
  // offline pause) must never enable it.
  const answered =
    check.isSuccess && !check.isPlaceholderData && check.fetchStatus === 'idle' && Boolean(data) && asked === principal && (data!.principal ?? null) === principal;
  const overCap = answered && data!.over_cap === true;
  const blocked = answered && (data!.insufficient_cash === true || !data!.loans_open);
  const canSend =
    Boolean(memberId && walletId) && principal !== null && feeValue !== null && answered && !blocked &&
    (!overCap || reason.trim().length > 0) && reason.trim().length <= 500;

  const send = useLedgerAction<void>(async () => {
    const { error } = await supabase.rpc('send_loan', {
      p_member: memberId,
      p_principal: principal!,
      p_wallet: walletId,
      p_reason: reason.trim() || undefined,
      p_fee: feeValue ?? 0,
    });
    if (error) throw error;
  }, 'Loan sent.');
  const confirm = useConfirmTap(() => send.mutate(undefined, { onSuccess: onClose }));
  // Closing mid-send would leave the request row offering Send again while the first send is still on its way.
  const close = () => {
    if (!send.isPending) onClose();
  };
  // Any edit disarms the second tap, so what is sent is always what was last seen.
  const edit = <T,>(set: (v: T) => void) => (v: T) => {
    confirm.reset();
    set(v);
  };

  return (
    <Sheet
      open
      onClose={close}
      title="Send a loan"
      description="Paid from lending cash. Interest is charged now; the schedule is worked out for you."
      footer={
        <Button fullWidth disabled={!canSend} isLoading={send.isPending} onClick={confirm.tap}>
          {confirm.armed ? `Tap again to send ${money(principal ?? 0)} to ${name}` : 'Send loan'}
        </Button>
      }
    >
      <form className="grid gap-4" noValidate onSubmit={(e) => e.preventDefault()}>
        <SelectField label="Member" value={memberId} onChange={(e) => edit(setMemberId)(e.target.value)}>
          <option value="">Choose a member</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.short_name}</option>)}
        </SelectField>
        <TextField
          label="Amount"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          error={parsed === null ? 'Use kwacha and ngwee, like 250 or 250.50.' : undefined}
          value={amount}
          onChange={(e) => edit(setAmount)(e.target.value)}
        />

        {memberId && check.isError ? <Alert tone="danger">{friendlyError(check.error)}</Alert> : null}
        {memberId && data ? (
          <section aria-label="Before you send" className="grid gap-3 rounded-xl bg-surface-2 p-4 text-sm">
            <h3 className="font-semibold text-fg">Before you send</h3>
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5">
              <Row label="Lending cash on hand">{money(data.lending_cash)}</Row>
              <Row label={`Limit (${data.multiple}× savings of ${money(data.cum_savings)})`}>{money(data.cap)}</Row>
              <Row label="Owes on loans">{money(data.loans_owed)}</Row>
              <Row label={data.headroom < 0 ? 'Over the limit by' : 'Room under the limit'}>{money(Math.abs(data.headroom))}</Row>
              {answered && data.interest !== undefined ? <Row label="Interest">{money(data.interest)}</Row> : null}
              {answered && data.term_months ? <Row label="Term">{data.term_months} month{data.term_months === 1 ? '' : 's'}</Row> : null}
            </dl>
            {data.arrears ? <Alert tone="warning">{data.arrears}</Alert> : null}
            {!data.loans_open ? <Alert tone="danger">No new loans can be sent this month.</Alert> : null}
            {answered && data.insufficient_cash ? (
              <Alert tone="danger">Only {money(data.lending_cash)} is on hand, which is less than this loan.</Alert>
            ) : null}
            {overCap ? <Alert tone="warning">This loan is over the member’s limit. Add a reason to send it anyway.</Alert> : null}
          </section>
        ) : null}

        <SelectField label="Wallet" value={walletId} onChange={(e) => edit(setWalletId)(e.target.value)}>
          <option value="">Choose the wallet it is sent from</option>
          {wallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </SelectField>
        <TextField
          label="Transfer fee (optional)"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          hint="Paid from the fee pot, not from lending cash."
          error={feeValue === null ? 'Use kwacha and ngwee, like 10 or 10.50.' : undefined}
          value={fee}
          onChange={(e) => edit(setFee)(e.target.value)}
        />
        <TextField
          label="Reason (required over the limit)"
          maxLength={500}
          autoComplete="off"
          value={reason}
          onChange={(e) => edit(setReason)(e.target.value)}
        />
      </form>
    </Sheet>
  );
}
