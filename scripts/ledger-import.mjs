// bun run ledger:import <group-id> <workbook-or-folder> [through]
// Reads a treasurer's workbook into a bundle (ledger-workbook.mjs) and hands it to private.import_history, which works
// out every amount in SQL. Prints one JSON object: the import's summary, or {error, message[, detail]} (exit code 1).
// `through` is a month name or number (Feb or 1); omitted, it is the latest month among the workbooks. The database is
// the one SUPABASE_DB_URL names (bun loads .env.local); a re-run replaces the import's own rows.
import { readdirSync, statSync } from 'node:fs'
import { basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'
import { friendlyError } from '../src/lib/errors.ts'
import { MONTHS, pickWorkbook, readBundle } from './ledger-workbook.mjs'
import { isLocalUrl } from './seed-guard.mjs'
import { clean } from './scrub.mjs'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const usage = (message) => ({ error: 'usage', message })

export async function runImport(groupId, path, through) {
  const url = process.env.SUPABASE_DB_URL
  if (!UUID.test(groupId ?? '')) return usage('Usage: bun run ledger:import <group-id> <workbook-or-folder> [through]')
  if (!path) return usage('Give the workbook, or the folder that holds the workbooks.')
  if (!url) return usage('SUPABASE_DB_URL is not set. Copy .env.example to .env.local and fill it in.')

  let sql
  try {
    const dir = statSync(path).isDirectory()
    const month = /^\d+$/.test(through ?? '') ? MONTHS[Number(through) - 1] : through
    const picked = pickWorkbook(dir ? readdirSync(path) : [basename(path)], month)
    const bundle = await readBundle(dir ? `${path}/${picked.file}` : path, picked.through)

    sql = postgres(url, { max: 1, prepare: false, onnotice: () => {}, ssl: isLocalUrl(url) ? false : 'require' })
    const [{ summary }] = await sql`select private.import_history(${groupId}::uuid, ${JSON.stringify(bundle)}::jsonb) as summary`
    return summary
  } catch (e) {
    // A business refusal (P0001 / 42501) names its code in the message; anything else is a workbook or connection problem.
    if (e?.code === 'P0001' || e?.code === '42501') {
      return { error: e.message, message: friendlyError({ code: e.code, message: e.message }), ...(e.detail && { detail: clean(e.detail) }) }
    }
    return { error: 'import_failed', message: clean(e?.message ?? e) }
  } finally {
    await sql?.end({ timeout: 5 }).catch(() => {})
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const out = await runImport(...process.argv.slice(2, 5))
  console.log(JSON.stringify(out, null, 2))
  process.exit('error' in out ? 1 : 0)
}
