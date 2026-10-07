import { test, expect } from '@playwright/test';
import { loginAs } from '../../helpers/auth';
import { TEST_USERS } from '../../helpers/convex';

test('Admin seed button updates triage + articles idempotently', async ({
  page,
}) => {
  await loginAs(page, TEST_USERS.admin.email);
  await page.goto('/content');
  await expect(page.getByTestId('admin-seed-button')).toBeVisible({
    timeout: 15_000,
  });
  await page.getByTestId('admin-seed-button').click();
  await expect(page.getByTestId('admin-seed-result')).toBeVisible({
    timeout: 15_000,
  });
  // Result text mentions "atualizada" since global setup already seeded.
  const text = await page.getByTestId('admin-seed-result').textContent();
  expect(text).toMatch(/triagem/i);
});
