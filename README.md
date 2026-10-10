# Premium Village Bank

Mobile-first savings, declarations and loans app for Premium Village Banking.
Vite + React SPA on Vercel, Supabase (Postgres, Auth, Edge Functions) on the free tier.

## Develop

Prerequisites: Bun 1.4+, Deno 2 (Edge Function tests), Docker (the local Supabase stack).

**The hosted Supabase project is production**: it holds the group's real accounts and money data. Day-to-day database
work uses a development database (below). Never reset production, and never run the pgTAP suite against it.

    bun install
    bun run db:start             # local Supabase stack: applies supabase/migrations and supabase/seed.sql
    cp .env.example .env.local   # then point it at the local stack (below)
    bun run dev                  # http://localhost:3000

In `.env.local` use the local values for everything the scripts and the app read: `VITE_SUPABASE_URL=http://127.0.0.1:54321`,
`VITE_SUPABASE_ANON_KEY` = the anon key that `bun x supabase status` prints, and
`SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres`. Keep the hosted project's database URL out of
that file; it is only needed for production setup and restores (`docs/ops/`). Set `PROD_PROJECT_REF` to the hosted project's
ref so the guards below can recognise it.

Database scripts (all read `.env.local`; the CLI-only values never reach the browser bundle):

    bun run db:start    # local stack (needs Docker); CI does the same
    bun run db:reset    # wipe the local DB (including auth.users) and re-apply migrations and seed
    bun run db:test     # pgTAP suite in supabase/tests/database against SUPABASE_DB_URL (a development database)
    bun run db:push     # apply new migrations to the database SUPABASE_DB_URL names
    bun run db:types    # regenerate src/lib/database.types.ts from the database SUPABASE_DB_URL names (never production; read only)
                        # then format it: bunx oxfmt src/lib/database.types.ts

Guards: `db:reset` refuses any `SUPABASE_DB_URL` that is not localhost unless you pass `--allow-hosted` (for a throwaway
hosted scratch project), and refuses the production project (`PROD_PROJECT_REF`) whatever you pass. `db:test` and `db:types` refuse the
production project too. Production migrations and function deploys go out through the gated "Deploy database and
functions" workflow, not `db:push` (`docs/ops/setup.md`).

`supabase/seed.sql` is for the local/CI stack only and creates accounts with the public password `password123`: owner@pvb.test, admin@pvb.test, member@pvb.test, outsider@pvb.test. `scripts/db-cli.mjs` never seeds a host that is not localhost. On the hosted project, run `private.bootstrap_premium_vb(<owner auth uid>)` from the SQL editor.

### Development database

Production is the hosted project, so database work needs a second database: the local stack (Docker, `bun run db:start`)
or a second free Supabase project used as "dev" (point `SUPABASE_DB_URL`, `SUPABASE_PROJECT_REF` and the `VITE_*` values
in `.env.local` at it, apply migrations with `bun run db:push`, and keep `PROD_PROJECT_REF` set to production).
Step by step: Task 0 of `docs/superpowers/plans/2026-10-10-ledger-engine.md`.

### Ledger: 2026 import and checks

The ledger (wallets, months, declarations, entries, loans, statements) is described in
`docs/superpowers/specs/2026-10-10-ledger-engine-design.md`; who may call what is in `SECURITY.md` under "Ledger".

    bun run ledger:import                              # dry run: reads data/content/, imports in a transaction, rolls back
    bun run ledger:import -- --target <ref> --write    # writes; <ref> must be the project SUPABASE_DB_URL points at (--target local for the local stack)
    bun run ledger:check -- --target <ref>             # per-month differences from the workbooks, counted by reason code

`ledger:import` also takes `--through <month>` (Feb to Nov, by name or number 1 to 10; default the latest workbook)
and `--dir <folder>` (default `data/content`); `ledger:check` takes only `--target`. Unknown options are refused.
Both need the owner connection (`SUPABASE_DB_URL` for the `postgres` role) and print counts and totals only;
`ledger:check` writes member-level detail to `data/private/ledger-check.json` and exits 1 if any difference is
unexplained.

Both are local only, never in CI. The workbooks (`data/content/`) and everything derived from them (`data/private/`,
including `ledger-check.json`) are git-ignored and never committed. Both refuse production unless `--target` names it,
and refuse a hosted database when `PROD_PROJECT_REF` is unset. The import is re-runnable (it replaces only its own
rows) until the app takes over the cycle: once a month is opened in the app, or any app entry, statement or
declaration exists, it refuses (`already_opened`).

## Check

    bun run typecheck && bun run lint && bun run check:tokens && bun run test
    bun run db:test         # pgTAP suite (development database)
    bun run fn:test         # Edge Function unit tests
    bun run e2e             # Playwright smoke (starts the dev server)

Specs and plans: `docs/superpowers/`. Operations: `docs/ops/`.
