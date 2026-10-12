import { useState } from 'react';
import { useLedgerAction } from '@/features/ledger/actions';
import type { MemberStatusRow } from '@/features/ledger/queries';
import { formatDate } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { Badge, Button, Card, Sheet, TextField, useConfirmTap } from '@/ui';

type Props = { memberId: string; memberName: string; cycleId: string; status: MemberStatusRow | undefined };

function DefaultSheet({ memberId, memberName, cycleId, defaulted, onClose }: { memberId: string; memberName: string; cycleId: string; defaulted: boolean; onClose: () => void }) {
  // `defaulted` here is the state being set: true marks the member, false reverses it.
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string>();
  const record = useLedgerAction(async (text: string) => {
    const { error: e } = await supabase.rpc('set_default', { p_member: memberId, p_cycle: cycleId, p_defaulted: defaulted, p_reason: text });
    if (e) throw e;
  }, defaulted ? 'Default recorded.' : 'Default reversed.');
  const confirm = useConfirmTap(() => record.mutate(reason.trim(), { onSuccess: onClose }));
  // Closing mid-request would let the same change be recorded again.
  const close = () => {
    if (!record.isPending) onClose();
  };

  const tap = () => {
    const text = reason.trim();
    if (!text) {
      setError('Say why.');
      confirm.reset();
      return;
    }
    if (text.length > 500) {
      setError('Keep the reason to 500 characters or fewer.');
      confirm.reset();
      return;
    }
    setError(undefined);
    confirm.tap();
  };

  return (
    <Sheet
      open
      onClose={close}
      title={defaulted ? `Mark ${memberName} as defaulted` : `Reverse ${memberName}’s default`}
      description="The change and your reason are recorded."
      footer={
        <Button fullWidth isLoading={record.isPending} onClick={tap}>
          {confirm.armed ? (defaulted ? `Tap again to mark ${memberName} as defaulted` : `Tap again to reverse ${memberName}’s default`) : defaulted ? 'Record default' : 'Record reversal'}
        </Button>
      }
    >
      <form noValidate onSubmit={(e) => e.preventDefault()}>
        <TextField
          label="Reason"
          maxLength={500}
          autoComplete="off"
          error={error}
          value={reason}
          onChange={(e) => {
            confirm.reset();
            setReason(e.target.value);
          }}
        />
      </form>
    </Sheet>
  );
}

/** Whether the member is defaulted for the cycle, who changed it and why, and the way to change it. No record means in good standing. */
export function DefaultPanel({ memberId, memberName, cycleId, status }: Props) {
  const [open, setOpen] = useState(false);
  const defaulted = status?.defaulted === true;
  return (
    <Card>
      <section aria-labelledby="default-title" className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="default-title" className="text-lg font-semibold text-fg">Default status</h2>
          <Badge tone={defaulted ? 'danger' : 'success'}>{defaulted ? 'Defaulted' : 'In good standing'}</Badge>
        </div>
        {status ? <p className="text-sm text-muted">{`Changed ${formatDate(status.changed_at)}: ${status.reason}`}</p> : null}
        <p className="text-sm text-muted">
          A defaulted member earns no further interest share, and what they owe is taken from their payout.
        </p>
        <div>
          <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>{defaulted ? 'Reverse the default' : 'Mark as defaulted'}</Button>
        </div>
      </section>
      {open ? <DefaultSheet memberId={memberId} memberName={memberName} cycleId={cycleId} defaulted={!defaulted} onClose={() => setOpen(false)} /> : null}
    </Card>
  );
}
