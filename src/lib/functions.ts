import { supabase } from './supabase';

export async function invokeInvite(memberId: string, email: string): Promise<{ expiresAt: string }> {
  const { data, error } = await supabase.functions.invoke<{ ok: true; expiresAt: string }>('invite-member', {
    body: { memberId, email },
  });
  if (error || !data) {
    let code = 'invite_failed';
    const ctx = (error as { context?: Response } | null)?.context;
    if (ctx && typeof ctx.json === 'function') {
      const body = (await ctx.json().catch(() => null)) as { error?: string } | null;
      if (body?.error) code = body.error;
    }
    throw Object.assign(new Error(code), { code });
  }
  return { expiresAt: data.expiresAt };
}
