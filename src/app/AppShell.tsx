import { useState } from 'react';
import { Outlet, useSearchParams } from 'react-router';
import { useGroup } from '@/features/group/GroupContext';
import { SettingsSheet } from '@/features/settings/SettingsSheet';
import { BottomNav } from './BottomNav';
import { MoreSheet } from './MoreSheet';
import { OfflineBanner } from './OfflineBanner';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export function AppShell() {
  const { isAdmin } = useGroup();
  const [params, setParams] = useSearchParams();
  const [moreOpen, setMoreOpen] = useState(false);

  const openSettings = () => {
    const next = new URLSearchParams(params);
    next.set('settings', 'open');
    setParams(next);
  };

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[248px_minmax(0,1fr)]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:inline-flex focus:h-12 focus:items-center focus:rounded-xl focus:bg-surface focus:px-4">
        Skip to content
      </a>
      <Sidebar onOpenSettings={openSettings} />
      <div className="flex min-h-dvh min-w-0 flex-col">
        <TopBar onOpenSettings={openSettings} />
        <OfflineBanner />
        <main id="main" className="mx-auto w-full max-w-[1180px] flex-1 px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-4 md:px-8 md:pb-10 md:pt-8">
          <Outlet />
        </main>
      </div>
      <BottomNav isAdmin={isAdmin} onMore={() => setMoreOpen(true)} />
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} isAdmin={isAdmin} />
      <SettingsSheet />
    </div>
  );
}
