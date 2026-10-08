import { useState } from 'react';
import { useGroup } from '@/features/group/GroupContext';
import { expectRows } from '@/lib/mutate';
import { supabase } from '@/lib/supabase';
import { Button, TextField } from '@/ui';
import { Section } from './Section';
import { useAction } from './useAction';

export function GroupDetailsSection() {
  const { group } = useGroup();
  const [name, setName] = useState(group.name);
  const save = useAction(async (value: string) => {
    expectRows(await supabase.from('groups').update({ name: value }).eq('id', group.id).select('id'));
  }, 'Group name saved');
  const trimmed = name.trim();

  return (
    <Section title="Group">
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (trimmed) save.mutate(trimmed);
        }}
      >
        <TextField label="Group name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} error={!trimmed ? 'Enter a group name.' : undefined} />
        <Button type="submit" isLoading={save.isPending} disabled={!trimmed || trimmed === group.name}>
          Save name
        </Button>
      </form>
    </Section>
  );
}
