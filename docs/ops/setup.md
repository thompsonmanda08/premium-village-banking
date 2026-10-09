# Production setup

For the group's owner or treasurer setting up production once, and for whoever maintains it later.
Do the sections in order. Values in CAPITALS are yours to fill in; keep them in a password manager.
Commands run from the repository root unless a section says otherwise. Never paste real secrets into
chat, issues, commits or screenshots, and never print `.env.local`.

> **A reset of the hosted Supabase project deletes every account and every row.** It cannot be undone.
> Section 1 puts a guard in place. Read it before you do anything else.

Accounts and tools you need: Supabase, Vercel, GitHub (admin on the repo), Google Cloud, Resend, a domain you
control; locally `bun`, `git`, `age`, `psql`, and Docker (only for the restore drill in section 8).
Every account password you create below (the owner and the three Playwright accounts) must meet the
project's policy: **at least 12 characters, with letters and digits**.

## 1. Supabase project: use the existing one

The hosted project in `eu-west-1` already exists and served as the dev/test database during the build.
Production uses that same project. (Only if you are starting over: supabase.com, New project, name
`premium-village-bank`, region closest to Lusaka that is offered, strong database password. Then repeat
every step below, and the "Non-database setup" list in `docs/ops/restore.md`.)

1. Collect these from the dashboard and keep them in a password manager:
   - `SUPABASE_PROJECT_REF`, `SUPABASE_URL` (`https://SUPABASE_PROJECT_REF.supabase.co`) and `SUPABASE_ANON_KEY`:
     Project Settings, API.
   - `SUPABASE_DB_PASSWORD`: Project Settings, Database. Reset it there if you have lost it.
   - `SUPABASE_DB_URL`: Connect, **Session pooler** string (port 5432) with the password filled in.
     Percent-encode special characters in the password.
   - `SUPABASE_ACCESS_TOKEN`: Account, Access Tokens, new token. Use a token from a bot or dedicated account if you can.

### Before go-live: clean the dev/test use

Do this once, before section 4. In the dashboard SQL editor run the query below. It only counts.

```sql
select
  (select count(*) from information_schema.schemata where schema_name = 'tests')                      as tests_schema,
  (select count(*) from pg_extension where extname = 'pgtap')                                          as pgtap_installed,
  (select count(*) from auth.users)                                                                    as all_users,
  (select count(*) from auth.users where email ~* '@(test\.local|pvb\.test)$')                         as test_users,
  (select count(*) from public.groups)                                                                 as all_groups,
  (select count(*) from public.groups where name in ('Test Group', 'Other Group', 'Playwright Test Group')) as test_groups,
  (select count(*) from public.groups where name = 'Premium Village Banking')                          as real_group;
```

- [ ] `tests_schema` is 0. If not: `drop schema if exists tests cascade;` (it holds test helper functions that write `auth.users`).
- [ ] `test_users` and `test_groups` are both 0. If not, stop and ask the owner, then delete those rows by hand
      (groups first: a group's owner account cannot be deleted while the group exists). Never bulk-delete rows you have not looked at.
- [ ] `all_users` lists only people you recognise (Authentication, Users). Remove stray dev accounts there.
- [ ] `real_group` is 0, or it is 1 and that group belongs to the right owner. If it is 1, skip the bootstrap in
      section 4 (it refuses to run twice).
- [ ] `pgtap_installed`: decide. It is harmless but unused in production. To remove it: `drop extension if exists pgtap;`.
      `bun run db:test` recreates it, which is one more reason not to run that command here.
- [ ] Put `PROD_PROJECT_REF=SUPABASE_PROJECT_REF` in your local `.env.local`. From then on `bun run db:reset` refuses
      any `SUPABASE_DB_URL` that names this project (while it is unset the guard does nothing). Do not test the
      guard by running `db:reset`. The guard covers that script only: the Supabase CLI's own `db reset --linked` is not
      guarded, so never run it after section 1.
- [ ] Stop running `bun run db:test` against this project. CI runs the suite on its own local stack. To keep working
      on the database locally, run `bun run db:start` (needs Docker) and point `SUPABASE_DB_URL` in `.env.local` at
      `postgresql://postgres:postgres@127.0.0.1:54322/postgres`. Production migrations then go out through the
      "Deploy database and functions" workflow (section 6).

### Link and check migrations

```bash
bun x supabase login
bun x supabase link --project-ref SUPABASE_PROJECT_REF
bun x supabase db push --dry-run
```

The migrations were applied with `bun run db:push` during the build, so the dry run should list nothing pending
(or only migrations added since). If it lists some, run `bun x supabase db push`.

## 2. Auth settings (Dashboard, Authentication)

Some of these were already changed on the project during the security audit (`SECURITY_AUDIT.md` H-1, M-1, M-2).
Open each page and confirm; set whatever differs. Dashboard menu names move around from time to time.

- [ ] Sign In / Providers, **Email**: enabled. **Allow new users to sign up: off** (audit H-1: members get accounts
      only through invites). **Confirm email: on** (`accept_invite` trusts the email in the sign-in token, so this
      must stay on). **Secure password change: on**. Minimum password length **12**, password requirements
      **letters and digits**. Allow anonymous sign-ins: **off**.
- [ ] Sign In / Providers, **Allow manual linking: OFF**. The Account page has no "Link Google" button on purpose.
      A member who signs in with Google using the email they were invited with is linked to their account automatically.
      Because sign-ups are off, Google sign-in only works for people who already have an account.
- [ ] Sign In / Providers, **Google**: enabled, with a Google Cloud OAuth client. In Google Cloud console, APIs & Services:
      set up the OAuth consent screen (External) and publish it **In production** (the basic email and profile scopes need no
      review; in Testing mode only listed test users can sign in). Then Credentials, Create OAuth client ID, Web application.
      Authorised redirect URI `https://SUPABASE_PROJECT_REF.supabase.co/auth/v1/callback`; authorised JavaScript origin
      `https://PROD_DOMAIN`. Paste the client ID and secret into the Supabase Google provider.
- [ ] URL Configuration: **Site URL** `https://PROD_DOMAIN`. **Redirect URLs** `https://PROD_DOMAIN/**` and
      `https://*-VERCEL_TEAM_SLUG.vercel.app/**` (Vercel previews). No `localhost` entries in production.
      (Until this is done the hosted Site URL is `http://localhost:3000` and auth emails point at localhost.)
- [ ] SMTP (Authentication, Emails, SMTP Settings): custom SMTP through Resend. First verify your domain in Resend
      (DNS records), then create an API key with sending access. Host `smtp.resend.com`, port `465`, user `resend`,
      password = the Resend API key, sender email `no-reply@VERIFIED_DOMAIN`, sender name `Premium Village Bank`.
      Without custom SMTP, Supabase's mailer only sends to project team members, at 2 emails an hour: invites will not arrive.
- [ ] Rate Limits: lower the email rate limit to a figure that fits the group (about 20 emails an hour is plenty for
      roughly twenty members), and leave sign-in and token-verification limits at their defaults or lower. Someone can
      probe whether an address belongs to a member by how the magic-link request answers (rate-limit errors, timing); a
      low email cap limits how much of that they can do.
- [ ] Project Settings, Database: **SSL enforcement on** (turned on during the audit). Leave network restrictions as
      they are unless you have checked that the backup and deploy workflows still connect: GitHub's runner addresses change.
- [ ] Leaked-password protection (HIBP) needs a paid plan; skip on the free tier.

## 3. Edge Function `invite-member`

The function sends invite emails. It refuses to start without `SITE_URL`.

### Before the first deploy: confirm these fixes are in the code

Do not deploy until every box is ticked. If one is missing, it needs a code change first, not a workaround here.

- [ ] `SITE_URL` handling: a trailing slash is stripped (so links are `https://PROD_DOMAIN/invite/…`, not `…//invite/…`),
      and a missing or empty `SITE_URL` fails closed (the function refuses to start; no localhost fallback).
- [ ] The supabase-js import is pinned to an exact version (not `@2`), **or** a `deno.lock` is committed
      (it is currently listed in `.gitignore`).
- [ ] A migration adds a partial unique index on `invites` so a member can never have two live invites
      (unique on `member_id` where `accepted_at` and `revoked_at` are both null).
- [ ] "Already registered" is detected by the Auth error `code === 'email_exists'`, not by HTTP status or message text.
- [ ] `bun run fn:test` passes.

Quick look (each should show what the item above says):

```bash
grep -n "supabase-js@" supabase/functions/invite-member/index.ts
grep -n "email_exists" supabase/functions/invite-member/index.ts
git ls-files deno.lock
ls supabase/migrations
```

### Secrets and deploy

```bash
bun x supabase secrets set SITE_URL=https://PROD_DOMAIN ALLOWED_ORIGINS=https://PROD_DOMAIN,https://PREVIEW_ORIGIN
bun x supabase secrets list
bun x supabase functions deploy invite-member --project-ref SUPABASE_PROJECT_REF
```

- `SITE_URL` is the production origin: `https`, no trailing slash, never localhost. Invite links are built from it
  and it is always allowed to call the function from a browser.
- `ALLOWED_ORIGINS` is a comma-separated list of **extra** browser origins that may call the function, for example
  the Vercel preview origin (`https://premium-village-bank-git-BRANCH-VERCEL_TEAM_SLUG.vercel.app`). Matching is exact:
  no wildcards, so each preview origin you want to send invites from has to be listed. Production only needs `SITE_URL`;
  list nothing else if you never invite from a preview. Never list localhost in production.
- Supabase injects `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` itself. Do not set them.
- Set the secrets before the function is deployed by anyone, including the "Deploy database and functions"
  workflow (section 6), or the function will not start.
- In the dashboard, Edge Functions, `invite-member`: check **Verify JWT** is on (it is set in `supabase/config.toml`).
- Function logs can contain an invitee's email (`SECURITY_AUDIT.md` L-9). Treat the logs as personal data.

## 4. Owner account and the group

1. Authentication, Users, Add user, Create new user: `OWNER_EMAIL` with a strong password (at least 12 characters,
   letters and digits), **Auto Confirm User** on.
2. SQL editor (skip if `real_group` was 1 in section 1):

```sql
select private.bootstrap_premium_vb((select id from auth.users where email = 'OWNER_EMAIL'));
```

   Pass a second argument if the owner is not Thompson, e.g. `..., 'Charles')`.
3. Playwright accounts: create three more users the same way, each with a password that meets the policy
   (`E2E_OWNER_EMAIL`, `E2E_ADMIN_EMAIL`, `E2E_MEMBER_EMAIL`). Use addresses at a mailbox you control (for example
   `you+e2e-admin@YOUR_DOMAIN`), never an address nobody owns: anyone who controls the mailbox can reset the password.
   Then:

```sql
select private.bootstrap_test_group('E2E_OWNER_EMAIL', 'E2E_ADMIN_EMAIL', 'E2E_MEMBER_EMAIL');
```

   These accounts only ever see "Playwright Test Group". Keep their passwords in the password manager; they go into
   GitHub secrets in section 6.

## 5. Vercel

1. Import the GitHub repo. Framework preset: Vite (`vercel.json` already sets bun, the build and the output).
2. Environment variables (Production **and** Preview): `VITE_SUPABASE_URL` = `SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY` = `SUPABASE_ANON_KEY`. Nothing else: no service-role key, no database URL.
3. Domains: add `PROD_DOMAIN`. Production branch: `main`.
4. Deployment Protection, Protection Bypass for Automation: generate, save as `VERCEL_AUTOMATION_BYPASS_SECRET`.
5. Run the role tests once by hand against a preview deployment. They have never run against a real session, so do
   this before relying on CI. Open a pull request (or use any existing preview) and take its URL as `PREVIEW_URL`:

```bash
bun x playwright install chromium
BASE_URL=PREVIEW_URL \
VERCEL_AUTOMATION_BYPASS_SECRET='VERCEL_AUTOMATION_BYPASS_SECRET' \
E2E_MEMBER_EMAIL='E2E_MEMBER_EMAIL' E2E_MEMBER_PASSWORD='E2E_MEMBER_PASSWORD' \
E2E_ADMIN_EMAIL='E2E_ADMIN_EMAIL' E2E_ADMIN_PASSWORD='E2E_ADMIN_PASSWORD' \
bun run e2e
```

   Replace each quoted CAPITALS value with the real one. Start the line with a space or load the values from a
   script outside the repo so they stay out of shell history. Expected: the phone and desktop projects both pass,
   including the member-versus-admin tests. If a test fails, Playwright keeps a trace in `test-results/` that contains typed
   passwords: delete that folder afterwards (or put `CI=true` in front to turn traces off).

## 6. GitHub

1. Settings, Environments, `production`, Required reviewers: the owner and the treasurer. The workflow
   "Deploy database and functions" runs in this environment, so **no migration or function deploy reaches
   production until a reviewer approves it**.
2. Settings, Secrets and variables, Actions, repository secrets:

   | Secret | Used by |
   |---|---|
   | `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD` | Deploy database and functions |
   | `SUPABASE_DB_URL`, `AGE_RECIPIENT` | Nightly encrypted backup |
   | `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Keep Supabase awake |
   | `E2E_MEMBER_EMAIL`, `E2E_MEMBER_PASSWORD`, `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, `VERCEL_AUTOMATION_BYPASS_SECRET` | E2E on preview |

3. Backup key. Generate it outside the repository (`*.key` is not git-ignored):

```bash
age-keygen -o ~/pvb-backup.key
```

   Put the printed public key (`age1…`) in the `AGE_RECIPIENT` secret. The **private half, `pvb-backup.key`, lives
   offline in two places** (the owner and the treasurer): an encrypted USB stick or printed in a safe, not in GitHub, the
   repo or an online drive. Without it the backups cannot be read. After copying, delete it from the machine you made it on.
4. Merge the foundation pull request into `main` once sections 1 to 6 are done (the Edge Function checklist in section 3
   included). CI, the preview deploy and the "E2E on preview" job run on the pull request. The merge starts "Deploy
   database and functions"; it waits for a `production` reviewer. Approve it only after the section 3 checklist is ticked
   and the secrets are set.
5. Workflows can only be run by hand once they are on `main`. Then, in Actions, Run workflow, once each: "Keep Supabase
   awake" and "Nightly encrypted backup". Both must finish green. Download the backup artifact for section 8.

## 7. Before you tell members it is live

Walk through the pre-release checklist in `SECURITY_AUDIT.md`. Items it still lists as open (MFA for admins, network
restrictions, dependency upgrade) are decisions for the owner: write down which you accept for now.

## 8. Restore drill (once, before real money data goes in)

Follow `docs/ops/restore.md`, "Restore into a local stack", using last night's backup artifact. It needs
`age`, `psql` and Docker. The procedure includes the privilege hardening (steps **A**, **B**, **C**). Add two things to it,
so that **C** proves **A** and **B** really remove the extra access that a fresh hosted project hands out:

- Between its step 3 (empty `public`) and step 4 (run **A**), give `anon` and `authenticated` the default access a
  fresh hosted project gives them:

```bash
psql --variable ON_ERROR_STOP=1 --dbname "$DB" <<'SQL'
alter default privileges for role postgres in schema public grant all on tables to anon, authenticated;
alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated;
alter default privileges for role postgres in schema public grant all on functions to anon, authenticated;
SQL
```

- Between its step 5 (load the dump) and step 6 (run **B**), grant them everything on the objects that were just restored:

```bash
psql --variable ON_ERROR_STOP=1 --dbname "$DB" <<'SQL'
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;
grant all on all functions in schema public to anon, authenticated;
SQL
```

Then run **B** and **C** as written. All six rows of **C** must show `pass` = `t`, and the member and user counts
must match production. Record the result in the go-live record below. Do this drill again after any change to the
backup workflow or to the migrations.

## 9. Known issues

- **A Supabase request that never answers leaves the page on its loading skeleton.** The app has no client-side
  request timeout yet. On a slow link or while Supabase is waking up (the hosted project sometimes takes 2 to 10
  seconds or longer), a screen can sit on the skeleton instead of showing an error. Reload the page or pull to
  refresh. If it persists, check the Supabase dashboard and status page, and whether the project has paused.
- **Free projects pause after 7 idle days.** The "Keep Supabase awake" workflow prevents that (Mondays and Thursdays).
  A pause shows up as the problem above, on every screen. Resume the project in the dashboard.
- **The nightly encrypted backup is your backup.** Check Actions now and then: it fails loudly if the dump is missing
  members or users. Artifacts are kept for 90 days. A restore into a new project signs every member out (see
  `docs/ops/restore.md`).
- **Open security items** are listed in `SECURITY_AUDIT.md` (Phase 4).

## Go-live record

| Check | Date | Who | Result |
|---|---|---|---|
| Three sign-in methods on Android and iPhone | | | |
| Admin promotion and member refusal | | | |
| Role tests (member vs admin) green on a preview | | | |
| RLS suite green on main | | | |
| Lighthouse mobile perf / a11y | | | |
| Keep-alive and backup runs | | | |
| Restore test | | | |
