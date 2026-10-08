import { expect, test } from 'vitest';
import { shouldShowInstallHint } from './InstallHint';

const base = { standalone: false, dismissed: false, canPrompt: false, isIOS: false };

test('shows when Android can prompt', () => expect(shouldShowInstallHint({ ...base, canPrompt: true })).toBe(true));
test('shows instructions on iOS', () => expect(shouldShowInstallHint({ ...base, isIOS: true })).toBe(true));
test('hidden once installed', () => expect(shouldShowInstallHint({ ...base, canPrompt: true, standalone: true })).toBe(false));
test('hidden once dismissed', () => expect(shouldShowInstallHint({ ...base, isIOS: true, dismissed: true })).toBe(false));
test('hidden on desktop browsers that cannot install', () => expect(shouldShowInstallHint(base)).toBe(false));
