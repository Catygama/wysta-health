import { test, expect } from '@playwright/test';
import { gotoApp } from '../../helpers/auth';

test('Guest patient sign-in lands on home', async ({ page }) => {
  await gotoApp(page, '/(auth)/login');
  await page.getByTestId('auth-guest-button').click();
  // Patient home: both ways to start a conversation are offered.
  await expect(page.getByTestId('home-path-professional')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('home-path-ai')).toBeVisible();
});
