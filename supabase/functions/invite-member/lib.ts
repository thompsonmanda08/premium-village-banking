export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const INVITE_TTL_DAYS = 14;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function makeToken(bytes = 32): string {
  const raw = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...raw)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const inviteExpiry = (now = new Date()): string =>
  new Date(now.getTime() + INVITE_TTL_DAYS * 86_400_000).toISOString();

export type InviteRequest = { memberId: string; email: string };

export function parseInviteRequest(body: unknown): InviteRequest {
  if (!body || typeof body !== 'object') throw new HttpError(400, 'invalid_body');
  const { memberId, email } = body as Record<string, unknown>;
  if (typeof memberId !== 'string' || !UUID.test(memberId)) throw new HttpError(400, 'invalid_member');
  if (typeof email !== 'string' || !EMAIL.test(email.trim())) throw new HttpError(400, 'invalid_email');
  return { memberId, email: email.trim().toLowerCase() };
}

/**
 * Value for Access-Control-Allow-Origin. Allowed = siteUrl plus the comma-separated
 * allowedOriginsEnv (trimmed, empty entries ignored). Exact string match only, no wildcards:
 * an allowed request origin is reflected, anything else (or none) gets siteUrl.
 */
export function corsOrigin(requestOrigin: string | null, siteUrl: string, allowedOriginsEnv: string | undefined): string {
  const allowed = new Set([siteUrl, ...(allowedOriginsEnv ?? '').split(',').map((o) => o.trim()).filter(Boolean)]);
  return requestOrigin && allowed.has(requestOrigin) ? requestOrigin : siteUrl;
}
