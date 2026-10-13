const GENERIC = 'Something went wrong. Please try again.';
const BAD_LOGIN = 'That email and password don’t match.';
const NO_ACCOUNT = 'We couldn’t find an account for that email. Ask your treasurer for an invite.';
const UNCONFIRMED = 'Confirm your email address first, using the link we sent you.';
const NEW_PASSWORD = 'Choose a password you haven’t used before.';
const TOO_MANY = 'Too many attempts. Please wait a minute and try again.';
const OFFLINE = 'You seem to be offline. Check your connection and try again.';
const CONFIRM_WITH_CODE = 'For your security, enter the code we emailed you to confirm this change.';

// Keyed by SQL business code, Edge Function code, supabase-js AuthError code, or (older shapes) exact message text.
const KNOWN: Record<string, string> = {
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
  already_in_group: 'You\u2019re already a member of a group. Each person can only belong to one group.',
  already_bootstrapped: 'This group has already been set up.',
  owner_member_not_found: 'The group owner could not be found. Contact support.',
  rules_locked: 'Rules can only change before the cycle starts.',
  // ledger (sub-project 2a)
  period_not_open: 'That month isn’t open. Pick the current month, or open it first.',
  previous_period_open: 'Close the previous month first.',
  declarations_pending: 'Some declarations are still waiting. Approve or return them first.',
  app_update_needed: 'A newer version of the app is ready. Reload this page and try again.',
  nothing_to_export: 'There is nothing to export yet.',
  no_group_statement: 'This month’s statement is missing, so it can’t be exported.',
  not_exportable: 'Only closed months and the open month can be exported.',
  loans_closed: 'No new loans in the last month of the cycle.',
  insufficient_cash: 'There isn’t enough lending cash for this loan right now.',
  over_cap_needs_reason: 'This loan is over the member’s limit. Add a reason to send it anyway.',
  reason_required: 'Add a reason first.',
  entry_not_found: 'That record couldn’t be found. Refresh and try again.',
  already_closed: 'This month is already closed.',
  unexplained_differences: 'Some differences from the workbook aren’t explained. Add a reason to close the month anyway.',
  already_opened: 'That month has already been opened.',
  invalid_amount: 'Check the amount: kwacha and ngwee only, and not below zero.',
  invalid_date: 'Pick a date in that month or later.',
  wallet_not_found: 'Choose one of the group’s wallets.',
  declaration_not_found: 'That declaration was already handled or replaced. Refresh and try again.',
  append_only: 'Ledger records can’t be changed. Post a correction instead.',
  cycle_overlap: 'Another cycle already covers these dates. Check the dates, or close that cycle first.',
  invalid_note: 'Keep the note or reason to 500 characters or fewer.',
  invalid_body: 'That request wasn’t valid. Please try again.',
  invalid_email: 'Enter a valid email address.',
  invalid_member: 'That member could not be found.',
  invite_failed: 'The invite could not be sent. Please try again.',
  invite_in_progress: 'An invite is already being sent. Wait a moment and try again.',
  invalid_credentials: BAD_LOGIN,
  email_not_confirmed: UNCONFIRMED,
  over_email_send_rate_limit: TOO_MANY,
  over_request_rate_limit: TOO_MANY,
  same_password: NEW_PASSWORD,
  weak_password: 'Choose a password of at least 12 characters, with letters and numbers.',
  // account page: the same password rules checked on the phone, and the emailed code a password change can ask for
  password_too_short: 'Use at least 12 characters.',
  password_needs_letters_digits: 'Use both letters and numbers.',
  password_mismatch: 'The passwords don’t match.',
  reauthentication_needed: CONFIRM_WITH_CODE,
  reauth_nonce_missing: CONFIRM_WITH_CODE,
  reauthentication_not_valid: 'That code isn’t right or has expired. Check your email, or go back to get a new code.',
  otp_disabled: NO_ACCOUNT,
  // sign-in screens and the auth callback (the callback also passes the provider's error_code through here)
  email_required: 'Enter your email address.',
  password_required: 'Enter your password.',
  signup_disabled: 'This account isn’t invited yet. Ask your treasurer for an invite.',
  access_denied: 'Sign-in was cancelled. You can try again.',
  otp_expired: 'This sign-in link has expired or was already used. Request a new one.',
  callback_failed: 'We couldn’t finish signing you in. Please try again.',
  'Invalid login credentials': BAD_LOGIN,
  'Signups not allowed for otp': NO_ACCOUNT,
  'Email not confirmed': UNCONFIRMED,
  'New password should be different from the old password.': NEW_PASSWORD,
};

// hasOwn: a code or message like "constructor" must not resolve to an Object.prototype member.
const known = (key: unknown): string | undefined => (typeof key === 'string' && Object.hasOwn(KNOWN, key) ? KNOWN[key] : undefined);

type ErrorLike = { message?: unknown; code?: unknown; status?: unknown; name?: unknown };

/** The only place user-facing error text comes from. Never returns a raw error message. */
export function friendlyError(err: unknown): string {
  if (!err || typeof err !== 'object') return GENERIC;
  const { message, code, status, name } = err as ErrorLike;
  const msg = typeof message === 'string' ? message : '';
  const hit = known(code) ?? known(msg);
  if (hit) return hit;
  if (status === 429 || /rate limit/i.test(msg)) return TOO_MANY;
  if (code === '42501') return KNOWN.not_admin ?? GENERIC;
  if (code === '23505') return 'That name is already used in this group.';
  // A check constraint (blank or over-long name, malformed email): retrying the same input can never succeed.
  if (code === '23514') return 'Some details aren’t valid. Check the name, short name and email.';
  if (status === 401 || code === 'PGRST301' || code === 'PGRST303') return 'Your session has expired. Please sign in again.';
  // Offline, or the 20 s request timeout / an abort (supabase-js wraps those as "TimeoutError: …" or "…timed out").
  if (name === 'TimeoutError' || name === 'AbortError' || /failed to fetch|networkerror|load failed|timed out|timeouterror|aborterror|operation was aborted/i.test(msg)) return OFFLINE;
  return GENERIC;
}
