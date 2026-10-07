import { test, expect } from '@playwright/test';
import { loginAs } from '../../helpers/auth';
import { TEST_USERS, seedConversation } from '../../helpers/convex';

// Professional threads live at /cases/:id. They used to share /conversations/:id
// with the patient group, which a bare URL resolves to, so a reload bounced the
// professional to the queue.
test('Professional stays on a conversation after reload', async ({ page }) => {
  // Failed once in a full run (2026-10-07): after the reload the URL was
  // /ongoing?id=<id> instead of /cases/<id>. Not reproduced since (60+ runs,
  // alone and in parallel), root cause unknown. The test used to reload as soon
  // as the URL matched, before the case had rendered; it now waits for the
  // thread first. Kept flagged until it has a clean record.
  test.info().annotations.push({
    type: 'flaky',
    description: 'Reload once landed on /ongoing?id=… instead of /cases/…; root cause unknown.',
  });
  const seeded = await seedConversation({
    patientEmail: TEST_USERS.patientA.email,
    topic: 'pregnancy',
    initialMessage: 'Olá, tenho uma dúvida.',
  });
  await loginAs(page, TEST_USERS.professionalA.email);
  await page.goto(`/(professional)/cases/${seeded.conversationId}`);
  await expect(page).toHaveURL(/\/cases\//);
  // Let the case screen finish loading before reloading it.
  await expect(page.getByText('Olá, tenho uma dúvida.').first()).toBeVisible({ timeout: 15_000 });
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`/cases/${seeded.conversationId}`), {
    timeout: 15_000,
  });
  await expect(page.getByText('Olá, tenho uma dúvida.').first()).toBeVisible({ timeout: 15_000 });
});
