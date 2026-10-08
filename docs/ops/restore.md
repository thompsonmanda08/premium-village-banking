# Restoring a backup

Backups are produced nightly by `.github/workflows/backup.yml` and kept for 90 days as GitHub Actions artifacts.
Each is a tarball of `roles.sql`, `schema.sql` and `data.sql`, encrypted with `age` to the public key in the
`AGE_RECIPIENT` secret. The matching private key (`pvb-backup.key`) is kept offline by the owner and the treasurer.

The dump covers the roles, the `public` schema and the data of `public` and `auth` (so `auth.users` and
`auth.identities` come back). It does not cover `supabase_migrations`, Auth settings, Edge Function code or secrets,
or anything configured in the Supabase, Google, Resend or Vercel dashboards (see "Non-database setup" below).

## Restore into a local stack (test this once before go-live)

`supabase start` applies every migration and `seed.sql`, so the objects in `schema.sql` and the rows in `data.sql`
would collide with what is already there. Empty the stack first.

1. Download the artifact from GitHub → Actions → "Nightly encrypted backup" → a run → Artifacts.
2. Decrypt and unpack:

       age -d -i pvb-backup.key -o backup.tar.gz pvb-YYYY-MM-DD.tar.gz.age
       tar xzf backup.tar.gz

3. Start the local stack, then empty `public` and the seeded accounts. The grants put back what Supabase gives a
   fresh `public` schema, trimmed to what migration `20261008000200_access_rls.sql` leaves behind (no default
   access for `anon` or `authenticated`; `schema.sql` carries the explicit per-table grants):

       bun x supabase start
       psql --variable ON_ERROR_STOP=1 \
         --dbname 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' <<'SQL'
       drop schema public cascade;
       create schema public;
       grant usage on schema public to postgres, anon, authenticated, service_role;
       grant all on schema public to postgres, service_role;
       alter default privileges for role postgres in schema public grant all on tables to postgres, service_role;
       alter default privileges for role postgres in schema public grant all on sequences to postgres, service_role;
       alter default privileges for role postgres in schema public grant all on functions to postgres, service_role;
       truncate auth.users cascade;
       SQL

4. Load the dump:

       psql --single-transaction --variable ON_ERROR_STOP=1 \
         --file backup/roles.sql --file backup/schema.sql \
         --command 'SET session_replication_role = replica' \
         --file backup/data.sql \
         --dbname 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

5. Check: `psql … -c "select count(*) from public.members"` matches production, and
   `select count(*) from auth.users` matches too.

## Restore into production

Never reset or overwrite the existing production project to restore into it. Restore into a **new** Supabase
project. If the old project is still reachable, take a fresh dump from it first (run the backup workflow by hand)
and keep it until the new project is verified.

1. Create a new Supabase project and note its project ref, database password and **session pooler** connection string.
2. Run steps 2 and 4 above with `--dbname` set to the new project's session pooler connection string (skip step 3:
   the new project has an empty `public` schema and no seeded accounts).
3. Link the CLI to the new project and mark the migrations as already applied. The dump does not include
   `supabase_migrations`, so a plain `supabase db push` would run `20261008000100_core_schema.sql` again and fail.
   Repair every file in `supabase/migrations` (currently `20261008000100`, `20261008000200`, `20261008000300`,
   `20261008000400` and `20261008000500`; add any later ones):

       supabase link --project-ref <new-ref>
       supabase migration repair --status applied \
         20261008000100 20261008000200 20261008000300 20261008000400 20261008000500
       supabase migration list

   `migration list` must show every local version as applied remotely. Only then is `supabase db push` a no-op.
4. Members keep their accounts because `auth.users` is part of the dump, but they must **sign in again**: the new
   project has a new JWT secret, so every existing session and refresh token is invalid.

## Non-database setup (not in the backup)

Do these on the new project before pointing the app at it:

- [ ] Auth providers: Google, email magic link, email + password (and sign-ups disabled, as in `SECURITY_AUDIT.md` H-1).
- [ ] Auth redirect URLs: the production domain, the Vercel preview pattern, `http://localhost:3000`.
- [ ] Google OAuth client (Google Cloud console): add `https://<new-ref>.supabase.co/auth/v1/callback` as an authorised
      redirect URI, and enter the client ID and secret in the new project's Google provider.
- [ ] SMTP: Resend credentials in the new project's Auth SMTP settings.
- [ ] Edge Function secrets: `supabase secrets set SITE_URL=https://<production domain> ALLOWED_ORIGINS=<extra origins>`
      (`SITE_URL` is required and is always allowed; `ALLOWED_ORIGINS` is a comma-separated list of additional
      origins, such as the Vercel preview URL, and may be left empty). Supabase injects the service-role key itself.
- [ ] Redeploy `invite-member`: `supabase functions deploy invite-member --project-ref <new-ref>`.
- [ ] Vercel: set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` to the new project and redeploy.
- [ ] GitHub: update the `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`, `SUPABASE_DB_URL`, `SUPABASE_URL` and
      `SUPABASE_ANON_KEY` secrets so the deploy, keep-alive and backup workflows follow the new project.
