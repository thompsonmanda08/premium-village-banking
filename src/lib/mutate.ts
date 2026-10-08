/** Supabase reports an UPDATE that RLS filtered out as success with zero rows. Treat that as a refusal. */
export function expectRows<T>(res: { data: T[] | null; error: unknown }, emptyCode = 'not_admin'): T[] {
  if (res.error) throw res.error;
  if (!res.data || res.data.length === 0) throw Object.assign(new Error(emptyCode), { code: emptyCode });
  return res.data;
}
