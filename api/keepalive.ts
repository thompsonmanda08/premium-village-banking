// Vercel Cron calls this daily (see vercel.json) so the free Supabase project never idles into a pause.
export async function GET(req: Request) {
  // Vercel sends `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is set; without one the ping is open (it is read-only).
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('Authorization') !== `Bearer ${secret}`) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey) return Response.json({ error: 'not_configured' }, { status: 500 })

  try {
    const res = await fetch(`${url}/rest/v1/rpc/invite_preview`, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_token: 'keepalive' }),
    })
    return Response.json({ ok: res.ok, status: res.status }, { status: res.ok ? 200 : 502 })
  } catch {
    return Response.json({ ok: false }, { status: 502 })
  }
}
