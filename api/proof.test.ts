// @vitest-environment node
import { beforeEach, expect, test, vi } from 'vitest'

const state = vi.hoisted(() => ({
  user: { id: 'u1' } as { id: string } | null,
  member: { group_id: 'g1' } as { group_id: string } | null,
  proof: { object_key: 'proofs/g1/p1/x.jpg', content_type: 'image/jpeg' } as { object_key: string; content_type: string } | null,
  addError: null as { message: string } | null,
  rpc: vi.fn(),
  r2: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from: (table: string) => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: table === 'members' ? state.member : state.proof, error: null }) }) }),
    }),
    rpc: async (name: string, args: unknown) => {
      state.rpc(name, args)
      return name === 'add_proof' ? { data: state.addError ? null : { id: 'proof-1' }, error: state.addError } : { data: null, error: null }
    },
  }),
}))
vi.mock('aws4fetch', () => ({ AwsClient: class { fetch = state.r2 } }))
const { POST, GET } = await import('./proof')

const ID = '6f1c7a52-6a1b-4c6e-9a43-2b0a9f0b1c2d'
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])
const post = (body: BodyInit | null, type = 'image/jpeg', auth = true) =>
  POST(new Request(`https://site.example/api/proof?period=${ID}&member=${ID}`, { method: 'POST', headers: { ...(auth ? { Authorization: 'Bearer t' } : {}), 'Content-Type': type }, body }))

beforeEach(() => {
  for (const [k, v] of Object.entries({ SUPABASE_URL: 'http://x.test', SUPABASE_ANON_KEY: 'anon', R2_ACCOUNT_ID: 'acct', R2_ACCESS_KEY_ID: 'k', R2_SECRET_ACCESS_KEY: 's', R2_BUCKET: 'proofs' })) vi.stubEnv(k, v)
  Object.assign(state, { user: { id: 'u1' }, member: { group_id: 'g1' }, proof: { object_key: 'proofs/g1/p1/x.jpg', content_type: 'image/jpeg' }, addError: null })
  state.rpc.mockReset()
  state.r2.mockReset()
  state.r2.mockResolvedValue(new Response('ok'))
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

test('no Authorization header is 401', async () => {
  expect((await post(JPEG, 'image/jpeg', false)).status).toBe(401)
})

test('an HTML page sent as image/jpeg is refused before anything is stored', async () => {
  const res = await post(new TextEncoder().encode('<html><script>x</script>'))
  expect(res.status).toBe(400)
  expect(state.r2).not.toHaveBeenCalled()
  expect(state.rpc).not.toHaveBeenCalled()
})

test('a file over 4 MB is 413, and a type we do not accept is 400', async () => {
  const big = new Uint8Array(4 * 1024 * 1024 + 1)
  big.set([0xff, 0xd8, 0xff])
  expect((await post(big)).status).toBe(413)
  expect((await post(JPEG, 'application/zip')).status).toBe(400)
})

test('a good file is recorded, then written to R2 under the key the database was given', async () => {
  const res = await post(JPEG)
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({ id: 'proof-1' })
  const key = state.rpc.mock.calls[0]![1].p_key as string
  expect(key).toMatch(/^proofs\/g1\/6f1c7a52-6a1b-4c6e-9a43-2b0a9f0b1c2d\/[0-9a-f-]{36}\.jpg$/)
  expect(state.r2.mock.calls[0]![0]).toBe(`https://acct.r2.cloudflarestorage.com/proofs/${key}`)
})

test('a refusal from the database is passed on with its own status and nothing is uploaded', async () => {
  state.addError = { message: 'too_many_files' }
  const res = await post(JPEG)
  expect(res.status).toBe(409)
  expect(await res.json()).toEqual({ error: 'too_many_files' })
  expect(state.r2).not.toHaveBeenCalled()
})

test('when R2 refuses the file the record is removed again and the member hears upload_failed', async () => {
  state.r2.mockResolvedValue(new Response('no', { status: 500 }))
  const res = await post(JPEG)
  expect(res.status).toBe(502)
  expect(state.rpc).toHaveBeenCalledWith('remove_proof', { p_id: 'proof-1' })
})

test('reading: a proof the caller may not see is 404; one they may is streamed with locked-down headers', async () => {
  const get = () => GET(new Request(`https://site.example/api/proof?id=${ID}`, { headers: { Authorization: 'Bearer t' } }))
  state.proof = null
  expect((await get()).status).toBe(404)
  state.proof = { object_key: 'proofs/g1/p1/x.jpg', content_type: 'image/jpeg' }
  state.r2.mockResolvedValue(new Response(JPEG))
  const res = await get()
  expect(res.status).toBe(200)
  expect(res.headers.get('Content-Type')).toBe('image/jpeg')
  expect(res.headers.get('Cache-Control')).toBe('private, no-store')
  expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
  expect(res.headers.get('Content-Security-Policy')).toContain('sandbox')
})

test('a missing R2 setting fails closed with 500', async () => {
  vi.stubEnv('R2_BUCKET', '')
  expect((await post(JPEG)).status).toBe(500)
})
