import { test, expect } from '@playwright/test';
import { gotoApp } from '../../helpers/auth';

test('Professional guest sign-in (signup flow surfaces guest button)', async ({
  page,
}) => {
  await gotoApp(page, '/(auth)/professional-signup');
  // Full signup requires real document uploads which we can't fake in
  // Playwright without bypassing the storage guard. Instead we exercise the
  // guest path which is what the dev/test flow uses (auto-verified profile).
  await page.getByTestId('prof-signup-guest-button').click();
  await expect(page.getByTestId('queue-sort')).toBeVisible({
    timeout: 20_000,
  });
});

test('Professional signup form validates password match', async ({ page }) => {
  await gotoApp(page, '/(auth)/professional-signup');
  await page.getByTestId('prof-signup-email-input').fill('prof-new@e2e.local');
  await page.getByTestId('prof-signup-password-input').fill('passwordA');
  await page
    .getByTestId('prof-signup-password-confirm-input')
    .fill('passwordB');
  await page.getByTestId('prof-signup-license-input').fill('999');
  await page
    .getByTestId('prof-signup-specialty-medicina-geral-e-familiar')
    .click();
  await page.getByTestId('prof-signup-submit-button').click();
  await expect(page.getByTestId('prof-signup-error')).toBeVisible();
});
