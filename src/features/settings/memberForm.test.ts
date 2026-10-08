import { expect, test } from 'vitest';
import { defaultShortName, validateMember } from './memberForm';

const ok = { full_name: 'Charles Banda', short_name: 'Charles', email: 'charles@example.com' };

test('accepts a complete member, with or without an email', () => {
  expect(validateMember(ok)).toEqual({});
  expect(validateMember({ ...ok, email: '' })).toEqual({});
  expect(validateMember({ ...ok, email: '   ' })).toEqual({});
});

test('names cannot be blank or whitespace', () => {
  expect(validateMember({ ...ok, full_name: '  ' }).full_name).toBeDefined();
  expect(validateMember({ ...ok, short_name: '' }).short_name).toBeDefined();
});

test('mirrors the database length limits: 120 for the full name, 40 for the short name', () => {
  expect(validateMember({ ...ok, full_name: 'a'.repeat(120) }).full_name).toBeUndefined();
  expect(validateMember({ ...ok, full_name: 'a'.repeat(121) }).full_name).toBeDefined();
  expect(validateMember({ ...ok, short_name: 'a'.repeat(40) }).short_name).toBeUndefined();
  expect(validateMember({ ...ok, short_name: 'a'.repeat(41) }).short_name).toBeDefined();
});

test('an email, if given, needs a name, an @ and a dotted domain', () => {
  for (const bad of ['charles', 'charles@', '@example.com', 'charles@example', 'cha rles@example.com']) {
    expect(validateMember({ ...ok, email: bad }).email, bad).toBeDefined();
  }
});

test('the short name defaults to the first word of the full name', () => {
  expect(defaultShortName('  Sapi   Mulimbika ')).toBe('Sapi');
  expect(defaultShortName('')).toBe('');
});
