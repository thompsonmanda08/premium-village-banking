import { useState } from 'react';
import { useGroup } from '@/features/group/GroupContext';
import { useLedgerAction } from '@/features/ledger/actions';
import { parseKwacha } from '@/features/ledger/money';
import { useExpenses, usePots } from '@/features/ledger/queries';
import { formatDate, localISODate, money } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { Button, Card, CardHeader, SelectField, Sheet, TextField } from '@/ui';

const POTS: Record<string, { name: string; from: string }> = {
  hosting: { name: 'Meeting hosting', from: 'Membership fees' },
  fees: { name: 'Transfer fees', from: 'Fees members declare' },
};

function SpendingSheet({ cycleId, onClose }: { cycleId: string; onClose: () => void }) {
  const [pot, setPot] = useState('hosting');
  const [amount, setAmount] = useState('');
  const [spentOn, setSpentOn] = useState(localISODate(new Date()));
  const [note, setNote] = useState('');
  const [show, setShow] = useState(false);

  const value = parseKwacha(amount);
  const errors = {
    amount: value === null || value === 0 ? 'Enter an amount, like 250 or 250.50. A refund into the pot is negative.' : undefined,
    date: spentOn ? undefined : 'Choose the date.',
    note: note.trim() ? (note.trim().length > 200 ? 'Keep it to 200 characters or fewer.' : undefined) : 'Say what it was for.',
  };
  const bad = Boolean(errors.amount || errors.date || errors.note);

  const save = useLedgerAction(async () => {
    const { error } = await supabase.rpc('record_expense', { p_cycle: cycleId, p_pot: pot, p_amount: value!, p_spent_on: spentOn, p_note: note.trim() });
    if (error) throw error;
  }, 'Spending recorded.');
  const close = () => {
    if (!save.isPending) onClose();
  };

  return (
    <Sheet
      open
      onClose={close}
      title="Record spending"
      description="Money spent from a pot is recorded here and never edited. A mistake is fixed by recording the opposite amount."
      footer={
        <Button
          fullWidth
          isLoading={save.isPending}
          onClick={() => {
            setShow(true);
            if (!bad) save.mutate(undefined, { onSuccess: onClose });
          }}
        >
          Record spending
        </Button>
      }
    >
      <form className="grid gap-4" noValidate onSubmit={(e) => e.preventDefault()}>
        <SelectField label="Which pot" value={pot} onChange={(e) => setPot(e.target.value)}>
          {Object.entries(POTS).map(([k, p]) => <option key={k} value={k}>{`${p.name} (${p.from.toLowerCase()})`}</option>)}
        </SelectField>
        <TextField label="Amount" prefix="K" inputMode="decimal" autoComplete="off" placeholder="0" error={show ? errors.amount : undefined} value={amount} onChange={(e) => setAmount(e.target.value)} />
        <TextField label="Date spent" type="date" error={show ? errors.date : undefined} value={spentOn} onChange={(e) => setSpentOn(e.target.value)} />
        <TextField label="What was it for?" hint="For example: hall hire for the March meeting." maxLength={200} autoComplete="off" error={show ? errors.note : undefined} value={note} onChange={(e) => setNote(e.target.value)} />
      </form>
    </Sheet>
  );
}

/** The two pots and what has been spent from them; whatever is left at the payout is shared by savings. */
export function PotsCard({ cycleId }: { cycleId: string }) {
  const { isAdmin } = useGroup();
  const pots = usePots(cycleId);
  const spent = useExpenses(cycleId);
  const [open, setOpen] = useState(false);
  if (!pots.data) return null;

  return (
    <Card>
      <CardHeader title="Pots" subtitle="Shared out by savings at the payout, after spending." action={isAdmin ? <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>Record spending</Button> : null} />
      <dl className="grid gap-3">
        {pots.data.map((p) => (
          <div key={p.pot} className="rounded-xl bg-surface-2 p-3">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-base font-medium text-fg">{POTS[p.pot]?.name ?? p.pot}</dt>
              <dd className="tabular text-lg font-semibold text-fg">{money(p.remaining)}</dd>
            </div>
            <p className="tabular mt-0.5 text-sm text-muted">{`${money(p.collected)} collected · ${money(p.spent)} spent`}</p>
          </div>
        ))}
      </dl>
      {spent.data && spent.data.length > 0 ? (
        <ul role="list" className="mt-3 divide-y divide-line text-sm">
          {spent.data.slice(0, 5).map((e) => (
            <li key={e.id} className="flex items-baseline justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="block truncate text-fg">{e.note}</span>
                <span className="block text-muted">{`${POTS[e.pot]?.name ?? e.pot} · ${formatDate(e.spent_on)}`}</span>
              </span>
              <span className="tabular text-fg">{money(e.amount)}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {open ? <SpendingSheet cycleId={cycleId} onClose={() => setOpen(false)} /> : null}
    </Card>
  );
}
