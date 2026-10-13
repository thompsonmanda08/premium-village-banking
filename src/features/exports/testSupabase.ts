// A fake supabase client for the loaders' tests: tables are arrays of rows, filters are applied, requests are recorded.
type Row = Record<string, unknown>;
export type Call = { table: string; select: string; eq: Array<[string, unknown]>; in: Array<[string, unknown[]]>; range: [number, number] | null };
type RpcHandler = (args: Record<string, unknown>) => { data?: unknown; error?: unknown };

export const db = {
  tables: {} as Record<string, Row[]>,
  rpcs: {} as Record<string, RpcHandler>,
  rowCap: 1000,
  failTable: null as string | null,
  calls: [] as Call[],
  rpcCalls: [] as Array<{ name: string; args: Record<string, unknown> }>,
};

export function resetDb(tables: Record<string, Row[]> = {}, rpcs: Record<string, RpcHandler> = {}, rowCap = 1000): void {
  Object.assign(db, { tables, rpcs, rowCap, failTable: null, calls: [], rpcCalls: [] });
}

function project(row: Row, select: string): Row {
  if (select === '*' || select === '') return row;
  const out: Row = {};
  for (const key of select.split(',').map((s) => s.trim())) out[key] = row[key];
  return out;
}

function from(table: string) {
  const call: Call = { table, select: '', eq: [], in: [], range: null };
  db.calls.push(call);
  let one: 'single' | 'maybe' | null = null;
  const run = () => {
    if (db.failTable === table) return { data: null, error: { message: 'boom', code: 'XX000' } };
    let rows = (db.tables[table] ?? []).filter((r) => call.eq.every(([c, v]) => r[c] === v) && call.in.every(([c, v]) => v.includes(r[c])));
    if (call.range) rows = rows.slice(call.range[0], Math.min(call.range[1] + 1, call.range[0] + db.rowCap));
    const data = rows.map((r) => project(r, call.select));
    if (one === 'single') return data[0] ? { data: data[0], error: null } : { data: null, error: { message: 'no rows', code: 'PGRST116' } };
    if (one === 'maybe') return { data: data[0] ?? null, error: null };
    return { data, error: null };
  };
  const q = {
    select(cols: string) { call.select = cols; return q; },
    eq(c: string, v: unknown) { call.eq.push([c, v]); return q; },
    in(c: string, v: unknown[]) { call.in.push([c, v]); return q; },
    order() { return q; },
    range(a: number, b: number) { call.range = [a, b]; return q; },
    single() { one = 'single'; return q; },
    maybeSingle() { one = 'maybe'; return q; },
    then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) { return Promise.resolve(run()).then(resolve, reject); },
  };
  return q;
}

export const fakeClient = {
  from,
  rpc(name: string, args: Record<string, unknown>) {
    db.rpcCalls.push({ name, args });
    const handler = db.rpcs[name];
    const out = handler ? handler(args) : { data: null, error: { message: `no handler for ${name}` } };
    return Promise.resolve({ data: out.data ?? null, error: out.error ?? null });
  },
};
