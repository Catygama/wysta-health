import { test, expect } from '@playwright/test';
import { gotoApp } from '../../helpers/auth';

test('Guest patient sign-in lands on home', async ({ page }) => {
  await gotoApp(page, '/(auth)/login');
  await expect(page.getByTestId('auth-guest-button')).toContainText('Entrar sem conta');
  await expect(page.getByText('Sou enfermeiro/a', { exact: false })).toBeVisible();
  // Entering without an account doesn't ask for the consent (signing in does).
  await page.getByTestId('auth-guest-button').click();
  // Patient home: both ways to start a conversation are offered.
  await expect(page.getByTestId('home-path-professional')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('home-path-ai')).toBeVisible();
  await expect(page.getByTestId('home-path-professional')).toContainText('Enfermeiro/a');
  // Topic names in sentence case.
  await page.getByTestId('home-path-professional').click();
  await expect(page.getByText('Ciclo menstrual', { exact: true }).filter({ visible: true })).toBeVisible();
});
