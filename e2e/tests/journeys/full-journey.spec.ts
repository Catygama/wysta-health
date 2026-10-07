import { test, expect } from '@playwright/test';
import { loginAs, logoutViaBridge } from '../../helpers/auth';
import { answerTriage } from '../../helpers/triage';
import { sendMessage, expectMessageVisible } from '../../helpers/conversation';
import {
  TEST_USERS,
  seedUser,
  listConversationsForPatient,
  getConversation,
  listMessages,
} from '../../helpers/convex';

// The three tasks of the hierarchical task analysis, end to end, in one run:
// 1. the patient completes the triage and sends her question;
// 2. a professional takes it from the queue and answers;
// 3. the patient reads the answer.
test('Full journey: triage → professional answer → patient reads it', async ({ page }) => {
  const patient = { email: `journey-${Date.now()}@e2e.local`, password: 'e2e-test-pw' };
  await seedUser({ ...patient, role: 'patient', profile: { displayName: 'Utente Jornada' } });
  const question = 'Tenho um pequeno corrimento novo, devo preocupar-me?';
  const answer = 'Obrigada pela pergunta. Pela triagem não há sinais de alarme; vamos ver juntas.';
  let conversationId = '';

  await test.step('1. Utente faz a triagem e envia a pergunta', async () => {
    await loginAs(page, patient.email, patient.password);
    await answerTriage(page, { topic: 'sti', target: 'low' });
    await expect(page).toHaveURL(/\/conversations\//, { timeout: 15_000 });
    const [conv] = await listConversationsForPatient(patient.email);
    expect(conv).toMatchObject({ topic: 'sti', status: 'waiting' });
    conversationId = conv._id;
    await sendMessage(page, question);
    await expectMessageVisible(page, question);
    await logoutViaBridge(page);
  });

  await test.step('2. Profissional atribui-se o pedido e responde', async () => {
    await loginAs(page, TEST_USERS.professionalA.email);
    await page.goto('/(professional)/queue');
    const row = page.getByTestId(`conversation-row-${conversationId}`);
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.click();
    await page.getByTestId('conversation-assign-button').click();
    await expect.poll(async () => (await getConversation(conversationId))?.status, { timeout: 10_000 }).toBe('active');
    await sendMessage(page, answer);
    await expect
      .poll(async () => (await listMessages(conversationId)).some((m) => m.content === answer && !m.isInternal), {
        timeout: 10_000,
      })
      .toBe(true);
    await logoutViaBridge(page);
  });

  await test.step('3. Utente lê a resposta', async () => {
    await loginAs(page, patient.email, patient.password);
    await page.goto(`/(patient)/conversations/${conversationId}`);
    await expectMessageVisible(page, answer);
    await expectMessageVisible(page, question);
  });
});
