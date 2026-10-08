import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/lib/database.types';

export type InviteLite = Pick<Tables<'invites'>, 'id' | 'email' | 'expires_at' | 'accepted_at' | 'revoked_at' | 'created_at'>;
export type AdminMember = Tables<'members'> & { invites: InviteLite[] };
export type InviteStatus = 'linked' | 'pending' | 'expired' | 'revoked' | 'none';

export function inviteStatus(m: { user_id: string | null; invites: InviteLite[] }, now: Date): { status: InviteStatus; invite: InviteLite | null } {
  if (m.user_id) return { status: 'linked', invite: null };
  const latest = [...m.invites].sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
  if (!latest) return { status: 'none', invite: null };
  if (latest.accepted_at) return { status: 'linked', invite: latest };
  if (latest.revoked_at) return { status: 'revoked', invite: latest };
  if (new Date(latest.expires_at) <= now) return { status: 'expired', invite: latest };
  return { status: 'pending', invite: latest };
}

export function useAdminMembers(groupId: string) {
  return useQuery({
    queryKey: ['admin-members', groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('members')
        .select('*, invites(id, email, expires_at, accepted_at, revoked_at, created_at)')
        .eq('group_id', groupId)
        .order('full_name');
      if (error) throw error;
      return data as unknown as AdminMember[];
    },
  });
}
