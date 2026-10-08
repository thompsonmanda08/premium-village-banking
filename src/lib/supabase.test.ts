import { afterEach, expect, test, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

// signOutEverywhere clears localStorage by this name; the real client must be the one writing under it.
test('the client keeps its session under AUTH_STORAGE_KEY', async () => {
  vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost:54321');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');
  const { AUTH_STORAGE_KEY, supabase } = await import('./supabase');
  expect(AUTH_STORAGE_KEY).toBe('pvb-auth');
  expect((supabase.auth as unknown as { storageKey: string }).storageKey).toBe(AUTH_STORAGE_KEY);
  await supabase.auth.stopAutoRefresh();
});

test('refuses to start without the public env vars', async () => {
  vi.stubEnv('VITE_SUPABASE_URL', '');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
  await expect(import('./supabase')).rejects.toThrow('VITE_SUPABASE_URL');
});
