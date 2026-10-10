// pgTAP runner for a Postgres reached by SUPABASE_DB_URL: the local stack (`bun run db:start`), never production.
// Each supabase/tests/database/*.sql file carries its own begin; ... rollback;.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import postgres from 'postgres'
import { clean } from './scrub.mjs'
import { hostedWithoutRef, isLocalUrl, testRefusal } from './seed-guard.mjs'

const url = process.env.SUPABASE_DB_URL
if (!url) {
  console.error('SUPABASE_DB_URL is not set. Copy .env.example to .env.local and fill it in.')
  process.exit(1)
}

const refusal = testRefusal(url, process.env.PROD_PROJECT_REF)
if (refusal) {
  console.error(refusal)
  process.exit(1)
}
if (hostedWithoutRef(url, process.env.PROD_PROJECT_REF)) {
  console.error('PROD_PROJECT_REF is not set (.env.local). Set it so production can be identified before running tests.')
  process.exit(1)
}

const dir = 'supabase/tests/database'

// A statement's result is a row array; a multi-statement string returns one per statement.
// pgTAP puts a test line and its diagnostics in one row, so split on newlines.
const lines = (res) =>
  (Array.isArray(res[0]) ? res.flat() : res).flatMap((row) => String(Object.values(row)[0]).split('\n'))

let sql
let failed = 0

// 00_helpers.sql leaves schema `tests` behind: security definer functions that write auth.users,
// executable by anon/authenticated. On the hosted database that must not outlive a run, so it is
// dropped before the first file (stale leftovers) and again after the last (finally below).
const dropHelpers = async () => {
  await sql.unsafe('rollback').simple().catch(() => {})
  await sql
    .unsafe('drop schema if exists tests cascade')
    .simple()
    .catch((e) => console.error(`warning: could not drop schema tests: ${clean(e?.message ?? e)}`))
}

// Everything that can throw, including building the client (a malformed URL throws a TypeError
// whose `input` is the full connection string), stays inside this try.
try {
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
  if (files.length === 0) throw new Error(`No .sql files in ${dir}`)

  // postgres.js connects in plaintext unless told otherwise, and the pooler accepts that: require TLS off localhost.
  sql = postgres(url, { max: 1, prepare: false, onnotice: () => {}, ssl: isLocalUrl(url) ? false : 'require' })
  await sql.unsafe('create extension if not exists pgtap with schema extensions').simple()
  await dropHelpers()

  for (const file of files) {
    let tap = []
    let error = null
    try {
      tap = lines(await sql.unsafe(readFileSync(join(dir, file), 'utf8')).simple())
    } catch (e) {
      error = clean(e?.message ?? e)
    }
    // Always roll back, so a file that forgot its own rollback; can't leak a transaction
    // (or its rows) into the next file. A stray rollback is only a notice.
    // Then drop temp tables: pgTAP keeps its plan there, and 00_helpers.sql runs outside a
    // transaction, so its plan() would otherwise survive and make the next file "plan twice".
    await sql.unsafe('rollback').simple().catch(() => {})
    await sql.unsafe('discard temp').simple().catch(() => {})

    const ran = tap.filter((l) => /^(not )?ok\b/.test(l)).length
    const plan = tap.map((l) => /^1\.\.(\d+)/.exec(l)).find(Boolean)
    const notes = []
    if (error !== null) notes.push(`error: ${error}`)
    else if (ran === 0) notes.push('no test output')
    if (plan && ran !== Number(plan[1])) notes.push(`plan says ${plan[1]} tests but ${ran} ok/not ok lines`)
    const bad =
      notes.length > 0 || tap.some((l) => /^not ok|^# Looks like you (planned|failed)/.test(l))

    console.log(`${file} .. ${bad ? 'FAILED' : 'ok'}`)
    if (bad) {
      failed++
      for (const l of tap) console.log(`  ${clean(l)}`)
      for (const n of notes) console.log(`  ${n}`)
    }
  }
} catch (e) {
  console.error(`db:test could not run: ${clean(e?.message ?? e)}`)
  failed = 1
} finally {
  if (sql) await dropHelpers().catch(() => {})
  await sql?.end({ timeout: 5 }).catch(() => {})
}
process.exit(failed ? 1 : 0)
