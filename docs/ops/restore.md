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
