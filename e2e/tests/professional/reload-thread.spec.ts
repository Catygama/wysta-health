import { test, expect } from '@playwright/test';
import { loginAs } from '../../helpers/auth';
import { TEST_USERS, seedConversation } from '../../helpers/convex';

// Professional threads live at /cases/:id. They used to share /conversations/:id
// with the patient group, which a bare URL resolves to, so a reload bounced the
// professional to the queue.
test('Professional stays on a conversation after reload', async ({ page }) => {
  const seeded = await seedConversation({
    patientEmail: TEST_USERS.patientA.email,
    topic: 'pregnancy',
    initialMessage: 'Olá, tenho uma dúvida.',
  });
  await loginAs(page, TEST_USERS.professionalA.email);
  await page.goto(`/(professional)/cases/${seeded.conversationId}`);
  await expect(page).toHaveURL(/\/cases\//);
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`/cases/${seeded.conversationId}`), {
    timeout: 15_000,
  });
  await expect(page.getByText('Olá, tenho uma dúvida.').first()).toBeVisible({ timeout: 15_000 });
});
