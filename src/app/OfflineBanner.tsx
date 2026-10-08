import { useSyncExternalStore } from 'react';
import { WifiOff } from 'lucide-react';

const subscribe = (cb: () => void) => {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
};

export const useOnline = () => useSyncExternalStore(subscribe, () => navigator.onLine, () => true);

export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div role="status" className="flex items-center gap-2 bg-warning-soft px-4 py-2 text-sm text-fg">
      <WifiOff aria-hidden className="size-4 text-warning" />
      You’re offline. Showing what was last loaded; changes need a connection.
    </div>
  );
}
