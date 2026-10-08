import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { gotoApp, loginAs } from '../../helpers/auth';
import { TEST_USERS, seedConversation } from '../../helpers/convex';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
// Serious and critical violations fail the suite.
const BLOCKING = new Set(['critical', 'serious']);
const OUT = 'test-results/axe';

async function audit(page: Page, name: string) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  const { violations, passes } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const summary = violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.map((n) => ({ target: n.target.join(' '), html: n.html.slice(0, 200), summary: n.failureSummary })),
  }));
  mkdirSync(OUT, { recursive: true });
  writeFileSync(
    `${OUT}/${test.info().project.name}-${name}.json`,
    JSON.stringify({ screen: name, passes: passes.length, violations: summary }, null, 2),
  );
  expect(
    summary.filter((v) => v.impact && BLOCKING.has(v.impact)).map((v) => `${v.id} (${v.nodes.length})`),
    name,
  ).toEqual([]);
}

test.describe('Accessibility (axe, WCAG 2.1 AA)', () => {
  test('login', async ({ page }) => {
    await gotoApp(page, '/(auth)/login');
    await expect(page.getByTestId('auth-login-button')).toBeVisible();
    await audit(page, 'login');
  });

  test('patient: home, triage, conversation, profile and education', async ({ page }) => {
    const { conversationId } = await seedConversation({
      patientEmail: TEST_USERS.patientB.email,
      topic: 'contraception',
      title: 'A11y',
      status: 'waiting',
      initialMessage: 'Olá, tenho uma dúvida.',
    });
    await loginAs(page, TEST_USERS.patientB.email);
    await audit(page, 'patient-home');

    await page.goto('/triage?topic=pregnancy&mode=professional');
    await expect(page.getByTestId('triage-screen')).toBeVisible({ timeout: 15_000 });
    await audit(page, 'triage-question');
    await page.getByTestId('triage-option-1').click();
    await page.getByTestId('triage-option-yes').click();
    await expect(page.getByTestId('triage-alert')).toBeVisible();
    await audit(page, 'triage-alert');

    await page.goto(`/(patient)/conversations/${conversationId}`);
    await expect(page.getByTestId('message-input')).toBeVisible({ timeout: 15_000 });
    await audit(page, 'patient-conversation');

    await page.goto('/(patient)/profile');
    await expect(page.getByTestId('profile-edit-button')).toBeVisible({ timeout: 15_000 });
    await audit(page, 'patient-profile');

    await page.goto('/(patient)/education');
    await audit(page, 'education');
  });

  test('professional: queue and case', async ({ page }) => {
    const { conversationId } = await seedConversation({
      patientEmail: TEST_USERS.patientA.email,
      professionalEmail: TEST_USERS.professionalA.email,
      topic: 'pregnancy',
      title: 'A11y caso',
      status: 'active',
      initialMessage: 'Tenho uma dúvida sobre a gravidez.',
    });
    // One request per priority, so every chip colour is checked.
    for (const priority of ['urgent', 'high', 'medium', 'low'] as const) {
      await seedConversation({
        patientEmail: TEST_USERS.patientB.email,
        topic: 'general',
        title: `A11y fila ${priority}`,
        priority,
        status: 'waiting',
        initialMessage: 'Pedido na fila.',
      });
    }
    await loginAs(page, TEST_USERS.professionalA.email);
    await page.goto('/(professional)/queue');
    await expect(page.getByTestId('queue-sort')).toBeVisible({ timeout: 15_000 });
    await audit(page, 'professional-queue');
    // Same screen in dark mode (chip contrast, WCAG 1.4.3).
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForTimeout(500);
    await audit(page, 'professional-queue-dark');
    await page.emulateMedia({ colorScheme: 'light' });

    await page.goto(`/(professional)/cases/${conversationId}`);
    await expect(page.getByTestId('message-input')).toBeVisible({ timeout: 15_000 });
    await audit(page, 'professional-case');
  });
});
