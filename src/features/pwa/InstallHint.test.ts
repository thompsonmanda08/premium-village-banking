import { expect, test } from 'vitest';
import { isIOSDevice, shouldShowInstallHint } from './InstallHint';

const base = { standalone: false, dismissed: false, canPrompt: false, isIOS: false };

test('shows when Android can prompt', () => expect(shouldShowInstallHint({ ...base, canPrompt: true })).toBe(true));
test('shows instructions on iOS', () => expect(shouldShowInstallHint({ ...base, isIOS: true })).toBe(true));
test('hidden once installed', () => expect(shouldShowInstallHint({ ...base, canPrompt: true, standalone: true })).toBe(false));
test('hidden once dismissed', () => expect(shouldShowInstallHint({ ...base, isIOS: true, dismissed: true })).toBe(false));
test('hidden on desktop browsers that cannot install', () => expect(shouldShowInstallHint(base)).toBe(false));

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15';

test('iPhone is iOS', () => expect(isIOSDevice(IPHONE, 5)).toBe(true));
test('iPadOS posing as a Mac is iOS (touch screen)', () => expect(isIOSDevice(MAC, 5)).toBe(true));
test('a real Mac without touch is not iOS', () => expect(isIOSDevice(MAC, 0)).toBe(false));
test('Android is not iOS', () => expect(isIOSDevice('Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile', 5)).toBe(false));
