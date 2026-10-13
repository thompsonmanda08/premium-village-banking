/** PostgREST returns at most 1,000 rows a request (supabase/config.toml max_rows). */
export const PAGE_SIZE = 1000;

/**
 * Every row of a query, page by page. `page` must carry a stable order. It reads until a page comes back empty and advances by the
 * rows it received, so a server row cap below PAGE_SIZE can never make it skip rows.
 */
export async function fetchAllRows<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  for (;;) {
    const { data, error } = await page(rows.length, rows.length + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) return rows;
    rows.push(...data);
  }
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
