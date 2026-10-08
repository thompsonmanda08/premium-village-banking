import { useState, useSyncExternalStore } from 'react';
import { X } from 'lucide-react';
import { BrandMark } from '@/app/BrandMark';
import { Button, Card, IconButton } from '@/ui';
import { clearInstallPrompt, getInstallPrompt, subscribeInstallPrompt } from './installPrompt';

export const HINT_KEY = 'pvb-install-hint-dismissed';

export function shouldShowInstallHint(o: { standalone: boolean; dismissed: boolean; canPrompt: boolean; isIOS: boolean }): boolean {
  return !o.standalone && !o.dismissed && (o.canPrompt || o.isIOS);
}

// iPadOS 13+ Safari presents a desktop "Macintosh" user agent; the touch screen is what gives it away.
export const isIOSDevice = (ua: string, maxTouchPoints: number) =>
  /iphone|ipad|ipod/i.test(ua) || (maxTouchPoints > 1 && /macintosh/i.test(ua));

const readDismissed = () => {
  try {
    return localStorage.getItem(HINT_KEY) === '1';
  } catch {
    return true;
  }
};

export function InstallHint() {
  const installEvent = useSyncExternalStore(subscribeInstallPrompt, getInstallPrompt, () => null);
  const [dismissed, setDismissed] = useState(readDismissed);

  const standalone =
    window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const isIOS = isIOSDevice(navigator.userAgent, navigator.maxTouchPoints);
  if (!shouldShowInstallHint({ standalone, dismissed, canPrompt: Boolean(installEvent), isIOS })) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(HINT_KEY, '1');
    } catch {
      // Storage blocked: hide for this visit.
    }
    setDismissed(true);
  };
  const install = async () => {
    try {
      await installEvent?.prompt();
    } catch {
      // The browser refused or the prompt was already used; either way the hint has done its job.
    } finally {
      dismiss();
      clearInstallPrompt();
    }
  };

  return (
    <Card className="mb-4 flex items-center gap-3">
      <BrandMark size={36} />
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold text-fg">Add Premium VB to your home screen</p>
        <p className="text-sm text-muted">{installEvent ? 'It opens like an app, straight to your passbook.' : 'Tap Share, then “Add to Home Screen”.'}</p>
      </div>
      {installEvent ? (
        <Button size="sm" onClick={() => void install()}>Install</Button>
      ) : null}
      <IconButton label="Dismiss" icon={<X className="size-5" />} onClick={dismiss} />
    </Card>
  );
}
