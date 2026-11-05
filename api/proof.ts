// Vercel Node function: proof of payment for a declaration, kept in a private Cloudflare R2 bucket.
//   POST /api/proof?period=<uuid>&member=<uuid>   body: the file, Content-Type: its type   -> { id }
//   GET  /api/proof?id=<uuid>                      -> the file, for whoever may see that member's declarations
// Needs R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET. The bucket is never public: every read comes
// through here, after the database (RLS) has said the caller may see the proof. The Supabase URL and anon key fall back to the
// VITE_ ones the app already has; no service-role key is used.
import { createClient } from '@supabase/supabase-js'
import { AwsClient } from 'aws4fetch'
import { HttpError } from './_lib/invite.js'
import { MAX_PROOF_BYTES, PROOF_TYPES, proofKey, sniffType, type ProofType } from './_lib/proof.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const json = (status: number, body: unknown) => Response.json(body, { status })

// Database refusals the member should see as such; anything else is a plain failure.
const REFUSALS: Record<string, number> = {
  member_not_found: 403, period_not_open: 409, invalid_file: 400, file_too_large: 413, too_many_files: 409, not_signed_in: 401,
}

function setup(req: Request) {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
  const { R2_ACCOUNT_ID: account, R2_ACCESS_KEY_ID: accessKeyId, R2_SECRET_ACCESS_KEY: secretAccessKey, R2_BUCKET: bucket } = process.env
  if (!url || !anonKey || !account || !accessKeyId || !secretAccessKey || !bucket) throw new Error('proof is not configured (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET)')
  const authorization = req.headers.get('Authorization')
  if (!authorization) throw new HttpError(401, 'not_signed_in')
  // Act as the caller: RLS and the database functions decide what they may do.
  const asCaller = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } })
  const r2 = new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' })
  const object = (key: string) => `https://${account}.r2.cloudflarestorage.com/${bucket}/${key}`
  return { asCaller, r2, object }
}

export async function POST(req: Request) {
  try {
    const { asCaller, r2, object } = setup(req)
    const q = new URL(req.url).searchParams
    const period = q.get('period') ?? ''
    const member = q.get('member') ?? ''
    if (!UUID.test(period) || !UUID.test(member)) throw new HttpError(400, 'invalid_file')

    const declared = (req.headers.get('Content-Type') ?? '').split(';')[0]!.trim().toLowerCase()
    if (!(declared in PROOF_TYPES)) throw new HttpError(400, 'invalid_file')
    const body = new Uint8Array(await req.arrayBuffer())
    if (body.byteLength === 0) throw new HttpError(400, 'invalid_file')
    if (body.byteLength > MAX_PROOF_BYTES) throw new HttpError(413, 'file_too_large')
    if (sniffType(body) !== declared) throw new HttpError(400, 'invalid_file')

    const { data: userData } = await asCaller.auth.getUser()
    if (!userData.user) throw new HttpError(401, 'not_signed_in')
    const { data: m } = await asCaller.from('members').select('group_id').eq('id', member).maybeSingle()
    if (!m) throw new HttpError(403, 'member_not_found')

    const type = declared as ProofType
    const key = proofKey(m.group_id, period, type)
    const { data: row, error } = await asCaller.rpc('add_proof', { p_period: period, p_member: member, p_key: key, p_type: type, p_size: body.byteLength })
    if (error) {
      const status = REFUSALS[error.message]
      if (status) throw new HttpError(status, error.message)
      throw error
    }
    const put = await r2.fetch(object(key), { method: 'PUT', body, headers: { 'Content-Type': type } })
    if (!put.ok) {
      await asCaller.rpc('remove_proof', { p_id: row.id }) // no record of a file that is not there
      throw new HttpError(502, 'upload_failed')
    }
    return json(200, { id: row.id })
  } catch (err) {
    if (err instanceof HttpError) return json(err.status, { error: err.message })
    console.error('proof upload failed', err)
    return json(500, { error: 'proof_failed' })
  }
}

export async function GET(req: Request) {
  try {
    const { asCaller, r2, object } = setup(req)
    const id = new URL(req.url).searchParams.get('id') ?? ''
    if (!UUID.test(id)) throw new HttpError(404, 'not_found')
    // RLS answers: a member who may not see this proof gets nothing, the same as a proof that does not exist.
    const { data: proof, error } = await asCaller.from('declaration_proofs').select('object_key, content_type').eq('id', id).maybeSingle()
    if (error) throw error
    if (!proof) throw new HttpError(404, 'not_found')
    const res = await r2.fetch(object(proof.object_key))
    if (!res.ok || !res.body) throw new HttpError(404, 'not_found')
    return new Response(res.body, {
      headers: {
        'Content-Type': proof.content_type,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': 'inline',
        // An uploaded PDF must never run script on our origin.
        'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
      },
    })
  } catch (err) {
    if (err instanceof HttpError) return json(err.status, { error: err.message })
    console.error('proof read failed', err)
    return json(500, { error: 'proof_failed' })
  }
}
