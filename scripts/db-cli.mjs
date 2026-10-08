// Runs the Supabase CLI against the hosted project: push | reset | types.
// A script wrapper because `bun run` does not expose .env.local to package.json shell expansion,
// and so the connection string can be scrubbed from anything the CLI prints.
import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { clean } from './scrub.mjs'

const env = process.env
const args = {
  push: ['db', 'push', '--db-url', env.SUPABASE_DB_URL, '--yes'],
  reset: ['db', 'reset', '--db-url', env.SUPABASE_DB_URL, '--yes'],
  types: ['gen', 'types', 'typescript', '--project-id', env.SUPABASE_PROJECT_REF, '--schema', 'public'],
}[process.argv[2]]
if (!args) {
  console.error('Usage: bun scripts/db-cli.mjs <push|reset|types>')
  process.exit(1)
}
if (args.includes(undefined) || args.includes('')) {
  console.error('Missing SUPABASE_DB_URL / SUPABASE_PROJECT_REF. Copy .env.example to .env.local and fill it in.')
  process.exit(1)
}

// Any throw (spawn rejecting an argument echoes the value it was given) is scrubbed, never dumped raw.
try {
  const bin = fileURLToPath(new URL('../node_modules/.bin/supabase', import.meta.url))
  const r = spawnSync(bin, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  if (process.argv[2] === 'types' && r.status === 0) {
    writeFileSync('src/lib/database.types.ts', r.stdout)
  } else {
    process.stdout.write(clean(r.stdout ?? ''))
  }
  process.stderr.write(clean(r.stderr ?? '') + (r.error ? clean(String(r.error.message)) + '\n' : ''))
  process.exit(r.status ?? 1)
} catch (e) {
  console.error(`db-cli failed: ${clean(e?.message ?? e)}`)
  process.exit(1)
}
