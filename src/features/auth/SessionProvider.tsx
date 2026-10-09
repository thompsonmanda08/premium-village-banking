import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { wipeLocalData } from '@/lib/queryClient';

type SessionState = { session: Session | null; loading: boolean };
const SessionContext = createContext<SessionState>({ session: null, loading: true });

export function SessionProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [state, setState] = useState<SessionState>({ session: null, loading: true });
  const latest = useRef<Session | null>(null); // the newest session seen, for a render that waits on a wipe

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      latest.current ??= data.session;
      setState({ session: data.session, loading: false });
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      const previousId = latest.current?.user.id;
      latest.current = session;
      if (previousId && session && session.user.id !== previousId) {
        // A sign-in link or invite opened while someone else was signed in replaced their session. Drop the previous
        // member's cached data before the new one renders (a failed wipe must not lock the new member out).
        void wipeLocalData(qc)
          .catch(() => {})
          .then(() => active && setState({ session: latest.current, loading: false }));
        return;
      }
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
