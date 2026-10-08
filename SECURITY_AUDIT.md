# Security Audit — Premium Village Bank

Date: 2026-10-08 · Branch: `feat/foundation` (HEAD `0a4ccae` + this audit's fixes) · Reference: OWASP Top 10 (2021), OWASP ASVS 4.0.3

Scope: the whole repository plus the configuration of the hosted Supabase project it targets
(read through the Management API and read-only SQL). With the owner's approval the hosted project was
then changed: new migration applied with `db:push`, sign-ups disabled, password policy tightened,
SSL enforced. The hosted database held no user data at audit time.

Commits `f2686d3` and `0a4ccae` (Supabase client, persisted query cache, sign-out wipe, error text)
landed from parallel work during the audit and were reviewed too.

## Summary

| Severity | Found | Fixed | Open |
|---|---|---|---|
| Critical | 0 | 0 | 0 |
| High | 1 | 1 | 0 |
| Medium | 6 | 3 (M-4 partly) | 4 (M-3, M-5, M-6, rest of M-4) |
| Low | 10 | 3 | 7 |

The database layer is in good shape: RLS on every table, column-level grants, no write path to
`role`/`user_id`/`owner_user_id` from the client, definer functions locked down, and a pgTAP suite
that checks outsider/member/admin/owner access against every table and the view (IDOR included).
The serious problems are in **hosted project configuration**, which does not match `supabase/config.toml`.

---

## Phase 1 — Application map

### Stack
- **Frontend:** React 19 SPA, Vite 6, Tailwind 4, TanStack Query (planned IndexedDB persistence), `@supabase/supabase-js` 2. At audit time `src/` holds only the UI kit and a placeholder `App`; no auth, routing or data access yet.
- **Backend:** Supabase (hosted project). Postgres with RLS is the authorisation layer; PostgREST exposes schema `public` (and `graphql_public`). Supabase Auth (GoTrue) handles accounts.
- **Server code:** one Edge Function, `supabase/functions/invite-member` (Deno), `verify_jwt = true`. Not deployed yet.
- **Database code:** `supabase/migrations/*.sql` (schema, RLS, invites/admins/audit, bootstrap, hardening). Bootstrap functions live in schema `private` (not exposed, not executable by app roles).
- **Tooling:** `scripts/db-cli.mjs` (Supabase CLI wrapper: push/reset/types), `scripts/db-test.mjs` (pgTAP runner against the hosted DB), `scripts/seed-guard.mjs`, `scripts/scrub.mjs` (redacts secrets from output).
- **Background jobs, queues, webhooks, file storage, third-party payment/SMS integrations:** none. No storage buckets exist.
- **Deployment / CI:** no CI workflow and no hosting config committed yet. Comments point at Vercel for the frontend. No git remote configured.

### Entry points and untrusted input
| Entry point | Who can call | Input |
|---|---|---|
| PostgREST `/rest/v1/{groups,members,invites,cycles,cycle_rules,audit_log,group_members}` | `authenticated` (anon has no table grants) | query params, JSON bodies, filters |
| RPC `invite_preview(p_token)` | anon + authenticated | invite token |
| RPC `accept_invite(p_token)` | authenticated | invite token, JWT `email` claim |
| RPC `set_admin(p_member_id, p_make_admin)` | authenticated | ids |
| RPC `is_member`, `is_admin`, `can_see_figures` | authenticated | ids |
| Edge Function `POST /functions/v1/invite-member` | authenticated (JWT verified by platform) | `Authorization`, `Origin`, JSON `{memberId, email}` |
| Supabase Auth endpoints (`/auth/v1/*`) | anyone | sign-in/up, OTP, magic links, password reset |
| Invite link `SITE_URL/invite/<token>` (future frontend route) | anyone with the email | token in URL path |
| Browser `localStorage` (`pvb-theme`) | the user | compared against literals only |

### Sensitive data
- **Personal data:** member full names, short names, email addresses, phone numbers, account links (`user_id`).
- **Financial data:** savings/loan rules today (rates, penalties, loan multiples); contributions, loans and payouts are planned. Group-level privacy flag `figures_visibility`.
- **Credentials/secrets:** Supabase anon key (public), service-role key (Edge Function env only), DB URL/password and access token (`.env.local`, CLI only), invite tokens (stored as SHA-256 hashes).
- **Audit trail:** `audit_log` holds before/after snapshots of member rows (so also PII).
- No health data or data about minors. The group operates in Zambia (currency ZMW), so the **Zambia Data Protection Act No. 3 of 2021** applies; financial-services rules may apply if the group's activity is regulated.

### Roles
| Role | How it is determined | Allowed |
|---|---|---|
| anon | no JWT | `invite_preview` only |
| authenticated outsider | signed in, no active membership | nothing beyond its own JWT; RPCs return false/refuse |
| member | active `members` row linked to `auth.uid()` | read own group, own members row, group list view (no contact details), cycles and rules; accept an invite addressed to their email |
| admin | active member with `role = 'admin'` | everything a member can, plus: edit group name/visibility, add members, edit member contact details and status, create/revoke invites, promote/demote via `set_admin`, create/edit/delete **planned** cycles and their rules, read the audit log |
| owner | `groups.owner_user_id` | always admin of that group (cannot be removed or reassigned from the client) |
| service_role | Edge Function only | sends auth invite/OTP emails after RLS-checked steps |
| postgres | migrations, SQL editor | `private.*` bootstrap functions |

---

## Phase 2 — Findings

Status legend: **FIXED** (in this change set) · **OPEN** (reason given).

### H-1 · High · Public sign-up was enabled on the hosted project — FIXED
- **Where:** hosted Auth settings (`disable_signup = false`). `supabase/config.toml:177,222` says `enable_signup = false`, but that file only configures the local stack; it was never pushed.
- **Description:** the app is invite-only by design, yet anyone with the public anon key can create accounts. Email confirmation is on (`mailer_autoconfirm = false`), so an attacker cannot sign in as an address they don't control, but:
  - **Pre-account takeover:** an attacker registers `victim@example.com` with a password they choose, before the victim is invited. The account sits unconfirmed. When an admin later invites the victim, `inviteUserByEmail` reports "already registered" and the function sends a magic link instead; the victim clicking it confirms the account — whose password the attacker may still know. The attacker then signs in as the victim, after the victim has accepted the invite, and sees what a member sees. (Not reproduced against live Auth; GoTrue's handling of the old password on confirmation is the deciding detail. The fix is the same either way.)
  - Confirmation-email abuse against arbitrary addresses and junk accounts in `auth.users`.
- **Fix (done, approved):** `disable_signup = true` on the hosted project via the Management API. Invites (`auth.admin.inviteUserByEmail`) and `signInWithOtp({ shouldCreateUser: false })` keep working with sign-ups disabled.

### M-1 · Medium · `db:test` talked to the hosted database in plaintext — FIXED
- **Where:** `scripts/db-test.mjs:32`; hosted "SSL enforcement" is off; `SUPABASE_DB_URL` has no `sslmode`.
- **Description:** postgres.js does not use TLS unless asked, and the pooler accepts plaintext. Authentication is SCRAM (the password itself is not sent), but every statement and result — the whole test run, and any real data once it exists — crossed the internet unencrypted and was open to tampering on a hostile network.
- **Fix (done):** `ssl: 'require'` for any non-localhost URL (reuses `isLocalUrl` from `seed-guard.mjs`). Verified: the run still passes with TLS required, and postgres.js aborts if the server refuses TLS. The Supabase CLI (`db:push`/`db:reset`) uses pgx, which already prefers TLS.
- **Fix (done, approved):** SSL enforcement turned on for the hosted database. Verified: a plaintext connection is now refused with `ESSLREQUIRED`; `db:test` and `db:push` still work.
- **Remaining hardening:** `'require'` does not verify the certificate; for `verify-full`, download the project CA from the dashboard.

### M-2 · Medium · Weak password policy on the hosted project — FIXED
- **Where:** hosted Auth: `password_min_length = 6`, no character requirements, leaked-password (HIBP) check off, no re-authentication to change a password. Local `config.toml:183-186,229` matches.
- **Exploit:** password spraying / credential stuffing against members and admins of a money-handling app; a hijacked session can change the password without knowing the old one.
- **Fix (done, approved):** hosted project now has minimum length 12 (ASVS 2.1.1), letters + digits required, and re-authentication required to change a password. `config.toml` updated to match for the local stack. **User-facing:** members must pick passwords meeting the new rules. Still open: HIBP leaked-password check (paid plans).

### M-3 · Medium · No MFA enforcement for admins — OPEN (product decision)
- **Where:** RLS policies in `20261008000200_access_rls.sql`; TOTP is enabled on the hosted project but nothing requires `aal2`.
- **Exploit:** a phished admin password gives full control of the group's member list, invites, roles and loan rules.
- **Fix:** once the UI supports enrolment, add restrictive policies (or a check in `is_admin`) requiring `auth.jwt() ->> 'aal' = 'aal2'` for admin writes. Needs an enrolment flow first, so it belongs with the auth UI work.

### M-4 · Medium · The hosted project doubles as the dev/test database — PARTLY FIXED
- **Where:** `scripts/db-cli.mjs:14`, `scripts/db-test.mjs`, `package.json` scripts; README describes the hosted project as the target.
- **Description:** `bun run db:reset` runs `supabase db reset --yes` against `SUPABASE_DB_URL`, which **wipes every table** with no prompt. `db:test` creates `auth.users` rows and a temporary `tests` schema of security-definer functions on the same database (dropped after each run, and not exposed through the API). Harmless while the database is empty; once real member and money data lives there, one command destroys it.
- **Fix (done, approved):** `db:reset` refuses any `SUPABASE_DB_URL` naming `PROD_PROJECT_REF` (new, in `.env.example`). Tested in `scripts/seed-guard.test.mjs` and proven against the real URL (exit 1, nothing run).
- **Open:** create the production project separately and set `PROD_PROJECT_REF` to its ref in every `.env.local`; while it is unset, the guard does nothing. `db:test` has no such guard yet.

### M-5 · Medium · No security headers or CSP; sessions live in `localStorage` — FIXED
- **Where:** no `vercel.json` / hosting config; `index.html` loads `/theme-init.js` (external file, so a strict CSP without `'unsafe-inline'` scripts is achievable).
- **Description:** supabase-js keeps the session (access + refresh token) in `localStorage`, so any XSS means account takeover; CSP is the main backstop. Invite tokens travel in the URL path, so `Referrer-Policy` matters too (see L-6). Nothing is deployed, so nothing is exposed today.
- **Fix (done):** `vercel.json` now serves the CSP (enforced), HSTS, `nosniff`, `Referrer-Policy: no-referrer` and `Permissions-Policy` on every path, with `frame-ancestors 'none'` in place of `X-Frame-Options`; `vite preview` mirrors the CSP.
- **Original recommendation:** serve
  `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://<ref>.supabase.co wss://<ref>.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`,
  `Strict-Transport-Security: max-age=63072000; includeSubDomains`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `X-Frame-Options: DENY`. Check the CSP against the built app (PWA service worker, fonts) before enforcing; start with `Content-Security-Policy-Report-Only`.

### M-6 · Medium · Vulnerable dev dependencies (vitest) — OPEN (major upgrade decision)
- **Where:** `vitest@3.2.7` → `tinypool@1.1.1` (2 × **critical** prototype-pollution-to-RCE: GHSA-5gmw-xhrv-c9v3, GHSA-85c8-ppgw-ccpr) and `@vitest/mocker` (moderate path traversal: GHSA-82fw-gwwq-j7x9). `bun audit` output, 2026-10-08.
- **Practical risk:** dev/test only, never in the production bundle; exploitation needs attacker control of worker options or mock paths in the test run. Rated Medium rather than Critical for that reason.
- **Fix:** upgrade vitest to ≥ 4.1.11 (latest 5.0.3). No 3.x release fixes it (vitest 3 pins `tinypool ^1`). A major upgrade may need test config changes.

### L-1 · Low · Definer functions searched `pg_temp` first — FIXED
- **Where:** all 8 `security definer` functions in `public` had `search_path = public`.
- **Description:** PostgreSQL searches `pg_temp` before the path for relations unless it is listed explicitly, so a session able to create temp tables (app roles hold `TEMP`) could shadow `members`/`groups` inside a definer function. Not reachable through PostgREST (no arbitrary SQL), so defence in depth.
- **Fix (done):** `20261008000500_security_hardening.sql` sets `search_path = public, pg_temp` on every one. Test: `05_hardening.sql` fails if any public definer function lacks it.

### L-2 · Low · Invite lifetime was client-controlled — FIXED
- **Where:** `invites.expires_at` is insertable by admins directly through PostgREST, bypassing the Edge Function's 14-day TTL.
- **Exploit:** an admin (or a hijacked admin session) mints an invite valid for years.
- **Fix (done):** check constraint `expires_at <= created_at + interval '15 days'` (one day slack for clock skew; `created_at` is not client-writable). Behaviour change: direct inserts with longer expiry now fail with `23514`. Test: `05_hardening.sql`.

### L-3 · Low · Edge Function fell back to `http://localhost:3000` — FIXED
- **Where:** `supabase/functions/invite-member/index.ts:4`.
- **Description:** a deployment missing `SITE_URL` would have emailed invite links to localhost and allowed localhost in CORS, silently.
- **Fix (done):** the function now refuses to start without `SITE_URL`. Behaviour change: local `supabase functions serve` needs `--env-file supabase/functions/.env` (as the example file already says).

### L-4 · Low · Database reachable from any IP — OPEN (infrastructure decision)
- **Where:** hosted network restrictions `0.0.0.0/0`, `::/0`.
- **Fix:** restrict to developer/CI egress IPs once known. Password strength of the DB user is then the only other barrier.

### L-5 · Low · Audit gaps — OPEN
- **Where:** `20261008000300_invites_admins_audit.sql:46-50`.
- **Description:** deletes of planned `cycles`/`cycle_rules` are not audited (triggers are insert/update only); `audit_log` has no retention policy and keeps member PII snapshots forever.
- **Fix:** add `after delete` triggers (write_audit needs to read `OLD` on delete); define retention when financial records arrive. Low while only planned cycles are deletable.

### L-6 · Low · Invite token in the URL path — FIXED
- **Where:** `invite-member/index.ts:75` builds `SITE_URL/invite/<token>`.
- **Description:** URLs leak through Referer, browser history, and logs. Mitigated: tokens are 256-bit, single-use, expire, are stored hashed, and `accept_invite` also requires the signed-in email to match.
- **Fix:** `Referrer-Policy: no-referrer` (M-5) is the control, set in `vercel.json`. `history.replaceState` is deliberately not used: the invite page reloads to the same URL after sign-out and for retry, and acceptance navigates with replace.

### L-7 · Low · Edge Function dependencies unpinned — OPEN
- **Where:** `index.ts:1` imports `jsr:@supabase/supabase-js@2`; `deno.lock` is gitignored.
- **Fix:** pin an exact version and commit `deno.lock` so deploys are reproducible.

### L-8 · Low · Real member names in source — OPEN (owner decision)
- **Where:** `20261008000400_bootstrap.sql:181-188` (18 names, some full names).
- **Description:** personal data in git history. Fine for a private repo; a problem if it is ever made public or shared.
- **Fix:** keep the repo private, or move the roster to a non-committed SQL file run once from the SQL editor.

### L-10 · Low · Account enumeration in sign-in messages — OPEN (user-facing copy)
- **Where:** `src/lib/errors.ts:66,97,99` (from `f2686d3`).
- **Description:** passwordless sign-in with `shouldCreateUser: false` makes Auth answer differently for unknown emails, and the app shows "We couldn't find an account for that email". Anyone can then test whether an address belongs to a member of this savings group. `Email not confirmed` vs `Invalid login credentials` leaks the same thing more weakly.
- **Fix:** show one message for both cases ("If you have an invite, we've sent you a sign-in link"). A UX change, so left for the owner; the sign-in screen does not exist yet.

### L-9 · Low · Raw errors logged by the Edge Function — OPEN
- **Where:** `invite-member/index.ts:93` `console.error('invite-member failed', err)`.
- **Description:** Supabase errors can contain the invitee's email; function logs then hold PII. Responses are already generic (`invite_failed`), so nothing leaks to clients.
- **Fix:** log `err.name`/`err.code`/status only.

### Informational / pre-release configuration
- Hosted `site_url` is `http://localhost:3000` and the redirect allow-list is empty: set both to the production origin before launch, or auth emails point at localhost.
- No custom SMTP: Supabase's default mailer sends only to project team members and 2 emails/hour, so invites to real members will not arrive.
- Refresh-token rotation is on (reuse window 10 s), JWT expiry 1 h. Session timebox/inactivity timeout are off (paid-plan features).
- No per-account lockout; GoTrue rate-limits sign-in per IP. Add CAPTCHA (Turnstile/hCaptcha) to sign-in if password login is exposed publicly.
- `accept_invite` trusts the JWT `email` claim. Safe only while email confirmation stays on (`mailer_autoconfirm = false`) — keep it on.
- Encryption at rest: Supabase disk encryption only; no column-level encryption. Acceptable for this data; revisit if national ID or bank account numbers are added.
- Backups: confirm the plan's backup/PITR coverage and do a test restore before real money data goes in.
- Data subject rights (Zambia DPA 2021): no export or deletion path yet; `groups.owner_user_id` is `on delete restrict`, so the owner's account cannot be deleted while the group exists.

### Areas checked with no findings
- **Authorization / IDOR:** every table has RLS and column-level grants; `group_id`, `role`, `user_id`, `owner_user_id`, `status` on cycles and `created_by` spoofing are all blocked. The member-list view is select-only and filtered by `is_member`. The pgTAP suite proves cross-group reads/writes fail for every role. The Edge Function does every lookup and write as the caller (RLS applies) and uses the service role only to send the email.
- **Business logic:** cycle status cannot be set from the client; cycle and rule edits only while `planned`; last-admin guard is enforced by trigger with row locking; invites are single-use, expiring, email-bound, revocation is one-way. `loan_multiples`/`tenor_bands` contents are only type-checked (arrays); validate them server-side when calculations start depending on them.
- **Injection:** no dynamic SQL in plpgsql; the client uses the PostgREST query builder; `spawnSync` gets an argument array (no shell); `sql.unsafe` only runs repository test files.
- **XSS:** React escaping only; no `dangerouslySetInnerHTML`, `innerHTML` or `eval`. (CSP: see M-5.)
- **CSRF:** not applicable — auth is a bearer token in the `Authorization` header, not a cookie.
- **SSRF:** not applicable — no server-side fetch of user-supplied URLs.
- **File uploads/downloads:** not applicable — no storage buckets or upload code.
- **CORS:** Edge Function reflects only exact-match allowed origins, otherwise `SITE_URL`; `Vary: Origin` set. PostgREST CORS is Supabase-managed (`*`), fine for bearer-token auth.
- **Secrets:** `.env.local` and `supabase/functions/.env` are gitignored; full git history scanned for JWTs, `sbp_` tokens, DB URLs and the actual `.env.local` values — only local defaults/placeholders found. The built `dist/` contains no server secrets. Output scrubbing in `scrub.mjs` is in place.
- **Token handling:** invite tokens are 32 random bytes (CSPRNG), stored as SHA-256 (fine for high-entropy tokens); never logged; `token_hash` stripped from audit snapshots.
- **Seed safety:** `seed.sql` (public passwords) is blocked from non-localhost databases by `seed-guard.mjs`, with tests.
- **GraphQL / query limits:** pg_graphql respects the same grants and RLS; PostgREST `max_rows = 1000`.
- **Error handling:** the Edge Function returns fixed error codes, no stack traces; DB functions raise named codes only.

---

## Phase 3 — What changed

| Finding | Change | Behaviour change | Proof |
|---|---|---|---|
| M-1 | `scripts/db-test.mjs`: `ssl: 'require'` off localhost | `db:test` fails instead of falling back to plaintext | full `db:test` run passes over TLS |
| L-1 | `supabase/migrations/20261008000500_security_hardening.sql`: `search_path = public, pg_temp` on all 8 definer functions | none | `05_hardening.sql` (red before, green after) |
| L-2 | same migration: `invites_ttl` check constraint | direct invite inserts > 15 days rejected (`23514`) | `05_hardening.sql` (red before, green after) |
| L-3 | `invite-member/index.ts`: no `SITE_URL` fallback | function refuses to start without `SITE_URL` | `deno check` passes |
| M-4 | `scripts/seed-guard.mjs` `targetsProject`, used by `scripts/db-cli.mjs`; `PROD_PROJECT_REF` in `.env.example` | `db:reset` exits 1 for the production ref | new test in `seed-guard.test.mjs` (red, then green); real run refused |
| H-1, M-2 | Hosted Auth (Management API): `disable_signup`, `password_min_length = 12`, letters+digits, re-auth for password change; `supabase/config.toml` matched for local | no public sign-up; stricter passwords | settings read back from the API |
| M-1 | Hosted SSL enforcement on | plaintext DB connections refused | plaintext attempt fails with `ESSLREQUIRED` |

The new migration has been applied to the hosted project with `bun run db:push`.
Verification after the changes: `db:test` 6/6 files ok, `vitest` 96/96, `fn:test` 9/9, `lint` and `typecheck` clean.

## Phase 4 — Open items and why

| ID | Why it is open |
|---|---|
| L-4 | IP allow-list needs the CI/developer egress IPs |
| M-3 | Needs an MFA enrolment UI and a product decision on who must use it |
| M-4 (rest) | Production project not created yet; set `PROD_PROJECT_REF` when it is |
| M-5, L-6, L-10 | Hosting and the sign-in/invite screens do not exist yet |
| M-6 | Major-version dependency upgrade, deferred by the owner to its own change |
| L-5, L-7, L-9 | Low; scheduled for the next feature touching those files |
| L-8 | Owner decision on repo visibility |

## Pre-release security checklist

Hosted Supabase project (production)
- [ ] Sign-ups disabled (`disable_signup = true`); anonymous sign-ins off
- [ ] Email confirmation on (`mailer_autoconfirm = false`) — `accept_invite` depends on it
- [ ] Password policy: min length ≥ 12, character requirements, HIBP if available, re-auth for password change
- [ ] `site_url` = production origin; redirect allow-list = production origin(s) only
- [ ] Custom SMTP configured; email rate limits set deliberately
- [ ] SSL enforcement on; network restrictions limited to known IPs
- [ ] MFA (TOTP) required for admins and the owner; RLS checks `aal2` for admin writes
- [ ] Production is a separate project from dev/test; `db:reset` and `db:test` never point at it
- [ ] Backups/PITR confirmed and a restore tested
- [ ] Database password rotated if it was ever pasted outside `.env.local`; access token scoped to a CI/bot account where possible

Edge Functions
- [ ] `SITE_URL` and `ALLOWED_ORIGINS` secrets set to production origins only (no localhost)
- [ ] `verify_jwt = true` on every function
- [ ] supabase-js import pinned and `deno.lock` committed
- [ ] Logs contain no emails, tokens or service-role key

Frontend / hosting
- [ ] HTTPS only, HSTS, CSP (no `unsafe-inline` scripts), `frame-ancestors 'none'`, `Referrer-Policy: no-referrer`, `nosniff`, Permissions-Policy
- [ ] Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the bundle; grep the build for `service_role`, `postgres://`, `sbp_`
- [ ] Invite page removes the token from the URL after reading it
- [ ] Sign-in shows the same message for unknown and known emails (L-10)
- [ ] Sign-out calls `supabase.auth.signOut()` and clears the persisted TanStack Query cache in IndexedDB (it will hold member/financial data)
- [ ] Source maps not publicly served, or contain nothing sensitive

Database
- [ ] `bun run db:test` green against a non-production database with every new migration
- [ ] Every new table: RLS enabled, `revoke all`, explicit column grants, outsider/member/admin tests
- [ ] Every new function: `revoke execute from public, anon, authenticated` then grant; definer functions set `search_path = public, pg_temp`
- [ ] Money values computed or verified in the database, never trusted from the client
- [ ] `bun audit` shows no high/critical in runtime dependencies
