import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { gotoApp, loginAs } from '../../helpers/auth';
import { TEST_USERS, seedConversation } from '../../helpers/convex';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const BLOCKING = new Set(['serious', 'critical']);

async function audit(page: Page, name: string) {
  await page.waitForLoadState('networkidle');
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const summary = violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.length,
  }));
  await test.info().attach(`axe-${name}.json`, {
    body: JSON.stringify(summary, null, 2),
    contentType: 'application/json',
  });
  expect(summary.filter((v) => v.impact && BLOCKING.has(v.impact)), name).toEqual([]);
}

test.describe('Accessibility (axe, WCAG 2.1 AA)', () => {
  test('login', async ({ page }) => {
    await gotoApp(page, '/(auth)/login');
    await expect(page.getByTestId('auth-login-button')).toBeVisible();
    await audit(page, 'login');
  });

  test('patient home, conversation and education', async ({ page }) => {
    const { conversationId } = await seedConversation({
      patientEmail: TEST_USERS.patientB.email,
      topic: 'contraception',
      title: 'A11y',
      status: 'waiting',
      initialMessage: 'Olá, tenho uma dúvida.',
    });
    await loginAs(page, TEST_USERS.patientB.email);
    await audit(page, 'patient-home');
    await page.goto(`/(patient)/conversations/${conversationId}`);
    await expect(page.getByTestId('message-input')).toBeVisible({ timeout: 15_000 });
    await audit(page, 'patient-conversation');
    await page.goto('/(patient)/education');
    await audit(page, 'education');
  });

  test('professional queue', async ({ page }) => {
    await loginAs(page, TEST_USERS.professionalA.email);
    await page.goto('/(professional)/queue');
    await expect(page.getByTestId('queue-sort')).toBeVisible({ timeout: 15_000 });
    await audit(page, 'professional-queue');
  });
});
