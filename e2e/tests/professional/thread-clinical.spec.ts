import { test, expect } from '@playwright/test';
import { loginAs } from '../../helpers/auth';
import { TEST_USERS, seedConversation } from '../../helpers/convex';

// Desktop viewport: the options panel is open beside the chat.
test('Professional sees patient context + summary in the options panel', async ({
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
  await page.goto(`/(professional)/cases/${seeded.conversationId}`);

  await expect(page.getByTestId('thread-tab-summary')).toBeVisible({
    timeout: 15_000,
  });
  // Patient context row shows the displayName or email — match either.
  // Other specs may have edited the displayName.
  await expect(
    page.getByText(/Maria|patient-a@e2e\.local/).first(),
  ).toBeVisible();

  await page.getByTestId('thread-tab-summary').click();
  await expect(page.getByText(/Mensagens nesta conversa/i)).toBeVisible();
});
