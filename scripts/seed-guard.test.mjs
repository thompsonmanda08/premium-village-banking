import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import { importRefusal, isLocalUrl, resetRefusal, seeds, seedsRemote, targetsProject, testRefusal } from './seed-guard.mjs'

const reset = (...more) => ['db', 'reset', '--db-url', 'u', '--yes', ...more]

test('only localhost-style hosts are local', () => {
  for (const u of [
    'postgresql://postgres:x@127.0.0.1:54322/postgres',
    'postgresql://p@localhost/db',
    'postgresql://p@LOCALHOST:5432/db?sslmode=disable',
    'postgresql://p@[::1]:5432/db',
  ])
    expect(isLocalUrl(u), u).toBe(true)
  for (const u of [
    'postgresql://postgres.ref:x@pooler.example.com:5432/postgres',
    'postgresql://localhost@evil.example/db',
    'postgresql://p@127.0.0.1.evil.example/db',
    'postgresql://p@EVIL.EXAMPLE/db',
    'postgresql://p@localhost/db?host=evil.example',
    'postgresql://p@localhost/db?HOST=evil.example',
    'postgresql://p@localhost/db?sslmode=disable&hostaddr=203.0.113.9',
    'postgresql://p@localhost/db?Ho%73tAddr=203.0.113.9',
    'not a url',
    '',
    undefined,
  ])
    expect(isLocalUrl(u), String(u)).toBe(false)
})

test('a reset seeds unless --no-seed; --include-seed and --sql-paths force it', () => {
  expect(seeds(reset())).toBe(true)
  expect(seeds(reset('--no-seed'))).toBe(false)
  expect(seeds(reset('--no-seed', '--sql-paths', './seed.sql'))).toBe(true)
  expect(seeds(['db', 'push', '--db-url', 'u', '--yes'])).toBe(false)
  expect(seeds(['db', 'push', '--include-seed'])).toBe(true)
  expect(seeds(['gen', 'types', 'typescript'])).toBe(false)
})

test('seeding a non-local database is refused', () => {
  const hosted = 'postgresql://p@db.example.supabase.co:5432/postgres'
  const local = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
  expect(seedsRemote(reset(), hosted)).toBe(true)
  expect(seedsRemote(reset('--no-seed'), hosted)).toBe(false)
  expect(seedsRemote(reset(), local)).toBe(false)
  expect(seedsRemote(reset('--linked'), local)).toBe(true)
  expect(seedsRemote(reset(), undefined)).toBe(true)
})

test('a URL naming the production project ref is production', () => {
  const ref = 'abcdefghijklmnop'
  expect(targetsProject(`postgresql://postgres.${ref}:x@aws-0-eu.pooler.supabase.com:5432/postgres`, ref)).toBe(true)
  expect(targetsProject(`postgresql://postgres:x@db.${ref}.supabase.co:5432/postgres`, ref)).toBe(true)
  expect(targetsProject(`postgresql://postgres:x@db.${ref.toUpperCase()}.supabase.co:5432/postgres`, ref)).toBe(true)
  expect(targetsProject('postgresql://postgres.otherprojectref:x@aws-0-eu.pooler.supabase.com:5432/postgres', ref)).toBe(false)
  expect(targetsProject('postgresql://postgres:postgres@127.0.0.1:54322/postgres', ref)).toBe(false)
  for (const unset of ['', undefined]) expect(targetsProject(`postgresql://postgres.${ref}:x@h/db`, unset)).toBe(false)
})

const REF = 'abcdefghijklmnop'
const LOCAL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const HOSTED = 'postgresql://postgres:x@db.otherprojectref.supabase.co:5432/postgres'
const PROD = `postgresql://postgres.${REF}:x@aws-0-eu.pooler.supabase.com:5432/postgres`

test('reset: local is allowed; hosted needs --allow-hosted; production is always refused', () => {
  expect(resetRefusal(LOCAL, REF, false)).toBeNull()
  expect(resetRefusal(LOCAL, undefined, false)).toBeNull()
  expect(resetRefusal(HOSTED, REF, false)).toMatch(/not localhost/)
  expect(resetRefusal(HOSTED, REF, true)).toBeNull()
  expect(resetRefusal(PROD, REF, false)).toMatch(/production/)
  expect(resetRefusal(PROD, REF, true)).toMatch(/production/)
  expect(resetRefusal(undefined, REF, false)).toMatch(/not localhost/)
})

test('db:test is refused only for the production project', () => {
  expect(testRefusal(PROD, REF)).toMatch(/production/)
  expect(testRefusal(LOCAL, REF)).toBeNull()
  expect(testRefusal(HOSTED, REF)).toBeNull()
  expect(testRefusal(PROD, undefined)).toBeNull()
})

// The scripts themselves: refusals happen before anything connects, and no CLI argument can lift the production block.
const run = (script, args, env) =>
  spawnSync(process.execPath, [fileURLToPath(new URL(script, import.meta.url)), ...args], {
    env: { PATH: process.env.PATH, ...env },
    encoding: 'utf8',
    timeout: 20_000,
  })

test('db-cli reset exits 1 with the reason for a hosted URL, and for production even with --allow-hosted', () => {
  const hosted = run('./db-cli.mjs', ['reset'], { SUPABASE_DB_URL: HOSTED, PROD_PROJECT_REF: REF })
  expect(hosted.status).toBe(1)
  expect(hosted.stderr).toMatch(/not localhost/)
  const prod = run('./db-cli.mjs', ['reset', '--allow-hosted'], { SUPABASE_DB_URL: PROD, PROD_PROJECT_REF: REF })
  expect(prod.status).toBe(1)
  expect(prod.stderr).toMatch(/production/)
})

test('db-test exits 1 with the reason when SUPABASE_DB_URL names the production project', () => {
  const r = run('./db-test.mjs', [], { SUPABASE_DB_URL: PROD, PROD_PROJECT_REF: REF })
  expect(r.status).toBe(1)
  expect(r.stderr).toMatch(/production/)
  expect(r.stdout).not.toMatch(/\.\. (ok|FAILED)/) // no file was run
})

test('the ledger import names its target before writing, and production only by name', () => {
  const prod = 'postgresql://postgres.prodref:x@aws-0-eu.pooler.supabase.com:5432/postgres'
  const dev = 'postgresql://postgres.devref:x@aws-0-eu.pooler.supabase.com:5432/postgres'
  const local = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
  expect(importRefusal(dev, 'prodref', undefined, false)).toBeNull()
  expect(importRefusal(dev, 'prodref', undefined, true)).toMatch(/--write needs --target/)
  expect(importRefusal(dev, 'prodref', 'devref', true)).toBeNull()
  expect(importRefusal(dev, 'prodref', 'otherref', false)).toMatch(/does not point at --target otherref/)
  expect(importRefusal(prod, 'prodref', undefined, false)).toMatch(/production/)
  expect(importRefusal(prod, 'prodref', 'devref', true)).toMatch(/does not point at/)
  expect(importRefusal(prod, 'prodref', 'prodref', true)).toBeNull()
  expect(importRefusal(local, 'prodref', 'local', true)).toBeNull()
  expect(importRefusal(dev, 'prodref', 'local', true)).toMatch(/does not point at --target local/)
})

test('--target is the whole project ref, not any part of the URL', () => {
  const dev = 'postgresql://postgres.devref:x@aws-0-eu.pooler.supabase.com:5432/postgres'
  for (const t of ['postgres', 'pooler', 'dev', 'supabase.com', '5432'])
    expect(importRefusal(dev, 'prodref', t, true), t).toMatch(/does not point at/)
  expect(importRefusal('postgresql://postgres:x@db.devref.supabase.co:5432/postgres', 'prodref', 'devref', true)).toBeNull()
  expect(importRefusal('not a url', 'prodref', 'devref', false)).toMatch(/does not point at/)
})

test('without PROD_PROJECT_REF the ledger commands only reach localhost', () => {
  const dev = 'postgresql://postgres.devref:x@aws-0-eu.pooler.supabase.com:5432/postgres'
  expect(importRefusal(dev, undefined, 'devref', false)).toMatch(/PROD_PROJECT_REF is not set/)
  expect(importRefusal(dev, '', undefined, false)).toMatch(/PROD_PROJECT_REF is not set/)
  expect(importRefusal('postgresql://postgres:postgres@127.0.0.1:54322/postgres', undefined, 'local', true)).toBeNull()
})
