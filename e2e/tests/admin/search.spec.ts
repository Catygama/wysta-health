import { test, expect } from '@playwright/test';
import { loginAs } from '../../helpers/auth';
import { TEST_USERS } from '../../helpers/convex';

test('Admin search filters user list by email', async ({ page }) => {
  await loginAs(page, TEST_USERS.admin.email);
  await page.goto('/(admin)');
  await expect(page.getByTestId('admin-search-input')).toBeVisible({
    timeout: 15_000,
  });
  await page.getByTestId('admin-search-input').fill('prof-a');
  await expect(
    page.getByTestId(`admin-user-row-${TEST_USERS.professionalA.email}`),
  ).toBeVisible({ timeout: 5_000 });
  await expect(
    page.getByTestId(`admin-user-row-${TEST_USERS.patientA.email}`),
  ).toHaveCount(0);
});
