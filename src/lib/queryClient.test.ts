import { get, set } from 'idb-keyval';
import { expect, test, vi } from 'vitest';
import { CACHE_KEY, makeQueryClient, persister, wipeLocalData } from './queryClient';

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
