import { test, expect } from '@playwright/test';
import { loginAs } from '../../helpers/auth';
import {
  TEST_USERS,
  seedConversation,
  getConversation,
} from '../../helpers/convex';

test('Close conversation sets status closed', async ({ page }) => {
  const seeded = await seedConversation({
    patientEmail: TEST_USERS.patientA.email,
    professionalEmail: TEST_USERS.professionalA.email,
    topic: 'general',
    title: 'Fechar',
    status: 'active',
  });
  await loginAs(page, TEST_USERS.professionalA.email);
  await page.goto(`/(professional)/cases/${seeded.conversationId}`);
  await expect(page.getByTestId('conversation-close-button')).toBeVisible({
    timeout: 15_000,
  });
  await page.getByTestId('conversation-close-button').click();
  // Closing asks for confirmation first.
  await expect(page.getByTestId('close-conversation-dialog')).toBeVisible();
  await page.getByTestId('close-conversation-dialog-confirm').click();

  await expect
    .poll(
      async () => {
        const c = await getConversation(seeded.conversationId);
        return c?.status;
      },
      { timeout: 10_000 },
    )
    .toBe('closed');
});
