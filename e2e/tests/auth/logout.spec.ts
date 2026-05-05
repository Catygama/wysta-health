import { test, expect } from '@playwright/test';
import { loginAs, logoutViaBridge } from '../../helpers/auth';
import { TEST_USERS } from '../../helpers/convex';

test('Patient logout returns to login', async ({ page }) => {
  await loginAs(page, TEST_USERS.patientA.email);
  await page.goto('/(patient)/profile');
  await expect(page.getByTestId('profile-logout-button')).toBeVisible({
    timeout: 15_000,
  });

  // RN-web's Alert.alert renders as window.alert (single-button) — the
  // multi-button "Sair" callback never fires on web. Bypass via the bridge to
  // exercise the logout state transition (sign-out → patient layout's
  // !user → redirect to /(auth)/login).
  await logoutViaBridge(page);
  await page.goto('/');

  await expect(page.getByTestId('auth-login-button')).toBeVisible({
    timeout: 15_000,
  });
});
