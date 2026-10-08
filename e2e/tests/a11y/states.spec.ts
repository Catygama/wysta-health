import { test, expect } from '@playwright/test';
import { loginAs } from '../../helpers/auth';
import { TEST_USERS, seedUser } from '../../helpers/convex';

// Screen readers on the web get the selection state (WCAG 4.1.2), not only
// the colour: aria-checked on options, aria-expanded on menus.
test('selection state reaches assistive technology', async ({ page }, testInfo) => {
  // A patient of its own: other specs leave open conversations that skip triage.
  const email = `a11y-states-${testInfo.project.name}-${Date.now()}@e2e.local`;
  await seedUser({ email, password: 'e2e-test-pw', role: 'patient', profile: { displayName: 'A11y' } });
  await loginAs(page, email);

  // Triage: options are radios in a group named by the question.
  await page.goto('/triage?topic=pregnancy&mode=professional');
  await expect(page.getByTestId('triage-screen')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('radiogroup', { name: 'De quantas semanas estás?' })).toBeVisible();
  await expect(page.getByTestId('triage-option-1')).toHaveAttribute('aria-checked', 'false');
  await page.getByTestId('triage-option-1').click();
  await page.getByTestId('triage-back').click();
  await expect(page.getByTestId('triage-option-1')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('triage-option-0')).toHaveAttribute('aria-checked', 'false');

  // Theme choice in the profile.
  await page.goto('/(patient)/profile');
  await expect(page.getByTestId('theme-mode-system')).toHaveAttribute('aria-checked', 'true', { timeout: 15_000 });
  await page.getByTestId('theme-mode-dark').click();
  await expect(page.getByTestId('theme-mode-dark')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('theme-mode-system')).toHaveAttribute('aria-checked', 'false');
  await page.getByTestId('theme-mode-system').click();
});

test('queue menus expose expanded and checked', async ({ page }) => {
  await loginAs(page, TEST_USERS.professionalA.email);
  await page.goto('/(professional)/queue');
  const sort = page.getByTestId('queue-sort');
  await expect(sort).toHaveAttribute('aria-expanded', 'false', { timeout: 15_000 });
  await sort.click();
  await expect(sort).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByTestId('queue-sort-priority')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('queue-sort-oldest')).toHaveAttribute('aria-checked', 'false');
});
