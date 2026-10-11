import { CalendarClock } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useLedgerAction } from '@/features/ledger/actions';
import { currentPeriod, nextToOpen, type PeriodRow } from '@/features/ledger/model';
import { formatDate } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { Alert, Button, Card, CardHeader, Sheet, TextField } from '@/ui';

function OpenMonthSheet({ cycleId, period, onClose }: { cycleId: string; period: PeriodRow; onClose: () => void }) {
  const [deadline, setDeadline] = useState(period.deadline);
  const [error, setError] = useState<string>();
  const open = useLedgerAction(async (date: string) => {
    const { error: e } = await supabase.rpc('open_period', { p_cycle: cycleId, p_month_index: period.month_index, p_deadline: date });
    if (e) throw e;
  }, `${period.label} is open for declarations.`);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!deadline || deadline < period.starts_on) {
      setError(`Pick a date in ${period.label} or later.`);
      return;
    }
    setError(undefined);
    open.mutate(deadline, { onSuccess: onClose });
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Open ${period.label}`}
      description="Members can declare once the month is open. The deadline can be in the past if you are catching up."
      footer={<Button type="submit" form="open-month" fullWidth isLoading={open.isPending}>Open month</Button>}
    >
      <form id="open-month" noValidate onSubmit={submit}>
        <TextField label="Declaration deadline" type="date" min={period.starts_on} value={deadline} error={error} onChange={(e) => setDeadline(e.target.value)} />
      </form>
    </Sheet>
  );
}

function DeadlineSheet({ period, onClose }: { period: PeriodRow; onClose: () => void }) {
  const [deadline, setDeadline] = useState(period.deadline);
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<{ date?: string; reason?: string }>({});
  const save = useLedgerAction(async (a: { date: string; reason: string }) => {
    const { error: e } = await supabase.rpc('set_deadline', { p_period: period.id, p_deadline: a.date, p_reason: a.reason });
    if (e) throw e;
  }, 'Deadline updated.');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: { date?: string; reason?: string } = {};
    if (!deadline || deadline < period.starts_on) next.date = `Pick a date in ${period.label} or later.`;
    if (!reason.trim()) next.reason = 'Add a reason first.';
    else if (reason.trim().length > 500) next.reason = 'Keep the reason to 500 characters or fewer.';
    setErrors(next);
    if (next.date || next.reason) return;
    save.mutate({ date: deadline, reason: reason.trim() }, { onSuccess: onClose });
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title="Change deadline"
      description={`${period.label} is due ${formatDate(period.deadline)}. The change is recorded with your reason.`}
      footer={<Button type="submit" form="change-deadline" fullWidth isLoading={save.isPending}>Save deadline</Button>}
    >
      <form id="change-deadline" className="grid gap-4" noValidate onSubmit={submit}>
        <TextField label="New deadline" type="date" min={period.starts_on} value={deadline} error={errors.date} onChange={(e) => setDeadline(e.target.value)} />
        <TextField label="Reason" maxLength={500} autoComplete="off" value={reason} error={errors.reason} onChange={(e) => setReason(e.target.value)} />
      </form>
    </Sheet>
  );
}

export function MonthPanel({ cycleId, periods }: { cycleId: string; periods: PeriodRow[] }) {
  const open = currentPeriod(periods);
  const next = nextToOpen(periods);
  const [sheet, setSheet] = useState<'open' | 'deadline' | null>(null);
  const close = () => setSheet(null);

  if (open) {
    return (
      <Card>
        <CardHeader
          title={`${open.label} is open`}
          subtitle={`Declarations due ${formatDate(open.deadline)}`}
          action={<Button size="sm" variant="secondary" onClick={() => setSheet('deadline')}>Change deadline</Button>}
        />
        {sheet === 'deadline' ? <DeadlineSheet period={open} onClose={close} /> : null}
      </Card>
    );
  }
  if (next) {
    return (
      <Card>
        <CardHeader
          title={`${next.label} is next`}
          subtitle="Open the month so members can declare."
          action={<Button size="sm" onClick={() => setSheet('open')} leftIcon={<CalendarClock className="size-5" />}>Open {next.label}</Button>}
        />
        {sheet === 'open' ? <OpenMonthSheet cycleId={cycleId} period={next} onClose={close} /> : null}
      </Card>
    );
  }
  return <Alert tone="info">No month is waiting to be opened.</Alert>;
}
