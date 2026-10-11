// Generates supabase/templates/*.html from one layout: bun scripts/email-templates.mjs
// Subjects live in supabase/config.toml; the hosted project gets both via the Management API.
import { mkdirSync, writeFileSync } from 'node:fs';

// The light palette of DESIGN.md (emails stay light: clients don't agree on dark mode). Lime never fills on white, so the
// button is ink with lime lettering, as accent-solid is in the app.
const C = { canvas: '#EEF0F2', surface: '#FFFFFF', line: '#DFE2E6', fg: '#121417', muted: '#555B65', accent: '#3F6212', solid: '#16181B', lime: '#C6F432', soft: '#EAF7C4' };
const FONT = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MONO = "'SFMono-Regular', Menlo, Consolas, 'Liberation Mono', monospace";
const type = (size, weight, line, color) =>
  `font-family:${FONT};font-size:${size}px;font-weight:${weight};line-height:${line};color:${color};`;

const p = (text) => `<p style="margin:0 0 16px;${type(16, 400, 1.6, C.fg)}">${text}</p>`;
const small = (text) => `<p style="margin:0 0 16px;${type(14, 400, 1.6, C.muted)}">${text}</p>`;

const button = (label) => `
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 24px;">
                <tr>
                  <td align="center" bgcolor="${C.solid}" style="border-radius:999px;">
                    <a href="{{ .ConfirmationURL }}" target="_blank" style="display:inline-block;padding:14px 28px;${type(16, 600, 1.2, C.lime)}text-decoration:none;border-radius:999px;">${label}</a>
                  </td>
                </tr>
              </table>`;

const fallback = `
              <p style="margin:0 0 6px;${type(13, 400, 1.6, C.muted)}">Button not working? Copy this link into your browser:</p>
              <p style="margin:0 0 20px;${type(13, 400, 1.5, C.accent)}word-break:break-all;"><a href="{{ .ConfirmationURL }}" target="_blank" style="color:${C.accent};text-decoration:underline;">{{ .ConfirmationURL }}</a></p>`;

const code = `
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:8px 0 24px;">
                <tr>
                  <td align="center" bgcolor="${C.soft}" style="border-radius:12px;padding:18px 12px;">
                    <span style="font-family:${MONO};font-size:32px;font-weight:700;letter-spacing:8px;color:${C.fg};">{{ .Token }}</span>
                  </td>
                </tr>
              </table>`;

const divider = `<hr style="border:none;border-top:1px solid ${C.line};margin:4px 0 20px;">`;

function layout({ title, preheader, heading, body, footer }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:${C.canvas};">
  <div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;">${preheader}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${C.canvas}" style="background-color:${C.canvas};">
    <tr>
      <td align="center" style="padding:32px 16px 40px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;">
          <tr>
            <td style="padding:0 4px 20px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="vertical-align:middle;"><img src="{{ .SiteURL }}/brand-mark.png" width="48" height="48" alt="" style="display:block;border:0;border-radius:24px;"></td>
                  <td style="vertical-align:middle;padding-left:12px;${type(16, 600, 1.3, C.fg)}">Premium Village Banking</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td bgcolor="${C.surface}" style="background-color:${C.surface};border:1px solid ${C.line};border-radius:16px;padding:32px 28px 12px;">
              <h1 style="margin:0 0 16px;${type(24, 600, 1.25, C.fg)}letter-spacing:-0.01em;">${heading}</h1>
              ${body}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 8px 0;">
              <p style="margin:0;${type(13, 400, 1.6, C.muted)}">${footer}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

const T = {
  invite: {
    subject: 'You’re invited to Premium Village Banking',
    title: 'You’re invited',
    preheader: 'Accept your invite to see your savings and declare each month.',
    heading: 'You’re invited to Premium Village Banking',
    body: [
      p('Your treasurer has added you to the group’s app. Accept the invite to see your savings, make your monthly declaration and keep up with the group.'),
      button('Accept invite'),
      divider,
      small('This button works for 24 hours. If it has expired, ask your treasurer to send you a new invite.'),
      fallback,
    ].join('\n              '),
    footer: 'Sent to {{ .Email }} by Premium Village Banking. If you weren’t expecting this invite, you can ignore it.',
  },
  magic_link: {
    subject: 'Your sign-in link for Premium Village Banking',
    title: 'Your sign-in link',
    preheader: 'Tap to sign in. The link works once and expires in 24 hours.',
    heading: 'Sign in to Premium Village Banking',
    body: [
      p('Tap the button to sign in. No password needed.'),
      button('Sign in'),
      divider,
      small('The link works once and expires in 24 hours. If you didn’t ask for it, you can ignore this email: nobody can sign in without the link.'),
      fallback,
    ].join('\n              '),
    footer: 'Someone asked to sign in to Premium Village Banking with {{ .Email }}.',
  },
  recovery: {
    subject: 'Reset your Premium Village Banking password',
    title: 'Reset your password',
    preheader: 'Choose a new password. The link expires in 24 hours.',
    heading: 'Reset your password',
    body: [
      p('Someone asked to reset the password for {{ .Email }}. Tap the button to choose a new one.'),
      button('Choose a new password'),
      divider,
      small('The link works once and expires in 24 hours. If you didn’t ask for this, ignore this email and your password stays the same.'),
      fallback,
    ].join('\n              '),
    footer: 'Sent to {{ .Email }} by Premium Village Banking.',
  },
  email_change: {
    subject: 'Confirm your new email address',
    title: 'Confirm your new email',
    preheader: 'Confirm the new email address for your Premium Village Banking account.',
    heading: 'Confirm your new email',
    body: [
      p('Tap the button to use <strong>{{ .NewEmail }}</strong> for your Premium Village Banking account instead of {{ .Email }}.'),
      button('Confirm new email'),
      divider,
      small('If you didn’t ask for this change, don’t tap the button. Tell your treasurer instead.'),
      fallback,
    ].join('\n              '),
    footer: 'Sent by Premium Village Banking.',
  },
  reauthentication: {
    subject: 'Your Premium Village Banking confirmation code',
    title: 'Your confirmation code',
    preheader: 'Enter this code in the app to finish changing your password.',
    heading: 'Confirm it’s you',
    body: [
      p('Enter this code in the app to finish changing your password.'),
      code,
      divider,
      small('If you didn’t try to change your password, ignore this email. Your password stays the same without the code.'),
    ].join('\n              '),
    footer: 'Sent to {{ .Email }} by Premium Village Banking.',
  },
  confirmation: {
    subject: 'Confirm your email for Premium Village Banking',
    title: 'Confirm your email',
    preheader: 'Confirm your email address to finish setting up your account.',
    heading: 'Confirm your email address',
    body: [
      p('Tap the button to confirm {{ .Email }} for your Premium Village Banking account.'),
      button('Confirm email'),
      divider,
      small('If you didn’t expect this email, you can ignore it.'),
      fallback,
    ].join('\n              '),
    footer: 'Sent by Premium Village Banking.',
  },
};

mkdirSync('supabase/templates', { recursive: true });
for (const [name, t] of Object.entries(T)) {
  writeFileSync(`supabase/templates/${name}.html`, layout(t));
}
console.log('wrote', Object.keys(T).join(', '));
