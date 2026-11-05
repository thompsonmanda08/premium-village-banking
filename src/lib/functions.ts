import { supabase } from './supabase';

const fail = (code: string) => Object.assign(new Error(code), { code });

/** The treasurer invites a member by email through our own /api/invite-member (a Vercel Node function), as the signed-in user. */
export async function invokeInvite(memberId: string, email: string): Promise<{ expiresAt: string }> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw fail('not_signed_in');

  let res: Response;
  try {
    res = await fetch('/api/invite-member', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ memberId, email }),
    });
  } catch {
    throw fail('invite_failed'); // network failure
  }
  const body = (await res.json().catch(() => null)) as { error?: unknown; expiresAt?: unknown } | null;
  if (res.ok && typeof body?.expiresAt === 'string') return { expiresAt: body.expiresAt };
  throw fail(typeof body?.error === 'string' ? body.error : res.status === 401 ? 'not_signed_in' : 'invite_failed');
}
