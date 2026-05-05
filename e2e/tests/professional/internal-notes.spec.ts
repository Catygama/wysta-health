import { test, expect } from '@playwright/test';
import { loginAs, logoutViaBridge } from '../../helpers/auth';
import { sendInternalNote } from '../../helpers/conversation';
import {
  TEST_USERS,
  seedConversation,
  listMessages,
} from '../../helpers/convex';

test('Internal notes are visible to professional but hidden from patient', async ({
  page,
}) => {
  const seeded = await seedConversation({
    patientEmail: TEST_USERS.patientA.email,
    professionalEmail: TEST_USERS.professionalA.email,
    topic: 'general',
    title: 'Notas internas',
    status: 'active',
  });

  await loginAs(page, TEST_USERS.professionalA.email);
  await page.goto(`/(professional)/conversations/${seeded.conversationId}`);
  await expect(page.getByTestId('thread-tab-internal')).toBeVisible({
    timeout: 15_000,
  });
  await sendInternalNote(page, 'NOTA INTERNA SECRETA');

  // Backend stores it as isInternal=true.
  await expect
    .poll(
      async () => {
        const msgs = await listMessages(seeded.conversationId);
        return msgs.some(
          (m) => m.content === 'NOTA INTERNA SECRETA' && m.isInternal === true,
        );
      },
      { timeout: 10_000 },
    )
    .toBe(true);

  // Switch context to patient and verify the note is NOT in the thread.
  await logoutViaBridge(page);
  await loginAs(page, TEST_USERS.patientA.email);
  await page.goto(`/(patient)/conversations/${seeded.conversationId}`);
  await expect(page.getByTestId('message-input')).toBeVisible({
    timeout: 15_000,
  });
  // Wait a moment for messages to render then assert absence.
  await page.waitForTimeout(1000);
  await expect(page.getByText('NOTA INTERNA SECRETA')).toHaveCount(0);
});
