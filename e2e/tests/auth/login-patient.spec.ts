import { test, expect } from '@playwright/test';
import { gotoApp } from '../../helpers/auth';
import { TEST_USERS } from '../../helpers/convex';

test.describe('Patient login', () => {
  test('valid credentials → patient home', async ({ page }) => {
    await gotoApp(page, '/(auth)/login');
    await page.getByTestId('auth-email-input').fill(TEST_USERS.patientA.email);
    await page
      .getByTestId('auth-password-input')
      .fill(TEST_USERS.patientA.password);
    await page.getByTestId('auth-login-button').click();
    await expect(page.getByTestId('patient-new-conversation')).toBeVisible({
      timeout: 15_000,
    });
  });

  test('invalid credentials show error', async ({ page }) => {
    await gotoApp(page, '/(auth)/login');
    await page.getByTestId('auth-email-input').fill(TEST_USERS.patientA.email);
    await page.getByTestId('auth-password-input').fill('wrong-pw');
    await page.getByTestId('auth-login-button').click();
    await expect(page.getByTestId('auth-error')).toBeVisible({
      timeout: 10_000,
    });
  });
});
