import { test, expect } from '@playwright/test';
import { gotoApp } from '../../helpers/auth';
import { setUserProfile, seedUser, TEST_USERS } from '../../helpers/convex';

const FRESH_EMAIL = 'patient-signup@e2e.local';
const FRESH_PASSWORD = 'e2e-test-pw';

test.describe('Patient signup + onboarding', () => {
  test.beforeEach(async () => {
    // Best-effort: ensure no leftover user from previous run. seedUser will
    // throw if the email already exists, so we only run it after a global
    // reset (between test files we keep the user out by not creating it).
    // Nothing to do here; resetAll happens in globalSetup.
  });

  test('full signup → onboarding → patient home', async ({ page }) => {
    await gotoApp(page, '/(auth)/register');
    await page.getByTestId('auth-email-input').fill(FRESH_EMAIL);
    await page.getByTestId('auth-password-input').fill(FRESH_PASSWORD);
    await page.getByTestId('auth-password-confirm-input').fill(FRESH_PASSWORD);
    await page.getByTestId('auth-register-button').click();

    // Onboarding screen: pick options + continue
    await expect(page.getByTestId('onboarding-age-26-35')).toBeVisible({
      timeout: 15_000,
    });
    await page.getByTestId('onboarding-age-26-35').click();
    await page.getByTestId('onboarding-pregnancy-not-pregnant').click();
    await page.getByTestId('onboarding-name-input').fill('Maria Test');
    await page.getByTestId('onboarding-continue-button').click();

    // Should land on patient home with topic cards visible
    await expect(page.getByTestId('patient-topic-contraception')).toBeVisible({
      timeout: 15_000,
    });
  });

  test('mismatched password shows error', async ({ page }) => {
    await gotoApp(page, '/(auth)/register');
    await page.getByTestId('auth-email-input').fill('mismatch@e2e.local');
    await page.getByTestId('auth-password-input').fill('passwordA');
    await page.getByTestId('auth-password-confirm-input').fill('passwordB');
    await page.getByTestId('auth-register-button').click();
    await expect(page.getByTestId('auth-error')).toBeVisible();
  });
});
