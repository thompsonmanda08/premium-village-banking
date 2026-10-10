import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { BrandMark } from './BrandMark';

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10 pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
      <div className="mb-8 flex items-center gap-3">
        <BrandMark size={56} />
        <div>
          <p className="text-sm font-semibold text-muted">Premium Village Bank</p>
          <h1 className="text-2xl font-bold tracking-tight text-fg">{title}</h1>
        </div>
      </div>
      {subtitle ? <p className="-mt-4 mb-6 text-base text-muted">{subtitle}</p> : null}
      {children}
      <p className="mt-8 text-sm text-muted">
        By accepting an invitation or creating an account, you accept the{' '}
        <Link to="/terms" className="font-semibold text-accent underline underline-offset-4">Terms of use</Link> and{' '}
        <Link to="/terms#privacy" className="font-semibold text-accent underline underline-offset-4">Privacy policy</Link>.
      </p>
    </main>
  );
}
