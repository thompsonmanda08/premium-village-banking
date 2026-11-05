// @vitest-environment node
import { beforeEach, expect, test, vi } from 'vitest'
import { GET } from './keepalive'

const doFetch = vi.fn()
vi.stubGlobal('fetch', (...a: unknown[]) => doFetch(...a))
const get = (headers: Record<string, string> = {}) => GET(new Request('https://site.example/api/keepalive', { headers }))

beforeEach(() => {
  doFetch.mockReset().mockResolvedValue(new Response('{}', { status: 200 }))
  vi.stubEnv('SUPABASE_URL', 'http://x.test')
  vi.stubEnv('SUPABASE_ANON_KEY', 'anon')
  vi.stubEnv('CRON_SECRET', '')
})

test('pings the database with the anon key and answers 200', async () => {
  const res = await get()
  expect(res.status).toBe(200)
  expect(doFetch).toHaveBeenCalledWith('http://x.test/rest/v1/rpc/invite_preview', expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ apikey: 'anon' }) }))
})

test('a database that answers an error is 502, so the failure shows in the cron log', async () => {
  doFetch.mockResolvedValue(new Response('boom', { status: 503 }))
  expect((await get()).status).toBe(502)
  doFetch.mockRejectedValue(new TypeError('network'))
  expect((await get()).status).toBe(502)
})

test('with CRON_SECRET set, only the matching bearer is let in', async () => {
  vi.stubEnv('CRON_SECRET', 's3')
  expect((await get()).status).toBe(401)
  expect((await get({ Authorization: 'Bearer wrong' })).status).toBe(401)
  expect(doFetch).not.toHaveBeenCalled()
  expect((await get({ Authorization: 'Bearer s3' })).status).toBe(200)
})

test('missing Supabase settings is 500', async () => {
  vi.stubEnv('SUPABASE_URL', '')
  vi.stubEnv('VITE_SUPABASE_URL', '')
  expect((await get()).status).toBe(500)
})
