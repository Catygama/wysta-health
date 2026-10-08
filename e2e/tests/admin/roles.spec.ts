import { test, expect } from '@playwright/test';
import { loginAs } from '../../helpers/auth';
import { TEST_USERS, seedUser } from '../../helpers/convex';

test('Admin can promote a patient to professional', async ({ page }, testInfo) => {
  // A patient of its own: promoting a shared test patient would send every
  // later patient spec that logs in as them to the professional queue.
  const email = `promote-${testInfo.project.name}-${Date.now()}@e2e.local`;
  await seedUser({ email, password: 'e2e-test-pw', role: 'patient', profile: { displayName: 'Promover' } });

  await loginAs(page, TEST_USERS.admin.email);
  await page.goto('/(admin)');
  await expect(page.getByTestId('admin-search-input')).toBeVisible({ timeout: 15_000 });
  await page.getByTestId('admin-search-input').fill(email);
  const row = page.getByTestId(`admin-user-row-${email}`);
  await expect(row).toBeVisible({ timeout: 15_000 });

  // Tapping the card opens the role dialog.
  await row.click();
  await page.getByTestId('admin-role-option-professional').click();
  await page.getByTestId('role-change-dialog-confirm').click();

  // After promotion the row re-renders with the new role pill text.
  await expect(row.getByText('Profissional')).toBeVisible({ timeout: 10_000 });
});
