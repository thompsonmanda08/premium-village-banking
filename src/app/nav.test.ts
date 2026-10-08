import { expect, test } from 'vitest';
import { bottomNav, moreItems, sidebarItems } from './nav';

const keys = (items: { key: string }[]) => items.map((i) => i.key);

test('members: Home, Passbook, Declare, Plan in the bottom nav', () => {
  expect(keys(bottomNav(false))).toEqual(['home', 'passbook', 'declare', 'plan']);
  expect(keys(moreItems(false))).toEqual(['record', 'group', 'rules', 'account']);
});

test('admins: Desk replaces Plan, Plan moves into More', () => {
  expect(keys(bottomNav(true))).toEqual(['home', 'passbook', 'declare', 'desk']);
  expect(keys(moreItems(true))).toEqual(['record', 'group', 'plan', 'rules', 'account']);
});

test('sidebar shows Desk only to admins', () => {
  expect(keys(sidebarItems(false))).not.toContain('desk');
  expect(keys(sidebarItems(true))).toContain('desk');
});
