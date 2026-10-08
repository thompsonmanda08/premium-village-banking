import { supabase } from './supabase';

/** The Edge Function's error code, or `not_signed_in` for a gateway 401 (it answers `{ code, message }`, no `error`). */
async function inviteErrorCode(error: unknown): Promise<string> {
  const ctx = (error as { context?: Response } | null)?.context;
  if (typeof ctx?.json !== 'function') return 'invite_failed'; // network failure or other client-side error
  const body = (await ctx.json().catch(() => null)) as { error?: unknown } | null;
  if (typeof body?.error === 'string') return body.error;
  return ctx.status === 401 ? 'not_signed_in' : 'invite_failed';
}

export async function invokeInvite(memberId: string, email: string): Promise<{ expiresAt: string }> {
  const { data, error } = await supabase.functions.invoke<{ ok: true; expiresAt: string }>('invite-member', {
    body: { memberId, email },
  });
  if (error || !data) {
    const code = await inviteErrorCode(error);
    throw Object.assign(new Error(code), { code });
  }
  return { expiresAt: data.expiresAt };
}
