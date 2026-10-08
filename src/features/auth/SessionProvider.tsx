import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { wipeLocalData } from '@/lib/queryClient';

type SessionState = { session: Session | null; loading: boolean };
const SessionContext = createContext<SessionState>({ session: null, loading: true });

export function SessionProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [state, setState] = useState<SessionState>({ session: null, loading: true });

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setState({ session: data.session, loading: false });
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setState({ session, loading: false });
      if (event === 'SIGNED_OUT') void wipeLocalData(qc);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [qc]);

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}

export const useSession = (): SessionState => useContext(SessionContext);
