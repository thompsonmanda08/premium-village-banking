// Scrubs secrets and connection strings from anything a db script prints.
// Print only `clean(error.message)`, never an error object: Bun/Node dump properties like `input`.
export const clean = (s) => {
  const env = process.env
  const secrets = [env.SUPABASE_DB_URL, env.SUPABASE_DB_PASSWORD, env.SUPABASE_ACCESS_TOKEN]
  if (env.SUPABASE_DB_PASSWORD) secrets.push(encodeURIComponent(env.SUPABASE_DB_PASSWORD))
  return secrets
    .filter(Boolean)
    .reduce((acc, v) => acc.split(v).join('[redacted]'), String(s))
    .replace(/postgres(ql)?:\/\/\S*/g, '[db-url]')
}
