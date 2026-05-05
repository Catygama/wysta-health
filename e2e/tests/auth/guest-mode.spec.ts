import { test, expect } from '@playwright/test';
import { gotoApp } from '../../helpers/auth';

test('Guest patient sign-in lands on home', async ({ page }) => {
  await gotoApp(page, '/(auth)/login');
  await page.getByTestId('auth-guest-button').click();
  await expect(page.getByTestId('patient-topic-contraception')).toBeVisible({
    timeout: 20_000,
  });
});
