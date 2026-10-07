import { test, expect } from '@playwright/test';
import { loginAs, logoutViaBridge } from '../../helpers/auth';
import {
  TEST_USERS,
  seedConversation,
  getConversation,
  listMessages,
} from '../../helpers/convex';

// Tests the new escalation flows that replaced the old escalate dialog:
// - Aumentar prioridade (markUrgent)
// - Recomendar consulta presencial (recommendInPerson, with optional close)
test.describe('Conversation escalation flows', () => {
  test('Aumentar prioridade para urgente', async ({ page }) => {
    const seeded = await seedConversation({
      patientEmail: TEST_USERS.patientA.email,
      professionalEmail: TEST_USERS.professionalA.email,
      topic: 'menstrual-cycle',
      title: 'Esc — urgente',
      priority: 'medium',
      status: 'active',
      initialMessage: 'Olá, dores fortes.',
    });
    await loginAs(page, TEST_USERS.professionalA.email);
    await page.goto(`/(professional)/cases/${seeded.conversationId}`);

    const button = page.getByTestId('conversation-mark-urgent');
    await expect(button).toBeVisible({ timeout: 15_000 });
    await button.click();
    await expect(button).toBeHidden({ timeout: 5_000 });

    await expect
      .poll(async () => (await getConversation(seeded.conversationId))?.priority, {
        timeout: 5_000,
      })
      .toBe('urgent');

    await logoutViaBridge(page);
  });

  test('Recomendar presencial sem fechar deixa conversa aberta', async ({ page }) => {
    const seeded = await seedConversation({
      patientEmail: TEST_USERS.patientA.email,
      professionalEmail: TEST_USERS.professionalA.email,
      topic: 'general',
      title: 'Esc — redirect open',
      priority: 'low',
      status: 'active',
      initialMessage: 'Olá doutora.',
    });
    await loginAs(page, TEST_USERS.professionalA.email);
    await page.goto(`/(professional)/cases/${seeded.conversationId}`);

    await page.getByTestId('conversation-recommend-in-person').click({ timeout: 15_000 });
    await page.getByTestId('redirect-also-close').click(); // toggle off
    await page.getByTestId('redirect-submit').click();

    // Continua aberta — close button visível
    await expect(page.getByTestId('conversation-close-button')).toBeVisible();

    await expect
      .poll(async () => (await getConversation(seeded.conversationId))?.status, {
        timeout: 5_000,
      })
      .toBe('active');

    const messages = await listMessages(seeded.conversationId);
    const last = messages[messages.length - 1];
    expect(last?.content).toContain('SNS 24');
    expect(last?.messageType).toBe('system');

    await logoutViaBridge(page);
  });

  test('Recomendar presencial com fechar termina a conversa', async ({ page }) => {
    const seeded = await seedConversation({
      patientEmail: TEST_USERS.patientA.email,
      professionalEmail: TEST_USERS.professionalA.email,
      topic: 'general',
      title: 'Esc — redirect close',
      priority: 'low',
      status: 'active',
      initialMessage: 'Tenho uma dor que não passa.',
    });
    await loginAs(page, TEST_USERS.professionalA.email);
    await page.goto(`/(professional)/cases/${seeded.conversationId}`);

    await page.getByTestId('conversation-recommend-in-person').click({ timeout: 15_000 });
    // keep switch ON (default true) — fecha
    await page.getByTestId('redirect-submit').click();

    await expect
      .poll(
        async () => {
          const c = await getConversation(seeded.conversationId);
          return { status: c?.status, reason: c?.closureReason };
        },
        { timeout: 10_000 },
      )
      .toEqual({ status: 'closed', reason: 'redirected-to-in-person' });

    await logoutViaBridge(page);
  });
});
