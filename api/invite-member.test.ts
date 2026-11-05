// @vitest-environment node
import { beforeEach, expect, test, vi } from 'vitest'

// One fake Supabase client for all three createClient calls; `db` is what the tests set up and inspect.
const db = vi.hoisted(() => ({
  user: null as { id: string } | null,
  member: null as { id: string; group_id: string; user_id: string | null; status: string } | null,
  isAdmin: true,
  inviteError: null as { code?: string; status?: number } | null,
  calls: [] as string[],
}))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: db.user } }),
      admin: {
        inviteUserByEmail: async () => {
          db.calls.push('send')
          return { error: db.inviteError }
        },
      },
      signInWithOtp: async () => {
        db.calls.push('send otp')
        return { error: null }
      },
    },
    rpc: async () => ({ data: db.isAdmin }),
    from: (table: string) => {
      const q: Record<string, unknown> = {
        select: () => q,
        eq: () => q,
        is: () => q,
        maybeSingle: async () => ({ data: db.member, error: null }),
        update: () => (db.calls.push(`update ${table}`), q),
        insert: () => (db.calls.push(`insert ${table}`), q),
        then: (resolve: (v: { error: null }) => void) => resolve({ error: null }),
      }
      return q
    },
  }),
}))
const { POST } = await import('./invite-member')

const body = JSON.stringify({ memberId: '6f1c7a52-6a1b-4c6e-9a43-2b0a9f0b1c2d', email: 'a@b.co' })
const call = (headers: Record<string, string> = {}, payload = body) =>
  POST(new Request('https://site.example/api/invite-member', { method: 'POST', headers, body: payload }))
const signedIn = { Authorization: 'Bearer t' }

beforeEach(() => {
  vi.stubEnv('SUPABASE_URL', 'http://x.test')
  vi.stubEnv('SUPABASE_ANON_KEY', 'anon')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service')
  vi.stubEnv('SITE_URL', 'https://site.example')
  vi.spyOn(console, 'error').mockImplementation(() => {})
  db.user = { id: 'u1' }
  db.member = { id: 'm1', group_id: 'g1', user_id: null, status: 'active' }
  db.isAdmin = true
  db.inviteError = null
  db.calls = []
})

test('no Authorization header is 401 not_signed_in', async () => {
  const res = await call()
  expect(res.status).toBe(401)
  expect(await res.json()).toEqual({ error: 'not_signed_in' })
})

test('a bad body is 400', async () => {
  expect((await call(signedIn, '{"memberId":"nope"}')).status).toBe(400)
})

test('a token that resolves to no user is 401', async () => {
  db.user = null
  expect((await call(signedIn)).status).toBe(401)
})

test('a missing SITE_URL fails closed with 500, not a localhost link', async () => {
  vi.stubEnv('SITE_URL', '')
  const res = await call(signedIn)
  expect(res.status).toBe(500)
  expect(await res.json()).toEqual({ error: 'invite_failed' })
})

test('a caller who is not a group admin gets 403 and nothing is written or sent', async () => {
  db.isAdmin = false
  const res = await call(signedIn)
  expect(res.status).toBe(403)
  expect(await res.json()).toEqual({ error: 'not_admin' })
  expect(db.calls).toEqual([])
})

test('a member the caller cannot see is 403 not_admin', async () => {
  db.member = null
  expect((await call(signedIn)).status).toBe(403)
  expect(db.calls).toEqual([])
})

test('a member who already has an account is 409 member_taken', async () => {
  db.member = { id: 'm1', group_id: 'g1', user_id: 'someone', status: 'active' }
  const res = await call(signedIn)
  expect(res.status).toBe(409)
  expect(await res.json()).toEqual({ error: 'member_taken' })
  expect(db.calls).toEqual([])
})

test('a member who has left is 409 member_not_active', async () => {
  db.member = { id: 'm1', group_id: 'g1', user_id: null, status: 'left' }
  const res = await call(signedIn)
  expect(res.status).toBe(409)
  expect(await res.json()).toEqual({ error: 'member_not_active' })
})

test('success revokes the old invite, saves the new one, sends the email, and only then saves the member\'s email', async () => {
  const res = await call(signedIn)
  expect(res.status).toBe(200)
  expect(typeof (await res.json()).expiresAt).toBe('string')
  expect(db.calls).toEqual(['update invites', 'insert invites', 'send', 'update members'])
})

test('a failed send is 502 and does not change the member\'s email', async () => {
  db.inviteError = { code: 'unexpected_failure', status: 500 }
  const res = await call(signedIn)
  expect(res.status).toBe(502)
  expect(await res.json()).toEqual({ error: 'invite_email_failed' })
  expect(db.calls).not.toContain('update members')
})

test('an existing account gets a sign-in link instead', async () => {
  db.inviteError = { code: 'email_exists', status: 422 }
  expect((await call(signedIn)).status).toBe(200)
  expect(db.calls).toEqual(['update invites', 'insert invites', 'send', 'send otp', 'update members'])
})

test('the mail rate limit is 429', async () => {
  db.inviteError = { code: 'over_email_send_rate_limit', status: 429 }
  const res = await call(signedIn)
  expect(res.status).toBe(429)
})
