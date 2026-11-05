// Pushes supabase/templates/*.html and their subjects (config.toml) to a hosted project's auth config.
//   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/push-email-templates.mjs <project-ref>
// Run `node scripts/email-templates.mjs` first. `supabase config push` is not used, so this is how the hosted project gets them.
import { readFileSync } from 'node:fs';

const ref = process.argv[2];
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!ref || !token) {
  console.error('usage: SUPABASE_ACCESS_TOKEN=... node scripts/push-email-templates.mjs <project-ref>');
  process.exit(1);
}

const toml = readFileSync('supabase/config.toml', 'utf8');
const keys = ['invite', 'magic_link', 'recovery', 'email_change', 'reauthentication', 'confirmation'];
const body = {};
for (const k of keys) {
  const i = toml.indexOf(`[auth.email.template.${k}]`);
  if (i < 0) throw new Error(`no [auth.email.template.${k}] in supabase/config.toml`);
  const line = toml.slice(i).split(/\r?\n/)[1];
  body[`mailer_subjects_${k}`] = line.slice(line.indexOf('"') + 1, line.lastIndexOf('"'));
  body[`mailer_templates_${k}_content`] = readFileSync(`supabase/templates/${k}.html`, 'utf8');
}

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
  method: 'PATCH',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
console.log('status', res.status);
if (!res.ok) {
  console.error(await res.text());
  process.exit(1);
}
const live = await res.json();
for (const k of keys) {
  const same = (live[`mailer_templates_${k}_content`] ?? '').replace(/\r/g, '').trim() === body[`mailer_templates_${k}_content`].replace(/\r/g, '').trim();
  console.log(k, same ? 'synced' : 'DIFFERS', '|', live[`mailer_subjects_${k}`]);
}
