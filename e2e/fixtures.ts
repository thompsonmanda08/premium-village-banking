import { expect, test as base } from '@playwright/test';

const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

// Vercel Deployment Protection: send the bypass header on one request to the preview origin and keep the cookie it
// sets. Every later request (the app's own and Supabase's) then goes out without extra headers, so Supabase calls
// stay CORS-simple. Without a secret this does nothing (local runs, unprotected deployments).
export const test = base.extend<{ vercelBypass: void }>({
  vercelBypass: [
    async ({ context, baseURL }, use) => {
      if (secret && baseURL) {
        const res = await context.request.get(baseURL, {
          headers: { 'x-vercel-protection-bypass': secret, 'x-vercel-set-bypass-cookie': 'samesitenone' },
        });
        if (!res.ok()) throw new Error(`Vercel protection bypass failed: ${baseURL} answered ${res.status()}`);
      }
      await use();
    },
    { auto: true },
  ],
});

export { expect };
