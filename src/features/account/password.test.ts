import { expect, test } from 'vitest';
import { checkPassword } from './password';

test('needs 12 characters', () => expect(checkPassword('short1', 'short1')).toBe('password_too_short'));
test('needs a digit', () => expect(checkPassword('villagebanking', 'villagebanking')).toBe('password_needs_letters_digits'));
test('needs a letter', () => expect(checkPassword('123456789012', '123456789012')).toBe('password_needs_letters_digits'));
test('needs a matching confirmation', () => expect(checkPassword('village2027bank', 'village2027banK')).toBe('password_mismatch'));
test('accepts a good password', () => expect(checkPassword('village2027bank', 'village2027bank')).toBeNull());
