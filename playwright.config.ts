import { defineConfig } from '@playwright/test';

const baseURL = process.env.BASE_URL ?? 'http://localhost:3000';

// The Vercel bypass secret is NOT set here as an extraHTTPHeaders entry: that header would be sent on every request,
// including cross-origin calls to Supabase, where it triggers CORS preflights that Supabase rejects. e2e/fixtures.ts
// trades the secret for a cookie on the preview origin once per test instead.

// The hosted Supabase project answers an anonymous invite lookup in 2-10 s (occasionally longer), so allow for it.
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: { timeout: 20_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    // No traces in CI: they record typed values (E2E passwords) and request headers, and the workflow uploads the report.
    trace: process.env.CI ? 'off' : 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'phone', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 } },
    { name: 'desktop', use: { viewport: { width: 1280, height: 900 } } },
  ],
  webServer: process.env.BASE_URL ? undefined : { command: 'bun run dev', url: baseURL, reuseExistingServer: true, timeout: 60_000 },
});
