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
// - Pedir 2ª opinião (requestReview + clearReview)
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

  test('Pedir 2ª opinião + filtro Para revisão + marcar concluída', async ({ page }) => {
    const seeded = await seedConversation({
      patientEmail: TEST_USERS.patientA.email,
      professionalEmail: TEST_USERS.professionalA.email,
      topic: 'menstrual-cycle',
      title: 'Esc — review',
      priority: 'medium',
      status: 'active',
      initialMessage: 'Olá doutora.',
    });
    await loginAs(page, TEST_USERS.professionalA.email);
    await page.goto(`/(professional)/cases/${seeded.conversationId}`);

    await page.getByTestId('conversation-request-review').click({ timeout: 15_000 });
    await page.getByTestId('review-question-input').fill(
      'Esta utente tem dor pélvica. Como interpretar com pílula em curso?',
    );
    await page.getByTestId('review-submit').click();

    // Banner com a pergunta
    await expect(page.getByText('Pedido de 2ª opinião')).toBeVisible();

    // needsReview persistido
    await expect
      .poll(async () => (await getConversation(seeded.conversationId))?.needsReview, {
        timeout: 5_000,
      })
      .toBe(true);

    // Filtro na queue
    await page.goto('/(professional)/queue');
    await page.getByText('Para revisão').click();
    await expect(page.getByText('Esc — review').first()).toBeVisible();

    // Marcar concluída
    await page.goto(`/(professional)/cases/${seeded.conversationId}`);
    await page.getByTestId('conversation-clear-review').click({ timeout: 15_000 });
    await expect(page.getByTestId('conversation-request-review')).toBeVisible();

    await expect
      .poll(async () => (await getConversation(seeded.conversationId))?.needsReview, {
        timeout: 5_000,
      })
      .toBe(false);

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
