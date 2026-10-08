const GENERIC = 'Something went wrong. Please try again.';

const BY_MESSAGE: Record<string, string> = {
  invite_not_found: 'This invite link isn’t valid. Ask your treasurer for a new one.',
  invite_expired: 'This invite has expired. Ask your treasurer to send a new one.',
  invite_revoked: 'This invite was cancelled. Ask your treasurer for a new one.',
  invite_used: 'This invite has already been used. Sign in instead.',
  email_mismatch: 'This invite was sent to a different email address. Sign in with that address.',
  already_linked: 'Your account is already linked to another member of this group.',
  member_taken: 'This member is already linked to another account.',
  member_not_active: 'Only active members can do this.',
  member_not_found: 'That member no longer exists.',
  last_admin: 'The group needs at least one admin. Make someone else an admin first.',
  not_admin: 'Only admins can do this.',
  not_signed_in: 'Please sign in again.',
  already_bootstrapped: 'This group has already been set up.',
  owner_member_not_found: 'The group owner could not be found. Contact support.',
  rules_locked: 'Rules can only change before the cycle starts.',
  invalid_body: 'That request wasn’t valid. Please try again.',
  invalid_email: 'Enter a valid email address.',
  invalid_member: 'That member could not be found.',
  invite_failed: 'The invite could not be sent. Please try again.',
  'Invalid login credentials': 'That email and password don’t match.',
  'Signups not allowed for otp': 'We couldn’t find an account for that email. Ask your treasurer for an invite.',
  'Email not confirmed': 'Confirm your email address first, using the link we sent you.',
  'New password should be different from the old password.': 'Choose a password you haven’t used before.',
};

type ErrorLike = { message?: unknown; code?: unknown; status?: unknown };

/** The only place user-facing error text comes from. Never returns a raw error message. */
export function friendlyError(err: unknown): string {
  if (!err || typeof err !== 'object') return GENERIC;
  const { message, code, status } = err as ErrorLike;
  const msg = typeof message === 'string' ? message : '';
  // hasOwn: a message like "constructor" must not resolve to an Object.prototype member.
  if (Object.hasOwn(BY_MESSAGE, msg)) return BY_MESSAGE[msg] ?? GENERIC;
  if (status === 429 || /rate limit/i.test(msg)) return 'Too many attempts. Please wait a minute and try again.';
  if (code === '42501' || code === 'PGRST301') return BY_MESSAGE.not_admin ?? GENERIC;
  if (code === '23505') return 'That name is already used in this group.';
  if (status === 401 || code === 'PGRST303') return 'Your session has expired. Please sign in again.';
  if (/failed to fetch|networkerror|load failed/i.test(msg)) return 'You seem to be offline. Check your connection and try again.';
  return GENERIC;
}
