import type { ReactNode } from 'react';
import { BrandMark } from './BrandMark';

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10 pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
      <div className="mb-8 flex items-center gap-3">
        <BrandMark size={44} />
        <div>
          <p className="text-sm font-semibold text-muted">Premium Village Bank</p>
          <h1 className="text-2xl font-bold tracking-tight text-fg">{title}</h1>
        </div>
      </div>
      {subtitle ? <p className="-mt-4 mb-6 text-base text-muted">{subtitle}</p> : null}
      {children}
    </main>
  );
}
