// bun run ledger:check -- [--target <ref>|local]
// Replays every imported month of Cycle 2026 through the close calculation and compares it with the workbook's figures
// (private.check_cycle). Read-only. Prints counts per reason code only; member-level detail goes to
// data/private/ledger-check.json, which is git-ignored and never leaves this machine. Exits 1 when any difference is
// unexplained. Like ledger:import it needs the owner connection and refuses production unless --target names it.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { connect, failure, groupId, guardedUrl, parseArgs } from './ledger-import.mjs'
import { CYCLE_2026 } from './ledger-workbook.mjs'

// Resolved against the repo, not the working directory, so a stray cwd can't write member detail outside data/private.
const DETAIL = fileURLToPath(new URL('../data/private/ledger-check.json', import.meta.url))

export function summarise(report) {
  return report.periods.map((p) => {
    const counts = {}
    for (const d of p.diff) counts[d.reason_code] = (counts[d.reason_code] ?? 0) + 1
    return { label: p.label, checked: p.checked, differences: p.diff.length, unexplained: counts.unexplained ?? 0, counts }
  })
}

export function reportLines(rows) {
  return rows.map((r) => {
    if (!r.checked) return `${r.label}: no workbook figures`
    const parts = Object.entries(r.counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([code, n]) => `${code} ${n}`)
    return `${r.label}: ${r.differences} differences${parts.length ? ` (${parts.join(', ')})` : ''}`
  })
}

// Same format as ledger-import's summaryLines (not imported: that file is edited elsewhere).
const kwacha = (n) => `K ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const ngwee = (n) => Math.round(Number(n) * 100)

/**
 * Totals only. `gs` is the latest closed month's group statement (or undefined); `pots` is the cycle's
 * txn_fee + membership - payout_fee up to that month, from the entries. Mirrors payout_preview's pot basis.
 */
export function reconcileLines(gs, pots) {
  if (!gs) return { lines: ['RECONCILIATION', '  No closed month yet: nothing to reconcile.'], mismatch: false }
  const held = ngwee(gs.idle_cash) + ngwee(gs.fee_pot_balance) + ngwee(gs.meeting_pot_balance)
  const statementPots = ngwee(gs.fee_pot_balance) + ngwee(gs.meeting_pot_balance)
  const diff = ngwee(pots) - statementPots
  return {
    lines: [
      `RECONCILIATION (${gs.label ?? 'latest closed month'})`,
      `  Money the group should be holding in its wallets (idle cash + fee pot + meeting pot): ${kwacha(held / 100)}`,
      '  Compare with the real Airtel + MTN balances.',
      diff === 0 ? '  Pots reconcile with the group statement.' : `  WARNING: pots differ by ${kwacha(diff / 100)} (entries minus group statement).`,
    ],
    mismatch: diff !== 0,
  }
}

/** Latest closed month's group statement and the pot total from the entries up to that month; read-only. */
async function readPots(sql, cycleId) {
  const [gs] = await sql`
    select gs.idle_cash, gs.fee_pot_balance, gs.meeting_pot_balance, p.label, p.month_index
    from group_statements gs join periods p on p.id = gs.period_id
    where p.cycle_id = ${cycleId}::uuid and p.status = 'closed'
    order by p.month_index desc limit 1`
  if (!gs) return {}
  // Same expression as public.payout_preview's v_pots, limited to the months the statement covers.
  const [{ pots }] = await sql`
    select coalesce(sum(case when l.kind = 'payout_fee' then -l.amount else l.amount end), 0) as pots
    from private.ledger_lines l
    where l.cycle_id = ${cycleId}::uuid and l.month_index <= ${gs.month_index} and l.kind in ('txn_fee', 'payout_fee', 'membership')`
  return { gs, pots }
}

/** Runs the check; returns the terminal lines and the exit code. */
export async function main(argv, detailPath = DETAIL) {
  const args = parseArgs(argv, { target: undefined })
  const sql = connect(guardedUrl(args.target, false))
  try {
    const group = await groupId(sql)
    const [row] = await sql`
      select private.check_cycle(id) as report from cycles
      where group_id = ${group}::uuid and label = ${CYCLE_2026.label} and starts_on = ${CYCLE_2026.starts_on}::date`
    if (!row) throw new Error(`No ${CYCLE_2026.label} on this group here yet. Run bun run ledger:import first.`)
    mkdirSync(dirname(detailPath), { recursive: true })
    writeFileSync(detailPath, JSON.stringify(row.report, null, 2), { mode: 0o600 })
    const rows = summarise(row.report)
    const unexplained = rows.reduce((n, r) => n + r.unexplained, 0)
    const lines = [...reportLines(rows), `Member-level detail: ${detailPath} (git-ignored; keep it on this machine)`]
    if (unexplained > 0) lines.push(`${unexplained} unexplained difference(s).`)
    const { gs, pots } = await readPots(sql, row.report.cycle_id)
    const rec = reconcileLines(gs, pots)
    lines.push(...rec.lines)
    return { lines, code: unexplained > 0 || rec.mismatch ? 1 : 0 }
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {})
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(
    ({ lines, code }) => {
      console.log(lines.join('\n'))
      process.exitCode = code
    },
    (e) => {
      console.error(failure('ledger:check', e))
      process.exit(1)
    },
  )
}
