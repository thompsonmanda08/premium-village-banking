import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/ui';

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <div role="status" className="fixed inset-x-4 bottom-[calc(88px+env(safe-area-inset-bottom))] z-[60] mx-auto flex max-w-md items-center gap-2 rounded-xl border border-line bg-surface p-3 shadow-lg md:bottom-6">
      <span className="flex-1 text-sm text-fg">A new version of the app is ready.</span>
      <Button size="sm" variant="ghost" onClick={() => setNeedRefresh(false)}>Later</Button>
      <Button size="sm" onClick={() => void updateServiceWorker(true)}>Update</Button>
    </div>
  );
}
