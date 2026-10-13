import { expect, test } from 'vitest';
import { friendlyError } from './errors';

const GENERIC = 'Something went wrong. Please try again.';
const CONFIRM = 'For your security, enter the code we emailed you to confirm this change.';

test('maps SQL business codes', () => {
  expect(friendlyError({ message: 'last_admin', code: 'P0001' })).toBe('The group needs at least one admin. Make someone else an admin first.');
  expect(friendlyError({ message: 'email_mismatch' })).toBe('This invite was sent to a different email address. Sign in with that address.');
  expect(friendlyError(new Error('rules_locked'))).toBe('Rules can only change before the cycle starts.');
});

test('ledger refusals say what to do next', () => {
  expect(friendlyError({ message: 'insufficient_cash', code: 'P0001' })).toBe('There isn’t enough lending cash for this loan right now.');
  expect(friendlyError({ message: 'over_cap_needs_reason', code: 'P0001' })).toBe(
    'This loan is over the member’s limit. Add a reason to send it anyway.',
  );
  expect(friendlyError({ message: 'unexplained_differences', code: 'P0001' })).toBe(
    'Some differences from the workbook aren’t explained. Add a reason to close the month anyway.',
  );
});

test('maps permission errors', () => {
  expect(friendlyError({ code: '42501', message: 'new row violates row-level security policy for table "members"' })).toBe('Only admins can do this.');
});

test('an invalid or expired JWT is a session problem, not a permission one', () => {
  const expired = 'Your session has expired. Please sign in again.';
  expect(friendlyError({ code: 'PGRST301', message: 'JWT expired' })).toBe(expired);
  expect(friendlyError({ code: 'PGRST303', message: 'JWT issued at future' })).toBe(expired);
  expect(friendlyError({ status: 401, message: 'Unauthorized' })).toBe(expired);
});

test('maps auth messages', () => {
  expect(friendlyError({ message: 'Invalid login credentials', status: 400 })).toBe('That email and password don’t match.');
  expect(friendlyError({ message: 'Signups not allowed for otp', status: 422 })).toBe('We couldn’t find an account for that email. Ask your treasurer for an invite.');
  expect(friendlyError({ message: 'email rate limit exceeded', status: 429 })).toBe('Too many attempts. Please wait a minute and try again.');
});

test('maps network failures', () => {
  expect(friendlyError(new TypeError('Failed to fetch'))).toBe('You seem to be offline. Check your connection and try again.');
});

test('a timed-out or aborted request reads as a slow or missing connection', () => {
  const offline = 'You seem to be offline. Check your connection and try again.';
  expect(friendlyError(new DOMException('The request timed out', 'TimeoutError'))).toBe(offline);
  expect(friendlyError(new DOMException('signal is aborted without reason', 'AbortError'))).toBe(offline);
  // supabase-js wraps the fetch failure: PostgREST prefixes the error name, Auth keeps the bare message.
  expect(friendlyError({ message: 'TimeoutError: The request timed out', code: '' })).toBe(offline);
  expect(friendlyError({ message: 'AbortError: This operation was aborted', code: '' })).toBe(offline);
  expect(friendlyError({ message: 'signal timed out', status: 0, name: 'AuthRetryableFetchError' })).toBe(offline);
});

test('never leaks raw errors', () => {
  expect(friendlyError({ message: 'duplicate key value violates unique constraint "members_group_id_short_name_key"', code: '23505' })).toBe('That name is already used in this group.');
  expect(friendlyError('weird')).toBe(GENERIC);
  expect(friendlyError(undefined)).toBe(GENERIC);
});

// Every code the database or the invite-member Edge Function can raise has its own sentence.
const SQL_CODES = [
  'invite_not_found', 'invite_expired', 'invite_revoked', 'invite_used', 'email_mismatch', 'already_linked',
  'member_taken', 'member_not_active', 'member_not_found', 'last_admin', 'not_admin', 'not_signed_in',
  'already_bootstrapped', 'owner_member_not_found',
  // ledger (sub-project 2a)
  'period_not_open', 'previous_period_open', 'declarations_pending', 'loans_closed', 'insufficient_cash',
  'over_cap_needs_reason', 'reason_required', 'entry_not_found', 'already_closed', 'unexplained_differences',
  'already_opened', 'invalid_amount', 'invalid_date', 'wallet_not_found', 'declaration_not_found', 'append_only',
  'cycle_overlap', 'invalid_note',
];
const FUNCTION_CODES = [
  'invalid_body', 'invalid_member', 'invalid_email', 'not_signed_in', 'not_admin', 'member_taken', 'member_not_active', 'invite_failed',
  'invite_in_progress',
];

test.each([...new Set([...SQL_CODES, ...FUNCTION_CODES])])('has a friendly sentence for %s', (code) => {
  for (const err of [{ message: code, code: 'P0001' }, new Error(code), Object.assign(new Error(code), { code })]) {
    const text = friendlyError(err);
    expect(text).not.toBe(GENERIC);
    expect(text).not.toContain(code);
    expect(text).not.toMatch(/_/);
  }
});

test('falls back to a generic sentence for anything unknown', () => {
  for (const err of [
    { message: 'relation "members" does not exist', code: '42P01' },
    { message: 'some_future_code', code: 'P0001' },
    new Error('boom'),
    null,
    42,
    {},
  ]) {
    expect(friendlyError(err)).toBe(GENERIC);
  }
});

// supabase-js auth errors carry a stable `code`; their message text is not a contract and has changed between releases.
const AUTH_CODES: Record<string, string> = {
  invalid_credentials: 'That email and password don’t match.',
  email_not_confirmed: 'Confirm your email address first, using the link we sent you.',
  over_email_send_rate_limit: 'Too many attempts. Please wait a minute and try again.',
  over_request_rate_limit: 'Too many attempts. Please wait a minute and try again.',
  same_password: 'Choose a password you haven’t used before.',
  weak_password: 'Choose a password of at least 12 characters, with letters and numbers.',
  // account page: the same password rules checked on the phone, and the emailed code for a password change
  password_too_short: 'Use at least 12 characters.',
  password_needs_letters_digits: 'Use both letters and numbers.',
  password_mismatch: 'The passwords don’t match.',
  reauthentication_needed: CONFIRM,
  reauth_nonce_missing: CONFIRM,
  reauthentication_not_valid: 'That code isn’t right or has expired. Check your email, or go back to get a new code.',
  otp_disabled: 'We couldn’t find an account for that email. Ask your treasurer for an invite.',
  // sign-in screens and the auth callback
  email_required: 'Enter your email address.',
  password_required: 'Enter your password.',
  signup_disabled: 'This account isn’t invited yet. Ask your treasurer for an invite.',
  access_denied: 'Sign-in was cancelled. You can try again.',
  otp_expired: 'This sign-in link has expired or was already used. Request a new one.',
  callback_failed: 'We couldn’t finish signing you in. Please try again.',
};

test.each(Object.entries(AUTH_CODES))('maps auth error code %s whatever the message says', (code, sentence) => {
  expect(friendlyError({ code, message: 'Some reworded upstream message', status: 400 })).toBe(sentence);
  expect(friendlyError({ code, message: '' })).toBe(sentence);
});

test('a double-tapped invite asks for a moment, and a mail rate limit reads as too many attempts', () => {
  expect(friendlyError({ message: 'invite_in_progress' })).toBe('An invite is already being sent. Wait a moment and try again.');
  expect(friendlyError(Object.assign(new Error('over_email_send_rate_limit'), { code: 'over_email_send_rate_limit' }))).toBe(
    'Too many attempts. Please wait a minute and try again.',
  );
});

test('an error code in the table wins over message-text matching', () => {
  expect(friendlyError({ code: 'invalid_credentials', message: 'Failed to fetch' })).toBe('That email and password don’t match.');
});

test('names that exist on Object.prototype are not table hits', () => {
  for (const name of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
    expect(friendlyError({ message: name })).toBe(GENERIC);
    expect(friendlyError({ code: name, message: 'x' })).toBe(GENERIC);
  }
});

test('a check-constraint refusal says which details to fix, since a retry cannot succeed', () => {
  const text = friendlyError({ code: '23514', message: 'new row for relation "members" violates check constraint "members_short_name_check"' });
  expect(text).toBe('Some details aren’t valid. Check the name, short name and email.');
  expect(text).not.toBe(GENERIC);
});

test('export refusals say what is wrong, not “something went wrong”', () => {
  expect(friendlyError(new Error('nothing_to_export'))).toBe('There is nothing to export yet.');
  expect(friendlyError(new Error('no_group_statement'))).toBe('This month’s statement is missing, so it can’t be exported.');
  expect(friendlyError(new Error('not_exportable'))).toBe('Only closed months and the open month can be exported.');
});
