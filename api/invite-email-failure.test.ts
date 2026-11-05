// @vitest-environment node
import { beforeEach, expect, test, vi } from 'vitest'

// A caller who is an admin of a free member; only the email service fails.
const member = { id: 'm', group_id: 'g', user_id: null, status: 'active' }
const query = () => {
  const q: Record<string, unknown> = {}
  for (const k of ['select', 'eq', 'is', 'update', 'insert']) q[k] = () => q
  q.maybeSingle = async () => ({ data: member, error: null })
  q.then = (resolve: (v: unknown) => void) => resolve({ error: null })
  return q
}
vi.mock('@supabase/supabase-js', () => ({
  createClient: (_url: string, key: string) =>
    key === 'service'
      ? { auth: { admin: { inviteUserByEmail: async () => ({ error: { code: 'smtp_failed' } }) } } }
      : { auth: { getUser: async () => ({ data: { user: { id: 'u' } } }) }, from: query, rpc: async () => ({ data: true }) },
}))
const { POST } = await import('./invite-member')

beforeEach(() => {
  vi.stubEnv('SUPABASE_URL', 'http://x.test')
  vi.stubEnv('SUPABASE_ANON_KEY', 'anon')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service')
  vi.stubEnv('SITE_URL', 'https://site.example')
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

test('an email service failure is 502 invite_email_failed, not a generic 500', async () => {
  const res = await POST(
    new Request('https://site.example/api/invite-member', {
      method: 'POST',
      headers: { Authorization: 'Bearer t' },
      body: JSON.stringify({ memberId: '6f1c7a52-6a1b-4c6e-9a43-2b0a9f0b1c2d', email: 'a@b.co' }),
    }),
  )
  expect(res.status).toBe(502)
  expect(await res.json()).toEqual({ error: 'invite_email_failed' })
})
