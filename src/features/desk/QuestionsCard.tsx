import { useState } from 'react';
import { useGroup } from '@/features/group/GroupContext';
import { fieldLabel, useAnswerQuery, useOpenQueries, type OpenQuery } from '@/features/queries/queryHooks';
import { friendlyError } from '@/lib/errors';
import { Alert, Button, Card, Sheet, TextField } from '@/ui';

function AnswerSheet({ query, onClose }: { query: OpenQuery; onClose: () => void }) {
  const answer = useAnswerQuery();
  const [reply, setReply] = useState('');
  const [error, setError] = useState<string>();
  // Closing mid-request would let the same answer be sent twice.
  const close = () => {
    if (!answer.isPending) onClose();
  };
  const submit = () => {
    const text = reply.trim();
    if (!text) return setError('Write your answer.');
    if (text.length > 500) return setError('Keep it to 500 characters or fewer.');
    setError(undefined);
    if (!answer.isPending) answer.mutate({ queryId: query.id, reply: text }, { onSuccess: onClose });
  };
  return (
    <Sheet
      open
      onClose={close}
      title={`Answer ${query.short_name}`}
      description={`${fieldLabel(query.field)}: ${query.note}`}
      footer={<Button fullWidth isLoading={answer.isPending} onClick={submit}>Send answer</Button>}
    >
      <form className="grid gap-4" noValidate onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <TextField label="Your answer" maxLength={500} autoComplete="off" error={error} value={reply} onChange={(e) => setReply(e.target.value)} />
      </form>
    </Sheet>
  );
}

function Questions({ groupId }: { groupId: string }) {
  const q = useOpenQueries(groupId);
  const [picked, setPicked] = useState<OpenQuery | null>(null);
  if (q.isError) {
    return (
      <Alert tone="danger" action={<Button size="sm" variant="secondary" onClick={() => void q.refetch()}>Try again</Button>}>
        {friendlyError(q.error)}
      </Alert>
    );
  }
  if (!q.data || q.data.length === 0) return null;
  return (
    <Card>
      <h3 className="text-lg font-semibold text-fg">Questions <span className="tabular font-normal text-muted">({q.data.length})</span></h3>
      <ul role="list" className="mt-1 divide-y divide-line">
        {q.data.map((x) => (
          <li key={x.id} className="flex items-start justify-between gap-3 py-3">
            <span className="min-w-0">
              <span className="block font-semibold text-fg">{x.short_name}</span>
              <span className="block text-sm text-muted">{fieldLabel(x.field)}</span>
              <span className="block text-sm text-fg">{x.note}</span>
              <span className="block text-xs text-muted">{new Date(x.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
            </span>
            <Button size="sm" variant="secondary" aria-label={`Answer ${x.short_name}`} onClick={() => setPicked(x)}>Answer</Button>
          </li>
        ))}
      </ul>
      {picked ? <AnswerSheet query={picked} onClose={() => setPicked(null)} /> : null}
    </Card>
  );
}

/** Open questions from members, for the treasurer. Nothing for a member, and nothing when none are open. */
export function QuestionsCard() {
  const { group, isAdmin } = useGroup();
  return isAdmin ? <Questions groupId={group.id} /> : null;
}
