import { AuthRetryableFetchError } from '@supabase/supabase-js';
import { get, set } from 'idb-keyval';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { CACHE_KEY, makeQueryClient } from '@/lib/queryClient';

const signOut = vi.fn();
vi.mock('@/lib/supabase', () => ({
  AUTH_STORAGE_KEY: 'pvb-auth',
  supabase: { auth: { signOut: (...a: unknown[]) => signOut(...a) } },
}));

const { signOutEverywhere } = await import('./signOut');

// Everything supabase-js keeps under its storage key (session, PKCE verifiers, user copy), plus a key that must survive.
const AUTH_KEYS = ['pvb-auth', 'pvb-auth-user', 'pvb-auth-code-verifier', 'pvb-auth-flows-code-verifier', 'pvb-auth-flow-0a1b-code-verifier'];
const seedStorage = () => {
  for (const k of AUTH_KEYS) localStorage.setItem(k, '{"refresh_token":"previous-member"}');
  localStorage.setItem('pvb-theme', 'dark');
};
const expectAuthStorageGone = () => {
  for (const k of AUTH_KEYS) expect(localStorage.getItem(k)).toBeNull();
  expect(localStorage.getItem('pvb-theme')).toBe('dark');
};

// Braces matter: vitest runs a function returned from beforeEach as teardown, and mockReset() returns the mock.
beforeEach(() => {
  signOut.mockReset();
  localStorage.clear();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

test('signs out and wipes cached group data', async () => {
  signOut.mockResolvedValue({ error: null });
  seedStorage();
  const qc = makeQueryClient();
  qc.setQueryData(['group-members', 'g1'], [{ full_name: 'Tafara' }]);
  await set(CACHE_KEY, 'cached');
  await signOutEverywhere(qc);
  expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
  expect(qc.getQueryData(['group-members', 'g1'])).toBeUndefined();
  expect(await get(CACHE_KEY)).toBeUndefined();
  expectAuthStorageGone();
  expect(console.warn).not.toHaveBeenCalled();
});

test('still wipes local data when the network sign-out throws (shared phone, offline)', async () => {
  signOut.mockRejectedValue(new TypeError('Failed to fetch'));
  seedStorage();
  const qc = makeQueryClient();
  qc.setQueryData(['membership', 'u1'], { group: 'x' });
  await set(CACHE_KEY, 'cached');
  await signOutEverywhere(qc);
  expect(qc.getQueryData(['membership', 'u1'])).toBeUndefined();
  expect(await get(CACHE_KEY)).toBeUndefined();
  expectAuthStorageGone();
});

// supabase-js never throws from signOut: offline with an expired token it resolves { error } and leaves the
// session in storage, so the next person to open the app online would be refreshed into the previous member's account.
test('removes the stored session when supabase-js resolves a retryable fetch error (shared phone, offline)', async () => {
  signOut.mockResolvedValue({ error: new AuthRetryableFetchError('Failed to fetch', 0) });
  seedStorage();
  const qc = makeQueryClient();
  qc.setQueryData(['membership', 'u1'], { group: 'x' });
  await set(CACHE_KEY, 'cached');
  await expect(signOutEverywhere(qc)).resolves.toBeUndefined();
  expect(qc.getQueryData(['membership', 'u1'])).toBeUndefined();
  expect(await get(CACHE_KEY)).toBeUndefined();
  expectAuthStorageGone();
  expect(console.warn).toHaveBeenCalledTimes(1);
  expect(vi.mocked(console.warn).mock.calls[0]).toEqual([expect.any(String)]);
});

test('storage that throws does not stop the wipe', async () => {
  signOut.mockResolvedValue({ error: null });
  seedStorage();
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
    throw new DOMException('blocked', 'SecurityError');
  });
  const qc = makeQueryClient();
  qc.setQueryData(['membership', 'u1'], { group: 'x' });
  await set(CACHE_KEY, 'cached');
  await expect(signOutEverywhere(qc)).resolves.toBeUndefined();
  expect(qc.getQueryData(['membership', 'u1'])).toBeUndefined();
  expect(await get(CACHE_KEY)).toBeUndefined();
});

test('a failed wipe is not swallowed (it must never look like a clean sign-out)', async () => {
  signOut.mockResolvedValue({ error: null });
  const qc = makeQueryClient();
  vi.spyOn(qc, 'cancelQueries').mockRejectedValue(new Error('wipe failed'));
  await expect(signOutEverywhere(qc)).rejects.toThrow('wipe failed');
});
