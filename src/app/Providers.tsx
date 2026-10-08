import { useState, type ReactNode } from 'react';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { CACHE_MAX_AGE, makeQueryClient, persister } from '@/lib/queryClient';
import { SessionProvider } from '@/features/auth/SessionProvider';
import { ToastProvider } from '@/ui';
import { ThemeProvider } from './ThemeProvider';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: CACHE_MAX_AGE, buster: 'foundation-1' }}>
      <ThemeProvider>
        <ToastProvider>
          <SessionProvider>{children}</SessionProvider>
        </ToastProvider>
      </ThemeProvider>
    </PersistQueryClientProvider>
  );
}
