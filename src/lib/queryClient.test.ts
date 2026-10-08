import { get, set } from 'idb-keyval';
import { expect, test } from 'vitest';
import { CACHE_KEY, makeQueryClient, wipeLocalData } from './queryClient';

test('wipeLocalData clears memory and IndexedDB', async () => {
  const qc = makeQueryClient();
  qc.setQueryData(['membership', 'u1'], { group: 'Premium' });
  await set(CACHE_KEY, '{"clientState":{}}');
  await wipeLocalData(qc);
  expect(qc.getQueryData(['membership', 'u1'])).toBeUndefined();
  expect(await get(CACHE_KEY)).toBeUndefined();
});
