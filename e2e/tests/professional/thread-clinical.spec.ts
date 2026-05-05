import { test, expect } from '@playwright/test';
import { loginAs } from '../../helpers/auth';
import { TEST_USERS, seedConversation } from '../../helpers/convex';

test('Professional sees patient context + triage summary tab', async ({
  page,
}) => {
  const seeded = await seedConversation({
    patientEmail: TEST_USERS.patientA.email,
    professionalEmail: TEST_USERS.professionalA.email,
    topic: 'general',
    title: 'Thread clínico',
    status: 'active',
  });
  await loginAs(page, TEST_USERS.professionalA.email);
  await page.goto(`/(professional)/conversations/${seeded.conversationId}`);

  await expect(page.getByTestId('thread-tab-chat')).toBeVisible({
    timeout: 15_000,
  });
  // Patient context row shows the displayName or email — match either.
  // Other specs may have edited the displayName.
  await expect(
    page.getByText(/Maria|patient-a@e2e\.local/).first(),
  ).toBeVisible();

  await page.getByTestId('thread-tab-summary').click();
  await expect(page.getByText(/Estatísticas da conversa/i)).toBeVisible();
});
