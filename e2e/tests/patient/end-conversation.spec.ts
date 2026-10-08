import { test, expect } from '@playwright/test';
import { loginAs } from '../../helpers/auth';
import { TEST_USERS, seedConversation, getConversation } from '../../helpers/convex';

// The ⊗ that ends a conversation says "Terminar" and always asks first.
test('ending a conversation shows a clear label and asks for confirmation', async ({ page }) => {
  const seeded = await seedConversation({
    patientEmail: TEST_USERS.patientB.email,
    topic: 'general',
    title: 'Terminar — teste',
    initialMessage: 'olá',
  });
  await loginAs(page, TEST_USERS.patientB.email);

  // In the list.
  await page.goto('/(patient)/conversations');
  const end = page.getByTestId(`end-conversation-${seeded.conversationId}`);
  await expect(end).toBeVisible({ timeout: 15_000 });
  await expect(end).toContainText('Terminar');
  await expect(end).toHaveAttribute('aria-label', 'Terminar conversa');
  await end.click();
  await expect(page.getByText('Cancelar').filter({ visible: true }).first()).toBeVisible();
  await page.getByText('Cancelar').filter({ visible: true }).first().click();
  expect((await getConversation(seeded.conversationId))?.status).not.toBe('closed');

  // In the conversation header.
  await page.goto(`/(patient)/conversations/${seeded.conversationId}`);
  const headerEnd = page.getByTestId('conversation-end-button');
  await expect(headerEnd).toContainText('Terminar', { timeout: 15_000 });
  await headerEnd.click();
  await expect(page.getByTestId('end-conversation-dialog')).toBeVisible();
  await page.getByTestId('end-conversation-dialog-confirm').click();
  await expect.poll(async () => (await getConversation(seeded.conversationId))?.status, { timeout: 10_000 }).toBe('closed');
});
