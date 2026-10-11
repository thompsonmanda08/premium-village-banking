import { get, set } from 'idb-keyval';
import { expect, test, vi } from 'vitest';
import { CACHE_KEY, makeQueryClient, persister, shouldPersistQuery, wipeLocalData } from './queryClient';

test('wipeLocalData clears memory and IndexedDB', async () => {
  const qc = makeQueryClient();
  qc.setQueryData(['membership', 'u1'], { group: 'Premium' });
  await set(CACHE_KEY, '{"clientState":{}}');
  await wipeLocalData(qc);
  expect(qc.getQueryData(['membership', 'u1'])).toBeUndefined();
  expect(await get(CACHE_KEY)).toBeUndefined();
});

test('wipeLocalData lets the persister remove its own key', async () => {
  const removeClient = vi.spyOn(persister, 'removeClient');
  await wipeLocalData(makeQueryClient());
  expect(removeClient).toHaveBeenCalledTimes(1);
  removeClient.mockRestore();
});

test('the invite preview (raw token, member details) is never written to the persisted cache', async () => {
  const { dehydrate } = await import('@tanstack/react-query');
  const qc = makeQueryClient();
  qc.setQueryData(['membership', 'u1'], { group: 'Premium' });
  qc.setQueryData(['invite-preview', 'raw-token'], { status: 'valid', member_name: 'Tafara' });
  const keys = dehydrate(qc, { shouldDehydrateQuery: shouldPersistQuery }).queries.map((q) => q.queryKey);
  expect(keys).toEqual([['membership', 'u1']]);
  expect(JSON.stringify(dehydrate(qc, { shouldDehydrateQuery: shouldPersistQuery }))).not.toContain('raw-token');
});

test('failed queries are still not persisted either (the library default)', () => {
  const qc = makeQueryClient();
  qc.setQueryData(['membership', 'u1'], { group: 'Premium' });
  const query = qc.getQueryCache().find({ queryKey: ['membership', 'u1'] })!;
  expect(shouldPersistQuery(query)).toBe(true);
  query.setState({ ...query.state, status: 'error' });
  expect(shouldPersistQuery(query)).toBe(false);
});

test('a loan check holds lending cash, which moves: it is never written to IndexedDB', async () => {
  const { dehydrate } = await import('@tanstack/react-query');
  const qc = makeQueryClient();
  qc.setQueryData(['membership', 'u1'], { group: 'Premium' });
  qc.setQueryData(['loan-check', 'm1', 500], { lending_cash: 6000 });
  const keys = dehydrate(qc, { shouldDehydrateQuery: shouldPersistQuery }).queries.map((q) => q.queryKey);
  expect(keys).toEqual([['membership', 'u1']]);
});
