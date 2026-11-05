import { useState } from 'react';
import { useGroup } from '@/features/group/GroupContext';
import { Button, Sheet, TextField } from '@/ui';
import { fieldLabel, useMyQueries, useRaiseQuery } from './queryHooks';

type Props = { periodId: string; field: string; open: boolean; onClose: () => void };

/** Ask the treasurer about one figure on a closed statement. Earlier questions on it, and any reply, show above the box. */
export function QueryFigureSheet({ periodId, field, open, onClose }: Props) {
  const { member } = useGroup();
  const mine = useMyQueries(member?.id);
  const raise = useRaiseQuery();
  const [note, setNote] = useState('');
  const [error, setError] = useState<string>();
  // Closing mid-request would let the same question be sent twice.
  const close = () => {
    if (!raise.isPending) onClose();
  };
  const earlier = (mine.data ?? []).filter((q) => q.period_id === periodId && q.field === field);

  const submit = () => {
    const text = note.trim();
    if (!text) return setError('Say what looks wrong.');
    if (text.length > 500) return setError('Keep it to 500 characters or fewer.');
    setError(undefined);
    if (!raise.isPending) raise.mutate({ periodId, field, note: text }, { onSuccess: onClose });
  };

  return (
    <Sheet
      open={open}
      onClose={close}
      title={`Question: ${fieldLabel(field)}`}
      description="The treasurer will read this and reply. You can have up to 3 open questions."
      footer={<Button fullWidth isLoading={raise.isPending} onClick={submit}>Send question</Button>}
    >
      <form className="grid gap-4" noValidate onSubmit={(e) => { e.preventDefault(); submit(); }}>
        {earlier.length > 0 ? (
          <ul role="list" aria-label="Your earlier questions" className="grid gap-2 text-sm">
            {earlier.map((q) => (
              <li key={q.id} className="rounded-xl bg-surface-2 px-4 py-3">
                <p className="text-fg">{q.note}</p>
                {q.reply ? <p className="mt-1 text-muted">{q.reply}</p> : <p className="mt-1 text-muted">Waiting for a reply</p>}
              </li>
            ))}
          </ul>
        ) : null}
        <TextField label="What looks wrong?" maxLength={500} autoComplete="off" error={error} value={note} onChange={(e) => setNote(e.target.value)} />
      </form>
    </Sheet>
  );
}
