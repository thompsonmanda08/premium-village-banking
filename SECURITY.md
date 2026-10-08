# Security

Premium Village Bank holds members' personal details and the group's savings and loan records.
Treat every change as touching money and personal data.

## Reporting a vulnerability

Do not open a public issue. Email the maintainer at **SECURITY_CONTACT_EMAIL** (set before sharing the repo) with "SECURITY" in the subject,
a description, steps to reproduce, and the impact you expect. You will get an acknowledgement
within 3 working days and a fix or plan within 14 days for High/Critical issues. Please do not
access, change or delete other people's data while testing; use your own test accounts.

## Rules for contributors

### Authorization lives in the database
- Postgres row-level security is the access control. UI checks are for display only.
- Every new table: `enable row level security`, `revoke all ... from public, anon, authenticated`,
  then grant only the columns each role needs. Never grant `role`, `user_id`, `owner_user_id`,
  `group_id` (on update) or status fields that drive workflows.
- Every new function: `revoke execute ... from public, anon, authenticated`, then grant explicitly.
  `security definer` functions must `set search_path = public, pg_temp` and check `auth.uid()`
  / `is_admin()` themselves.
- Views over RLS tables are select-only (`revoke all`, `grant select`) and filter rows themselves.
- Any value affecting money, status, limits or dates is computed or validated in the database.
- Add pgTAP tests for each new table/function covering anon, an outsider, a member, an admin and
  the owner, including attempts on another group's rows. `bun run db:test` must pass.

### Edge Functions
- Act as the caller (anon key + the caller's `Authorization` header) for every read and write, so
  RLS applies. Use the service-role key only for the one call that needs it, after the checks.
- Validate request bodies; return fixed error codes, never raw errors; log no emails, tokens or keys.
- Keep `verify_jwt = true`. CORS origins come from `SITE_URL`/`ALLOWED_ORIGINS`, exact match only.

### Secrets
- Real values live only in `.env.local` and `supabase/functions/.env` (both gitignored) or in
  Supabase secrets. Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` may use the `VITE_` prefix.
- Never paste a DB URL, password, service-role key or access token into code, commits, issues,
  chat logs or test output. Scripts print errors through `scripts/scrub.mjs`.
- `supabase/seed.sql` has public passwords and must only reach a local stack (`seed-guard.mjs`).
- If a secret leaks, rotate it first, then clean up.

### Databases
- Never run `db:reset` or `db:test` against production. `db:reset` deletes everything.
- Never change or delete real member data from a script or the SQL editor without the owner's say-so.

### Frontend
- No `dangerouslySetInnerHTML`, `innerHTML` or `eval` with user data.
- Keep scripts in files (no inline scripts) so the Content-Security-Policy can stay strict.
- Strip invite tokens from the address bar after reading them.

### Dependencies
- Run `bun audit` before releases; no known high/critical issues in runtime dependencies.
- Prefer existing dependencies; pin versions for Edge Function imports.

See `SECURITY_AUDIT.md` for the latest audit, open items and the pre-release checklist.
