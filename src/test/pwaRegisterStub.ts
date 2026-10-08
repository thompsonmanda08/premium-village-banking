import { useEffect } from 'react';

// Stands in for the plugin's virtual module under Vitest. Like the real hook it reports the (fake) registration on mount.
export const registration = { update: async () => {} } as unknown as ServiceWorkerRegistration;

export function useRegisterSW(options?: { onRegisteredSW?: (url: string, r: ServiceWorkerRegistration | undefined) => void }) {
  useEffect(() => {
    options?.onRegisteredSW?.('/sw.js', registration);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- registration is reported once per mount, like the real hook.
  }, []);
  return {
    needRefresh: [false, () => {}] as [boolean, (v: boolean) => void],
    offlineReady: [false, () => {}] as [boolean, (v: boolean) => void],
    updateServiceWorker: async () => {},
  };
}
