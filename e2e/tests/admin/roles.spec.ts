import { test, expect } from '@playwright/test';
import { loginAs } from '../../helpers/auth';
import { TEST_USERS } from '../../helpers/convex';

test('Admin can promote a patient to professional', async ({ page }) => {
  await loginAs(page, TEST_USERS.admin.email);
  await page.goto('/(admin)');
  const row = page.getByTestId(`admin-user-row-${TEST_USERS.patientB.email}`);
  await expect(row).toBeVisible({ timeout: 15_000 });

  // The role-change button confirms via window.confirm on web.
  page.once('dialog', (d) => d.accept());
  await page
    .getByTestId(`admin-role-${TEST_USERS.patientB.email}-professional`)
    .click();

  // After promotion the row re-renders with the new role pill text.
  await expect(row.getByText('Profissional')).toBeVisible({ timeout: 10_000 });
});
