import { get, set } from 'idb-keyval';
import { beforeEach, expect, test, vi } from 'vitest';
import { CACHE_KEY, makeQueryClient } from '@/lib/queryClient';

const signOut = vi.fn();
vi.mock('@/lib/supabase', () => ({ supabase: { auth: { signOut: (...a: unknown[]) => signOut(...a) } } }));

const { signOutEverywhere } = await import('./signOut');

// Braces matter: vitest runs a function returned from beforeEach as teardown, and mockReset() returns the mock.
beforeEach(() => {
  signOut.mockReset();
});

test('signs out and wipes cached group data', async () => {
  signOut.mockResolvedValue({ error: null });
  const qc = makeQueryClient();
  qc.setQueryData(['group-members', 'g1'], [{ full_name: 'Tafara' }]);
  await set(CACHE_KEY, 'cached');
  await signOutEverywhere(qc);
  expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
  expect(qc.getQueryData(['group-members', 'g1'])).toBeUndefined();
  expect(await get(CACHE_KEY)).toBeUndefined();
});

test('still wipes local data when the network sign-out fails (shared phone, offline)', async () => {
  signOut.mockRejectedValue(new TypeError('Failed to fetch'));
  const qc = makeQueryClient();
  qc.setQueryData(['membership', 'u1'], { group: 'x' });
  await set(CACHE_KEY, 'cached');
  await signOutEverywhere(qc);
  expect(qc.getQueryData(['membership', 'u1'])).toBeUndefined();
  expect(await get(CACHE_KEY)).toBeUndefined();
});

test('a failed wipe is not swallowed (it must never look like a clean sign-out)', async () => {
  signOut.mockResolvedValue({ error: null });
  const qc = makeQueryClient();
  vi.spyOn(qc, 'cancelQueries').mockRejectedValue(new Error('wipe failed'));
  await expect(signOutEverywhere(qc)).rejects.toThrow('wipe failed');
});
