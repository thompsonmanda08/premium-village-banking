/**
 * Supabase reports an UPDATE or DELETE that RLS filtered out as success with zero rows. Treat that as a refusal.
 *
 * Callers must chain `.select()` on the update/delete: without it `data` is always null and this always throws.
 * The returned rows also have to pass the table's SELECT policies, so a write that RLS allowed but that selects
 * nothing back is refused too.
 */
export function expectRows<T>(res: { data: T[] | null; error: unknown }, emptyCode = 'not_admin'): T[] {
  if (res.error) throw res.error;
  if (!res.data || res.data.length === 0) throw Object.assign(new Error(emptyCode), { code: emptyCode });
  return res.data;
}
