import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { del, get, set } from 'idb-keyval';

export const CACHE_KEY = 'pvb-query-cache';
export const CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

export const makeQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, gcTime: CACHE_MAX_AGE, retry: 1, refetchOnWindowFocus: true },
      mutations: { retry: 0 },
    },
  });

export const persister = createAsyncStoragePersister({
  key: CACHE_KEY,
  storage: {
    getItem: async (k) => (await get<string>(k)) ?? null,
    setItem: (k, v) => set(k, v),
    removeItem: (k) => del(k),
  },
});

export async function wipeLocalData(qc: QueryClient): Promise<void> {
  await qc.cancelQueries();
  qc.clear();
  await persister.removeClient();
}
