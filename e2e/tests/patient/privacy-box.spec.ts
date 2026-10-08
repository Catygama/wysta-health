import { test, expect } from '@playwright/test';
import { loginAs } from '../../helpers/auth';
import { TEST_USERS } from '../../helpers/convex';

// The profile's privacy note says who sees the data and that the AI provider
// is external, as implemented on the server.
test('profile privacy note reflects who can access the data', async ({ page }) => {
  await loginAs(page, TEST_USERS.patientA.email);
  await page.goto('/(patient)/profile');
  await expect(page.getByText(/equipa de enfermagem\s+verificada/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/não tem acesso às\s+conversas/)).toBeVisible();
  await expect(page.getByText(/fornecedor externo de IA/)).toBeVisible();
  await expect(page.getByTestId('profile-export-button')).toBeVisible();
  await expect(page.getByTestId('profile-delete-account-button')).toBeVisible();
});
