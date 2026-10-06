import { test, expect } from '@playwright/test';
import { gotoApp } from '../../helpers/auth';
import { TEST_USERS } from '../../helpers/convex';

test('Professional login lands on queue', async ({ page }) => {
  await gotoApp(page, '/(auth)/professional-login');
  await page
    .getByTestId('auth-email-input')
    .fill(TEST_USERS.professionalA.email);
  await page
    .getByTestId('auth-password-input')
    .fill(TEST_USERS.professionalA.password);
  await page.getByTestId('auth-professional-login-button').click();
  await expect(page.getByTestId('queue-sort')).toBeVisible({
    timeout: 15_000,
  });
});
