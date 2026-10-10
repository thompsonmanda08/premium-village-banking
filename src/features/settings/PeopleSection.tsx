import { useState, type FormEvent } from 'react';
import { useGroup } from '@/features/group/GroupContext';
import { formatDate } from '@/lib/format';
import { invokeInvite } from '@/lib/functions';
import { expectRows } from '@/lib/mutate';
import { friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { Alert, Badge, Button, Skeleton, TextField, useConfirmTap, type Tone } from '@/ui';
import { defaultShortName, validateMember } from './memberForm';
import { Section } from './Section';
import { useAction } from './useAction';
import { inviteStatus, useAdminMembers, type AdminMember, type InviteStatus } from './useAdminMembers';

const INVITE_BADGE: Record<InviteStatus, { tone: Tone; label: string } | null> = {
  linked: { tone: 'success', label: 'Joined' },
  pending: { tone: 'warning', label: 'Invite sent' },
  expired: { tone: 'danger', label: 'Invite expired' },
  revoked: { tone: 'neutral', label: 'Invite cancelled' },
  none: { tone: 'neutral', label: 'Not invited' },
};

function AddMember({ groupId }: { groupId: string }) {
  const [fullName, setFullName] = useState('');
  const [shortName, setShortName] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const effectiveShort = shortName.trim() || defaultShortName(fullName);
  const errors = validateMember({ full_name: fullName, short_name: effectiveShort, email: '' });
  const add = useAction(async () => {
    expectRows(await supabase.from('members').insert({ group_id: groupId, full_name: fullName.trim(), short_name: effectiveShort }).select('id'));
  }, 'Member added');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setShowErrors(true);
    if (Object.keys(errors).length > 0) return;
    add.mutate(undefined, { onSuccess: () => { setFullName(''); setShortName(''); setShowErrors(false); } });
  };

  return (
    <details className="rounded-xl border border-line">
      <summary className="flex h-12 cursor-pointer items-center px-4 text-base font-semibold text-accent">Add a member</summary>
      <form className="grid gap-3 px-4 pb-4" noValidate onSubmit={submit}>
        <TextField label="Full name" value={fullName} maxLength={120} onChange={(e) => setFullName(e.target.value)} autoComplete="off" error={showErrors ? errors.full_name : undefined} />
        <TextField
          label="Short name"
          hint="Shown in lists. Defaults to the first name."
          value={shortName}
          maxLength={40}
          onChange={(e) => setShortName(e.target.value)}
          autoComplete="off"
          // A blank full name is already flagged on its own field; the empty default would only repeat it.
          error={showErrors && fullName.trim() ? errors.short_name : undefined}
        />
        <Button type="submit" isLoading={add.isPending} disabled={!fullName.trim()}>Add member</Button>
      </form>
    </details>
  );
}

function MemberRow({ member }: { member: AdminMember }) {
  // Marking yourself left would demote you first, then fail as a non-admin: leaving you demoted but active.
  const isSelf = useGroup().member?.id === member.id;
  const [form, setForm] = useState({ full_name: member.full_name, short_name: member.short_name, email: member.email ?? '', phone: member.phone ?? '' });
  const [showErrors, setShowErrors] = useState(false);
  const errors = validateMember(form);
  const { status, invite } = inviteStatus(member, new Date());
  const badge = INVITE_BADGE[status];
  const isAdmin = member.role === 'admin';
  const active = member.status === 'active';

  const saveDetails = useAction(async () => {
    expectRows(
      await supabase
        .from('members')
        .update({ full_name: form.full_name.trim(), short_name: form.short_name.trim(), email: form.email.trim() || null, phone: form.phone.trim() || null })
        .eq('id', member.id)
        .select('id'),
    );
  }, 'Details saved');
  const setAdmin = useAction(async (make: boolean) => {
    const { error } = await supabase.rpc('set_admin', { p_member_id: member.id, p_make_admin: make });
    if (error) throw error;
  }, (make) => (make ? `${member.short_name} is now an admin` : `${member.short_name} is no longer an admin`));
  const setStatus = useAction(async (next: 'active' | 'left') => {
    // A member who has left must not keep admin rights that reactivating them would silently restore.
    // set_admin runs first so the last-admin refusal stops the whole action.
    if (next === 'left' && isAdmin) {
      const { error } = await supabase.rpc('set_admin', { p_member_id: member.id, p_make_admin: false });
      if (error) throw error;
    }
    expectRows(await supabase.from('members').update({ status: next }).eq('id', member.id).select('id'));
  }, (next) => (next === 'left' ? `${member.short_name} marked as left` : `${member.short_name} is active again`));
  const sendInvite = useAction(() => invokeInvite(member.id, form.email.trim()), `Invite sent to ${form.email.trim()}`);
  const revoke = useAction(async (inviteId: string) => {
    expectRows(await supabase.from('invites').update({ revoked_at: new Date().toISOString() }).eq('id', inviteId).select('id'));
  }, 'Invite cancelled');

  // Destructive actions arm on the first tap and run on the second.
  const demote = useConfirmTap(() => setAdmin.mutate(false));
  const leave = useConfirmTap(() => setStatus.mutate('left'));
  const cancel = useConfirmTap(() => invite && revoke.mutate(invite.id));
  const submitDetails = () => {
    setShowErrors(true);
    if (Object.keys(errors).length === 0) saveDetails.mutate(undefined);
  };
  const submitInvite = () => {
    setShowErrors(true);
    if (!errors.email) sendInvite.mutate(undefined);
  };
  const field = (k: keyof typeof form) => ({ value: form[k], onChange: (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value })) });

  return (
    <details className="rounded-xl border border-line bg-surface">
      <summary className="flex min-h-14 cursor-pointer items-center gap-3 px-4 py-2">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-medium text-fg">{member.full_name}</span>
          {invite && (status === 'pending' || status === 'expired') ? (
            <span className="block truncate text-xs text-muted">
              Sent to {invite.email} · {status === 'pending' ? 'Expires' : 'Expired'} {formatDate(invite.expires_at)}
            </span>
          ) : null}
        </span>
        <span className="flex flex-wrap justify-end gap-1">
          {isAdmin ? <Badge tone="accent">Admin</Badge> : null}
          {!active ? <Badge>Left</Badge> : badge ? <Badge tone={badge.tone}>{badge.label}</Badge> : null}
        </span>
      </summary>
      <div className="grid gap-3 border-t border-line p-4">
        <TextField label="Full name" maxLength={120} {...field('full_name')} error={showErrors ? errors.full_name : undefined} />
        <TextField label="Short name" maxLength={40} {...field('short_name')} error={showErrors ? errors.short_name : undefined} />
        <TextField label="Email" type="email" inputMode="email" {...field('email')} hint="Invites go to this address." error={showErrors ? errors.email : undefined} />
        <TextField label="Phone" type="tel" inputMode="tel" {...field('phone')} />
        <Button variant="secondary" isLoading={saveDetails.isPending} onClick={() => submitDetails()}>Save details</Button>

        {status !== 'linked' && active ? (
          <div className="grid gap-2 rounded-xl bg-surface-2 p-3">
            <Button isLoading={sendInvite.isPending} disabled={!form.email.trim()} onClick={() => submitInvite()}>
              {status === 'none' ? 'Send invite' : 'Send a new invite'}
            </Button>
            {status === 'pending' ? (
              <Button variant={cancel.armed ? 'danger' : 'ghost'} isLoading={revoke.isPending} onClick={cancel.tap}>
                {cancel.armed ? 'Tap again to cancel the invite' : 'Cancel invite'}
              </Button>
            ) : null}
            {!form.email.trim() ? <p className="text-sm text-muted">Add an email address to send an invite.</p> : null}
          </div>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-2">
          {isAdmin ? (
            <Button variant={demote.armed ? 'danger' : 'secondary'} isLoading={setAdmin.isPending} onClick={demote.tap}>
              {demote.armed ? 'Tap again to remove admin' : 'Remove admin'}
            </Button>
          ) : active ? (
            <Button variant="secondary" isLoading={setAdmin.isPending} onClick={() => setAdmin.mutate(true)}>Make admin</Button>
          ) : null}
          {active && isSelf ? (
            <p className="text-sm text-muted">Another admin can mark you as left.</p>
          ) : active ? (
            <Button variant={leave.armed ? 'danger' : 'ghost'} isLoading={setStatus.isPending} onClick={leave.tap}>
              {leave.armed ? 'Tap again to mark as left' : 'Mark as left'}
            </Button>
          ) : (
            <Button variant="ghost" isLoading={setStatus.isPending} onClick={() => setStatus.mutate('active')}>Mark as active again</Button>
          )}
        </div>
      </div>
    </details>
  );
}

export function PeopleSection() {
  const { group } = useGroup();
  const members = useAdminMembers(group.id);
  return (
    <Section title="Members and admins" description="Add members, send invites and choose who can manage the group.">
      <AddMember groupId={group.id} />
      {members.isPending ? (
        <Skeleton className="h-48" />
      ) : members.isError ? (
        <Alert tone="danger" action={<Button size="sm" variant="secondary" onClick={() => void members.refetch()}>Try again</Button>}>
          {friendlyError(members.error)}
        </Alert>
      ) : (
        <ul role="list" className="grid grid-cols-1 gap-2">
          {members.data.map((m) => (
            // Key changes whenever server data changes, so the row's form state resets after a save.
            <li key={`${m.id}:${m.full_name}:${m.short_name}:${m.email ?? ''}:${m.phone ?? ''}:${m.role}:${m.status}`}>
              <MemberRow member={m} />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
