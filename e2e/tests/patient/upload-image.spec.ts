import { test, expect } from '@playwright/test';
import { loginAs } from '../../helpers/auth';
import { attachImage } from '../../helpers/conversation';
import {
  TEST_USERS,
  seedConversation,
  listMessages,
} from '../../helpers/convex';

test('Patient can attach and send an image', async ({ page }) => {
  const seeded = await seedConversation({
    patientEmail: TEST_USERS.patientA.email,
    topic: 'general',
    title: 'Image upload — teste',
  });
  await loginAs(page, TEST_USERS.patientA.email);
  await page.goto(`/(patient)/conversations/${seeded.conversationId}`);
  await expect(page.getByTestId('message-input')).toBeVisible({
    timeout: 15_000,
  });
  await attachImage(page);
  // Attachment preview chip appears once selected.
  await expect(page.getByText(/Pronta a enviar|A enviar/).first()).toBeVisible({
    timeout: 10_000,
  });
  await page.getByTestId('message-send').click();

  await expect
    .poll(
      async () => {
        const msgs = await listMessages(seeded.conversationId);
        return msgs.some((m) => m.messageType === 'image');
      },
      { timeout: 20_000 },
    )
    .toBe(true);
});
