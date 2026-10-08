// supabase/seed.sql creates sign-in accounts with a public password: it may only ever reach a local stack.
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

// Parsed with URL, not a regex, so `postgresql://localhost@evil.example/db` is not "local".
// Anything unparseable counts as remote.
export const isLocalUrl = (url) => {
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname.toLowerCase())
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
