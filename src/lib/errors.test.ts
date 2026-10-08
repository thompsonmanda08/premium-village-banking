import { expect, test } from 'vitest';
import { friendlyError } from './errors';

const GENERIC = 'Something went wrong. Please try again.';

test('maps SQL business codes', () => {
  expect(friendlyError({ message: 'last_admin', code: 'P0001' })).toBe('The group needs at least one admin. Make someone else an admin first.');
  expect(friendlyError({ message: 'email_mismatch' })).toBe('This invite was sent to a different email address. Sign in with that address.');
  expect(friendlyError(new Error('rules_locked'))).toBe('Rules can only change before the cycle starts.');
});

test('maps permission errors', () => {
  expect(friendlyError({ code: '42501', message: 'new row violates row-level security policy for table "members"' })).toBe('Only admins can do this.');
});

test('maps auth messages', () => {
  expect(friendlyError({ message: 'Invalid login credentials', status: 400 })).toBe('That email and password don’t match.');
  expect(friendlyError({ message: 'Signups not allowed for otp', status: 422 })).toBe('We couldn’t find an account for that email. Ask your treasurer for an invite.');
  expect(friendlyError({ message: 'email rate limit exceeded', status: 429 })).toBe('Too many attempts. Please wait a minute and try again.');
});

test('maps network failures', () => {
  expect(friendlyError(new TypeError('Failed to fetch'))).toBe('You seem to be offline. Check your connection and try again.');
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
];
const FUNCTION_CODES = ['invalid_body', 'invalid_member', 'invalid_email', 'not_signed_in', 'not_admin', 'member_taken', 'member_not_active', 'invite_failed'];

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
