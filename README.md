# Premium Village Bank

Mobile-first savings, declarations and loans app for Premium Village Banking.
Vite + React SPA on Vercel, Supabase (Postgres, Auth, Edge Functions) on the free tier.

## Develop

Prerequisites: Bun 1.4+, Deno 2 (Edge Function tests). No Docker needed: development runs against a hosted Supabase project, whose database may be reset freely until go-live.

    bun install
    cp .env.example .env.local   # fill in the URL, anon key, project ref, access token and DB URL (see comments inside)
    bun run db:reset             # drop and re-apply every migration on the hosted DB (no seed)
    bun run dev                  # http://localhost:3000

Database scripts (all read `.env.local`; the CLI-only values never reach the browser bundle):

    bun run db:push     # apply new migrations to the hosted DB
    bun run db:reset    # wipe the hosted DB (including auth.users) and re-apply all migrations; never seeds
    bun run db:test     # pgTAP suite in supabase/tests/database against the hosted DB
    bun run db:types    # regenerate src/lib/database.types.ts
    bun run db:start    # optional local stack (needs Docker); CI uses this

`supabase/seed.sql` is for the local/CI stack only (`supabase start`) and creates accounts with the public password `password123`: owner@pvb.test, admin@pvb.test, member@pvb.test, outsider@pvb.test. `db:reset` never applies it to the hosted project, and `scripts/db-cli.mjs` refuses to seed any host that is not localhost. On the hosted project, run `private.bootstrap_premium_vb(<owner auth uid>)` from the SQL editor.

## Check

    bun run typecheck && bun run lint && bun run check:tokens && bun run test
    bun run db:test         # pgTAP RLS suite
    bun run fn:test         # Edge Function unit tests
    bun run e2e             # Playwright smoke (starts the dev server)

Specs and plans: `docs/superpowers/`. Operations: `docs/ops/`.
