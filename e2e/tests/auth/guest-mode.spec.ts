import { test, expect } from '@playwright/test';
import { gotoApp } from '../../helpers/auth';
import { latestConsent } from '../../helpers/convex';

test('Guest patient sign-in lands on home', async ({ page }) => {
  await gotoApp(page, '/(auth)/login');
  await expect(page.getByTestId('auth-guest-button')).toContainText('Entrar sem conta');
  await expect(page.getByText('Sou enfermeiro/a', { exact: false })).toBeVisible();
  // Entering without an account needs the same consent as signing up.
  await expect(page.getByTestId('auth-guest-button')).toHaveAttribute('aria-disabled', 'true');
  await page.getByTestId('auth-guest-consent-checkbox').click();
  await expect(page.getByTestId('auth-guest-consent-checkbox')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('auth-guest-button').click();
  // Patient home: both ways to start a conversation are offered.
  await expect(page.getByTestId('home-path-professional')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('home-path-ai')).toBeVisible();
  await expect(page.getByTestId('home-path-professional')).toContainText('Enfermeiro/a');
  // Entering without an account records the consent too.
  expect(await latestConsent()).toMatchObject({ method: 'sem-conta' });
  // Topic names in sentence case.
  await page.getByTestId('home-path-professional').click();
  await expect(page.getByText('Ciclo menstrual', { exact: true }).filter({ visible: true })).toBeVisible();
});
