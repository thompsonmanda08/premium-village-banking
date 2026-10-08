import { expect, test } from 'vitest';
import { decideAccess } from './access';

test('waits while the session loads', () => expect(decideAccess(true, false)).toBe('wait'));
test('sends signed-out visitors to sign in', () => expect(decideAccess(false, false)).toBe('sign-in'));
test('lets signed-in users through when membership is not required', () => expect(decideAccess(false, true)).toBe('ok'));
test('waits for membership', () => expect(decideAccess(false, true, 'loading')).toBe('wait'));
test('shows the no-group screen', () => expect(decideAccess(false, true, 'none')).toBe('no-group'));
test('shows an error with retry', () => expect(decideAccess(false, true, 'error')).toBe('error'));
test('lets members in', () => expect(decideAccess(false, true, 'found')).toBe('ok'));
test('signed-out beats membership state', () => expect(decideAccess(false, false, 'found')).toBe('sign-in'));
