import { expect, test } from 'vitest';
import { pickMembership, type GroupRow, type MemberRow } from './useMembership';

const g = (id: string, name: string, owner = 'someone'): GroupRow => ({ id, name, currency: 'ZMW', owner_user_id: owner, figures_visibility: 'open' });
const m = (over: Partial<MemberRow>): MemberRow => ({ id: 'm1', group_id: 'g1', full_name: 'Tafara', short_name: 'Tafara', role: 'member', status: 'active', email: null, ...over });

test('member of a group', () => {
  const res = pickMembership('u1', [{ ...m({}), groups: g('g1', 'Premium') }], []);
  expect(res?.group.name).toBe('Premium');
  expect(res?.member?.short_name).toBe('Tafara');
  expect(res?.isAdmin).toBe(false);
});

test('admin role makes an admin', () => {
  expect(pickMembership('u1', [{ ...m({ role: 'admin' }), groups: g('g1', 'Premium') }], [])?.isAdmin).toBe(true);
});

test('group owner is admin even as a plain member', () => {
  expect(pickMembership('u1', [{ ...m({}), groups: g('g1', 'Premium', 'u1') }], [])?.isAdmin).toBe(true);
});

test('owner without a member row still gets the group', () => {
  const res = pickMembership('u1', [], [g('g1', 'Premium', 'u1')]);
  expect(res).toEqual({ group: g('g1', 'Premium', 'u1'), member: null, isAdmin: true });
});

test('members who left are ignored', () => {
  expect(pickMembership('u1', [{ ...m({ status: 'left' }), groups: g('g1', 'Premium') }], [])).toBeNull();
});

test('no group at all', () => expect(pickMembership('u1', [], [])).toBeNull());
