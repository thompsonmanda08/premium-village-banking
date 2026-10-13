# Excel exports (E1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a treasurer or admin download three Excel files built from the ledger: one month (like the old monthly workbooks), the whole period with cumulative figures and a one-row-per-member standpoint sheet (the open month included as a labelled preview), and one member's own report.

**Architecture:** No migration. Plain async loaders read the ledger on a button press (paged, narrow selects, never cached) and return typed bundles; pure builders turn a bundle into an `.xlsx` with ExcelJS, which is loaded lazily as its own chunk and kept out of the service-worker precache. A `/desk/reports` page, a Desk card and a button on each member's page run an export through one shared runner (one export at a time, friendly errors, a browser download). Every figure is the engine's own; the client adds only column totals and one fee calculation that is pinned to the engine by a pgTAP test.

**Tech Stack:** Postgres/pgTAP, React 19, react-router, supabase-js, ExcelJS 4.4 (lazy), Vite 6 + vite-plugin-pwa, Vitest + Testing Library, eslint, `tsc`, Playwright (one throw-away CSP smoke test).

**Spec:** `docs/superpowers/specs/2026-10-12-excel-exports-design.md` (builds on the ledger-engine, member-screens, month-close and corrections specs).

## Global Constraints

- **Shell setup for every command in this plan:** `export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$HOME/.bun/bin:$PATH"` (Node must come before bun's shim or vitest cannot host jsdom).
- **No database change, no migration, never `bun run db:push`.** SQL is verified inside a rolled-back transaction with the runner in the session scratchpad (`run.mjs`, `combine.py`; Task 2 says how to recreate them if missing).
- ExcelJS is imported **only** in `src/features/exports/loadExcel.ts`, and only as a dynamic `import('exceljs')`. Everything else gets the library through `loadExcel()` and takes types from that file.
- Every figure in a file is the engine's (statement, group statement, close preview, payout preview, loans). The only client arithmetic: column totals with `sumKwacha`, the fee fold (Task 3), `standpointOf` (Task 5), and one ratio (interest ÷ savings, `0` when savings are `0`).
- Loaders read on demand: plain async functions, **not** `useQuery`, so nothing is cached or persisted. Every list read goes through `fetchAllRows` (stable order, advances by rows received, stops on an empty page). `members` is read with `id, short_name, full_name, status` only; e-mail, phone and user ids are never selected or written.
- Strings are written as strings (a note beginning `=` stays text). Amounts are numbers with the `"K" #,##0.00` format; a credit stays negative. Dates are real dates.
- The open month is always marked "(preview)", always last, and totals that include it say so. If the engine refuses its preview only because declarations are waiting, the whole-period and member files are still made without it and say so.
- A member's report contains only that member's data: no other member's name, row or figure, no group totals, no e-mail/phone, and not the default's reason.
- Screens: loading (labelled), error with retry, empty states; 48px targets; tokens only; labelled sections; curly apostrophes `’`. Server errors go through `friendlyError`. Non-admins make no requests.
- Tests: synthetic data only (the repo is public). Workbook tests run under `// @vitest-environment node` and read the generated file back with ExcelJS. Find loading text with `getByText` (the toast region has `role="status"`).
- Commits: subject + body, **no `Co-Authored-By` trailer** (the user's global rule overrides any attribution reminder). Never `git push`, never `git add -A`, never stage anything under `docs/` or `semantic-review/`.

## Review Focus

- More than 1,000 rows (a real cycle passes it by month nine) must not be silently truncated, and a server row cap below the page size must not skip rows. (Tasks 3, 7.)
- The open month's preview is refused while declarations are waiting: the whole-period and member files still download, without it, and say so; the month workbook shows the friendly refusal and downloads nothing. (Task 7.)
- A member's file must not contain any other member's data, in the loader's result or in any cell. (Tasks 6, 7.)
- A free-text note beginning `=` (a reason) must stay inert text. (Task 4.)
- A credit (negative owed), a member with no row in the latest month, zero savings (division) and the first month (no previous minimum) must produce blank or zero cells, never `NaN`, `-0` or an error. (Tasks 4, 5, 6.)
- A double press, or pressing another export while one runs, produces one file. (Task 8.)

---

## File structure

| File | Responsibility |
|---|---|
| `supabase/tests/database/20_export_fee_fold.sql` | pgTAP: fee corrections count under the fee's own kind, in the month they land |
| `src/features/exports/loadExcel.ts` | The only importer of `exceljs`; lazy; exports `Excel`, `Workbook`, `Worksheet` types |
| `src/features/exports/types.ts` | `GroupFigures`, `MemberMonth`, `MonthFigures`, `Person`, `MonthExport`, `PeriodExport`, `MemberExport` |
| `src/features/exports/fileName.ts` | `safeFileName`, `xlsxName` |
| `src/features/exports/paging.ts` | `fetchAllRows`, `chunk` |
| `src/features/exports/fees.ts` | `feeFold` |
| `src/features/exports/normalise.ts` | `memberMonth`, `groupFigures` (statement row or preview member → figures only) |
| `src/features/exports/standpoint.ts` | `standpointOf` |
| `src/features/exports/sheetKit.ts` | Shared ExcelJS helpers: `newSheet`, `writeLines`, `writeTable`, `totalsRow`, `dayCell`, `dayText`, `toBytes`, labels |
| `src/features/exports/monthWorkbook.ts` | `buildMonthWorkbook` |
| `src/features/exports/periodWorkbook.ts` | `buildPeriodWorkbook` |
| `src/features/exports/memberWorkbook.ts` | `buildMemberWorkbook` |
| `src/features/exports/loaders.ts` | `loadMonthExport`, `loadPeriodExport`, `loadMemberExport` |
| `src/features/exports/exportActions.ts` | `exportMonth`, `exportPeriod`, `exportMember` (load + build + file name) |
| `src/features/exports/download.ts` | `downloadBytes` |
| `src/features/exports/useExportRunner.ts` | One export at a time, toast, download |
| `src/features/exports/exportFixtures.ts`, `testSupabase.ts` | Test-only fixtures and a fake supabase client |
| `src/features/desk/ReportsPage.tsx` | `/desk/reports` |
| `src/features/desk/MemberReportButton.tsx` | "Download report" on a member's page |
| `package.json`, `bun.lock`, `vite.config.ts`, `eslint.config.js` | exceljs becomes a dependency, own chunk, out of the precache, one lint exception (modified) |
| `src/app/router.tsx`, `src/features/desk/DeskPage.tsx`, `src/features/desk/MemberLedgerPage.tsx` | route, Desk card, member-page button (modified) |

---

### Task 1: ExcelJS as a lazy chunk, and proof it works under the app's CSP

**Files:**
- Modify: `package.json`, `bun.lock`, `vite.config.ts`, `eslint.config.js`
- Create: `src/features/exports/loadExcel.ts`
- Test: `src/features/exports/loadExcel.test.ts`
- Scratch (git-excluded, never committed): `.superpowers/smoke/index.html`, `main.ts`, `vite.config.ts`, `run.mjs`

**Interfaces:**
- Produces: `loadExcel(): Promise<Excel>`; `type Excel = typeof import('exceljs')`; `type Workbook`, `type Worksheet` (re-exported types). Later tasks import these and nothing else from exceljs.

- [ ] **Step 1: Write the failing test**

`src/features/exports/loadExcel.test.ts`:

```ts
// @vitest-environment node
import { expect, test } from 'vitest';
import { loadExcel } from './loadExcel';

test('loadExcel hands back a working ExcelJS: a workbook survives a write and a read', async () => {
  const { Workbook } = await loadExcel();
  const wb = new Workbook();
  wb.addWorksheet('Sheet').addRow(['a', 1]);
  const bytes = new Uint8Array(await wb.xlsx.writeBuffer());
  const back = new Workbook();
  await back.xlsx.load(bytes as unknown as Buffer);
  expect(back.getWorksheet('Sheet')!.getRow(1).values).toEqual([undefined, 'a', 1]);
});
```

Run: `bun run test src/features/exports/loadExcel.test.ts`. Expected: FAIL (cannot find `./loadExcel`).

- [ ] **Step 2: Implement `loadExcel.ts`**

`src/features/exports/loadExcel.ts`:

```ts
export type Excel = typeof import('exceljs');
export type Workbook = import('exceljs').Workbook;
export type Worksheet = import('exceljs').Worksheet;

/**
 * ExcelJS is about 1 MB, so it is fetched only when a download is pressed (its own chunk, left out of the service-worker precache)
 * and this is the only place that imports it.
 */
export async function loadExcel(): Promise<Excel> {
  const mod = (await import('exceljs')) as Excel & { default?: Excel };
  return mod.default ?? mod;
}
```

- [ ] **Step 3: Make exceljs a runtime dependency and allow its one import**

In `package.json`, move `"exceljs": "^4.4.0"` from `devDependencies` to `dependencies` (keep the alphabetical order of both blocks), then:

```bash
export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$HOME/.bun/bin:$PATH"
bun install
```

Expected: the lock file changes only by moving the package between groups.

In `eslint.config.js`, replace the restriction message and add the one exception:

```js
      'no-restricted-imports': ['error', { paths: [{ name: 'exceljs', message: 'Load exceljs only through src/features/exports/loadExcel.ts so it stays a lazy chunk.' }] }],
```

and, as the last element of the `tseslint.config(...)` list (after the block that holds that rule), add:

```js
  // The one place allowed to import it: a dynamic import, so the library stays out of the main bundle.
  { files: ['src/features/exports/loadExcel.ts'], rules: { 'no-restricted-imports': 'off' } },
```

Also change the comment above that block to: `// Workbook parsing is a local script (scripts/ledger-*.mjs); the browser only loads exceljs lazily, through src/features/exports/loadExcel.ts.`

- [ ] **Step 4: Keep the ExcelJS chunk out of the precache**

Do **not** add a `manualChunks` rule: it was tried and it pulls a shared CommonJS helper into the ExcelJS chunk, so the entry page statically imports that chunk and the browser preloads all 940 kB on every visit. The dynamic import alone makes the chunk (`exceljs.min-<hash>.js`). In `vite.config.ts` extend `globIgnores` in the `workbox` block:

```ts
        globIgnores: ['**/inter-{cyrillic,cyrillic-ext,greek,greek-ext,vietnamese,latin-ext}-wght-normal-*.woff2', '**/exceljs*.js'],
```

- [ ] **Step 5: Run the test**

Run: `bun run test src/features/exports/loadExcel.test.ts && bun run lint && bun run typecheck`. Expected: PASS, lint and typecheck clean. (If `Buffer` or the `exceljs` types do not resolve, fix that here: `tsconfig.json` already lists `node` in `types`.)

- [ ] **Step 6: Prove the build output**

The app does not import `loadExcel` yet, so first make the build see it. Create `.superpowers/smoke/index.html`, `main.ts`, `vite.config.ts` and `run.mjs` (they are under `.superpowers/`, which is git-excluded):

`.superpowers/smoke/index.html`:

```html
<!doctype html>
<html><head><meta charset="utf-8"><title>pending</title></head><body><script type="module" src="./main.ts"></script></body></html>
```

`.superpowers/smoke/main.ts`:

```ts
import { loadExcel } from '../../src/features/exports/loadExcel';

const { Workbook } = await loadExcel();
const wb = new Workbook();
wb.addWorksheet('S').addRow(['a', 1]);
const bytes = new Uint8Array(await wb.xlsx.writeBuffer());
const a = document.createElement('a');
a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
a.download = 'smoke.xlsx';
document.body.append(a);
(window as unknown as { smoke: { click: () => void } }).smoke = { click: () => a.click() };
document.title = `ok:${bytes.length}`;
```

`.superpowers/smoke/vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  build: { outDir: 'dist', emptyOutDir: true, target: 'esnext', rollupOptions: { output: { manualChunks: (id: string) => (id.includes('/node_modules/exceljs/') ? 'exceljs' : undefined) } } },
});
```

`.superpowers/smoke/run.mjs`:

```js
// Serves the smoke build with the app's real Content-Security-Policy and drives Chromium: does ExcelJS run, and does a blob download work?
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { chromium } from '@playwright/test';

const root = new URL('./dist/', import.meta.url).pathname;
const vercel = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
const csp = vercel.headers[0].headers.find((h) => h.key === 'Content-Security-Policy').value;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer((req, res) => {
  const path = join(root, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  if (!existsSync(path) || !statSync(path).isFile()) return void res.writeHead(404).end();
  res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream', 'content-security-policy': csp });
  res.end(readFileSync(path));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch();
const page = await browser.newPage({ acceptDownloads: true });
const problems = [];
page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()); });
page.on('pageerror', (e) => problems.push(String(e)));
await page.goto(`http://127.0.0.1:${server.address().port}/`);
await page.waitForFunction(() => document.title.startsWith('ok:'), null, { timeout: 15000 }).catch(() => {});
const title = await page.title();
let downloaded = null;
if (title.startsWith('ok:')) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }).catch(() => null), page.evaluate(() => window.smoke.click())]);
  downloaded = dl ? dl.suggestedFilename() : null;
}
console.log(JSON.stringify({ title, downloaded, problems }));
await browser.close();
server.close();
process.exit(title.startsWith('ok:') && downloaded === 'smoke.xlsx' && problems.length === 0 ? 0 : 1);
```

Build and run it:

```bash
export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$HOME/.bun/bin:$PATH"
bunx vite build --config .superpowers/smoke/vite.config.ts 2>&1 | tail -8
ls .superpowers/smoke/dist/assets | grep exceljs
node .superpowers/smoke/run.mjs
```

Expected: a separate `exceljs-<hash>.js` chunk exists; the last line is `{"title":"ok:…","downloaded":"smoke.xlsx","problems":[]}` and the exit code is 0. **If ExcelJS fails to load or run, or the CSP blocks it or the download, STOP and report to the user with the browser error: do not weaken the CSP.** (A bundling problem, such as a Node-only import in the browser build, is fixed here, for example with a `resolve.alias` to `exceljs/dist/exceljs.min.js`, and the fix is kept.)

- [ ] **Step 7: Prove the app build leaves it out**

The app itself still does not import the loader, so check the configuration with the real build once Task 8 wires the page. For now confirm the build is healthy and the config parses:

```bash
bun run build 2>&1 | tail -6
```

Expected: build succeeds. (Task 9 re-checks the real app bundle and the precache.)

- [ ] **Step 8: Commit**

```bash
git add package.json bun.lock vite.config.ts eslint.config.js src/features/exports/loadExcel.ts src/features/exports/loadExcel.test.ts
git commit -m "build: load ExcelJS lazily as its own chunk

exceljs becomes a runtime dependency, imported only by src/features/exports/loadExcel.ts
through a dynamic import. Its chunk is named, and left out of the service-worker precache,
so a member's phone never downloads it. A throw-away Chromium run under the app's real
Content-Security-Policy confirmed it builds, runs and offers a blob download."
```

---

### Task 2: pgTAP pins the fee fold

**Files:**
- Create: `supabase/tests/database/20_export_fee_fold.sql`

**Interfaces:**
- Produces the numbers Task 3's Vitest scenario reuses: February: a transfer fee of 10 and a membership fee of 30 for Dee; in March the fee is corrected down to 6 (an `adjustment` of 4 that counts as `txn_fee` −4) and the membership up to 35 (a `membership` correction of +5).

- [ ] **Step 1: Write the test (it needs no new SQL, so it should pass at once; it pins existing behaviour)**

`supabase/tests/database/20_export_fee_fold.sql`:

```sql
begin;
select * from no_plan();
select tests.ledger_fixture();

-- February: Dee pays a saving, a membership fee of 30 and a transfer fee of 10; then March is the open month.
select tests.ledger_jump(1);
select tests.ledger_pay('Dee', 1, 250, 0, 30, 10);
select tests.ledger_jump(2);
select tests.remember('fee', (select id from entries where member_id = tests.lm('Dee') and kind = 'txn_fee'));
select tests.remember('mem', (select id from entries where member_id = tests.lm('Dee') and kind = 'membership'));

select tests.login_as(tests.id('admin'));
select lives_ok($$select post_correction(tests.id('fee'), 6, 'Fee was 6')$$, 'the fee is corrected down to 6');
select lives_ok($$select post_correction(tests.id('mem'), 35, 'Membership was 35')$$, 'the membership is corrected up to 35');
reset role;

-- The engine's own view of a line: an adjustment or waiver counts negative under the kind of the entry it points at.
select is((select coalesce(sum(amount), 0) from private.ledger_lines
            where member_id = tests.lm('Dee') and kind = 'txn_fee' and month_index = 1), 10.00, 'February keeps its fee of 10');
select is((select coalesce(sum(amount), 0) from private.ledger_lines
            where member_id = tests.lm('Dee') and kind = 'txn_fee' and month_index = 2), -4.00, 'March carries the reduction as -4 under the fee kind');
select is((select coalesce(sum(amount), 0) from private.ledger_lines
            where member_id = tests.lm('Dee') and kind = 'txn_fee'), 6.00, 'the cycle total of the fee is 6');
select is((select coalesce(sum(amount), 0) from private.ledger_lines
            where member_id = tests.lm('Dee') and kind = 'membership' and month_index = 1), 30.00, 'February keeps its membership of 30');
select is((select coalesce(sum(amount), 0) from private.ledger_lines
            where member_id = tests.lm('Dee') and kind = 'membership' and month_index = 2), 5.00, 'March carries the increase as +5');
select is((select coalesce(sum(amount), 0) from private.ledger_lines
            where member_id = tests.lm('Dee') and kind = 'membership'), 35.00, 'the cycle total of the membership is 35');
select is((select array_agg(e.kind order by e.kind) from entries e where e.corrects_entry_id in (tests.id('fee'), tests.id('mem'))),
  array['adjustment', 'membership'], 'the reduction is stored as an adjustment and the increase as a membership entry');

select * from finish();
rollback;
```

- [ ] **Step 2: Make sure the rollback runner exists**

The runner lives in the session scratchpad. If `run.mjs` / `combine.py` are missing, recreate them: `run.mjs` connects with `SUPABASE_DB_URL` (from `.env.local`, the dev project), runs `discard temp` before each of `00_helpers.sql` and `00_ledger_helpers.sql`, runs the test file, prints only `ok` / `not ok` / `#` / `1..N` lines, always rolls back and drops schema `tests`; `combine.py MIG|- TEST OUT` splices a migration after the test's first `begin;` (`-` means none).

```bash
export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$HOME/.bun/bin:$PATH"
S=/tmp/claude-1000/-home-bk08-dev-web-village-banking/43e07bdc-ccaf-4683-870c-76c605cf3048/scratchpad
ls $S/run.mjs $S/combine.py
```

Expected: both files listed.

- [ ] **Step 3: Run the test against dev (read-only, rolled back)**

```bash
set -a; . ./.env.local; set +a
python3 $S/combine.py - supabase/tests/database/20_export_fee_fold.sql $S/c20.sql && bun $S/run.mjs $S/c20.sql | grep -v '^ok'
```

Expected: only the `1..N` plan line (no `not ok`, no `ERR`). If a figure differs, work out the engine's true value, confirm it through the engine, and rule on it in the ledger; never loosen an assertion to make it pass. This test pins existing behaviour, so a failure means the engine does something this plan misdescribes (then Task 3's fee fold and the spec's §4 must change to match the engine).

- [ ] **Step 4: Commit**

```bash
git add supabase/tests/database/20_export_fee_fold.sql
git commit -m "test: pin how fee corrections count in a month

A fee corrected down lands as an adjustment that counts negative under the fee's own
kind, in the month it is made; a membership corrected up counts positive. The month
workbook repeats this rule on screen, so the engine's version is pinned here. No SQL changes."
```

---

### Task 3: Types, paging, file names, normalising and the fee fold

**Files:**
- Create: `src/features/exports/types.ts`, `fileName.ts`, `paging.ts`, `fees.ts`, `normalise.ts`
- Test: `fileName.test.ts`, `paging.test.ts`, `fees.test.ts`, `normalise.test.ts` (same folder)

**Interfaces:**
- Produces:
  - `types.ts`: `GroupFigures`, `MemberMonth`, `MonthFigures`, `Person`, `MemberMonthEntry`, `MonthExport`, `PeriodExport`, `MemberExport` (exact shapes below)
  - `fileName.ts`: `safeFileName(name: string): string`, `xlsxName(...parts: string[]): string`
  - `paging.ts`: `PAGE_SIZE = 1000`, `fetchAllRows<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]>`, `chunk<T>(items: T[], size: number): T[][]`
  - `fees.ts`: `feeFold(periodEntries: EntryRow[], originals: EntryRow[]): Map<string, { txn_fee: number; membership: number }>`
  - `normalise.ts`: `memberMonth(row: Record<string, unknown> & { member_id: string }): MemberMonth`, `groupFigures(row: Record<string, unknown>): GroupFigures`

- [ ] **Step 1: Write the failing tests**

`src/features/exports/fileName.test.ts`:

```ts
import { expect, test } from 'vitest';
import { safeFileName, xlsxName } from './fileName';

test('characters a file system rejects become spaces, and spaces collapse', () => {
  expect(safeFileName('Premium VB: Mar/Apr "2026"?')).toBe('Premium VB Mar Apr 2026');
  expect(safeFileName('  a\\b|c<d>e*f  ')).toBe('a b c d e f');
});

test('control characters are dropped too', () => {
  expect(safeFileName('a\u0000b\nc')).toBe('a b c');
});

test('xlsxName joins the parts, skips blanks and adds the extension', () => {
  expect(xlsxName('Premium VB', 'Mar 2026', '')).toBe('Premium VB Mar 2026.xlsx');
  expect(xlsxName('Premium VB', 'Oct 2026', '(preview)')).toBe('Premium VB Oct 2026 (preview).xlsx');
});

test('a name with nothing usable still gets a name', () => {
  expect(xlsxName('///')).toBe('Export.xlsx');
});

test('a very long name is cut', () => {
  expect(xlsxName('x'.repeat(300)).length).toBeLessThanOrEqual(125);
});
```

`src/features/exports/paging.test.ts`:

```ts
import { expect, test, vi } from 'vitest';
import { chunk, fetchAllRows } from './paging';

const source = (total: number, cap = 1000) => {
  const all = Array.from({ length: total }, (_, i) => i);
  const calls: Array<[number, number]> = [];
  const page = vi.fn(async (from: number, to: number) => {
    calls.push([from, to]);
    return { data: all.slice(from, Math.min(to + 1, from + cap)), error: null };
  });
  return { all, calls, page };
};

test('reads page after page until one comes back empty, so 2,500 rows are all returned', async () => {
  const s = source(2500);
  expect(await fetchAllRows(s.page)).toEqual(s.all);
  expect(s.calls).toEqual([[0, 999], [1000, 1999], [2000, 2999], [2500, 3499]]);
});

test('a server that returns fewer rows than asked for (a row cap) loses nothing', async () => {
  const s = source(1200, 500);
  expect(await fetchAllRows(s.page)).toEqual(s.all);
});

test('an empty source is one request', async () => {
  const s = source(0);
  expect(await fetchAllRows(s.page)).toEqual([]);
  expect(s.calls).toEqual([[0, 999]]);
});

test('an error is thrown, not swallowed', async () => {
  await expect(fetchAllRows(async () => ({ data: null, error: new Error('boom') }))).rejects.toThrow('boom');
});

test('chunk splits a list into pieces of at most the size', () => {
  expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  expect(chunk([], 3)).toEqual([]);
});
```

`src/features/exports/fees.test.ts`:

```ts
import { expect, test } from 'vitest';
import { entry } from '@/features/ledger/testFixtures';
import { feeFold } from './fees';

// The same scenario as supabase/tests/database/20_export_fee_fold.sql: February fee 10 and membership 30;
// in March the fee is corrected to 6 (an adjustment of 4) and the membership to 35 (a membership entry of +5).
const FEB_FEE = entry({ id: 'f1', member_id: 'm1', kind: 'txn_fee', amount: 10, period_id: 'p1', source: 'app' });
const FEB_MEMBERSHIP = entry({ id: 'f2', member_id: 'm1', kind: 'membership', amount: 30, period_id: 'p1', source: 'app' });
const MARCH = [
  entry({ id: 'a1', member_id: 'm1', kind: 'adjustment', amount: 4, period_id: 'p2', source: 'correction', corrects_entry_id: 'f1', reason: 'Fee was 6' }),
  entry({ id: 'a2', member_id: 'm1', kind: 'membership', amount: 5, period_id: 'p2', source: 'correction', corrects_entry_id: 'f2', reason: 'Membership was 35' }),
];

test('February carries the fees, March carries the corrections under the same kinds', () => {
  expect(feeFold([FEB_FEE, FEB_MEMBERSHIP], []).get('m1')).toEqual({ txn_fee: 10, membership: 30 });
  expect(feeFold(MARCH, [FEB_FEE, FEB_MEMBERSHIP]).get('m1')).toEqual({ txn_fee: -4, membership: 5 });
});

test('the cycle total is the sum of the months: 6 and 35, as the engine says', () => {
  const feb = feeFold([FEB_FEE, FEB_MEMBERSHIP], []).get('m1')!;
  const mar = feeFold(MARCH, [FEB_FEE, FEB_MEMBERSHIP]).get('m1')!;
  expect(feb.txn_fee + mar.txn_fee).toBe(6);
  expect(feb.membership + mar.membership).toBe(35);
});

test('a waiver counts negative under the kind it points at, and other kinds are ignored', () => {
  const waiver = entry({ id: 'w1', member_id: 'm2', kind: 'waiver', amount: 2, source: 'correction', corrects_entry_id: 'f1' });
  const saving = entry({ id: 's1', member_id: 'm2', kind: 'saving', amount: 250 });
  const penaltyWaiver = entry({ id: 'w2', member_id: 'm2', kind: 'waiver', amount: 9, source: 'correction', corrects_entry_id: 'pen' });
  const penalty = entry({ id: 'pen', member_id: 'm2', kind: 'penalty', amount: 50, period_id: 'p1' });
  expect(feeFold([waiver, saving, penaltyWaiver], [FEB_FEE, penalty]).get('m2')).toEqual({ txn_fee: -2, membership: 0 });
});

test('ngwee add up exactly, entries with no member are skipped, a correction with an unknown original is skipped', () => {
  const a = entry({ id: 'x1', member_id: 'm1', kind: 'txn_fee', amount: 0.1, source: 'app' });
  const b = entry({ id: 'x2', member_id: 'm1', kind: 'txn_fee', amount: 0.2, source: 'app' });
  const group = entry({ id: 'x3', member_id: null, kind: 'txn_fee', amount: 5 });
  const lost = entry({ id: 'x4', member_id: 'm1', kind: 'adjustment', amount: 1, source: 'correction', corrects_entry_id: 'gone' });
  expect(feeFold([a, b, group, lost], []).get('m1')).toEqual({ txn_fee: 0.3, membership: 0 });
  expect(feeFold([a, b, group, lost], []).size).toBe(1);
});
```

`src/features/exports/normalise.test.ts`:

```ts
import { expect, test } from 'vitest';
import { closeMember, statement } from '@/features/ledger/testFixtures';
import { groupFigures, memberMonth } from './normalise';

test('a statement row becomes the figures and nothing else', () => {
  const m = memberMonth(statement({ member_id: 'm1', saving: 250, cum_savings: 2000, closing_owed: -50 }));
  expect(m).toMatchObject({ member_id: 'm1', saving: 250, cum_savings: 2000, closing_owed: -50 });
  for (const leaked of ['id', 'group_id', 'period_id', 'created_at', 'source']) expect(m).not.toHaveProperty(leaked);
});

test('a close-preview member has the same shape; a figure it lacks is 0 and numeric strings become numbers', () => {
  const preview = { ...closeMember({ member_id: 'm2', short_name: 'Ann' }), cum_savings: '1500.50' } as unknown as Record<string, unknown> & { member_id: string };
  const m = memberMonth(preview);
  expect(m.member_id).toBe('m2');
  expect(m.cum_savings).toBe(1500.5);
  expect(m.unpaid_minimum).toBe(0);
  expect(m).not.toHaveProperty('short_name');
});

test('group figures keep only the named fields', () => {
  const g = groupFigures({ id: 'x', group_id: 'g1', period_id: 'p1', source: 'close', created_at: 'now', opening_cash: 5000, received: 900, excess_rate: 0.1, fee_pot_balance: -3.2 });
  expect(g).toMatchObject({ opening_cash: 5000, received: 900, excess_rate: 0.1, fee_pot_balance: -3.2, loans_sent: 0, total_owed: 0 });
  for (const leaked of ['id', 'group_id', 'period_id', 'source', 'created_at']) expect(g).not.toHaveProperty(leaked);
});
```

Run: `bun run test src/features/exports`. Expected: FAIL (modules missing).

- [ ] **Step 2: Implement**

`src/features/exports/types.ts`:

```ts
import type { EntryRow, LoanRow, PayoutRow } from '@/features/ledger/memberViews';
import type { PeriodRow } from '@/features/ledger/model';
import type { MemberStatusRow } from '@/features/ledger/queries';

/** One month's group-level figures (a group statement, or the group part of a close preview). */
export type GroupFigures = {
  opening_cash: number; received: number; savings: number; loans_sent: number; idle_cash: number;
  excess_rate: number; excess_billed: number; interest_collected: number;
  fee_pot_in: number; fee_pot_out: number; fee_pot_balance: number;
  meeting_pot_in: number; meeting_pot_balance: number; total_savings: number; total_owed: number;
};

/** One member's figures for one month (a statement row, or a member of a close preview): the figures and no ids but the member's. */
export type MemberMonth = {
  member_id: string;
  saving: number; cum_savings: number; opening_owed: number; loan_principal_sent: number; loan_interest_charged: number;
  excess_charged: number; penalties_charged: number; paid_total: number; paid_to_penalties: number; paid_to_excess: number;
  paid_to_interest: number; paid_to_principal: number; closing_owed: number; next_minimum: number; unpaid_minimum: number;
  interest_earned: number; interest_earned_to_date: number;
};

/** A closed month, or the open month as a preview (always last, `preview` true, `closedOn` null). */
export type MonthFigures = { period: PeriodRow; closedOn: string | null; preview: boolean; group: GroupFigures; members: MemberMonth[] };

/** The only member fields ever read: no e-mail, phone or account id. */
export type Person = { id: string; short_name: string; full_name: string; status: string };

export type MonthExport = {
  groupName: string; cycleLabel: string; generatedOn: Date;
  figures: MonthFigures;
  /** Last month's `next_minimum` per member: what was due this month. Empty for the first month. */
  minimumDue: Record<string, number>;
  people: Person[]; periods: PeriodRow[];
  /** Every entry recorded in the month, and the earlier entries its corrections point at. */
  entries: EntryRow[]; originals: EntryRow[];
};

export type PeriodExport = {
  groupName: string; cycleLabel: string; generatedOn: Date;
  /** Closed months in order, then the open month as a preview when the engine could preview it. */
  months: MonthFigures[];
  /** The open month, when its preview was refused only because declarations are waiting. */
  openLeftOut: PeriodRow | null;
  /** Label of the month `payout` is worked from: the open month, else the last closed one. */
  payoutAsAt: string | null;
  people: Person[]; periods: PeriodRow[]; loans: LoanRow[]; statuses: MemberStatusRow[]; payout: PayoutRow[];
};

export type MemberMonthEntry = { period: PeriodRow; closedOn: string | null; preview: boolean; row: MemberMonth };

/** Only this member's data. */
export type MemberExport = {
  groupName: string; cycleLabel: string; generatedOn: Date;
  person: Person;
  months: MemberMonthEntry[];
  openLeftOut: PeriodRow | null;
  payoutAsAt: string | null;
  periods: PeriodRow[]; loans: LoanRow[]; status: MemberStatusRow | null; payout: PayoutRow | null; entries: EntryRow[];
};
```

`src/features/exports/fileName.ts`:

```ts
const REJECTED = /[\\/:*?"<>|]/g;

/** A name every file system accepts: the characters \ / : * ? " < > | and control characters become spaces, spaces collapse. */
export function safeFileName(name: string): string {
  const printable = Array.from(name, (c) => (c.charCodeAt(0) < 32 ? ' ' : c)).join('');
  return printable.replace(REJECTED, ' ').replace(/\s+/g, ' ').trim();
}

/** `Premium VB Mar 2026.xlsx` from parts; blank parts are skipped. */
export function xlsxName(...parts: string[]): string {
  const base = safeFileName(parts.filter((p) => p.trim() !== '').join(' ')).slice(0, 120).trim();
  return `${base || 'Export'}.xlsx`;
}
```

`src/features/exports/paging.ts`:

```ts
/** PostgREST returns at most 1,000 rows a request (supabase/config.toml max_rows). */
export const PAGE_SIZE = 1000;

/**
 * Every row of a query, page by page. `page` must carry a stable order. It reads until a page comes back empty and advances by the
 * rows it received, so a server row cap below PAGE_SIZE can never make it skip rows.
 */
export async function fetchAllRows<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  for (;;) {
    const { data, error } = await page(rows.length, rows.length + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) return rows;
    rows.push(...data);
  }
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
```

`src/features/exports/fees.ts`:

```ts
import type { EntryRow } from '@/features/ledger/memberViews';
import { sumKwacha } from '@/features/ledger/money';

export type FeeTotals = { txn_fee: number; membership: number };
const SUBTRACTS = ['waiver', 'adjustment'];

/**
 * Each member's transfer fees and membership fees recorded in one period, counted the way the engine counts them
 * (private.ledger_lines, pinned by supabase/tests/database/20_export_fee_fold.sql): a waiver or adjustment counts negative under the
 * kind of the entry it points at, so a fee corrected in April shows in April and March keeps its closing figure.
 * `originals` are the earlier entries the period's corrections point at.
 */
export function feeFold(periodEntries: EntryRow[], originals: EntryRow[]): Map<string, FeeTotals> {
  const byId = new Map([...originals, ...periodEntries].map((e) => [e.id, e]));
  const parts = new Map<string, { txn_fee: number[]; membership: number[] }>();
  for (const e of periodEntries) {
    if (e.member_id === null) continue;
    const subtracts = SUBTRACTS.includes(e.kind);
    const kind = subtracts ? byId.get(e.corrects_entry_id ?? '')?.kind : e.kind;
    if (kind !== 'txn_fee' && kind !== 'membership') continue;
    const slot = parts.get(e.member_id) ?? { txn_fee: [], membership: [] };
    slot[kind].push(subtracts ? -e.amount : e.amount);
    parts.set(e.member_id, slot);
  }
  return new Map([...parts].map(([id, p]) => [id, { txn_fee: sumKwacha(...p.txn_fee), membership: sumKwacha(...p.membership) }]));
}
```

`src/features/exports/normalise.ts`:

```ts
import type { GroupFigures, MemberMonth } from './types';

const MEMBER_FIELDS = [
  'saving', 'cum_savings', 'opening_owed', 'loan_principal_sent', 'loan_interest_charged', 'excess_charged', 'penalties_charged',
  'paid_total', 'paid_to_penalties', 'paid_to_excess', 'paid_to_interest', 'paid_to_principal', 'closing_owed', 'next_minimum',
  'unpaid_minimum', 'interest_earned', 'interest_earned_to_date',
] as const satisfies readonly (keyof MemberMonth)[];

const GROUP_FIELDS = [
  'opening_cash', 'received', 'savings', 'loans_sent', 'idle_cash', 'excess_rate', 'excess_billed', 'interest_collected',
  'fee_pot_in', 'fee_pot_out', 'fee_pot_balance', 'meeting_pot_in', 'meeting_pot_balance', 'total_savings', 'total_owed',
] as const satisfies readonly (keyof GroupFigures)[];

/**
 * A statement row or a close-preview member as figures only: nothing else on the row (its id, creation time, source) travels into a file.
 * A figure the source lacks is 0; numeric strings become numbers.
 */
export function memberMonth(row: Record<string, unknown> & { member_id: string }): MemberMonth {
  const out: Record<string, unknown> = { member_id: row.member_id };
  for (const key of MEMBER_FIELDS) out[key] = Number(row[key] ?? 0);
  return out as MemberMonth;
}

export function groupFigures(row: Record<string, unknown>): GroupFigures {
  const out: Record<string, unknown> = {};
  for (const key of GROUP_FIELDS) out[key] = Number(row[key] ?? 0);
  return out as GroupFigures;
}
```

- [ ] **Step 3: Run the tests and the gates**

Run: `bun run test src/features/exports && bun run lint && bun run typecheck`. Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/exports/types.ts src/features/exports/fileName.ts src/features/exports/fileName.test.ts src/features/exports/paging.ts src/features/exports/paging.test.ts src/features/exports/fees.ts src/features/exports/fees.test.ts src/features/exports/normalise.ts src/features/exports/normalise.test.ts
git commit -m "feat: the pure helpers behind the Excel exports

Types for a month's figures, paging that cannot lose rows past 1,000 or under a row cap,
safe file names, normalising of statement rows and preview members into bare figures, and
the fee fold that repeats the engine's rule (pinned by the pgTAP scenario)."
```

---

### Task 4: The sheet kit, the fixtures and the month workbook

**Files:**
- Create: `src/features/exports/sheetKit.ts`, `exportFixtures.ts`, `monthWorkbook.ts`
- Test: `src/features/exports/monthWorkbook.test.ts`

**Interfaces:**
- Consumes: `loadExcel`, `Workbook`, `Worksheet` (Task 1); `feeFold`, types (Task 3); `kindLabel`, `EntryRow` from `@/features/ledger/memberViews`; `sumKwacha`.
- Produces:
  - `sheetKit.ts`: `type Cell = string | number | Date | null`; `type ColKind = 'text' | 'money' | 'int' | 'date' | 'percent'`; `type Col = { header: string; kind: ColKind; width?: number }`; `MONEY_FORMAT`; `dayCell(iso: string): Date`; `dayText(iso: string): string`; `newSheet(wb: Workbook, name: string): Worksheet`; `writeLines(ws, lines: string[]): number` (returns the next free row); `writeTable(ws, start: number, cols: Col[], rows: Cell[][], opts?: { totals?: Cell[]; freeze?: boolean; freezeCols?: number }): { header: number; first: number; last: number; totals: number | null; next: number }`; `sumColumn(rows, index): number`; `totalsRow(rows, width, label, sumAt: number[], labelAt?: number): Cell[]`; `range(from, to): number[]`; `signedAmount(e: EntryRow): number`; `sourceLabel(source: string): string`; `toBytes(wb: Workbook): Promise<Uint8Array>`
  - `monthWorkbook.ts`: `buildMonthWorkbook(d: MonthExport): Promise<Uint8Array>`
  - `exportFixtures.ts` (test-only): `PERIODS`, `PEOPLE`, `MONTHS`, `PAYOUT`, `LOAN`, `FEB_FEE`, `FEB_MEMBERSHIP`, `MAR_ENTRIES`, `mm`, `gf`, `monthExport(i, o?)`, `readBack(bytes)`, `rowsOf(ws)`, `tableOf(ws, firstHeader)`; Tasks 5 and 6 add `periodExport`, `memberExport`.

- [ ] **Step 1: Write the fixtures (test support; they are used by the tests below)**

`src/features/exports/exportFixtures.ts`:

```ts
import type { PayoutRow } from '@/features/ledger/memberViews';
import { entry, loan, year } from '@/features/ledger/testFixtures';
import { loadExcel, type Worksheet } from './loadExcel';
import type { Cell } from './sheetKit';
import type { GroupFigures, MemberMonth, MonthExport, MonthFigures, Person } from './types';

// Feb, Mar and Apr are closed (p1..p3), May is open (p4). Synthetic people and amounts only.
export const PERIODS = year(3, 'open');
export const PEOPLE: Person[] = [
  { id: 'm1', short_name: 'Eve', full_name: 'Eve Example', status: 'active' },
  { id: 'm2', short_name: 'Ann', full_name: 'Ann Example', status: 'active' },
  { id: 'm3', short_name: 'Bob', full_name: 'Bob Example', status: 'active' },
];

export const mm = (member_id: string, o: Partial<MemberMonth> = {}): MemberMonth => ({
  member_id, saving: 0, cum_savings: 0, opening_owed: 0, loan_principal_sent: 0, loan_interest_charged: 0, excess_charged: 0,
  penalties_charged: 0, paid_total: 0, paid_to_penalties: 0, paid_to_excess: 0, paid_to_interest: 0, paid_to_principal: 0,
  closing_owed: 0, next_minimum: 0, unpaid_minimum: 0, interest_earned: 0, interest_earned_to_date: 0, ...o,
});

export const gf = (o: Partial<GroupFigures> = {}): GroupFigures => ({
  opening_cash: 5000, received: 900, savings: 850, loans_sent: 0, idle_cash: 5000, excess_rate: 0.1, excess_billed: 500, interest_collected: 0,
  fee_pot_in: 0, fee_pot_out: 0, fee_pot_balance: 10, meeting_pot_in: 0, meeting_pot_balance: 90, total_savings: 850, total_owed: 0, ...o,
});

const CLOSED_ON = ['2026-03-07T10:00:00Z', '2026-04-07T10:00:00Z', '2026-05-07T10:00:00Z'];
const figures = (i: number, members: MemberMonth[], group: Partial<GroupFigures>): MonthFigures => ({
  period: PERIODS[i]!, closedOn: CLOSED_ON[i] ?? null, preview: i === 3, group: gf(group), members,
});

// Eve m1, Ann m2, Bob m3. Bob borrows 1,000 (+150 interest) in February, is short by 100 in April and pays a penalty of 100.
export const MONTHS: MonthFigures[] = [
  figures(0, [
    mm('m1', { saving: 250, cum_savings: 250 }),
    mm('m2', { saving: 500, cum_savings: 500 }),
    mm('m3', { saving: 100, cum_savings: 100, loan_principal_sent: 1000, loan_interest_charged: 150, closing_owed: 1150, next_minimum: 400 }),
  ], { received: 900, loans_sent: 1000, fee_pot_in: 10, fee_pot_balance: 10, meeting_pot_in: 90, meeting_pot_balance: 90, total_savings: 850, total_owed: 1150 }),
  figures(1, [
    mm('m1', { saving: 250, cum_savings: 500, interest_earned: 5, interest_earned_to_date: 5 }),
    mm('m2', { saving: 500, cum_savings: 1000, interest_earned: 10, interest_earned_to_date: 10 }),
    mm('m3', { saving: 100, cum_savings: 200, opening_owed: 1150, paid_total: 400, paid_to_interest: 150, paid_to_principal: 250, closing_owed: 900, next_minimum: 400, interest_earned: 2, interest_earned_to_date: 2 }),
  ], { received: 1300, fee_pot_balance: 10, meeting_pot_balance: 90, total_savings: 1700, total_owed: 900 }),
  figures(2, [
    mm('m1', { saving: 250, cum_savings: 750, penalties_charged: 50, closing_owed: 50, next_minimum: 50, interest_earned: 5, interest_earned_to_date: 10 }),
    mm('m2', { saving: 500, cum_savings: 1500, interest_earned: 10, interest_earned_to_date: 20 }),
    mm('m3', { saving: 100, cum_savings: 300, opening_owed: 900, penalties_charged: 100, paid_total: 300, paid_to_penalties: 100, paid_to_principal: 200, closing_owed: 700, next_minimum: 500, unpaid_minimum: 100, interest_earned: 2, interest_earned_to_date: 4 }),
  ], { received: 1250, fee_pot_balance: 10, meeting_pot_balance: 90, total_savings: 2550, total_owed: 750 }),
  figures(3, [
    mm('m1', { saving: 250, cum_savings: 1000, opening_owed: 50, paid_total: 50, paid_to_penalties: 50, closing_owed: 0, interest_earned_to_date: 10 }),
    mm('m2', { saving: 500, cum_savings: 2000, interest_earned_to_date: 20 }),
    mm('m3', { saving: 100, cum_savings: 400, opening_owed: 700, paid_total: 500, paid_to_principal: 500, closing_owed: 200, next_minimum: 200, interest_earned: 2, interest_earned_to_date: 6 }),
  ], { received: 1350, fee_pot_balance: 10, meeting_pot_balance: 90, total_savings: 3400, total_owed: 200 }),
];

// What payout_preview says on May's figures: savings + interest - owed + an equal share of the pots (12.50 each).
export const PAYOUT: PayoutRow[] = [
  { member_id: 'm1', short_name: 'Eve', savings: 1000, interest_earned: 10, owed: 0, pot_share: 12.5, payout: 1022.5 },
  { member_id: 'm2', short_name: 'Ann', savings: 2000, interest_earned: 20, owed: 0, pot_share: 12.5, payout: 2032.5 },
  { member_id: 'm3', short_name: 'Bob', savings: 400, interest_earned: 6, owed: 200, pot_share: 12.5, payout: 218.5 },
];

export const LOAN = loan({ id: 'l1', member_id: 'm3', period_id: 'p1', principal: 1000, interest: 150, term_months: 3, status: 'open', sent_at: '2026-02-20T09:00:00Z' });

// Eve's February fees, and March's corrections of them (the scenario pinned by supabase/tests/database/20_export_fee_fold.sql).
export const FEB_FEE = entry({ id: 'f1', member_id: 'm1', kind: 'txn_fee', amount: 10, period_id: 'p1', source: 'app', created_at: '2026-02-05T08:00:00Z' });
export const FEB_MEMBERSHIP = entry({ id: 'f2', member_id: 'm1', kind: 'membership', amount: 30, period_id: 'p1', source: 'app', created_at: '2026-02-05T08:00:00Z' });
export const MAR_ENTRIES = [
  entry({ id: 's1', member_id: 'm1', kind: 'saving', amount: 250, period_id: 'p2', source: 'import', created_at: '2026-04-01T00:00:00Z' }),
  entry({ id: 'a1', member_id: 'm1', kind: 'adjustment', amount: 4, period_id: 'p2', source: 'correction', corrects_entry_id: 'f1', reason: 'Fee was 6', created_at: '2026-03-10T08:00:00Z' }),
  entry({ id: 'a2', member_id: 'm1', kind: 'membership', amount: 5, period_id: 'p2', source: 'correction', corrects_entry_id: 'f2', reason: '=HYPERLINK("http://example.test","click")', created_at: '2026-03-10T08:01:00Z' }),
  entry({ id: 'g1', member_id: null, kind: 'payout_fee', amount: 3, period_id: 'p2', source: 'import', created_at: '2026-04-01T00:00:00Z' }),
];

export const monthExport = (i: number, o: Partial<MonthExport> = {}): MonthExport => ({
  groupName: 'Test Group', cycleLabel: 'Cycle 2026', generatedOn: new Date('2026-10-13T08:00:00Z'),
  figures: MONTHS[i]!, minimumDue: {}, people: PEOPLE, periods: PERIODS, entries: [], originals: [], ...o,
});

/** Reads a generated file back the way Excel would. */
export async function readBack(bytes: Uint8Array) {
  const { Workbook } = await loadExcel();
  const wb = new Workbook();
  await wb.xlsx.load(bytes as unknown as Buffer);
  return wb;
}

/** Every cell of a sheet, row by row (a blank cell is null). */
export function rowsOf(ws: Worksheet): Cell[][] {
  const out: Cell[][] = [];
  for (let r = 1; r <= ws.rowCount; r++) {
    const row: Cell[] = [];
    for (let c = 1; c <= ws.columnCount; c++) {
      const v = ws.getCell(r, c).value;
      row.push(v === undefined || v === null ? null : (v as Cell));
    }
    out.push(row);
  }
  return out;
}

/** The table whose header row starts with `firstHeader`: its header, its rows up to the first blank row (a totals row included), and column lookups. */
export function tableOf(ws: Worksheet, firstHeader: string) {
  const rows = rowsOf(ws);
  const at = rows.findIndex((r) => r[0] === firstHeader);
  if (at < 0) throw new Error(`no table starting with "${firstHeader}"`);
  const header = rows[at]!.map((c) => String(c ?? ''));
  const body: Cell[][] = [];
  for (const r of rows.slice(at + 1)) {
    if (r.every((c) => c === null)) break;
    body.push(r);
  }
  const col = (name: string): number => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`no column "${name}" in ${header.join(' | ')}`);
    return i;
  };
  return { header, body, col, get: (row: Cell[], name: string): Cell => row[col(name)] ?? null };
}
```

- [ ] **Step 2: Write the failing month-workbook tests**

`src/features/exports/monthWorkbook.test.ts`:

```ts
// @vitest-environment node
import { expect, test } from 'vitest';
import { FEB_FEE, FEB_MEMBERSHIP, MAR_ENTRIES, MONTHS, PEOPLE, gf, mm, monthExport, readBack, rowsOf, tableOf } from './exportFixtures';
import { loadExcel } from './loadExcel';
import { buildMonthWorkbook } from './monthWorkbook';

const march = () => monthExport(1, { entries: MAR_ENTRIES, originals: [FEB_FEE, FEB_MEMBERSHIP], minimumDue: { m3: 400 } });
const build = async (d = march()) => readBack(await buildMonthWorkbook(d));

test('a month has a Members, a Group and an Entries sheet', async () => {
  const wb = await build();
  expect(wb.worksheets.map((w) => w.name)).toEqual(['Members', 'Group', 'Entries']);
});

test('the Members sheet opens with the group, the month and when it closed', async () => {
  const lines = rowsOf((await build()).getWorksheet('Members')!);
  expect(lines[0]![0]).toBe('Test Group: Mar 2026');
  expect(lines[1]![0]).toBe('Closed on 7 Apr 2026');
  expect(String(lines[2]![0])).toContain('Deadline 7 Mar 2026');
});

test('members are listed by name with the engine’s figures, and the minimum due last month', async () => {
  const t = tableOf((await build()).getWorksheet('Members')!, 'S/N');
  expect(t.body.map((r) => t.get(r, 'Name'))).toEqual(['Ann', 'Bob', 'Eve', 'Total']);
  const bob = t.body[1]!;
  expect(t.get(bob, 'Savings')).toBe(100);
  expect(t.get(bob, 'Cumm. Savings')).toBe(200);
  expect(t.get(bob, 'Owed at the start')).toBe(1150);
  expect(t.get(bob, 'Minimum amount payable')).toBe(400);
  expect(t.get(bob, 'Amount received')).toBe(400);
  expect(t.get(bob, 'Paid to loan interest')).toBe(150);
  expect(t.get(bob, 'Paid to loan')).toBe(250);
  expect(t.get(bob, 'Owed at the end')).toBe(900);
  expect(t.get(bob, 'Minimum next month')).toBe(400);
  expect(t.get(bob, 'Interest earned to date')).toBe(2);
  expect(t.get(t.body[0]!, 'S/N')).toBe(1);
});

test('the totals row adds each column up, and the savings total is the group’s', async () => {
  const t = tableOf((await build()).getWorksheet('Members')!, 'S/N');
  const total = t.body.at(-1)!;
  expect(t.get(total, 'Savings')).toBe(850);
  expect(t.get(total, 'Cumm. Savings')).toBe(500 + 1000 + 200);
  expect(t.get(total, 'Owed at the end')).toBe(900);
  expect(t.get(total, 'Savings')).toBe(MONTHS[1]!.group.savings);
});

test('fees are the month’s, with corrections counted under the fee’s own kind: March shows -4 and +5', async () => {
  const t = tableOf((await build()).getWorksheet('Members')!, 'S/N');
  const eve = t.body[2]!;
  expect(t.get(eve, 'Name')).toBe('Eve');
  expect(t.get(eve, 'Transaction fee')).toBe(-4);
  expect(t.get(eve, 'Membership fee')).toBe(5);
  expect(t.get(t.body[0]!, 'Transaction fee')).toBe(0);
});

test('the first month has no minimum due', async () => {
  const t = tableOf((await build(monthExport(0))).getWorksheet('Members')!, 'S/N');
  expect(t.body.slice(0, 3).map((r) => t.get(r, 'Minimum amount payable'))).toEqual([0, 0, 0]);
});

test('the open month is a clearly labelled preview', async () => {
  const wb = await build(monthExport(3));
  const lines = rowsOf(wb.getWorksheet('Members')!);
  expect(lines[0]![0]).toBe('Test Group: May 2026 (preview)');
  expect(String(lines[1]![0])).toContain('PREVIEW: May 2026 is still open, so these figures can change until it is closed.');
});

test('a credit stays a negative number, and a member missing from the people list is not dropped', async () => {
  const d = monthExport(1, {
    figures: { ...MONTHS[1]!, members: [mm('m1', { closing_owed: -50 }), mm('m9', { saving: 10, cum_savings: 10 })] },
    people: PEOPLE,
  });
  const t = tableOf((await build(d)).getWorksheet('Members')!, 'S/N');
  const eve = t.body.find((r) => t.get(r, 'Name') === 'Eve')!;
  expect(t.get(eve, 'Owed at the end')).toBe(-50);
  expect(t.body.map((r) => t.get(r, 'Name'))).toContain('Unknown member');
});

test('the Group sheet lists the group’s cash and pots, and flags a short fee pot', async () => {
  const d = monthExport(1, { figures: { ...MONTHS[1]!, group: gf({ opening_cash: 1234.5, fee_pot_balance: -3.2, excess_rate: 0.1 }) } });
  const t = tableOf((await build(d)).getWorksheet('Group')!, 'Group figure');
  const row = (label: string) => t.body.find((r) => r[0] === label)!;
  expect(t.get(row('Opening cash'), 'Amount')).toBe(1234.5);
  expect(t.get(row('Excess rate'), 'Amount')).toBe(0.1);
  expect(t.get(row('Fee pot balance'), 'Amount')).toBe(-3.2);
  expect(String(t.get(row('Fee pot balance'), 'Note'))).toContain('short');
  expect(t.get(row('Total savings'), 'Note')).toBeNull();
});

test('the Entries sheet lists the month oldest first, with reductions negative and what each correction fixed', async () => {
  const t = tableOf((await build()).getWorksheet('Entries')!, 'Date');
  expect(t.body.map((r) => t.get(r, 'What'))).toEqual(['Adjustment', 'Membership', 'Payout fee', 'Savings']);
  const adjustment = t.body[0]!;
  expect(t.get(adjustment, 'Amount')).toBe(-4);
  expect(t.get(adjustment, 'Corrects')).toBe('Mobile-money fee from Feb 2026');
  expect(t.get(adjustment, 'Member')).toBe('Eve');
  expect(t.get(adjustment, 'Source')).toBe('Correction');
  expect((t.get(adjustment, 'Date') as Date).toISOString().slice(0, 10)).toBe('2026-03-10');
  expect(t.get(t.body[2]!, 'Member')).toBe('Group');
  expect(t.get(t.body[3]!, 'Date')).toBeNull();
  expect(t.get(t.body[3]!, 'Source')).toBe('Workbook');
});

test('a reason that looks like a formula is written as plain text', async () => {
  const wb = await build();
  const sheet = wb.getWorksheet('Entries')!;
  const t = tableOf(sheet, 'Date');
  const rowIndex = t.body.findIndex((r) => r[t.col('What')] === 'Membership');
  const cell = sheet.getCell(rowIndex + 5, t.col('Reason') + 1); // two title lines and a blank row, then the header on row 4: data starts on row 5
  const { ValueType } = await loadExcel();
  expect(cell.value).toBe('=HYPERLINK("http://example.test","click")');
  expect(cell.type).toBe(ValueType.String);
});
```

Run: `bun run test src/features/exports/monthWorkbook.test.ts`. Expected: FAIL (modules missing).

- [ ] **Step 3: Implement the sheet kit**

`src/features/exports/sheetKit.ts`:

```ts
import { kindLabel, type EntryRow } from '@/features/ledger/memberViews';
import { sumKwacha } from '@/features/ledger/money';
import { formatDate, localISODate } from '@/lib/format';
import type { Workbook, Worksheet } from './loadExcel';

export type Cell = string | number | Date | null;
export type ColKind = 'text' | 'money' | 'int' | 'date' | 'percent';
export type Col = { header: string; kind: ColKind; width?: number };

export const MONEY_FORMAT = '"K" #,##0.00;-"K" #,##0.00';
const NUMBER_FORMAT: Record<ColKind, string | undefined> = { text: undefined, money: MONEY_FORMAT, int: '0', date: 'dd mmm yyyy', percent: '0.0%' };
const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8ECEF' } } as const;

const localDay = (iso: string): string => (iso.length > 10 ? localISODate(new Date(iso)) : iso);

/** A calendar day (a timestamp read in the treasurer's time zone, or a plain 'YYYY-MM-DD') held at UTC midnight, so Excel shows that day everywhere. */
export const dayCell = (iso: string): Date => new Date(`${localDay(iso)}T00:00:00Z`);

/** The same day as words: 7 Apr 2026. */
export const dayText = (iso: string): string => formatDate(localDay(iso));

export function newSheet(wb: Workbook, name: string): Worksheet {
  const ws = wb.addWorksheet(name.slice(0, 31));
  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  return ws;
}

/** Lines at the top of a sheet: the first is the title. Returns the row the next block starts on (one blank row after the lines). */
export function writeLines(ws: Worksheet, lines: string[]): number {
  lines.forEach((text, i) => {
    const cell = ws.getCell(i + 1, 1);
    cell.value = text;
    cell.font = i === 0 ? { bold: true, size: 14 } : { color: { argb: 'FF555B61' } };
  });
  return lines.length + 2;
}

/**
 * A header row at `start`, the data rows under it and an optional totals row. Values are written as given (a string stays a string),
 * a null is left blank. `freeze` freezes the header and the first `freezeCols` columns. `next` is the row two below the table.
 */
export function writeTable(
  ws: Worksheet,
  start: number,
  cols: Col[],
  rows: Cell[][],
  opts: { totals?: Cell[]; freeze?: boolean; freezeCols?: number } = {},
): { header: number; first: number; last: number; totals: number | null; next: number } {
  cols.forEach((c, i) => {
    const cell = ws.getCell(start, i + 1);
    cell.value = c.header;
    cell.font = { bold: true };
    cell.fill = HEADER_FILL;
    cell.alignment = { wrapText: true, vertical: 'middle', horizontal: c.kind === 'text' ? 'left' : 'right' };
    const col = ws.getColumn(i + 1);
    col.width = Math.max(col.width ?? 0, c.width ?? Math.min(26, Math.max(12, c.header.length + 2)));
  });
  const put = (r: number, cells: Cell[], bold: boolean) =>
    cells.forEach((value, i) => {
      const cell = ws.getCell(r, i + 1);
      if (value !== null) cell.value = value;
      const format = NUMBER_FORMAT[cols[i]?.kind ?? 'text'];
      if (format && value !== null && typeof value !== 'string') cell.numFmt = format;
      if (bold) {
        cell.font = { bold: true };
        cell.border = { top: { style: 'thin' } };
      }
    });
  rows.forEach((cells, i) => put(start + 1 + i, cells, false));
  const last = start + rows.length;
  const totals = opts.totals ? last + 1 : null;
  if (opts.totals && totals !== null) put(totals, opts.totals, true);
  if (opts.freeze) ws.views = [{ state: 'frozen', xSplit: opts.freezeCols ?? 0, ySplit: start }];
  return { header: start, first: start + 1, last, totals, next: (totals ?? last) + 2 };
}

export const range = (from: number, to: number): number[] => Array.from({ length: to - from + 1 }, (_, i) => from + i);

/** The column's numbers added in whole ngwee; blanks and text count as 0. */
export const sumColumn = (rows: Cell[][], index: number): number => sumKwacha(...rows.map((r) => (typeof r[index] === 'number' ? (r[index] as number) : 0)));

/** A totals row: `label` in column `labelAt`, the sum of each column in `sumAt`, the rest blank. */
export function totalsRow(rows: Cell[][], width: number, label: string, sumAt: number[], labelAt = 0): Cell[] {
  const out: Cell[] = Array.from({ length: width }, () => null);
  out[labelAt] = label;
  for (const i of sumAt) out[i] = sumColumn(rows, i);
  return out;
}

/** An entry's amount as the engine counts it: waivers and adjustments reduce. */
export const signedAmount = (e: EntryRow): number => (e.kind === 'waiver' || e.kind === 'adjustment' ? -e.amount : e.amount);

const SOURCE: Record<string, string> = { import: 'Workbook', app: 'App', correction: 'Correction', close: 'Month close' };
export const sourceLabel = (source: string): string => SOURCE[source] ?? source;

export { kindLabel };

export async function toBytes(wb: Workbook): Promise<Uint8Array> {
  return new Uint8Array(await wb.xlsx.writeBuffer());
}
```

- [ ] **Step 4: Implement the month workbook**

`src/features/exports/monthWorkbook.ts`:

```ts
import { formatDate } from '@/lib/format';
import { feeFold } from './fees';
import { loadExcel, type Workbook } from './loadExcel';
import { dayCell, dayText, kindLabel, newSheet, range, signedAmount, sourceLabel, toBytes, totalsRow, writeLines, writeTable, type Cell, type Col } from './sheetKit';
import type { MonthExport } from './types';

const MEMBER_COLS: Col[] = [
  { header: 'S/N', kind: 'int', width: 6 },
  { header: 'Name', kind: 'text', width: 16 },
  { header: 'Savings', kind: 'money' },
  { header: 'Cumm. Savings', kind: 'money' },
  { header: 'Transaction fee', kind: 'money' },
  { header: 'Membership fee', kind: 'money' },
  { header: 'Owed at the start', kind: 'money' },
  { header: 'Loan', kind: 'money' },
  { header: 'Interest on loan', kind: 'money' },
  { header: 'Excess interest', kind: 'money' },
  { header: 'Penalties', kind: 'money' },
  { header: 'Minimum amount payable', kind: 'money' },
  { header: 'Amount received', kind: 'money' },
  { header: 'Paid to penalties', kind: 'money' },
  { header: 'Paid to excess', kind: 'money' },
  { header: 'Paid to loan interest', kind: 'money' },
  { header: 'Paid to loan', kind: 'money' },
  { header: 'Short of the minimum', kind: 'money' },
  { header: 'Owed at the end', kind: 'money' },
  { header: 'Minimum next month', kind: 'money' },
  { header: 'Interest earned', kind: 'money' },
  { header: 'Interest earned to date', kind: 'money' },
];

const ENTRY_COLS: Col[] = [
  { header: 'Date', kind: 'date' },
  { header: 'Member', kind: 'text', width: 16 },
  { header: 'What', kind: 'text', width: 20 },
  { header: 'Amount', kind: 'money' },
  { header: 'Reason', kind: 'text', width: 40 },
  { header: 'Corrects', kind: 'text', width: 32 },
  { header: 'Source', kind: 'text', width: 14 },
];

const title = (d: MonthExport): string => `${d.groupName}: ${d.figures.period.label}${d.figures.preview ? ' (preview)' : ''}`;

function membersSheet(wb: Workbook, d: MonthExport): void {
  const { period, closedOn, preview, members } = d.figures;
  const ws = newSheet(wb, 'Members');
  const status = preview
    ? `PREVIEW: ${period.label} is still open, so these figures can change until it is closed.`
    : closedOn
      ? `Closed on ${dayText(closedOn)}`
      : 'Closed';
  const start = writeLines(ws, [title(d), status, `Cycle ${d.cycleLabel}. Deadline ${formatDate(period.deadline)}. Generated ${dayText(d.generatedOn.toISOString())}. A negative figure is a credit.`]);
  const names = new Map(d.people.map((p) => [p.id, p.short_name]));
  const fees = feeFold(d.entries, d.originals);
  const rows: Cell[][] = members
    .map((m) => ({ m, name: names.get(m.member_id) ?? 'Unknown member' }))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(({ m, name }, i) => {
      const fee = fees.get(m.member_id);
      return [
        i + 1, name, m.saving, m.cum_savings, fee?.txn_fee ?? 0, fee?.membership ?? 0, m.opening_owed, m.loan_principal_sent,
        m.loan_interest_charged, m.excess_charged, m.penalties_charged, d.minimumDue[m.member_id] ?? 0, m.paid_total, m.paid_to_penalties,
        m.paid_to_excess, m.paid_to_interest, m.paid_to_principal, m.unpaid_minimum, m.closing_owed, m.next_minimum, m.interest_earned,
        m.interest_earned_to_date,
      ];
    });
  writeTable(ws, start, MEMBER_COLS, rows, { totals: totalsRow(rows, MEMBER_COLS.length, 'Total', range(2, 21), 1), freeze: true, freezeCols: 2 });
}

function groupSheet(wb: Workbook, d: MonthExport): void {
  const g = d.figures.group;
  const ws = newSheet(wb, 'Group');
  const start = writeLines(ws, [title(d), `The group’s cash and pots for the month. Generated ${dayText(d.generatedOn.toISOString())}.`]);
  const lines: Array<[string, number]> = [
    ['Opening cash', g.opening_cash], ['Received this month', g.received], ['Savings', g.savings], ['Loans sent', g.loans_sent],
    ['Cash left over', g.idle_cash], ['Excess rate', g.excess_rate], ['Excess billed', g.excess_billed], ['Interest collected', g.interest_collected],
    ['Fee pot in', g.fee_pot_in], ['Fee pot out', g.fee_pot_out], ['Fee pot balance', g.fee_pot_balance],
    ['Meeting pot in', g.meeting_pot_in], ['Meeting pot balance', g.meeting_pot_balance], ['Total savings', g.total_savings], ['Total owed', g.total_owed],
  ];
  const rows: Cell[][] = lines.map(([label, value]) => [
    label, value, label === 'Fee pot balance' && value < 0 ? 'The fee pot is short: loan transfer fees exceed what members declared.' : null,
  ]);
  const t = writeTable(ws, start, [{ header: 'Group figure', kind: 'text', width: 28 }, { header: 'Amount', kind: 'money', width: 18 }, { header: 'Note', kind: 'text', width: 60 }], rows);
  ws.getCell(t.first + lines.findIndex(([label]) => label === 'Excess rate'), 2).numFmt = '0.0%';
}

function entriesSheet(wb: Workbook, d: MonthExport): void {
  const ws = newSheet(wb, 'Entries');
  const start = writeLines(ws, [title(d), 'Everything recorded in the month, oldest first. Waivers and reductions are negative.']);
  const names = new Map(d.people.map((p) => [p.id, p.short_name]));
  const labels = new Map(d.periods.map((p) => [p.id, p.label]));
  const known = new Map([...d.originals, ...d.entries].map((e) => [e.id, e]));
  const rows: Cell[][] = [...d.entries]
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
    .map((e) => {
      const original = e.corrects_entry_id ? known.get(e.corrects_entry_id) : undefined;
      return [
        e.source === 'import' ? null : dayCell(e.created_at),
        e.member_id ? (names.get(e.member_id) ?? 'Unknown member') : 'Group',
        kindLabel(e.kind),
        signedAmount(e),
        e.reason ?? null,
        original ? `${kindLabel(original.kind)} from ${labels.get(original.period_id) ?? 'an earlier month'}` : null,
        sourceLabel(e.source),
      ];
    });
  writeTable(ws, start, ENTRY_COLS, rows, { freeze: true });
}

/** One month as a workbook: the members, the group's cash and pots, and everything recorded. The open month is a labelled preview. */
export async function buildMonthWorkbook(d: MonthExport): Promise<Uint8Array> {
  const { Workbook } = await loadExcel();
  const wb = new Workbook();
  wb.creator = 'Premium Village Banking';
  wb.created = d.generatedOn;
  membersSheet(wb, d);
  groupSheet(wb, d);
  entriesSheet(wb, d);
  return toBytes(wb);
}
```

- [ ] **Step 5: Run the tests and the gates**

Run: `bun run test src/features/exports && bun run lint && bun run typecheck`. Expected: PASS. If a figure in a test differs, compare with the fixture before touching the builder; the fixtures are the source of truth for expected numbers.

- [ ] **Step 6: Commit**

```bash
git add src/features/exports/sheetKit.ts src/features/exports/exportFixtures.ts src/features/exports/monthWorkbook.ts src/features/exports/monthWorkbook.test.ts
git commit -m "feat: build the month workbook

A Members sheet in the old workbooks' column order with totals, a Group sheet with cash and
pots, and an Entries sheet. Figures are the engine's; fees are counted the engine's way so
corrections show in the month they are made. The open month is a labelled preview. Tests
read the generated file back."
```

---

### Task 5: The standpoint helper and the whole-period workbook

**Files:**
- Create: `src/features/exports/standpoint.ts`, `periodWorkbook.ts`
- Modify: `src/features/exports/exportFixtures.ts` (add `NEW_MEMBER`, `periodExport`)
- Test: `src/features/exports/standpoint.test.ts`, `periodWorkbook.test.ts`

**Interfaces:**
- Consumes: Task 4's kit and fixtures; `memberStatus` from `@/features/ledger/testFixtures`.
- Produces:
  - `standpoint.ts`: `type MonthRow = { period: PeriodRow; preview: boolean; row: MemberMonth }`; `type Standpoint = { savedToDate; interestToDate; loansTaken; loanInterest; penalties; paidIn; owedNow; nextMinimum; monthsShort }` (all numbers); `standpointOf(rows: MonthRow[]): Standpoint`
  - `periodWorkbook.ts`: `buildPeriodWorkbook(d: PeriodExport): Promise<Uint8Array>`
  - fixtures: `NEW_MEMBER`, `periodExport(o?)`

- [ ] **Step 1: Add the fixtures**

Append to `src/features/exports/exportFixtures.ts` (and add `memberStatus` to the existing `@/features/ledger/testFixtures` import and `PeriodExport` to the types import):

```ts

export const NEW_MEMBER: Person = { id: 'm4', short_name: 'Cy', full_name: 'Cy Example', status: 'active' };

// Bob is defaulted; the reason is a treasurer's note and must never reach a file.
export const BOB_STATUS = memberStatus({ member_id: 'm3', defaulted: true, reason: 'Missed three months' });

export const periodExport = (o: Partial<PeriodExport> = {}): PeriodExport => ({
  groupName: 'Test Group', cycleLabel: 'Cycle 2026', generatedOn: new Date('2026-10-13T08:00:00Z'),
  months: MONTHS, openLeftOut: null, payoutAsAt: 'May 2026', people: PEOPLE, periods: PERIODS, loans: [LOAN],
  statuses: [BOB_STATUS], payout: PAYOUT, ...o,
});
```

- [ ] **Step 2: Write the failing tests**

`src/features/exports/standpoint.test.ts`:

```ts
import { expect, test } from 'vitest';
import { MONTHS, PERIODS, mm } from './exportFixtures';
import { standpointOf, type MonthRow } from './standpoint';

const history = (id: string): MonthRow[] =>
  MONTHS.flatMap((m) => {
    const row = m.members.find((x) => x.member_id === id);
    return row ? [{ period: m.period, preview: m.preview, row }] : [];
  });

test('Bob’s standpoint through the May preview', () => {
  expect(standpointOf(history('m3'))).toEqual({
    savedToDate: 400, interestToDate: 6, loansTaken: 1000, loanInterest: 150, penalties: 100,
    paidIn: 400 + 300 + 500, owedNow: 200, nextMinimum: 200, monthsShort: 1,
  });
});

test('months short counts closed months only: a preview’s shortfall is not final', () => {
  const rows: MonthRow[] = [
    { period: PERIODS[1]!, preview: false, row: mm('m1', { unpaid_minimum: 10 }) },
    { period: PERIODS[3]!, preview: true, row: mm('m1', { unpaid_minimum: 99 }) },
  ];
  expect(standpointOf(rows).monthsShort).toBe(1);
});

test('the latest month decides the balances, whatever order the rows come in', () => {
  const rows = history('m1').reverse();
  expect(standpointOf(rows)).toMatchObject({ savedToDate: 1000, owedNow: 0, interestToDate: 10 });
});

test('a member with no months is all zeros, never NaN', () => {
  expect(standpointOf([])).toEqual({ savedToDate: 0, interestToDate: 0, loansTaken: 0, loanInterest: 0, penalties: 0, paidIn: 0, owedNow: 0, nextMinimum: 0, monthsShort: 0 });
});

test('ngwee add up exactly', () => {
  const rows: MonthRow[] = [
    { period: PERIODS[0]!, preview: false, row: mm('m1', { paid_total: 0.1 }) },
    { period: PERIODS[1]!, preview: false, row: mm('m1', { paid_total: 0.2 }) },
  ];
  expect(standpointOf(rows).paidIn).toBe(0.3);
});
```

`src/features/exports/periodWorkbook.test.ts`:

```ts
// @vitest-environment node
import { expect, test } from 'vitest';
import { MONTHS, NEW_MEMBER, PEOPLE, PERIODS, mm, periodExport, readBack, rowsOf, tableOf } from './exportFixtures';
import { buildPeriodWorkbook } from './periodWorkbook';

const build = async (o = periodExport()) => readBack(await buildPeriodWorkbook(o));

test('the workbook has the six sheets, in reading order', async () => {
  expect((await build()).worksheets.map((w) => w.name)).toEqual(['Summary', 'Savings by month', 'Owed by month', 'Members', 'Loans', 'Statements']);
});

test('the Summary has a row per month, the open month last and marked as a preview, with totals that say so', async () => {
  const wb = await build();
  const lines = rowsOf(wb.getWorksheet('Summary')!);
  expect(lines[0]![0]).toBe('Test Group: Cycle 2026, summary');
  expect(String(lines[1]![0])).toContain('Through May 2026 (preview');
  const t = tableOf(wb.getWorksheet('Summary')!, 'Month');
  expect(t.body.map((r) => t.get(r, 'Month'))).toEqual(['Feb 2026', 'Mar 2026', 'Apr 2026', 'May 2026 (preview)', 'Total (includes the May 2026 preview)']);
  expect(t.get(t.body[3]!, 'Closed on')).toBe('Open: preview');
  expect((t.get(t.body[0]!, 'Closed on') as Date).toISOString().slice(0, 10)).toBe('2026-03-07');
  const total = t.body.at(-1)!;
  expect(t.get(total, 'Savings')).toBe(MONTHS.reduce((n, m) => n + m.group.savings, 0));
  expect(t.get(total, 'Loans sent')).toBe(1000);
  expect(t.get(total, 'Total owed')).toBeNull();
  expect(t.get(t.body[3]!, 'Total owed')).toBe(200);
});

test('when the open month had to be left out the file says so and the totals do not mention a preview', async () => {
  const wb = await build(periodExport({ months: MONTHS.slice(0, 3), openLeftOut: PERIODS[3]!, payoutAsAt: 'May 2026' }));
  const lines = rowsOf(wb.getWorksheet('Summary')!).map((r) => r[0]);
  expect(lines).toContain('May 2026 is not included: declarations are still waiting.');
  const t = tableOf(wb.getWorksheet('Summary')!, 'Month');
  expect(t.body.map((r) => t.get(r, 'Month'))).toEqual(['Feb 2026', 'Mar 2026', 'Apr 2026', 'Total']);
});

test('savings by month: cumulative savings per month, then interest earned and its share of savings', async () => {
  const t = tableOf((await build()).getWorksheet('Savings by month')!, 'Name');
  expect(t.header).toEqual(['Name', 'Feb 2026', 'Mar 2026', 'Apr 2026', 'May 2026 (preview)', 'Interest earned', 'Interest as % of savings']);
  expect(t.body.map((r) => t.get(r, 'Name'))).toEqual(['Ann', 'Bob', 'Eve', 'Total']);
  const eve = t.body[2]!;
  expect([250, 500, 750, 1000].map((_, i) => eve[1 + i])).toEqual([250, 500, 750, 1000]);
  expect(t.get(eve, 'Interest earned')).toBe(10);
  expect(t.get(eve, 'Interest as % of savings')).toBeCloseTo(0.01, 10);
  const total = t.body.at(-1)!;
  expect(t.get(total, 'May 2026 (preview)')).toBe(1000 + 2000 + 400);
  expect(t.get(total, 'Interest earned')).toBe(10 + 20 + 6);
  expect(t.get(total, 'Interest as % of savings')).toBeCloseTo(36 / 3400, 10);
});

test('a member with no figures yet has blank months and a share of 0, never NaN', async () => {
  const t = tableOf((await build(periodExport({ people: [...PEOPLE, NEW_MEMBER] }))).getWorksheet('Savings by month')!, 'Name');
  const cy = t.body.find((r) => t.get(r, 'Name') === 'Cy')!;
  expect(cy.slice(1, 5)).toEqual([null, null, null, null]);
  expect(t.get(cy, 'Interest earned')).toBe(0);
  expect(t.get(cy, 'Interest as % of savings')).toBe(0);
});

test('owed by month keeps a credit negative', async () => {
  const months = MONTHS.map((m, i) => (i === 3 ? { ...m, members: [mm('m1', { closing_owed: -50 }), ...m.members.slice(1)] } : m));
  const t = tableOf((await build(periodExport({ months }))).getWorksheet('Owed by month')!, 'Name');
  const eve = t.body.find((r) => t.get(r, 'Name') === 'Eve')!;
  expect(t.get(eve, 'May 2026 (preview)')).toBe(-50);
  const bob = t.body.find((r) => t.get(r, 'Name') === 'Bob')!;
  expect([1, 2, 3, 4].map((i) => bob[i])).toEqual([1150, 900, 700, 200]);
});

test('the Members sheet gives each member’s standpoint, and what the cycle would pay if it ended today', async () => {
  const wb = await build();
  const lines = rowsOf(wb.getWorksheet('Members')!);
  expect(lines.flat()).toContain('Through May 2026 (preview)');
  expect(lines.flat()).toContain('If the cycle ended today (using May 2026 figures)');
  const t = tableOf(wb.getWorksheet('Members')!, 'Name');
  expect(t.body.map((r) => t.get(r, 'Name'))).toEqual(['Ann', 'Bob', 'Eve', 'Total']);
  const bob = t.body[1]!;
  expect(t.get(bob, 'Saved to date')).toBe(400);
  expect(t.get(bob, 'Interest earned to date')).toBe(6);
  expect(t.get(bob, 'Loans taken')).toBe(1000);
  expect(t.get(bob, 'Loan interest charged')).toBe(150);
  expect(t.get(bob, 'Penalties charged')).toBe(100);
  expect(t.get(bob, 'Paid in')).toBe(1200);
  expect(t.get(bob, 'Owed now')).toBe(200);
  expect(t.get(bob, 'Months short of the minimum')).toBe(1);
  expect(t.get(bob, 'Standing')).toBe('Defaulted');
  expect(t.get(t.body[0]!, 'Standing')).toBe('In good standing');
  const payoutAt = t.header.indexOf('Payout');
  expect(bob[payoutAt]).toBe(218.5);
  expect(bob[payoutAt - 1]).toBe(12.5);
  const total = t.body.at(-1)!;
  expect(total[payoutAt]).toBe(1022.5 + 2032.5 + 218.5);
});

test('the default’s reason is a treasurer’s note and appears nowhere', async () => {
  const wb = await build();
  const everything = wb.worksheets.flatMap((w) => rowsOf(w).flat()).map(String).join('\n');
  expect(everything).not.toContain('Missed three months');
});

test('a member who is not in the payout list has blank payout cells', async () => {
  const t = tableOf((await build(periodExport({ payout: [] }))).getWorksheet('Members')!, 'Name');
  expect(t.body[0]![t.header.indexOf('Payout')]).toBeNull();
});

test('loans list who borrowed in which month', async () => {
  const t = tableOf((await build()).getWorksheet('Loans')!, 'Name');
  expect(t.body).toHaveLength(1);
  expect(t.get(t.body[0]!, 'Name')).toBe('Bob');
  expect(t.get(t.body[0]!, 'Month')).toBe('Feb 2026');
  expect(t.get(t.body[0]!, 'Principal')).toBe(1000);
  expect(t.get(t.body[0]!, 'Term (months)')).toBe(3);
});

test('statements is the long form: a row per member per month, the preview flagged', async () => {
  const t = tableOf((await build()).getWorksheet('Statements')!, 'Month');
  expect(t.body).toHaveLength(12);
  expect(t.body.filter((r) => t.get(r, 'Preview') === 'Preview').map((r) => t.get(r, 'Month'))).toEqual(['May 2026', 'May 2026', 'May 2026']);
  const bobApr = t.body.find((r) => t.get(r, 'Name') === 'Bob' && t.get(r, 'Month') === 'Apr 2026')!;
  expect(t.get(bobApr, 'Short of the minimum')).toBe(100);
  expect(t.get(bobApr, 'Owed at the end')).toBe(700);
});

test('with no months at all the file is still valid and says there is nothing yet', async () => {
  const wb = await build(periodExport({ months: [], payout: [], loans: [], statuses: [] }));
  const lines = rowsOf(wb.getWorksheet('Summary')!);
  expect(String(lines[1]![0])).toContain('Nothing to show yet');
});
```

Run: `bun run test src/features/exports/standpoint.test.ts src/features/exports/periodWorkbook.test.ts`. Expected: FAIL (modules missing).

- [ ] **Step 3: Implement `standpoint.ts`**

```ts
import type { PeriodRow } from '@/features/ledger/model';
import { sumKwacha } from '@/features/ledger/money';
import type { MemberMonth } from './types';

export type MonthRow = { period: PeriodRow; preview: boolean; row: MemberMonth };

export type Standpoint = {
  savedToDate: number; interestToDate: number; loansTaken: number; loanInterest: number; penalties: number; paidIn: number;
  owedNow: number; nextMinimum: number; monthsShort: number;
};

/**
 * Where a member stands after the months given. Balances are the latest month's own engine figures (cumulative savings, interest to date,
 * owed, next minimum); flows are summed. A month still open (a preview) counts toward the balances and flows but not toward "months short",
 * because its shortfall is not final until it is closed.
 */
export function standpointOf(rows: MonthRow[]): Standpoint {
  const ordered = [...rows].sort((a, b) => a.period.month_index - b.period.month_index);
  const last = ordered.at(-1)?.row;
  return {
    savedToDate: last?.cum_savings ?? 0,
    interestToDate: last?.interest_earned_to_date ?? 0,
    loansTaken: sumKwacha(...ordered.map((r) => r.row.loan_principal_sent)),
    loanInterest: sumKwacha(...ordered.map((r) => r.row.loan_interest_charged)),
    penalties: sumKwacha(...ordered.map((r) => r.row.penalties_charged)),
    paidIn: sumKwacha(...ordered.map((r) => r.row.paid_total)),
    owedNow: last?.closing_owed ?? 0,
    nextMinimum: last?.next_minimum ?? 0,
    monthsShort: ordered.filter((r) => !r.preview && r.row.unpaid_minimum > 0).length,
  };
}
```

- [ ] **Step 4: Implement `periodWorkbook.ts`**

```ts
import { sumKwacha } from '@/features/ledger/money';
import { loadExcel, type Workbook } from './loadExcel';
import { standpointOf, type MonthRow } from './standpoint';
import { dayCell, dayText, newSheet, range, sumColumn, toBytes, totalsRow, writeLines, writeTable, type Cell, type Col } from './sheetKit';
import type { MemberMonth, MonthFigures, PeriodExport, Person } from './types';

const monthTitle = (m: MonthFigures): string => (m.preview ? `${m.period.label} (preview)` : m.period.label);

const STATEMENT_COLUMNS: Array<[keyof MemberMonth, string]> = [
  ['saving', 'Savings'], ['cum_savings', 'Cumm. Savings'], ['opening_owed', 'Owed at the start'], ['loan_principal_sent', 'Loan'],
  ['loan_interest_charged', 'Interest on loan'], ['excess_charged', 'Excess interest'], ['penalties_charged', 'Penalties'],
  ['paid_total', 'Amount received'], ['paid_to_penalties', 'Paid to penalties'], ['paid_to_excess', 'Paid to excess'],
  ['paid_to_interest', 'Paid to loan interest'], ['paid_to_principal', 'Paid to loan'], ['unpaid_minimum', 'Short of the minimum'],
  ['closing_owed', 'Owed at the end'], ['next_minimum', 'Minimum next month'], ['interest_earned', 'Interest earned'],
  ['interest_earned_to_date', 'Interest earned to date'],
];

/** Active members, and anyone who left but has figures, by name. */
function people(d: PeriodExport): Person[] {
  const seen = new Set(d.months.flatMap((m) => m.members.map((x) => x.member_id)));
  return d.people.filter((p) => p.status === 'active' || seen.has(p.id)).sort((a, b) => a.short_name.localeCompare(b.short_name));
}

const figureOf = (m: MonthFigures, id: string): MemberMonth | undefined => m.members.find((x) => x.member_id === id);

function history(d: PeriodExport, id: string): MonthRow[] {
  return d.months.flatMap((m) => {
    const row = figureOf(m, id);
    return row ? [{ period: m.period, preview: m.preview, row }] : [];
  });
}

function heading(d: PeriodExport, what: string, extra: string[] = []): string[] {
  const last = d.months.at(-1);
  const generated = `Generated ${dayText(d.generatedOn.toISOString())}.`;
  return [
    `${d.groupName}: ${d.cycleLabel}, ${what}`,
    last ? `Through ${last.period.label}${last.preview ? ' (preview: this month is still open, so its figures can change)' : ''}. ${generated}` : `Nothing to show yet. ${generated}`,
    ...(d.openLeftOut ? [`${d.openLeftOut.label} is not included: declarations are still waiting.`] : []),
    ...extra,
  ];
}

const SUMMARY_COLS: Col[] = [
  { header: 'Month', kind: 'text', width: 22 },
  { header: 'Closed on', kind: 'date', width: 16 },
  { header: 'Savings', kind: 'money' },
  { header: 'Received', kind: 'money' },
  { header: 'Loans sent', kind: 'money' },
  { header: 'Interest collected', kind: 'money' },
  { header: 'Fee pot in', kind: 'money' },
  { header: 'Fee pot out', kind: 'money' },
  { header: 'Fee pot balance', kind: 'money' },
  { header: 'Meeting pot in', kind: 'money' },
  { header: 'Meeting pot balance', kind: 'money' },
  { header: 'Cash left over', kind: 'money' },
  { header: 'Total savings', kind: 'money' },
  { header: 'Total owed', kind: 'money' },
];

function summarySheet(wb: Workbook, d: PeriodExport): void {
  const ws = newSheet(wb, 'Summary');
  const start = writeLines(ws, heading(d, 'summary'));
  const rows: Cell[][] = d.months.map((m) => [
    monthTitle(m), m.preview ? 'Open: preview' : m.closedOn ? dayCell(m.closedOn) : null,
    m.group.savings, m.group.received, m.group.loans_sent, m.group.interest_collected, m.group.fee_pot_in, m.group.fee_pot_out,
    m.group.fee_pot_balance, m.group.meeting_pot_in, m.group.meeting_pot_balance, m.group.idle_cash, m.group.total_savings, m.group.total_owed,
  ]);
  const preview = d.months.find((m) => m.preview);
  const label = preview ? `Total (includes the ${preview.period.label} preview)` : 'Total';
  // Flows add up across months; balances (pots, total savings, total owed) do not.
  writeTable(ws, start, SUMMARY_COLS, rows, { totals: totalsRow(rows, SUMMARY_COLS.length, label, [2, 3, 4, 5, 6, 7, 9]), freeze: true, freezeCols: 1 });
}

function matrixSheet(wb: Workbook, d: PeriodExport, name: string, what: string, pick: (m: MemberMonth) => number, withInterest: boolean): void {
  const ws = newSheet(wb, name);
  const start = writeLines(ws, heading(d, what, ['A negative figure is a credit.']));
  const who = people(d);
  const months = d.months.length;
  const cols: Col[] = [
    { header: 'Name', kind: 'text', width: 16 },
    ...d.months.map((m): Col => ({ header: monthTitle(m), kind: 'money' })),
    ...(withInterest ? [{ header: 'Interest earned', kind: 'money' } as Col, { header: 'Interest as % of savings', kind: 'percent' } as Col] : []),
  ];
  const latest = (id: string): MemberMonth | undefined => history(d, id).at(-1)?.row;
  const rows: Cell[][] = who.map((p) => {
    const cells: Cell[] = [p.short_name, ...d.months.map((m) => { const f = figureOf(m, p.id); return f ? pick(f) : null; })];
    if (withInterest) {
      const last = latest(p.id);
      const interest = last?.interest_earned_to_date ?? 0;
      const cum = last?.cum_savings ?? 0;
      cells.push(interest, cum > 0 ? interest / cum : 0);
    }
    return cells;
  });
  const totals = totalsRow(rows, cols.length, 'Total', range(1, months + (withInterest ? 1 : 0)));
  if (withInterest) {
    const cum = sumKwacha(...who.map((p) => latest(p.id)?.cum_savings ?? 0));
    totals[cols.length - 1] = cum > 0 ? sumColumn(rows, months + 1) / cum : 0;
  }
  writeTable(ws, start, cols, rows, { totals, freeze: true, freezeCols: 1 });
}

function membersSheet(wb: Workbook, d: PeriodExport): void {
  const ws = newSheet(wb, 'Members');
  const start = writeLines(ws, heading(d, 'where each member stands', ['A negative owed figure is a credit.']));
  const last = d.months.at(-1);
  const defaulted = new Set(d.statuses.filter((s) => s.defaulted).map((s) => s.member_id));
  const cols: Col[] = [
    { header: 'Name', kind: 'text', width: 16 },
    { header: 'Saved to date', kind: 'money' }, { header: 'Interest earned to date', kind: 'money' }, { header: 'Loans taken', kind: 'money' },
    { header: 'Loan interest charged', kind: 'money' }, { header: 'Penalties charged', kind: 'money' }, { header: 'Paid in', kind: 'money' },
    { header: 'Owed now', kind: 'money' }, { header: 'Next minimum', kind: 'money' }, { header: 'Months short of the minimum', kind: 'int' },
    { header: 'Standing', kind: 'text', width: 18 },
    { header: 'Savings', kind: 'money' }, { header: 'Interest', kind: 'money' }, { header: 'Owed', kind: 'money' },
    { header: 'Share of the pots', kind: 'money' }, { header: 'Payout', kind: 'money' },
  ];
  ws.getCell(start, 2).value = last ? `Through ${last.period.label}${last.preview ? ' (preview)' : ''}` : 'Through now';
  ws.getCell(start, 12).value = `If the cycle ended today${d.payoutAsAt ? ` (using ${d.payoutAsAt} figures)` : ''}`;
  ws.getCell(start, 2).font = { bold: true };
  ws.getCell(start, 12).font = { bold: true };
  const rows: Cell[][] = people(d).map((p) => {
    const s = standpointOf(history(d, p.id));
    const pay = d.payout.find((x) => x.member_id === p.id);
    return [
      p.short_name, s.savedToDate, s.interestToDate, s.loansTaken, s.loanInterest, s.penalties, s.paidIn, s.owedNow, s.nextMinimum, s.monthsShort,
      defaulted.has(p.id) ? 'Defaulted' : 'In good standing',
      pay?.savings ?? null, pay?.interest_earned ?? null, pay?.owed ?? null, pay?.pot_share ?? null, pay?.payout ?? null,
    ];
  });
  writeTable(ws, start + 1, cols, rows, { totals: totalsRow(rows, cols.length, 'Total', [...range(1, 8), ...range(11, 15)]), freeze: true, freezeCols: 1 });
}

function loansSheet(wb: Workbook, d: PeriodExport): void {
  const ws = newSheet(wb, 'Loans');
  const start = writeLines(ws, heading(d, 'loans'));
  const names = new Map(d.people.map((p) => [p.id, p.short_name]));
  const labels = new Map(d.periods.map((p) => [p.id, p.label]));
  const rows: Cell[][] = [...d.loans]
    .sort((a, b) => a.sent_at.localeCompare(b.sent_at) || a.id.localeCompare(b.id))
    .map((l) => [names.get(l.member_id) ?? 'Unknown member', labels.get(l.period_id) ?? '', l.principal, l.interest, l.term_months, l.status, dayCell(l.sent_at)]);
  writeTable(ws, start, [
    { header: 'Name', kind: 'text', width: 16 }, { header: 'Month', kind: 'text', width: 14 }, { header: 'Principal', kind: 'money' },
    { header: 'Interest', kind: 'money' }, { header: 'Term (months)', kind: 'int' }, { header: 'Status', kind: 'text' }, { header: 'Sent on', kind: 'date' },
  ], rows, { freeze: true });
}

function statementsSheet(wb: Workbook, d: PeriodExport): void {
  const ws = newSheet(wb, 'Statements');
  const start = writeLines(ws, heading(d, 'every member, every month'));
  const names = new Map(d.people.map((p) => [p.id, p.short_name]));
  const cols: Col[] = [
    { header: 'Month', kind: 'text', width: 14 }, { header: 'Preview', kind: 'text', width: 10 }, { header: 'Name', kind: 'text', width: 16 },
    ...STATEMENT_COLUMNS.map(([, header]): Col => ({ header, kind: 'money' })),
  ];
  const rows: Cell[][] = d.months.flatMap((m) =>
    m.members
      .map((x) => ({ x, name: names.get(x.member_id) ?? 'Unknown member' }))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(({ x, name }): Cell[] => [m.period.label, m.preview ? 'Preview' : null, name, ...STATEMENT_COLUMNS.map(([key]) => x[key] as number)]),
  );
  writeTable(ws, start, cols, rows, { freeze: true, freezeCols: 3 });
}

/** The whole period: every closed month and the open month as a labelled preview, with cumulative figures and a row per member. */
export async function buildPeriodWorkbook(d: PeriodExport): Promise<Uint8Array> {
  const { Workbook } = await loadExcel();
  const wb = new Workbook();
  wb.creator = 'Premium Village Banking';
  wb.created = d.generatedOn;
  summarySheet(wb, d);
  matrixSheet(wb, d, 'Savings by month', 'savings by month', (m) => m.cum_savings, true);
  matrixSheet(wb, d, 'Owed by month', 'owed by month', (m) => m.closing_owed, false);
  membersSheet(wb, d);
  loansSheet(wb, d);
  statementsSheet(wb, d);
  return toBytes(wb);
}
```

- [ ] **Step 5: Run the tests and the gates**

Run: `bun run test src/features/exports && bun run lint && bun run typecheck`. Expected: PASS. (The block headings are written on the row above the table's header, in columns 2 and 12.)

- [ ] **Step 6: Commit**

```bash
git add src/features/exports/standpoint.ts src/features/exports/standpoint.test.ts src/features/exports/periodWorkbook.ts src/features/exports/periodWorkbook.test.ts src/features/exports/exportFixtures.ts
git commit -m "feat: build the whole-period workbook

Summary, savings by month with interest earned, owed by month, a one-row-per-member standpoint
sheet with the payout projection, loans, and the long-form statements. The open month is the
last column or row, labelled preview, and the totals say when they include it. If its preview
had to be left out, the file says so. Tests read the generated file back."
```

---

### Task 6: The member report

**Files:**
- Create: `src/features/exports/memberWorkbook.ts`
- Modify: `src/features/exports/exportFixtures.ts` (add `BOB_ENTRIES`, `memberExport`)
- Test: `src/features/exports/memberWorkbook.test.ts`

**Interfaces:**
- Consumes: `standpointOf` (Task 5); `correctionLine`, `correctionsOf`, `effectiveAmount` from `@/features/ledger/corrections`; `owedFigure` from `@/features/ledger/memberViews`.
- Produces: `buildMemberWorkbook(d: MemberExport): Promise<Uint8Array>`; fixtures `BOB_ENTRIES`, `SENTINEL`, `memberExport(o?)`.

- [ ] **Step 1: Add the fixtures**

Append to `src/features/exports/exportFixtures.ts` (add `MemberExport` to the types import):

```ts

// Bob's entries: the penalty scenario shared with supabase/tests/database/19_correction_parity.sql (100, waive 30, +20, -10: 80 now) and a saving.
export const BOB_ENTRIES = [
  entry({ id: 'e1', member_id: 'm3', kind: 'penalty', amount: 100, period_id: 'p3', source: 'app', reason: 'other: Missed the meeting', created_at: '2026-04-05T08:00:00Z' }),
  entry({ id: 'c1', member_id: 'm3', kind: 'waiver', amount: 30, period_id: 'p4', source: 'correction', corrects_entry_id: 'e1', reason: 'Slip found', created_at: '2026-05-08T08:00:00Z' }),
  entry({ id: 'c2', member_id: 'm3', kind: 'penalty', amount: 20, period_id: 'p4', source: 'correction', corrects_entry_id: 'e1', reason: 'Treasurer raised it', created_at: '2026-05-08T08:01:00Z' }),
  entry({ id: 'c3', member_id: 'm3', kind: 'adjustment', amount: 10, period_id: 'p4', source: 'correction', corrects_entry_id: 'e1', reason: 'Settled on 80', created_at: '2026-05-08T08:02:00Z' }),
  entry({ id: 'e2', member_id: 'm3', kind: 'saving', amount: 100, period_id: 'p2', source: 'import', created_at: '2026-04-01T00:00:00Z' }),
];

// A member who must never appear in Bob's file.
export const SENTINEL: Person = { id: 'm9', short_name: 'Zed', full_name: 'Zed Sentinel', status: 'active' };

export const memberExport = (o: Partial<MemberExport> = {}): MemberExport => ({
  groupName: 'Test Group', cycleLabel: 'Cycle 2026', generatedOn: new Date('2026-10-13T08:00:00Z'),
  person: PEOPLE[2]!,
  months: MONTHS.flatMap((m) => {
    const row = m.members.find((x) => x.member_id === 'm3');
    return row ? [{ period: m.period, closedOn: m.closedOn, preview: m.preview, row }] : [];
  }),
  openLeftOut: null, payoutAsAt: 'May 2026', periods: PERIODS, loans: [LOAN], status: BOB_STATUS, payout: PAYOUT[2]!, entries: BOB_ENTRIES, ...o,
});
```

(`BOB_STATUS` is declared in Task 5's block, earlier in the same file; keep that order.)

- [ ] **Step 2: Write the failing tests**

`src/features/exports/memberWorkbook.test.ts`:

```ts
// @vitest-environment node
import { expect, test } from 'vitest';
import { BOB_STATUS, MONTHS, PAYOUT, SENTINEL, memberExport, readBack, rowsOf, tableOf } from './exportFixtures';
import { buildMemberWorkbook } from './memberWorkbook';

const build = async (o = memberExport()) => readBack(await buildMemberWorkbook(o));

test('a member’s report has Standpoint, Month by month, Loans and Ledger sheets', async () => {
  expect((await build()).worksheets.map((w) => w.name)).toEqual(['Standpoint', 'Month by month', 'Loans', 'Ledger']);
});

test('the standpoint says where the member stands, as at the latest month', async () => {
  const wb = await build();
  const lines = rowsOf(wb.getWorksheet('Standpoint')!);
  expect(lines[0]![0]).toBe('Test Group: Bob Example');
  expect(String(lines[1]![0])).toContain('As at May 2026 (preview: this month is still open, so its figures can change)');
  const t = tableOf(wb.getWorksheet('Standpoint')!, 'Where you stand');
  const value = (label: string) => t.body.find((r) => r[0] === label)![1];
  expect(value('Saved so far')).toBe(400);
  expect(value('Interest earned so far')).toBe(6);
  expect(value('You owe')).toBe(200);
  expect(value('Minimum due next month')).toBe(200);
  expect(value('Loans taken')).toBe(1000);
  expect(value('Loan interest charged')).toBe(150);
  expect(value('Penalties charged')).toBe(100);
  expect(value('Paid in')).toBe(1200);
  expect(value('Months short of the minimum')).toBe(1);
  expect(value('Standing')).toBe('Defaulted');
});

test('what the cycle would pay if it ended today adds up to the engine’s payout', async () => {
  const t = tableOf((await build()).getWorksheet('Standpoint')!, 'If the cycle ended today (using May 2026 figures)');
  const value = (label: string) => t.body.find((r) => r[0] === label)![1] as number;
  expect(value('Your savings')).toBe(400);
  expect(value('Interest earned')).toBe(6);
  expect(value('Less what you owe')).toBe(-200);
  expect(value('Your share of the pots')).toBe(12.5);
  expect(value('You would receive')).toBe(218.5);
  expect(value('Your savings') + value('Interest earned') + value('Less what you owe') + value('Your share of the pots')).toBe(value('You would receive'));
});

test('a credit reads as a credit, not as a debt with a minus sign', async () => {
  const months = memberExport().months.map((m, i, all) => (i === all.length - 1 ? { ...m, row: { ...m.row, closing_owed: -50 } } : m));
  const payout = { ...PAYOUT[2]!, owed: -50, payout: 468.5 };
  const wb = await build(memberExport({ months, payout }));
  const t = tableOf(wb.getWorksheet('Standpoint')!, 'Where you stand');
  expect(t.body.find((r) => r[0] === 'In credit')![1]).toBe(50);
  expect(t.body.find((r) => r[0] === 'You owe')).toBeUndefined();
  const p = tableOf(wb.getWorksheet('Standpoint')!, 'If the cycle ended today (using May 2026 figures)');
  expect(p.body.find((r) => r[0] === 'Credit you hold')![1]).toBe(50);
});

test('good standing, and no payout yet, are said plainly', async () => {
  const wb = await build(memberExport({ status: null, payout: null }));
  const t = tableOf(wb.getWorksheet('Standpoint')!, 'Where you stand');
  expect(t.body.find((r) => r[0] === 'Standing')![1]).toBe('In good standing');
  const p = tableOf(wb.getWorksheet('Standpoint')!, 'If the cycle ended today (using May 2026 figures)');
  expect(p.body[0]![0]).toBe('Not available yet.');
});

test('month by month lists each month, the open one marked, with totals of the flows', async () => {
  const t = tableOf((await build()).getWorksheet('Month by month')!, 'Month');
  expect(t.body.map((r) => t.get(r, 'Month'))).toEqual(['Feb 2026', 'Mar 2026', 'Apr 2026', 'May 2026 (preview)', 'Total']);
  const apr = t.body[2]!;
  expect(t.get(apr, 'Saved')).toBe(100);
  expect(t.get(apr, 'Cumm. savings')).toBe(300);
  expect(t.get(apr, 'Owed at the end')).toBe(700);
  const total = t.body.at(-1)!;
  expect(t.get(total, 'Saved')).toBe(400);
  expect(t.get(total, 'Paid in')).toBe(1200);
  expect(t.get(total, 'Cumm. savings')).toBeNull();
});

test('the loans sheet lists the member’s loans', async () => {
  const t = tableOf((await build()).getWorksheet('Loans')!, 'Month');
  expect(t.body).toHaveLength(1);
  expect(t.get(t.body[0]!, 'Principal')).toBe(1000);
  expect(t.get(t.body[0]!, 'Status')).toBe('open');
});

test('the ledger shows an entry’s current amount and each correction under it: 100 now 80', async () => {
  const t = tableOf((await build()).getWorksheet('Ledger')!, 'Month');
  expect(t.body.map((r) => t.get(r, 'What'))).toEqual(['Savings', 'Penalty', '−K 30 waived', '+K 20 added', '−K 10 reduced']);
  const penalty = t.body[1]!;
  expect(t.get(penalty, 'Month')).toBe('Apr 2026');
  expect(t.get(penalty, 'Amount')).toBe(100);
  expect(t.get(penalty, 'Now')).toBe(80);
  expect(t.get(penalty, 'Reason')).toBe('other: Missed the meeting');
  expect(t.body.slice(2).map((r) => t.get(r, 'Amount'))).toEqual([-30, 20, -10]);
  expect(t.get(t.body[2]!, 'Reason')).toBe('Slip found');
  expect(t.get(t.body[0]!, 'Now')).toBeNull();
  expect(t.get(t.body[0]!, 'Date')).toBeNull();
});

test('a member with nothing recorded still gets a valid, empty report', async () => {
  const wb = await build(memberExport({ months: [], loans: [], entries: [], status: null, payout: null }));
  const lines = rowsOf(wb.getWorksheet('Standpoint')!);
  expect(String(lines[1]![0])).toContain('Nothing recorded yet.');
  const t = tableOf(wb.getWorksheet('Standpoint')!, 'Where you stand');
  expect(t.body.find((r) => r[0] === 'Saved so far')![1]).toBe(0);
});

test('a report made without the open month says so', async () => {
  const closedOnly = memberExport().months.filter((m) => !m.preview);
  const wb = await build(memberExport({ months: closedOnly, openLeftOut: MONTHS[3]!.period }));
  const lines = rowsOf(wb.getWorksheet('Standpoint')!).map((r) => r[0]);
  expect(lines).toContain('May 2026 is not included: declarations are still waiting.');
  expect(String(lines[1])).toContain('As at Apr 2026.');
});

test('nothing of anyone else is in the file: not a name, not a sentinel amount, not the default’s reason', async () => {
  const wb = await build();
  const everything = wb.worksheets.flatMap((w) => rowsOf(w).flat()).map(String).join('\n');
  for (const name of ['Eve', 'Ann', SENTINEL.short_name]) expect(everything).not.toMatch(new RegExp(`\\b${name}\\b`)); // whole words: "Everything" is fine
  for (const other of [SENTINEL.full_name, BOB_STATUS.reason ?? 'unreachable']) expect(everything).not.toContain(other);
  expect(everything).toContain('Bob Example');
});
```

Run: `bun run test src/features/exports/memberWorkbook.test.ts`. Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

`src/features/exports/memberWorkbook.ts`:

```ts
import { correctionLine, correctionsOf, effectiveAmount } from '@/features/ledger/corrections';
import { owedFigure } from '@/features/ledger/memberViews';
import { loadExcel, type Workbook } from './loadExcel';
import { standpointOf } from './standpoint';
import { dayCell, dayText, kindLabel, newSheet, signedAmount, sourceLabel, toBytes, totalsRow, writeLines, writeTable, type Cell, type Col } from './sheetKit';
import type { MemberExport } from './types';

const PREVIEW_NOTE = ' (preview: this month is still open, so its figures can change)';
const monthTitle = (m: { period: { label: string }; preview: boolean }): string => (m.preview ? `${m.period.label} (preview)` : m.period.label);

function standpointSheet(wb: Workbook, d: MemberExport): void {
  const ws = newSheet(wb, 'Standpoint');
  const last = d.months.at(-1);
  const s = standpointOf(d.months);
  const owed = owedFigure(s.owedNow);
  const start = writeLines(ws, [
    `${d.groupName}: ${d.person.full_name}`,
    `Cycle ${d.cycleLabel}. ${last ? `As at ${last.period.label}${last.preview ? PREVIEW_NOTE : ''}.` : 'Nothing recorded yet.'}`,
    ...(d.openLeftOut ? [`${d.openLeftOut.label} is not included: declarations are still waiting.`] : []),
    `Generated ${dayText(d.generatedOn.toISOString())}.`,
  ]);
  const rows: Cell[][] = [
    ['Saved so far', s.savedToDate], ['Interest earned so far', s.interestToDate], [owed.label, owed.amount],
    ['Minimum due next month', s.nextMinimum], ['Loans taken', s.loansTaken], ['Loan interest charged', s.loanInterest],
    ['Penalties charged', s.penalties], ['Paid in', s.paidIn], ['Months short of the minimum', s.monthsShort],
    ['Standing', d.status?.defaulted ? 'Defaulted' : 'In good standing'],
  ];
  const t = writeTable(ws, start, [{ header: 'Where you stand', kind: 'text', width: 40 }, { header: 'Amount', kind: 'money', width: 20 }], rows);
  ws.getCell(t.first + 8, 2).numFmt = '0'; // a count of months, not kwacha
  const pay = d.payout;
  const payRows: Cell[][] = pay
    ? [
        ['Your savings', pay.savings], ['Interest earned', pay.interest_earned],
        [pay.owed < 0 ? 'Credit you hold' : 'Less what you owe', 0 - pay.owed], ['Your share of the pots', pay.pot_share], ['You would receive', pay.payout],
      ]
    : [['Not available yet.', null]];
  writeTable(ws, t.next, [{ header: `If the cycle ended today${d.payoutAsAt ? ` (using ${d.payoutAsAt} figures)` : ''}`, kind: 'text' }, { header: 'Amount', kind: 'money' }], payRows);
}

const MONTH_COLS: Col[] = [
  { header: 'Month', kind: 'text', width: 22 }, { header: 'Saved', kind: 'money' }, { header: 'Cumm. savings', kind: 'money' },
  { header: 'Loan sent', kind: 'money' }, { header: 'Loan interest', kind: 'money' }, { header: 'Excess', kind: 'money' },
  { header: 'Penalties', kind: 'money' }, { header: 'Paid in', kind: 'money' }, { header: 'Owed at the end', kind: 'money' },
  { header: 'Minimum next month', kind: 'money' }, { header: 'Interest earned', kind: 'money' }, { header: 'Interest earned to date', kind: 'money' },
];

function monthsSheet(wb: Workbook, d: MemberExport): void {
  const ws = newSheet(wb, 'Month by month');
  const start = writeLines(ws, [`${d.groupName}: ${d.person.full_name}, month by month`, 'A negative owed figure is a credit.']);
  const rows: Cell[][] = [...d.months]
    .sort((a, b) => a.period.month_index - b.period.month_index)
    .map((m) => [
      monthTitle(m), m.row.saving, m.row.cum_savings, m.row.loan_principal_sent, m.row.loan_interest_charged, m.row.excess_charged,
      m.row.penalties_charged, m.row.paid_total, m.row.closing_owed, m.row.next_minimum, m.row.interest_earned, m.row.interest_earned_to_date,
    ]);
  writeTable(ws, start, MONTH_COLS, rows, { totals: totalsRow(rows, MONTH_COLS.length, 'Total', [1, 3, 4, 5, 6, 7, 10]), freeze: true, freezeCols: 1 });
}

function loansSheet(wb: Workbook, d: MemberExport): void {
  const ws = newSheet(wb, 'Loans');
  const start = writeLines(ws, [`${d.groupName}: ${d.person.full_name}, loans`]);
  const labels = new Map(d.periods.map((p) => [p.id, p.label]));
  const rows: Cell[][] = [...d.loans]
    .sort((a, b) => a.sent_at.localeCompare(b.sent_at) || a.id.localeCompare(b.id))
    .map((l) => [labels.get(l.period_id) ?? '', l.principal, l.interest, l.term_months, l.status, dayCell(l.sent_at)]);
  writeTable(ws, start, [
    { header: 'Month', kind: 'text', width: 14 }, { header: 'Principal', kind: 'money' }, { header: 'Interest', kind: 'money' },
    { header: 'Term (months)', kind: 'int' }, { header: 'Status', kind: 'text' }, { header: 'Sent on', kind: 'date' },
  ], rows);
}

function ledgerSheet(wb: Workbook, d: MemberExport): void {
  const ws = newSheet(wb, 'Ledger');
  const start = writeLines(ws, [`${d.groupName}: ${d.person.full_name}, ledger`, 'Everything recorded for you, oldest first. A correction sits under the entry it fixes; “Now” is what the entry stands at after its corrections.']);
  const periods = new Map(d.periods.map((p) => [p.id, p]));
  const originals = d.entries
    .filter((e) => e.source !== 'correction')
    .sort((a, b) => (periods.get(a.period_id)?.month_index ?? 0) - (periods.get(b.period_id)?.month_index ?? 0) || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  const rows: Cell[][] = originals.flatMap((e) => {
    const fixes = correctionsOf(e.id, d.entries);
    return [
      [periods.get(e.period_id)?.label ?? '', e.source === 'import' ? null : dayCell(e.created_at), kindLabel(e.kind), e.amount, fixes.length > 0 ? effectiveAmount(e, d.entries) : null, e.reason ?? null, sourceLabel(e.source)],
      ...fixes.map((c): Cell[] => [null, dayCell(c.created_at), correctionLine(c), signedAmount(c), null, c.reason ?? null, sourceLabel(c.source)]),
    ];
  });
  const t = writeTable(ws, start, [
    { header: 'Month', kind: 'text', width: 14 }, { header: 'Date', kind: 'date' }, { header: 'What', kind: 'text', width: 26 },
    { header: 'Amount', kind: 'money' }, { header: 'Now', kind: 'money' }, { header: 'Reason', kind: 'text', width: 40 }, { header: 'Source', kind: 'text', width: 14 },
  ], rows, { freeze: true });
  // A correction sits indented under the entry it fixes (an indent, not leading spaces, so the text stays clean).
  rows.forEach((r, i) => {
    if (r[0] === null) ws.getCell(t.first + i, 3).alignment = { indent: 2 };
  });
}

/** One member's own report: their standpoint, month by month, loans and ledger. Nothing about anyone else. */
export async function buildMemberWorkbook(d: MemberExport): Promise<Uint8Array> {
  const { Workbook } = await loadExcel();
  const wb = new Workbook();
  wb.creator = 'Premium Village Banking';
  wb.created = d.generatedOn;
  standpointSheet(wb, d);
  monthsSheet(wb, d);
  loansSheet(wb, d);
  ledgerSheet(wb, d);
  return toBytes(wb);
}
```

- [ ] **Step 4: Run the tests and the gates**

Run: `bun run test src/features/exports && bun run lint && bun run typecheck`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/exports/memberWorkbook.ts src/features/exports/memberWorkbook.test.ts src/features/exports/exportFixtures.ts
git commit -m "feat: build a member's own report

Standpoint (what they have saved, earned, owe, the minimum due, and what the cycle would pay
if it ended today), month by month, loans and a ledger with each correction under the entry
it fixes. A scan of every cell proves nothing about anyone else, and not the default's
reason, can reach the file."
```

---

### Task 7: The loaders and the export actions

**Files:**
- Create: `src/features/exports/testSupabase.ts`, `loaders.ts`, `exportActions.ts`
- Test: `src/features/exports/loaders.test.ts`, `exportActions.test.ts`

**Interfaces:**
- Consumes: Tasks 3–6; `supabase` from `@/lib/supabase`; `currentPeriod` from `@/features/ledger/model`; types `ClosePreview`, `MemberStatusRow` from `@/features/ledger/queries`.
- Produces:
  - `loaders.ts`: `type ExportContext = { groupId: string; groupName: string; cycle: { id: string; label: string }; periods: PeriodRow[] }`; `loadMonthExport(ctx, period: PeriodRow): Promise<MonthExport>`; `loadPeriodExport(ctx): Promise<PeriodExport>`; `loadMemberExport(ctx, memberId: string): Promise<MemberExport>`; `isDeclarationsPending(err: unknown): boolean`
  - `exportActions.ts`: `type ExportResult = { bytes: Uint8Array; fileName: string; note?: string }`; `exportMonth(ctx, period): Promise<ExportResult>`; `exportPeriod(ctx): Promise<ExportResult>`; `exportMember(ctx, memberId): Promise<ExportResult>`
  - `testSupabase.ts` (test-only): `db`, `resetDb(tables?, rpcs?, rowCap?)`, `fakeClient`, `type Call`

- [ ] **Step 1: Write the fake client**

`src/features/exports/testSupabase.ts`:

```ts
// A fake supabase client for the loaders' tests: tables are arrays of rows, filters are applied, requests are recorded.
type Row = Record<string, unknown>;
export type Call = { table: string; select: string; eq: Array<[string, unknown]>; in: Array<[string, unknown[]]>; range: [number, number] | null };
type RpcHandler = (args: Record<string, unknown>) => { data?: unknown; error?: unknown };

export const db = {
  tables: {} as Record<string, Row[]>,
  rpcs: {} as Record<string, RpcHandler>,
  rowCap: 1000,
  failTable: null as string | null,
  calls: [] as Call[],
  rpcCalls: [] as Array<{ name: string; args: Record<string, unknown> }>,
};

export function resetDb(tables: Record<string, Row[]> = {}, rpcs: Record<string, RpcHandler> = {}, rowCap = 1000): void {
  Object.assign(db, { tables, rpcs, rowCap, failTable: null, calls: [], rpcCalls: [] });
}

function project(row: Row, select: string): Row {
  if (select === '*' || select === '') return row;
  const out: Row = {};
  for (const key of select.split(',').map((s) => s.trim())) out[key] = row[key];
  return out;
}

function from(table: string) {
  const call: Call = { table, select: '', eq: [], in: [], range: null };
  db.calls.push(call);
  let one: 'single' | 'maybe' | null = null;
  const run = () => {
    if (db.failTable === table) return { data: null, error: { message: 'boom', code: 'XX000' } };
    let rows = (db.tables[table] ?? []).filter((r) => call.eq.every(([c, v]) => r[c] === v) && call.in.every(([c, v]) => v.includes(r[c])));
    if (call.range) rows = rows.slice(call.range[0], Math.min(call.range[1] + 1, call.range[0] + db.rowCap));
    const data = rows.map((r) => project(r, call.select));
    if (one === 'single') return data[0] ? { data: data[0], error: null } : { data: null, error: { message: 'no rows', code: 'PGRST116' } };
    if (one === 'maybe') return { data: data[0] ?? null, error: null };
    return { data, error: null };
  };
  const q = {
    select(cols: string) { call.select = cols; return q; },
    eq(c: string, v: unknown) { call.eq.push([c, v]); return q; },
    in(c: string, v: unknown[]) { call.in.push([c, v]); return q; },
    order() { return q; },
    range(a: number, b: number) { call.range = [a, b]; return q; },
    single() { one = 'single'; return q; },
    maybeSingle() { one = 'maybe'; return q; },
    then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) { return Promise.resolve(run()).then(resolve, reject); },
  };
  return q;
}

export const fakeClient = {
  from,
  rpc(name: string, args: Record<string, unknown>) {
    db.rpcCalls.push({ name, args });
    const handler = db.rpcs[name];
    const out = handler ? handler(args) : { data: null, error: { message: `no handler for ${name}` } };
    return Promise.resolve({ data: out.data ?? null, error: out.error ?? null });
  },
};
```

- [ ] **Step 2: Write the failing loader tests**

`src/features/exports/loaders.test.ts`:

```ts
import { beforeEach, expect, test, vi } from 'vitest';
import { closeMember, entry, loan, memberStatus, statement, year } from '@/features/ledger/testFixtures';
import { PAYOUT } from './exportFixtures';
import { db, resetDb } from './testSupabase';

vi.mock('@/lib/supabase', async () => ({ supabase: (await import('./testSupabase')).fakeClient }));
const { isDeclarationsPending, loadMemberExport, loadMonthExport, loadPeriodExport } = await import('./loaders');

const periods = year(3, 'open'); // Feb, Mar, Apr closed (p1..p3); May open (p4)
const ctx = { groupId: 'g1', groupName: 'Test Group', cycle: { id: 'c1', label: 'Cycle 2026' }, periods };
const PEOPLE_ROWS = [
  { id: 'm1', short_name: 'Eve', full_name: 'Eve Example', status: 'active', email: 'eve@example.test', phone: '0000', user_id: 'u1', group_id: 'g1' },
  { id: 'm2', short_name: 'Ann', full_name: 'Ann Example', status: 'active', email: 'ann@example.test', phone: '0001', user_id: 'u2', group_id: 'g1' },
  { id: 'm9', short_name: 'Zed', full_name: 'Zed Sentinel', status: 'active', email: 'zed@example.test', phone: '0009', user_id: 'u9', group_id: 'g1' },
];
const groupStatement = (period_id: string, o: Record<string, unknown> = {}) => ({
  id: `gs-${period_id}`, group_id: 'g1', period_id, source: 'close', created_at: 'x', opening_cash: 5000, received: 900, savings: 850, loans_sent: 0,
  idle_cash: 5000, excess_rate: 0.1, excess_billed: 500, interest_collected: 0, fee_pot_in: 0, fee_pot_out: 0, fee_pot_balance: 10,
  meeting_pot_in: 0, meeting_pot_balance: 90, total_savings: 850, total_owed: 0, ...o,
});
const previewJson = {
  period_id: 'p4', label: 'May 2026', month_index: 4, committed: false,
  group: groupStatement('p4'),
  members: [closeMember({ member_id: 'm1', short_name: 'Eve', cum_savings: 1000 }), closeMember({ member_id: 'm9', short_name: 'Zed', cum_savings: 777777.77 })],
  diff: [], unexplained: 0,
};

beforeEach(() => {
  resetDb(
    {
      members: PEOPLE_ROWS,
      periods: [{ id: 'p1', closed_at: '2026-03-07T10:00:00Z' }, { id: 'p2', closed_at: '2026-04-07T10:00:00Z' }, { id: 'p3', closed_at: '2026-05-07T10:00:00Z' }],
      statements: [
        statement({ id: 's1', period_id: 'p1', member_id: 'm1', next_minimum: 300 }), statement({ id: 's2', period_id: 'p2', member_id: 'm1' }),
        statement({ id: 's3', period_id: 'p1', member_id: 'm9', saving: 777777.77 }), statement({ id: 's4', period_id: 'p2', member_id: 'm9' }),
        statement({ id: 's5', period_id: 'p3', member_id: 'm1' }), statement({ id: 's6', period_id: 'p3', member_id: 'm9', saving: 777777.77 }),
      ],
      group_statements: [groupStatement('p1'), groupStatement('p2'), groupStatement('p3')],
      entries: [],
      loans: [loan({ id: 'l1', member_id: 'm1', period_id: 'p1' }), loan({ id: 'l9', member_id: 'm9', period_id: 'p1', principal: 777777.77 })],
      member_status: [memberStatus({ member_id: 'm1', cycle_id: 'c1', defaulted: false }), memberStatus({ id: 'ms9', member_id: 'm9', cycle_id: 'c1', defaulted: true, reason: 'Zed’s secret reason' })],
    },
    {
      close_month: () => ({ data: previewJson }),
      payout_preview: () => ({ data: [...PAYOUT.filter((p) => p.member_id === 'm1'), { member_id: 'm9', short_name: 'Zed', savings: 777777.77, interest_earned: 0, owed: 0, pot_share: 0, payout: 777777.77 }] }),
    },
  );
});

const callsTo = (table: string) => db.calls.filter((c) => c.table === table);

// ----- the month ------------------------------------------------------------------------------------------------------

test('a closed month is read from its statements and never previewed', async () => {
  const d = await loadMonthExport(ctx, periods[1]!);
  expect(d.figures.preview).toBe(false);
  expect(d.figures.closedOn).toBe('2026-04-07T10:00:00Z');
  expect(d.figures.members.map((m) => m.member_id).sort()).toEqual(['m1', 'm9']);
  expect(db.rpcCalls.map((c) => c.name)).not.toContain('close_month');
  expect(d.minimumDue).toEqual({ m1: 300, m9: 0 });
});

test('the open month is the engine’s preview, asked for without committing', async () => {
  const d = await loadMonthExport(ctx, periods[3]!);
  expect(d.figures.preview).toBe(true);
  expect(d.figures.closedOn).toBeNull();
  expect(db.rpcCalls.find((c) => c.name === 'close_month')!.args).toEqual({ p_period: 'p4', p_commit: false });
  expect(d.figures.members.find((m) => m.member_id === 'm1')!.cum_savings).toBe(1000);
  expect(d.figures.members[0]).not.toHaveProperty('short_name');
});

test('people are read with the four columns the files need and nothing else', async () => {
  const d = await loadMonthExport(ctx, periods[1]!);
  expect(new Set(callsTo('members').map((c) => c.select))).toEqual(new Set(['id, short_name, full_name, status']));
  expect(JSON.stringify(d)).not.toContain('example.test');
  expect(JSON.stringify(d)).not.toContain('"user_id"');
});

test('a month with 2,500 entries returns every one of them', async () => {
  db.tables.entries = Array.from({ length: 2500 }, (_, i) => entry({ id: `e${String(i).padStart(4, '0')}`, period_id: 'p2', member_id: 'm1' }));
  const d = await loadMonthExport(ctx, periods[1]!);
  expect(d.entries).toHaveLength(2500);
  expect(callsTo('entries').map((c) => c.range)).toEqual([[0, 999], [1000, 1999], [2000, 2999], [2500, 3499]]);
});

test('the earlier entries a month’s corrections point at are fetched in chunks of 100', async () => {
  db.tables.entries = [
    ...Array.from({ length: 250 }, (_, i) => entry({ id: `o${i}`, period_id: 'p1', member_id: 'm1', kind: 'txn_fee' })),
    ...Array.from({ length: 250 }, (_, i) => entry({ id: `c${i}`, period_id: 'p2', member_id: 'm1', kind: 'adjustment', source: 'correction', corrects_entry_id: `o${i}`, reason: 'x' })),
  ];
  const d = await loadMonthExport(ctx, periods[1]!);
  expect(d.entries).toHaveLength(250);
  expect(d.originals).toHaveLength(250);
  const byId = callsTo('entries').filter((c) => c.in.length > 0);
  expect(byId.map((c) => c.in[0]![1].length)).toEqual([100, 100, 50]);
});

test('a failed read is thrown, not turned into an empty file', async () => {
  db.failTable = 'statements';
  await expect(loadMonthExport(ctx, periods[1]!)).rejects.toMatchObject({ message: 'boom' });
});

// ----- the whole period -----------------------------------------------------------------------------------------------

test('the whole period is the closed months, then the open month as a preview', async () => {
  const d = await loadPeriodExport(ctx);
  expect(d.months.map((m) => [m.period.label, m.preview])).toEqual([['Feb 2026', false], ['Mar 2026', false], ['Apr 2026', false], ['May 2026', true]]);
  expect(d.openLeftOut).toBeNull();
  expect(d.payoutAsAt).toBe('May 2026');
  expect(d.statuses).toHaveLength(2);
  expect(d.loans).toHaveLength(2);
  expect(db.rpcCalls.filter((c) => c.name === 'close_month')).toHaveLength(1);
});

test('when the preview is refused only because declarations are waiting, the closed months still export and the month is named', async () => {
  db.rpcs.close_month = () => ({ error: { message: 'declarations_pending', code: 'P0001' } });
  const d = await loadPeriodExport(ctx);
  expect(d.months.map((m) => m.preview)).toEqual([false, false, false]);
  expect(d.openLeftOut?.label).toBe('May 2026');
});

test('any other preview failure stops the export', async () => {
  db.rpcs.close_month = () => ({ error: { message: 'JWT expired', code: 'PGRST301' } });
  await expect(loadPeriodExport(ctx)).rejects.toMatchObject({ code: 'PGRST301' });
});

test('with no open month there is no preview call', async () => {
  const closedOnly = { ...ctx, periods: year(8) };
  db.tables.periods = closedOnly.periods.map((p) => ({ id: p.id, closed_at: '2026-10-01T00:00:00Z' }));
  db.tables.group_statements = closedOnly.periods.filter((p) => p.status === 'closed').map((p) => groupStatement(p.id));
  const d = await loadPeriodExport(closedOnly);
  expect(db.rpcCalls.map((c) => c.name)).not.toContain('close_month');
  expect(d.months).toHaveLength(8);
  expect(d.payoutAsAt).toBe('Sep 2026');
});

test('isDeclarationsPending recognises only that refusal', () => {
  expect(isDeclarationsPending({ message: 'declarations_pending' })).toBe(true);
  expect(isDeclarationsPending({ message: 'period_not_open' })).toBe(false);
  expect(isDeclarationsPending(null)).toBe(false);
  expect(isDeclarationsPending('declarations_pending')).toBe(false);
});

// ----- one member -----------------------------------------------------------------------------------------------------

test('a member’s export holds that member alone: no other row, name, amount or reason is in what the loader returns', async () => {
  db.tables.entries = [entry({ id: 'e1', member_id: 'm1', period_id: 'p1' }), entry({ id: 'e9', member_id: 'm9', period_id: 'p1', amount: 777777.77 })];
  const d = await loadMemberExport(ctx, 'm1');
  const json = JSON.stringify(d);
  for (const leak of ['m9', 'Zed', '777777', 'secret reason', 'example.test']) expect(json).not.toContain(leak);
  expect(d.person).toEqual({ id: 'm1', short_name: 'Eve', full_name: 'Eve Example', status: 'active' });
  expect(d.months.map((m) => [m.period.label, m.preview])).toEqual([['Feb 2026', false], ['Mar 2026', false], ['Apr 2026', false], ['May 2026', true]]);
  expect(d.months.at(-1)!.row.cum_savings).toBe(1000);
  expect(d.payout?.member_id).toBe('m1');
  expect(d.status?.member_id).toBe('m1');
  expect(d.loans.map((l) => l.id)).toEqual(['l1']);
  expect(d.entries.map((e) => e.id)).toEqual(['e1']);
});

test('a member’s export leaves out the open month when its preview is refused, and says which', async () => {
  db.rpcs.close_month = () => ({ error: { message: 'declarations_pending' } });
  const d = await loadMemberExport(ctx, 'm1');
  expect(d.months.map((m) => m.preview)).toEqual([false, false, false]);
  expect(d.openLeftOut?.label).toBe('May 2026');
});

test('entries of another cycle are not in a member’s export', async () => {
  db.tables.entries = [entry({ id: 'in', member_id: 'm1', period_id: 'p2' }), entry({ id: 'out', member_id: 'm1', period_id: 'other-cycle-period' })];
  expect((await loadMemberExport(ctx, 'm1')).entries.map((e) => e.id)).toEqual(['in']);
});

test('a member who is not in the group is an error, not an empty report', async () => {
  await expect(loadMemberExport(ctx, 'nobody')).rejects.toMatchObject({ code: 'PGRST116' });
});
```

`src/features/exports/exportActions.test.ts`:

```ts
// @vitest-environment node
import { beforeEach, expect, test, vi } from 'vitest';
import { MONTHS, memberExport, monthExport, periodExport, PERIODS, readBack } from './exportFixtures';

const loaders = vi.hoisted(() => ({ loadMonthExport: vi.fn(), loadPeriodExport: vi.fn(), loadMemberExport: vi.fn() }));
vi.mock('./loaders', () => loaders);
const { exportMember, exportMonth, exportPeriod } = await import('./exportActions');

const ctx = { groupId: 'g1', groupName: 'Premium VB', cycle: { id: 'c1', label: 'Cycle 2026' }, periods: PERIODS };
beforeEach(() => vi.resetAllMocks());

test('a closed month is a workbook named after the group and the month', async () => {
  loaders.loadMonthExport.mockResolvedValue(monthExport(1));
  const r = await exportMonth(ctx, PERIODS[1]!);
  expect(r.fileName).toBe('Premium VB Mar 2026.xlsx');
  expect((await readBack(r.bytes)).worksheets.map((w) => w.name)).toEqual(['Members', 'Group', 'Entries']);
  expect(r.note).toBeUndefined();
});

test('the open month’s file is named as a preview', async () => {
  loaders.loadMonthExport.mockResolvedValue(monthExport(3));
  expect((await exportMonth(ctx, PERIODS[3]!)).fileName).toBe('Premium VB May 2026 (preview).xlsx');
});

test('the whole period is named after the cycle and the last month, and a left-out month is reported as a note', async () => {
  loaders.loadPeriodExport.mockResolvedValue(periodExport());
  expect((await exportPeriod(ctx)).fileName).toBe('Premium VB Cycle 2026 through May 2026 (preview).xlsx');
  loaders.loadPeriodExport.mockResolvedValue(periodExport({ months: MONTHS.slice(0, 3), openLeftOut: PERIODS[3]! }));
  const r = await exportPeriod(ctx);
  expect(r.fileName).toBe('Premium VB Cycle 2026 through Apr 2026.xlsx');
  expect(r.note).toBe('May 2026 is left out: declarations are still waiting.');
});

test('a period with nothing in it is refused rather than downloaded empty', async () => {
  loaders.loadPeriodExport.mockResolvedValue(periodExport({ months: [] }));
  await expect(exportPeriod(ctx)).rejects.toThrow('nothing_to_export');
});

test('a member’s report is named after the member', async () => {
  loaders.loadMemberExport.mockResolvedValue(memberExport());
  const r = await exportMember(ctx, 'm3');
  expect(r.fileName).toBe('Premium VB Bob Cycle 2026 through May 2026 (preview).xlsx');
  expect(loaders.loadMemberExport).toHaveBeenCalledWith(ctx, 'm3');
});

test('a failed load downloads nothing', async () => {
  loaders.loadMonthExport.mockRejectedValue({ message: 'declarations_pending' });
  await expect(exportMonth(ctx, PERIODS[3]!)).rejects.toMatchObject({ message: 'declarations_pending' });
});
```

Run: `bun run test src/features/exports/loaders.test.ts src/features/exports/exportActions.test.ts`. Expected: FAIL (modules missing).

- [ ] **Step 3: Implement `loaders.ts`**

```ts
import type { EntryRow, LoanRow, PayoutRow, StatementRow } from '@/features/ledger/memberViews';
import { currentPeriod, type PeriodRow } from '@/features/ledger/model';
import type { ClosePreview, MemberStatusRow } from '@/features/ledger/queries';
import type { Tables } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import { groupFigures, memberMonth } from './normalise';
import { chunk, fetchAllRows } from './paging';
import type { MemberExport, MemberMonthEntry, MonthExport, MonthFigures, PeriodExport, Person } from './types';

export type ExportContext = { groupId: string; groupName: string; cycle: { id: string; label: string }; periods: PeriodRow[] };

const PEOPLE_COLUMNS = 'id, short_name, full_name, status';
const byMonth = (a: PeriodRow, b: PeriodRow) => a.month_index - b.month_index;

// ----- reads ------------------------------------------------------------------------------------------------------------

const readPeople = (groupId: string): Promise<Person[]> =>
  fetchAllRows<Person>((a, b) => supabase.from('members').select(PEOPLE_COLUMNS).eq('group_id', groupId).order('short_name').order('id').range(a, b));

function readStatements(periodIds: string[], memberId?: string): Promise<StatementRow[]> {
  if (periodIds.length === 0) return Promise.resolve([]);
  return fetchAllRows<StatementRow>((a, b) => {
    let q = supabase.from('statements').select('*').in('period_id', periodIds);
    if (memberId) q = q.eq('member_id', memberId);
    return q.order('created_at').order('id').range(a, b);
  });
}

function readGroupStatements(periodIds: string[]): Promise<Tables<'group_statements'>[]> {
  if (periodIds.length === 0) return Promise.resolve([]);
  return fetchAllRows((a, b) => supabase.from('group_statements').select('*').in('period_id', periodIds).order('created_at').order('id').range(a, b));
}

async function readClosedAt(periodIds: string[]): Promise<Map<string, string | null>> {
  if (periodIds.length === 0) return new Map();
  const rows = await fetchAllRows<{ id: string; closed_at: string | null }>((a, b) => supabase.from('periods').select('id, closed_at').in('id', periodIds).order('id').range(a, b));
  return new Map(rows.map((r) => [r.id, r.closed_at]));
}

const readPeriodEntries = (periodId: string): Promise<EntryRow[]> =>
  fetchAllRows<EntryRow>((a, b) => supabase.from('entries').select('*').eq('period_id', periodId).order('created_at').order('id').range(a, b));

const readMemberEntries = (memberId: string): Promise<EntryRow[]> =>
  fetchAllRows<EntryRow>((a, b) => supabase.from('entries').select('*').eq('member_id', memberId).order('created_at').order('id').range(a, b));

/** The entries a month's corrections point at that are not in the month itself, a hundred ids a request so the URL stays short. */
async function readOriginals(entries: EntryRow[]): Promise<EntryRow[]> {
  const have = new Set(entries.map((e) => e.id));
  const missing = [...new Set(entries.flatMap((e) => (e.corrects_entry_id && !have.has(e.corrects_entry_id) ? [e.corrects_entry_id] : [])))];
  const found: EntryRow[] = [];
  for (const ids of chunk(missing, 100)) {
    const { data, error } = await supabase.from('entries').select('*').in('id', ids);
    if (error) throw error;
    found.push(...data);
  }
  return found;
}

const readLoans = (periodIds: string[], memberId?: string): Promise<LoanRow[]> =>
  fetchAllRows<LoanRow>((a, b) => {
    let q = supabase.from('loans').select('*').in('period_id', periodIds);
    if (memberId) q = q.eq('member_id', memberId);
    return q.order('sent_at').order('id').range(a, b);
  });

const readStatuses = (cycleId: string): Promise<MemberStatusRow[]> =>
  fetchAllRows<MemberStatusRow>((a, b) => supabase.from('member_status').select('*').eq('cycle_id', cycleId).order('id').range(a, b));

async function readPayout(cycleId: string): Promise<PayoutRow[]> {
  const { data, error } = await supabase.rpc('payout_preview', { p_cycle: cycleId });
  if (error) throw error;
  return data;
}

// ----- the open month's preview ------------------------------------------------------------------------------------------

/** The engine refuses a preview only for waiting declarations when this is the message (the code is the message, as friendlyError relies on). */
export const isDeclarationsPending = (err: unknown): boolean =>
  typeof err === 'object' && err !== null && (err as { message?: unknown }).message === 'declarations_pending';

async function readPreview(period: PeriodRow): Promise<ClosePreview> {
  const { data, error } = await supabase.rpc('close_month', { p_period: period.id, p_commit: false });
  if (error) throw error;
  return data as unknown as ClosePreview;
}

/** The open month's preview, or the month named as left out when the engine refuses only because declarations are waiting. Any other failure is thrown. */
async function previewOrLeftOut(open: PeriodRow | null): Promise<{ preview: ClosePreview | null; leftOut: PeriodRow | null }> {
  if (!open) return { preview: null, leftOut: null };
  try {
    return { preview: await readPreview(open), leftOut: null };
  } catch (err) {
    if (isDeclarationsPending(err)) return { preview: null, leftOut: open };
    throw err;
  }
}

const previewFigures = (open: PeriodRow, p: ClosePreview): MonthFigures => ({
  period: open, closedOn: null, preview: true, group: groupFigures(p.group), members: p.members.map((m) => memberMonth(m)),
});

/** The label of the month the payout preview is worked from: the open month, else the last closed one. */
const payoutLabel = (periods: PeriodRow[]): string | null => (currentPeriod(periods) ?? periods.filter((p) => p.status === 'closed').sort(byMonth).at(-1))?.label ?? null;

// ----- the three loaders -------------------------------------------------------------------------------------------------

async function closedMonth(period: PeriodRow): Promise<MonthFigures> {
  const [statements, groups, closedAt] = await Promise.all([readStatements([period.id]), readGroupStatements([period.id]), readClosedAt([period.id])]);
  const g = groups[0];
  if (!g) throw new Error('no_group_statement');
  return { period, closedOn: closedAt.get(period.id) ?? null, preview: false, group: groupFigures(g), members: statements.map((s) => memberMonth(s)) };
}

export async function loadMonthExport(ctx: ExportContext, period: PeriodRow): Promise<MonthExport> {
  if (period.status !== 'closed' && period.status !== 'open') throw new Error('not_exportable');
  const previous = ctx.periods.find((p) => p.month_index === period.month_index - 1 && p.status === 'closed');
  const [figures, prior, entries, people] = await Promise.all([
    period.status === 'open' ? readPreview(period).then((p) => previewFigures(period, p)) : closedMonth(period),
    previous ? readStatements([previous.id]) : Promise.resolve([] as StatementRow[]),
    readPeriodEntries(period.id),
    readPeople(ctx.groupId),
  ]);
  const originals = await readOriginals(entries);
  return {
    groupName: ctx.groupName, cycleLabel: ctx.cycle.label, generatedOn: new Date(), figures,
    minimumDue: Object.fromEntries(prior.map((s) => [s.member_id, Number(s.next_minimum)])),
    people, periods: ctx.periods, entries, originals,
  };
}

export async function loadPeriodExport(ctx: ExportContext): Promise<PeriodExport> {
  const closed = ctx.periods.filter((p) => p.status === 'closed').sort(byMonth);
  const open = currentPeriod(ctx.periods);
  const closedIds = closed.map((p) => p.id);
  const [statements, groups, closedAt, people, loans, statuses, payout, pv] = await Promise.all([
    readStatements(closedIds), readGroupStatements(closedIds), readClosedAt(closedIds), readPeople(ctx.groupId),
    readLoans(ctx.periods.map((p) => p.id)), readStatuses(ctx.cycle.id), readPayout(ctx.cycle.id), previewOrLeftOut(open),
  ]);
  const months: MonthFigures[] = closed.map((period) => {
    const g = groups.find((x) => x.period_id === period.id);
    if (!g) throw new Error('no_group_statement');
    return {
      period, closedOn: closedAt.get(period.id) ?? null, preview: false, group: groupFigures(g),
      members: statements.filter((s) => s.period_id === period.id).map((s) => memberMonth(s)),
    };
  });
  if (open && pv.preview) months.push(previewFigures(open, pv.preview));
  return {
    groupName: ctx.groupName, cycleLabel: ctx.cycle.label, generatedOn: new Date(), months, openLeftOut: pv.leftOut,
    payoutAsAt: payoutLabel(ctx.periods), people, periods: ctx.periods, loans, statuses, payout,
  };
}

/** One member's data only: every read is filtered to the member, and the preview and payout lists are cut down to their row before anything is returned. */
export async function loadMemberExport(ctx: ExportContext, memberId: string): Promise<MemberExport> {
  const closed = ctx.periods.filter((p) => p.status === 'closed').sort(byMonth);
  const open = currentPeriod(ctx.periods);
  const cyclePeriodIds = new Set(ctx.periods.map((p) => p.id));
  const [person, statements, closedAt, entries, loans, status, payout, pv] = await Promise.all([
    supabase.from('members').select(PEOPLE_COLUMNS).eq('id', memberId).eq('group_id', ctx.groupId).single(),
    readStatements(closed.map((p) => p.id), memberId),
    readClosedAt(closed.map((p) => p.id)),
    readMemberEntries(memberId),
    readLoans(ctx.periods.map((p) => p.id), memberId),
    supabase.from('member_status').select('*').eq('cycle_id', ctx.cycle.id).eq('member_id', memberId).maybeSingle(),
    readPayout(ctx.cycle.id),
    previewOrLeftOut(open),
  ]);
  if (person.error) throw person.error;
  if (status.error) throw status.error;
  const months: MemberMonthEntry[] = closed.flatMap((period) => {
    const s = statements.find((x) => x.period_id === period.id);
    return s ? [{ period, closedOn: closedAt.get(period.id) ?? null, preview: false, row: memberMonth(s) }] : [];
  });
  const mine = pv.preview?.members.find((m) => m.member_id === memberId);
  if (open && mine) months.push({ period: open, closedOn: null, preview: true, row: memberMonth(mine) });
  return {
    groupName: ctx.groupName, cycleLabel: ctx.cycle.label, generatedOn: new Date(), person: person.data, months, openLeftOut: pv.leftOut,
    payoutAsAt: payoutLabel(ctx.periods), periods: ctx.periods, loans,
    status: status.data, payout: payout.find((p) => p.member_id === memberId) ?? null,
    entries: entries.filter((e) => cyclePeriodIds.has(e.period_id)),
  };
}
```

- [ ] **Step 4: Implement `exportActions.ts`**

```ts
import type { PeriodRow } from '@/features/ledger/model';
import { xlsxName } from './fileName';
import { loadMemberExport, loadMonthExport, loadPeriodExport, type ExportContext } from './loaders';
import { buildMemberWorkbook } from './memberWorkbook';
import { buildMonthWorkbook } from './monthWorkbook';
import { buildPeriodWorkbook } from './periodWorkbook';

export type { ExportContext } from './loaders';
export type ExportResult = { bytes: Uint8Array; fileName: string; note?: string };

const through = (last: { period: PeriodRow; preview: boolean } | undefined): string[] =>
  last ? ['through', last.period.label, last.preview ? '(preview)' : ''] : [];

/** One month: load, build, name. Throws what the loader throws (the page shows it through friendlyError). */
export async function exportMonth(ctx: ExportContext, period: PeriodRow): Promise<ExportResult> {
  const data = await loadMonthExport(ctx, period);
  const bytes = await buildMonthWorkbook(data);
  return { bytes, fileName: xlsxName(ctx.groupName, period.label, data.figures.preview ? '(preview)' : '') };
}

/** The whole period. A month left out because its preview was refused is reported as a note for the toast. */
export async function exportPeriod(ctx: ExportContext): Promise<ExportResult> {
  const data = await loadPeriodExport(ctx);
  if (data.months.length === 0) throw new Error('nothing_to_export');
  const bytes = await buildPeriodWorkbook(data);
  return {
    bytes,
    fileName: xlsxName(ctx.groupName, ctx.cycle.label, ...through(data.months.at(-1))),
    note: data.openLeftOut ? `${data.openLeftOut.label} is left out: declarations are still waiting.` : undefined,
  };
}

export async function exportMember(ctx: ExportContext, memberId: string): Promise<ExportResult> {
  const data = await loadMemberExport(ctx, memberId);
  const bytes = await buildMemberWorkbook(data);
  return {
    bytes,
    fileName: xlsxName(ctx.groupName, data.person.short_name, ctx.cycle.label, ...through(data.months.at(-1))),
    note: data.openLeftOut ? `${data.openLeftOut.label} is left out: declarations are still waiting.` : undefined,
  };
}
```

- [ ] **Step 5: Run the tests and the gates**

Run: `bun run test src/features/exports && bun run lint && bun run typecheck`. Expected: PASS.

If typecheck complains about the supabase builder types inside `fetchAllRows` (for example `q` reassigned after `.in()`), declare `let q = supabase.from(...).select('*').in(...)` once and reassign with `q = q.eq(...)` as written; the generic builder type is preserved by `.eq`. If `loadMemberExport`'s `person.data` is typed with nullable columns, adjust `Person` only if the generated `members` row type differs, never by loosening the builders.

- [ ] **Step 6: Commit**

```bash
git add src/features/exports/testSupabase.ts src/features/exports/loaders.ts src/features/exports/loaders.test.ts src/features/exports/exportActions.ts src/features/exports/exportActions.test.ts
git commit -m "feat: load the ledger for the exports

On-demand reads, never cached: paged so a full cycle is not cut at 1,000 rows, narrow member
columns, the open month through the engine's non-committing preview. If the preview is
refused only because declarations are waiting, the whole-period and member files are made
without it. A member's export is filtered at every read and cut down to their row, with a
test that nothing of another member survives."
```

---

### Task 8: The download, the runner and the Reports page

**Files:**
- Create: `src/features/exports/download.ts`, `useExportRunner.ts`, `src/features/desk/ReportsPage.tsx`
- Modify: `src/app/router.tsx`
- Test: `src/features/exports/download.test.ts`, `src/features/desk/ReportsPage.test.tsx`

**Interfaces:**
- Consumes: `exportMonth`, `exportPeriod`, `exportMember`, `ExportContext`, `ExportResult` (Task 7); `friendlyError`; `useToast`.
- Produces: `downloadBytes(bytes: Uint8Array, fileName: string): void`; `useExportRunner(): { busy: string | null; run: (key: string, job: () => Promise<ExportResult>) => Promise<void> }`; `ReportsPage`; route `desk/reports`.

- [ ] **Step 1: Write the failing tests**

`src/features/exports/download.test.ts`:

```ts
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { downloadBytes } from './download';

beforeEach(() => {
  vi.useFakeTimers();
  URL.createObjectURL = vi.fn(() => 'blob:fake');
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => vi.useRealTimers());

test('hands the bytes to the browser as a named .xlsx download and releases the URL afterwards', () => {
  const clicked: Array<{ href: string; download: string }> = [];
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    clicked.push({ href: this.href, download: this.download });
  });
  downloadBytes(new Uint8Array([1, 2, 3]), 'Premium VB Mar 2026.xlsx');
  expect(click).toHaveBeenCalledTimes(1);
  expect(clicked).toEqual([{ href: 'blob:fake', download: 'Premium VB Mar 2026.xlsx' }]);
  const blob = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls[0]![0] as Blob;
  expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  expect(blob.size).toBe(3);
  expect(document.querySelector('a[download]')).toBeNull();
  expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  vi.advanceTimersByTime(10_000);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake');
  click.mockRestore();
});
```

`src/features/desk/ReportsPage.test.tsx`:

```tsx
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { renderLedger, year } from '@/features/ledger/testFixtures';

const hooks = vi.hoisted(() => ({ cycle: vi.fn(), members: vi.fn() }));
const actions = vi.hoisted(() => ({ exportMonth: vi.fn(), exportPeriod: vi.fn(), exportMember: vi.fn() }));
const download = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: vi.fn() } }));
vi.mock('@/features/group/GroupPage', () => ({ useGroupMembers: () => hooks.members() }));
vi.mock('@/features/ledger/queries', async (orig) => ({ ...(await orig<typeof import('@/features/ledger/queries')>()), useLedgerCycle: () => hooks.cycle() }));
vi.mock('@/features/exports/exportActions', () => actions);
vi.mock('@/features/exports/download', () => ({ downloadBytes: download }));
const { ReportsPage } = await import('./ReportsPage');

const ok = <T,>(data: T) => ({ data, isPending: false, isError: false, error: null, refetch: vi.fn() });
const CYCLE = { id: 'c1', label: 'Cycle 2026' };
const ROWS = [
  { id: 'm1', short_name: 'Eve', full_name: 'Eve Example', status: 'active' },
  { id: 'm2', short_name: 'Ann', full_name: 'Ann Example', status: 'active' },
  { id: 'm3', short_name: 'Old', full_name: 'Old Example', status: 'left' },
];
const result = (fileName: string, note?: string) => ({ bytes: new Uint8Array([1]), fileName, note });
const renderPage = (isAdmin = true) => renderLedger(<ReportsPage />, { isAdmin });

beforeEach(() => {
  Object.values(actions).forEach((f) => f.mockReset());
  download.mockReset();
  hooks.cycle.mockReturnValue(ok({ cycle: CYCLE, periods: year(3, 'open') })); // Feb, Mar, Apr closed; May open
  hooks.members.mockReturnValue(ok(ROWS));
  actions.exportMonth.mockResolvedValue(result('Test Group Apr 2026.xlsx'));
  actions.exportPeriod.mockResolvedValue(result('Test Group Cycle 2026 through May 2026 (preview).xlsx'));
  actions.exportMember.mockResolvedValue(result('Test Group Ann Cycle 2026 through May 2026 (preview).xlsx'));
});

test('members get the admins-only screen and no request is made', () => {
  renderPage(false);
  expect(screen.getByText('This page is for admins')).toBeInTheDocument();
  expect(hooks.cycle).not.toHaveBeenCalled();
});

test('loading, then an error with a way to retry', () => {
  hooks.cycle.mockReturnValue({ data: undefined, isPending: true, isError: false, error: null, refetch: vi.fn() });
  const { unmount } = renderPage();
  expect(screen.getByText('Loading the reports')).toBeInTheDocument();
  unmount();
  const refetch = vi.fn();
  hooks.cycle.mockReturnValue({ data: undefined, isPending: false, isError: true, error: { message: 'x', code: 'PGRST301' }, refetch });
  renderPage();
  expect(screen.getByText('Your session has expired. Please sign in again.')).toBeInTheDocument();
});

test('it warns that the files hold members’ figures', () => {
  renderPage();
  expect(screen.getByText(/These files contain members’ figures\. Send a member only their own report\./)).toBeInTheDocument();
});

test('the month list is newest first, the open month marked as a preview, and the latest closed month is chosen', () => {
  renderPage();
  const select = screen.getByLabelText('Month') as HTMLSelectElement;
  expect([...select.options].map((o) => o.text)).toEqual(['May 2026 (preview)', 'Apr 2026', 'Mar 2026', 'Feb 2026']);
  expect(select.value).toBe('p3');
  expect(screen.getByRole('button', { name: 'Download Apr 2026 workbook' })).toBeEnabled();
});

test('downloading a month loads it once and hands the file to the browser', async () => {
  renderPage();
  await userEvent.click(screen.getByRole('button', { name: 'Download Apr 2026 workbook' }));
  await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
  expect(actions.exportMonth).toHaveBeenCalledTimes(1);
  expect(actions.exportMonth.mock.calls[0]![0]).toMatchObject({ groupId: 'g1', groupName: 'Test Group', cycle: CYCLE });
  expect(actions.exportMonth.mock.calls[0]![1]).toMatchObject({ id: 'p3', label: 'Apr 2026' });
  expect(download).toHaveBeenCalledWith(expect.any(Uint8Array), 'Test Group Apr 2026.xlsx');
  expect(await screen.findByText('Test Group Apr 2026.xlsx downloaded.')).toBeInTheDocument();
});

test('choosing the preview names it on the button', async () => {
  renderPage();
  await userEvent.selectOptions(screen.getByLabelText('Month'), 'p4');
  await userEvent.click(screen.getByRole('button', { name: 'Download May 2026 (preview) workbook' }));
  expect(actions.exportMonth.mock.calls[0]![1]).toMatchObject({ id: 'p4' });
});

test('the whole-period file says what it covers, and a left-out month is mentioned in the toast', async () => {
  actions.exportPeriod.mockResolvedValue(result('Test Group Cycle 2026 through Apr 2026.xlsx', 'May 2026 is left out: declarations are still waiting.'));
  renderPage();
  expect(screen.getByText('Covers closed months through Apr 2026, plus May 2026 as a preview.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Download the whole-period workbook' }));
  expect(await screen.findByText(/downloaded\. May 2026 is left out: declarations are still waiting\./)).toBeInTheDocument();
});

test('a member’s report: active members only, alphabetical, and the button names them', async () => {
  renderPage();
  const select = screen.getByLabelText('Member') as HTMLSelectElement;
  expect([...select.options].map((o) => o.text)).toEqual(['Ann', 'Eve']);
  await userEvent.click(screen.getByRole('button', { name: 'Download Ann’s report' }));
  await waitFor(() => expect(actions.exportMember).toHaveBeenCalledTimes(1));
  expect(actions.exportMember.mock.calls[0]![1]).toBe('m2');
  await waitFor(() => expect(select).toBeEnabled());
  await userEvent.selectOptions(select, 'm1');
  expect(screen.getByRole('button', { name: 'Download Eve’s report' })).toBeInTheDocument();
});

test('a refused load shows the friendly sentence, downloads nothing and leaves the buttons usable', async () => {
  actions.exportMonth.mockRejectedValue({ message: 'declarations_pending', code: 'P0001' });
  renderPage();
  await userEvent.click(screen.getByRole('button', { name: 'Download Apr 2026 workbook' }));
  expect(await screen.findByText('Some declarations are still waiting. Approve or return them first.')).toBeInTheDocument();
  expect(download).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Download Apr 2026 workbook' })).toBeEnabled();
});

test('while one export runs every button is disabled and a second press makes no second file', async () => {
  let release: (v: ReturnType<typeof result>) => void = () => {};
  actions.exportMonth.mockReturnValue(new Promise((resolve) => { release = resolve; }));
  renderPage();
  const month = screen.getByRole('button', { name: 'Download Apr 2026 workbook' });
  await userEvent.click(month);
  await userEvent.click(month);
  expect(actions.exportMonth).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Download the whole-period workbook' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Download Ann’s report' })).toBeDisabled();
  expect(within(screen.getByRole('button', { name: /Preparing/ })).getByText('Preparing…')).toBeInTheDocument();
  release(result('Test Group Apr 2026.xlsx'));
  await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Download the whole-period workbook' })).toBeEnabled());
});

test('with no month opened yet there is nothing to export', () => {
  hooks.cycle.mockReturnValue(ok({ cycle: CYCLE, periods: year(0) }));
  renderPage();
  expect(screen.getByText('Nothing to export yet.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Download/ })).toBeNull();
});

test('with only the open month the whole-period file is just the preview', () => {
  hooks.cycle.mockReturnValue(ok({ cycle: CYCLE, periods: year(0, 'open') }));
  renderPage();
  expect(screen.getByText('Covers Feb 2026 as a preview.')).toBeInTheDocument();
});

test('a group with no active cycle says so', () => {
  hooks.cycle.mockReturnValue(ok({ cycle: null, periods: [] }));
  renderPage();
  expect(screen.getByText('No active cycle')).toBeInTheDocument();
});
```

Run: `bun run test src/features/exports/download.test.ts src/features/desk/ReportsPage.test.tsx`. Expected: FAIL (modules missing).

- [ ] **Step 2: Implement `download.ts`**

```ts
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Hands the bytes to the browser as a file download. Nothing is uploaded or stored; the URL is released after ten seconds (some browsers need it to outlive the click). */
export function downloadBytes(bytes: Uint8Array, fileName: string): void {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: XLSX }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.style.display = 'none';
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
```

- [ ] **Step 3: Implement `useExportRunner.ts`**

```ts
import { useCallback, useRef, useState } from 'react';
import { friendlyError } from '@/lib/errors';
import { useToast } from '@/ui';
import { downloadBytes } from './download';
import type { ExportResult } from './exportActions';

/**
 * Runs one export at a time. A second press while one is running does nothing (a ref, so even a double tap before the next render is caught);
 * success downloads the file and says so; failure shows the friendly sentence and downloads nothing.
 */
export function useExportRunner() {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const lock = useRef(false);
  const run = useCallback(
    async (key: string, job: () => Promise<ExportResult>): Promise<void> => {
      if (lock.current) return;
      lock.current = true;
      setBusy(key);
      try {
        const out = await job();
        downloadBytes(out.bytes, out.fileName);
        toast(`${out.fileName} downloaded.${out.note ? ` ${out.note}` : ''}`, { tone: 'success' });
      } catch (err) {
        toast(friendlyError(err), { tone: 'danger' });
      } finally {
        lock.current = false;
        setBusy(null);
      }
    },
    [toast],
  );
  return { busy, run };
}
```

- [ ] **Step 4: Implement `ReportsPage.tsx`**

```tsx
import { useState } from 'react';
import { exportMember, exportMonth, exportPeriod, type ExportContext } from '@/features/exports/exportActions';
import { useExportRunner } from '@/features/exports/useExportRunner';
import { useGroup } from '@/features/group/GroupContext';
import { useGroupMembers } from '@/features/group/GroupPage';
import { activeMembers, currentPeriod, lastClosed, type PeriodRow } from '@/features/ledger/model';
import { useLedgerCycle } from '@/features/ledger/queries';
import { NotFound } from '@/features/shells/NotFound';
import { friendlyError } from '@/lib/errors';
import { Alert, Button, Card, EmptyState, PageHeader, SelectField, Skeleton } from '@/ui';

const labelOf = (p: PeriodRow): string => (p.status === 'open' ? `${p.label} (preview)` : p.label);

function ReportsBody() {
  const { group } = useGroup();
  const cycle = useLedgerCycle(group.id);
  const members = useGroupMembers(group.id);
  const { busy, run } = useExportRunner();
  const [monthId, setMonthId] = useState('');
  const [memberId, setMemberId] = useState('');

  const failed = [cycle, members].find((q) => q.isError && q.data === undefined);
  if (failed) {
    return (
      <Alert tone="danger" action={<Button size="sm" variant="secondary" onClick={() => { void cycle.refetch(); void members.refetch(); }}>Try again</Button>}>
        {friendlyError(failed.error)}
      </Alert>
    );
  }
  if (cycle.data === undefined || members.data === undefined) {
    return (
      <div role="status" className="grid gap-3">
        <span className="sr-only">Loading the reports</span>
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    );
  }
  if (!cycle.data.cycle) {
    return <EmptyState title="No active cycle">Reports work on the group’s active cycle. Set one up in Settings first.</EmptyState>;
  }

  const { periods } = cycle.data;
  const ctx: ExportContext = { groupId: group.id, groupName: group.name, cycle: cycle.data.cycle, periods };
  const exportable = periods.filter((p) => p.status === 'closed' || p.status === 'open').sort((a, b) => b.month_index - a.month_index);
  const closed = lastClosed(periods);
  const open = currentPeriod(periods);
  const chosen = exportable.find((p) => p.id === monthId) ?? closed ?? open ?? null;
  if (!chosen) return <EmptyState title="Nothing to export yet.">Open a month on the Desk first.</EmptyState>;

  const roster = activeMembers(members.data).sort((a, b) => a.short_name.localeCompare(b.short_name));
  const who = roster.find((m) => m.id === memberId) ?? roster[0] ?? null;
  const covers = [closed ? `closed months through ${closed.label}` : null, open ? `${open.label} as a preview` : null].filter(Boolean).join(', plus ');
  const idle = busy === null;

  return (
    <div className="grid gap-4 md:gap-5 lg:max-w-2xl">
      <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted">These files contain members’ figures. Send a member only their own report.</p>

      <Card>
        <section aria-labelledby="reports-month" className="grid gap-3">
          <h2 id="reports-month" className="text-lg font-semibold text-fg">One month</h2>
          <p className="text-sm text-muted">Like the monthly workbooks: every member, the group’s cash and pots, and everything recorded that month.</p>
          <SelectField label="Month" value={chosen.id} onChange={(e) => setMonthId(e.target.value)} disabled={!idle}>
            {exportable.map((p) => <option key={p.id} value={p.id}>{labelOf(p)}</option>)}
          </SelectField>
          <Button isLoading={busy === 'month'} disabled={!idle} onClick={() => void run('month', () => exportMonth(ctx, chosen))}>
            {busy === 'month' ? 'Preparing…' : `Download ${labelOf(chosen)} workbook`}
          </Button>
        </section>
      </Card>

      <Card>
        <section aria-labelledby="reports-period" className="grid gap-3">
          <h2 id="reports-period" className="text-lg font-semibold text-fg">The whole period</h2>
          <p className="text-sm text-muted">{`Covers ${covers}.`}</p>
          <p className="text-sm text-muted">Cumulative savings, interest, what is owed, loans, and one row for each member showing where they stand.</p>
          <Button isLoading={busy === 'period'} disabled={!idle} onClick={() => void run('period', () => exportPeriod(ctx))}>
            {busy === 'period' ? 'Preparing…' : 'Download the whole-period workbook'}
          </Button>
        </section>
      </Card>

      <Card>
        <section aria-labelledby="reports-member" className="grid gap-3">
          <h2 id="reports-member" className="text-lg font-semibold text-fg">One member</h2>
          <p className="text-sm text-muted">A report with only that member’s own figures, safe to send to them.</p>
          {who ? (
            <>
              <SelectField label="Member" value={who.id} onChange={(e) => setMemberId(e.target.value)} disabled={!idle}>
                {roster.map((m) => <option key={m.id} value={m.id}>{m.short_name}</option>)}
              </SelectField>
              <Button isLoading={busy === 'member'} disabled={!idle} onClick={() => void run('member', () => exportMember(ctx, who.id))}>
                {busy === 'member' ? 'Preparing…' : `Download ${who.short_name}’s report`}
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted">No active members.</p>
          )}
        </section>
      </Card>
    </div>
  );
}

export function ReportsPage() {
  const { isAdmin } = useGroup();
  if (!isAdmin) return <NotFound title="This page is for admins" body="Ask your treasurer if you think you should have access." />;
  return (
    <>
      <PageHeader title="Reports" subtitle="Download the books as Excel files" />
      <ReportsBody />
    </>
  );
}
```

- [ ] **Step 5: Add the route**

In `src/app/router.tsx`, add the import beside the other desk pages and the route after `desk/members/:memberId`:

```tsx
import { ReportsPage } from '@/features/desk/ReportsPage';
```

```tsx
                  page('desk/reports', 'Reports', <ReportsPage />),
```

- [ ] **Step 6: Run the tests and the gates**

Run: `bun run test src/features/exports src/features/desk/ReportsPage.test.tsx && bun run lint && bun run typecheck`. Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/exports/download.ts src/features/exports/download.test.ts src/features/exports/useExportRunner.ts src/features/desk/ReportsPage.tsx src/features/desk/ReportsPage.test.tsx src/app/router.tsx
git commit -m "feat: a Reports page to download the Excel files

Pick a month (the open one marked as a preview), the whole period, or one member, and the
file downloads. One export runs at a time, so a double press makes one file; a refusal shows
its friendly sentence and downloads nothing. Admins only, and the page warns that the files
hold members' figures."
```

---

### Task 9: The Desk card, the member-page button, and the real bundle check

**Files:**
- Create: `src/features/desk/MemberReportButton.tsx`
- Modify: `src/features/desk/DeskPage.tsx`, `src/features/desk/DeskPage.test.tsx`, `src/features/desk/MemberLedgerPage.tsx`, `src/features/desk/MemberLedgerPage.test.tsx`
- Test: `src/features/desk/MemberReportButton.test.tsx`

**Interfaces:**
- Consumes: `useExportRunner`, `exportMember` (Tasks 7, 8).
- Produces: `MemberReportButton({ memberId, memberName })`; a "Reports" card on the Desk linking to `/desk/reports`; the button in the member page heading.

- [ ] **Step 1: Write the failing tests**

`src/features/desk/MemberReportButton.test.tsx`:

```tsx
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { renderLedger, year } from '@/features/ledger/testFixtures';

const hooks = vi.hoisted(() => ({ cycle: vi.fn() }));
const actions = vi.hoisted(() => ({ exportMember: vi.fn() }));
const download = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: vi.fn() } }));
vi.mock('@/features/ledger/queries', async (orig) => ({ ...(await orig<typeof import('@/features/ledger/queries')>()), useLedgerCycle: () => hooks.cycle() }));
vi.mock('@/features/exports/exportActions', () => actions);
vi.mock('@/features/exports/download', () => ({ downloadBytes: download }));
const { MemberReportButton } = await import('./MemberReportButton');

const ok = <T,>(data: T) => ({ data, isPending: false, isError: false, error: null, refetch: vi.fn() });
const CYCLE = { id: 'c1', label: 'Cycle 2026' };

beforeEach(() => {
  actions.exportMember.mockReset();
  download.mockReset();
  actions.exportMember.mockResolvedValue({ bytes: new Uint8Array([1]), fileName: 'Test Group Eve Cycle 2026 through Sep 2026.xlsx' });
  hooks.cycle.mockReturnValue(ok({ cycle: CYCLE, periods: year(8) }));
});

test('pressing it exports that member’s report once and downloads the file', async () => {
  renderLedger(<MemberReportButton memberId="m1" memberName="Eve" />, { isAdmin: true });
  await userEvent.click(screen.getByRole('button', { name: 'Download Eve’s report' }));
  await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
  expect(actions.exportMember).toHaveBeenCalledTimes(1);
  expect(actions.exportMember.mock.calls[0]![0]).toMatchObject({ groupId: 'g1', groupName: 'Test Group', cycle: CYCLE });
  expect(actions.exportMember.mock.calls[0]![1]).toBe('m1');
  expect(download).toHaveBeenCalledWith(expect.any(Uint8Array), 'Test Group Eve Cycle 2026 through Sep 2026.xlsx');
});

test('a double press while it is preparing makes one file', async () => {
  let release: (v: unknown) => void = () => {};
  actions.exportMember.mockReturnValue(new Promise((resolve) => { release = resolve; }));
  renderLedger(<MemberReportButton memberId="m1" memberName="Eve" />, { isAdmin: true });
  const button = screen.getByRole('button', { name: 'Download Eve’s report' });
  await userEvent.click(button);
  await userEvent.click(button);
  expect(actions.exportMember).toHaveBeenCalledTimes(1);
  expect(button).toBeDisabled();
  release({ bytes: new Uint8Array([1]), fileName: 'x.xlsx' });
  await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
});

test('it shows nothing until the cycle is known, and nothing without an active cycle', () => {
  hooks.cycle.mockReturnValue({ data: undefined, isPending: true, isError: false, error: null, refetch: vi.fn() });
  const { unmount } = renderLedger(<MemberReportButton memberId="m1" memberName="Eve" />, { isAdmin: true });
  expect(screen.queryByRole('button')).toBeNull();
  unmount();
  hooks.cycle.mockReturnValue(ok({ cycle: null, periods: [] }));
  renderLedger(<MemberReportButton memberId="m1" memberName="Eve" />, { isAdmin: true });
  expect(screen.queryByRole('button')).toBeNull();
});
```

Append to `src/features/desk/DeskPage.test.tsx` (it already has `hooks`, `ok`, `year` and `DeskPage` in scope, as the Members-card test shows):

```tsx

test('the Desk links to the reports, with a month open or not', () => {
  const { unmount } = renderLedger(<DeskPage />, { isAdmin: true });
  expect(screen.getByRole('link', { name: 'Open reports' })).toHaveAttribute('href', '/desk/reports');
  unmount();
  hooks.cycle.mockReturnValue(ok({ cycle: { id: 'c1', label: 'Cycle 2026' }, periods: year(8) }));
  renderLedger(<DeskPage />, { isAdmin: true });
  expect(screen.getByRole('link', { name: 'Open reports' })).toHaveAttribute('href', '/desk/reports');
});
```

Append to `src/features/desk/MemberLedgerPage.test.tsx` (it mocks `useLedgerCycle`, `useParams` → `m1`; add the export mocks at the top with the other mocks):

```tsx
vi.mock('@/features/exports/exportActions', () => ({ exportMember: vi.fn() }));
vi.mock('@/features/exports/download', () => ({ downloadBytes: vi.fn() }));
```

```tsx

test('the member’s page offers their report', () => {
  renderPage();
  expect(screen.getByRole('button', { name: 'Download Eve’s report' })).toBeInTheDocument();
});
```

Run: `bun run test src/features/desk`. Expected: the three new tests FAIL.

- [ ] **Step 2: Implement the button**

`src/features/desk/MemberReportButton.tsx`:

```tsx
import { exportMember } from '@/features/exports/exportActions';
import { useExportRunner } from '@/features/exports/useExportRunner';
import { useGroup } from '@/features/group/GroupContext';
import { useLedgerCycle } from '@/features/ledger/queries';
import { Button } from '@/ui';

/** Downloads one member's own report as an Excel file (only their figures, safe to send to them). */
export function MemberReportButton({ memberId, memberName }: { memberId: string; memberName: string }) {
  const { group } = useGroup();
  const cycle = useLedgerCycle(group.id);
  const { busy, run } = useExportRunner();
  const data = cycle.data;
  if (!data?.cycle) return null;
  const ctx = { groupId: group.id, groupName: group.name, cycle: data.cycle, periods: data.periods };
  return (
    <Button
      size="sm"
      variant="secondary"
      aria-label={`Download ${memberName}’s report`}
      isLoading={busy !== null}
      disabled={busy !== null}
      onClick={() => void run('member', () => exportMember(ctx, memberId))}
    >
      {busy !== null ? 'Preparing…' : 'Download report'}
    </Button>
  );
}
```

- [ ] **Step 3: Wire it into the member page and the Desk**

In `src/features/desk/MemberLedgerPage.tsx`, import `MemberReportButton` (`import { MemberReportButton } from './MemberReportButton';` beside the other local imports) and change the `PageHeader` in `MemberLedgerHeader` to:

```tsx
      <PageHeader
        title={member?.full_name ?? member?.short_name ?? 'Member ledger'}
        subtitle="Entries, corrections and default status"
        actions={
          <>
            {member ? <MemberReportButton memberId={memberId} memberName={member.short_name ?? member.full_name ?? 'this member'} /> : null}
            <Link to="/desk/members" className={link}>All members</Link>
          </>
        }
      />
```

In `src/features/desk/DeskPage.tsx`, add a second card after the Members card (the last child of the `DeskBody` grid):

```tsx
      <Card>
        <CardHeader
          title="Reports"
          subtitle="Download the month, the whole period or one member’s report as Excel files."
          action={
            <Link
              to="/desk/reports"
              className="inline-flex h-12 items-center rounded-xl px-5 font-semibold text-accent underline transition duration-150 hover:bg-surface-2 active:scale-[.97]"
            >
              Open reports
            </Link>
          }
        />
      </Card>
```

- [ ] **Step 4: Run the tests and the gates**

Run: `bun run test src/features/desk src/features/exports && bun run lint && bun run typecheck`. Expected: PASS.

- [ ] **Step 5: Prove the real bundle**

```bash
export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$HOME/.bun/bin:$PATH"
bun run build 2>&1 | tail -12
echo "--- files containing ExcelJS's workbook paths:"; grep -l "xl/workbook.xml" dist/assets/*.js
echo "--- exceljs chunk:"; ls -la dist/assets | grep exceljs
echo "--- precache mentions of exceljs (expect 0):"; grep -c "exceljs" dist/sw.js
echo "--- main entry mentions of exceljs by static import (expect only a lazy reference):"; grep -o 'assets/exceljs-[A-Za-z0-9_-]*\.js' dist/assets/index-*.js | sort -u
```

Expected: exactly one file contains `xl/workbook.xml` and it is `dist/assets/exceljs-<hash>.js`; `dist/sw.js` has 0 mentions; the entry chunk may name the exceljs file only inside a dynamic-import preload map, never in `dist/index.html` (check: `grep -c exceljs dist/index.html` prints 0). If the exceljs code is inside the main chunk, or `sw.js` lists it, fix the config from Task 1 before going on.

- [ ] **Step 6: Commit**

```bash
git add src/features/desk/MemberReportButton.tsx src/features/desk/MemberReportButton.test.tsx src/features/desk/DeskPage.tsx src/features/desk/DeskPage.test.tsx src/features/desk/MemberLedgerPage.tsx src/features/desk/MemberLedgerPage.test.tsx
git commit -m "feat: reach the reports from the Desk and from a member's page

A Reports card on the Desk and a Download report button beside each member's name. The
production bundle was checked: ExcelJS is its own chunk, absent from the entry page and from
the service-worker precache."
```

---

### Task 10: Full verification and hand-over

**Files:** none (verification, and the notes for the user)

- [ ] **Step 1: Full gates**

```bash
export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$HOME/.bun/bin:$PATH"
bun run lint && bun run typecheck && bun run test && bun run build
```

Expected: all green. Report the Vitest total (it was 743 tests before this plan) and that the only build warning is the existing chunk-size notice (the `exceljs` chunk is large by nature).

- [ ] **Step 2: Database tests**

```bash
set -a; . ./.env.local; set +a
S=/tmp/claude-1000/-home-bk08-dev-web-village-banking/43e07bdc-ccaf-4683-870c-76c605cf3048/scratchpad
python3 $S/combine.py - supabase/tests/database/20_export_fee_fold.sql $S/c20.sql && bun $S/run.mjs $S/c20.sql | grep -v '^ok'
```

Expected: only the `1..N` plan line. (The full `bun run db:test` is unchanged by this work: no migration, and file 20 is read-only against the engine.)

- [ ] **Step 3: Whole-branch review**

Per the usual process: dispatch one fresh reviewer on the most capable model over the whole branch (`git diff origin/main..HEAD -- src supabase eslint.config.js vite.config.ts package.json`), with the spec and this plan as context and the Review Focus list as the brief. Fix every confirmed finding with a failing test first, in one pass, and re-run the gates.

- [ ] **Step 4: Hand over**

Tell the user, plainly:

1. **What exists:** the Reports page (`/desk/reports`, reached from a Desk card), a Download report button on each member's page, and three kinds of file. No migration.
2. **To deploy:** only the web deploy (push `main`) is needed; the pending `db-deploy` for migrations 2000, 2100 and 2200 is unrelated to the exports.
3. **Manual check on dev** (a throwaway group; exporting changes nothing, so the real group is safe too): download a closed month, the open month's preview, the whole-period workbook and a member report; open them in Excel or LibreOffice; compare with the Close page, the Passbook and the Record screen. Check on a phone browser that the download starts.
4. **Manual check on production after the web deploy:** export the whole-period workbook, save it into `data/private/` (git-ignored), and tell Claude; Claude will compare its cumulative savings per member against the September hand-built workbook, read-only. Differences should be only the already-recorded `workbook_rounded` cases.
5. **Not done, by design:** October does not exist in production yet (open it on the Desk after the `db-deploy` and web deploy); loading workbook figures for live months; a member downloading their own report.
