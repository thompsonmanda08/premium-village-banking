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
