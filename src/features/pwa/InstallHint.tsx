import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { BrandMark } from '@/app/BrandMark';
import { Button, Card, IconButton } from '@/ui';

type InstallEvent = Event & { prompt: () => Promise<void> };
export const HINT_KEY = 'pvb-install-hint-dismissed';

export function shouldShowInstallHint(o: { standalone: boolean; dismissed: boolean; canPrompt: boolean; isIOS: boolean }): boolean {
  return !o.standalone && !o.dismissed && (o.canPrompt || o.isIOS);
}

const readDismissed = () => {
  try {
    return localStorage.getItem(HINT_KEY) === '1';
  } catch {
    return true;
  }
};

export function InstallHint() {
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [dismissed, setDismissed] = useState(readDismissed);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as InstallEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const standalone =
    window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (!shouldShowInstallHint({ standalone, dismissed, canPrompt: Boolean(installEvent), isIOS })) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(HINT_KEY, '1');
    } catch {
      // Storage blocked: hide for this visit.
    }
    setDismissed(true);
  };

  return (
    <Card className="mb-4 flex items-center gap-3">
      <BrandMark size={36} />
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold text-fg">Add Premium VB to your home screen</p>
        <p className="text-sm text-muted">{installEvent ? 'It opens like an app, straight to your passbook.' : 'Tap Share, then “Add to Home Screen”.'}</p>
      </div>
      {installEvent ? (
        <Button size="sm" onClick={async () => { await installEvent.prompt(); dismiss(); }}>Install</Button>
      ) : null}
      <IconButton label="Dismiss" icon={<X className="size-5" />} onClick={dismiss} />
    </Card>
  );
}
