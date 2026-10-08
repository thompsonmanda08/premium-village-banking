import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';
import { beforeEach, expect, test, vi } from 'vitest';

const invoke = vi.fn();
vi.mock('./supabase', () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));

const { invokeInvite } = await import('./functions');

beforeEach(() => {
  invoke.mockReset();
});

const httpError = (status: number, body: unknown) =>
  new FunctionsHttpError(new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }));
const failsWith = async (code: string) => {
  const err = await invokeInvite('m1', 'a@b.co').catch((e: unknown) => e);
  expect(err).toBeInstanceOf(Error);
  expect(err).toMatchObject({ message: code, code });
};

test('returns the expiry on success and sends the member and email', async () => {
  invoke.mockResolvedValue({ data: { ok: true, expiresAt: '2026-10-15T00:00:00Z' }, error: null });
  await expect(invokeInvite('m1', 'a@b.co')).resolves.toEqual({ expiresAt: '2026-10-15T00:00:00Z' });
  expect(invoke).toHaveBeenCalledWith('invite-member', { body: { memberId: 'm1', email: 'a@b.co' } });
});

test("throws the function's own error code", async () => {
  invoke.mockResolvedValue({ data: null, error: httpError(403, { error: 'not_admin' }) });
  await failsWith('not_admin');
});

test('maps a gateway 401 (no error field) to not_signed_in', async () => {
  invoke.mockResolvedValue({ data: null, error: httpError(401, { code: 401, message: 'Invalid JWT' }) });
  await failsWith('not_signed_in');
});

test('ignores a non-string error field', async () => {
  invoke.mockResolvedValue({ data: null, error: httpError(500, { error: { message: 'boom' } }) });
  await failsWith('invite_failed');
  invoke.mockResolvedValue({ data: null, error: httpError(400, { error: 42 }) });
  await failsWith('invite_failed');
});

test('an unreadable body is invite_failed, except for a 401', async () => {
  invoke.mockResolvedValue({ data: null, error: httpError(502, 'Bad gateway <html>') });
  await failsWith('invite_failed');
  invoke.mockResolvedValue({ data: null, error: httpError(401, 'Unauthorized') });
  await failsWith('not_signed_in');
});

test('a network failure is invite_failed', async () => {
  invoke.mockResolvedValue({ data: null, error: new FunctionsFetchError(new TypeError('Failed to fetch')) });
  await failsWith('invite_failed');
});

test('a relay error and an empty response are invite_failed', async () => {
  invoke.mockResolvedValue({ data: null, error: new FunctionsRelayError(new Response('', { status: 546 })) });
  await failsWith('invite_failed');
  invoke.mockResolvedValue({ data: null, error: null });
  await failsWith('invite_failed');
});
