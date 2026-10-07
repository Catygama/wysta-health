import { test, expect } from '@playwright/test';
import { loginAs } from '../../helpers/auth';
import { sendMessage } from '../../helpers/conversation';
import {
  TEST_USERS,
  seedConversation,
  listMessages,
} from '../../helpers/convex';

test('Patient sees own conversation list and can send a text message', async ({
  page,
}) => {
  const seeded = await seedConversation({
    patientEmail: TEST_USERS.patientA.email,
    topic: 'general',
    title: 'Conversas — teste',
  });
  await loginAs(page, TEST_USERS.patientA.email);
  await page.goto('/(patient)/conversations');
  const card = page.getByTestId(`patient-conversation-${seeded.conversationId}`);
  await expect(card).toBeVisible({ timeout: 15_000 });
  await card.click();
  await expect(page).toHaveURL(new RegExp(`/conversations/${seeded.conversationId}`));

  await sendMessage(page, 'mensagem de teste');
  await expect(page.getByText('mensagem de teste').first()).toBeVisible({
    timeout: 10_000,
  });

  await expect
    .poll(
      async () => {
        const msgs = await listMessages(seeded.conversationId);
        return msgs.some(
          (m) => m.content === 'mensagem de teste' && m.messageType === 'text',
        );
      },
      { timeout: 10_000 },
    )
    .toBe(true);
});
