import { test, expect } from '@playwright/test';
import { loginAs } from '../../helpers/auth';
import { attachDocument } from '../../helpers/conversation';
import {
  TEST_USERS,
  seedConversation,
  listMessages,
} from '../../helpers/convex';

test('Patient can attach and send a document', async ({ page }) => {
  const seeded = await seedConversation({
    patientEmail: TEST_USERS.patientA.email,
    topic: 'general',
    title: 'Document upload — teste',
  });
  await loginAs(page, TEST_USERS.patientA.email);
  await page.goto(`/(patient)/conversations/${seeded.conversationId}`);
  await expect(page.getByTestId('message-input')).toBeVisible({
    timeout: 15_000,
  });
  await attachDocument(page);
  // The preview chip shows the file name once selected.
  await expect(page.getByText('sample-document.pdf').first()).toBeVisible({
    timeout: 10_000,
  });
  await page.getByTestId('message-send').click();

  await expect
    .poll(
      async () => {
        const msgs = await listMessages(seeded.conversationId);
        return msgs.some((m) => m.messageType === 'file');
      },
      { timeout: 20_000 },
    )
    .toBe(true);
});
