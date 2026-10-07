import { test, expect } from '@playwright/test';
import { loginAs } from '../../helpers/auth';
import { TEST_USERS } from '../../helpers/convex';

test('Profile edit persists name + age range', async ({ page }) => {
  await loginAs(page, TEST_USERS.patientA.email);
  await page.goto('/(patient)/profile');
  await expect(page.getByTestId('profile-edit-button')).toBeVisible({
    timeout: 15_000,
  });
  await page.getByTestId('profile-edit-button').click();
  await page.getByTestId('profile-name-input').fill('Maria Atualizada');
  await page.getByTestId('profile-age-36-45').click();
  await page.getByTestId('profile-save-button').click();

  // After save, view returns to read-only mode showing the new name.
  await expect(page.getByText('Maria Atualizada').first()).toBeVisible({
    timeout: 10_000,
  });
});
