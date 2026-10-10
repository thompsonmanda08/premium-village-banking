// bun run ledger:import -- [--target <ref>|local] [--through Sep] [--write] [--dir data/content]
// Imports the 2026 treasurer workbooks (git-ignored, data/content/) into Cycle 2026 of Premium Village Banking.
// Local only, never in CI. Without --write it runs the whole import inside a transaction, prints counts and totals,
// and rolls back. The money maths is all in SQL (private.import_history); this file only reads cells.
// SUPABASE_DB_URL (bun loads .env.local) must be the owner connection: no app role can execute anything in `private`.
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'
import { CYCLE_2026, MONTHS, monthIndex, pickWorkbook, readBundle } from './ledger-workbook.mjs'
import { clean } from './scrub.mjs'
import { importRefusal, isLocalUrl } from './seed-guard.mjs'

const GROUP_NAME = 'Premium Village Banking'
// The most months private.import_history takes (through November).
const LAST_IMPORTABLE = 10

/** Options are the keys of `spec`: a boolean default is a flag, anything else takes a value. Nothing else is accepted. */
export function parseArgs(argv, spec = { target: undefined, through: undefined, write: false, dir: 'data/content' }) {
  const out = { ...spec }
  const valid = `Valid options: ${Object.keys(spec).map((k) => `--${k}`).join(', ')}`
  const seen = new Set()
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--') continue
    const key = a.startsWith('--') ? a.slice(2) : undefined
    if (key === undefined) throw new Error(`Unexpected argument ${a}. ${valid}`)
    if (!Object.hasOwn(spec, key)) throw new Error(`Unknown option ${a}. ${valid}`)
    if (typeof spec[key] === 'boolean') out[key] = true
    else {
      const v = argv[++i]
      if (!v || v.startsWith('--')) throw new Error(`${a} needs a value`)
      if (seen.has(key)) throw new Error(`--${key} given twice`)
      seen.add(key)
      out[key] = v
    }
  }
  return out
}

/** --through as a cycle month, 1 (Feb) to 10 (Nov); undefined means the latest workbook in the folder. */
export function throughMonth(v) {
  if (v === undefined) return undefined
  let n = Number.NaN
  if (/^\d+$/.test(v)) n = Number(v)
  else {
    try {
      n = monthIndex(v)
    } catch {
      // reported below
    }
  }
  if (!(n >= 1 && n <= LAST_IMPORTABLE)) {
    throw new Error(`--through takes a month from Feb to Nov, by name (Sep, September) or number (1 to 10), not "${v}"`)
  }
  return n
}

const kwacha = (n) => `K ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** Counts and totals only: nothing per member ever reaches the terminal. */
export function summaryLines(s, wrote) {
  const r = s.receipts_not_imported
  const lines = [
    `${wrote ? 'IMPORTED' : 'DRY RUN (nothing written)'}: ${CYCLE_2026.label}, ${MONTHS[0]} to ${MONTHS[s.months - 1]}`,
    `  members ${s.members}, entries ${s.entries}, loans ${s.loans} (${s.open_loans} still owed)`,
    `  savings ${kwacha(s.savings)}, owed ${kwacha(s.owed)}, idle cash ${kwacha(s.idle_cash)}`,
    `  fee pot ${kwacha(s.fee_pot_balance)}, meeting pot ${kwacha(s.meeting_pot_balance)}`,
    // The last imported month's receipts arrive in the first app month's window and are entered there.
    `  ${r.count} receipt${r.count === 1 ? '' : 's'} totalling ${kwacha(r.total)} left out: enter these in ${MONTHS[s.months]}`,
  ]
  if (s.fee_pot_balance < 0 || s.meeting_pot_balance < 0) {
    lines.push('WARNING: a pot is negative. Reconcile idle cash + fee pot + meeting pot with the real wallet balances before the first month opens.')
  }
  return lines
}

/** The database URL from the environment, once the guard has passed it. */
export function guardedUrl(target, write) {
  const url = process.env.SUPABASE_DB_URL
  if (!url) throw new Error('SUPABASE_DB_URL is not set (see .env.example).')
  const refusal = importRefusal(url, process.env.PROD_PROJECT_REF, target, write)
  if (refusal) throw new Error(refusal)
  return url
}

// postgres.js connects in plaintext unless told otherwise: require TLS off localhost (as db-test.mjs does). No prepared
// statements, so the Supabase pooler works.
export const connect = (url) => postgres(url, { max: 1, prepare: false, onnotice: () => {}, ssl: isLocalUrl(url) ? false : 'require' })

export async function groupId(sql) {
  const rows = await sql`select id from groups where name = ${GROUP_NAME}`
  if (rows.length === 0) throw new Error(`No "${GROUP_NAME}" group in this database. Bootstrap it first (docs/ops/setup.md).`)
  if (rows.length > 1) throw new Error(`${rows.length} groups are named "${GROUP_NAME}" in this database; expected one.`)
  return rows[0].id
}

/** One line for the terminal. Every message goes through clean(): no connection string or password is ever printed. */
export function failure(cmd, e) {
  if (e?.code === '42501') {
    if (e.message === 'not_admin') return `${cmd} failed: the group was not found in this database.`
    return `${cmd} failed: ${clean(e.message)}. Use the owner connection: SUPABASE_DB_URL must be the database URL for the postgres role.`
  }
  // The DETAIL of a refusal can list unmatched workbook names; it stays on this terminal.
  const detail = e?.detail ? ` (${e.detail})` : ''
  return `${cmd} failed: ${clean(e?.message ?? e)}${clean(detail)}`
}

const ROLLBACK = Symbol('dry run')

/** Runs the import (or the dry run) and returns the summary lines. */
export async function main(argv) {
  const args = parseArgs(argv)
  const wanted = throughMonth(args.through)
  const url = guardedUrl(args.target, args.write)

  const { file, through } = pickWorkbook(readdirSync(args.dir), wanted)
  if (through > LAST_IMPORTABLE) throw new Error(`The latest workbook is for ${MONTHS[through - 1]}; name --through (Feb to Nov).`)
  const bundle = await readBundle(join(args.dir, file), through)

  const sql = connect(url)
  try {
    const group = await groupId(sql)
    let summary
    try {
      // Use sql.json() helper to send bundle as jsonb (not text). Can't use tx.json inside begin
      // because transaction-scoped sql objects don't inherit helpers from the outer connection.
      await sql.unsafe('begin')
      const [row] = await sql`select private.import_history(${group}::uuid, ${sql.json(bundle)}) as summary`
      summary = row.summary
      if (!args.write) {
        await sql.unsafe('rollback')
      } else {
        await sql.unsafe('commit')
      }
    } catch (e) {
      await sql.unsafe('rollback').catch(() => {})
      throw e
    }
    return summaryLines(summary, args.write)
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {})
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(
    (lines) => console.log(lines.join('\n')),
    (e) => {
      console.error(failure('ledger:import', e))
      process.exit(1)
    },
  )
}
