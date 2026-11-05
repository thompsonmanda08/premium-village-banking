import { useState } from 'react';
import { Outlet } from 'react-router';
import { useGroup } from '@/features/group/GroupContext';
import { InstallHint } from '@/features/pwa/InstallHint';
import { BottomNav } from './BottomNav';
import { MoreSheet } from './MoreSheet';
import { OfflineBanner } from './OfflineBanner';
import { TopBar } from './TopBar';
import { TopNav } from './TopNav';

export function AppShell() {
  const { isAdmin } = useGroup();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:inline-flex focus:h-12 focus:items-center focus:rounded-xl focus:bg-surface focus:px-4">
        Skip to content
      </a>
      <div className="flex min-h-dvh min-w-0 flex-col">
        <TopBar />
        <TopNav />
        <OfflineBanner />
        <main id="main" className="mx-auto w-full max-w-[1280px] flex-1 px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-4 md:px-8 md:pb-12 md:pt-4">
          <InstallHint />
          <Outlet />
        </main>
      </div>
      <BottomNav isAdmin={isAdmin} onMore={() => setMoreOpen(true)} />
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} isAdmin={isAdmin} />
    </div>
  );
}
