# Premium Village Bank — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the AI Studio dashboard template into a deployed, installable, mobile-first shell for Premium Village Banking: Supabase auth (Google, magic link, password, invite-only), groups/members/roles/cycles/rules in Postgres with RLS, a cleaned slate/zinc/indigo theme, and Vercel + GitHub Actions operations.

**Architecture:** A Vite + React 19 single-page app talks directly to Supabase with the public anon key; every rule that matters (who reads what, who can change roles, invite linking, last-admin guard) lives in Postgres as RLS policies and `security definer` functions, tested with pgTAP. One Edge Function (`invite-member`) holds the service key to send invite emails. The SPA is a PWA served as static files from Vercel.

**Tech Stack:** Bun 1.4, Vite 6.4, React 19.2, TypeScript 5.8 (strict), Tailwind CSS 4 (`@tailwindcss/vite`), React Router 7, TanStack Query 5 (+ IndexedDB persister via `idb-keyval`), supabase-js 2, vite-plugin-pwa 1.3, lucide-react, Vitest 3 + Testing Library + jsdom + fake-indexeddb, ESLint 9, Supabase CLI 2 (Docker), pgTAP, Deno 2 (Edge Function tests), Playwright 1.6x.

**Spec:** `docs/superpowers/specs/2026-10-08-foundation-design.md` (read it before starting; this plan argues from it).

## Global Constraints

- Package manager is **Bun** (`bun.lock` is committed). Never commit `package-lock.json` or `yarn.lock`.
- Version floors: `vite@^6.4`, `@vitejs/plugin-react@^5`, `react@^19.2`, `react-dom@^19.2`, `tailwindcss@^4`, `@tailwindcss/vite@^4`, `react-router@^7`, `@tanstack/react-query@^5`, `@supabase/supabase-js@^2`, `vite-plugin-pwa@^1.3`, `vitest@^3.2`, `typescript@~5.8`, `eslint@^9`.
- TypeScript runs with `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`.
- Colour only through semantic tokens (`bg-canvas`, `bg-surface`, `bg-surface-2`, `border-line`, `text-fg`, `text-muted`, `text-accent`, `bg-accent-solid`, `text-on-accent`, `bg-accent-soft`, `text-success|warning|danger|info`, `bg-*-soft`, `bg-scrim`). Tailwind's default palette is switched off; `scripts/check-tokens.mjs` fails CI on raw palette classes, `isLight`, `dark:` colour variants, gradients, or text under 12px.
- Light/dark: one mechanism only — `data-theme="light|dark"` on `<html>`, set before first paint by `public/theme-init.js`, default follows the system, override stored in `localStorage` key `pvb-theme`.
- Type: Inter (self-hosted via `@fontsource-variable/inter`), `tabular-nums` on figures, 12px minimum (metadata only), 16px body on phones.
- Touch targets: primary controls `h-12` (48px); nothing interactive under 44px.
- Money format: `K 1,234.50`; negatives use U+2212 `−`; never show `−0.00`.
- Every SQL `security definer` function sets `search_path = public` and calls `auth.uid()` / `auth.jwt()` fully qualified; pgcrypto is called as `extensions.digest(...)`.
- SQL business errors are raised with `errcode = 'P0001'` and the message set to one of these exact codes: `invite_not_found`, `invite_expired`, `invite_revoked`, `invite_used`, `email_mismatch`, `already_linked`, `member_taken`, `member_not_active`, `member_not_found`, `last_admin`, `not_admin`, `not_signed_in`, `already_bootstrapped`, `owner_member_not_found`. Permission errors use `errcode = '42501'`.
- User-facing error text comes only from `friendlyError()` in `src/lib/errors.ts`.
- The Supabase service-role key exists only in Edge Function secrets and GitHub Actions secrets — never in `VITE_*` variables or browser code.
- Commit messages: conventional prefix (`feat:`, `fix:`, `chore:`, `test:`, `docs:`, `ci:`), and **no `Co-Authored-By` trailer** (the user's global CLAUDE.md forbids it).
- Work on branch `feat/foundation` (created from `plan/foundation`). Do not commit to `main`.

## Review Focus

1. **Shared phones:** a member signs out on a family phone; the next person opens the app → no cached group data may appear. Pinned by the sign-out wipe test in Task 10.
2. **Silent RLS no-ops:** an UPDATE that RLS filters out returns success with zero rows, so the UI would claim "Saved" while nothing changed (rules locked after a cycle starts, a non-admin edit). Pinned by `expectRows` tests in Task 10 and the rules-locked test in Task 15.
3. **Losing the last admin by another door:** `set_admin` refuses to demote the last admin, but marking that admin "left" (a plain status update) must be refused too. Pinned by the status-update test in Task 7.
4. **Invite opened on the wrong account:** the treasurer opens a member's invite on their own signed-in phone → the member must not be linked to the treasurer's account, and the page must offer "Sign out and use the invited email". Pinned by `email_mismatch` tests in Task 7 (SQL) and Task 13 (UI).
5. **Open redirect after sign-in:** `/sign-in?next=//evil.example` must land on `/`. Pinned by the `safeNext` test in Task 11.

## Decisions this plan adds to the spec

Read these before starting; each was made to keep Foundation shippable and is cheap to revisit.

- **UI primitives:** only the primitives Foundation uses are rebuilt tokenised (Button, IconButton, Card, Badge, TextField, Skeleton, EmptyState, Alert, Avatar, Sheet, Toast, PageHeader). Modal and Drawer are merged into one responsive `Sheet`. DataTable, Charts, StatCard, ProgressBar, Dropdown, Tabs and Switch are not ported now; the sub-project that first needs one restores it from commit `87685b2` and tokenises it then.
- **`is_member` includes the group owner**, matching `is_admin`, so an owner without a member row can still open the group.
- **`invite_preview(token)`** (callable signed out) is added so the invite page can say "You're invited to … as Tafara" before sign-in. It reveals only the group name, short name and a masked email.
- **Setup functions live in schema `private`** (`bootstrap_premium_vb`, `bootstrap_test_group`, `create_cycle`); app roles cannot call them. The local seed and the production setup use the same function.
- **Preview test accounts** belong to a separate "Playwright Test Group" in production rather than to no group, so role tests can run against previews without touching real data.
- **Route transitions** animate forward navigation from the nav bars; browser Back is instant, because React Router 7 does not start a view transition on `popstate`.
- **Routes are not lazy-loaded** yet; the Foundation bundle is small. Add React Router `lazy` when the ledger screens land.
- **Loan limits and repayment periods** are shown read-only in settings; they follow the constitution and are edited by migration if the constitution changes.

---

## File Structure

```
index.html                       app entry; theme-init script; PWA meta
public/theme-init.js             sets data-theme before paint (no inline script → strict CSP)
public/favicon.svg               solid indigo mark; source for PWA icons
vite.config.ts                   React, Tailwind, PWA, Vitest config
tsconfig.json                    strict TS for src/, e2e/, configs
eslint.config.js                 flat config (TS, hooks, jsx-a11y)
vercel.json                      SPA rewrite + security headers
playwright.config.ts             mobile + desktop smoke projects
DESIGN.md                        token table and usage rules
scripts/check-tokens.mjs         CI guard against raw colours / tiny text / theme ternaries
scripts/check-tokens.test.mjs    guard tests
src/main.tsx                     bootstraps fonts, CSS, providers, router
src/styles/tokens.css            Tailwind v4 theme, light/dark tokens, base layer, motion
src/test/setup.ts                jest-dom, fake IndexedDB, matchMedia shim
src/lib/format.ts(+test)         fmt, zmw, pct, formatDate, localISODate
src/lib/theme.ts(+test)          read/write/resolve/apply theme
src/lib/supabase.ts              typed client
src/lib/database.types.ts        generated by `bun run db:types`
src/lib/queryClient.ts(+test)    QueryClient, IndexedDB persister, wipeLocalData
src/lib/errors.ts(+test)         friendlyError
src/lib/mutate.ts(+test)         expectRows (catches silent RLS no-ops)
src/lib/calendar.ts(+test)       upcomingDates, pickCurrentCycle
src/lib/haptics.ts               confirmation vibration
src/ui/*                         tokenised primitives (Button, IconButton, Card, Badge, TextField,
                                 Skeleton, EmptyState, Alert, Avatar, Sheet, Toast, PageHeader,
                                 useConfirmTap, cn)
src/app/router.tsx               route table
src/app/Providers.tsx            Query/Session/Theme/Toast providers
src/app/ThemeProvider.tsx        theme context + system listener
src/app/AppShell.tsx             layout: sidebar, top bar, main, bottom nav, settings, PWA bits
src/app/nav.ts(+test)            nav model (member vs admin)
src/app/{Sidebar,TopBar,BottomNav,MoreSheet,OfflineBanner,PullToRefresh}.tsx
src/features/auth/*              SessionProvider, access(+test), safeNext(+test), SignInMethods,
                                 SignInPage, AuthCallback, RequireAuth, signOut(+test)
src/features/group/*             useMembership(+test), GroupContext, RequireMembership, NoGroupScreen
src/features/invite/InvitePage.tsx(+test)
src/features/home|group|rules|desk|shells/*   screens
src/features/settings/*          SettingsSheet + sections (+tests)
src/features/account/*           AccountPage, password check (+test)
src/features/pwa/*               UpdatePrompt, InstallHint (+test)
supabase/config.toml             local stack config
supabase/migrations/20261008000100_core_schema.sql
supabase/migrations/20261008000200_access_rls.sql
supabase/migrations/20261008000300_invites_admins_audit.sql
supabase/migrations/20261008000400_bootstrap.sql
supabase/seed.sql                local-only users + Premium VB bootstrap
supabase/tests/database/00_helpers.sql … 04_bootstrap.sql
supabase/functions/invite-member/{index.ts,lib.ts,lib.test.ts}
e2e/smoke.spec.ts, e2e/roles.spec.ts
.github/workflows/{ci,e2e,db-deploy,keepalive,backup}.yml
docs/ops/{setup,restore}.md
```

---

### Task 1: Clean the template and set up the toolchain

**Files:**
- Delete: `App.tsx`, `index.tsx`, `index.css`, `types.ts`, `metadata.json`, `data/`, `components/` (all of it — the primitives are rewritten tokenised in Task 4; originals stay in commit `87685b2`)
- Create: `package.json` (replace), `tsconfig.json` (replace), `vite.config.ts` (replace), `index.html` (replace), `eslint.config.js`, `src/main.tsx`, `src/App.tsx`, `src/App.test.tsx`, `src/styles/tokens.css` (minimal for now), `src/test/setup.ts`, `src/vite-env.d.ts`, `README.md` (replace), `.gitignore` (append)

**Interfaces:**
- Consumes: nothing.
- Produces: scripts `bun run dev|build|typecheck|lint|test|check:tokens|e2e|db:start|db:reset|db:test|db:types|fn:test`; path alias `@/` → `src/`; Vitest setup at `src/test/setup.ts` with `VITE_SUPABASE_URL=http://localhost:54321` and `VITE_SUPABASE_ANON_KEY=test-anon-key`.

- [ ] **Step 1: Create the working branch and remove the template**

```bash
git checkout -b feat/foundation plan/foundation
git rm -r -q App.tsx index.tsx index.css types.ts metadata.json data components
```

- [ ] **Step 2: Replace `package.json`**

```json
{
  "name": "premium-village-bank",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "bun run typecheck && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "lint": "eslint .",
    "test": "vitest run",
    "test:watch": "vitest",
    "check:tokens": "node scripts/check-tokens.mjs src",
    "e2e": "playwright test",
    "db:start": "supabase start",
    "db:reset": "supabase db reset",
    "db:test": "supabase test db",
    "db:types": "supabase gen types typescript --local --schema public > src/lib/database.types.ts",
    "fn:test": "deno test --allow-env supabase/functions/invite-member/lib.test.ts"
  }
}
```

- [ ] **Step 3: Install dependencies**

```bash
rm -f bun.lock
bun add react@^19.2 react-dom@^19.2 react-router@^7 @tanstack/react-query@^5 \
  @tanstack/react-query-persist-client@^5 @tanstack/query-async-storage-persister@^5 \
  idb-keyval@^6 @supabase/supabase-js@^2 lucide-react @fontsource-variable/inter
bun add -d vite@^6.4 @vitejs/plugin-react@^5 tailwindcss@^4 @tailwindcss/vite@^4 \
  typescript@~5.8 @types/react@^19 @types/react-dom@^19 @types/node@^22 \
  vitest@^3.2 jsdom @testing-library/react@^16 @testing-library/dom @testing-library/user-event@^14 \
  @testing-library/jest-dom@^6 fake-indexeddb@^6 \
  eslint@^9 @eslint/js@^9 typescript-eslint@^8 eslint-plugin-react-hooks@^5 eslint-plugin-jsx-a11y@^6 globals \
  supabase@^2 @playwright/test@^1.64 vite-plugin-pwa@^1.3 @vite-pwa/assets-generator@^1
```

Expected: `bun.lock` regenerated, no peer-dependency errors.

- [ ] **Step 4: Replace `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["vite/client", "node"],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src", "e2e", "vite.config.ts", "playwright.config.ts"]
}
```

- [ ] **Step 5: Replace `vite.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 3000 },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.mjs'],
    env: { VITE_SUPABASE_URL: 'http://localhost:54321', VITE_SUPABASE_ANON_KEY: 'test-anon-key' },
  },
});
```

- [ ] **Step 6: Replace `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#F1F5F9" />
    <title>Premium Village Bank</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Create the minimal app, styles, env types and test setup**

`src/styles/tokens.css`:
```css
@import "tailwindcss";
```

`src/vite-env.d.ts`:
```ts
/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

`src/App.tsx`:
```tsx
export function App() {
  return <h1>Premium Village Bank</h1>;
}
```

`src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import { App } from './App';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`src/test/setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => cleanup());

if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}
```

- [ ] **Step 8: Write the smoke test**

`src/App.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { App } from './App';

test('renders the app name', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Premium Village Bank' })).toBeInTheDocument();
});
```

- [ ] **Step 9: Add ESLint config**

`eslint.config.js`:
```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      'dist',
      'dev-dist',
      'supabase/functions',
      'src/lib/database.types.ts',
      'playwright-report',
      'test-results',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  jsxA11y.flatConfigs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
    languageOptions: { globals: globals.browser },
  },
  { files: ['scripts/**/*.mjs', '*.config.{js,ts}', 'public/**/*.js'], languageOptions: { globals: { ...globals.node, ...globals.browser } } },
);
```

- [ ] **Step 10: Replace README and extend `.gitignore`**

`README.md`:
```markdown
# Premium Village Bank

Mobile-first savings, declarations and loans app for Premium Village Banking.
Vite + React SPA on Vercel, Supabase (Postgres, Auth, Edge Functions) on the free tier.

## Develop

Prerequisites: Bun 1.4+, Docker (for the local Supabase stack), Deno 2 (Edge Function tests).

    bun install
    bun run db:start        # local Supabase on :54321, applies migrations + seed
    cp .env.example .env.local   # then paste the anon key printed by db:start
    bun run dev             # http://localhost:3000

Local accounts (password `password123`): owner@pvb.test, admin@pvb.test, member@pvb.test, outsider@pvb.test.

## Check

    bun run typecheck && bun run lint && bun run check:tokens && bun run test
    bun run db:test         # pgTAP RLS suite
    bun run fn:test         # Edge Function unit tests
    bun run e2e             # Playwright smoke (starts the dev server)

Specs and plans: `docs/superpowers/`. Operations: `docs/ops/`.
```

Append to `.gitignore`:
```
.env
.env*.local
dev-dist
playwright-report
test-results
supabase/.temp
supabase/.branches
supabase/functions/.env
```

- [ ] **Step 11: Run every check**

Run: `bun run typecheck && bun run lint && bun run test && bun x vite build`
Expected: no type or lint errors; `1 passed`; `dist/` built.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "chore: replace dashboard template with Vite/React/Tailwind v4 toolchain"
```

---

### Task 2: Money and date formatting helpers

**Files:**
- Create: `src/lib/format.ts`
- Test: `src/lib/format.test.ts`

**Interfaces:**
- Produces: `fmt(value: number, decimals?: number): string`, `zmw(value: number, decimals?: number): string`, `pct(ratio: number, decimals?: number): string`, `formatDate(iso: string): string` (e.g. `5 Feb 2027`), `localISODate(d: Date): string` (`YYYY-MM-DD` in the device's timezone).

- [ ] **Step 1: Write the failing tests**

`src/lib/format.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import { fmt, formatDate, localISODate, pct, zmw } from './format';

describe('fmt', () => {
  test('groups thousands and fixes decimals', () => {
    expect(fmt(1234.5, 2)).toBe('1,234.50');
    expect(fmt(1234567)).toBe('1,234,567');
  });
  test('uses a true minus sign for negatives', () => {
    expect(fmt(-5)).toBe('−5');
    expect(fmt(-1234.5, 2)).toBe('−1,234.50');
  });
  test('never shows negative zero after rounding', () => {
    expect(fmt(-0.001, 2)).toBe('0.00');
    expect(fmt(-0)).toBe('0');
  });
  test('treats non-finite input as zero', () => {
    expect(fmt(Number.NaN)).toBe('0');
    expect(fmt(Number.POSITIVE_INFINITY, 2)).toBe('0.00');
  });
});

test('zmw prefixes kwacha with a space and two decimals by default', () => {
  expect(zmw(0)).toBe('K 0.00');
  expect(zmw(250)).toBe('K 250.00');
  expect(zmw(1500, 0)).toBe('K 1,500');
  expect(zmw(-12.5)).toBe('K −12.50');
});

test('pct formats a ratio', () => {
  expect(pct(0.1234)).toBe('12.3%');
  expect(pct(0.15, 0)).toBe('15%');
});

test('formatDate is locale-independent', () => {
  expect(formatDate('2027-02-05')).toBe('5 Feb 2027');
  expect(formatDate('2028-12-31')).toBe('31 Dec 2028');
});

test('localISODate uses local calendar fields', () => {
  expect(localISODate(new Date(2027, 1, 5, 23, 30))).toBe('2027-02-05');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun run test src/lib/format.test.ts`
Expected: FAIL — `Failed to resolve import "./format"`.

- [ ] **Step 3: Implement**

`src/lib/format.ts`:
```ts
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export function fmt(value: number, decimals = 0): string {
  const safe = Number.isFinite(value) ? value : 0;
  const factor = 10 ** decimals;
  const rounded = Math.round(Math.abs(safe) * factor) / factor;
  const negative = safe < 0 && rounded !== 0;
  const body = rounded.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return (negative ? '−' : '') + body;
}

export const zmw = (value: number, decimals = 2): string => `K ${fmt(value, decimals)}`;

export const pct = (ratio: number, decimals = 1): string => `${(ratio * 100).toFixed(decimals)}%`;

export function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[(m ?? 1) - 1]} ${y}`;
}

export function localISODate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `bun run test src/lib/format.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.ts src/lib/format.test.ts
git commit -m "feat: add money, percent and date formatting helpers"
```

---

### Task 3: Theme tokens, light/dark switching and DESIGN.md

**Files:**
- Modify: `src/styles/tokens.css` (full theme), `index.html` (theme-init script), `src/main.tsx` (font import)
- Create: `public/theme-init.js`, `src/lib/theme.ts`, `src/app/ThemeProvider.tsx`, `DESIGN.md`
- Test: `src/lib/theme.test.ts`

**Interfaces:**
- Produces: `type ThemePref = 'system' | 'light' | 'dark'`, `type ResolvedTheme = 'light' | 'dark'`, `THEME_KEY = 'pvb-theme'`, `readPref(storage?)`, `writePref(pref, storage?)`, `resolveTheme(pref, prefersDark)`, `applyTheme(theme, root?)`; `ThemeProvider` and `useTheme(): { pref: ThemePref; resolved: ResolvedTheme; setPref(p: ThemePref): void }`. Tailwind colour utilities listed in Global Constraints; custom utilities `sheet-in`, `drawer-in`, `tabular`.

- [ ] **Step 1: Write the failing tests**

`src/lib/theme.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import { applyTheme, readPref, resolveTheme, THEME_KEY, writePref } from './theme';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  };
}

describe('readPref', () => {
  test('defaults to system', () => expect(readPref(memoryStorage())).toBe('system'));
  test('reads a stored override', () => expect(readPref(memoryStorage({ [THEME_KEY]: 'dark' }))).toBe('dark'));
  test('ignores junk values', () => expect(readPref(memoryStorage({ [THEME_KEY]: 'purple' }))).toBe('system'));
  test('survives storage that throws', () => {
    const broken = { getItem: () => { throw new Error('denied'); } };
    expect(readPref(broken)).toBe('system');
  });
});

test('writePref stores overrides and clears system', () => {
  const s = memoryStorage();
  writePref('light', s);
  expect(s.data.get(THEME_KEY)).toBe('light');
  writePref('system', s);
  expect(s.data.has(THEME_KEY)).toBe(false);
});

test('resolveTheme follows the system only for "system"', () => {
  expect(resolveTheme('system', true)).toBe('dark');
  expect(resolveTheme('system', false)).toBe('light');
  expect(resolveTheme('light', true)).toBe('light');
  expect(resolveTheme('dark', false)).toBe('dark');
});

test('applyTheme sets data-theme, color-scheme and theme-color', () => {
  document.head.innerHTML = '<meta name="theme-color" content="#000000" />';
  applyTheme('dark', document.documentElement);
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(document.documentElement.style.colorScheme).toBe('dark');
  expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#09090B');
  applyTheme('light', document.documentElement);
  expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#F1F5F9');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun run test src/lib/theme.test.ts`
Expected: FAIL — cannot resolve `./theme`.

- [ ] **Step 3: Implement `src/lib/theme.ts`**

```ts
export type ThemePref = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';
export const THEME_KEY = 'pvb-theme';
const CANVAS: Record<ResolvedTheme, string> = { light: '#F1F5F9', dark: '#09090B' };

type Reader = Pick<Storage, 'getItem'>;
type Writer = Pick<Storage, 'setItem' | 'removeItem'>;

export function readPref(storage: Reader = window.localStorage): ThemePref {
  try {
    const v = storage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function writePref(pref: ThemePref, storage: Writer = window.localStorage): void {
  try {
    if (pref === 'system') storage.removeItem(THEME_KEY);
    else storage.setItem(THEME_KEY, pref);
  } catch {
    // Private mode or blocked storage: the choice lasts for this visit only.
  }
}

export const resolveTheme = (pref: ThemePref, prefersDark: boolean): ResolvedTheme =>
  pref === 'system' ? (prefersDark ? 'dark' : 'light') : pref;

export function applyTheme(theme: ResolvedTheme, root: HTMLElement = document.documentElement): void {
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', CANVAS[theme]);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `bun run test src/lib/theme.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Write the full token stylesheet**

`src/styles/tokens.css`:
```css
@import "tailwindcss";

@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));

/* Switch off Tailwind's default palette: only semantic tokens exist. */
@theme {
  --color-*: initial;
}

:root {
  --canvas: #F1F5F9;
  --surface: #FFFFFF;
  --surface-2: #F8FAFC;
  --line: #E2E8F0;
  --fg: #0F172A;
  --muted: #475569;
  --accent: #4F46E5;
  --accent-solid: #4F46E5;
  --on-accent: #FFFFFF;
  --accent-soft: #EEF2FF;
  --success: #047857;
  --warning: #B45309;
  --danger: #E11D48;
  --info: #0369A1;
  --soft: 10%;
  --scrim: rgb(15 23 42 / 0.45);
  color-scheme: light;
}

[data-theme=dark] {
  --canvas: #09090B;
  --surface: #18181B;
  --surface-2: #27272A;
  --line: #3F3F46;
  --fg: #F4F4F5;
  --muted: #A1A1AA;
  --accent: #818CF8;
  --accent-solid: #4F46E5;
  --on-accent: #FFFFFF;
  --accent-soft: rgb(99 102 241 / 0.15);
  --success: #34D399;
  --warning: #FBBF24;
  --danger: #FB7185;
  --info: #38BDF8;
  --soft: 15%;
  --scrim: rgb(0 0 0 / 0.6);
  color-scheme: dark;
}

@theme inline {
  --color-canvas: var(--canvas);
  --color-surface: var(--surface);
  --color-surface-2: var(--surface-2);
  --color-line: var(--line);
  --color-fg: var(--fg);
  --color-muted: var(--muted);
  --color-accent: var(--accent);
  --color-accent-solid: var(--accent-solid);
  --color-on-accent: var(--on-accent);
  --color-accent-soft: var(--accent-soft);
  --color-success: var(--success);
  --color-warning: var(--warning);
  --color-danger: var(--danger);
  --color-info: var(--info);
  --color-success-soft: color-mix(in srgb, var(--success) var(--soft), transparent);
  --color-warning-soft: color-mix(in srgb, var(--warning) var(--soft), transparent);
  --color-danger-soft: color-mix(in srgb, var(--danger) var(--soft), transparent);
  --color-info-soft: color-mix(in srgb, var(--info) var(--soft), transparent);
  --color-scrim: var(--scrim);
  --font-sans: "Inter Variable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}

@layer base {
  html {
    background: var(--canvas);
    color: var(--fg);
    -webkit-text-size-adjust: 100%;
  }
  body {
    min-height: 100dvh;
    font-family: var(--font-sans);
    font-size: 1rem;
    line-height: 1.5;
    -webkit-tap-highlight-color: transparent;
  }
  :focus-visible {
    outline: 3px solid var(--accent);
    outline-offset: 2px;
  }
}

@utility tabular {
  font-variant-numeric: tabular-nums;
}
@utility sheet-in {
  animation: sheet-in 240ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
@utility drawer-in {
  animation: drawer-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

@keyframes sheet-in {
  from { transform: translateY(100%); }
}
@keyframes drawer-in {
  from { transform: translateX(100%); }
}
@keyframes vt-in {
  from { opacity: 0; transform: translateY(6px); }
}
@keyframes vt-out {
  to { opacity: 0; }
}
::view-transition-old(root) { animation: vt-out 150ms ease-out both; }
::view-transition-new(root) { animation: vt-in 200ms ease-out both; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
  ::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*) {
    animation: none !important;
  }
}
```

- [ ] **Step 6: Set the theme before first paint**

`public/theme-init.js`:
```js
(function () {
  var root = document.documentElement;
  try {
    var pref = localStorage.getItem('pvb-theme');
    var dark = pref === 'dark' || (pref !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var theme = dark ? 'dark' : 'light';
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#09090B' : '#F1F5F9');
  } catch (e) {
    root.dataset.theme = 'light';
  }
})();
```

In `index.html`, add after the `theme-color` meta:
```html
    <script src="/theme-init.js"></script>
```

- [ ] **Step 7: Add the theme provider**

`src/app/ThemeProvider.tsx`:
```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { applyTheme, readPref, resolveTheme, writePref, type ResolvedTheme, type ThemePref } from '@/lib/theme';

type ThemeState = { pref: ThemePref; resolved: ResolvedTheme; setPref: (p: ThemePref) => void };
const ThemeContext = createContext<ThemeState | null>(null);
const DARK_QUERY = '(prefers-color-scheme: dark)';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(() => readPref());
  const [prefersDark, setPrefersDark] = useState(() => window.matchMedia(DARK_QUERY).matches);

  useEffect(() => {
    const mq = window.matchMedia(DARK_QUERY);
    const onChange = (e: MediaQueryListEvent) => setPrefersDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const resolved = resolveTheme(pref, prefersDark);
  useEffect(() => applyTheme(resolved), [resolved]);

  const setPref = useCallback((p: ThemePref) => {
    writePref(p);
    setPrefState(p);
  }, []);

  const value = useMemo(() => ({ pref, resolved, setPref }), [pref, resolved, setPref]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
```

In `src/main.tsx`, add above the tokens import:
```tsx
import '@fontsource-variable/inter';
```

- [ ] **Step 8: Write `DESIGN.md`**

```markdown
# Premium Village Bank — Design system

The template's identity, cleaned up: slate in light mode, zinc in dark mode, one indigo accent, Inter.
Source of truth for values: `src/styles/tokens.css`. Rules are enforced by `scripts/check-tokens.mjs`.

## Colour tokens

| Spec token | Tailwind utility | Light | Dark | Use |
|---|---|---|---|---|
| bg | `bg-canvas` | #F1F5F9 | #09090B | app background |
| surface | `bg-surface` | #FFFFFF | #18181B | cards, sheets, bars |
| surface-2 | `bg-surface-2` | #F8FAFC | #27272A | insets, table headers, chips |
| line | `border-line` | #E2E8F0 | #3F3F46 | borders, dividers |
| text | `text-fg` | #0F172A | #F4F4F5 | primary text |
| text-muted | `text-muted` | #475569 | #A1A1AA | secondary text |
| accent | `text-accent`, `ring-accent` | #4F46E5 | #818CF8 | links, active nav, focus |
| accent-solid | `bg-accent-solid` + `text-on-accent` | #4F46E5 | #4F46E5 | filled buttons |
| accent-soft | `bg-accent-soft` | #EEF2FF | indigo 15% | selected rows, active nav pill |
| success / warning / danger / info | `text-success` … and `bg-success-soft` … | emerald-700 / amber-700 / rose-600 / sky-700 | emerald-400 / amber-400 / rose-400 / sky-400 | status and money |
| scrim | `bg-scrim` | slate-900 45% | black 60% | behind sheets |

Money: savings and earnings `success`, amounts owed `warning`, penalties and losses `danger`.

## Rules

- No raw palette classes, no `dark:` colour variants, no gradients, no glow shadows, no glass blur on cards
  (blur is allowed only on the sticky top bar and bottom nav).
- Light mode cards use `shadow-sm`; dark mode relies on `border-line`.
- Text: 12px minimum (metadata only), 16px body on phones, `tabular` on every figure.
- Controls: `rounded-xl`; cards `rounded-2xl`; badges and chips `rounded-full`; primary controls 48px tall.
- Every badge carries a text label and a glyph; colour never stands alone.
- Motion 150–200ms ease-out; everything stops under `prefers-reduced-motion`.
- Icons: lucide-react; icon-only buttons need an accessible label.
```

- [ ] **Step 9: Verify build and visuals**

Run: `bun run typecheck && bun run test && bun run dev`
Expected: tests pass; at http://localhost:3000 the heading renders in Inter on `#F1F5F9`. In devtools run `localStorage.setItem('pvb-theme','dark'); location.reload()` → background `#09090B` with no white flash. Then `localStorage.removeItem('pvb-theme')`.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add cleaned light/dark token system with pre-paint theme switching"
```

---

### Task 4: Tokenised UI primitives and the token guard

**Files:**
- Create: `scripts/check-tokens.mjs`, `scripts/check-tokens.test.mjs`
- Create: `src/ui/cn.ts`, `src/ui/Button.tsx`, `src/ui/IconButton.tsx`, `src/ui/Card.tsx`, `src/ui/Badge.tsx`, `src/ui/TextField.tsx`, `src/ui/Skeleton.tsx`, `src/ui/EmptyState.tsx`, `src/ui/Alert.tsx`, `src/ui/Avatar.tsx`, `src/ui/Sheet.tsx`, `src/ui/Toast.tsx`, `src/ui/PageHeader.tsx`, `src/ui/useConfirmTap.ts`, `src/ui/index.ts`
- Test: `src/ui/Button.test.tsx`, `src/ui/Badge.test.tsx`, `src/ui/Sheet.test.tsx`, `src/ui/useConfirmTap.test.tsx`

**Interfaces:**
- Produces (all exported from `@/ui`):
  - `cn(...parts: Array<string | false | null | undefined>): string`
  - `Button` props: `variant?: 'primary'|'secondary'|'ghost'|'danger'`, `size?: 'sm'|'md'`, `isLoading?`, `leftIcon?`, `fullWidth?` + native button props
  - `IconButton` props: `label: string`, `icon: ReactNode`, `badge?: number` + native button props
  - `Card`, `CardHeader({ title, subtitle?, action? })`
  - `type Tone = 'neutral'|'accent'|'success'|'warning'|'danger'|'info'`; `Badge({ tone?, children })`
  - `TextField({ label, hint?, error?, ...inputProps })`
  - `Skeleton({ className? })`, `EmptyState({ icon?, title, children?, action? })`, `Alert({ tone?, title?, children, action? })`, `Avatar({ name, src?, size? })`
  - `Sheet({ open, onClose, title, description?, children, footer? })` — bottom sheet under 768px, right drawer above
  - `ToastProvider`, `useToast(): (message: string, opts?: { tone?: 'neutral'|'success'|'danger'; action?: { label: string; onClick(): void } }) => void`
  - `PageHeader({ title, subtitle?, actions? })`
  - `useConfirmTap(onConfirm: () => void, timeoutMs?: number): { armed: boolean; tap(): void; reset(): void }`
  - `node scripts/check-tokens.mjs <dir>` exits 1 and prints `file:line rule match` on violations; exports `scan(text): Array<{ line: number; rule: string; match: string }>`

- [ ] **Step 1: Write the failing guard tests**

`scripts/check-tokens.test.mjs`:
```js
import { expect, test } from 'vitest';
import { scan } from './check-tokens.mjs';

test('flags raw palette colours', () => {
  expect(scan('<div className="bg-zinc-900 text-slate-500">')).toHaveLength(1);
  expect(scan('<div className="bg-white">')[0]?.rule).toBe('raw palette colour');
  expect(scan('<p className="text-indigo-600/80">')[0]?.match).toBe('text-indigo-600/80');
});

test('flags tiny text, theme ternaries, dark colour variants and gradients', () => {
  expect(scan('text-[10px]')[0]?.rule).toBe('text under 12px');
  expect(scan('const c = isLight ? a : b')[0]?.rule).toBe('theme ternary');
  expect(scan('dark:bg-surface')[0]?.rule).toBe('dark: colour variant');
  expect(scan('bg-gradient-to-r')[0]?.rule).toBe('gradient');
});

test('allows semantic tokens', () => {
  expect(scan('bg-surface text-fg border-line bg-accent-solid text-on-accent bg-success-soft text-xs')).toEqual([]);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun run test scripts/check-tokens.test.mjs`
Expected: FAIL — cannot find `./check-tokens.mjs`.

- [ ] **Step 3: Implement the guard**

`scripts/check-tokens.mjs`:
```js
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PALETTE = 'slate|zinc|gray|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black';
const PROPS = 'bg|text|border|ring|from|via|to|shadow|fill|stroke|divide|outline|placeholder|decoration|caret';

export const RULES = [
  { name: 'raw palette colour', re: new RegExp(`\\b(?:${PROPS})-(?:${PALETTE})(?:-\\d{2,3})?(?:\\/\\d{1,3})?(?![\\w-])`) },
  { name: 'text under 12px', re: /text-\[(?:\d|1[01])px\]/ },
  { name: 'theme ternary', re: /\bisLight\b/ },
  { name: 'dark: colour variant', re: /\bdark:(?:bg|text|border|ring)-/ },
  { name: 'gradient', re: /\bbg-(?:gradient|linear)-to-/ },
];

export function scan(text) {
  const hits = [];
  text.split('\n').forEach((line, i) => {
    for (const rule of RULES) {
      const m = line.match(rule.re);
      if (m) hits.push({ line: i + 1, rule: rule.name, match: m[0] });
    }
  });
  return hits;
}

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (['.ts', '.tsx', '.css'].includes(extname(p)) && !p.endsWith('database.types.ts')) yield p;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = process.argv[2] ?? 'src';
  let count = 0;
  for (const f of files(root)) {
    for (const h of scan(readFileSync(f, 'utf8'))) {
      console.error(`${f}:${h.line} ${h.rule}: ${h.match}`);
      count++;
    }
  }
  if (count) {
    console.error(`\n${count} design-token violation(s). See DESIGN.md.`);
    process.exit(1);
  }
  console.log('check-tokens: clean');
}
```

- [ ] **Step 4: Run guard tests**

Run: `bun run test scripts/check-tokens.test.mjs && bun run check:tokens`
Expected: PASS (3 tests); `check-tokens: clean`.

- [ ] **Step 5: Write the failing component tests**

`src/ui/Button.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { Button } from './Button';

test('fires onClick', async () => {
  const onClick = vi.fn();
  render(<Button onClick={onClick}>Save</Button>);
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(onClick).toHaveBeenCalledOnce();
});

test('is disabled and busy while loading', () => {
  render(<Button isLoading>Save</Button>);
  const btn = screen.getByRole('button', { name: 'Save' });
  expect(btn).toBeDisabled();
  expect(btn).toHaveAttribute('aria-busy', 'true');
});

test('defaults to type=button so it never submits forms by accident', () => {
  render(<Button>Go</Button>);
  expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
});
```

`src/ui/Badge.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { Badge } from './Badge';

test('shows a text label with a decorative glyph', () => {
  const { container } = render(<Badge tone="warning">Pending</Badge>);
  expect(screen.getByText('Pending')).toBeInTheDocument();
  const svg = container.querySelector('svg');
  expect(svg).not.toBeNull();
  expect(svg).toHaveAttribute('aria-hidden', 'true');
});
```

`src/ui/Sheet.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { expect, test } from 'vitest';
import { Sheet } from './Sheet';

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Settings">
        <button>Inside</button>
      </Sheet>
    </>
  );
}

test('opens as a labelled modal dialog, closes on Escape, and returns focus', async () => {
  render(<Harness />);
  const opener = screen.getByRole('button', { name: 'Open' });
  await userEvent.click(opener);
  const dialog = screen.getByRole('dialog', { name: 'Settings' });
  expect(dialog).toHaveAttribute('aria-modal', 'true');
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(opener).toHaveFocus();
});

test('closes from the close button', async () => {
  render(<Harness />);
  await userEvent.click(screen.getByRole('button', { name: 'Open' }));
  await userEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(screen.queryByRole('dialog')).toBeNull();
});
```

`src/ui/useConfirmTap.test.tsx`:
```tsx
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { useConfirmTap } from './useConfirmTap';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test('first tap arms, second tap confirms', () => {
  const onConfirm = vi.fn();
  const { result } = renderHook(() => useConfirmTap(onConfirm));
  act(() => result.current.tap());
  expect(result.current.armed).toBe(true);
  expect(onConfirm).not.toHaveBeenCalled();
  act(() => result.current.tap());
  expect(onConfirm).toHaveBeenCalledOnce();
  expect(result.current.armed).toBe(false);
});

test('disarms after the timeout', () => {
  const onConfirm = vi.fn();
  const { result } = renderHook(() => useConfirmTap(onConfirm, 4000));
  act(() => result.current.tap());
  act(() => vi.advanceTimersByTime(4001));
  expect(result.current.armed).toBe(false);
  act(() => result.current.tap());
  expect(onConfirm).not.toHaveBeenCalled();
});
```

- [ ] **Step 6: Run to verify failure**

Run: `bun run test src/ui`
Expected: FAIL — modules not found.

- [ ] **Step 7: Implement the primitives**

`src/ui/cn.ts`:
```ts
export const cn = (...parts: Array<string | false | null | undefined>): string => parts.filter(Boolean).join(' ');
```

`src/ui/Button.tsx`:
```tsx
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from './cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  fullWidth?: boolean;
}

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-accent-solid text-on-accent hover:brightness-110',
  secondary: 'border border-line bg-surface text-fg hover:bg-surface-2',
  ghost: 'text-fg hover:bg-surface-2',
  danger: 'border border-danger/30 bg-danger-soft text-danger hover:bg-danger/15',
};
const SIZE: Record<ButtonSize, string> = { sm: 'h-11 px-4 text-sm', md: 'h-12 px-5 text-base' };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', isLoading = false, leftIcon, fullWidth = false, disabled, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition duration-150 ease-out active:scale-[.97] disabled:pointer-events-none disabled:opacity-50',
        VARIANT[variant],
        SIZE[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {isLoading ? (
        <Loader2 aria-hidden className="size-4 animate-spin" />
      ) : leftIcon ? (
        <span aria-hidden className="shrink-0">{leftIcon}</span>
      ) : null}
      <span>{children}</span>
    </button>
  );
});
```

`src/ui/IconButton.tsx`:
```tsx
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon: ReactNode;
  badge?: number;
}

export function IconButton({ label, icon, badge, className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={badge ? `${label}, ${badge} waiting` : label}
      title={label}
      className={cn(
        'relative inline-grid size-11 place-items-center rounded-xl text-muted transition duration-150 hover:bg-surface-2 hover:text-fg active:scale-[.97]',
        className,
      )}
      {...rest}
    >
      <span aria-hidden>{icon}</span>
      {badge ? (
        <span aria-hidden className="absolute -right-0.5 -top-0.5 min-w-5 rounded-full bg-danger px-1 text-center text-xs font-semibold leading-5 text-on-accent">
          {badge}
        </span>
      ) : null}
    </button>
  );
}
```

`src/ui/Card.tsx`:
```tsx
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-2xl border border-line bg-surface p-4 shadow-sm md:p-5 dark:shadow-none', className)} {...rest} />;
}

export function CardHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-fg">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
```

`src/ui/Badge.tsx`:
```tsx
import type { ReactNode } from 'react';
import { AlertTriangle, Check, Circle, Clock, Dot, Info, type LucideIcon } from 'lucide-react';
import { cn } from './cn';

export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

const TONE: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-muted',
  accent: 'bg-accent-soft text-accent',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
};
const GLYPH: Record<Tone, LucideIcon> = { neutral: Circle, accent: Dot, success: Check, warning: Clock, danger: AlertTriangle, info: Info };

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  const Glyph = GLYPH[tone];
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold', TONE[tone], className)}>
      <Glyph aria-hidden className="size-3.5" />
      {children}
    </span>
  );
}
```

`src/ui/TextField.tsx`:
```tsx
import { useId, type InputHTMLAttributes } from 'react';
import { cn } from './cn';

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
}

export function TextField({ label, hint, error, id, className, ...rest }: TextFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;
  const describedBy = [hint && !error ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('grid gap-1.5', className)}>
      <label htmlFor={fieldId} className="text-sm font-medium text-fg">{label}</label>
      <input
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          'h-12 w-full rounded-xl border bg-surface px-3.5 text-base text-fg transition placeholder:text-muted focus-visible:border-accent',
          error ? 'border-danger' : 'border-line',
        )}
        {...rest}
      />
      {hint && !error ? <p id={hintId} className="text-sm text-muted">{hint}</p> : null}
      {error ? <p id={errorId} role="alert" className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
```

`src/ui/Skeleton.tsx`:
```tsx
import { cn } from './cn';

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-xl bg-surface-2', className)} />;
}
```

`src/ui/EmptyState.tsx`:
```tsx
import type { ReactNode } from 'react';

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {icon ? <div aria-hidden className="mb-4 grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent">{icon}</div> : null}
      <h2 className="text-lg font-semibold text-fg">{title}</h2>
      {children ? <div className="mt-2 max-w-sm text-base text-muted">{children}</div> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
```

`src/ui/Alert.tsx`:
```tsx
import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { cn } from './cn';

type AlertTone = 'info' | 'success' | 'warning' | 'danger';
const STYLE: Record<AlertTone, string> = {
  info: 'bg-info-soft text-info',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
};
const ICON = { info: Info, success: CheckCircle2, warning: AlertTriangle, danger: AlertTriangle };

export function Alert({ tone = 'info', title, children, action }: { tone?: AlertTone; title?: string; children: ReactNode; action?: ReactNode }) {
  const Icon = ICON[tone];
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('flex gap-3 rounded-xl p-3.5', STYLE[tone])}>
      <Icon aria-hidden className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0 flex-1 text-sm text-fg">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div>{children}</div>
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
    </div>
  );
}
```

`src/ui/Avatar.tsx`:
```tsx
import { cn } from './cn';

const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';

export function Avatar({ name, src, size = 'md' }: { name: string; src?: string | null; size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'size-8 text-xs' : 'size-10 text-sm';
  return src ? (
    <img src={src} alt="" className={cn('rounded-full object-cover', box)} />
  ) : (
    <span aria-hidden className={cn('grid place-items-center rounded-full bg-accent-soft font-semibold text-accent', box)}>
      {initials(name)}
    </span>
  );
}
```

`src/ui/useConfirmTap.ts`:
```ts
import { useCallback, useEffect, useRef, useState } from 'react';

export function useConfirmTap(onConfirm: () => void, timeoutMs = 4000) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const tap = useCallback(() => {
    if (armed) {
      window.clearTimeout(timer.current);
      setArmed(false);
      onConfirm();
      return;
    }
    setArmed(true);
    timer.current = window.setTimeout(() => setArmed(false), timeoutMs);
  }, [armed, onConfirm, timeoutMs]);

  const reset = useCallback(() => {
    window.clearTimeout(timer.current);
    setArmed(false);
  }, []);

  return { armed, tap, reset };
}
```

`src/ui/Sheet.tsx`:
```tsx
import { useEffect, useId, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function trapFocus(e: KeyboardEvent, root: HTMLElement | null) {
  if (!root) return;
  const items = root.querySelectorAll<HTMLElement>(FOCUSABLE);
  if (items.length === 0) return;
  const first = items[0]!;
  const last = items[items.length - 1]!;
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

export function Sheet({ open, onClose, title, description, children, footer }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const titleId = useId();
  const descId = useId();
  const [drag, setDrag] = useState(0);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
      }
      if (e.key === 'Tab') trapFocus(e, panelRef.current);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    startY.current = e.clientY;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (startY.current !== null) setDrag(Math.max(0, e.clientY - startY.current));
  };
  const onPointerUp = () => {
    if (drag > 96) onClose();
    setDrag(0);
    startY.current = null;
  };

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div aria-hidden className="absolute inset-0 bg-scrim" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        style={drag ? { transform: `translateY(${drag}px)` } : undefined}
        className="sheet-in md:drawer-in absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-t-3xl bg-surface pb-[env(safe-area-inset-bottom)] shadow-xl outline-none md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[440px] md:rounded-l-3xl md:rounded-tr-none"
      >
        <div className="touch-none py-2.5 md:hidden" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
          <div aria-hidden className="mx-auto h-1.5 w-10 rounded-full bg-line" />
        </div>
        <header className="flex items-start justify-between gap-3 px-5 pb-3 md:pt-5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-xl font-semibold text-fg">{title}</h2>
            {description ? <p id={descId} className="mt-1 text-sm text-muted">{description}</p> : null}
          </div>
          <IconButton label="Close" icon={<X className="size-5" />} onClick={onClose} />
        </header>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-5">{children}</div>
        {footer ? <div className="border-t border-line px-5 py-3">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
```

`src/ui/Toast.tsx`:
```tsx
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';

type ToastTone = 'neutral' | 'success' | 'danger';
type ToastOptions = { tone?: ToastTone; action?: { label: string; onClick: () => void } };
type ToastItem = { id: number; message: string; tone: ToastTone; action?: ToastOptions['action'] };
type Show = (message: string, opts?: ToastOptions) => void;

const ToastContext = createContext<Show>(() => {});
const ICON = { neutral: Info, success: CheckCircle2, danger: AlertTriangle };
let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const show = useCallback<Show>((message, opts = {}) => {
    const id = nextId++;
    setItems((list) => [...list.slice(-2), { id, message, tone: opts.tone ?? 'neutral', action: opts.action }]);
    window.setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), 5000);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(88px+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6"
      >
        {items.map((t) => {
          const Icon = ICON[t.tone];
          return (
            <div key={t.id} className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl bg-fg px-4 py-3 text-sm text-canvas shadow-lg">
              <Icon aria-hidden className="size-5 shrink-0" />
              <span className="flex-1">{t.message}</span>
              {t.action ? (
                <button type="button" onClick={t.action.onClick} className="min-h-11 rounded-lg px-2 font-semibold underline">
                  {t.action.label}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = (): Show => useContext(ToastContext);
```

`src/ui/PageHeader.tsx`:
```tsx
import type { ReactNode } from 'react';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-fg md:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-base text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex gap-2">{actions}</div> : null}
    </header>
  );
}
```

`src/ui/index.ts`:
```ts
export { cn } from './cn';
export { Button, type ButtonProps } from './Button';
export { IconButton } from './IconButton';
export { Card, CardHeader } from './Card';
export { Badge, type Tone } from './Badge';
export { TextField } from './TextField';
export { Skeleton } from './Skeleton';
export { EmptyState } from './EmptyState';
export { Alert } from './Alert';
export { Avatar } from './Avatar';
export { Sheet } from './Sheet';
export { ToastProvider, useToast } from './Toast';
export { PageHeader } from './PageHeader';
export { useConfirmTap } from './useConfirmTap';
```

- [ ] **Step 8: Run tests, guard and lint**

Run: `bun run test && bun run check:tokens && bun run lint && bun run typecheck`
Expected: all tests pass (format 8, theme 7, guard 3, ui 8, App 1); guard clean; no lint/type errors.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add tokenised UI primitives and design-token CI guard"
```

---
### Task 5: Local Supabase stack and the core schema

**Prerequisites (one-time, on the developer machine):** Docker running (`docker info` succeeds). The Supabase CLI comes from the `supabase` dev dependency (`bun x supabase --version` prints 2.x).

**Files:**
- Create: `supabase/config.toml` (via `supabase init`, then edited), `supabase/migrations/20261008000100_core_schema.sql`, `supabase/tests/database/01_schema.sql`, `.env.example`

**Interfaces:**
- Produces tables `public.groups`, `public.members`, `public.invites`, `public.cycles`, `public.cycle_rules`, `public.audit_log` exactly as in spec §5, all with RLS enabled (no policies yet → deny all). Child tables cascade on group/cycle delete.

- [ ] **Step 1: Initialise the Supabase project**

```bash
bun x supabase init --with-vscode-settings=false
```

Edit `supabase/config.toml` — set these keys (leave the rest as generated):
```toml
project_id = "premium-village-bank"

[auth]
site_url = "http://localhost:3000"
additional_redirect_urls = ["http://localhost:3000/**", "http://127.0.0.1:3000/**"]
enable_signup = false

[auth.email]
enable_signup = false
double_confirm_changes = true
enable_confirmations = false

[db.seed]
enabled = true
sql_paths = ["./seed.sql"]
```

Create `.env.example`:
```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=paste-the-anon-key-printed-by-supabase-start
```

- [ ] **Step 2: Write the failing schema test**

`supabase/tests/database/01_schema.sql`:
```sql
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

select has_table('public', t, t || ' exists')
from unnest(array['groups', 'members', 'invites', 'cycles', 'cycle_rules', 'audit_log']) as t;

select ok(
  (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass),
  'RLS is enabled on ' || t
)
from unnest(array['groups', 'members', 'invites', 'cycles', 'cycle_rules', 'audit_log']) as t;

select col_default_is('public', 'groups', 'figures_visibility', 'open'::text, 'figures are open by default');
select col_default_is('public', 'groups', 'currency', 'ZMW'::text, 'currency defaults to ZMW');
select col_default_is('public', 'members', 'role', 'member'::text, 'new members are plain members');
select col_default_is('public', 'cycles', 'status', 'planned'::text, 'new cycles are planned');
select col_has_default('public', 'cycle_rules', 'min_saving', 'minimum saving has a default (K250)');

select throws_ok(
  $$insert into public.groups (name, owner_user_id, figures_visibility) values ('x', gen_random_uuid(), 'secret')$$,
  '23514', null, 'figures_visibility only accepts open or private'
);

select * from finish();
rollback;
```

- [ ] **Step 3: Start the stack and watch the test fail**

```bash
bun run db:start
bun run db:test
```
Expected: `01_schema.sql` fails — `Table public.groups should exist`.

- [ ] **Step 4: Write the migration**

`supabase/migrations/20261008000100_core_schema.sql`:
```sql
-- Core tables for groups, members, invites, cycles, cycle rules and the audit log.
-- RLS is enabled on every table here; policies arrive in the next migration.

create extension if not exists pgcrypto with schema extensions;

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (length(trim(name)) between 1 and 120),
  currency text not null default 'ZMW',
  owner_user_id uuid not null references auth.users on delete restrict,
  figures_visibility text not null default 'open' check (figures_visibility in ('open', 'private'))
);
create index groups_owner_idx on public.groups (owner_user_id);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  group_id uuid not null references public.groups on delete cascade,
  full_name text not null check (length(trim(full_name)) between 1 and 120),
  short_name text not null check (length(trim(short_name)) between 1 and 40),
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text,
  user_id uuid references auth.users on delete set null,
  role text not null default 'member' check (role in ('member', 'admin')),
  status text not null default 'active' check (status in ('active', 'left')),
  joined_on date not null default current_date,
  unique (group_id, user_id),
  unique (group_id, short_name)
);
create index members_user_idx on public.members (user_id);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  group_id uuid not null references public.groups on delete cascade,
  member_id uuid not null references public.members on delete cascade,
  email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_by uuid not null references auth.users on delete restrict
);
create index invites_member_idx on public.invites (member_id);

create table public.cycles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  group_id uuid not null references public.groups on delete cascade,
  label text not null check (length(trim(label)) between 1 and 60),
  starts_on date not null,
  ends_on date not null,
  payout_on date not null,
  status text not null default 'planned' check (status in ('planned', 'active', 'closed')),
  check (ends_on > starts_on),
  check (payout_on <= ends_on)
);
create index cycles_group_idx on public.cycles (group_id, starts_on);

create table public.cycle_rules (
  cycle_id uuid primary key references public.cycles on delete cascade,
  created_at timestamptz not null default now(),
  min_saving numeric(12, 2) not null default 250 check (min_saving >= 0),
  loan_rate numeric(5, 4) not null default 0.15 check (loan_rate between 0 and 1),
  excess_rate numeric(5, 4) not null default 0.10 check (excess_rate between 0 and 1),
  penalty_per_day numeric(12, 2) not null default 50 check (penalty_per_day >= 0),
  membership_fee numeric(12, 2) not null default 50 check (membership_fee >= 0),
  window_open_day int not null default 5 check (window_open_day between 1 and 28),
  window_close_day int not null default 7 check (window_close_day between 1 and 28),
  loan_multiples jsonb not null check (jsonb_typeof(loan_multiples) = 'array'),
  tenor_bands jsonb not null check (jsonb_typeof(tenor_bands) = 'array'),
  check (window_close_day >= window_open_day)
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  group_id uuid not null references public.groups on delete cascade,
  actor_user_id uuid references auth.users on delete set null,
  action text not null,
  entity text not null,
  entity_id uuid,
  data jsonb not null default '{}'
);
create index audit_log_group_idx on public.audit_log (group_id, created_at desc);

alter table public.groups enable row level security;
alter table public.members enable row level security;
alter table public.invites enable row level security;
alter table public.cycles enable row level security;
alter table public.cycle_rules enable row level security;
alter table public.audit_log enable row level security;
```

- [ ] **Step 5: Apply and verify**

```bash
bun run db:reset
bun run db:test
```
Expected: `01_schema.sql .. ok`, all assertions pass. (`db:reset` will warn that `seed.sql` is missing; that file arrives in Task 8.)

- [ ] **Step 6: Commit**

```bash
git add supabase .env.example
git commit -m "feat: add Supabase project with core schema and RLS enabled"
```

---

### Task 6: Access helpers, RLS policies and the member list view

**Files:**
- Create: `supabase/migrations/20261008000200_access_rls.sql`, `supabase/tests/database/00_helpers.sql`, `supabase/tests/database/02_rls.sql`

**Interfaces:**
- Consumes: Task 5 tables.
- Produces SQL functions (callable by `authenticated`): `public.is_member(p_group_id uuid) → boolean`, `public.is_admin(p_group_id uuid) → boolean`, `public.can_see_figures(p_group_id uuid, p_member_id uuid) → boolean`; view `public.group_members (id, group_id, full_name, short_name, role, status, linked, joined_on)`; column-level grants listed below. Test helpers in schema `tests`: `tests.create_user(email) → uuid`, `tests.login_as(uuid)`, `tests.login_anon()`, `tests.fixture()`, `tests.id(name) → uuid` with names `owner, admin, member, other, outsider, owner2, group, group2, m_owner, m_admin, m_member, m_other, m_unlinked, m_g2, c_planned, c_active`.

Note: `is_member` also returns true for the group owner (`groups.owner_user_id`), so an owner who is not on the member list can still open their group. This matches `is_admin`, which already includes the owner.

- [ ] **Step 1: Write the test helpers**

`supabase/tests/database/00_helpers.sql` (not wrapped in a transaction — later files reuse what it creates):
```sql
create extension if not exists pgtap with schema extensions;
create schema if not exists tests;
grant usage on schema tests to anon, authenticated;

create or replace function tests.create_user(p_email text) returns uuid
language plpgsql security definer set search_path = auth, public as $$
declare v uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (v, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email, '{"provider":"email"}', '{}', now(), now());
  return v;
end $$;

create or replace function tests.login_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object(
    'sub', p_user, 'role', 'authenticated', 'email', (select email from auth.users where id = p_user))::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create or replace function tests.login_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  perform set_config('role', 'anon', true);
end $$;

create table if not exists tests.ids (name text primary key, id uuid not null);
grant select on tests.ids to anon, authenticated;

create or replace function tests.id(p_name text) returns uuid language sql stable as $$
  select id from tests.ids where name = p_name
$$;

create or replace function tests.remember(p_name text, p_id uuid) returns uuid language sql as $$
  insert into tests.ids values (p_name, p_id) on conflict (name) do update set id = excluded.id returning id
$$;

create or replace function tests.fixture() returns void
language plpgsql security definer set search_path = public, tests as $$
declare g uuid; g2 uuid; v uuid;
  multiples jsonb := '[{"from_month":1,"to_month":12,"multiple":2}]';
  tenors jsonb := '[{"max":null,"months":4}]';
begin
  delete from tests.ids;
  perform tests.remember('owner', tests.create_user('owner@test.local'));
  perform tests.remember('admin', tests.create_user('admin@test.local'));
  perform tests.remember('member', tests.create_user('member@test.local'));
  perform tests.remember('other', tests.create_user('other@test.local'));
  perform tests.remember('outsider', tests.create_user('outsider@test.local'));
  perform tests.remember('owner2', tests.create_user('owner2@test.local'));

  insert into groups (name, owner_user_id) values ('Test Group', tests.id('owner')) returning id into g;
  insert into groups (name, owner_user_id) values ('Other Group', tests.id('owner2')) returning id into g2;
  perform tests.remember('group', g);
  perform tests.remember('group2', g2);

  insert into members (group_id, full_name, short_name, user_id, role) values (g, 'Olive Owner', 'Olive', tests.id('owner'), 'admin') returning id into v;
  perform tests.remember('m_owner', v);
  insert into members (group_id, full_name, short_name, user_id, role) values (g, 'Adam Admin', 'Adam', tests.id('admin'), 'admin') returning id into v;
  perform tests.remember('m_admin', v);
  insert into members (group_id, full_name, short_name, user_id) values (g, 'Mary Member', 'Mary', tests.id('member')) returning id into v;
  perform tests.remember('m_member', v);
  insert into members (group_id, full_name, short_name, user_id) values (g, 'Other Member', 'Otto', tests.id('other')) returning id into v;
  perform tests.remember('m_other', v);
  insert into members (group_id, full_name, short_name, email) values (g, 'Una Unlinked', 'Una', 'unlinked@test.local') returning id into v;
  perform tests.remember('m_unlinked', v);
  insert into members (group_id, full_name, short_name, user_id, role) values (g2, 'Second Owner', 'Sam', tests.id('owner2'), 'admin') returning id into v;
  perform tests.remember('m_g2', v);

  insert into cycles (group_id, label, starts_on, ends_on, payout_on) values (g, 'Cycle 2027', '2027-02-15', '2028-02-15', '2028-02-05') returning id into v;
  perform tests.remember('c_planned', v);
  insert into cycle_rules (cycle_id, loan_multiples, tenor_bands) values (v, multiples, tenors);
  insert into cycles (group_id, label, starts_on, ends_on, payout_on, status) values (g, 'Cycle 2026', '2026-02-15', '2027-02-15', '2027-02-06', 'active') returning id into v;
  perform tests.remember('c_active', v);
  insert into cycle_rules (cycle_id, loan_multiples, tenor_bands) values (v, multiples, tenors);
end $$;

grant execute on all functions in schema tests to anon, authenticated;

select plan(1);
select pass('test helpers installed');
select * from finish();
```


- [ ] **Step 2: Write the failing RLS tests**

`supabase/tests/database/02_rls.sql`:
```sql
begin;
select * from no_plan();
select tests.fixture();

-- groups -------------------------------------------------------------------
select tests.login_as(tests.id('member'));
select is((select count(*)::int from groups), 1, 'member reads only their own group');
update groups set name = 'Hacked' where id = tests.id('group');
reset role;
select is((select name from groups where id = tests.id('group')), 'Test Group', 'member cannot rename the group');

select tests.login_as(tests.id('admin'));
update groups set name = 'Renamed', figures_visibility = 'private' where id = tests.id('group');
reset role;
select is((select name || '/' || figures_visibility from groups where id = tests.id('group')), 'Renamed/private', 'admin renames group and sets visibility');
update groups set figures_visibility = 'open' where id = tests.id('group');

select tests.login_as(tests.id('admin'));
select throws_ok($$update groups set owner_user_id = auth.uid() where id = tests.id('group')$$, '42501', null, 'owner cannot be changed from the client');
reset role;

select tests.login_as(tests.id('outsider'));
select is((select count(*)::int from groups), 0, 'outsider reads no groups');
reset role;

select tests.login_anon();
select throws_ok('select count(*) from groups', '42501', null, 'anon has no access to groups');
reset role;

-- members (base table) ------------------------------------------------------
select tests.login_as(tests.id('member'));
select is((select count(*)::int from members), 1, 'member reads only their own members row');
select is((select email from members), null, 'member reads their own row');
select throws_ok($$insert into members (group_id, full_name, short_name) values (tests.id('group'), 'Eve', 'Eve')$$, '42501', null, 'member cannot add members');
update members set full_name = 'Changed' where id = tests.id('m_other');
reset role;
select is((select full_name from members where id = tests.id('m_other')), 'Other Member', 'member cannot edit another member');

select tests.login_as(tests.id('admin'));
select is((select count(*)::int from members), 5, 'admin reads every member of their group and none of the other group');
select lives_ok($$insert into members (group_id, full_name, short_name) values (tests.id('group'), 'New Person', 'Newbie')$$, 'admin adds a member');
select throws_ok($$insert into members (group_id, full_name, short_name) values (tests.id('group2'), 'Spy', 'Spy')$$, '42501', null, 'admin cannot add members to another group');
select throws_ok($$update members set role = 'admin' where id = tests.id('m_member')$$, '42501', null, 'role cannot be changed directly');
select throws_ok($$update members set user_id = auth.uid() where id = tests.id('m_unlinked')$$, '42501', null, 'user_id cannot be changed directly');
select lives_ok($$update members set phone = '+260970000000' where id = tests.id('m_member')$$, 'admin edits contact details');
reset role;

-- group_members view --------------------------------------------------------
select hasnt_column('public', 'group_members', 'email', 'view hides email');
select hasnt_column('public', 'group_members', 'phone', 'view hides phone');
select hasnt_column('public', 'group_members', 'user_id', 'view hides user_id');
select tests.login_as(tests.id('member'));
select is((select count(*)::int from group_members), 6, 'member reads the whole group list through the view');
select is((select count(*)::int from group_members where group_id = tests.id('group2')), 0, 'view hides other groups');
select is((select linked from group_members where id = tests.id('m_unlinked')), false, 'view reports unlinked members');
reset role;
select tests.login_as(tests.id('outsider'));
select is((select count(*)::int from group_members), 0, 'outsider sees no members');
reset role;
select tests.login_anon();
select throws_ok('select count(*) from group_members', '42501', null, 'anon cannot read the view');
reset role;

-- invites -------------------------------------------------------------------
select tests.login_as(tests.id('admin'));
select lives_ok($$insert into invites (group_id, member_id, email, token_hash, expires_at, created_by)
  values (tests.id('group'), tests.id('m_unlinked'), 'unlinked@test.local', 'hash-a', now() + interval '14 days', auth.uid())$$, 'admin creates an invite');
select throws_ok($$insert into invites (group_id, member_id, email, token_hash, expires_at, created_by)
  values (tests.id('group'), tests.id('m_unlinked'), 'unlinked@test.local', 'hash-b', now() + interval '14 days', tests.id('member'))$$,
  '42501', null, 'invite must be created by the signed-in admin');
select is((select count(*)::int from invites), 1, 'admin reads invites');
reset role;
select tests.login_as(tests.id('member'));
select is((select count(*)::int from invites), 0, 'member reads no invites');
select throws_ok($$insert into invites (group_id, member_id, email, token_hash, expires_at, created_by)
  values (tests.id('group'), tests.id('m_unlinked'), 'x@test.local', 'hash-c', now() + interval '1 day', auth.uid())$$,
  '42501', null, 'member cannot create invites');
reset role;

-- cycles and rules ----------------------------------------------------------
select tests.login_as(tests.id('member'));
select is((select count(*)::int from cycles), 2, 'member reads cycles');
select is((select count(*)::int from cycle_rules), 2, 'member reads cycle rules');
update cycle_rules set min_saving = 1 where cycle_id = tests.id('c_planned');
reset role;
select is((select min_saving from cycle_rules where cycle_id = tests.id('c_planned')), 250::numeric, 'member cannot change rules');

select tests.login_as(tests.id('admin'));
update cycle_rules set min_saving = 300 where cycle_id = tests.id('c_planned');
update cycle_rules set min_saving = 300 where cycle_id = tests.id('c_active');
update cycles set label = 'Cycle 2027 (renamed)' where id = tests.id('c_planned');
update cycles set label = 'Changed' where id = tests.id('c_active');
reset role;
select is((select min_saving from cycle_rules where cycle_id = tests.id('c_planned')), 300::numeric, 'admin changes planned-cycle rules');
select is((select min_saving from cycle_rules where cycle_id = tests.id('c_active')), 250::numeric, 'rules lock once the cycle is active');
select is((select label from cycles where id = tests.id('c_planned')), 'Cycle 2027 (renamed)', 'admin edits a planned cycle');
select is((select label from cycles where id = tests.id('c_active')), 'Cycle 2026', 'active cycle cannot be edited');

-- audit log -----------------------------------------------------------------
select tests.login_as(tests.id('member'));
select is((select count(*)::int from audit_log), 0, 'member reads no audit entries');
select throws_ok($$insert into audit_log (group_id, action, entity) values (tests.id('group'), 'fake', 'x')$$, '42501', null, 'clients cannot write the audit log');
reset role;

-- figures visibility --------------------------------------------------------
select tests.login_as(tests.id('member'));
select ok(can_see_figures(tests.id('group'), tests.id('m_other')), 'open: member sees another member''s figures');
select ok(can_see_figures(tests.id('group'), tests.id('m_member')), 'open: member sees own figures');
reset role;
update groups set figures_visibility = 'private' where id = tests.id('group');
select tests.login_as(tests.id('member'));
select ok(not can_see_figures(tests.id('group'), tests.id('m_other')), 'private: member cannot see another member''s figures');
select ok(can_see_figures(tests.id('group'), tests.id('m_member')), 'private: member still sees own figures');
reset role;
select tests.login_as(tests.id('admin'));
select ok(can_see_figures(tests.id('group'), tests.id('m_other')), 'private: admin sees everyone');
reset role;
select tests.login_as(tests.id('outsider'));
select ok(not can_see_figures(tests.id('group'), tests.id('m_other')), 'outsider sees nothing');
reset role;

select * from finish();
rollback;
```

- [ ] **Step 3: Run to verify failure**

Run: `bun run db:test`
Expected: `02_rls.sql` fails (function `tests.fixture` exists but `can_see_figures`, `group_members` and the policies do not; outsider/member counts are 0 or errors).

- [ ] **Step 4: Write the migration**

`supabase/migrations/20261008000200_access_rls.sql`:
```sql
-- Access helpers, row-level security policies, column grants and the member-list view.

create or replace function public.is_member(p_group_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
           select 1 from members m
           where m.group_id = p_group_id and m.user_id = auth.uid() and m.status = 'active')
      or exists (select 1 from groups g where g.id = p_group_id and g.owner_user_id = auth.uid());
$$;

create or replace function public.is_admin(p_group_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
           select 1 from members m
           where m.group_id = p_group_id and m.user_id = auth.uid() and m.status = 'active' and m.role = 'admin')
      or exists (select 1 from groups g where g.id = p_group_id and g.owner_user_id = auth.uid());
$$;

create or replace function public.can_see_figures(p_group_id uuid, p_member_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin(p_group_id)
      or exists (select 1 from members m where m.id = p_member_id and m.group_id = p_group_id and m.user_id = auth.uid())
      or (public.is_member(p_group_id)
          and exists (select 1 from groups g where g.id = p_group_id and g.figures_visibility = 'open'));
$$;

revoke execute on function public.is_member(uuid), public.is_admin(uuid), public.can_see_figures(uuid, uuid) from public, anon;
grant execute on function public.is_member(uuid), public.is_admin(uuid), public.can_see_figures(uuid, uuid) to authenticated;

-- Nobody signed out reads or writes anything.
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

-- groups
revoke insert, update, delete on public.groups from authenticated;
grant update (name, figures_visibility) on public.groups to authenticated;
create policy groups_select on public.groups for select to authenticated using (public.is_member(id));
create policy groups_update on public.groups for update to authenticated
  using (public.is_admin(id)) with check (public.is_admin(id));

-- members: base table for admins and the member themselves
revoke insert, update, delete on public.members from authenticated;
grant insert (group_id, full_name, short_name, email, phone, joined_on) on public.members to authenticated;
grant update (full_name, short_name, email, phone, status) on public.members to authenticated;
create policy members_select on public.members for select to authenticated
  using (public.is_admin(group_id) or user_id = auth.uid());
create policy members_insert on public.members for insert to authenticated
  with check (public.is_admin(group_id));
create policy members_update on public.members for update to authenticated
  using (public.is_admin(group_id)) with check (public.is_admin(group_id));

-- group list for every member, without contact details or account ids.
-- Owned by the migration role, so it reads past RLS; the WHERE clause is the access rule.
create view public.group_members with (security_invoker = false) as
  select m.id, m.group_id, m.full_name, m.short_name, m.role, m.status, (m.user_id is not null) as linked, m.joined_on
  from public.members m
  where public.is_member(m.group_id);
revoke all on public.group_members from public, anon;
grant select on public.group_members to authenticated;

-- invites
revoke insert, update, delete on public.invites from authenticated;
grant insert (group_id, member_id, email, token_hash, expires_at, created_by) on public.invites to authenticated;
grant update (revoked_at) on public.invites to authenticated;
create policy invites_select on public.invites for select to authenticated using (public.is_admin(group_id));
create policy invites_insert on public.invites for insert to authenticated
  with check (
    public.is_admin(group_id)
    and created_by = auth.uid()
    and exists (select 1 from public.members m where m.id = member_id and m.group_id = invites.group_id)
  );
create policy invites_update on public.invites for update to authenticated
  using (public.is_admin(group_id)) with check (public.is_admin(group_id));

-- cycles: admins edit only while planned; status changes belong to later sub-projects
revoke insert, update, delete on public.cycles from authenticated;
grant insert (group_id, label, starts_on, ends_on, payout_on) on public.cycles to authenticated;
grant update (label, starts_on, ends_on, payout_on) on public.cycles to authenticated;
create policy cycles_select on public.cycles for select to authenticated using (public.is_member(group_id));
create policy cycles_insert on public.cycles for insert to authenticated with check (public.is_admin(group_id));
create policy cycles_update on public.cycles for update to authenticated
  using (public.is_admin(group_id) and status = 'planned') with check (public.is_admin(group_id) and status = 'planned');

-- cycle rules: readable by members, editable by admins while the cycle is planned
revoke insert, update, delete on public.cycle_rules from authenticated;
grant update (min_saving, loan_rate, excess_rate, penalty_per_day, membership_fee,
              window_open_day, window_close_day, loan_multiples, tenor_bands) on public.cycle_rules to authenticated;
create policy cycle_rules_select on public.cycle_rules for select to authenticated
  using (exists (select 1 from public.cycles c where c.id = cycle_id and public.is_member(c.group_id)));
create policy cycle_rules_update on public.cycle_rules for update to authenticated
  using (exists (select 1 from public.cycles c where c.id = cycle_id and c.status = 'planned' and public.is_admin(c.group_id)))
  with check (exists (select 1 from public.cycles c where c.id = cycle_id and c.status = 'planned' and public.is_admin(c.group_id)));

-- audit log: admins read; only definer functions and triggers write
revoke insert, update, delete on public.audit_log from authenticated;
create policy audit_log_select on public.audit_log for select to authenticated using (public.is_admin(group_id));
```

- [ ] **Step 5: Apply and run**

```bash
bun run db:reset
bun run db:test
```
Expected: `00_helpers.sql`, `01_schema.sql`, `02_rls.sql` all `ok`.

- [ ] **Step 6: Commit**

```bash
git add supabase
git commit -m "feat: add access helpers, RLS policies, column grants and member list view"
```

---

### Task 7: Invites, admin roles, last-admin guard and audit trail

**Files:**
- Create: `supabase/migrations/20261008000300_invites_admins_audit.sql`, `supabase/tests/database/03_invites_admins.sql`

**Interfaces:**
- Consumes: Task 6 helpers and fixture.
- Produces: `public.accept_invite(p_token text) → public.members`, `public.invite_preview(p_token text) → jsonb` (`{status: 'valid'|'expired'|'revoked'|'used'|'not_found', group_name?, member_name?, email_hint?}`, callable by `anon`), `public.set_admin(p_member_id uuid, p_make_admin boolean) → public.members`; trigger `members_guard_last_admin`; audit triggers writing actions `group.updated`, `group.visibility_changed`, `member.added`, `member.updated`, `member.role_changed`, `member.linked`, `member.status_changed`, `invite.created`, `invite.accepted`, `invite.revoked`, `invite.updated`, `cycle.created`, `cycle.updated`, `rules.created`, `rules.updated`. Tokens are hashed as lowercase hex SHA-256 of the raw token string.

- [ ] **Step 1: Write the failing tests**

`supabase/tests/database/03_invites_admins.sql`:
```sql
begin;
select * from no_plan();
select tests.fixture();

-- Invites with known raw tokens. Raw token 'tok-x' is stored as sha256('tok-x').
create function pg_temp.h(t text) returns text language sql as $$ select encode(extensions.digest(t, 'sha256'), 'hex') $$;
insert into invites (group_id, member_id, email, token_hash, expires_at, created_by) values
  (tests.id('group'), tests.id('m_unlinked'), 'Unlinked@Test.local', pg_temp.h('tok-valid'), now() + interval '14 days', tests.id('admin')),
  (tests.id('group'), tests.id('m_unlinked'), 'unlinked@test.local', pg_temp.h('tok-expired'), now() - interval '1 minute', tests.id('admin'));
insert into invites (group_id, member_id, email, token_hash, expires_at, created_by, revoked_at) values
  (tests.id('group'), tests.id('m_unlinked'), 'unlinked@test.local', pg_temp.h('tok-revoked'), now() + interval '14 days', tests.id('admin'), now());
select tests.remember('u_unlinked', tests.create_user('unlinked@test.local'));

-- invite_preview (works signed out) ----------------------------------------
select tests.login_anon();
select is(invite_preview('tok-valid') ->> 'status', 'valid', 'preview: valid invite');
select is(invite_preview('tok-valid') ->> 'member_name', 'Una', 'preview: names the member');
select is(invite_preview('tok-valid') ->> 'group_name', 'Test Group', 'preview: names the group');
select is(invite_preview('tok-valid') ->> 'email_hint', 'U•••@Test.local', 'preview: masks the email');
select is(invite_preview('tok-expired') ->> 'status', 'expired', 'preview: expired');
select is(invite_preview('tok-revoked') ->> 'status', 'revoked', 'preview: revoked');
select is(invite_preview('nope') ->> 'status', 'not_found', 'preview: unknown token');
select is(invite_preview('nope') ->> 'member_name', null, 'preview: unknown token reveals nothing');
select throws_ok($$select accept_invite('tok-valid')$$, '42501', null, 'anon cannot accept invites');
reset role;

-- accept_invite ------------------------------------------------------------
select tests.login_as(tests.id('outsider'));
select throws_ok($$select accept_invite('tok-valid')$$, 'P0001', 'email_mismatch', 'wrong account is refused');
reset role;

select tests.login_as(tests.id('u_unlinked'));
select throws_ok($$select accept_invite('tok-expired')$$, 'P0001', 'invite_expired', 'expired invite is refused');
select throws_ok($$select accept_invite('tok-revoked')$$, 'P0001', 'invite_revoked', 'revoked invite is refused');
select throws_ok($$select accept_invite('nope')$$, 'P0001', 'invite_not_found', 'unknown token is refused');
select is((select short_name from accept_invite('tok-valid')), 'Una', 'invited account is linked (email compared case-insensitively)');
select throws_ok($$select accept_invite('tok-valid')$$, 'P0001', 'invite_used', 'invite cannot be reused');
reset role;
select is((select user_id from members where id = tests.id('m_unlinked')), tests.id('u_unlinked'), 'member row now points at the account');
select isnt((select accepted_at from invites where token_hash = pg_temp.h('tok-valid')), null, 'invite marked accepted');

-- already linked: Mary (member@test.local) gets an invite for a second member row
insert into members (group_id, full_name, short_name) values (tests.id('group'), 'Dup Person', 'Dup');
insert into invites (group_id, member_id, email, token_hash, expires_at, created_by)
  select tests.id('group'), id, 'member@test.local', pg_temp.h('tok-dup'), now() + interval '1 day', tests.id('admin') from members where short_name = 'Dup';
select tests.login_as(tests.id('member'));
select throws_ok($$select accept_invite('tok-dup')$$, 'P0001', 'already_linked', 'one account links to one member per group');
reset role;

-- member already taken by a different account
insert into invites (group_id, member_id, email, token_hash, expires_at, created_by)
  values (tests.id('group'), tests.id('m_other'), 'outsider@test.local', pg_temp.h('tok-taken'), now() + interval '1 day', tests.id('admin'));
select tests.login_as(tests.id('outsider'));
select throws_ok($$select accept_invite('tok-taken')$$, 'P0001', 'member_taken', 'a linked member cannot be claimed again');
reset role;

-- set_admin ----------------------------------------------------------------
select tests.login_as(tests.id('member'));
select throws_ok($$select set_admin(tests.id('m_other'), true)$$, '42501', 'not_admin', 'members cannot promote');
reset role;

select tests.login_as(tests.id('admin'));
select is((select role from set_admin(tests.id('m_member'), true)), 'admin', 'admin promotes a member');
select is((select role from set_admin(tests.id('m_member'), false)), 'member', 'admin demotes a member');
select is((select role from set_admin(tests.id('m_owner'), false)), 'member', 'can demote while another admin remains');
select throws_ok($$select set_admin(tests.id('m_admin'), false)$$, 'P0001', 'last_admin', 'cannot demote the last admin');
select throws_ok($$update members set status = 'left' where id = tests.id('m_admin')$$, 'P0001', 'last_admin', 'cannot mark the last admin as left');
select throws_ok($$select set_admin(tests.id('m_g2'), true)$$, '42501', 'not_admin', 'cannot touch another group');
select throws_ok($$select set_admin(gen_random_uuid(), true)$$, 'P0002', 'member_not_found', 'unknown member');
reset role;

update members set status = 'left' where id = tests.id('m_other');
select tests.login_as(tests.id('admin'));
select throws_ok($$select set_admin(tests.id('m_other'), true)$$, 'P0001', 'member_not_active', 'members who left cannot be admins');
reset role;

-- audit trail --------------------------------------------------------------
select ok(exists (select 1 from audit_log where action = 'member.linked' and entity_id = tests.id('m_unlinked')), 'linking is audited');
select ok(exists (select 1 from audit_log where action = 'member.role_changed' and entity_id = tests.id('m_member')), 'role change is audited');
select is((select actor_user_id from audit_log where action = 'member.role_changed' and entity_id = tests.id('m_member') order by created_at limit 1),
  tests.id('admin'), 'audit records who acted');
select ok(exists (select 1 from audit_log where action = 'invite.accepted'), 'invite acceptance is audited');
select ok(not exists (select 1 from audit_log where data::text like '%token_hash%'), 'audit never stores token hashes');
update groups set figures_visibility = 'private' where id = tests.id('group');
select ok(exists (select 1 from audit_log where action = 'group.visibility_changed'), 'visibility change is audited');

select * from finish();
rollback;
```


- [ ] **Step 2: Run to verify failure**

Run: `bun run db:test`
Expected: `03_invites_admins.sql` fails — `function invite_preview(unknown) does not exist`.

- [ ] **Step 3: Write the migration**

`supabase/migrations/20261008000300_invites_admins_audit.sql`:
```sql
-- Invite acceptance, admin role changes, last-admin guard and the audit trail.

-- Audit trail ---------------------------------------------------------------
create or replace function public.write_audit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_group uuid;
  v_entity uuid;
  v_action text;
  v_old jsonb := case when TG_OP = 'UPDATE' then to_jsonb(OLD) - 'token_hash' end;
  v_new jsonb := to_jsonb(NEW) - 'token_hash';
begin
  if TG_TABLE_NAME = 'groups' then
    v_group := NEW.id; v_entity := NEW.id;
    v_action := case when TG_OP = 'UPDATE' and NEW.figures_visibility is distinct from OLD.figures_visibility
                     then 'group.visibility_changed' else 'group.updated' end;
  elsif TG_TABLE_NAME = 'members' then
    v_group := NEW.group_id; v_entity := NEW.id;
    if TG_OP = 'INSERT' then v_action := 'member.added';
    elsif NEW.role is distinct from OLD.role then v_action := 'member.role_changed';
    elsif NEW.user_id is distinct from OLD.user_id then v_action := 'member.linked';
    elsif NEW.status is distinct from OLD.status then v_action := 'member.status_changed';
    else v_action := 'member.updated';
    end if;
  elsif TG_TABLE_NAME = 'invites' then
    v_group := NEW.group_id; v_entity := NEW.id;
    if TG_OP = 'INSERT' then v_action := 'invite.created';
    elsif NEW.accepted_at is not null and OLD.accepted_at is null then v_action := 'invite.accepted';
    elsif NEW.revoked_at is not null and OLD.revoked_at is null then v_action := 'invite.revoked';
    else v_action := 'invite.updated';
    end if;
  elsif TG_TABLE_NAME = 'cycles' then
    v_group := NEW.group_id; v_entity := NEW.id;
    v_action := case when TG_OP = 'INSERT' then 'cycle.created' else 'cycle.updated' end;
  elsif TG_TABLE_NAME = 'cycle_rules' then
    select c.group_id into v_group from cycles c where c.id = NEW.cycle_id;
    v_entity := NEW.cycle_id;
    v_action := case when TG_OP = 'INSERT' then 'rules.created' else 'rules.updated' end;
  end if;

  insert into audit_log (group_id, actor_user_id, action, entity, entity_id, data)
  values (v_group, auth.uid(), v_action, TG_TABLE_NAME, v_entity, jsonb_build_object('old', v_old, 'new', v_new));
  return NEW;
end $$;

create trigger groups_audit after update on public.groups for each row execute function public.write_audit();
create trigger members_audit after insert or update on public.members for each row execute function public.write_audit();
create trigger invites_audit after insert or update on public.invites for each row execute function public.write_audit();
create trigger cycles_audit after insert or update on public.cycles for each row execute function public.write_audit();
create trigger cycle_rules_audit after insert or update on public.cycle_rules for each row execute function public.write_audit();

-- Last-admin guard: covers set_admin and plain status updates alike ----------
create or replace function public.guard_last_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if OLD.role = 'admin' and OLD.status = 'active' and (NEW.role <> 'admin' or NEW.status <> 'active') then
    if not exists (
      select 1 from members m
      where m.group_id = OLD.group_id and m.id <> OLD.id and m.role = 'admin' and m.status = 'active'
    ) then
      raise exception 'last_admin' using errcode = 'P0001';
    end if;
  end if;
  return NEW;
end $$;

create trigger members_guard_last_admin before update of role, status on public.members
  for each row execute function public.guard_last_admin();

-- set_admin -------------------------------------------------------------------
create or replace function public.set_admin(p_member_id uuid, p_make_admin boolean) returns public.members
language plpgsql security definer set search_path = public as $$
declare v members;
begin
  select * into v from members where id = p_member_id for update;
  if not found then raise exception 'member_not_found' using errcode = 'P0002'; end if;
  if not is_admin(v.group_id) then raise exception 'not_admin' using errcode = '42501'; end if;
  if p_make_admin and v.status <> 'active' then raise exception 'member_not_active' using errcode = 'P0001'; end if;
  update members set role = case when p_make_admin then 'admin' else 'member' end
  where id = p_member_id returning * into v;
  return v;
end $$;

-- invite_preview: what the invite page shows before anyone signs in ------------
create or replace function public.invite_preview(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v record;
begin
  select i.email, i.expires_at, i.accepted_at, i.revoked_at, m.short_name, g.name as group_name
    into v
    from invites i join members m on m.id = i.member_id join groups g on g.id = i.group_id
   where i.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  return jsonb_build_object(
    'status', case when v.revoked_at is not null then 'revoked'
                   when v.accepted_at is not null then 'used'
                   when v.expires_at <= now() then 'expired'
                   else 'valid' end,
    'group_name', v.group_name,
    'member_name', v.short_name,
    'email_hint', left(split_part(v.email, '@', 1), 1) || '•••@' || split_part(v.email, '@', 2)
  );
end $$;

-- accept_invite -----------------------------------------------------------------
create or replace function public.accept_invite(p_token text) returns public.members
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_inv invites;
  v_member members;
begin
  if v_uid is null then raise exception 'not_signed_in' using errcode = '42501'; end if;

  select * into v_inv from invites
   where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
   for update;
  if not found then raise exception 'invite_not_found' using errcode = 'P0001'; end if;
  if v_inv.revoked_at is not null then raise exception 'invite_revoked' using errcode = 'P0001'; end if;
  if v_inv.accepted_at is not null then raise exception 'invite_used' using errcode = 'P0001'; end if;
  if v_inv.expires_at <= now() then raise exception 'invite_expired' using errcode = 'P0001'; end if;
  if lower(v_inv.email) <> v_email then raise exception 'email_mismatch' using errcode = 'P0001'; end if;
  if exists (select 1 from members where group_id = v_inv.group_id and user_id = v_uid and id <> v_inv.member_id) then
    raise exception 'already_linked' using errcode = 'P0001';
  end if;

  select * into v_member from members where id = v_inv.member_id for update;
  if v_member.status <> 'active' then raise exception 'member_not_active' using errcode = 'P0001'; end if;
  if v_member.user_id is not null and v_member.user_id <> v_uid then
    raise exception 'member_taken' using errcode = 'P0001';
  end if;

  update members set user_id = v_uid, email = coalesce(email, v_inv.email) where id = v_member.id returning * into v_member;
  update invites set accepted_at = now() where id = v_inv.id;
  return v_member;
end $$;

revoke execute on function public.set_admin(uuid, boolean), public.accept_invite(text), public.invite_preview(text),
  public.write_audit(), public.guard_last_admin() from public, anon;
grant execute on function public.set_admin(uuid, boolean), public.accept_invite(text) to authenticated;
grant execute on function public.invite_preview(text) to anon, authenticated;
```

- [ ] **Step 4: Apply and run**

```bash
bun run db:reset
bun run db:test
```
Expected: `00`–`03` all `ok`.

- [ ] **Step 5: Commit**

```bash
git add supabase
git commit -m "feat: add invite acceptance, admin roles, last-admin guard and audit trail"
```

---

### Task 8: Bootstrap functions and local seed data

**Files:**
- Create: `supabase/migrations/20261008000400_bootstrap.sql`, `supabase/seed.sql`, `supabase/tests/database/04_bootstrap.sql`

**Interfaces:**
- Produces (schema `private`, callable only by the database owner — run from the SQL editor or `psql`, never from the app): `private.create_cycle(p_group uuid, p_label text, p_start date, p_end date, p_payout date) → uuid`, `private.bootstrap_premium_vb(p_owner uuid, p_owner_short_name text default 'Thompson') → uuid`, `private.bootstrap_test_group(p_owner_email text, p_admin_email text, p_member_email text) → uuid`. Local accounts (password `password123`): `owner@pvb.test` (Thompson, admin, group owner), `admin@pvb.test` (Nsama, admin), `member@pvb.test` (Tafara, member), `outsider@pvb.test` (no group).

- [ ] **Step 1: Write the failing test**

`supabase/tests/database/04_bootstrap.sql`:
```sql
begin;
select * from no_plan();

-- The local seed already created Premium VB; remove it inside this transaction.
delete from public.groups where name = 'Premium Village Banking';

select tests.remember('boss', tests.create_user('boss@test.local'));
select tests.remember('pvb', private.bootstrap_premium_vb(tests.id('boss')));

select is((select count(*)::int from members where group_id = tests.id('pvb')), 18, '18 members created');
select is((select role || '/' || (user_id = tests.id('boss'))::text from members where group_id = tests.id('pvb') and short_name = 'Thompson'),
  'admin/true', 'owner linked to Thompson as admin');
select is((select full_name from members where group_id = tests.id('pvb') and short_name = 'Sapi'), 'Sapi Mulimbika', 'known full names kept');
select is((select count(*)::int from cycles where group_id = tests.id('pvb') and status = 'planned'), 1, 'one planned cycle');
select is((select starts_on::text || ' ' || payout_on::text from cycles where group_id = tests.id('pvb')), '2027-02-15 2028-02-05', 'cycle dates');
select is((select r.min_saving from cycle_rules r join cycles c on c.id = r.cycle_id where c.group_id = tests.id('pvb')), 250::numeric, 'constitution rules');
select is((select jsonb_array_length(r.tenor_bands) from cycle_rules r join cycles c on c.id = r.cycle_id where c.group_id = tests.id('pvb')), 4, 'four tenor bands');
select throws_ok($$select private.bootstrap_premium_vb(tests.id('boss'))$$, 'P0001', 'already_bootstrapped', 'bootstrap runs once');

select tests.login_as(tests.id('boss'));
select throws_ok($$select private.bootstrap_premium_vb(auth.uid())$$, '42501', null, 'app users cannot call bootstrap');
reset role;

select * from finish();
rollback;
```

- [ ] **Step 2: Run to verify failure**

Run: `bun run db:test`
Expected: `04_bootstrap.sql` fails — `schema "private" does not exist`.

- [ ] **Step 3: Write the migration**

`supabase/migrations/20261008000400_bootstrap.sql`:
```sql
-- One-off setup functions. Schema "private" is not exposed through the API and
-- nothing in it is executable by app roles; run these from the SQL editor or psql.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.create_cycle(p_group uuid, p_label text, p_start date, p_end date, p_payout date)
returns uuid language plpgsql as $$
declare v uuid;
begin
  insert into public.cycles (group_id, label, starts_on, ends_on, payout_on)
  values (p_group, p_label, p_start, p_end, p_payout) returning id into v;
  insert into public.cycle_rules (cycle_id, loan_multiples, tenor_bands) values (
    v,
    '[{"from_month":1,"to_month":4,"multiple":3},{"from_month":5,"to_month":9,"multiple":2},{"from_month":10,"to_month":11,"multiple":1},{"from_month":12,"to_month":12,"multiple":0}]',
    '[{"max":3000,"months":1},{"max":5000,"months":2},{"max":9999.99,"months":3},{"max":null,"months":4}]'
  );
  return v;
end $$;

create or replace function private.bootstrap_premium_vb(p_owner uuid, p_owner_short_name text default 'Thompson')
returns uuid language plpgsql as $$
declare g uuid;
begin
  if exists (select 1 from public.groups where name = 'Premium Village Banking') then
    raise exception 'already_bootstrapped' using errcode = 'P0001';
  end if;

  insert into public.groups (name, owner_user_id) values ('Premium Village Banking', p_owner) returning id into g;

  insert into public.members (group_id, full_name, short_name)
  select g, f, s from (values
    ('Tafara', 'Tafara'), ('Nsama', 'Nsama'), ('Sapi Mulimbika', 'Sapi'), ('Changwe', 'Changwe'),
    ('Margaret', 'Margaret'), ('Raphael', 'Raphael'), ('Justin', 'Justin'), ('Thompson Manda', 'Thompson'),
    ('Kutemba', 'Kutemba'), ('Chimwemwe', 'Chimwemwe'), ('Mbachi', 'Mbachi'), ('Heri', 'Heri'),
    ('Gilbert Chisenga', 'Gilbert'), ('Nawiti', 'Nawiti'), ('Chisala', 'Chisala'), ('Charles', 'Charles'),
    ('Mulela', 'Mulela'), ('Nyasha', 'Nyasha')
  ) as t(f, s);

  update public.members
     set user_id = p_owner, role = 'admin', email = (select email from auth.users where id = p_owner)
   where group_id = g and short_name = p_owner_short_name;
  if not found then raise exception 'owner_member_not_found' using errcode = 'P0001'; end if;

  perform private.create_cycle(g, 'Cycle 2027', date '2027-02-15', date '2028-02-15', date '2028-02-05');
  return g;
end $$;

-- A throwaway group for Playwright accounts in production; it never mixes with real data.
create or replace function private.bootstrap_test_group(p_owner_email text, p_admin_email text, p_member_email text)
returns uuid language plpgsql as $$
declare g uuid; o uuid; a uuid; m uuid;
begin
  select id into o from auth.users where email = p_owner_email;
  select id into a from auth.users where email = p_admin_email;
  select id into m from auth.users where email = p_member_email;
  if o is null or a is null or m is null then
    raise exception 'create the three test accounts in Auth first' using errcode = 'P0001';
  end if;
  insert into public.groups (name, owner_user_id) values ('Playwright Test Group', o) returning id into g;
  insert into public.members (group_id, full_name, short_name) values
    (g, 'Test Owner', 'Owner'), (g, 'Test Admin', 'Admin'), (g, 'Test Member', 'Member');
  update public.members set user_id = o, role = 'admin', email = p_owner_email where group_id = g and short_name = 'Owner';
  update public.members set user_id = a, role = 'admin', email = p_admin_email where group_id = g and short_name = 'Admin';
  update public.members set user_id = m, email = p_member_email where group_id = g and short_name = 'Member';
  perform private.create_cycle(g, 'Test Cycle', date '2027-02-15', date '2028-02-15', date '2028-02-05');
  return g;
end $$;

revoke all on all functions in schema private from public, anon, authenticated;
```

- [ ] **Step 4: Write the local seed**

`supabase/seed.sql`:
```sql
-- LOCAL DEVELOPMENT ONLY. These accounts and passwords exist only in the local Docker stack.
create function pg_temp.make_user(p_email text, p_password text) returns uuid language plpgsql as $$
declare v uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change)
  values (v, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v, v::text,
    jsonb_build_object('sub', v::text, 'email', p_email, 'email_verified', true), 'email', now(), now(), now());
  return v;
end $$;

do $$
declare
  v_owner uuid := pg_temp.make_user('owner@pvb.test', 'password123');
  v_admin uuid := pg_temp.make_user('admin@pvb.test', 'password123');
  v_member uuid := pg_temp.make_user('member@pvb.test', 'password123');
  g uuid;
begin
  perform pg_temp.make_user('outsider@pvb.test', 'password123');
  g := private.bootstrap_premium_vb(v_owner);
  update public.members set user_id = v_admin, role = 'admin', email = 'admin@pvb.test' where group_id = g and short_name = 'Nsama';
  update public.members set user_id = v_member, email = 'member@pvb.test' where group_id = g and short_name = 'Tafara';
end $$;
```

- [ ] **Step 5: Apply, test, and try a real sign-in**

```bash
bun run db:reset
bun run db:test
curl -s -X POST 'http://127.0.0.1:54321/auth/v1/token?grant_type=password' \
  -H "apikey: $(bun x supabase status -o json | node -e 'process.stdin.on("data",d=>console.log(JSON.parse(d).ANON_KEY))')" \
  -H 'Content-Type: application/json' -d '{"email":"member@pvb.test","password":"password123"}' | head -c 120
```
Expected: all pgTAP files `ok`; the curl prints the start of a JSON body containing `"access_token"`.

- [ ] **Step 6: Commit**

```bash
git add supabase
git commit -m "feat: add Premium VB bootstrap functions and local seed accounts"
```

---

### Task 9: `invite-member` Edge Function

**Prerequisite:** Deno 2 installed (`deno --version`), or use `bun x deno` in place of `deno`.

**Files:**
- Create: `supabase/functions/invite-member/lib.ts`, `supabase/functions/invite-member/lib.test.ts`, `supabase/functions/invite-member/index.ts`, `supabase/functions/invite-member/deno.json`, `supabase/functions/.env.example`
- Modify: `supabase/config.toml` (function block)

**Interfaces:**
- Consumes: `public.is_admin`, `members`/`invites` policies from Tasks 6–7.
- Produces: `POST /functions/v1/invite-member` with JSON `{ memberId: string, email: string }` and the caller's JWT. Responses: `200 { ok: true, expiresAt: string }`; `400 { error: 'invalid_body'|'invalid_member'|'invalid_email' }`; `401 { error: 'not_signed_in' }`; `403 { error: 'not_admin' }`; `409 { error: 'member_taken'|'member_not_active' }`; `500 { error: 'invite_failed' }`. Email link: `${SITE_URL}/invite/<token>`; the raw token is never stored, only `sha256(token)` hex.

- [ ] **Step 1: Write the failing tests**

`supabase/functions/invite-member/lib.test.ts`:
```ts
import { assertEquals, assertMatch, assertNotEquals, assertThrows } from 'jsr:@std/assert@1';
import { HttpError, hashToken, inviteExpiry, makeToken, parseInviteRequest } from './lib.ts';

Deno.test('makeToken returns 43 url-safe characters and never repeats', () => {
  const a = makeToken();
  const b = makeToken();
  assertMatch(a, /^[A-Za-z0-9_-]{43}$/);
  assertNotEquals(a, b);
});

Deno.test('hashToken matches Postgres encode(digest(token, sha256), hex)', async () => {
  assertEquals(await hashToken('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

Deno.test('inviteExpiry is 14 days out', () => {
  assertEquals(inviteExpiry(new Date('2027-01-01T00:00:00Z')), '2027-01-15T00:00:00.000Z');
});

Deno.test('parseInviteRequest normalises email', () => {
  const id = '6f1c7a52-6a1b-4c6e-9a43-2b0a9f0b1c2d';
  assertEquals(parseInviteRequest({ memberId: id, email: '  Tafara@Example.COM ' }), { memberId: id, email: 'tafara@example.com' });
});

Deno.test('parseInviteRequest rejects bad input with 400', () => {
  for (const body of [null, 'x', { memberId: 'nope', email: 'a@b.co' }, { memberId: '6f1c7a52-6a1b-4c6e-9a43-2b0a9f0b1c2d', email: 'not-an-email' }]) {
    const err = assertThrows(() => parseInviteRequest(body), HttpError);
    assertEquals(err.status, 400);
  }
});
```

`supabase/functions/invite-member/deno.json`:
```json
{ "imports": {} }
```

- [ ] **Step 2: Run to verify failure**

Run: `bun run fn:test`
Expected: FAIL — `Module not found "file:///…/lib.ts"`.

- [ ] **Step 3: Implement the pure helpers**

`supabase/functions/invite-member/lib.ts`:
```ts
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const INVITE_TTL_DAYS = 14;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function makeToken(bytes = 32): string {
  const raw = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...raw)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const inviteExpiry = (now = new Date()): string =>
  new Date(now.getTime() + INVITE_TTL_DAYS * 86_400_000).toISOString();

export type InviteRequest = { memberId: string; email: string };

export function parseInviteRequest(body: unknown): InviteRequest {
  if (!body || typeof body !== 'object') throw new HttpError(400, 'invalid_body');
  const { memberId, email } = body as Record<string, unknown>;
  if (typeof memberId !== 'string' || !UUID.test(memberId)) throw new HttpError(400, 'invalid_member');
  if (typeof email !== 'string' || !EMAIL.test(email.trim())) throw new HttpError(400, 'invalid_email');
  return { memberId, email: email.trim().toLowerCase() };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `bun run fn:test`
Expected: `ok | 5 passed`.

- [ ] **Step 5: Write the handler**

`supabase/functions/invite-member/index.ts`:
```ts
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { HttpError, hashToken, inviteExpiry, makeToken, parseInviteRequest } from './lib.ts';

const SITE_URL = Deno.env.get('SITE_URL') ?? 'http://localhost:3000';
const cors = {
  'Access-Control-Allow-Origin': SITE_URL,
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authorization = req.headers.get('Authorization');
    if (!authorization) throw new HttpError(401, 'not_signed_in');

    const { memberId, email } = parseInviteRequest(await req.json().catch(() => null));

    // Act as the caller: RLS decides what they may read and write.
    const asCaller = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const { data: userData } = await asCaller.auth.getUser();
    if (!userData.user) throw new HttpError(401, 'not_signed_in');

    const { data: member, error: memberError } = await asCaller
      .from('members')
      .select('id, group_id, user_id, status')
      .eq('id', memberId)
      .maybeSingle();
    if (memberError) throw memberError;
    if (!member) throw new HttpError(403, 'not_admin');
    const { data: isAdmin } = await asCaller.rpc('is_admin', { p_group_id: member.group_id });
    if (!isAdmin) throw new HttpError(403, 'not_admin');
    if (member.user_id) throw new HttpError(409, 'member_taken');
    if (member.status !== 'active') throw new HttpError(409, 'member_not_active');

    const now = new Date().toISOString();
    const { error: revokeError } = await asCaller
      .from('invites')
      .update({ revoked_at: now })
      .eq('member_id', memberId)
      .is('accepted_at', null)
      .is('revoked_at', null);
    if (revokeError) throw revokeError;

    const { error: emailError } = await asCaller.from('members').update({ email }).eq('id', memberId);
    if (emailError) throw emailError;

    const token = makeToken();
    const expiresAt = inviteExpiry();
    const { error: insertError } = await asCaller.from('invites').insert({
      group_id: member.group_id,
      member_id: memberId,
      email,
      token_hash: await hashToken(token),
      expires_at: expiresAt,
      created_by: userData.user.id,
    });
    if (insertError) throw insertError;

    const redirectTo = `${SITE_URL}/invite/${token}`;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
    if (inviteError) {
      const alreadyRegistered = inviteError.status === 422 || /already been registered/i.test(inviteError.message);
      if (!alreadyRegistered) throw inviteError;
      // Existing account (e.g. re-invite): send a sign-in link that lands on the invite page.
      const mailer = createClient(url, anonKey, { auth: { persistSession: false } });
      const { error: otpError } = await mailer.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
      });
      if (otpError) throw otpError;
    }

    return json(200, { ok: true, expiresAt });
  } catch (err) {
    if (err instanceof HttpError) return json(err.status, { error: err.message });
    console.error('invite-member failed', err);
    return json(500, { error: 'invite_failed' });
  }
});
```

Add to `supabase/config.toml`:
```toml
[functions.invite-member]
verify_jwt = true
```

`supabase/functions/.env.example`:
```
SITE_URL=http://localhost:3000
```

- [ ] **Step 6: Exercise it against the local stack**

```bash
cp supabase/functions/.env.example supabase/functions/.env
bun x supabase functions serve invite-member --env-file supabase/functions/.env &
ANON=$(bun x supabase status -o json | node -e 'process.stdin.on("data",d=>console.log(JSON.parse(d).ANON_KEY))')
TOKEN=$(curl -s -X POST 'http://127.0.0.1:54321/auth/v1/token?grant_type=password' -H "apikey: $ANON" \
  -H 'Content-Type: application/json' -d '{"email":"admin@pvb.test","password":"password123"}' \
  | node -e 'process.stdin.on("data",d=>console.log(JSON.parse(d).access_token))')
MEMBER=$(docker exec supabase_db_premium-village-bank psql -U postgres -Atc "select id from members where short_name='Charles'")
curl -s -X POST http://127.0.0.1:54321/functions/v1/invite-member -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d "{\"memberId\":\"$MEMBER\",\"email\":\"charles@example.com\"}"
kill %1
```
Expected: `{"ok":true,"expiresAt":"…"}`. Open the local mail inbox at http://127.0.0.1:54324 → an invite email to `charles@example.com` whose link ends in `/invite/<43-char token>`. Repeat the curl with `member@pvb.test`'s token → `{"error":"not_admin"}`.

- [ ] **Step 7: Commit**

```bash
git add supabase
git commit -m "feat: add invite-member Edge Function with hashed single-use tokens"
```

---
### Task 10: Data layer — Supabase client, persisted cache, error text, RLS no-op guard, sign-out wipe

**Files:**
- Create: `src/lib/supabase.ts`, `src/lib/database.types.ts` (generated), `src/lib/queryClient.ts`, `src/lib/errors.ts`, `src/lib/mutate.ts`, `src/lib/functions.ts`, `src/lib/haptics.ts`, `src/features/auth/signOut.ts`
- Test: `src/lib/queryClient.test.ts`, `src/lib/errors.test.ts`, `src/lib/mutate.test.ts`, `src/features/auth/signOut.test.ts`

**Interfaces:**
- Consumes: local stack from Tasks 5–8 (for type generation).
- Produces:
  - `supabase` — `SupabaseClient<Database>`; `Tables<'groups'>` etc. from `@/lib/database.types`
  - `makeQueryClient(): QueryClient`, `persister`, `CACHE_KEY = 'pvb-query-cache'`, `CACHE_MAX_AGE` (7 days), `wipeLocalData(qc): Promise<void>`
  - `friendlyError(err: unknown): string`
  - `expectRows<T>(res: { data: T[] | null; error: unknown }, emptyCode?: string): T[]` — throws `Error(emptyCode)` (default `'not_admin'`) when RLS silently matched no rows
  - `invokeInvite(memberId: string, email: string): Promise<{ expiresAt: string }>` — throws `Error(code)` with the Edge Function's error code
  - `haptic(ms?: number): void`
  - `signOutEverywhere(qc: QueryClient): Promise<void>` — always wipes local data, even if the network sign-out fails

- [ ] **Step 1: Generate database types**

```bash
bun run db:start   # if not already running
bun run db:types
```
Expected: `src/lib/database.types.ts` exists and contains `export type Database` with `groups`, `members`, `invites`, `cycles`, `cycle_rules`, `audit_log`, view `group_members`, and functions `accept_invite`, `invite_preview`, `set_admin`, `is_admin`, `is_member`, `can_see_figures`, plus the `Tables<…>` helper type.

- [ ] **Step 2: Write the failing tests**

`src/lib/errors.test.ts`:
```ts
import { expect, test } from 'vitest';
import { friendlyError } from './errors';

test('maps SQL business codes', () => {
  expect(friendlyError({ message: 'last_admin', code: 'P0001' })).toBe('The group needs at least one admin. Make someone else an admin first.');
  expect(friendlyError({ message: 'email_mismatch' })).toBe('This invite was sent to a different email address. Sign in with that address.');
  expect(friendlyError(new Error('rules_locked'))).toBe('Rules can only change before the cycle starts.');
});

test('maps permission errors', () => {
  expect(friendlyError({ code: '42501', message: 'new row violates row-level security policy for table "members"' })).toBe('Only admins can do this.');
});

test('maps auth messages', () => {
  expect(friendlyError({ message: 'Invalid login credentials', status: 400 })).toBe('That email and password don’t match.');
  expect(friendlyError({ message: 'Signups not allowed for otp', status: 422 })).toBe('We couldn’t find an account for that email. Ask your treasurer for an invite.');
  expect(friendlyError({ message: 'email rate limit exceeded', status: 429 })).toBe('Too many attempts. Please wait a minute and try again.');
});

test('maps network failures', () => {
  expect(friendlyError(new TypeError('Failed to fetch'))).toBe('You seem to be offline. Check your connection and try again.');
});

test('never leaks raw errors', () => {
  expect(friendlyError({ message: 'duplicate key value violates unique constraint "members_group_id_short_name_key"', code: '23505' })).toBe('That name is already used in this group.');
  expect(friendlyError('weird')).toBe('Something went wrong. Please try again.');
  expect(friendlyError(undefined)).toBe('Something went wrong. Please try again.');
});
```

`src/lib/mutate.test.ts`:
```ts
import { expect, test } from 'vitest';
import { expectRows } from './mutate';

test('returns rows when the write matched', () => {
  expect(expectRows({ data: [{ id: 'a' }], error: null })).toEqual([{ id: 'a' }]);
});

test('throws when RLS silently matched nothing', () => {
  expect(() => expectRows({ data: [], error: null })).toThrow('not_admin');
  expect(() => expectRows({ data: [], error: null }, 'rules_locked')).toThrow('rules_locked');
  expect(() => expectRows({ data: null, error: null })).toThrow('not_admin');
});

test('rethrows the original error', () => {
  const err = { code: '42501', message: 'denied' };
  expect(() => expectRows({ data: null, error: err })).toThrow();
  try {
    expectRows({ data: null, error: err });
  } catch (e) {
    expect(e).toBe(err);
  }
});
```

`src/lib/queryClient.test.ts`:
```ts
import { get, set } from 'idb-keyval';
import { expect, test } from 'vitest';
import { CACHE_KEY, makeQueryClient, wipeLocalData } from './queryClient';

test('wipeLocalData clears memory and IndexedDB', async () => {
  const qc = makeQueryClient();
  qc.setQueryData(['membership', 'u1'], { group: 'Premium' });
  await set(CACHE_KEY, '{"clientState":{}}');
  await wipeLocalData(qc);
  expect(qc.getQueryData(['membership', 'u1'])).toBeUndefined();
  expect(await get(CACHE_KEY)).toBeUndefined();
});
```

`src/features/auth/signOut.test.ts`:
```ts
import { get, set } from 'idb-keyval';
import { beforeEach, expect, test, vi } from 'vitest';
import { CACHE_KEY, makeQueryClient } from '@/lib/queryClient';

const signOut = vi.fn();
vi.mock('@/lib/supabase', () => ({ supabase: { auth: { signOut: (...a: unknown[]) => signOut(...a) } } }));

const { signOutEverywhere } = await import('./signOut');

beforeEach(() => signOut.mockReset());

test('signs out and wipes cached group data', async () => {
  signOut.mockResolvedValue({ error: null });
  const qc = makeQueryClient();
  qc.setQueryData(['group-members', 'g1'], [{ full_name: 'Tafara' }]);
  await set(CACHE_KEY, 'cached');
  await signOutEverywhere(qc);
  expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
  expect(qc.getQueryData(['group-members', 'g1'])).toBeUndefined();
  expect(await get(CACHE_KEY)).toBeUndefined();
});

test('still wipes local data when the network sign-out fails (shared phone, offline)', async () => {
  signOut.mockRejectedValue(new TypeError('Failed to fetch'));
  const qc = makeQueryClient();
  qc.setQueryData(['membership', 'u1'], { group: 'x' });
  await set(CACHE_KEY, 'cached');
  await signOutEverywhere(qc);
  expect(qc.getQueryData(['membership', 'u1'])).toBeUndefined();
  expect(await get(CACHE_KEY)).toBeUndefined();
});
```

- [ ] **Step 3: Run to verify failure**

Run: `bun run test src/lib src/features/auth`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement**

`src/lib/supabase.ts`:
```ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!url || !anonKey) throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see .env.example)');

export const supabase = createClient<Database>(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
```

`src/lib/queryClient.ts`:
```ts
import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { del, get, set } from 'idb-keyval';

export const CACHE_KEY = 'pvb-query-cache';
export const CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

export const makeQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, gcTime: CACHE_MAX_AGE, retry: 1, refetchOnWindowFocus: true },
      mutations: { retry: 0 },
    },
  });

export const persister = createAsyncStoragePersister({
  key: CACHE_KEY,
  storage: {
    getItem: async (k) => (await get<string>(k)) ?? null,
    setItem: (k, v) => set(k, v),
    removeItem: (k) => del(k),
  },
});

export async function wipeLocalData(qc: QueryClient): Promise<void> {
  await qc.cancelQueries();
  qc.clear();
  await del(CACHE_KEY);
}
```

`src/lib/errors.ts`:
```ts
const BY_MESSAGE: Record<string, string> = {
  invite_not_found: 'This invite link isn’t valid. Ask your treasurer for a new one.',
  invite_expired: 'This invite has expired. Ask your treasurer to send a new one.',
  invite_revoked: 'This invite was cancelled. Ask your treasurer for a new one.',
  invite_used: 'This invite has already been used. Sign in instead.',
  email_mismatch: 'This invite was sent to a different email address. Sign in with that address.',
  already_linked: 'Your account is already linked to another member of this group.',
  member_taken: 'This member is already linked to another account.',
  member_not_active: 'Only active members can do this.',
  member_not_found: 'That member no longer exists.',
  last_admin: 'The group needs at least one admin. Make someone else an admin first.',
  not_admin: 'Only admins can do this.',
  not_signed_in: 'Please sign in again.',
  rules_locked: 'Rules can only change before the cycle starts.',
  invalid_email: 'Enter a valid email address.',
  invalid_member: 'That member could not be found.',
  invite_failed: 'The invite could not be sent. Please try again.',
  'Invalid login credentials': 'That email and password don’t match.',
  'Signups not allowed for otp': 'We couldn’t find an account for that email. Ask your treasurer for an invite.',
  'Email not confirmed': 'Confirm your email address first, using the link we sent you.',
  'New password should be different from the old password.': 'Choose a password you haven’t used before.',
};

type ErrorLike = { message?: unknown; code?: unknown; status?: unknown };

export function friendlyError(err: unknown): string {
  if (!err || typeof err !== 'object') return 'Something went wrong. Please try again.';
  const { message, code, status } = err as ErrorLike;
  const msg = typeof message === 'string' ? message : '';
  if (BY_MESSAGE[msg]) return BY_MESSAGE[msg];
  if (status === 429 || /rate limit/i.test(msg)) return 'Too many attempts. Please wait a minute and try again.';
  if (code === '42501' || code === 'PGRST301') return 'Only admins can do this.';
  if (code === '23505') return 'That name is already used in this group.';
  if (status === 401 || code === 'PGRST303') return 'Your session has expired. Please sign in again.';
  if (/failed to fetch|networkerror|load failed/i.test(msg)) return 'You seem to be offline. Check your connection and try again.';
  return 'Something went wrong. Please try again.';
}
```

`src/lib/mutate.ts`:
```ts
/** Supabase reports an UPDATE that RLS filtered out as success with zero rows. Treat that as a refusal. */
export function expectRows<T>(res: { data: T[] | null; error: unknown }, emptyCode = 'not_admin'): T[] {
  if (res.error) throw res.error;
  if (!res.data || res.data.length === 0) throw Object.assign(new Error(emptyCode), { code: emptyCode });
  return res.data;
}
```

`src/lib/functions.ts`:
```ts
import { supabase } from './supabase';

export async function invokeInvite(memberId: string, email: string): Promise<{ expiresAt: string }> {
  const { data, error } = await supabase.functions.invoke<{ ok: true; expiresAt: string }>('invite-member', {
    body: { memberId, email },
  });
  if (error || !data) {
    let code = 'invite_failed';
    const ctx = (error as { context?: Response } | null)?.context;
    if (ctx && typeof ctx.json === 'function') {
      const body = (await ctx.json().catch(() => null)) as { error?: string } | null;
      if (body?.error) code = body.error;
    }
    throw Object.assign(new Error(code), { code });
  }
  return { expiresAt: data.expiresAt };
}
```

`src/lib/haptics.ts`:
```ts
/** A short buzz on Android for confirmed actions. iOS ignores it. */
export function haptic(ms = 12): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(ms);
}
```

`src/features/auth/signOut.ts`:
```ts
import type { QueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { wipeLocalData } from '@/lib/queryClient';

export async function signOutEverywhere(qc: QueryClient): Promise<void> {
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } finally {
    await wipeLocalData(qc);
  }
}
```

- [ ] **Step 5: Run to verify pass**

Run: `bun run test && bun run typecheck && bun run lint`
Expected: all tests pass (errors 5, mutate 3, queryClient 1, signOut 2 added); no type or lint errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add typed Supabase client, persisted query cache, error text and sign-out wipe"
```

---

### Task 11: Session, sign-in screens and the auth guard

**Files:**
- Create: `src/features/auth/SessionProvider.tsx`, `src/features/auth/access.ts`, `src/features/auth/safeNext.ts`, `src/features/auth/SignInMethods.tsx`, `src/features/auth/SignInPage.tsx`, `src/features/auth/AuthCallback.tsx`, `src/features/auth/RequireAuth.tsx`, `src/app/AuthLayout.tsx`, `src/app/BrandMark.tsx`, `src/app/FullScreenLoader.tsx`, `src/app/Providers.tsx`, `src/app/router.tsx`
- Modify: `src/main.tsx`
- Delete: `src/App.tsx`, `src/App.test.tsx`
- Test: `src/features/auth/access.test.ts`, `src/features/auth/safeNext.test.ts`, `src/features/auth/SignInMethods.test.tsx`

**Interfaces:**
- Consumes: `supabase`, `makeQueryClient`, `persister`, `CACHE_MAX_AGE`, `wipeLocalData`, `friendlyError` (Task 10); `ThemeProvider` (Task 3); `ToastProvider`, `Button`, `TextField`, `Alert` (Task 4).
- Produces: `SessionProvider`, `useSession(): { session: Session | null; loading: boolean }`; `type MembershipState = 'loading'|'error'|'none'|'found'`; `type Access = 'wait'|'sign-in'|'error'|'no-group'|'ok'`; `decideAccess(sessionLoading: boolean, hasSession: boolean, membership?: MembershipState): Access`; `safeNext(raw: string | null | undefined): string`; `SignInMethods({ next: string; email?: string })`; routes `/sign-in`, `/auth/callback`; `RequireAuth` (layout route); `FullScreenLoader`; `AuthLayout({ title, subtitle?, children })`; `BrandMark({ size? })`; `router` (extended in Tasks 12–16).

- [ ] **Step 1: Write the failing tests**

`src/features/auth/access.test.ts`:
```ts
import { expect, test } from 'vitest';
import { decideAccess } from './access';

test('waits while the session loads', () => expect(decideAccess(true, false)).toBe('wait'));
test('sends signed-out visitors to sign in', () => expect(decideAccess(false, false)).toBe('sign-in'));
test('lets signed-in users through when membership is not required', () => expect(decideAccess(false, true)).toBe('ok'));
test('waits for membership', () => expect(decideAccess(false, true, 'loading')).toBe('wait'));
test('shows the no-group screen', () => expect(decideAccess(false, true, 'none')).toBe('no-group'));
test('shows an error with retry', () => expect(decideAccess(false, true, 'error')).toBe('error'));
test('lets members in', () => expect(decideAccess(false, true, 'found')).toBe('ok'));
test('signed-out beats membership state', () => expect(decideAccess(false, false, 'found')).toBe('sign-in'));
```

`src/features/auth/safeNext.test.ts`:
```ts
import { expect, test } from 'vitest';
import { safeNext } from './safeNext';

test('keeps in-app paths', () => {
  expect(safeNext('/passbook')).toBe('/passbook');
  expect(safeNext('/group?settings=open')).toBe('/group?settings=open');
  expect(safeNext('/invite/abc')).toBe('/invite/abc');
});

test('refuses anything that could leave the app', () => {
  for (const bad of ['//evil.example', 'https://evil.example', '/\\evil.example', 'javascript:alert(1)', 'evil', '', null, undefined]) {
    expect(safeNext(bad)).toBe('/');
  }
});

test('avoids sign-in loops', () => {
  expect(safeNext('/sign-in?next=/x')).toBe('/');
  expect(safeNext('/auth/callback')).toBe('/');
});
```

`src/features/auth/SignInMethods.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, expect, test, vi } from 'vitest';

const auth = {
  signInWithOAuth: vi.fn(),
  signInWithOtp: vi.fn(),
  signInWithPassword: vi.fn(),
  resetPasswordForEmail: vi.fn(),
};
vi.mock('@/lib/supabase', () => ({ supabase: { auth } }));
const { SignInMethods } = await import('./SignInMethods');

const renderIt = () => render(<MemoryRouter><SignInMethods next="/passbook" /></MemoryRouter>);

beforeEach(() => Object.values(auth).forEach((f) => f.mockReset().mockResolvedValue({ error: null })));

test('offers all three sign-in methods', () => {
  renderIt();
  expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Email me a sign-in link' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Use a password instead' })).toBeInTheDocument();
});

test('asks for an email before sending a link', async () => {
  renderIt();
  await userEvent.click(screen.getByRole('button', { name: 'Email me a sign-in link' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Enter your email address.');
  expect(auth.signInWithOtp).not.toHaveBeenCalled();
});

test('sends a magic link that never creates accounts', async () => {
  renderIt();
  await userEvent.type(screen.getByLabelText('Email'), 'tafara@example.com');
  await userEvent.click(screen.getByRole('button', { name: 'Email me a sign-in link' }));
  expect(auth.signInWithOtp).toHaveBeenCalledWith({
    email: 'tafara@example.com',
    options: { emailRedirectTo: 'http://localhost:3000/auth/callback?next=%2Fpassbook', shouldCreateUser: false },
  });
  expect(await screen.findByText(/Check your email/)).toBeInTheDocument();
});

test('shows a friendly message for a wrong password', async () => {
  auth.signInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials', status: 400 } });
  renderIt();
  await userEvent.click(screen.getByRole('button', { name: 'Use a password instead' }));
  await userEvent.type(screen.getByLabelText('Email'), 'tafara@example.com');
  await userEvent.type(screen.getByLabelText('Password'), 'wrong-pass');
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(await screen.findByText('That email and password don’t match.')).toBeInTheDocument();
});
```

Add to `vite.config.ts` → `test` block so `window.location.origin` is predictable:
```ts
    environmentOptions: { jsdom: { url: 'http://localhost:3000/' } },
```

- [ ] **Step 2: Run to verify failure**

Run: `bun run test src/features/auth`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the pure helpers**

`src/features/auth/access.ts`:
```ts
export type MembershipState = 'loading' | 'error' | 'none' | 'found';
export type Access = 'wait' | 'sign-in' | 'error' | 'no-group' | 'ok';

export function decideAccess(sessionLoading: boolean, hasSession: boolean, membership?: MembershipState): Access {
  if (sessionLoading) return 'wait';
  if (!hasSession) return 'sign-in';
  if (membership === undefined || membership === 'found') return 'ok';
  if (membership === 'loading') return 'wait';
  if (membership === 'error') return 'error';
  return 'no-group';
}
```

`src/features/auth/safeNext.ts`:
```ts
export function safeNext(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return '/';
  if (raw.startsWith('/sign-in') || raw.startsWith('/auth/')) return '/';
  return raw;
}
```

- [ ] **Step 4: Implement the session provider and layout pieces**

`src/features/auth/SessionProvider.tsx`:
```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { wipeLocalData } from '@/lib/queryClient';

type SessionState = { session: Session | null; loading: boolean };
const SessionContext = createContext<SessionState>({ session: null, loading: true });

export function SessionProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [state, setState] = useState<SessionState>({ session: null, loading: true });

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setState({ session: data.session, loading: false });
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
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
```

`src/app/BrandMark.tsx`:
```tsx
export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden className="shrink-0">
      <rect width="512" height="512" rx="112" className="fill-accent-solid" />
      <path d="M176 368V144h96c48 0 80 30 80 72s-32 72-80 72h-48v80" fill="none" className="stroke-on-accent" strokeWidth="44" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
```

`src/app/AuthLayout.tsx`:
```tsx
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
```

`src/app/FullScreenLoader.tsx`:
```tsx
import { Loader2 } from 'lucide-react';

export function FullScreenLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" className="grid min-h-dvh place-items-center">
      <Loader2 aria-hidden className="size-8 animate-spin text-accent" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
```

- [ ] **Step 5: Implement sign-in**

`src/features/auth/SignInMethods.tsx`:
```tsx
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Mail } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { friendlyError } from '@/lib/errors';
import { Alert, Button, TextField } from '@/ui';

const callback = (next: string) => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h6a5.1 5.1 0 0 1-2.2 3.3v2.8h3.6c2.1-1.9 3.2-4.8 3.2-8.1z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.2 1-3.7 1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.9A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.8 14a6.6 6.6 0 0 1 0-4.2V7H2.1a11 11 0 0 0 0 9.9L5.8 14z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7l3.7 2.9C6.7 7.3 9.1 5.4 12 5.4z" />
    </svg>
  );
}

export function SignInMethods({ next, email: initialEmail = '' }: { next: string; email?: string }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'link' | 'password'>('link');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<'link' | 'reset' | null>(null);

  async function run(key: string, action: () => Promise<{ error: unknown }>, onOk?: () => void) {
    setError(null);
    setBusy(key);
    try {
      const { error: err } = await action();
      if (err) setError(friendlyError(err));
      else onOk?.();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(null);
    }
  }

  const needEmail = () => {
    if (email.trim()) return false;
    setError('Enter your email address.');
    return true;
  };

  const google = () =>
    run('google', () => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: callback(next) } }));

  const sendLink = (e?: FormEvent) => {
    e?.preventDefault();
    if (needEmail()) return;
    void run(
      'link',
      () => supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: callback(next), shouldCreateUser: false } }),
      () => setSent('link'),
    );
  };

  const signIn = (e: FormEvent) => {
    e.preventDefault();
    if (needEmail()) return;
    if (!password) return setError('Enter your password.');
    void run('password', () => supabase.auth.signInWithPassword({ email: email.trim(), password }), () => navigate(next, { replace: true }));
  };

  const reset = () => {
    if (needEmail()) return;
    void run(
      'reset',
      () => supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: callback('/account?reset=1') }),
      () => setSent('reset'),
    );
  };

  if (sent) {
    return (
      <Alert tone="success" title="Check your email">
        {sent === 'link'
          ? `We sent a sign-in link to ${email.trim()}. Open it on this device.`
          : `We sent a password reset link to ${email.trim()}.`}
      </Alert>
    );
  }

  return (
    <div className="grid gap-5">
      <Button variant="secondary" fullWidth leftIcon={<GoogleIcon />} isLoading={busy === 'google'} onClick={google}>
        Continue with Google
      </Button>

      <div className="flex items-center gap-3 text-sm text-muted" aria-hidden>
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </div>

      <form className="grid gap-4" onSubmit={mode === 'link' ? sendLink : signIn} noValidate>
        <TextField label="Email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        {mode === 'password' ? (
          <TextField label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        ) : null}
        {error ? <Alert tone="danger">{error}</Alert> : null}
        {mode === 'link' ? (
          <>
            <Button type="submit" fullWidth leftIcon={<Mail className="size-5" />} isLoading={busy === 'link'}>
              Email me a sign-in link
            </Button>
            <Button variant="ghost" fullWidth onClick={() => { setError(null); setMode('password'); }}>
              Use a password instead
            </Button>
          </>
        ) : (
          <>
            <Button type="submit" fullWidth isLoading={busy === 'password'}>Sign in</Button>
            <div className="flex justify-between gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setError(null); setMode('link'); }}>Email me a link instead</Button>
              <Button variant="ghost" size="sm" isLoading={busy === 'reset'} onClick={reset}>Forgot password?</Button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
```

`src/features/auth/SignInPage.tsx`:
```tsx
import { Navigate, useSearchParams } from 'react-router';
import { AuthLayout } from '@/app/AuthLayout';
import { FullScreenLoader } from '@/app/FullScreenLoader';
import { SignInMethods } from './SignInMethods';
import { useSession } from './SessionProvider';
import { safeNext } from './safeNext';

export function SignInPage() {
  const { session, loading } = useSession();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  if (loading) return <FullScreenLoader />;
  if (session) return <Navigate to={next} replace />;
  return (
    <AuthLayout title="Sign in" subtitle="Members join by invitation from the treasurer.">
      <SignInMethods next={next} />
    </AuthLayout>
  );
}
```

`src/features/auth/AuthCallback.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { AuthLayout } from '@/app/AuthLayout';
import { FullScreenLoader } from '@/app/FullScreenLoader';
import { Alert } from '@/ui';
import { useSession } from './SessionProvider';
import { safeNext } from './safeNext';

export function AuthCallback() {
  const { session } = useSession();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNext(params.get('next'));
  const [timedOut, setTimedOut] = useState(false);
  const hashError = new URLSearchParams(window.location.hash.slice(1)).get('error_description');

  useEffect(() => {
    if (session) navigate(next, { replace: true });
  }, [session, next, navigate]);

  useEffect(() => {
    const t = window.setTimeout(() => setTimedOut(true), 8000);
    return () => window.clearTimeout(t);
  }, []);

  if (hashError || timedOut) {
    return (
      <AuthLayout title="Sign-in link problem">
        <Alert tone="danger" action={<Link className="font-semibold underline" to="/sign-in">Back to sign in</Link>}>
          {hashError ? 'This sign-in link has expired or was already used. Request a new one.' : 'We couldn’t finish signing you in. Please try again.'}
        </Alert>
      </AuthLayout>
    );
  }
  return <FullScreenLoader label="Signing you in" />;
}
```

`src/features/auth/RequireAuth.tsx`:
```tsx
import { Navigate, Outlet, useLocation } from 'react-router';
import { FullScreenLoader } from '@/app/FullScreenLoader';
import { decideAccess } from './access';
import { useSession } from './SessionProvider';

export function RequireAuth() {
  const { session, loading } = useSession();
  const location = useLocation();
  const access = decideAccess(loading, Boolean(session));
  if (access === 'wait') return <FullScreenLoader />;
  if (access === 'sign-in') {
    return <Navigate to={`/sign-in?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }
  return <Outlet />;
}
```

- [ ] **Step 6: Wire providers and the first routes**

`src/app/Providers.tsx`:
```tsx
import { useState, type ReactNode } from 'react';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { CACHE_MAX_AGE, makeQueryClient, persister } from '@/lib/queryClient';
import { SessionProvider } from '@/features/auth/SessionProvider';
import { ToastProvider } from '@/ui';
import { ThemeProvider } from './ThemeProvider';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: CACHE_MAX_AGE, buster: 'foundation-1' }}>
      <ThemeProvider>
        <ToastProvider>
          <SessionProvider>{children}</SessionProvider>
        </ToastProvider>
      </ThemeProvider>
    </PersistQueryClientProvider>
  );
}
```

`src/app/router.tsx`:
```tsx
import { createBrowserRouter } from 'react-router';
import { AuthCallback } from '@/features/auth/AuthCallback';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { SignInPage } from '@/features/auth/SignInPage';

export const router = createBrowserRouter([
  { path: '/sign-in', element: <SignInPage /> },
  { path: '/auth/callback', element: <AuthCallback /> },
  {
    element: <RequireAuth />,
    children: [{ index: true, element: <p className="p-6">Signed in.</p> }],
  },
]);
```

`src/main.tsx` (replace):
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import '@fontsource-variable/inter';
import './styles/tokens.css';
import { Providers } from './app/Providers';
import { router } from './app/router';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');
createRoot(root).render(
  <StrictMode>
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  </StrictMode>,
);
```

Delete the placeholder app:
```bash
git rm -q src/App.tsx src/App.test.tsx
```

- [ ] **Step 7: Run tests and try it**

Run: `bun run test && bun run typecheck && bun run lint && bun run check:tokens`
Expected: all pass (access 8, safeNext 3, SignInMethods 4 added).

Then: `bun run db:start && bun run dev` with `.env.local` from `.env.example` (anon key from `bun x supabase status`). Visit http://localhost:3000 → redirected to `/sign-in?next=%2F`. Choose "Use a password instead", sign in as `member@pvb.test` / `password123` → "Signed in." Request a magic link for `member@pvb.test` → mail at http://127.0.0.1:54324 → link lands on `/auth/callback` → back to `/`. A magic link for `nobody@example.com` shows "We couldn’t find an account for that email…".

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add session provider, sign-in with Google/magic link/password and auth guard"
```

---

### Task 12: Membership, navigation model and the app shell

**Files:**
- Create: `src/features/group/useMembership.ts`, `src/features/group/GroupContext.tsx`, `src/features/group/RequireMembership.tsx`, `src/features/group/NoGroupScreen.tsx`, `src/app/nav.ts`, `src/app/AppShell.tsx`, `src/app/TopBar.tsx`, `src/app/BottomNav.tsx`, `src/app/Sidebar.tsx`, `src/app/MoreSheet.tsx`, `src/app/ThemeChoice.tsx`, `src/app/OfflineBanner.tsx`, `src/app/PullToRefresh.tsx`, `src/app/ErrorScreen.tsx`, `src/features/shells/ComingSoon.tsx`, `src/features/shells/NotFound.tsx`
- Modify: `src/app/router.tsx`
- Test: `src/features/group/useMembership.test.ts`, `src/app/nav.test.ts`, `src/app/PullToRefresh.test.ts`, `src/app/AppShell.test.tsx`

**Interfaces:**
- Consumes: Task 10–11 (`supabase`, `useSession`, `decideAccess`, `signOutEverywhere`, `friendlyError`), Task 4 UI.
- Produces:
  - `type GroupRow = { id; name; currency; owner_user_id; figures_visibility }`, `type MemberRow = { id; group_id; full_name; short_name; role; status; email }`, `type Membership = { group: GroupRow; member: MemberRow | null; isAdmin: boolean }`
  - `pickMembership(uid, rows, owned): Membership | null`, `useMembership(uid)` (query key `['membership', uid]`)
  - `GroupProvider`, `useGroup(): Membership`, `RequireMembership` (layout route)
  - `type NavKey = 'home'|'passbook'|'declare'|'plan'|'desk'|'record'|'group'|'rules'|'account'`, `type NavItem = { key; label; to; icon }`, `NAV: Record<NavKey, NavItem>`, `bottomNav(isAdmin)`, `moreItems(isAdmin)`, `sidebarItems(isAdmin)`
  - `AppShell` (layout route; opens settings by setting `?settings=open`; route `handle: { title: string }` gives the top-bar title)
  - `PullToRefresh({ onRefresh, children })`, `pullDistance(dy)`, `PULL_TRIGGER = 64`
  - `ComingSoon({ title })`, `NotFound`, `ErrorScreen({ message, onRetry })`, `ThemeChoice`

- [ ] **Step 1: Write the failing tests**

`src/features/group/useMembership.test.ts`:
```ts
import { expect, test } from 'vitest';
import { pickMembership, type GroupRow, type MemberRow } from './useMembership';

const g = (id: string, name: string, owner = 'someone'): GroupRow => ({ id, name, currency: 'ZMW', owner_user_id: owner, figures_visibility: 'open' });
const m = (over: Partial<MemberRow>): MemberRow => ({ id: 'm1', group_id: 'g1', full_name: 'Tafara', short_name: 'Tafara', role: 'member', status: 'active', email: null, ...over });

test('member of a group', () => {
  const res = pickMembership('u1', [{ ...m({}), groups: g('g1', 'Premium') }], []);
  expect(res?.group.name).toBe('Premium');
  expect(res?.member?.short_name).toBe('Tafara');
  expect(res?.isAdmin).toBe(false);
});

test('admin role makes an admin', () => {
  expect(pickMembership('u1', [{ ...m({ role: 'admin' }), groups: g('g1', 'Premium') }], [])?.isAdmin).toBe(true);
});

test('group owner is admin even as a plain member', () => {
  expect(pickMembership('u1', [{ ...m({}), groups: g('g1', 'Premium', 'u1') }], [])?.isAdmin).toBe(true);
});

test('owner without a member row still gets the group', () => {
  const res = pickMembership('u1', [], [g('g1', 'Premium', 'u1')]);
  expect(res).toEqual({ group: g('g1', 'Premium', 'u1'), member: null, isAdmin: true });
});

test('members who left are ignored', () => {
  expect(pickMembership('u1', [{ ...m({ status: 'left' }), groups: g('g1', 'Premium') }], [])).toBeNull();
});

test('no group at all', () => expect(pickMembership('u1', [], [])).toBeNull());
```

`src/app/nav.test.ts`:
```ts
import { expect, test } from 'vitest';
import { bottomNav, moreItems, sidebarItems } from './nav';

const keys = (items: { key: string }[]) => items.map((i) => i.key);

test('members: Home, Passbook, Declare, Plan in the bottom nav', () => {
  expect(keys(bottomNav(false))).toEqual(['home', 'passbook', 'declare', 'plan']);
  expect(keys(moreItems(false))).toEqual(['record', 'group', 'rules', 'account']);
});

test('admins: Desk replaces Plan, Plan moves into More', () => {
  expect(keys(bottomNav(true))).toEqual(['home', 'passbook', 'declare', 'desk']);
  expect(keys(moreItems(true))).toEqual(['record', 'group', 'plan', 'rules', 'account']);
});

test('sidebar shows Desk only to admins', () => {
  expect(keys(sidebarItems(false))).not.toContain('desk');
  expect(keys(sidebarItems(true))).toContain('desk');
});
```

`src/app/PullToRefresh.test.ts`:
```ts
import { expect, test } from 'vitest';
import { PULL_TRIGGER, pullDistance } from './PullToRefresh';

test('ignores upward drags', () => expect(pullDistance(-40)).toBe(0));
test('resists the pull', () => expect(pullDistance(100)).toBe(50));
test('caps the indicator', () => expect(pullDistance(1000)).toBe(96));
test('trigger needs a deliberate pull', () => {
  expect(pullDistance(120) >= PULL_TRIGGER).toBe(false);
  expect(pullDistance(128) >= PULL_TRIGGER).toBe(true);
});
```

`src/app/AppShell.test.tsx`:
```tsx
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { expect, test, vi } from 'vitest';
import { GroupProvider } from '@/features/group/GroupContext';
import type { Membership } from '@/features/group/useMembership';
import { ThemeProvider } from './ThemeProvider';

vi.mock('@/lib/supabase', () => ({ supabase: { auth: { signOut: vi.fn() } } }));
const { AppShell } = await import('./AppShell');

function renderShell(isAdmin: boolean) {
  const membership: Membership = {
    group: { id: 'g1', name: 'Premium Village Banking', currency: 'ZMW', owner_user_id: 'x', figures_visibility: 'open' },
    member: { id: 'm1', group_id: 'g1', full_name: 'Tafara', short_name: 'Tafara', role: isAdmin ? 'admin' : 'member', status: 'active', email: null },
    isAdmin,
  };
  const router = createMemoryRouter(
    [{ element: <AppShell />, children: [{ index: true, element: <p>Home body</p>, handle: { title: 'Home' } }] }],
    { initialEntries: ['/'] },
  );
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ThemeProvider>
        <GroupProvider value={membership}>
          <RouterProvider router={router} />
        </GroupProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

test('member bottom nav has Plan and no Desk or gear', () => {
  renderShell(false);
  const nav = screen.getByRole('navigation', { name: 'Main' });
  expect(within(nav).getByRole('link', { name: 'Plan' })).toBeInTheDocument();
  expect(within(nav).queryByRole('link', { name: 'Desk' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Group settings' })).toBeNull();
});

test('admin bottom nav has Desk and the gear', () => {
  renderShell(true);
  const nav = screen.getByRole('navigation', { name: 'Main' });
  expect(within(nav).getByRole('link', { name: 'Desk' })).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: 'Group settings' }).length).toBeGreaterThan(0);
});

test('marks the current tab', () => {
  renderShell(false);
  const nav = screen.getByRole('navigation', { name: 'Main' });
  expect(within(nav).getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun run test src/features/group src/app`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement membership**

`src/features/group/useMembership.ts`:
```ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/lib/database.types';

export type GroupRow = Pick<Tables<'groups'>, 'id' | 'name' | 'currency' | 'owner_user_id' | 'figures_visibility'>;
export type MemberRow = Pick<Tables<'members'>, 'id' | 'group_id' | 'full_name' | 'short_name' | 'role' | 'status' | 'email'>;
export type Membership = { group: GroupRow; member: MemberRow | null; isAdmin: boolean };
type MemberWithGroup = MemberRow & { groups: GroupRow | null };

const GROUP_COLUMNS = 'id, name, currency, owner_user_id, figures_visibility';

export function pickMembership(uid: string, rows: MemberWithGroup[], owned: GroupRow[]): Membership | null {
  const linked = rows
    .filter((r): r is MemberWithGroup & { groups: GroupRow } => r.status === 'active' && r.groups !== null)
    .sort((a, b) => a.groups.name.localeCompare(b.groups.name));
  const first = linked[0];
  if (first) {
    const { groups, ...member } = first;
    return { group: groups, member, isAdmin: member.role === 'admin' || groups.owner_user_id === uid };
  }
  const own = [...owned].sort((a, b) => a.name.localeCompare(b.name))[0];
  return own ? { group: own, member: null, isAdmin: true } : null;
}

export function useMembership(uid: string | undefined) {
  return useQuery({
    queryKey: ['membership', uid],
    enabled: Boolean(uid),
    queryFn: async () => {
      const [mine, owned] = await Promise.all([
        supabase
          .from('members')
          .select(`id, group_id, full_name, short_name, role, status, email, groups (${GROUP_COLUMNS})`)
          .eq('user_id', uid!),
        supabase.from('groups').select(GROUP_COLUMNS).eq('owner_user_id', uid!),
      ]);
      if (mine.error) throw mine.error;
      if (owned.error) throw owned.error;
      return pickMembership(uid!, mine.data as unknown as MemberWithGroup[], owned.data);
    },
  });
}
```

`src/features/group/GroupContext.tsx`:
```tsx
import { createContext, useContext } from 'react';
import type { Membership } from './useMembership';

const GroupContext = createContext<Membership | null>(null);
export const GroupProvider = GroupContext.Provider;

export function useGroup(): Membership {
  const value = useContext(GroupContext);
  if (!value) throw new Error('useGroup must be used inside RequireMembership');
  return value;
}
```

`src/app/ErrorScreen.tsx`:
```tsx
import { Alert, Button } from '@/ui';

export function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <main className="mx-auto grid min-h-dvh max-w-md place-items-center px-5">
      <Alert tone="danger" title="Couldn’t load your group" action={<Button size="sm" variant="secondary" onClick={onRetry}>Try again</Button>}>
        {message}
      </Alert>
    </main>
  );
}
```

`src/features/group/NoGroupScreen.tsx`:
```tsx
import { useQueryClient } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { AuthLayout } from '@/app/AuthLayout';
import { signOutEverywhere } from '@/features/auth/signOut';
import { Button, EmptyState } from '@/ui';

export function NoGroupScreen({ email }: { email?: string }) {
  const qc = useQueryClient();
  return (
    <AuthLayout title="Almost there">
      <EmptyState
        icon={<Users className="size-7" />}
        title="Your account isn’t linked to a group"
        action={<Button variant="secondary" onClick={() => signOutEverywhere(qc)}>Sign out</Button>}
      >
        Ask your treasurer for an invite{email ? <> for <strong className="text-fg">{email}</strong></> : null}. The invite link connects this account to your name.
      </EmptyState>
    </AuthLayout>
  );
}
```

`src/features/group/RequireMembership.tsx`:
```tsx
import { Outlet } from 'react-router';
import { FullScreenLoader } from '@/app/FullScreenLoader';
import { ErrorScreen } from '@/app/ErrorScreen';
import { decideAccess, type MembershipState } from '@/features/auth/access';
import { useSession } from '@/features/auth/SessionProvider';
import { friendlyError } from '@/lib/errors';
import { GroupProvider } from './GroupContext';
import { NoGroupScreen } from './NoGroupScreen';
import { useMembership } from './useMembership';

export function RequireMembership() {
  const { session } = useSession();
  const query = useMembership(session?.user.id);
  const state: MembershipState = query.isPending ? 'loading' : query.isError ? 'error' : query.data ? 'found' : 'none';
  const access = decideAccess(false, Boolean(session), state);

  if (access === 'wait') return <FullScreenLoader />;
  if (access === 'error') return <ErrorScreen message={friendlyError(query.error)} onRetry={() => void query.refetch()} />;
  if (access !== 'ok' || !query.data) return <NoGroupScreen email={session?.user.email ?? undefined} />;
  return (
    <GroupProvider value={query.data}>
      <Outlet />
    </GroupProvider>
  );
}
```

- [ ] **Step 4: Implement the navigation model**

`src/app/nav.ts`:
```ts
import { BookOpen, ClipboardCheck, History, Home, PlusCircle, ScrollText, TrendingUp, UserCircle, Users, type LucideIcon } from 'lucide-react';

export type NavKey = 'home' | 'passbook' | 'declare' | 'plan' | 'desk' | 'record' | 'group' | 'rules' | 'account';
export type NavItem = { key: NavKey; label: string; to: string; icon: LucideIcon };

export const NAV: Record<NavKey, NavItem> = {
  home: { key: 'home', label: 'Home', to: '/', icon: Home },
  passbook: { key: 'passbook', label: 'Passbook', to: '/passbook', icon: BookOpen },
  declare: { key: 'declare', label: 'Declare', to: '/declare', icon: PlusCircle },
  plan: { key: 'plan', label: 'Plan', to: '/plan', icon: TrendingUp },
  desk: { key: 'desk', label: 'Desk', to: '/desk', icon: ClipboardCheck },
  record: { key: 'record', label: 'My record', to: '/record', icon: History },
  group: { key: 'group', label: 'Group', to: '/group', icon: Users },
  rules: { key: 'rules', label: 'Rules', to: '/rules', icon: ScrollText },
  account: { key: 'account', label: 'Account', to: '/account', icon: UserCircle },
};

const pick = (keys: NavKey[]) => keys.map((k) => NAV[k]);

export const bottomNav = (isAdmin: boolean) => pick(isAdmin ? ['home', 'passbook', 'declare', 'desk'] : ['home', 'passbook', 'declare', 'plan']);
export const moreItems = (isAdmin: boolean) => pick(isAdmin ? ['record', 'group', 'plan', 'rules', 'account'] : ['record', 'group', 'rules', 'account']);
export const sidebarItems = (isAdmin: boolean) =>
  pick(isAdmin
    ? ['home', 'passbook', 'declare', 'plan', 'record', 'group', 'desk', 'rules', 'account']
    : ['home', 'passbook', 'declare', 'plan', 'record', 'group', 'rules', 'account']);
```

- [ ] **Step 5: Implement the shell pieces**

`src/app/ThemeChoice.tsx`:
```tsx
import { Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '@/ui';
import type { ThemePref } from '@/lib/theme';
import { useTheme } from './ThemeProvider';

const OPTIONS: { value: ThemePref; label: string; icon: typeof Sun }[] = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
];

export function ThemeChoice() {
  const { pref, setPref } = useTheme();
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-fg">Theme</legend>
      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <label
            key={value}
            className={cn(
              'flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border text-sm font-medium transition active:scale-[.97]',
              pref === value ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface text-fg',
            )}
          >
            <input type="radio" name="theme" value={value} checked={pref === value} onChange={() => setPref(value)} className="sr-only" />
            <Icon aria-hidden className="size-4" />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
```

`src/app/OfflineBanner.tsx`:
```tsx
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
```

`src/app/PullToRefresh.tsx`:
```tsx
import { useRef, useState, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/ui';

export const PULL_TRIGGER = 64;
export const pullDistance = (dy: number): number => (dy <= 0 ? 0 : Math.min(96, Math.round(dy * 0.5)));

export function PullToRefresh({ onRefresh, children }: { onRefresh: () => Promise<unknown>; children: ReactNode }) {
  const [distance, setDistance] = useState(0);
  const [busy, setBusy] = useState(false);
  const startY = useRef<number | null>(null);

  return (
    <div
      onTouchStart={(e) => {
        if (window.scrollY <= 0 && !busy) startY.current = e.touches[0]?.clientY ?? null;
      }}
      onTouchMove={(e) => {
        if (startY.current !== null) setDistance(pullDistance((e.touches[0]?.clientY ?? 0) - startY.current));
      }}
      onTouchEnd={async () => {
        const pulled = distance;
        startY.current = null;
        setDistance(0);
        if (pulled < PULL_TRIGGER) return;
        setBusy(true);
        try {
          await onRefresh();
        } finally {
          setBusy(false);
        }
      }}
    >
      <div aria-hidden className="flex justify-center overflow-hidden transition-[height] duration-150" style={{ height: busy ? 40 : distance }}>
        <RefreshCw className={cn('mt-2 size-5 text-muted', busy && 'animate-spin')} style={{ transform: `rotate(${distance * 3}deg)` }} />
      </div>
      {children}
    </div>
  );
}
```

`src/app/BottomNav.tsx`:
```tsx
import { NavLink } from 'react-router';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '@/ui';
import { bottomNav } from './nav';

const item = 'flex h-16 w-full flex-col items-center justify-center gap-1 text-xs font-medium transition duration-150 active:scale-[.97]';
const pill = 'grid h-8 w-14 place-items-center rounded-full transition';

export function BottomNav({ isAdmin, onMore }: { isAdmin: boolean; onMore: () => void }) {
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="grid grid-cols-5">
        {bottomNav(isAdmin).map(({ key, label, to, icon: Icon }) => (
          <li key={key}>
            <NavLink to={to} end={to === '/'} viewTransition className={({ isActive }) => cn(item, isActive ? 'text-accent' : 'text-muted')}>
              {({ isActive }) => (
                <>
                  <span className={cn(pill, isActive && 'bg-accent-soft')}>
                    <Icon aria-hidden className="size-6" />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
        <li>
          <button type="button" aria-haspopup="dialog" onClick={onMore} className={cn(item, 'text-muted')}>
            <span className={pill}>
              <MoreHorizontal aria-hidden className="size-6" />
            </span>
            More
          </button>
        </li>
      </ul>
    </nav>
  );
}
```

`src/app/TopBar.tsx`:
```tsx
import { Link, useMatches } from 'react-router';
import { Settings } from 'lucide-react';
import { useGroup } from '@/features/group/GroupContext';
import { Avatar, IconButton } from '@/ui';

export function TopBar({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { isAdmin, member, group } = useGroup();
  const matches = useMatches();
  const title = [...matches].reverse().map((m) => (m.handle as { title?: string } | undefined)?.title).find(Boolean) ?? group.name;
  return (
    <div className="sticky top-0 z-30 border-b border-line bg-canvas/85 pt-[env(safe-area-inset-top)] backdrop-blur md:hidden">
      <div className="flex h-14 items-center gap-1 px-4">
        <span className="flex-1 truncate text-lg font-semibold text-fg">{title}</span>
        {isAdmin ? <IconButton label="Group settings" icon={<Settings className="size-5" />} onClick={onOpenSettings} /> : null}
        <Link to="/account" aria-label="Account" className="grid size-11 place-items-center rounded-xl active:scale-[.97]">
          <Avatar name={member?.full_name ?? group.name} size="sm" />
        </Link>
      </div>
    </div>
  );
}
```

`src/app/Sidebar.tsx`:
```tsx
import { NavLink } from 'react-router';
import { Settings } from 'lucide-react';
import { useGroup } from '@/features/group/GroupContext';
import { Button, cn } from '@/ui';
import { BrandMark } from './BrandMark';
import { sidebarItems } from './nav';
import { ThemeChoice } from './ThemeChoice';

export function Sidebar({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { isAdmin, group } = useGroup();
  return (
    <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r border-line bg-surface p-4 md:flex">
      <div className="flex items-center gap-3 px-2">
        <BrandMark size={36} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-fg">{group.name}</p>
          <p className="text-xs text-muted">Premium Village Bank</p>
        </div>
      </div>
      <nav aria-label="Sections" className="flex-1">
        <ul className="grid gap-1">
          {sidebarItems(isAdmin).map(({ key, label, to, icon: Icon }) => (
            <li key={key}>
              <NavLink
                to={to}
                end={to === '/'}
                viewTransition
                className={({ isActive }) =>
                  cn('flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition', isActive ? 'bg-accent-soft text-accent' : 'text-fg hover:bg-surface-2')
                }
              >
                <Icon aria-hidden className="size-5" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      {isAdmin ? (
        <Button variant="secondary" size="sm" leftIcon={<Settings className="size-4" />} onClick={onOpenSettings} aria-label="Group settings">
          Group settings
        </Button>
      ) : null}
      <ThemeChoice />
    </aside>
  );
}
```

`src/app/MoreSheet.tsx`:
```tsx
import { Link } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronRight, LogOut } from 'lucide-react';
import { signOutEverywhere } from '@/features/auth/signOut';
import { Button, Sheet } from '@/ui';
import { moreItems } from './nav';
import { ThemeChoice } from './ThemeChoice';

export function MoreSheet({ open, onClose, isAdmin }: { open: boolean; onClose: () => void; isAdmin: boolean }) {
  const qc = useQueryClient();
  return (
    <Sheet open={open} onClose={onClose} title="More">
      <ul className="mb-6 grid gap-1">
        {moreItems(isAdmin).map(({ key, label, to, icon: Icon }) => (
          <li key={key}>
            <Link to={to} viewTransition onClick={onClose} className="flex h-14 items-center gap-3 rounded-xl px-3 text-base font-medium text-fg transition hover:bg-surface-2 active:scale-[.98]">
              <Icon aria-hidden className="size-5 text-muted" />
              <span className="flex-1">{label}</span>
              <ChevronRight aria-hidden className="size-5 text-muted" />
            </Link>
          </li>
        ))}
      </ul>
      <ThemeChoice />
      <Button className="mt-6" variant="secondary" fullWidth leftIcon={<LogOut className="size-5" />} onClick={() => signOutEverywhere(qc)}>
        Sign out
      </Button>
    </Sheet>
  );
}
```

`src/app/AppShell.tsx`:
```tsx
import { useState } from 'react';
import { Outlet, useSearchParams } from 'react-router';
import { useGroup } from '@/features/group/GroupContext';
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
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-xl focus:bg-surface focus:px-4 focus:py-2">
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
    </div>
  );
}
```

`src/features/shells/ComingSoon.tsx`:
```tsx
import { CalendarClock } from 'lucide-react';
import { EmptyState, PageHeader } from '@/ui';

export function ComingSoon({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} />
      <EmptyState icon={<CalendarClock className="size-7" />} title="Available when the February 2027 cycle opens">
        Your {title.toLowerCase()} fills in once the new cycle starts and declarations are logged.
      </EmptyState>
    </>
  );
}
```

`src/features/shells/NotFound.tsx`:
```tsx
import { Link } from 'react-router';
import { Compass } from 'lucide-react';
import { EmptyState } from '@/ui';

export function NotFound({ title = 'Page not found', body = 'That page doesn’t exist.' }: { title?: string; body?: string }) {
  return (
    <EmptyState icon={<Compass className="size-7" />} title={title} action={<Link to="/" className="font-semibold text-accent underline">Go home</Link>}>
      {body}
    </EmptyState>
  );
}
```

- [ ] **Step 6: Mount the shell in the router**

`src/app/router.tsx` (replace):
```tsx
import type { ReactNode } from 'react';
import { createBrowserRouter } from 'react-router';
import { AuthCallback } from '@/features/auth/AuthCallback';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { SignInPage } from '@/features/auth/SignInPage';
import { RequireMembership } from '@/features/group/RequireMembership';
import { ComingSoon } from '@/features/shells/ComingSoon';
import { NotFound } from '@/features/shells/NotFound';
import { AppShell } from './AppShell';

const page = (path: string, title: string, element: ReactNode) => ({ path, element, handle: { title } });

export const router = createBrowserRouter([
  { path: '/sign-in', element: <SignInPage /> },
  { path: '/auth/callback', element: <AuthCallback /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <RequireMembership />,
        children: [
          {
            element: <AppShell />,
            children: [
              { index: true, element: <ComingSoon title="Home" />, handle: { title: 'Home' } },
              page('passbook', 'Passbook', <ComingSoon title="Passbook" />),
              page('declare', 'Declare', <ComingSoon title="Declaration" />),
              page('plan', 'Plan', <ComingSoon title="Plan" />),
              page('record', 'My record', <ComingSoon title="Record" />),
              page('group', 'Group', <ComingSoon title="Group" />),
              page('desk', 'Desk', <ComingSoon title="Desk" />),
              page('rules', 'Rules', <ComingSoon title="Rules" />),
              page('account', 'Account', <ComingSoon title="Account" />),
              page('*', 'Not found', <NotFound />),
            ],
          },
        ],
      },
    ],
  },
]);
```

- [ ] **Step 7: Run tests and check on a phone-sized window**

Run: `bun run test && bun run typecheck && bun run lint && bun run check:tokens`
Expected: all pass (membership 6, nav 3, pull 4, shell 3 added).

`bun run dev`, sign in as `member@pvb.test` at a 390px-wide window: bottom nav shows Home, Passbook, Declare, Plan, More; no gear. Sign out from More, sign in as `admin@pvb.test`: Desk replaces Plan and the gear appears. At 1280px the sidebar replaces both bars. `outsider@pvb.test` sees "Your account isn’t linked to a group".

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add membership guard, member/admin navigation and mobile-first app shell"
```

---

### Task 13: Invite acceptance page

**Files:**
- Create: `src/features/invite/InvitePage.tsx`
- Modify: `src/app/router.tsx` (public route `/invite/:token`)
- Test: `src/features/invite/InvitePage.test.tsx`

**Interfaces:**
- Consumes: `invite_preview`, `accept_invite` RPCs (Task 7); `useSession`, `SignInMethods`, `signOutEverywhere` (Tasks 10–11); `friendlyError`.
- Produces: route `/invite/:token` (outside `RequireAuth`). Signed out → preview + sign-in methods returning to the same URL. Signed in → calls `accept_invite` once, then invalidates `['membership']`, toasts "Welcome, {short_name}" and navigates to `/`.

- [ ] **Step 1: Write the failing tests**

`src/features/invite/InvitePage.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, expect, test, vi } from 'vitest';
import { ToastProvider } from '@/ui';

const rpc = vi.fn();
const signOut = vi.fn().mockResolvedValue({ error: null });
let session: { user: { email: string } } | null = null;

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...a: unknown[]) => rpc(...a), auth: { signOut, signInWithOAuth: vi.fn(), signInWithOtp: vi.fn(), signInWithPassword: vi.fn(), resetPasswordForEmail: vi.fn() } },
}));
vi.mock('@/features/auth/SessionProvider', () => ({ useSession: () => ({ session, loading: false }) }));
const { InvitePage } = await import('./InvitePage');

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/invite/:token', element: <InvitePage /> },
      { path: '/', element: <p>Home</p> },
    ],
    { initialEntries: [path] },
  );
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

const preview = (status: string) => ({ data: { status, group_name: 'Premium Village Banking', member_name: 'Tafara', email_hint: 't•••@gmail.com' }, error: null });

beforeEach(() => {
  rpc.mockReset();
  session = null;
});

test('signed out: names the group and member and offers sign-in', async () => {
  rpc.mockResolvedValueOnce(preview('valid'));
  renderAt('/invite/tok');
  expect(await screen.findByText(/as Tafara/)).toBeInTheDocument();
  expect(screen.getByText(/t•••@gmail\.com/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
});

test('expired invite explains what to do', async () => {
  rpc.mockResolvedValueOnce(preview('expired'));
  renderAt('/invite/tok');
  expect(await screen.findByText('This invite has expired. Ask your treasurer to send a new one.')).toBeInTheDocument();
});

test('signed in with the right email: links and goes home', async () => {
  session = { user: { email: 'tafara@gmail.com' } };
  rpc.mockResolvedValueOnce(preview('valid')).mockResolvedValueOnce({ data: { short_name: 'Tafara' }, error: null });
  renderAt('/invite/tok');
  expect(await screen.findByText('Home')).toBeInTheDocument();
  expect(rpc).toHaveBeenCalledWith('accept_invite', { p_token: 'tok' });
});

test('signed in with another account: explains and offers sign out', async () => {
  session = { user: { email: 'treasurer@gmail.com' } };
  rpc.mockResolvedValueOnce(preview('valid')).mockResolvedValueOnce({ data: null, error: { message: 'email_mismatch', code: 'P0001' } });
  renderAt('/invite/tok');
  expect(await screen.findByText(/sent to a different email address/)).toBeInTheDocument();
  expect(screen.getByText(/treasurer@gmail\.com/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Sign out and use the invited email' }));
  expect(signOut).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun run test src/features/invite`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/features/invite/InvitePage.tsx`:
```tsx
import { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { AuthLayout } from '@/app/AuthLayout';
import { SignInMethods } from '@/features/auth/SignInMethods';
import { useSession } from '@/features/auth/SessionProvider';
import { signOutEverywhere } from '@/features/auth/signOut';
import { friendlyError } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { supabase } from '@/lib/supabase';
import { Alert, Button, Skeleton, useToast } from '@/ui';

type Preview = { status: 'valid' | 'expired' | 'revoked' | 'used' | 'not_found'; group_name?: string; member_name?: string; email_hint?: string };

export function InvitePage() {
  const { token = '' } = useParams();
  const { session, loading } = useSession();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const attempted = useRef(false);

  const preview = useQuery({
    queryKey: ['invite-preview', token],
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('invite_preview', { p_token: token });
      if (error) throw error;
      return data as unknown as Preview;
    },
  });

  const accept = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('accept_invite', { p_token: token });
      if (error) throw error;
      return data as { short_name: string };
    },
    onSuccess: async (member) => {
      haptic();
      await qc.invalidateQueries({ queryKey: ['membership'] });
      toast(`Welcome, ${member.short_name}`, { tone: 'success' });
      navigate('/', { replace: true });
    },
  });

  const { mutate } = accept;
  useEffect(() => {
    if (session && preview.data?.status === 'valid' && !attempted.current) {
      attempted.current = true;
      mutate();
    }
  }, [session, preview.data?.status, mutate]);

  const p = preview.data;
  const heading = p?.member_name ? `You’re invited to ${p.group_name} as ${p.member_name}` : 'Your invitation';

  return (
    <AuthLayout title="Join your group">
      {preview.isPending || loading ? (
        <Skeleton className="h-40" />
      ) : preview.isError ? (
        <Alert tone="danger" action={<Button size="sm" variant="secondary" onClick={() => void preview.refetch()}>Try again</Button>}>
          {friendlyError(preview.error)}
        </Alert>
      ) : p && p.status !== 'valid' ? (
        <Alert tone="warning">{friendlyError({ message: `invite_${p.status}` })}</Alert>
      ) : session ? (
        accept.isError ? (
          <Alert
            tone="danger"
            title="We couldn’t link your account"
            action={
              <Button size="sm" variant="secondary" onClick={() => signOutEverywhere(qc)}>
                Sign out and use the invited email
              </Button>
            }
          >
            {friendlyError(accept.error)} You’re signed in as <strong>{session.user.email}</strong>.
          </Alert>
        ) : (
          <p role="status" className="flex items-center gap-3 text-base text-muted">
            <Loader2 aria-hidden className="size-5 animate-spin text-accent" /> Linking your account…
          </p>
        )
      ) : (
        <div className="grid gap-6">
          <div>
            <h2 className="text-xl font-semibold text-fg">{heading}</h2>
            <p className="mt-1 text-base text-muted">
              Sign in with the email this invite was sent to ({p?.email_hint}). If you’re new, the emailed link signs you in.
            </p>
          </div>
          <SignInMethods next={`/invite/${token}`} />
        </div>
      )}
    </AuthLayout>
  );
}
```

`friendlyError({ message: 'invite_not_found' })` covers `not_found` because the status is prefixed with `invite_`.

Add the route in `src/app/router.tsx` next to `/sign-in`:
```tsx
import { InvitePage } from '@/features/invite/InvitePage';
// …
  { path: '/invite/:token', element: <InvitePage /> },
```

- [ ] **Step 4: Run tests**

Run: `bun run test && bun run typecheck && bun run lint`
Expected: all pass (invite 4 added).

- [ ] **Step 5: Try the full flow locally**

With `supabase functions serve invite-member` running (Task 9 Step 6) and the app on :3000: sign in as `admin@pvb.test`, invite Charles via the curl in Task 9 Step 6 (UI arrives in Task 15). Open the email at http://127.0.0.1:54324 in a private window → lands on `/invite/<token>` signed in → "Welcome, Charles" → Home. Open the same link again → "This invite has already been used. Sign in instead."

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add invite acceptance page with preview, linking and wrong-account recovery"
```

---

### Task 14: Home, Group, Rules and Desk screens

**Files:**
- Create: `src/lib/calendar.ts`, `src/lib/rulesText.ts`, `src/features/cycles/useCycles.ts`, `src/features/home/HomePage.tsx`, `src/features/home/UpcomingList.tsx`, `src/features/group/GroupPage.tsx`, `src/features/rules/RulesPage.tsx`, `src/features/desk/DeskPage.tsx`
- Modify: `src/app/router.tsx`
- Test: `src/lib/calendar.test.ts`, `src/lib/rulesText.test.ts`, `src/features/desk/DeskPage.test.tsx`

**Interfaces:**
- Consumes: `useGroup`, `supabase`, `formatDate`, `zmw`, `pct`, `localISODate`, UI primitives, `PullToRefresh`, `NotFound`.
- Produces:
  - `type CycleWithRules = Tables<'cycles'> & { rules: Tables<'cycle_rules'> | null }`; `useCycles(groupId)` (key `['cycles', groupId]`)
  - `pickCurrentCycle<T extends { status: string; starts_on: string; ends_on: string }>(cycles: T[], today: string): T | null`
  - `type DateEvent = { date: string; label: string; kind: 'start'|'window'|'loans'|'payout'|'end' }`; `upcomingDates(cycle, rules, today, limit?): DateEvent[]`; `ordinal(n): string`
  - `loanLimitLines(multiples: Json): string[]`, `tenorLines(bands: Json): string[]`
  - `useGroupMembers(groupId)` (key `['group-members', groupId]`) from `GroupPage.tsx`

- [ ] **Step 1: Write the failing tests**

`src/lib/calendar.test.ts`:
```ts
import { expect, test } from 'vitest';
import { ordinal, pickCurrentCycle, upcomingDates } from './calendar';

const cycle = { starts_on: '2027-02-15', ends_on: '2028-02-15', payout_on: '2028-02-05' };
const rules = { window_open_day: 5, window_close_day: 7 };

test('before the cycle: start first, then monthly windows and loan days', () => {
  expect(upcomingDates(cycle, rules, '2027-01-10', 4)).toEqual([
    { date: '2027-02-15', label: 'Cycle starts', kind: 'start' },
    { date: '2027-03-05', label: 'Declarations open (5th–7th)', kind: 'window' },
    { date: '2027-03-08', label: 'Loans sent out', kind: 'loans' },
    { date: '2027-04-05', label: 'Declarations open (5th–7th)', kind: 'window' },
  ]);
});

test('end of the cycle: payout and end are included, nothing after the end', () => {
  expect(upcomingDates(cycle, rules, '2028-01-20', 10).map((e) => `${e.date} ${e.kind}`)).toEqual([
    '2028-02-05 window',
    '2028-02-05 payout',
    '2028-02-08 loans',
    '2028-02-15 end',
  ]);
});

test('ordinals', () => {
  expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd']);
});

test('current cycle: active wins, then the next planned, then the latest', () => {
  const c = (status: string, starts_on: string, ends_on: string) => ({ status, starts_on, ends_on });
  expect(pickCurrentCycle([c('planned', '2027-02-15', '2028-02-15'), c('active', '2026-02-15', '2027-02-15')], '2026-10-08')?.status).toBe('active');
  expect(pickCurrentCycle([c('closed', '2026-02-15', '2027-02-15'), c('planned', '2027-02-15', '2028-02-15')], '2027-02-20')?.status).toBe('planned');
  expect(pickCurrentCycle([c('closed', '2025-02-15', '2026-02-15'), c('closed', '2026-02-15', '2027-02-15')], '2028-01-01')?.starts_on).toBe('2026-02-15');
  expect(pickCurrentCycle([], '2027-01-01')).toBeNull();
});
```

`src/lib/rulesText.test.ts`:
```ts
import { expect, test } from 'vitest';
import { loanLimitLines, tenorLines } from './rulesText';

test('loan limits read as sentences', () => {
  expect(loanLimitLines([
    { from_month: 1, to_month: 4, multiple: 3 },
    { from_month: 12, to_month: 12, multiple: 0 },
  ])).toEqual(['Months 1–4: up to 3× your savings', 'Month 12: no new loans']);
});

test('repayment periods read as sentences', () => {
  expect(tenorLines([
    { max: 3000, months: 1 },
    { max: 5000, months: 2 },
    { max: 9999.99, months: 3 },
    { max: null, months: 4 },
  ])).toEqual([
    'Up to K 3,000: 1 month',
    'K 3,000 to K 5,000: 2 months',
    'K 5,000 to K 9,999.99: 3 months',
    'Over K 9,999.99: 4 months',
  ]);
});

test('malformed JSON yields no lines instead of crashing', () => {
  expect(loanLimitLines(null)).toEqual([]);
  expect(tenorLines({ not: 'an array' })).toEqual([]);
});
```

`src/features/desk/DeskPage.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { expect, test } from 'vitest';
import { GroupProvider } from '@/features/group/GroupContext';
import type { Membership } from '@/features/group/useMembership';
import { DeskPage } from './DeskPage';

const membership = (isAdmin: boolean): Membership => ({
  group: { id: 'g1', name: 'Premium', currency: 'ZMW', owner_user_id: 'x', figures_visibility: 'open' },
  member: null,
  isAdmin,
});

test('members get a not-available screen', () => {
  render(<MemoryRouter><GroupProvider value={membership(false)}><DeskPage /></GroupProvider></MemoryRouter>);
  expect(screen.getByText('This page is for admins')).toBeInTheDocument();
});

test('admins get the desk placeholder', () => {
  render(<MemoryRouter><GroupProvider value={membership(true)}><DeskPage /></GroupProvider></MemoryRouter>);
  expect(screen.getByText('The treasurer desk arrives with the ledger')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun run test src/lib/calendar.test.ts src/lib/rulesText.test.ts src/features/desk`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the date and rules helpers**

`src/lib/calendar.ts`:
```ts
export type DateEvent = { date: string; label: string; kind: 'start' | 'window' | 'loans' | 'payout' | 'end' };
type CycleDates = { starts_on: string; ends_on: string; payout_on: string };
type WindowRules = { window_open_day: number; window_close_day: number };

const ORDER: Record<DateEvent['kind'], number> = { start: 0, window: 1, loans: 2, payout: 3, end: 4 };
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

export function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${suffix}`;
}

export function upcomingDates(cycle: CycleDates, rules: WindowRules, today: string, limit = 6): DateEvent[] {
  const events: DateEvent[] = [
    { date: cycle.starts_on, label: 'Cycle starts', kind: 'start' },
    { date: cycle.payout_on, label: 'Payout day', kind: 'payout' },
    { date: cycle.ends_on, label: 'Cycle ends', kind: 'end' },
  ];
  const [sy, sm] = cycle.starts_on.split('-').map(Number) as [number, number];
  const [ey, em] = cycle.ends_on.split('-').map(Number) as [number, number];
  const windowLabel = `Declarations open (${ordinal(rules.window_open_day)}–${ordinal(rules.window_close_day)})`;
  let y = sy;
  let m = sm;
  while (y < ey || (y === ey && m <= em)) {
    events.push({ date: iso(y, m, rules.window_open_day), label: windowLabel, kind: 'window' });
    events.push({ date: iso(y, m, rules.window_close_day + 1), label: 'Loans sent out', kind: 'loans' });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return events
    .filter((e) => e.date >= today && e.date >= cycle.starts_on && e.date <= cycle.ends_on)
    .sort((a, b) => a.date.localeCompare(b.date) || ORDER[a.kind] - ORDER[b.kind])
    .slice(0, limit);
}

export function pickCurrentCycle<T extends { status: string; starts_on: string; ends_on: string }>(cycles: T[], today: string): T | null {
  const byStart = [...cycles].sort((a, b) => a.starts_on.localeCompare(b.starts_on));
  return (
    byStart.find((c) => c.status === 'active') ??
    byStart.find((c) => c.status === 'planned' && c.ends_on >= today) ??
    byStart[byStart.length - 1] ??
    null
  );
}
```

`src/lib/rulesText.ts`:
```ts
import { zmw } from './format';

type Multiple = { from_month: number; to_month: number; multiple: number };
type Tenor = { max: number | null; months: number };

const money = (v: number) => zmw(v, Number.isInteger(v) ? 0 : 2);
const isArray = (v: unknown): v is unknown[] => Array.isArray(v);

export function loanLimitLines(json: unknown): string[] {
  if (!isArray(json)) return [];
  return (json as Multiple[]).map(({ from_month, to_month, multiple }) => {
    const months = from_month === to_month ? `Month ${from_month}` : `Months ${from_month}–${to_month}`;
    return multiple > 0 ? `${months}: up to ${multiple}× your savings` : `${months}: no new loans`;
  });
}

export function tenorLines(json: unknown): string[] {
  if (!isArray(json)) return [];
  let previous: number | null = null;
  return (json as Tenor[]).map(({ max, months }) => {
    const period = `${months} month${months === 1 ? '' : 's'}`;
    const range =
      max === null ? `Over ${money(previous ?? 0)}` : previous === null ? `Up to ${money(max)}` : `${money(previous)} to ${money(max)}`;
    previous = max ?? previous;
    return `${range}: ${period}`;
  });
}
```

- [ ] **Step 4: Implement data hooks and screens**

`src/features/cycles/useCycles.ts`:
```ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/lib/database.types';

export type CycleWithRules = Tables<'cycles'> & { rules: Tables<'cycle_rules'> | null };

export function useCycles(groupId: string) {
  return useQuery({
    queryKey: ['cycles', groupId],
    queryFn: async (): Promise<CycleWithRules[]> => {
      const { data, error } = await supabase.from('cycles').select('*, cycle_rules(*)').eq('group_id', groupId).order('starts_on');
      if (error) throw error;
      return data.map(({ cycle_rules, ...c }) => ({
        ...c,
        rules: (Array.isArray(cycle_rules) ? cycle_rules[0] : cycle_rules) ?? null,
      })) as CycleWithRules[];
    },
  });
}
```

`src/features/home/UpcomingList.tsx`:
```tsx
import { formatDate } from '@/lib/format';
import type { DateEvent } from '@/lib/calendar';

export function UpcomingList({ events }: { events: DateEvent[] }) {
  if (events.length === 0) return <p className="text-base text-muted">No more dates in this cycle.</p>;
  return (
    <ul className="divide-y divide-line">
      {events.map((e) => (
        <li key={`${e.date}-${e.kind}`} className="flex items-baseline justify-between gap-4 py-3">
          <span className="text-base text-fg">{e.label}</span>
          <span className="tabular shrink-0 text-sm font-semibold text-muted">{formatDate(e.date)}</span>
        </li>
      ))}
    </ul>
  );
}
```

`src/features/home/HomePage.tsx`:
```tsx
import { CalendarClock } from 'lucide-react';
import { useGroup } from '@/features/group/GroupContext';
import { useCycles } from '@/features/cycles/useCycles';
import { pickCurrentCycle, upcomingDates } from '@/lib/calendar';
import { friendlyError } from '@/lib/errors';
import { formatDate, localISODate, zmw } from '@/lib/format';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, PageHeader, Skeleton, type Tone } from '@/ui';
import { UpcomingList } from './UpcomingList';

const STATUS: Record<string, { tone: Tone; label: string }> = {
  planned: { tone: 'info', label: 'Starts soon' },
  active: { tone: 'success', label: 'Running' },
  closed: { tone: 'neutral', label: 'Closed' },
};

export function HomePage() {
  const { group, member } = useGroup();
  const cycles = useCycles(group.id);
  const today = localISODate(new Date());
  const cycle = cycles.data ? pickCurrentCycle(cycles.data, today) : null;
  const status = cycle ? STATUS[cycle.status] ?? STATUS.planned! : null;

  return (
    <>
      <PageHeader title={member ? `Hello, ${member.short_name}` : group.name} subtitle={group.name} />
      {cycles.isPending ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
        </div>
      ) : cycles.isError ? (
        <Alert tone="danger" action={<Button size="sm" variant="secondary" onClick={() => void cycles.refetch()}>Try again</Button>}>
          {friendlyError(cycles.error)}
        </Alert>
      ) : !cycle || !status ? (
        <EmptyState icon={<CalendarClock className="size-7" />} title="No savings cycle yet">
          Your treasurer hasn’t set up a cycle.
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader
              title={cycle.label}
              subtitle={`${formatDate(cycle.starts_on)} – ${formatDate(cycle.ends_on)}`}
              action={<Badge tone={status.tone}>{status.label}</Badge>}
            />
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-muted">Payout</dt>
                <dd className="tabular text-lg font-semibold text-fg">{formatDate(cycle.payout_on)}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Minimum saving</dt>
                <dd className="tabular text-lg font-semibold text-fg">{cycle.rules ? `${zmw(cycle.rules.min_saving, 0)} a month` : '—'}</dd>
              </div>
            </dl>
          </Card>
          <Card>
            <CardHeader title="Coming up" />
            {cycle.rules ? <UpcomingList events={upcomingDates(cycle, cycle.rules, today, 5)} /> : null}
          </Card>
        </div>
      )}
    </>
  );
}
```

`src/features/group/GroupPage.tsx`:
```tsx
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { PullToRefresh } from '@/app/PullToRefresh';
import { friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { Alert, Avatar, Badge, Button, Card, IconButton, PageHeader, Skeleton } from '@/ui';
import { useGroup } from './GroupContext';

export function useGroupMembers(groupId: string) {
  return useQuery({
    queryKey: ['group-members', groupId],
    queryFn: async () => {
      const { data, error } = await supabase.from('group_members').select('*').eq('group_id', groupId).order('full_name');
      if (error) throw error;
      return data;
    },
  });
}

export function GroupPage() {
  const { group } = useGroup();
  const members = useGroupMembers(group.id);
  const active = members.data?.filter((m) => m.status === 'active') ?? [];

  return (
    <PullToRefresh onRefresh={() => members.refetch()}>
      <PageHeader
        title="Group"
        subtitle={members.data ? `${active.length} active members` : group.name}
        actions={<IconButton label="Refresh" icon={<RefreshCw className="size-5" />} onClick={() => void members.refetch()} />}
      />
      <p className="mb-4 rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted">
        {group.figures_visibility === 'open'
          ? 'Everyone in the group can see each member’s figures.'
          : 'Members see only their own figures. Group totals are shared with everyone.'}
      </p>
      {members.isPending ? (
        <div className="grid gap-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : members.isError ? (
        <Alert tone="danger" action={<Button size="sm" variant="secondary" onClick={() => void members.refetch()}>Try again</Button>}>
          {friendlyError(members.error)}
        </Alert>
      ) : (
        <Card className="p-0 md:p-0">
          <ul className="divide-y divide-line">
            {members.data.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={m.full_name ?? ''} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-medium text-fg">{m.full_name}</p>
                  {m.full_name !== m.short_name ? <p className="text-sm text-muted">{m.short_name}</p> : null}
                </div>
                <div className="flex flex-wrap justify-end gap-1">
                  {m.role === 'admin' ? <Badge tone="accent">Admin</Badge> : null}
                  {m.status === 'left' ? <Badge>Left</Badge> : !m.linked ? <Badge tone="warning">Not joined</Badge> : null}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </PullToRefresh>
  );
}
```

`src/features/rules/RulesPage.tsx`:
```tsx
import { useGroup } from '@/features/group/GroupContext';
import { useCycles } from '@/features/cycles/useCycles';
import { UpcomingList } from '@/features/home/UpcomingList';
import { ordinal, pickCurrentCycle, upcomingDates } from '@/lib/calendar';
import { friendlyError } from '@/lib/errors';
import { localISODate, pct, zmw } from '@/lib/format';
import { loanLimitLines, tenorLines } from '@/lib/rulesText';
import { Alert, Card, CardHeader, PageHeader, Skeleton } from '@/ui';

export function RulesPage() {
  const { group } = useGroup();
  const cycles = useCycles(group.id);
  const today = localISODate(new Date());
  const cycle = cycles.data ? pickCurrentCycle(cycles.data, today) : null;
  const r = cycle?.rules;

  if (cycles.isPending) return <Skeleton className="h-96" />;
  if (cycles.isError) return <Alert tone="danger">{friendlyError(cycles.error)}</Alert>;
  if (!cycle || !r) return <Alert tone="info">No rules have been set for a cycle yet.</Alert>;

  const rows: [string, string][] = [
    ['Minimum saving', `${zmw(r.min_saving, 0)} a month`],
    ['Declaration window', `${ordinal(r.window_open_day)}–${ordinal(r.window_close_day)} of each month`],
    ['Loan interest', `${pct(r.loan_rate, 0)}, charged once`],
    ['Excess interest', `${pct(r.excess_rate, 0)} a month on idle cash`],
    ['Late penalty', `${zmw(r.penalty_per_day, 0)} per day after the ${ordinal(r.window_close_day)}`],
    ['Membership fee', `${zmw(r.membership_fee, 0)} a quarter`],
  ];

  return (
    <>
      <PageHeader title="Rules" subtitle={`${cycle.label} · from the group constitution`} />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader title="Saving and declaring" />
          <dl className="divide-y divide-line">
            {rows.map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-4 py-3">
                <dt className="text-base text-muted">{k}</dt>
                <dd className="tabular text-right text-base font-semibold text-fg">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card>
          <CardHeader title="Borrowing" />
          <h3 className="mb-1 text-sm font-semibold text-muted">How much you can borrow</h3>
          <ul className="mb-4 grid gap-1 text-base text-fg">{loanLimitLines(r.loan_multiples).map((l) => <li key={l}>{l}</li>)}</ul>
          <h3 className="mb-1 text-sm font-semibold text-muted">How long you have to repay</h3>
          <ul className="grid gap-1 text-base text-fg">{tenorLines(r.tenor_bands).map((l) => <li key={l}>{l}</li>)}</ul>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader title="Key dates" />
          <UpcomingList events={upcomingDates(cycle, r, today, 6)} />
        </Card>
      </div>
    </>
  );
}
```

`src/features/desk/DeskPage.tsx`:
```tsx
import { ClipboardCheck } from 'lucide-react';
import { useGroup } from '@/features/group/GroupContext';
import { NotFound } from '@/features/shells/NotFound';
import { EmptyState, PageHeader } from '@/ui';

export function DeskPage() {
  const { isAdmin } = useGroup();
  if (!isAdmin) return <NotFound title="This page is for admins" body="Ask your treasurer if you think you should have access." />;
  return (
    <>
      <PageHeader title="Treasurer desk" />
      <EmptyState icon={<ClipboardCheck className="size-7" />} title="The treasurer desk arrives with the ledger">
        Approvals, loans and month close appear here once the February 2027 cycle opens.
      </EmptyState>
    </>
  );
}
```

In `src/app/router.tsx`, replace the four placeholder elements:
```tsx
import { DeskPage } from '@/features/desk/DeskPage';
import { GroupPage } from '@/features/group/GroupPage';
import { HomePage } from '@/features/home/HomePage';
import { RulesPage } from '@/features/rules/RulesPage';
// …
              { index: true, element: <HomePage />, handle: { title: 'Home' } },
              page('group', 'Group', <GroupPage />),
              page('desk', 'Desk', <DeskPage />),
              page('rules', 'Rules', <RulesPage />),
```

- [ ] **Step 5: Run tests and view the screens**

Run: `bun run test && bun run typecheck && bun run lint && bun run check:tokens`
Expected: all pass (calendar 4, rulesText 3, desk 2 added).

In the browser as `member@pvb.test`: Home shows "Hello, Tafara", Cycle 2027 "Starts soon", payout 5 Feb 2028, coming-up dates starting 15 Feb 2027. Group lists 18 members with Nsama and Thompson as Admin and unlinked members "Not joined". Rules lists the six rules, loan limits and repayment periods. `/desk` says "This page is for admins". Toggle dark mode from More → every screen stays readable.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add home, group, rules and desk screens with cycle calendar"
```

---
### Task 15: Gear settings drawer

**Files:**
- Create: `src/features/settings/SettingsSheet.tsx`, `src/features/settings/Section.tsx`, `src/features/settings/useAction.ts`, `src/features/settings/GroupDetailsSection.tsx`, `src/features/settings/VisibilitySection.tsx`, `src/features/settings/useAdminMembers.ts`, `src/features/settings/PeopleSection.tsx`, `src/features/settings/rulesForm.ts`, `src/features/settings/RulesSection.tsx`
- Modify: `src/app/AppShell.tsx` (mount `SettingsSheet`)
- Test: `src/features/settings/useAdminMembers.test.ts`, `src/features/settings/rulesForm.test.ts`, `src/features/settings/VisibilitySection.test.tsx`, `src/features/settings/RulesSection.test.tsx`

**Interfaces:**
- Consumes: `useGroup`, `useCycles`, `pickCurrentCycle`, `expectRows`, `invokeInvite`, `friendlyError`, `haptic`, UI primitives including `useConfirmTap`, `Sheet`, `useToast`.
- Produces: `SettingsSheet` (opens when `?settings=open` and the viewer is an admin); `type InviteStatus = 'linked'|'pending'|'expired'|'revoked'|'none'`; `inviteStatus(member, now): { status: InviteStatus; invite: InviteLite | null }`; `useAdminMembers(groupId)` (key `['admin-members', groupId]`); `type RulesFormValues`; `toFormValues(cycle): RulesFormValues`; `validateRules(values): Partial<Record<keyof RulesFormValues, string>>`; `RulesForm({ cycle, locked })`.

- [ ] **Step 1: Write the failing tests**

`src/features/settings/useAdminMembers.test.ts`:
```ts
import { expect, test } from 'vitest';
import { inviteStatus } from './useAdminMembers';

const now = new Date('2026-10-08T12:00:00Z');
const inv = (over: Partial<{ created_at: string; expires_at: string; accepted_at: string | null; revoked_at: string | null }>) => ({
  id: 'i', email: 'a@b.co', created_at: '2026-10-01T00:00:00Z', expires_at: '2026-10-15T00:00:00Z', accepted_at: null, revoked_at: null, ...over,
});

test('linked account wins', () => expect(inviteStatus({ user_id: 'u', invites: [] }, now).status).toBe('linked'));
test('no invite yet', () => expect(inviteStatus({ user_id: null, invites: [] }, now).status).toBe('none'));
test('pending', () => expect(inviteStatus({ user_id: null, invites: [inv({})] }, now).status).toBe('pending'));
test('expired', () => expect(inviteStatus({ user_id: null, invites: [inv({ expires_at: '2026-10-08T11:59:00Z' })] }, now).status).toBe('expired'));
test('revoked', () => expect(inviteStatus({ user_id: null, invites: [inv({ revoked_at: '2026-10-02T00:00:00Z' })] }, now).status).toBe('revoked'));
test('latest invite decides', () => {
  const old = inv({ created_at: '2026-09-01T00:00:00Z', revoked_at: '2026-09-02T00:00:00Z' });
  const fresh = inv({ created_at: '2026-10-05T00:00:00Z' });
  expect(inviteStatus({ user_id: null, invites: [fresh, old] }, now)).toEqual({ status: 'pending', invite: fresh });
});
```

`src/features/settings/rulesForm.test.ts`:
```ts
import { expect, test } from 'vitest';
import { toFormValues, validateRules, type RulesFormValues } from './rulesForm';

const valid: RulesFormValues = {
  label: 'Cycle 2027', starts_on: '2027-02-15', ends_on: '2028-02-15', payout_on: '2028-02-05',
  min_saving: '250', membership_fee: '50', penalty_per_day: '50', loan_rate_pct: '15', excess_rate_pct: '10',
  window_open_day: '5', window_close_day: '7',
};

test('accepts the constitution values', () => expect(validateRules(valid)).toEqual({}));
test('payout must fall inside the cycle', () => expect(validateRules({ ...valid, payout_on: '2028-03-01' }).payout_on).toBeDefined());
test('cycle must end after it starts', () => expect(validateRules({ ...valid, ends_on: '2027-02-01' }).ends_on).toBeDefined());
test('window must close on or after it opens', () => expect(validateRules({ ...valid, window_close_day: '4' }).window_close_day).toBeDefined());
test('amounts cannot be negative or blank', () => {
  expect(validateRules({ ...valid, min_saving: '-1' }).min_saving).toBeDefined();
  expect(validateRules({ ...valid, membership_fee: '' }).membership_fee).toBeDefined();
});
test('percentages stay between 0 and 100', () => expect(validateRules({ ...valid, loan_rate_pct: '150' }).loan_rate_pct).toBeDefined());

test('toFormValues turns rates into clean percentages', () => {
  const v = toFormValues({
    label: 'Cycle 2027', starts_on: '2027-02-15', ends_on: '2028-02-15', payout_on: '2028-02-05',
    rules: { min_saving: 250, membership_fee: 50, penalty_per_day: 50, loan_rate: 0.15, excess_rate: 0.1, window_open_day: 5, window_close_day: 7 },
  });
  expect(v.loan_rate_pct).toBe('15');
  expect(v.excess_rate_pct).toBe('10');
});
```

`src/features/settings/VisibilitySection.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, test, vi } from 'vitest';
import { GroupProvider } from '@/features/group/GroupContext';
import { ToastProvider } from '@/ui';

const select = vi.fn().mockResolvedValue({ data: [{ id: 'g1' }], error: null });
const eq = vi.fn(() => ({ select }));
const update = vi.fn(() => ({ eq }));
vi.mock('@/lib/supabase', () => ({ supabase: { from: () => ({ update }) } }));
const { VisibilitySection } = await import('./VisibilitySection');

test('switching to private needs a second tap', async () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ToastProvider>
        <GroupProvider value={{ group: { id: 'g1', name: 'Premium', currency: 'ZMW', owner_user_id: 'o', figures_visibility: 'open' }, member: null, isAdmin: true }}>
          <VisibilitySection />
        </GroupProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
  await userEvent.click(screen.getByLabelText(/Only the member and admins/));
  await userEvent.click(screen.getByRole('button', { name: 'Make figures private' }));
  expect(update).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to confirm' }));
  expect(update).toHaveBeenCalledWith({ figures_visibility: 'private' });
});
```

`src/features/settings/RulesSection.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, test, vi } from 'vitest';
import { ToastProvider } from '@/ui';

vi.mock('@/lib/supabase', () => ({ supabase: { from: vi.fn() } }));
const { RulesForm } = await import('./RulesSection');

const cycle = {
  id: 'c1', label: 'Cycle 2026', starts_on: '2026-02-15', ends_on: '2027-02-15', payout_on: '2027-02-06', status: 'active',
  rules: { min_saving: 250, membership_fee: 50, penalty_per_day: 50, loan_rate: 0.15, excess_rate: 0.1, window_open_day: 5, window_close_day: 7, loan_multiples: [], tenor_bands: [] },
};

const renderForm = (locked: boolean) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ToastProvider>
        <RulesForm cycle={cycle as never} locked={locked} />
      </ToastProvider>
    </QueryClientProvider>,
  );

test('locked rules are read-only with no save button', () => {
  renderForm(true);
  expect(screen.getByLabelText('Minimum saving (K)')).toBeDisabled();
  expect(screen.queryByRole('button', { name: 'Save cycle and rules' })).toBeNull();
});

test('planned rules are editable', () => {
  renderForm(false);
  expect(screen.getByLabelText('Minimum saving (K)')).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Save cycle and rules' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun run test src/features/settings`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the shared pieces**

`src/features/settings/Section.tsx`:
```tsx
import type { ReactNode } from 'react';

export function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="grid gap-3">
      <div>
        <h3 className="text-lg font-semibold text-fg">{title}</h3>
        {description ? <p className="text-sm text-muted">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
```

`src/features/settings/useAction.ts`:
```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useGroup } from '@/features/group/GroupContext';
import { friendlyError } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { useToast } from '@/ui';

/** A settings write: on success refresh everything that shows members or the group, buzz, and confirm. */
export function useAction<T>(fn: (arg: T) => Promise<unknown>, success: string | ((arg: T) => string)) {
  const qc = useQueryClient();
  const toast = useToast();
  const { group } = useGroup();
  return useMutation({
    mutationFn: fn,
    onSuccess: async (_data, arg) => {
      haptic();
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['admin-members', group.id] }),
        qc.invalidateQueries({ queryKey: ['group-members', group.id] }),
        qc.invalidateQueries({ queryKey: ['cycles', group.id] }),
        qc.invalidateQueries({ queryKey: ['membership'] }),
      ]);
      toast(typeof success === 'function' ? success(arg) : success, { tone: 'success' });
    },
    onError: (err) => toast(friendlyError(err), { tone: 'danger' }),
  });
}
```

`src/features/settings/useAdminMembers.ts`:
```ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/lib/database.types';

export type InviteLite = Pick<Tables<'invites'>, 'id' | 'email' | 'expires_at' | 'accepted_at' | 'revoked_at' | 'created_at'>;
export type AdminMember = Tables<'members'> & { invites: InviteLite[] };
export type InviteStatus = 'linked' | 'pending' | 'expired' | 'revoked' | 'none';

export function inviteStatus(m: { user_id: string | null; invites: InviteLite[] }, now: Date): { status: InviteStatus; invite: InviteLite | null } {
  if (m.user_id) return { status: 'linked', invite: null };
  const latest = [...m.invites].sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
  if (!latest) return { status: 'none', invite: null };
  if (latest.accepted_at) return { status: 'linked', invite: latest };
  if (latest.revoked_at) return { status: 'revoked', invite: latest };
  if (new Date(latest.expires_at) <= now) return { status: 'expired', invite: latest };
  return { status: 'pending', invite: latest };
}

export function useAdminMembers(groupId: string) {
  return useQuery({
    queryKey: ['admin-members', groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('members')
        .select('*, invites(id, email, expires_at, accepted_at, revoked_at, created_at)')
        .eq('group_id', groupId)
        .order('full_name');
      if (error) throw error;
      return data as unknown as AdminMember[];
    },
  });
}
```

`src/features/settings/rulesForm.ts`:
```ts
export type RulesFormValues = {
  label: string;
  starts_on: string;
  ends_on: string;
  payout_on: string;
  min_saving: string;
  membership_fee: string;
  penalty_per_day: string;
  loan_rate_pct: string;
  excess_rate_pct: string;
  window_open_day: string;
  window_close_day: string;
};

type CycleInput = {
  label: string;
  starts_on: string;
  ends_on: string;
  payout_on: string;
  rules: { min_saving: number; membership_fee: number; penalty_per_day: number; loan_rate: number; excess_rate: number; window_open_day: number; window_close_day: number };
};

const asPct = (rate: number) => String(Math.round(rate * 10000) / 100);

export function toFormValues(c: CycleInput): RulesFormValues {
  return {
    label: c.label,
    starts_on: c.starts_on,
    ends_on: c.ends_on,
    payout_on: c.payout_on,
    min_saving: String(c.rules.min_saving),
    membership_fee: String(c.rules.membership_fee),
    penalty_per_day: String(c.rules.penalty_per_day),
    loan_rate_pct: asPct(c.rules.loan_rate),
    excess_rate_pct: asPct(c.rules.excess_rate),
    window_open_day: String(c.rules.window_open_day),
    window_close_day: String(c.rules.window_close_day),
  };
}

const num = (v: string) => (v.trim() === '' ? Number.NaN : Number(v));

export function validateRules(f: RulesFormValues): Partial<Record<keyof RulesFormValues, string>> {
  const e: Partial<Record<keyof RulesFormValues, string>> = {};
  if (!f.label.trim()) e.label = 'Enter a name for the cycle.';
  if (!f.starts_on) e.starts_on = 'Choose a start date.';
  if (!f.ends_on || f.ends_on <= f.starts_on) e.ends_on = 'The cycle must end after it starts.';
  if (!f.payout_on || f.payout_on > f.ends_on) e.payout_on = 'Payout must be on or before the end date.';
  for (const k of ['min_saving', 'membership_fee', 'penalty_per_day'] as const) {
    if (!(num(f[k]) >= 0)) e[k] = 'Enter an amount of 0 or more.';
  }
  for (const k of ['loan_rate_pct', 'excess_rate_pct'] as const) {
    const v = num(f[k]);
    if (!(v >= 0 && v <= 100)) e[k] = 'Enter a percentage between 0 and 100.';
  }
  const open = num(f.window_open_day);
  const close = num(f.window_close_day);
  if (!(Number.isInteger(open) && open >= 1 && open <= 28)) e.window_open_day = 'Use a day between 1 and 28.';
  if (!(Number.isInteger(close) && close >= 1 && close <= 28)) e.window_close_day = 'Use a day between 1 and 28.';
  else if (close < open) e.window_close_day = 'The window must close on or after it opens.';
  return e;
}
```

- [ ] **Step 4: Implement the sections**

`src/features/settings/GroupDetailsSection.tsx`:
```tsx
import { useState } from 'react';
import { useGroup } from '@/features/group/GroupContext';
import { expectRows } from '@/lib/mutate';
import { supabase } from '@/lib/supabase';
import { Button, TextField } from '@/ui';
import { Section } from './Section';
import { useAction } from './useAction';

export function GroupDetailsSection() {
  const { group } = useGroup();
  const [name, setName] = useState(group.name);
  const save = useAction(async (value: string) => {
    expectRows(await supabase.from('groups').update({ name: value }).eq('id', group.id).select('id'));
  }, 'Group name saved');
  const trimmed = name.trim();

  return (
    <Section title="Group">
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (trimmed) save.mutate(trimmed);
        }}
      >
        <TextField label="Group name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} error={!trimmed ? 'Enter a group name.' : undefined} />
        <Button type="submit" isLoading={save.isPending} disabled={!trimmed || trimmed === group.name}>
          Save name
        </Button>
      </form>
    </Section>
  );
}
```

`src/features/settings/VisibilitySection.tsx`:
```tsx
import { useState } from 'react';
import { useGroup } from '@/features/group/GroupContext';
import { expectRows } from '@/lib/mutate';
import { supabase } from '@/lib/supabase';
import { Button, cn, useConfirmTap } from '@/ui';
import { Section } from './Section';
import { useAction } from './useAction';

const OPTIONS = [
  { value: 'open', title: 'Everyone in the group', body: 'Members can see each other’s savings and loans, as the group does today.' },
  { value: 'private', title: 'Only the member and admins', body: 'Members see their own figures and group totals. Admins see everything.' },
] as const;

export function VisibilitySection() {
  const { group } = useGroup();
  const [choice, setChoice] = useState(group.figures_visibility);
  const save = useAction(
    async (value: string) => {
      expectRows(await supabase.from('groups').update({ figures_visibility: value }).eq('id', group.id).select('id'));
    },
    (value) => (value === 'private' ? 'Figures are now private' : 'Figures are now visible to everyone'),
  );
  const confirm = useConfirmTap(() => save.mutate(choice));
  const changed = choice !== group.figures_visibility;

  return (
    <Section title="Who can see member figures" description="Applies to savings, loans and statements once the ledger is live.">
      <fieldset className="grid gap-2">
        <legend className="sr-only">Who can see member figures</legend>
        {OPTIONS.map((o) => (
          <label
            key={o.value}
            className={cn('flex cursor-pointer gap-3 rounded-xl border p-3.5 transition', choice === o.value ? 'border-accent bg-accent-soft' : 'border-line bg-surface')}
          >
            <input type="radio" name="figures" value={o.value} checked={choice === o.value} onChange={() => { setChoice(o.value); confirm.reset(); }} className="mt-1 size-4 accent-current" />
            <span>
              <span className="block text-base font-semibold text-fg">{o.title}</span>
              <span className="block text-sm text-muted">{o.body}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {changed ? (
        <Button fullWidth variant={confirm.armed ? 'danger' : 'primary'} isLoading={save.isPending} onClick={confirm.tap}>
          {confirm.armed ? 'Tap again to confirm' : choice === 'private' ? 'Make figures private' : 'Make figures visible to everyone'}
        </Button>
      ) : null}
    </Section>
  );
}
```

`src/features/settings/PeopleSection.tsx`:
```tsx
import { useState, type FormEvent } from 'react';
import { useGroup } from '@/features/group/GroupContext';
import { formatDate } from '@/lib/format';
import { invokeInvite } from '@/lib/functions';
import { expectRows } from '@/lib/mutate';
import { friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { Alert, Badge, Button, Skeleton, TextField, useConfirmTap, type Tone } from '@/ui';
import { Section } from './Section';
import { useAction } from './useAction';
import { inviteStatus, useAdminMembers, type AdminMember, type InviteStatus } from './useAdminMembers';

const INVITE_BADGE: Record<InviteStatus, { tone: Tone; label: string } | null> = {
  linked: { tone: 'success', label: 'Joined' },
  pending: { tone: 'warning', label: 'Invite sent' },
  expired: { tone: 'danger', label: 'Invite expired' },
  revoked: { tone: 'neutral', label: 'Invite cancelled' },
  none: { tone: 'neutral', label: 'Not invited' },
};

function AddMember({ groupId }: { groupId: string }) {
  const [fullName, setFullName] = useState('');
  const [shortName, setShortName] = useState('');
  const add = useAction(async () => {
    expectRows(
      await supabase.from('members').insert({ group_id: groupId, full_name: fullName.trim(), short_name: shortName.trim() || fullName.trim().split(/\s+/)[0]! }).select('id'),
    );
  }, 'Member added');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;
    add.mutate(undefined, { onSuccess: () => { setFullName(''); setShortName(''); } });
  };

  return (
    <details className="rounded-xl border border-line">
      <summary className="flex h-12 cursor-pointer items-center px-4 text-base font-semibold text-accent">Add a member</summary>
      <form className="grid gap-3 px-4 pb-4" onSubmit={submit}>
        <TextField label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="off" />
        <TextField label="Short name" hint="Shown in lists. Defaults to the first name." value={shortName} onChange={(e) => setShortName(e.target.value)} autoComplete="off" />
        <Button type="submit" isLoading={add.isPending} disabled={!fullName.trim()}>Add member</Button>
      </form>
    </details>
  );
}

function MemberRow({ member }: { member: AdminMember }) {
  const [form, setForm] = useState({ full_name: member.full_name, short_name: member.short_name, email: member.email ?? '', phone: member.phone ?? '' });
  const { status, invite } = inviteStatus(member, new Date());
  const badge = INVITE_BADGE[status];
  const isAdmin = member.role === 'admin';
  const active = member.status === 'active';

  const saveDetails = useAction(async () => {
    expectRows(
      await supabase
        .from('members')
        .update({ full_name: form.full_name.trim(), short_name: form.short_name.trim(), email: form.email.trim() || null, phone: form.phone.trim() || null })
        .eq('id', member.id)
        .select('id'),
    );
  }, 'Details saved');
  const setAdmin = useAction(async (make: boolean) => {
    const { error } = await supabase.rpc('set_admin', { p_member_id: member.id, p_make_admin: make });
    if (error) throw error;
  }, (make) => (make ? `${member.short_name} is now an admin` : `${member.short_name} is no longer an admin`));
  const setStatus = useAction(async (next: 'active' | 'left') => {
    expectRows(await supabase.from('members').update({ status: next }).eq('id', member.id).select('id'));
  }, (next) => (next === 'left' ? `${member.short_name} marked as left` : `${member.short_name} is active again`));
  const sendInvite = useAction(() => invokeInvite(member.id, form.email.trim()), `Invite sent to ${form.email.trim()}`);
  const revoke = useAction(async (inviteId: string) => {
    expectRows(await supabase.from('invites').update({ revoked_at: new Date().toISOString() }).eq('id', inviteId).select('id'));
  }, 'Invite cancelled');

  const demote = useConfirmTap(() => setAdmin.mutate(false));
  const leave = useConfirmTap(() => setStatus.mutate('left'));
  const cancel = useConfirmTap(() => invite && revoke.mutate(invite.id));
  const field = (k: keyof typeof form) => ({ value: form[k], onChange: (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value })) });

  return (
    <details className="rounded-xl border border-line bg-surface">
      <summary className="flex min-h-14 cursor-pointer items-center gap-3 px-4 py-2">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-medium text-fg">{member.full_name}</span>
          {invite && status === 'pending' ? <span className="block text-xs text-muted">Expires {formatDate(invite.expires_at)}</span> : null}
        </span>
        <span className="flex flex-wrap justify-end gap-1">
          {isAdmin ? <Badge tone="accent">Admin</Badge> : null}
          {!active ? <Badge>Left</Badge> : badge ? <Badge tone={badge.tone}>{badge.label}</Badge> : null}
        </span>
      </summary>
      <div className="grid gap-3 border-t border-line p-4">
        <TextField label="Full name" {...field('full_name')} />
        <TextField label="Short name" {...field('short_name')} />
        <TextField label="Email" type="email" inputMode="email" {...field('email')} hint="Invites go to this address." />
        <TextField label="Phone" type="tel" inputMode="tel" {...field('phone')} />
        <Button variant="secondary" isLoading={saveDetails.isPending} onClick={() => saveDetails.mutate(undefined)}>Save details</Button>

        {status !== 'linked' && active ? (
          <div className="grid gap-2 rounded-xl bg-surface-2 p-3">
            <Button isLoading={sendInvite.isPending} disabled={!form.email.trim()} onClick={() => sendInvite.mutate(undefined)}>
              {status === 'none' ? 'Send invite' : 'Send a new invite'}
            </Button>
            {status === 'pending' ? (
              <Button variant={cancel.armed ? 'danger' : 'ghost'} isLoading={revoke.isPending} onClick={cancel.tap}>
                {cancel.armed ? 'Tap again to cancel the invite' : 'Cancel invite'}
              </Button>
            ) : null}
            {!form.email.trim() ? <p className="text-sm text-muted">Add an email address to send an invite.</p> : null}
          </div>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-2">
          {isAdmin ? (
            <Button variant={demote.armed ? 'danger' : 'secondary'} isLoading={setAdmin.isPending} onClick={demote.tap}>
              {demote.armed ? 'Tap again to remove admin' : 'Remove admin'}
            </Button>
          ) : active ? (
            <Button variant="secondary" isLoading={setAdmin.isPending} onClick={() => setAdmin.mutate(true)}>Make admin</Button>
          ) : null}
          {active ? (
            <Button variant={leave.armed ? 'danger' : 'ghost'} isLoading={setStatus.isPending} onClick={leave.tap}>
              {leave.armed ? 'Tap again to mark as left' : 'Mark as left'}
            </Button>
          ) : (
            <Button variant="ghost" isLoading={setStatus.isPending} onClick={() => setStatus.mutate('active')}>Mark as active again</Button>
          )}
        </div>
      </div>
    </details>
  );
}

export function PeopleSection() {
  const { group } = useGroup();
  const members = useAdminMembers(group.id);
  return (
    <Section title="Members and admins" description="Add members, send invites and choose who can manage the group.">
      <AddMember groupId={group.id} />
      {members.isPending ? (
        <Skeleton className="h-48" />
      ) : members.isError ? (
        <Alert tone="danger" action={<Button size="sm" variant="secondary" onClick={() => void members.refetch()}>Try again</Button>}>
          {friendlyError(members.error)}
        </Alert>
      ) : (
        <ul className="grid gap-2">
          {members.data.map((m) => (
            // Key changes whenever server data changes, so the row's form state resets after a save.
            <li key={`${m.id}:${m.full_name}:${m.short_name}:${m.email ?? ''}:${m.phone ?? ''}:${m.role}:${m.status}`}>
              <MemberRow member={m} />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
```

`src/features/settings/RulesSection.tsx`:
```tsx
import { useState } from 'react';
import { useGroup } from '@/features/group/GroupContext';
import { useCycles, type CycleWithRules } from '@/features/cycles/useCycles';
import { pickCurrentCycle } from '@/lib/calendar';
import { friendlyError } from '@/lib/errors';
import { localISODate } from '@/lib/format';
import { expectRows } from '@/lib/mutate';
import { loanLimitLines, tenorLines } from '@/lib/rulesText';
import { supabase } from '@/lib/supabase';
import { Alert, Button, Skeleton, TextField } from '@/ui';
import { toFormValues, validateRules, type RulesFormValues } from './rulesForm';
import { Section } from './Section';
import { useAction } from './useAction';

type Field = { key: keyof RulesFormValues; label: string; type?: string; inputMode?: 'decimal' | 'numeric' };
const FIELDS: Field[] = [
  { key: 'label', label: 'Cycle name' },
  { key: 'starts_on', label: 'Starts on', type: 'date' },
  { key: 'ends_on', label: 'Ends on', type: 'date' },
  { key: 'payout_on', label: 'Payout day', type: 'date' },
  { key: 'min_saving', label: 'Minimum saving (K)', inputMode: 'decimal' },
  { key: 'membership_fee', label: 'Membership fee per quarter (K)', inputMode: 'decimal' },
  { key: 'penalty_per_day', label: 'Late penalty per day (K)', inputMode: 'decimal' },
  { key: 'loan_rate_pct', label: 'Loan interest (%)', inputMode: 'decimal' },
  { key: 'excess_rate_pct', label: 'Excess interest per month (%)', inputMode: 'decimal' },
  { key: 'window_open_day', label: 'Declarations open on day', inputMode: 'numeric' },
  { key: 'window_close_day', label: 'Declarations close on day', inputMode: 'numeric' },
];

export function RulesForm({ cycle, locked }: { cycle: CycleWithRules & { rules: NonNullable<CycleWithRules['rules']> }; locked: boolean }) {
  const [values, setValues] = useState(() => toFormValues(cycle));
  const [showErrors, setShowErrors] = useState(false);
  const errors = validateRules(values);
  const save = useAction(async () => {
    expectRows(
      await supabase.from('cycles').update({ label: values.label.trim(), starts_on: values.starts_on, ends_on: values.ends_on, payout_on: values.payout_on }).eq('id', cycle.id).select('id'),
      'rules_locked',
    );
    expectRows(
      await supabase
        .from('cycle_rules')
        .update({
          min_saving: Number(values.min_saving),
          membership_fee: Number(values.membership_fee),
          penalty_per_day: Number(values.penalty_per_day),
          loan_rate: Number(values.loan_rate_pct) / 100,
          excess_rate: Number(values.excess_rate_pct) / 100,
          window_open_day: Number(values.window_open_day),
          window_close_day: Number(values.window_close_day),
        })
        .eq('cycle_id', cycle.id)
        .select('cycle_id'),
      'rules_locked',
    );
  }, 'Cycle and rules saved');

  return (
    <form
      className="grid gap-3"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setShowErrors(true);
        if (Object.keys(errors).length === 0) save.mutate(undefined);
      }}
    >
      <fieldset disabled={locked} className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <TextField
            key={f.key}
            label={f.label}
            type={f.type ?? 'text'}
            inputMode={f.inputMode}
            className={f.key === 'label' ? 'sm:col-span-2' : undefined}
            value={values[f.key]}
            onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            error={showErrors ? errors[f.key] : undefined}
          />
        ))}
      </fieldset>
      <div className="rounded-xl bg-surface-2 p-3 text-sm text-muted">
        <p className="mb-1 font-semibold text-fg">Loan limits and repayment periods (from the constitution)</p>
        <ul className="grid gap-0.5">
          {[...loanLimitLines(cycle.rules.loan_multiples), ...tenorLines(cycle.rules.tenor_bands)].map((l) => <li key={l}>{l}</li>)}
        </ul>
      </div>
      {!locked ? (
        <Button type="submit" isLoading={save.isPending}>Save cycle and rules</Button>
      ) : null}
    </form>
  );
}

export function RulesSection() {
  const { group } = useGroup();
  const cycles = useCycles(group.id);
  if (cycles.isPending) return <Skeleton className="h-64" />;
  if (cycles.isError) return <Alert tone="danger">{friendlyError(cycles.error)}</Alert>;
  const planned = cycles.data.find((c) => c.status === 'planned');
  const shown = planned ?? pickCurrentCycle(cycles.data, localISODate(new Date()));
  if (!shown?.rules) return <Alert tone="info">No cycle has been set up yet.</Alert>;
  const locked = shown.status !== 'planned';
  return (
    <Section title="Cycle and rules" description="Editable until the cycle starts. After that the rules are locked for everyone.">
      {locked ? <Alert tone="info">{shown.label} has started, so its rules are locked.</Alert> : null}
      <RulesForm key={shown.id} cycle={shown as CycleWithRules & { rules: NonNullable<CycleWithRules['rules']> }} locked={locked} />
    </Section>
  );
}
```

`src/features/settings/SettingsSheet.tsx`:
```tsx
import { useSearchParams } from 'react-router';
import { useGroup } from '@/features/group/GroupContext';
import { Sheet } from '@/ui';
import { GroupDetailsSection } from './GroupDetailsSection';
import { PeopleSection } from './PeopleSection';
import { RulesSection } from './RulesSection';
import { VisibilitySection } from './VisibilitySection';

export function SettingsSheet() {
  const { isAdmin, group } = useGroup();
  const [params, setParams] = useSearchParams();
  const open = isAdmin && params.get('settings') === 'open';
  const close = () => {
    const next = new URLSearchParams(params);
    next.delete('settings');
    setParams(next, { replace: true });
  };
  return (
    <Sheet open={open} onClose={close} title="Group settings" description={group.name}>
      <div className="grid gap-8">
        <GroupDetailsSection />
        <VisibilitySection />
        <PeopleSection />
        <RulesSection />
      </div>
    </Sheet>
  );
}
```

In `src/app/AppShell.tsx`, import and render it after `MoreSheet`:
```tsx
import { SettingsSheet } from '@/features/settings/SettingsSheet';
// …
      <SettingsSheet />
```

- [ ] **Step 5: Run tests**

Run: `bun run test && bun run typecheck && bun run lint && bun run check:tokens`
Expected: all pass (invite status 6, rules form 7, visibility 1, rules section 2 added).

- [ ] **Step 6: Exercise every action against the local stack**

With `supabase functions serve invite-member --env-file supabase/functions/.env` running, sign in as `admin@pvb.test` and open the gear:
1. Rename the group, then rename it back → toast "Group name saved".
2. Choose "Only the member and admins" → "Make figures private" → "Tap again to confirm" → toast; Group page notice changes. Switch back.
3. Add member "Test Person"; open Charles, set email `charles@example.com`, "Send invite" → toast; badge "Invite sent"; email arrives at http://127.0.0.1:54324. "Cancel invite" twice → "Invite cancelled".
4. Make Tafara admin → badge; "Remove admin" twice → back to member.
5. Remove admin from Thompson, then try to remove admin from Nsama → red toast "The group needs at least one admin…". Restore Thompson.
6. Change minimum saving to 300 → "Cycle and rules saved"; Rules page shows K 300; change back to 250.
7. In Studio (http://127.0.0.1:54323 → SQL editor) run `update cycles set status = 'active'`, reopen settings → "Cycle 2027 has started, so its rules are locked", fields disabled. Set it back with `update cycles set status = 'planned'`.
8. Sign in as `member@pvb.test`, visit `/?settings=open` → no drawer.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add gear settings for group name, figure visibility, members, invites, admins and rules"
```

---

### Task 16: Account page

**Files:**
- Create: `src/features/account/AccountPage.tsx`, `src/features/account/password.ts`
- Modify: `src/app/router.tsx`
- Test: `src/features/account/password.test.ts`

**Interfaces:**
- Consumes: `useSession`, `useGroup`, `supabase.auth.getUserIdentities|linkIdentity|updateUser`, `signOutEverywhere`, `ThemeChoice`, `friendlyError`.
- Produces: `checkPassword(password: string, confirm: string): string | null`; route `/account` (with `?reset=1` showing a "set a new password" prompt).

- [ ] **Step 1: Write the failing test**

`src/features/account/password.test.ts`:
```ts
import { expect, test } from 'vitest';
import { checkPassword } from './password';

test('needs 8 characters', () => expect(checkPassword('short', 'short')).toBe('Use at least 8 characters.'));
test('needs a matching confirmation', () => expect(checkPassword('longenough', 'longenougH')).toBe('The passwords don’t match.'));
test('accepts a good password', () => expect(checkPassword('longenough', 'longenough')).toBeNull());
```

- [ ] **Step 2: Run to verify failure**

Run: `bun run test src/features/account`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/features/account/password.ts`:
```ts
export function checkPassword(password: string, confirm: string): string | null {
  if (password.length < 8) return 'Use at least 8 characters.';
  if (password !== confirm) return 'The passwords don’t match.';
  return null;
}
```

`src/features/account/AccountPage.tsx`:
```tsx
import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';
import { ThemeChoice } from '@/app/ThemeChoice';
import { useSession } from '@/features/auth/SessionProvider';
import { signOutEverywhere } from '@/features/auth/signOut';
import { useGroup } from '@/features/group/GroupContext';
import { friendlyError } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { supabase } from '@/lib/supabase';
import { Alert, Badge, Button, Card, CardHeader, PageHeader, TextField, useToast } from '@/ui';
import { checkPassword } from './password';

export function AccountPage() {
  const { session } = useSession();
  const { member, group } = useGroup();
  const qc = useQueryClient();
  const toast = useToast();
  const [params] = useSearchParams();
  const resetting = params.get('reset') === '1';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const identities = useQuery({
    queryKey: ['identities', session?.user.id],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUserIdentities();
      if (error) throw error;
      return data.identities;
    },
  });
  const providers = new Set(identities.data?.map((i) => i.provider) ?? []);

  const linkGoogle = async () => {
    const { error } = await supabase.auth.linkIdentity({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent('/account')}` },
    });
    if (error) toast(friendlyError(error), { tone: 'danger' });
  };

  const savePassword = async (e: FormEvent) => {
    e.preventDefault();
    const issue = checkPassword(password, confirm);
    setProblem(issue);
    if (issue) return;
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) return setProblem(friendlyError(error));
    haptic();
    setPassword('');
    setConfirm('');
    toast('Password saved. You can now sign in with it.', { tone: 'success' });
  };

  return (
    <>
      <PageHeader title="Account" subtitle={group.name} />
      {resetting ? <div className="mb-4"><Alert tone="info">Choose a new password below.</Alert></div> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader title="You" />
          <dl className="grid gap-3">
            <div>
              <dt className="text-sm text-muted">Name</dt>
              <dd className="text-base font-semibold text-fg">{member?.full_name ?? 'Group owner'}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Email</dt>
              <dd className="break-all text-base text-fg">{session?.user.email}</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <CardHeader title="Ways to sign in" />
          <ul className="grid gap-2">
            <li className="flex items-center justify-between gap-3">
              <span className="text-base text-fg">Email link</span>
              <Badge tone="success">On</Badge>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-base text-fg">Google</span>
              {providers.has('google') ? <Badge tone="success">Linked</Badge> : <Button size="sm" variant="secondary" onClick={linkGoogle}>Link Google</Button>}
            </li>
          </ul>
        </Card>

        <Card>
          <CardHeader title={resetting ? 'Set a new password' : 'Password'} subtitle="Optional. Lets you sign in without waiting for an email." />
          <form className="grid gap-3" onSubmit={savePassword} noValidate>
            <TextField label="New password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <TextField label="Confirm password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            {problem ? <Alert tone="danger">{problem}</Alert> : null}
            <Button type="submit" isLoading={saving}>Save password</Button>
          </form>
        </Card>

        <Card>
          <CardHeader title="Appearance" />
          <ThemeChoice />
        </Card>
      </div>
      <Button className="mt-6" variant="secondary" fullWidth leftIcon={<LogOut className="size-5" />} onClick={() => signOutEverywhere(qc)}>
        Sign out
      </Button>
    </>
  );
}
```

In `src/app/router.tsx`:
```tsx
import { AccountPage } from '@/features/account/AccountPage';
// …
              page('account', 'Account', <AccountPage />),
```

- [ ] **Step 4: Run tests and try it**

Run: `bun run test && bun run typecheck && bun run lint`
Expected: all pass (password 3 added).

Locally as `member@pvb.test`: set a new password `newpassword1` → toast; sign out; sign in with it. "Forgot password?" on `/sign-in` → email → link opens `/account?reset=1` with the prompt. (Google linking needs the production Google client; verify it in Task 20.)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add account page with password, Google linking, theme and sign-out"
```

---

### Task 17: Installable PWA

**Files:**
- Create: `public/favicon.svg`, `pwa-assets.config.ts`, generated icons in `public/`, `src/features/pwa/UpdatePrompt.tsx`, `src/features/pwa/InstallHint.tsx`, `src/test/pwaRegisterStub.ts`
- Modify: `vite.config.ts`, `tsconfig.json`, `index.html`, `src/app/AppShell.tsx`
- Test: `src/features/pwa/InstallHint.test.ts`

**Interfaces:**
- Produces: web manifest (`name` "Premium Village Bank", `short_name` "Premium VB", standalone, portrait, icons 192/512/maskable); service worker precaching the app shell with an update prompt; `shouldShowInstallHint({ standalone, dismissed, canPrompt, isIOS }): boolean`; `HINT_KEY = 'pvb-install-hint-dismissed'`.

- [ ] **Step 1: Write the failing test**

`src/features/pwa/InstallHint.test.ts`:
```ts
import { expect, test } from 'vitest';
import { shouldShowInstallHint } from './InstallHint';

const base = { standalone: false, dismissed: false, canPrompt: false, isIOS: false };

test('shows when Android can prompt', () => expect(shouldShowInstallHint({ ...base, canPrompt: true })).toBe(true));
test('shows instructions on iOS', () => expect(shouldShowInstallHint({ ...base, isIOS: true })).toBe(true));
test('hidden once installed', () => expect(shouldShowInstallHint({ ...base, canPrompt: true, standalone: true })).toBe(false));
test('hidden once dismissed', () => expect(shouldShowInstallHint({ ...base, isIOS: true, dismissed: true })).toBe(false));
test('hidden on desktop browsers that cannot install', () => expect(shouldShowInstallHint(base)).toBe(false));
```

- [ ] **Step 2: Run to verify failure**

Run: `bun run test src/features/pwa`
Expected: FAIL — module not found.

- [ ] **Step 3: Add the icon and generate PNGs**

`public/favicon.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#4F46E5"/><path d="M176 368V144h96c48 0 80 30 80 72s-32 72-80 72h-48v80" fill="none" stroke="#FFFFFF" stroke-width="44" stroke-linejoin="round" stroke-linecap="round"/></svg>
```

`pwa-assets.config.ts`:
```ts
import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

export default defineConfig({ preset: minimal2023Preset, images: ['public/favicon.svg'] });
```

Run: `bun x pwa-assets-generator`
Expected: `public/` gains `favicon.ico`, `pwa-64x64.png`, `pwa-192x192.png`, `pwa-512x512.png`, `maskable-icon-512x512.png`, `apple-touch-icon-180x180.png`.

Add `pwa-assets.config.ts` to `tsconfig.json` `include`.

- [ ] **Step 4: Configure the plugin**

`vite.config.ts` (replace):
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png', 'theme-init.js'],
      manifest: {
        name: 'Premium Village Bank',
        short_name: 'Premium VB',
        description: 'Savings, declarations and loans for Premium Village Banking.',
        theme_color: '#4F46E5',
        background_color: '#F1F5F9',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 3000 },
  test: {
    environment: 'jsdom',
    environmentOptions: { jsdom: { url: 'http://localhost:3000/' } },
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.mjs'],
    env: { VITE_SUPABASE_URL: 'http://localhost:54321', VITE_SUPABASE_ANON_KEY: 'test-anon-key' },
    alias: { 'virtual:pwa-register/react': fileURLToPath(new URL('./src/test/pwaRegisterStub.ts', import.meta.url)) },
  },
});
```

In `tsconfig.json` set `"types": ["vite/client", "node", "vite-plugin-pwa/react"]`.

`src/test/pwaRegisterStub.ts`:
```ts
export function useRegisterSW() {
  return {
    needRefresh: [false, () => {}] as [boolean, (v: boolean) => void],
    offlineReady: [false, () => {}] as [boolean, (v: boolean) => void],
    updateServiceWorker: async () => {},
  };
}
```

In `index.html` `<head>`, add:
```html
    <link rel="icon" href="/favicon.ico" sizes="48x48" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/apple-touch-icon-180x180.png" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
```

- [ ] **Step 5: Implement the prompts**

`src/features/pwa/UpdatePrompt.tsx`:
```tsx
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
```

`src/features/pwa/InstallHint.tsx`:
```tsx
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
```

In `src/app/AppShell.tsx`: render `<InstallHint />` as the first child of `<main>` (before `<Outlet />`) and `<UpdatePrompt />` next to `<SettingsSheet />`:
```tsx
import { InstallHint } from '@/features/pwa/InstallHint';
import { UpdatePrompt } from '@/features/pwa/UpdatePrompt';
```

- [ ] **Step 6: Run tests and a production build**

Run: `bun run test && bun run typecheck && bun run lint && VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_ANON_KEY=x bun run build`
Expected: tests pass (install hint 5 added); `dist/manifest.webmanifest` and `dist/sw.js` exist.

`bun run preview` → open http://localhost:4173 in Chrome → DevTools › Application › Manifest shows no errors and the install icon appears in the address bar.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: make the app an installable PWA with update prompt and install hint"
```

---

### Task 18: Vercel config, CI and operations workflows

**Files:**
- Create: `vercel.json`, `.github/workflows/ci.yml`, `.github/workflows/e2e.yml`, `.github/workflows/db-deploy.yml`, `.github/workflows/keepalive.yml`, `.github/workflows/backup.yml`, `docs/ops/restore.md`
- Modify: `vite.config.ts` (`preview.headers` mirrors production CSP)

**Interfaces:**
- Produces: production headers; CI jobs `web`, `db`, `edge`; preview smoke `e2e`; gated `db-deploy`; weekly `keepalive`; nightly encrypted `backup`. GitHub secrets used (configured in Task 20): `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`, `SUPABASE_DB_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `AGE_RECIPIENT`, `E2E_MEMBER_EMAIL`, `E2E_MEMBER_PASSWORD`, `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, `VERCEL_AUTOMATION_BYPASS_SECRET`.

- [ ] **Step 1: Write `vercel.json`**

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "installCommand": "bun install --frozen-lockfile",
  "buildCommand": "bun run build",
  "outputDirectory": "dist",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://lh3.googleusercontent.com; font-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co; manifest-src 'self'; worker-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'"
        },
        { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }
      ]
    },
    { "source": "/assets/(.*)", "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }] },
    { "source": "/sw.js", "headers": [{ "key": "Cache-Control", "value": "no-cache" }] }
  ]
}
```

- [ ] **Step 2: Mirror the CSP in `vite preview` so violations show up locally**

At the top of `vite.config.ts`:
```ts
import { readFileSync } from 'node:fs';

const vercel = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8')) as {
  headers: { source: string; headers: { key: string; value: string }[] }[];
};
const csp = vercel.headers[0]!.headers.find((h) => h.key === 'Content-Security-Policy')!.value;
```

Inside `defineConfig({ … })` add:
```ts
  preview: {
    headers: {
      'Content-Security-Policy': csp.replace("connect-src 'self'", "connect-src 'self' http://127.0.0.1:54321 ws://127.0.0.1:54321"),
    },
  },
```

Verify: `bun run build && bun run preview`, sign in at http://localhost:4173 with the local stack running. Expected: the app works and the browser console shows no `Content-Security-Policy` violations.

- [ ] **Step 3: CI workflow**

`.github/workflows/ci.yml`:
```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.4.0
      - run: bun install --frozen-lockfile
      - run: bun run typecheck
      - run: bun run lint
      - run: bun run check:tokens
      - run: bun run test
      - run: bun run build
        env:
          VITE_SUPABASE_URL: http://127.0.0.1:54321
          VITE_SUPABASE_ANON_KEY: ci-placeholder

  db:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
        with:
          version: latest
      - run: supabase db start
      - run: supabase test db

  edge:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: denoland/setup-deno@v2
        with:
          deno-version: v2.x
      - run: deno test --allow-env supabase/functions/invite-member/lib.test.ts
```

- [ ] **Step 4: Preview smoke tests**

`.github/workflows/e2e.yml`:
```yaml
name: E2E on preview
on: deployment_status

jobs:
  smoke:
    if: github.event.deployment_status.state == 'success'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.4.0
      - run: bun install --frozen-lockfile
      - run: bun x playwright install --with-deps chromium
      - run: bun run e2e
        env:
          CI: 'true'
          BASE_URL: ${{ github.event.deployment_status.environment_url }}
          VERCEL_AUTOMATION_BYPASS_SECRET: ${{ secrets.VERCEL_AUTOMATION_BYPASS_SECRET }}
          E2E_MEMBER_EMAIL: ${{ secrets.E2E_MEMBER_EMAIL }}
          E2E_MEMBER_PASSWORD: ${{ secrets.E2E_MEMBER_PASSWORD }}
          E2E_ADMIN_EMAIL: ${{ secrets.E2E_ADMIN_EMAIL }}
          E2E_ADMIN_PASSWORD: ${{ secrets.E2E_ADMIN_PASSWORD }}
      - if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report
          retention-days: 14
```

- [ ] **Step 5: Gated database and function deploy**

`.github/workflows/db-deploy.yml`:
```yaml
name: Deploy database and functions
on:
  push:
    branches: [main]
    paths: ['supabase/migrations/**', 'supabase/functions/**']
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production   # requires approval from a reviewer configured in repo settings
    env:
      SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
      SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
        with:
          version: latest
      - run: supabase link --project-ref "${{ secrets.SUPABASE_PROJECT_REF }}"
      - run: supabase db push
      - run: supabase functions deploy invite-member --project-ref "${{ secrets.SUPABASE_PROJECT_REF }}"
```

- [ ] **Step 6: Keep-alive and backups**

`.github/workflows/keepalive.yml`:
```yaml
name: Keep Supabase awake
on:
  schedule:
    - cron: '17 6 * * 1'   # Mondays 06:17 UTC; free projects pause after 7 idle days
  workflow_dispatch:

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl --fail --silent --show-error \
            "${{ secrets.SUPABASE_URL }}/rest/v1/rpc/invite_preview" \
            -H "apikey: ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{"p_token":"keepalive"}'
```

`.github/workflows/backup.yml`:
```yaml
name: Nightly encrypted backup
on:
  schedule:
    - cron: '23 1 * * *'
  workflow_dispatch:

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: supabase/setup-cli@v1
        with:
          version: latest
      - run: sudo apt-get update && sudo apt-get install -y age
      - name: Dump roles, schema and data
        env:
          DB_URL: ${{ secrets.SUPABASE_DB_URL }}
        run: |
          mkdir backup
          supabase db dump --db-url "$DB_URL" -f backup/roles.sql --role-only
          supabase db dump --db-url "$DB_URL" -f backup/schema.sql
          supabase db dump --db-url "$DB_URL" -f backup/data.sql --use-copy --data-only
          tar czf backup.tar.gz backup
      - name: Encrypt
        run: age -r "${{ secrets.AGE_RECIPIENT }}" -o "pvb-$(date -u +%F).tar.gz.age" backup.tar.gz
      - uses: actions/upload-artifact@v4
        with:
          name: pvb-backup-${{ github.run_id }}
          path: pvb-*.tar.gz.age
          retention-days: 90
```

- [ ] **Step 7: Restore runbook**

`docs/ops/restore.md`:
```markdown
# Restoring a backup

Backups are produced nightly by `.github/workflows/backup.yml` and kept for 90 days as GitHub Actions artifacts.
Each is a tarball of `roles.sql`, `schema.sql` and `data.sql`, encrypted with `age` to the public key in the
`AGE_RECIPIENT` secret. The matching private key (`pvb-backup.key`) is kept offline by the owner and the treasurer.

## Restore into a local stack (test this once before go-live)

1. Download the artifact from GitHub → Actions → "Nightly encrypted backup" → a run → Artifacts.
2. Decrypt and unpack:

       age -d -i pvb-backup.key -o backup.tar.gz pvb-YYYY-MM-DD.tar.gz.age
       tar xzf backup.tar.gz

3. Start an empty local database and load the dump:

       bun x supabase start
       psql --single-transaction --variable ON_ERROR_STOP=1 \
         --file backup/roles.sql --file backup/schema.sql \
         --command 'SET session_replication_role = replica' \
         --file backup/data.sql \
         --dbname 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

   If `schema.sql` collides with the local migrations, run `bun x supabase db reset --no-seed` first and drop
   `public` objects, or restore into a fresh Supabase project instead (below).

4. Check: `psql … -c "select count(*) from public.members"` matches production.

## Restore into production

1. Create a new Supabase project (or pause and reset the existing one).
2. Run step 3 with `--dbname` set to the new project's **session pooler** connection string.
3. Re-run `supabase db push` (no-op if the schema matches), redeploy the `invite-member` function and its secrets,
   and point Vercel's `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` at the new project.
4. Members keep their accounts because `auth.users` is part of the dump.
```

- [ ] **Step 8: Lint the workflows**

Run: `docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:latest -color && node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8'))" && echo ok`
Expected: no actionlint findings; `ok`.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "ci: add Vercel headers, CI, preview smoke, gated db deploy, keep-alive and encrypted backups"
```

---

### Task 19: Playwright smoke tests

**Files:**
- Create: `playwright.config.ts`, `e2e/smoke.spec.ts`, `e2e/roles.spec.ts`

**Interfaces:**
- Consumes: local seed accounts (Task 8) when `BASE_URL` is unset; `E2E_*` secrets and `VERCEL_AUTOMATION_BYPASS_SECRET` on previews.
- Produces: projects `phone` (390×844, touch) and `desktop` (1280×900).

- [ ] **Step 1: Write the config**

`playwright.config.ts`:
```ts
import { defineConfig } from '@playwright/test';

const baseURL = process.env.BASE_URL ?? 'http://localhost:3000';
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    extraHTTPHeaders: bypass ? { 'x-vercel-protection-bypass': bypass, 'x-vercel-set-bypass-cookie': 'true' } : undefined,
  },
  projects: [
    { name: 'phone', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 } },
    { name: 'desktop', use: { viewport: { width: 1280, height: 900 } } },
  ],
  webServer: process.env.BASE_URL ? undefined : { command: 'bun run dev', url: baseURL, reuseExistingServer: true, timeout: 60_000 },
});
```

- [ ] **Step 2: Write the signed-out smoke tests**

`e2e/smoke.spec.ts`:
```ts
import { expect, test } from '@playwright/test';

test('sign-in page offers all three methods', async ({ page }) => {
  await page.goto('/sign-in');
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Email me a sign-in link' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Use a password instead' })).toBeVisible();
});

test('protected pages send you to sign in and back', async ({ page }) => {
  await page.goto('/passbook');
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fpassbook$/);
});

test('an unknown invite explains itself', async ({ page }) => {
  await page.goto('/invite/not-a-real-token');
  await expect(page.getByText('This invite link isn’t valid. Ask your treasurer for a new one.')).toBeVisible();
});

for (const path of ['/sign-in', '/invite/not-a-real-token']) {
  test(`no horizontal scroll at 360px on ${path}`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
```

- [ ] **Step 3: Write the role tests**

`e2e/roles.spec.ts`:
```ts
import { expect, test, type Page } from '@playwright/test';

const local = !process.env.BASE_URL;
const member = { email: process.env.E2E_MEMBER_EMAIL ?? (local ? 'member@pvb.test' : ''), password: process.env.E2E_MEMBER_PASSWORD ?? (local ? 'password123' : '') };
const admin = { email: process.env.E2E_ADMIN_EMAIL ?? (local ? 'admin@pvb.test' : ''), password: process.env.E2E_ADMIN_PASSWORD ?? (local ? 'password123' : '') };

async function signIn(page: Page, who: { email: string; password: string }) {
  await page.goto('/sign-in');
  await page.getByRole('button', { name: 'Use a password instead' }).click();
  await page.getByLabel('Email').fill(who.email);
  await page.getByLabel('Password').fill(who.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/$/);
}

const navName = (project: string) => (project === 'phone' ? 'Main' : 'Sections');

test.describe('roles', () => {
  test.skip(!member.email || !admin.email, 'E2E credentials are not set');

  test('a member sees Plan but not Desk, and cannot open the desk', async ({ page }, info) => {
    await signIn(page, member);
    const nav = page.getByRole('navigation', { name: navName(info.project.name) });
    await expect(nav.getByRole('link', { name: 'Plan' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Desk' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Group settings' })).toHaveCount(0);
    await page.goto('/desk');
    await expect(page.getByText('This page is for admins')).toBeVisible();
  });

  test('an admin sees Desk and can open group settings', async ({ page }, info) => {
    await signIn(page, admin);
    const nav = page.getByRole('navigation', { name: navName(info.project.name) });
    await expect(nav.getByRole('link', { name: 'Desk' })).toBeVisible();
    await page.getByRole('button', { name: 'Group settings' }).first().click();
    await expect(page.getByRole('dialog', { name: 'Group settings' })).toBeVisible();
  });

  test('no horizontal scroll at 360px when signed in', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await signIn(page, member);
    for (const path of ['/', '/group', '/rules', '/account']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });
});
```

- [ ] **Step 4: Run against the local stack**

Run: `bun x playwright install chromium && bun run db:start && bun run e2e`
Expected: 16 passed (8 tests × 2 projects).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test: add Playwright smoke and role tests for phone and desktop"
```

---

### Task 20: Production setup and go-live verification

**Files:**
- Create: `docs/ops/setup.md`

**Interfaces:**
- Consumes: everything above. Produces: a live production deploy and the evidence for spec §11.

- [ ] **Step 1: Write the setup guide**

`docs/ops/setup.md`:
```markdown
# Production setup

Do these once, in order. Values in CAPITALS are yours to fill in; keep them in a password manager.

## 1. Supabase project (free tier)

1. supabase.com → New project → name `premium-village-bank`, region closest to Lusaka (e.g. `eu-central-1`
   or `af-south-1` if offered), strong DB password → save it as `SUPABASE_DB_PASSWORD`.
2. Note the project ref (`SUPABASE_PROJECT_REF`), URL (`SUPABASE_URL`) and anon key (`SUPABASE_ANON_KEY`)
   from Project Settings → API. Create a personal access token (`SUPABASE_ACCESS_TOKEN`) under Account → Access Tokens.
3. Copy the **session pooler** connection string from Connect → it becomes `SUPABASE_DB_URL`.
4. From the repo:

       bun x supabase link --project-ref SUPABASE_PROJECT_REF
       bun x supabase db push
       bun x supabase secrets set SITE_URL=https://PROD_DOMAIN
       bun x supabase functions deploy invite-member

## 2. Auth settings (Dashboard → Authentication)

- Sign In / Providers → Email: enabled; **Allow new users to sign up: off**; Confirm email: on.
- Providers → Google: enabled with a Google Cloud OAuth client (Web application). Authorised redirect URI:
  `https://SUPABASE_PROJECT_REF.supabase.co/auth/v1/callback`. Authorised JavaScript origin: `https://PROD_DOMAIN`.
- Allow manual linking: **on** (Account page “Link Google”).
- URL Configuration → Site URL `https://PROD_DOMAIN`; Redirect URLs `https://PROD_DOMAIN/**` and
  `https://*-VERCEL_TEAM_SLUG.vercel.app/**`.
- SMTP (Project Settings → Auth → SMTP): Resend. Host `smtp.resend.com`, port `465`, user `resend`,
  password = a Resend API key, sender `Premium Village Bank <no-reply@VERIFIED_DOMAIN>` (verify the domain in Resend first).

## 3. Owner account and the group

1. Authentication → Users → Add user → Create new user → OWNER_EMAIL with a strong password, “Auto confirm” on.
2. SQL editor:

       select private.bootstrap_premium_vb((select id from auth.users where email = 'OWNER_EMAIL'));

   (Pass a second argument if the owner is not Thompson, e.g. `, 'Charles'`.)
3. Playwright accounts: create three more users the same way (`E2E_OWNER_EMAIL`, `E2E_ADMIN_EMAIL`,
   `E2E_MEMBER_EMAIL`, all with passwords), then:

       select private.bootstrap_test_group('E2E_OWNER_EMAIL', 'E2E_ADMIN_EMAIL', 'E2E_MEMBER_EMAIL');

   These accounts only ever see “Playwright Test Group”.

## 4. Vercel

1. Import the GitHub repo. Framework preset: Vite (vercel.json already sets bun, build and output).
2. Environment variables (Production and Preview): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
3. Domains → add PROD_DOMAIN. Production branch: `main`.
4. Deployment Protection → Protection Bypass for Automation → generate → save as `VERCEL_AUTOMATION_BYPASS_SECRET`.

## 5. GitHub

1. Settings → Environments → `production` → Required reviewers: the owner (and the treasurer).
2. Settings → Secrets and variables → Actions: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`,
   `SUPABASE_DB_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `AGE_RECIPIENT`, `E2E_MEMBER_EMAIL`, `E2E_MEMBER_PASSWORD`,
   `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, `VERCEL_AUTOMATION_BYPASS_SECRET`.
3. Backup key: `age-keygen -o pvb-backup.key`; put the printed public key (`age1…`) in `AGE_RECIPIENT`; keep
   `pvb-backup.key` offline in two places (owner and treasurer). Without it backups cannot be read.
4. Run “Keep Supabase awake” and “Nightly encrypted backup” once by hand (Actions → Run workflow).
```

- [ ] **Step 2: Do the setup**

Follow `docs/ops/setup.md` sections 1–5. Merge `feat/foundation` into `main` through a pull request so CI, the preview deploy and the preview smoke tests run; approve the `production` environment for the database deploy.

- [ ] **Step 3: Verify spec §11 on production**

1. **Invited member, three sign-in methods (criterion 1):** as the owner open the gear → invite a real member's email. On an Android phone and an iPhone: accept via the email link → "Welcome, NAME". Sign out; sign in with an emailed link; sign out; on Account set a password; sign out; sign in with the password; link Google and sign in with Google. Each lands on Home as the right member.
2. **Roles (criterion 2):** owner promotes that member to admin → on their phone Desk appears in the bottom nav and the gear in the top bar. A plain member sees neither. Then, with a member's access token (DevTools › Application › Local Storage › `sb-…-auth-token` → `access_token`):

       curl -s "$SUPABASE_URL/rest/v1/rpc/set_admin" -H "apikey: $SUPABASE_ANON_KEY" -H "Authorization: Bearer MEMBER_ACCESS_TOKEN" \
         -H 'Content-Type: application/json' -d '{"p_member_id":"ANY_MEMBER_ID","p_make_admin":true}'

   Expected: `{"code":"42501",…"message":"not_admin"}`. A PATCH to `cycle_rules` with the same token returns `[]` and changes nothing.
3. **RLS suite (criterion 3):** CI's `db` job is green on the merge commit.
4. **Phone quality (criterion 4):**

       bun x lighthouse https://PROD_DOMAIN/sign-in --only-categories=performance,accessibility,best-practices \
         --form-factor=mobile --screenEmulation.mobile --quiet --chrome-flags="--headless=new" --output=json \
         | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const c=JSON.parse(s).categories;for(const k in c)console.log(k,Math.round(c[k].score*100))})'

   Expected: performance ≥ 90, accessibility ≥ 90. Chrome on Android shows "Install app"; iOS Safari "Add to Home Screen" opens standalone. The preview smoke job's 360px checks are green.
5. **Operations (criterion 5):** production deploy green; "Keep Supabase awake" and "Nightly encrypted backup" each have a successful run; follow `docs/ops/restore.md` "Restore into a local stack" with last night's artifact and confirm the member count matches.

- [ ] **Step 4: Record the result and commit**

Append to `docs/ops/setup.md`:
```markdown
## Go-live record

| Check | Date | Who | Result |
|---|---|---|---|
| Three sign-in methods on Android and iPhone | | | |
| Admin promotion and member refusal | | | |
| RLS suite green on main | | | |
| Lighthouse mobile perf / a11y | | | |
| Keep-alive and backup runs | | | |
| Restore test | | | |
```

Fill in the rows, then:
```bash
git add docs/ops/setup.md
git commit -m "docs: add production setup guide and go-live record"
```
