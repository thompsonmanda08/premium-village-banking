// pnpm ledger:figures -- [--target <ref>|local] [--through Oct] [--write] [--dir data/content]
// Loads the treasurer's figures for a month the app runs LIVE (private.load_workbook_figures), so the month close can
// show the app's statement next to the workbook's. Only comparison figures are stored: nothing in the ledger changes.
// Local only, never in CI. Without --write it runs inside a transaction, prints counts and rolls back. Like
// ledger:import it needs the owner connection (SUPABASE_DB_URL) and refuses production unless --target names it.
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { connect, failure, groupId, guardedUrl, parseArgs, throughMonth } from './ledger-import.mjs'
import { MONTHS, pickWorkbook, readBundle } from './ledger-workbook.mjs'

/** The last month of a parsed workbook bundle, as private.load_workbook_figures takes it. */
export function figuresBundle(bundle) {
  const month = bundle.months.at(-1)
  return {
    month_index: month.month_index,
    group: month.group,
    rows: month.rows.map((r) => ({ name: r.name, cum_savings: r.cum_savings, excess: r.excess, total: r.total, minimum: r.minimum })),
  }
}

/** Counts only: nothing per member reaches the terminal. */
export function summaryLines(s, wrote) {
  return [
    `${wrote ? 'LOADED' : 'DRY RUN (nothing written)'}: workbook figures for ${s.label} (${s.status})`,
    `  ${s.members} members, ${s.member_figures} member figures, ${s.group_figures} group figures`,
  ]
}

/** Runs the load (or the dry run) and returns the summary lines. */
export async function main(argv) {
  const args = parseArgs(argv)
  const wanted = throughMonth(args.through)
  const url = guardedUrl(args.target, args.write)

  const { file, through } = pickWorkbook(readdirSync(args.dir), wanted)
  const figures = figuresBundle(await readBundle(join(args.dir, file), through))

  const sql = connect(url)
  try {
    const group = await groupId(sql)
    let summary
    try {
      await sql.unsafe('begin')
      const [row] = await sql`select private.load_workbook_figures(${group}::uuid, ${sql.json(figures)}) as summary`
      summary = row.summary
      await sql.unsafe(args.write ? 'commit' : 'rollback')
    } catch (e) {
      await sql.unsafe('rollback').catch(() => {})
      throw e
    }
    return [`Workbook: ${MONTHS[through - 1]} statement`, ...summaryLines(summary, args.write)]
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {})
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(
    (lines) => console.log(lines.join('\n')),
    (e) => {
      console.error(failure('ledger:figures', e))
      process.exit(1)
    },
  )
}
