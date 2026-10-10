// Runs the Supabase CLI: push | reset | types. `reset` only touches a local stack (see resetRefusal).
// A script wrapper because `bun run` does not expose .env.local to package.json shell expansion,
// and so the connection string can be scrubbed from anything the CLI prints.
import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { clean } from './scrub.mjs'
import { isLocalUrl, resetRefusal, seedsRemote, targetsProject } from './seed-guard.mjs'

const env = process.env
const args = {
  push: ['db', 'push', '--db-url', env.SUPABASE_DB_URL, '--yes'],
  // seed.sql (public-password accounts) is for the local/CI stack only: never seed a hosted database.
  reset: ['db', 'reset', '--db-url', env.SUPABASE_DB_URL, '--yes', ...(isLocalUrl(env.SUPABASE_DB_URL) ? [] : ['--no-seed'])],
  // --db-url (not --project-id) needs no access token and reads the schema of the database the URL names.
  types: ['gen', 'types', 'typescript', '--db-url', env.SUPABASE_DB_URL, '--schema', 'public'],
}[process.argv[2]]
if (!args) {
  console.error('Usage: bun scripts/db-cli.mjs <push|reset|types>')
  process.exit(1)
}
if (args.includes(undefined) || args.includes('')) {
  console.error('Missing SUPABASE_DB_URL. Copy .env.example to .env.local and fill it in.')
  process.exit(1)
}
if (seedsRemote(args, env.SUPABASE_DB_URL)) {
  console.error('Refusing to apply supabase/seed.sql to a database that is not localhost.')
  process.exit(1)
}
// db reset deletes every row: never against production, and only against localhost unless --allow-hosted.
const refusal = process.argv[2] === 'reset' && resetRefusal(env.SUPABASE_DB_URL, env.PROD_PROJECT_REF, process.argv.includes('--allow-hosted'))
if (refusal) {
  console.error(refusal)
  process.exit(1)
}
// Types are generated from the development database; production lacks the unreleased migrations.
if (process.argv[2] === 'types' && targetsProject(env.SUPABASE_DB_URL, env.PROD_PROJECT_REF)) {
  console.error('Refusing to generate types from the production project (PROD_PROJECT_REF).')
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
