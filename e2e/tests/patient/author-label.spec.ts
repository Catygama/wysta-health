import { test, expect } from '@playwright/test';
import { loginAs, logoutViaBridge } from '../../helpers/auth';
import { sendMessage } from '../../helpers/conversation';
import { TEST_USERS, seedConversation, listMessages } from '../../helpers/convex';

// Each reply says who wrote it: the nurse's name above her message.
test('the patient sees the name of the professional who replied', async ({ page }) => {
  const seeded = await seedConversation({
    patientEmail: TEST_USERS.patientA.email,
    professionalEmail: TEST_USERS.professionalA.email,
    topic: 'general',
    title: 'Autor das respostas',
    status: 'active',
    initialMessage: 'Pergunta da utente',
  });

  await loginAs(page, TEST_USERS.professionalA.email);
  await page.goto(`/(professional)/cases/${seeded.conversationId}`);
  await expect(page.getByTestId('message-input')).toBeVisible({ timeout: 15_000 });
  await sendMessage(page, 'Resposta da enfermeira');
  await expect
    .poll(async () => (await listMessages(seeded.conversationId)).some((m) => m.content === 'Resposta da enfermeira'), {
      timeout: 10_000,
    })
    .toBe(true);

  await logoutViaBridge(page);
  await loginAs(page, TEST_USERS.patientA.email);
  await page.goto(`/(patient)/conversations/${seeded.conversationId}`);
  const reply = page.getByText('Resposta da enfermeira', { exact: true }).filter({ visible: true });
  await expect(reply).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId(/^message-.*-author$/).filter({ hasText: 'Dra. Ana' }).first()).toBeVisible();
});
