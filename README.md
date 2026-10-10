# Premium Village Bank

Mobile-first savings, declarations and loans app for Premium Village Banking.
Vite + React SPA on Vercel, Supabase (Postgres, Auth, Edge Functions) on the free tier.

## Develop

Prerequisites: Bun 1.4+, Deno 2 (Edge Function tests), Docker (the local Supabase stack).

**The hosted Supabase project is production**: it holds the group's real accounts and money data. Day-to-day database
work uses a local stack. Never reset it, and never run the pgTAP suite against it.

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
    bun run db:test     # pgTAP suite in supabase/tests/database against SUPABASE_DB_URL (the local stack)
    bun run db:push     # apply new migrations to the database SUPABASE_DB_URL names
    bun run db:types    # regenerate src/lib/database.types.ts from the database SUPABASE_DB_URL names (never production; read only)
                        # then format it: bunx oxfmt src/lib/database.types.ts

Guards: `db:reset` refuses any `SUPABASE_DB_URL` that is not localhost unless you pass `--allow-hosted` (for a throwaway
hosted scratch project), and refuses the production project (`PROD_PROJECT_REF`) whatever you pass. `db:test` and `db:types` refuse the
production project too. Production migrations and function deploys go out through the gated "Deploy database and
functions" workflow, not `db:push` (`docs/ops/setup.md`).

`supabase/seed.sql` is for the local/CI stack only and creates accounts with the public password `password123`: owner@pvb.test, admin@pvb.test, member@pvb.test, outsider@pvb.test. `scripts/db-cli.mjs` never seeds a host that is not localhost. On the hosted project, run `private.bootstrap_premium_vb(<owner auth uid>)` from the SQL editor.

## Check

    bun run typecheck && bun run lint && bun run check:tokens && bun run test
    bun run db:test         # pgTAP RLS suite (local stack)
    bun run fn:test         # Edge Function unit tests
    bun run e2e             # Playwright smoke (starts the dev server)

Specs and plans: `docs/superpowers/`. Operations: `docs/ops/`.
