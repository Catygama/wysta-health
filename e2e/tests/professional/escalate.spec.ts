import { test, expect } from '@playwright/test';
import { loginAs } from '../../helpers/auth';
import {
  TEST_USERS,
  seedConversation,
  getConversation,
} from '../../helpers/convex';

test('Escalation sets priority to urgent and emits system message', async ({
  page,
}) => {
  const seeded = await seedConversation({
    patientEmail: TEST_USERS.patientA.email,
    professionalEmail: TEST_USERS.professionalA.email,
    topic: 'general',
    title: 'Escalar',
    status: 'active',
    priority: 'medium',
  });
  await loginAs(page, TEST_USERS.professionalA.email);
  await page.goto(`/(professional)/conversations/${seeded.conversationId}`);
  await expect(page.getByTestId('conversation-escalate-button')).toBeVisible({
    timeout: 15_000,
  });
  await page.getByTestId('conversation-escalate-button').click();

  await expect(page.getByTestId('escalate-level-urgent')).toBeVisible({
    timeout: 10_000,
  });
  await page.getByTestId('escalate-level-urgent').click();
  await page.getByTestId('escalate-notes').fill('Sintomas pioraram');
  await page.getByTestId('escalate-submit').click();

  await expect
    .poll(
      async () => {
        const c = await getConversation(seeded.conversationId);
        return { status: c?.status, priority: c?.priority };
      },
      { timeout: 10_000 },
    )
    .toMatchObject({ status: 'escalated', priority: 'urgent' });
});
