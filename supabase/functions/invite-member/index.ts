// Exact version on purpose: `@2` would float to whatever is newest at each deploy. Bump it deliberately.
import { createClient } from 'jsr:@supabase/supabase-js@2.117.3';
import { HttpError, corsOrigin, hashToken, inviteExpiry, inviteLink, isRateLimited, makeToken, parseInviteRequest, trimSlashes } from './lib.ts';

// No fallback: a missing SITE_URL would put localhost in invite links and the CORS allow-list.
// A trailing slash is dropped so links and the CORS match never see `https://site//invite/…`.
const SITE_URL = trimSlashes(Deno.env.get('SITE_URL') ?? '');
if (!SITE_URL) throw new Error('SITE_URL is not set');
const ALLOWED_ORIGINS = Deno.env.get('ALLOWED_ORIGINS');

// Reflect the request origin only when it is SITE_URL or in ALLOWED_ORIGINS; otherwise answer with SITE_URL.
const corsHeaders = (req: Request) => ({
  'Access-Control-Allow-Origin': corsOrigin(req.headers.get('Origin'), SITE_URL, ALLOWED_ORIGINS),
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
});
const json = (cors: Record<string, string>, status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json(cors, 405, { error: 'method_not_allowed' });

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authorization = req.headers.get('Authorization');
    if (!authorization) throw new HttpError(401, 'not_signed_in');

    const { memberId, email } = parseInviteRequest(await req.json().catch(() => null));

    // Act as the caller: RLS decides what they may read and write.
    const asCaller = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const { data: userData } = await asCaller.auth.getUser();
    if (!userData.user) throw new HttpError(401, 'not_signed_in');

    const { data: member, error: memberError } = await asCaller
      .from('members')
      .select('id, group_id, user_id, status')
      .eq('id', memberId)
      .maybeSingle();
    if (memberError) throw memberError;
    if (!member) throw new HttpError(403, 'not_admin');
    const { data: isAdmin } = await asCaller.rpc('is_admin', { p_group_id: member.group_id });
    if (!isAdmin) throw new HttpError(403, 'not_admin');
    if (member.user_id) throw new HttpError(409, 'member_taken');
    if (member.status !== 'active') throw new HttpError(409, 'member_not_active');

    const now = new Date().toISOString();
    const { error: revokeError } = await asCaller
      .from('invites')
      .update({ revoked_at: now })
      .eq('member_id', memberId)
      .is('accepted_at', null)
      .is('revoked_at', null);
    if (revokeError) throw revokeError;

    const { error: emailError } = await asCaller.from('members').update({ email }).eq('id', memberId);
    if (emailError) throw emailError;

    const token = makeToken();
    const expiresAt = inviteExpiry();
    const { error: insertError } = await asCaller.from('invites').insert({
      group_id: member.group_id,
      member_id: memberId,
      email,
      token_hash: await hashToken(token),
      expires_at: expiresAt,
      created_by: userData.user.id,
    });
    // Two taps at once: both revoke, both insert, and the one-live-invite-per-member index refuses the second.
    if (insertError) throw insertError.code === '23505' ? new HttpError(409, 'invite_in_progress') : insertError;

    const redirectTo = inviteLink(SITE_URL, token);
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
    if (inviteError) {
      if (isRateLimited(inviteError)) throw new HttpError(429, 'over_email_send_rate_limit');
      if (inviteError.code !== 'email_exists') throw inviteError;
      // Existing account (e.g. re-invite): send a sign-in link that lands on the invite page.
      const mailer = createClient(url, anonKey, { auth: { persistSession: false } });
      const { error: otpError } = await mailer.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
      });
      if (otpError) throw isRateLimited(otpError) ? new HttpError(429, 'over_email_send_rate_limit') : otpError;
    }

    return json(cors, 200, { ok: true, expiresAt });
  } catch (err) {
    if (err instanceof HttpError) return json(cors, err.status, { error: err.message });
    console.error('invite-member failed', err);
    return json(cors, 500, { error: 'invite_failed' });
  }
});
