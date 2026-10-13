// @vitest-environment node
import { afterEach, expect, test, vi } from 'vitest';
import { friendlyError } from '@/lib/errors';

// After a deploy, an admin still on the old app shell asks for an ExcelJS chunk whose hashed name no longer exists.
vi.mock('exceljs', () => {
  throw new Error('Failed to fetch dynamically imported module: https://app.example.test/assets/exceljs.min-OLDHASH.js');
});
const { loadExcel } = await import('./loadExcel');

afterEach(() => vi.unstubAllGlobals());

test('a chunk that is gone after a deploy asks for a reload, never says “offline”', async () => {
  const err = await loadExcel().catch((e: unknown) => e);
  expect(err).toMatchObject({ message: 'app_update_needed' });
  expect(friendlyError(err)).toBe('A newer version of the app is ready. Reload this page and try again.');
});

test('with no connection the original failure stands, so the offline message is shown', async () => {
  vi.stubGlobal('navigator', { onLine: false });
  const err = await loadExcel().catch((e: unknown) => e);
  expect((err as Error).message).not.toBe('app_update_needed');
  expect(String((err as Error & { cause?: Error }).cause?.message)).toContain('Failed to fetch dynamically imported module'); // vitest wraps a failing mock factory; the cause is the original
});
