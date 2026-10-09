# Restoring a backup

Backups are produced nightly by `.github/workflows/backup.yml` and kept for 90 days as GitHub Actions artifacts.
Each is a tarball of `roles.sql`, `schema.sql` and `data.sql`, encrypted with `age` to the public key in the
`AGE_RECIPIENT` secret. The matching private key (`pvb-backup.key`) is kept offline by the owner and the treasurer.

The dump covers the roles, the `public` schema and the data of `public` and `auth` (so `auth.users` and
`auth.identities` come back). It does not cover `supabase_migrations`, Auth settings, Edge Function code or secrets,
or anything configured in the Supabase, Google, Resend or Vercel dashboards (see "Non-database setup" below).

## Privilege hardening (part of every restore)

A new Supabase project gives `anon` and `authenticated` every privilege on whatever `postgres` creates in `public`.
`schema.sql` only adds grants, it never removes the target's extra defaults, and marking migration
`20261008000200_access_rls.sql` as applied (below) means its revokes never run. Left as is, `anon` and
`authenticated` end up with full access to every table and view, including writes through `public.group_members`
(an owner-rights view, so RLS does not apply), which lets a member make themselves an admin.
So every restore does three things around the load: **A** before it, **B** after it, **C** to prove it worked.
Both restore procedures below say exactly where. `$DB` is the connection string of the database being restored into.

**A. Before loading `schema.sql`.** Stop new objects from getting those default grants (the same three statements as in
migration `20261008000200_access_rls.sql`):

```
psql --variable ON_ERROR_STOP=1 --dbname "$DB" <<'SQL'
alter default privileges for role postgres in schema public revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from public, anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from public, anon, authenticated;
SQL
```

**B. After loading `data.sql`.** Re-run every `revoke` / `grant` / `alter default privileges` statement from the
migrations, in order. This extracts them (whole statements, including the multi-line ones) from the repository and
runs them in one transaction; run it from the repository root, at the same git revision as the backup:

```
awk 'tolower($0) ~ /^(revoke|grant|alter default privileges)/ {p=1} p {print} p && /;[ \t]*(--.*)?$/ {p=0}' \
  supabase/migrations/*.sql > backup/reapply-grants.sql
psql --single-transaction --variable ON_ERROR_STOP=1 --file backup/reapply-grants.sql --dbname "$DB"
```

`backup/reapply-grants.sql` should hold 35 statements today (migrations `…0200`, `…0300`, `…0400`); a later
migration that adds grants is picked up automatically because the glob covers every file. Read the file before
running it. If it fails on `schema private`, the dump did not carry that schema: run
`psql --file supabase/migrations/20261008000400_bootstrap.sql --dbname "$DB"` once (it is idempotent), then re-run B.

**C. Verify. This must pass before go-live.** Run:

```
psql --variable ON_ERROR_STOP=1 --dbname "$DB" <<'SQL'
select check_name, got, expected, got = expected as pass from (
  select 'anon: select on members' as check_name,
         has_table_privilege('anon', 'public.members', 'select') as got, false as expected
  union all select 'authenticated: insert/update/delete on group_members',
         has_table_privilege('authenticated', 'public.group_members', 'insert,update,delete'), false
  union all select 'authenticated: truncate on audit_log',
         has_table_privilege('authenticated', 'public.audit_log', 'truncate'), false
  union all select 'anon: execute on any public function except invite_preview(text)',
         exists (select 1 from pg_proc
                 where pronamespace = 'public'::regnamespace and has_function_privilege('anon', oid, 'execute')
                   and oid is distinct from to_regprocedure('public.invite_preview(text)')::oid), false
  union all select 'anon: execute on invite_preview(text)',
         has_function_privilege('anon', 'public.invite_preview(text)', 'execute'), true
  union all select 'authenticated: select on members',
         has_table_privilege('authenticated', 'public.members', 'select'), true
) s;
SQL
```

Expected: six rows, `pass` = `t` on every one (the first four have `got` = `f`, the last two `t`). Any `f` in `pass`:
do not go live; re-run B and C, and if it still fails compare against `supabase/tests/database/02_rls.sql`.

## Restore into a local stack (test this once before go-live)

`supabase start` applies every migration and `seed.sql`, so the objects in `schema.sql` and the rows in `data.sql`
would collide with what is already there. Empty the stack first. This drill includes A, B and C, so it proves them.

1. Download the artifact from GitHub → Actions → "Nightly encrypted backup" → a run → Artifacts.
2. Fetch `pvb-backup.key` from its offline storage for this drill only. Decrypt and unpack:

```
age -d -i pvb-backup.key -o backup.tar.gz pvb-YYYY-MM-DD.tar.gz.age
tar xzf backup.tar.gz
export DB='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
echo "$DB"   # must show 127.0.0.1:54322 before any psql command below; an empty $DB would make psql use its defaults
```

3. Start the local stack, then empty `public`, `private` (the bootstrap functions; `schema.sql` recreates it) and the
   seeded accounts. The grants put back what a fresh `public`
   schema has, trimmed to what migration `20261008000200_access_rls.sql` leaves behind (no default access for `anon`
   or `authenticated`):

```
bun x supabase start
psql --variable ON_ERROR_STOP=1 --dbname "$DB" <<'SQL'
drop schema public cascade;
drop schema if exists private cascade;
create schema public;
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, service_role;
alter default privileges for role postgres in schema public grant all on tables to postgres, service_role;
alter default privileges for role postgres in schema public grant all on sequences to postgres, service_role;
alter default privileges for role postgres in schema public grant all on functions to postgres, service_role;
truncate auth.users cascade;
SQL
```

4. Run **A** (above).
5. Load the dump:

```
psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file backup/roles.sql --file backup/schema.sql \
  --command 'SET session_replication_role = replica' \
  --file backup/data.sql \
  --dbname "$DB"
```

6. Run **B**, then **C**. `pass` must be `t` on all six rows.
7. Check: `psql "$DB" -c "select count(*) from public.members"` matches production, and
   `select count(*) from auth.users` matches too.
8. Clean up. The dump is real member data and `pvb-backup.key` opens every backup: delete the decrypted copies
   (`rm -rf backup backup.tar.gz`, and the downloaded `.age` file), delete the key from this machine (it lives offline),
   and run `bun x supabase stop --no-backup` so the local database volume goes too.

## Restore into production

Never reset or overwrite the existing production project to restore into it. Restore into a **new** Supabase
project. If the old project is still reachable, take a fresh dump from it first (run the backup workflow by hand)
and keep it until the new project is verified.

1. Create a new Supabase project and note its project ref, database password and **session pooler** connection
   string. Do steps 1 and 2 of the local procedure, with `export DB='<the session pooler connection string>'`.
   Skip its step 3: the new project has an empty `public` schema and no seeded accounts.
2. Run **A** (above) against the new project.
3. Load the dump with the `psql --single-transaction` command from step 5 of the local procedure.
4. Run **B**, then **C**. Do not continue until `pass` is `t` on all six rows.
5. Link the CLI to the new project and mark the migrations as already applied. The dump does not include
   `supabase_migrations`, so a plain `supabase db push` would run `20261008000100_core_schema.sql` again and fail.
   Repair every file in `supabase/migrations` (currently `20261008000100`, `20261008000200`, `20261008000300`,
   `20261008000400`, `20261008000500` and `20261009000600`; add any later ones):

```
supabase link --project-ref <new-ref>
supabase migration repair --status applied \
  20261008000100 20261008000200 20261008000300 20261008000400 20261008000500 20261009000600
supabase migration list
```

   `migration list` must show every local version as applied remotely. Only then is `supabase db push` a no-op.
6. Members keep their accounts because `auth.users` is part of the dump, but they must **sign in again**: the new
   project has a new JWT secret, so every existing session and refresh token is invalid.

## Non-database setup (not in the backup)

Do these on the new project before pointing the app at it:

- [ ] Auth providers: Google, email magic link, email + password (and sign-ups disabled, as in `SECURITY_AUDIT.md` H-1).
- [ ] Auth URL configuration: set **Site URL** to the production domain, and the only redirect URL to
      `https://<production domain>/**`. No Vercel preview wildcard and no `localhost`: with the implicit flow a wildcard
      lets any lookalike Vercel project receive members' sign-in tokens (previews use password sign-in only).
- [ ] Auth Email OTP expiration `86400` (24 hours, the maximum), so invite emails stay usable overnight; and an email
      rate limit that fits the group (see `docs/ops/setup.md` section 2).
- [ ] Google OAuth client (Google Cloud console): add `https://<new-ref>.supabase.co/auth/v1/callback` as an authorised
      redirect URI, and enter the client ID and secret in the new project's Google provider.
- [ ] SMTP: Resend credentials in the new project's Auth SMTP settings.
- [ ] Edge Function secrets: `supabase secrets set SITE_URL=https://<production domain>`, or, to also allow invites from
      a preview, `supabase secrets set SITE_URL=https://<production domain> ALLOWED_ORIGINS=<extra origins>`
      (`SITE_URL` is required and is always allowed; `ALLOWED_ORIGINS` is a comma-separated list of additional exact
      origins and is not needed in production). Supabase injects the service-role key itself.
- [ ] Redeploy `invite-member`: `supabase functions deploy invite-member --project-ref <new-ref>`.
- [ ] Vercel: set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` to the new project and redeploy.
- [ ] GitHub: update the `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`, `SUPABASE_DB_URL`, `SUPABASE_URL` and
      `SUPABASE_ANON_KEY` secrets so the deploy, keep-alive and backup workflows follow the new project.
