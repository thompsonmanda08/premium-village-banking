// pgTAP runner for the hosted Supabase database (no Docker, no `supabase test db`).
// Each supabase/tests/database/*.sql file carries its own begin; ... rollback;.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import postgres from 'postgres'

const url = process.env.SUPABASE_DB_URL
if (!url) {
  console.error('SUPABASE_DB_URL is not set. Copy .env.example to .env.local and fill it in.')
  process.exit(1)
}

// Never let the connection string or password reach the terminal.
const secrets = [url, process.env.SUPABASE_DB_PASSWORD].filter(Boolean)
const clean = (s) =>
  secrets
    .reduce((acc, v) => acc.split(v).join('[redacted]'), String(s))
    .replace(/postgres(ql)?:\/\/\S*/g, '[db-url]')

const dir = 'supabase/tests/database'
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
if (files.length === 0) {
  console.error(`No .sql files in ${dir}`)
  process.exit(1)
}

const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} })
let failed = 0

// A statement's result is a row array; a multi-statement string returns one per statement.
const lines = (res) =>
  (Array.isArray(res[0]) ? res.flat() : res).map((row) => String(Object.values(row)[0]))

try {
  await sql.unsafe('create extension if not exists pgtap with schema extensions').simple()

  for (const file of files) {
    let tap = []
    let error = null
    try {
      tap = lines(await sql.unsafe(readFileSync(join(dir, file), 'utf8')).simple())
    } catch (e) {
      error = clean(e.message)
      await sql.unsafe('rollback').simple().catch(() => {})
    }
    const bad =
      error !== null ||
      tap.some((l) => /^not ok|^# Looks like you (planned|failed)/.test(l))
    if (bad) failed++
    console.log(`${file} .. ${bad ? 'FAILED' : 'ok'}`)
    if (bad) {
      for (const l of tap) console.log(`  ${clean(l)}`)
      if (error) console.log(`  error: ${error}`)
    }
  }
} catch (e) {
  console.error(`db:test could not run: ${clean(e.message)}`)
  failed = 1
} finally {
  await sql.end({ timeout: 5 })
}
process.exit(failed ? 1 : 0)
