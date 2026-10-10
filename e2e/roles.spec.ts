import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

// The seed accounts exist only on a local Supabase stack, never on the hosted project, so the fallback needs both: no
// BASE_URL and an app Supabase URL (VITE_SUPABASE_URL, which `bun run e2e` does not read from .env.local: export it) on
// localhost. Anywhere else the tests run only when E2E_MEMBER_* and E2E_ADMIN_* are set. Hosted E2E accounts must satisfy
// the project's Auth password policy: at least 12 characters, with letters and digits.
const supabaseHost = (() => {
  try {
    return new URL(process.env.VITE_SUPABASE_URL ?? '').hostname;
  } catch {
    return '';
  }
})();
const seeded = !process.env.BASE_URL && (supabaseHost === 'localhost' || supabaseHost === '127.0.0.1');
const member = { email: process.env.E2E_MEMBER_EMAIL ?? (seeded ? 'member@pvb.test' : ''), password: process.env.E2E_MEMBER_PASSWORD ?? (seeded ? 'password123' : '') };
const admin = { email: process.env.E2E_ADMIN_EMAIL ?? (seeded ? 'admin@pvb.test' : ''), password: process.env.E2E_ADMIN_PASSWORD ?? (seeded ? 'password123' : '') };

async function signIn(page: Page, who: { email: string; password: string }) {
  await page.goto('/sign-in');
  await page.getByRole('button', { name: 'Use a password instead' }).click();
  await page.getByLabel('Email').fill(who.email);
  await page.getByLabel('Password').fill(who.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/$/);
}

const navName = (project: string) => (project === 'phone' ? 'Main' : 'Sections');

test.describe('roles', () => {
  test.skip(!member.email || !member.password || !admin.email || !admin.password, 'E2E credentials are not set');

  test('a member sees Plan but not Desk, and cannot open the desk', async ({ page }, info) => {
    await signIn(page, member);
    const nav = page.getByRole('navigation', { name: navName(info.project.name) });
    await expect(nav.getByRole('link', { name: 'Plan' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Desk' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Group settings' })).toHaveCount(0);
    await page.goto('/desk');
    await expect(page.getByText('This page is for admins')).toBeVisible();
  });

  test('an admin sees Desk and can open group settings', async ({ page }, info) => {
    await signIn(page, admin);
    const nav = page.getByRole('navigation', { name: navName(info.project.name) });
    await expect(nav.getByRole('link', { name: 'Desk' })).toBeVisible();
    await page.getByRole('link', { name: 'Group settings' }).first().click();
    await expect(page).toHaveURL(/\/settings\/general$/);
    await page.getByRole('link', { name: 'Members' }).click();
    await expect(page).toHaveURL(/\/settings\/members$/);
    await expect(page.getByRole('heading', { name: 'Members and admins' })).toBeVisible();
  });

  test('no horizontal scroll at 360px when signed in', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await signIn(page, member);
    for (const path of ['/', '/group', '/rules', '/account']) {
      await page.goto(path);
      // PageHeader's h1 renders before the data does, so also wait for the page's skeleton to go: its role="status" holds
      // an sr-only "Loading ..." sentence (accessible names do not come from a status's content, so match the text).
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      await expect(page.getByText(/^Loading\b/)).toHaveCount(0);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });

  test('no horizontal scroll at 360px on the settings tabs', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await signIn(page, admin);
    for (const tab of ['general', 'privacy', 'members', 'rules']) {
      await page.goto(`/settings/${tab}`);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, tab).toBeLessThanOrEqual(0);
    }
  });
});
