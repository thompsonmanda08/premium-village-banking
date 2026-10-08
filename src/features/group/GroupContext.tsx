import { createContext, useContext } from 'react';
import type { Membership } from './useMembership';

const GroupContext = createContext<Membership | null>(null);
export const GroupProvider = GroupContext.Provider;

export function useGroup(): Membership {
  const value = useContext(GroupContext);
  if (!value) throw new Error('useGroup must be used inside RequireMembership');
  return value;
}
