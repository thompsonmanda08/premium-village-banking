import { expect, test } from 'vitest'
import { isLocalUrl, seeds, seedsRemote } from './seed-guard.mjs'

const reset = (...more) => ['db', 'reset', '--db-url', 'u', '--yes', ...more]

test('only localhost-style hosts are local', () => {
  for (const u of ['postgresql://postgres:x@127.0.0.1:54322/postgres', 'postgresql://p@localhost/db', 'postgresql://p@[::1]:5432/db'])
    expect(isLocalUrl(u), u).toBe(true)
  for (const u of [
    'postgresql://postgres.ref:x@pooler.example.com:5432/postgres',
    'postgresql://localhost@evil.example/db',
    'postgresql://p@127.0.0.1.evil.example/db',
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
