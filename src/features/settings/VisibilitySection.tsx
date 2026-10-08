import { useState } from 'react';
import { useGroup } from '@/features/group/GroupContext';
import { expectRows } from '@/lib/mutate';
import { supabase } from '@/lib/supabase';
import { Button, cn, useConfirmTap } from '@/ui';
import { Section } from './Section';
import { useAction } from './useAction';

const OPTIONS = [
  { value: 'open', title: 'Everyone in the group', body: 'Members can see each other’s savings and loans, as the group does today.' },
  { value: 'private', title: 'Only the member and admins', body: 'Members see their own figures and group totals. Admins see everything.' },
] as const;

export function VisibilitySection() {
  const { group } = useGroup();
  const [choice, setChoice] = useState(group.figures_visibility);
  const save = useAction(
    async (value: string) => {
      expectRows(await supabase.from('groups').update({ figures_visibility: value }).eq('id', group.id).select('id'));
    },
    (value) => (value === 'private' ? 'Figures are now private' : 'Figures are now visible to everyone'),
  );
  const confirm = useConfirmTap(() => save.mutate(choice));
  const changed = choice !== group.figures_visibility;

  return (
    <Section title="Who can see member figures" description="Applies to savings, loans and statements once the ledger is live. Changes are recorded in the audit log.">
      <fieldset className="grid gap-2">
        <legend className="sr-only">Who can see member figures</legend>
        {OPTIONS.map((o) => (
          <label
            key={o.value}
            className={cn('grid min-h-12 cursor-pointer grid-cols-[auto_1fr] gap-x-3 rounded-xl border p-3.5 transition', choice === o.value ? 'border-accent bg-accent-soft' : 'border-line bg-surface')}
          >
            <input type="radio" name="figures" value={o.value} checked={choice === o.value} onChange={() => { setChoice(o.value); confirm.reset(); }} className="row-span-2 mt-1 size-4 accent-current" />
            <span className="text-base font-semibold text-fg">{o.title}</span>
            <span className="col-start-2 text-sm text-muted">{o.body}</span>
          </label>
        ))}
      </fieldset>
      {changed ? (
        <Button fullWidth variant={confirm.armed ? 'danger' : 'primary'} isLoading={save.isPending} onClick={confirm.tap}>
          {confirm.armed ? 'Tap again to confirm' : choice === 'private' ? 'Make figures private' : 'Make figures visible to everyone'}
        </Button>
      ) : null}
    </Section>
  );
}
