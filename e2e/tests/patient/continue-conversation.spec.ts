import { test, expect } from '@playwright/test';
import { loginAs } from '../../helpers/auth';
import { TEST_USERS, seedConversation } from '../../helpers/convex';

test('Continue conversation card navigates to thread', async ({ page }) => {
  const seeded = await seedConversation({
    patientEmail: TEST_USERS.patientB.email,
    topic: 'general',
    title: 'Continuar — teste',
    initialMessage: 'olá',
  });
  await loginAs(page, TEST_USERS.patientB.email);
  // Open conversations live in the Conversas tab. patientB has others from
  // earlier specs, so open the seeded one by id.
  await page.goto('/(patient)/conversations');
  const card = page.getByTestId(`patient-conversation-${seeded.conversationId}`);
  await expect(card).toBeVisible({ timeout: 15_000 });
  await card.click();
  await expect(page).toHaveURL(new RegExp(`/conversations/${seeded.conversationId}`));
  // The seeded message in the open thread. getByText is a case-insensitive
  // substring match, and screens kept mounted behind it ("Olá, …" on Início)
  // match too: take the exact text, visible.
  await expect(
    page.getByText('olá', { exact: true }).filter({ visible: true }).first(),
  ).toBeVisible({ timeout: 10_000 });
});
