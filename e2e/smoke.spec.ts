import { expect, test } from './fixtures';

test('sign-in page offers all three methods', async ({ page }, info) => {
  await page.goto('/sign-in');
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Email me a sign-in link' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Use a password instead' })).toBeVisible();

  // Spec §7: every control is at least 48x48 CSS px on a phone. Role queries leave out aria-hidden (decorative) nodes.
  if (info.project.name === 'phone') {
    const controls = await page.getByRole('button').or(page.getByRole('link')).all();
    expect(controls.length).toBeGreaterThanOrEqual(3);
    for (const control of controls) {
      const box = await control.boundingBox();
      const name = (await control.textContent())?.trim();
      expect(box, name).not.toBeNull();
      expect(box!.width, `${name} width`).toBeGreaterThanOrEqual(48);
      expect(box!.height, `${name} height`).toBeGreaterThanOrEqual(48);
    }
  }
});

test('protected pages send you to sign in and back', async ({ page }) => {
  await page.goto('/passbook');
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fpassbook$/);
});

test('an unknown invite explains itself', async ({ page }) => {
  await page.goto('/invite/not-a-real-token');
  await expect(page.getByText('This invite link isn’t valid. Ask your treasurer for a new one.')).toBeVisible();
});

for (const path of ['/sign-in', '/invite/not-a-real-token']) {
  test(`no horizontal scroll at 360px on ${path}`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
