import { useState, type FormEvent } from 'react';
import { localISODate } from '@/lib/format';
import { Button, Sheet, TextField } from '@/ui';
import type { CatalogRule } from './ruleCatalog';
import { useRecordRatification } from './useRatifications';

type Props = { rule: CatalogRule; cycleId: string; open: boolean; onClose: () => void };
type Errors = { date?: string; votesFor?: string; votesTotal?: string };

const count = (s: string): number | null => (/^\d{1,4}$/.test(s.trim()) ? Number(s) : null);

/** Record the outcome of a group vote on one rule. The vote is added to the record; earlier votes stay. */
export function RecordVoteSheet({ rule, cycleId, open, onClose }: Props) {
  const [decidedOn, setDecidedOn] = useState('');
  const [votesFor, setVotesFor] = useState('');
  const [votesTotal, setVotesTotal] = useState('');
  const [meetingRef, setMeetingRef] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const record = useRecordRatification();
  // Closing mid-request would let the same vote be recorded twice.
  const close = () => {
    if (!record.isPending) onClose();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const f = count(votesFor);
    const t = count(votesTotal);
    const next: Errors = {};
    if (!decidedOn) next.date = 'Pick the date of the vote.';
    else if (decidedOn > localISODate(new Date())) next.date = 'The date can’t be in the future.';
    if (f === null) next.votesFor = 'Enter a whole number.';
    if (t === null) next.votesTotal = 'Enter a whole number.';
    else if (t < 1) next.votesTotal = 'At least one member must have voted.';
    else if (f !== null && f > t) next.votesFor = 'Votes for can’t be more than the members who voted.';
    setErrors(next);
    if (next.date || next.votesFor || next.votesTotal || f === null || t === null) return;
    record.mutate(
      { cycleId, ruleKey: rule.key, decidedOn, votesFor: f, votesTotal: t, meetingRef: meetingRef.trim() || undefined, note: note.trim() || undefined },
      { onSuccess: onClose },
    );
  };

  return (
    <Sheet
      open={open}
      onClose={close}
      title="Record a vote"
      description={`${rule.title}. A rule passes when at least two thirds of the members who voted are for it. Entered a vote by mistake? Record it again and the latest one counts.`}
      footer={<Button type="submit" form="record-vote" fullWidth isLoading={record.isPending}>Record vote</Button>}
    >
      <form id="record-vote" className="grid gap-4" noValidate onSubmit={submit}>
        <TextField label="Date of the vote" type="date" max={localISODate(new Date())} error={errors.date} value={decidedOn} onChange={(e) => setDecidedOn(e.target.value)} />
        <TextField label="Votes for" inputMode="numeric" autoComplete="off" error={errors.votesFor} value={votesFor} onChange={(e) => setVotesFor(e.target.value)} />
        <TextField label="Members who voted" inputMode="numeric" autoComplete="off" error={errors.votesTotal} value={votesTotal} onChange={(e) => setVotesTotal(e.target.value)} />
        <TextField label="Meeting (optional)" maxLength={200} autoComplete="off" value={meetingRef} onChange={(e) => setMeetingRef(e.target.value)} />
        <TextField label="Note (optional)" maxLength={500} autoComplete="off" value={note} onChange={(e) => setNote(e.target.value)} />
      </form>
    </Sheet>
  );
}
