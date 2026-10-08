export type MembershipState = 'loading' | 'error' | 'none' | 'found';
export type Access = 'wait' | 'sign-in' | 'error' | 'no-group' | 'ok';

export function decideAccess(sessionLoading: boolean, hasSession: boolean, membership?: MembershipState): Access {
  if (sessionLoading) return 'wait';
  if (!hasSession) return 'sign-in';
  if (membership === undefined || membership === 'found') return 'ok';
  if (membership === 'loading') return 'wait';
  if (membership === 'error') return 'error';
  return 'no-group';
}
