// pgTAP runner for the hosted Supabase database (no Docker, no `supabase test db`).
// Each supabase/tests/database/*.sql file carries its own begin; ... rollback;.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import postgres from 'postgres'
import { clean } from './scrub.mjs'

const url = process.env.SUPABASE_DB_URL
if (!url) {
  console.error('SUPABASE_DB_URL is not set. Copy .env.example to .env.local and fill it in.')
  process.exit(1)
}

const dir = 'supabase/tests/database'

// A statement's result is a row array; a multi-statement string returns one per statement.
// pgTAP puts a test line and its diagnostics in one row, so split on newlines.
const lines = (res) =>
  (Array.isArray(res[0]) ? res.flat() : res).flatMap((row) => String(Object.values(row)[0]).split('\n'))

let sql
let failed = 0
// Everything that can throw, including building the client (a malformed URL throws a TypeError
// whose `input` is the full connection string), stays inside this try.
try {
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
  if (files.length === 0) throw new Error(`No .sql files in ${dir}`)

  sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} })
  await sql.unsafe('create extension if not exists pgtap with schema extensions').simple()

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
    await sql.unsafe('rollback').simple().catch(() => {})

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
  await sql?.end({ timeout: 5 }).catch(() => {})
}
process.exit(failed ? 1 : 0)
