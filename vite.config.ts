import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

const vercel = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8')) as {
  headers: { source: string; headers: { key: string; value: string }[] }[];
};
const csp = vercel.headers[0]!.headers.find((h) => h.key === 'Content-Security-Policy')!.value;

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'theme-init.js'],
      manifest: {
        name: 'Premium Village Bank',
        short_name: 'Premium VB',
        description: 'Savings, declarations and loans for Premium Village Banking.',
        theme_color: '#0F1113',
        background_color: '#0F1113',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      // App shell only: no runtimeCaching, so Supabase auth/REST responses are never stored by the service worker (shared phones).
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/manifest\.webmanifest$/, /^\/sw\.js$/, /^\/workbox-/],
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Inter ships one woff2 per script; precache Latin only. The rest still load on demand when online (unicode-range).
        globIgnores: ['**/inter-{cyrillic,cyrillic-ext,greek,greek-ext,vietnamese,latin-ext}-wght-normal-*.woff2', '**/exceljs*.js'],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 3000 },
  preview: {
    headers: {
      'Content-Security-Policy': csp.replace(
        "connect-src 'self'",
        "connect-src 'self' http://127.0.0.1:54321 ws://127.0.0.1:54321",
      ),
    },
  },
  test: {
    environment: 'jsdom',
    environmentOptions: { jsdom: { url: 'http://localhost:3000/' } },
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.mjs'],
    env: { VITE_SUPABASE_URL: 'http://localhost:54321', VITE_SUPABASE_ANON_KEY: 'test-anon-key' },
    alias: { 'virtual:pwa-register/react': fileURLToPath(new URL('./src/test/pwaRegisterStub.ts', import.meta.url)) },
  },
});
