import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/lib/database.types';

export type GroupRow = Pick<Tables<'groups'>, 'id' | 'name' | 'currency' | 'owner_user_id' | 'figures_visibility'>;
export type MemberRow = Pick<Tables<'members'>, 'id' | 'group_id' | 'full_name' | 'short_name' | 'role' | 'status' | 'email'>;
export type Membership = { group: GroupRow; member: MemberRow | null; isAdmin: boolean };
type MemberWithGroup = MemberRow & { groups: GroupRow | null };

const GROUP_COLUMNS = 'id, name, currency, owner_user_id, figures_visibility';

export function pickMembership(uid: string, rows: MemberWithGroup[], owned: GroupRow[]): Membership | null {
  const linked = rows
    .filter((r): r is MemberWithGroup & { groups: GroupRow } => r.status === 'active' && r.groups !== null)
    .sort((a, b) => a.groups.name.localeCompare(b.groups.name));
  const first = linked[0];
  if (first) {
    const { groups, ...member } = first;
    return { group: groups, member, isAdmin: member.role === 'admin' || groups.owner_user_id === uid };
  }
  const own = [...owned].sort((a, b) => a.name.localeCompare(b.name))[0];
  return own ? { group: own, member: null, isAdmin: true } : null;
}

export function useMembership(uid: string | undefined) {
  return useQuery({
    queryKey: ['membership', uid],
    enabled: Boolean(uid),
    queryFn: async () => {
      const [mine, owned] = await Promise.all([
        supabase
          .from('members')
          .select(`id, group_id, full_name, short_name, role, status, email, groups (${GROUP_COLUMNS})`)
          .eq('user_id', uid!),
        supabase.from('groups').select(GROUP_COLUMNS).eq('owner_user_id', uid!),
      ]);
      if (mine.error) throw mine.error;
      if (owned.error) throw owned.error;
      return pickMembership(uid!, mine.data as unknown as MemberWithGroup[], owned.data);
    },
  });
}
