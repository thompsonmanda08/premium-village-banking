// @vitest-environment node
import { beforeEach, expect, test, vi } from 'vitest'

vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }) }))
const { POST } = await import('./invite-member')

const body = JSON.stringify({ memberId: '6f1c7a52-6a1b-4c6e-9a43-2b0a9f0b1c2d', email: 'a@b.co' })
const call = (headers: Record<string, string> = {}, payload = body) =>
  POST(new Request('https://site.example/api/invite-member', { method: 'POST', headers, body: payload }))

beforeEach(() => {
  vi.stubEnv('SUPABASE_URL', 'http://x.test')
  vi.stubEnv('SUPABASE_ANON_KEY', 'anon')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service')
  vi.stubEnv('SITE_URL', 'https://site.example')
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

test('no Authorization header is 401 not_signed_in', async () => {
  const res = await call()
  expect(res.status).toBe(401)
  expect(await res.json()).toEqual({ error: 'not_signed_in' })
})

test('a bad body is 400', async () => {
  const res = await call({ Authorization: 'Bearer t' }, '{"memberId":"nope"}')
  expect(res.status).toBe(400)
})

test('a token that resolves to no user is 401', async () => {
  const res = await call({ Authorization: 'Bearer t' })
  expect(res.status).toBe(401)
})

test('a missing SITE_URL fails closed with 500, not a localhost link', async () => {
  vi.stubEnv('SITE_URL', '')
  const res = await call({ Authorization: 'Bearer t' })
  expect(res.status).toBe(500)
  expect(await res.json()).toEqual({ error: 'invite_failed' })
})
