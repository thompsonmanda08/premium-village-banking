import { expect, test } from 'vitest';
import { inviteStatus } from './useAdminMembers';

const now = new Date('2026-10-08T12:00:00Z');
const inv = (over: Partial<{ created_at: string; expires_at: string; accepted_at: string | null; revoked_at: string | null }>) => ({
  id: 'i', email: 'a@b.co', created_at: '2026-10-01T00:00:00Z', expires_at: '2026-10-15T00:00:00Z', accepted_at: null, revoked_at: null, ...over,
});

test('linked account wins', () => expect(inviteStatus({ user_id: 'u', invites: [] }, now).status).toBe('linked'));
test('no invite yet', () => expect(inviteStatus({ user_id: null, invites: [] }, now).status).toBe('none'));
test('pending', () => expect(inviteStatus({ user_id: null, invites: [inv({})] }, now).status).toBe('pending'));
test('expired', () => expect(inviteStatus({ user_id: null, invites: [inv({ expires_at: '2026-10-08T11:59:00Z' })] }, now).status).toBe('expired'));
test('revoked', () => expect(inviteStatus({ user_id: null, invites: [inv({ revoked_at: '2026-10-02T00:00:00Z' })] }, now).status).toBe('revoked'));
test('latest invite decides', () => {
  const old = inv({ created_at: '2026-09-01T00:00:00Z', revoked_at: '2026-09-02T00:00:00Z' });
  const fresh = inv({ created_at: '2026-10-05T00:00:00Z' });
  expect(inviteStatus({ user_id: null, invites: [fresh, old] }, now)).toEqual({ status: 'pending', invite: fresh });
});
