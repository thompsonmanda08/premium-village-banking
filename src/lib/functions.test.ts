import { beforeEach, expect, test, vi } from 'vitest';

const getSession = vi.fn();
vi.mock('./supabase', () => ({ supabase: { auth: { getSession: () => getSession() } } }));
const doFetch = vi.fn();
vi.stubGlobal('fetch', (...a: unknown[]) => doFetch(...a));

const { invokeInvite } = await import('./functions');

beforeEach(() => {
  getSession.mockReset().mockResolvedValue({ data: { session: { access_token: 'tok' } } });
  doFetch.mockReset();
});

const reply = (status: number, body: unknown) =>
  doFetch.mockResolvedValue(new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }));
const failsWith = async (code: string) => {
  const err = await invokeInvite('m1', 'a@b.co').catch((e: unknown) => e);
  expect(err).toBeInstanceOf(Error);
  expect(err).toMatchObject({ message: code, code });
};

test('returns the expiry on success and sends the member and email with the session token', async () => {
  reply(200, { ok: true, expiresAt: '2026-10-15T00:00:00Z' });
  await expect(invokeInvite('m1', 'a@b.co')).resolves.toEqual({ expiresAt: '2026-10-15T00:00:00Z' });
  expect(doFetch).toHaveBeenCalledWith('/api/invite-member', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok' },
    body: JSON.stringify({ memberId: 'm1', email: 'a@b.co' }),
  });
});

test('no session is not_signed_in, without calling the server', async () => {
  getSession.mockResolvedValue({ data: { session: null } });
  await failsWith('not_signed_in');
  expect(doFetch).not.toHaveBeenCalled();
});

test("throws the function's own error code", async () => {
  reply(403, { error: 'not_admin' });
  await failsWith('not_admin');
  reply(429, { error: 'over_email_send_rate_limit' });
  await failsWith('over_email_send_rate_limit');
  reply(409, { error: 'invite_in_progress' });
  await failsWith('invite_in_progress');
});

test('ignores a non-string error field', async () => {
  reply(500, { error: { message: 'boom' } });
  await failsWith('invite_failed');
  reply(400, { error: 42 });
  await failsWith('invite_failed');
});

test('an unreadable body is invite_failed, except for a 401', async () => {
  reply(502, 'Bad gateway <html>');
  await failsWith('invite_failed');
  reply(401, 'Unauthorized');
  await failsWith('not_signed_in');
});

test('a network failure, or an ok reply with no expiry, is invite_failed', async () => {
  doFetch.mockRejectedValue(new TypeError('Failed to fetch'));
  await failsWith('invite_failed');
  reply(200, { ok: true });
  await failsWith('invite_failed');
});
