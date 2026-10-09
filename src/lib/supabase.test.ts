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

// A stalled request must fail instead of leaving a screen on its skeleton: every request carries the timeout signal.
test('every request goes out with an abort signal from the timeout fetch', async () => {
  vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost:54321');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');
  const spy = vi.fn(async () => new Response('[]', { headers: { 'content-type': 'application/json' } }));
  vi.stubGlobal('fetch', spy);
  const { supabase } = await import('./supabase');
  await supabase.from('groups').select('id');
  const init = (spy.mock.calls[0] as unknown as [unknown, RequestInit])[1];
  expect(init.signal).toBeInstanceOf(AbortSignal);
  await supabase.auth.stopAutoRefresh();
  vi.unstubAllGlobals();
});

test('refuses to start without the public env vars', async () => {
  vi.stubEnv('VITE_SUPABASE_URL', '');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
  await expect(import('./supabase')).rejects.toThrow('VITE_SUPABASE_URL');
});
