import { test, expect } from '@playwright/test';
import { loginAs } from '../../helpers/auth';
import { TEST_USERS, seedConversation } from '../../helpers/convex';

test('Continue conversation card navigates to thread', async ({ page }) => {
  await seedConversation({
    patientEmail: TEST_USERS.patientB.email,
    topic: 'general',
    title: 'Continuar — teste',
    initialMessage: 'olá',
  });
  await loginAs(page, TEST_USERS.patientB.email);
  // Open conversations live in the Conversas tab.
  await page.goto('/(patient)/conversations');
  const card = page.getByTestId(/^patient-conversation-/).first();
  await expect(card).toBeVisible({ timeout: 15_000 });
  await card.click();
  await expect(page).toHaveURL(/\/conversations\//);
  await expect(page.getByText('olá').first()).toBeVisible({ timeout: 10_000 });
});
