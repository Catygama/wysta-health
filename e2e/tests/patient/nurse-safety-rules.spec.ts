import { test, expect } from '@playwright/test';
import { loginAs, logoutViaBridge } from '../../helpers/auth';
import { sendMessage } from '../../helpers/conversation';
import { TEST_USERS, getConversation, seedConversation, seedUser } from '../../helpers/convex';

// What the patient writes to a nurse goes through the same rule-based safety
// detection as the AI chat: she sees the fixed message with the contacts at
// once, and the request jumps ahead in the nurse's queue.
test('a message to the nurse that matches a safety rule shows the contacts and raises the request', async ({
  page,
}, testInfo) => {
  const stamp = `${testInfo.project.name}-${Date.now()}`;
  const email = `regras-enfermeiro-${stamp}@e2e.local`;
  const otherEmail = `regras-enfermeiro-outra-${stamp}@e2e.local`;
  for (const e of [email, otherEmail]) {
    await seedUser({ email: e, password: 'e2e-test-pw', role: 'patient', profile: { displayName: 'Regras' } });
  }
  // An older request with high priority, ahead of hers until the rule fires.
  const older = await seedConversation({
    patientEmail: otherEmail,
    topic: 'contraception',
    title: 'Pedido mais antigo',
    priority: 'high',
    status: 'waiting',
    initialMessage: 'Tenho uma dúvida sobre a pílula.',
  });
  const { conversationId } = await seedConversation({
    patientEmail: email,
    topic: 'contraception',
    title: 'Pedido com regra',
    priority: 'low',
    status: 'waiting',
  });

  await loginAs(page, email);
  await page.goto(`/(patient)/conversations/${conversationId}`);
  await sendMessage(page, 'Acho que puseram alguma coisa na minha bebida ontem.');

  const thread = page.getByTestId('messages-list-chat');
  await expect(thread.getByText('Acho que puseram alguma coisa na minha bebida ontem.')).toBeVisible();
  // The fixed message as the triage alert card: label, level, text and calls.
  const card = thread.getByTestId('safety-rule-message');
  await expect(card).toBeVisible({ timeout: 10_000 });
  await expect(card.getByText('Mensagem automática da Wysta')).toBeVisible();
  await expect(card.getByText('Urgente', { exact: true })).toBeVisible();
  await expect(card.getByText('Linha de Apoio à Vítima (116 006)', { exact: false })).toBeVisible();
  for (const name of [
    'Ligar para o 112',
    'Ligar para o SNS 24, 808 24 24 24',
    'Ligar para a APAV, Linha de Apoio à Vítima, 116 006',
  ]) {
    await expect(card.getByRole('link', { name })).toBeVisible();
  }
  await expect(thread.getByText('A preparar a resposta…')).toHaveCount(0);
  expect(await getConversation(conversationId)).toMatchObject({ priority: 'urgent', alertLevel: 'urgent' });

  // The list preview is her message, not the fixed one.
  await page.goto('/(patient)/conversations');
  const row = page.getByTestId(`patient-conversation-${conversationId}`);
  await expect(row.getByText('Acho que puseram alguma coisa', { exact: false })).toBeVisible({ timeout: 10_000 });
  await expect(row.getByText('Não estás sozinha', { exact: false })).toHaveCount(0);

  // Switching to the AI doesn't show the same fixed message again.
  await row.click();
  await page.getByTestId('conversation-switch-to-ai').click();
  await expect(page.getByTestId('conversation-switch-to-professional')).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(1_500);
  await expect(page.getByTestId('messages-list-chat').getByTestId('safety-rule-message')).toHaveCount(0);

  // The nurse: her request is now above the older high-priority one.
  await logoutViaBridge(page);
  await loginAs(page, TEST_USERS.professionalA.email);
  await page.goto('/(professional)/queue');
  await expect(page.getByTestId('queue-sort')).toBeVisible({ timeout: 15_000 });
  const rows = page.getByTestId(/^conversation-row-/);
  await expect(page.getByTestId(`conversation-row-${conversationId}`)).toBeVisible({ timeout: 10_000 });
  const ids = await rows.evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')));
  expect(ids.indexOf(`conversation-row-${conversationId}`)).toBeLessThan(
    ids.indexOf(`conversation-row-${older.conversationId}`),
  );

  // And reads what the patient wrote.
  await page.getByTestId(`conversation-row-${conversationId}`).click();
  await expect(page.getByText('Acho que puseram alguma coisa na minha bebida ontem.').first()).toBeVisible({
    timeout: 10_000,
  });
});
