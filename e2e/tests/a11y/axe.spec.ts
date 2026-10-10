import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { gotoApp, loginAs } from '../../helpers/auth';
import { chooseTriageOption } from '../../helpers/triage';
import { TEST_USERS, seedConversation, seedUser } from '../../helpers/convex';

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

  test('patient: home, triage, conversation, profile and education', async ({ page }, testInfo) => {
    // A patient of its own: other specs leave open conversations that skip triage.
    const email = `a11y-axe-${testInfo.project.name}-${Date.now()}@e2e.local`;
    await seedUser({ email, password: 'e2e-test-pw', role: 'patient', profile: { displayName: 'A11y' } });
    const { conversationId } = await seedConversation({
      patientEmail: email,
      topic: 'contraception',
      title: 'A11y',
      status: 'waiting',
      initialMessage: 'Olá, tenho uma dúvida.',
    });
    await loginAs(page, email);
    await audit(page, 'patient-home');

    await page.goto('/triage?topic=pregnancy&mode=professional');
    await expect(page.getByTestId('triage-screen')).toBeVisible({ timeout: 15_000 });
    await audit(page, 'triage-question');
    await chooseTriageOption(page, 'triage-option-1');
    await chooseTriageOption(page, 'triage-option-yes');
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

    // Fixed message of a safety rule (alert card with call buttons), light and dark.
    const { conversationId: ruleConvId } = await seedConversation({
      patientEmail: email,
      topic: 'pregnancy',
      title: 'A11y regra',
      status: 'waiting',
    });
    await page.goto(`/(patient)/conversations/${ruleConvId}`);
    await page.getByTestId('message-input').fill('Não sinto o bebé mexer desde ontem.');
    await page.getByTestId('message-send').click();
    await expect(page.getByTestId('safety-rule-message')).toBeVisible({ timeout: 15_000 });
    await audit(page, 'safety-rule-message');
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForTimeout(500);
    await audit(page, 'safety-rule-message-dark');
    await page.emulateMedia({ colorScheme: 'light' });
  });

  test('professional: queue and case', async ({ page }, testInfo) => {
    // Own patient: shared test patients would get an open conversation that
    // makes other specs skip the triage.
    const email = `a11y-case-${testInfo.project.name}-${Date.now()}@e2e.local`;
    await seedUser({ email, password: 'e2e-test-pw', role: 'patient', profile: { displayName: 'A11y' } });
    const { conversationId } = await seedConversation({
      patientEmail: email,
      professionalEmail: TEST_USERS.professionalA.email,
      topic: 'pregnancy',
      title: 'A11y caso',
      status: 'active',
      initialMessage: 'Tenho uma dúvida sobre a gravidez.',
    });
    // One request per priority, so every chip colour is checked.
    for (const priority of ['urgent', 'high', 'medium', 'low'] as const) {
      await seedConversation({
        patientEmail: email,
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
