// Checks the R2 settings in .env.local: writes a tiny object, reads it back, deletes it. Prints no secrets.
// Run: pnpm run r2:check
import { AwsClient } from 'aws4fetch'

const need = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET']
const missing = need.filter((k) => !process.env[k]?.trim())
if (missing.length) {
  console.error(`Missing in .env.local: ${missing.join(', ')}`)
  process.exit(1)
}
const { R2_ACCOUNT_ID: account, R2_ACCESS_KEY_ID: accessKeyId, R2_SECRET_ACCESS_KEY: secretAccessKey, R2_BUCKET: bucket } = process.env
const r2 = new AwsClient({ accessKeyId: accessKeyId.trim(), secretAccessKey: secretAccessKey.trim(), service: 's3', region: 'auto' })
const url = `https://${account.trim()}.r2.cloudflarestorage.com/${bucket.trim()}/healthcheck/${crypto.randomUUID()}.txt`
const body = `premium village bank r2 check ${new Date().toISOString()}`

const step = async (name, run) => {
  try {
    const res = await run()
    console.log(`${res.ok ? 'ok  ' : 'FAIL'} ${name}: ${res.status}`)
    if (!res.ok) console.error((await res.text()).slice(0, 300))
    return res
  } catch (e) {
    console.log(`FAIL ${name}: ${e.cause?.code ?? e.message}`)
    return null
  }
}

const put = await step('write', () => r2.fetch(url, { method: 'PUT', body, headers: { 'Content-Type': 'text/plain' } }))
if (put?.ok) {
  const get = await step('read', () => r2.fetch(url))
  if (get?.ok) console.log(`${(await get.text()) === body ? 'ok  ' : 'FAIL'} contents match`)
  await step('delete', () => r2.fetch(url, { method: 'DELETE' }))
}
process.exit(put?.ok ? 0 : 1)
