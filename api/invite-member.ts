// Vercel Node function: the treasurer invites a member by email. Same-origin from the app, so no CORS.
// Needs SUPABASE_SERVICE_ROLE_KEY and SITE_URL; the Supabase URL and anon key fall back to the VITE_ ones the app already has.
import { createClient } from '@supabase/supabase-js'
import { HttpError, hashToken, inviteExpiry, inviteLink, isRateLimited, makeToken, parseInviteRequest, trimSlashes } from './_lib/invite.js'

const json = (status: number, body: unknown) => Response.json(body, { status })

export async function POST(req: Request) {
  try {
    const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
    const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    // No fallback: a missing SITE_URL would put localhost in invite links.
    const siteUrl = trimSlashes(process.env.SITE_URL ?? '')
    if (!url || !anonKey || !serviceKey || !siteUrl) throw new Error('invite-member is not configured (SITE_URL, SUPABASE_SERVICE_ROLE_KEY)')

    const authorization = req.headers.get('Authorization')
    if (!authorization) throw new HttpError(401, 'not_signed_in')

    const { memberId, email } = parseInviteRequest(await req.json().catch(() => null))

    // Act as the caller: RLS decides what they may read and write.
    const asCaller = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    })
    const { data: userData } = await asCaller.auth.getUser()
    if (!userData.user) throw new HttpError(401, 'not_signed_in')

    const { data: member, error: memberError } = await asCaller
      .from('members')
      .select('id, group_id, user_id, status')
      .eq('id', memberId)
      .maybeSingle()
    if (memberError) throw memberError
    if (!member) throw new HttpError(403, 'not_admin')
    const { data: isAdmin } = await asCaller.rpc('is_admin', { p_group_id: member.group_id })
    if (!isAdmin) throw new HttpError(403, 'not_admin')
    if (member.user_id) throw new HttpError(409, 'member_taken')
    if (member.status !== 'active') throw new HttpError(409, 'member_not_active')

    const now = new Date().toISOString()
    const { error: revokeError } = await asCaller
      .from('invites')
      .update({ revoked_at: now })
      .eq('member_id', memberId)
      .is('accepted_at', null)
      .is('revoked_at', null)
    if (revokeError) throw revokeError

    const { error: emailError } = await asCaller.from('members').update({ email }).eq('id', memberId)
    if (emailError) throw emailError

    const token = makeToken()
    const expiresAt = inviteExpiry()
    const { error: insertError } = await asCaller.from('invites').insert({
      group_id: member.group_id,
      member_id: memberId,
      email,
      token_hash: await hashToken(token),
      expires_at: expiresAt,
      created_by: userData.user.id,
    })
    // Two taps at once: both revoke, both insert, and the one-live-invite-per-member index refuses the second.
    if (insertError) throw insertError.code === '23505' ? new HttpError(409, 'invite_in_progress') : insertError

    const redirectTo = inviteLink(siteUrl, token)
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo })
    if (inviteError) {
      if (isRateLimited(inviteError)) throw new HttpError(429, 'over_email_send_rate_limit')
      if (inviteError.code !== 'email_exists') throw new HttpError(502, 'invite_email_failed')
      // Existing account (e.g. re-invite): send a sign-in link that lands on the invite page.
      const mailer = createClient(url, anonKey, { auth: { persistSession: false } })
      const { error: otpError } = await mailer.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
      })
      if (otpError) throw isRateLimited(otpError) ? new HttpError(429, 'over_email_send_rate_limit') : new HttpError(502, 'invite_email_failed')
    }

    return json(200, { ok: true, expiresAt })
  } catch (err) {
    if (err instanceof HttpError) return json(err.status, { error: err.message })
    console.error('invite-member failed', err)
    return json(500, { error: 'invite_failed' })
  }
}
