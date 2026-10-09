// supabase/seed.sql creates sign-in accounts with a public password: it may only ever reach a local stack.
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

// Parsed with URL, not a regex, so `postgresql://localhost@evil.example/db` is not "local".
// libpq and pgx let ?host= / ?hostaddr= override the authority, so either one makes it remote.
// Anything unparseable counts as remote.
export const isLocalUrl = (url) => {
  try {
    const u = new URL(url)
    if ([...u.searchParams.keys()].some((k) => ['host', 'hostaddr'].includes(k.toLowerCase()))) return false
    return LOCAL_HOSTS.has(u.hostname.toLowerCase())
  } catch {
    return false
  }
}

// Would these Supabase CLI args load seed.sql? `db reset` seeds unless --no-seed;
// --include-seed and --sql-paths force it.
export const seeds = (args) =>
  (args[1] === 'reset' && !args.includes('--no-seed')) ||
  args.includes('--include-seed') ||
  args.includes('--sql-paths')

// --linked targets the hosted project whatever the URL says.
export const seedsRemote = (args, url) => seeds(args) && (args.includes('--linked') || !isLocalUrl(url))

// Supabase puts the project ref in every connection string (pooler user `postgres.<ref>`, direct
// host `db.<ref>.supabase.co`), so naming it anywhere means the URL points at that project.
export const targetsProject = (url, ref) => Boolean(ref) && String(url).toLowerCase().includes(ref.toLowerCase())

// `db reset` deletes every row. The production project is refused outright; any other non-local database needs
// --allow-hosted (a hosted scratch project). Returns the refusal message, or null when the reset may go ahead.
export const resetRefusal = (url, prodRef, allowHosted) => {
  if (targetsProject(url, prodRef)) return 'Refusing to reset the production project (PROD_PROJECT_REF).'
  if (!allowHosted && !isLocalUrl(url)) {
    return 'Refusing to reset a database that is not localhost. Use `bun run db:start` and the local URL; --allow-hosted is for a hosted scratch project only.'
  }
  return null
}

// db:test creates the pgtap extension and a `tests` schema of security definer helpers: never in production.
export const testRefusal = (url, prodRef) =>
  targetsProject(url, prodRef) ? 'Refusing to run the pgTAP suite against the production project (PROD_PROJECT_REF). Use the local stack.' : null
