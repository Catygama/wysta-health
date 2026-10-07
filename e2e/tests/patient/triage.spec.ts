import { test, expect } from '@playwright/test';
import { loginAs } from '../../helpers/auth';
import { answerTriage } from '../../helpers/triage';
import {
  TEST_USERS,
  listConversationsForPatient,
} from '../../helpers/convex';

test.describe('Triage flow (dynamic answers)', () => {
  test('low-risk path (menstrual-cycle) creates a low priority conversation', async ({
    page,
  }) => {
    await loginAs(page, TEST_USERS.patientA.email);
    await answerTriage(page, { topic: 'menstrual-cycle', target: 'low' });
    // After last answer, app navigates to the new conversation thread.
    await expect(page).toHaveURL(/\/conversations\//, { timeout: 15_000 });

    const convs = await listConversationsForPatient(TEST_USERS.patientA.email);
    expect(convs.length).toBeGreaterThan(0);
    const latest = convs[0];
    expect(latest.topic).toBe('menstrual-cycle');
    expect(latest.priority).toBe('low');
  });

  test('urgent-risk path triggers urgency alert + urgent priority', async ({
    page,
  }) => {
    await loginAs(page, TEST_USERS.patientA.email);
    await page.goto(`/triage?topic=menstrual-cycle`);
    // Answer first scale=10 (urgent), then yes-no red flag = yes which shows alert.
    // Use answerTriage with target 'urgent' but stop before completion to verify alert.
    // Simplest: drive via answerTriage and check that the conversation got priority urgent.
    await answerTriage(page, { topic: 'pregnancy', target: 'urgent' });
    await expect(page).toHaveURL(/\/conversations\//, { timeout: 15_000 });
    const convs = await listConversationsForPatient(TEST_USERS.patientA.email);
    const urgent = convs.find(
      (c) => c.topic === 'pregnancy' && c.priority === 'urgent',
    );
    expect(urgent, 'expected an urgent pregnancy conversation').toBeTruthy();
  });

  test('urgency alert appears when red-flag yes is picked', async ({
    page,
  }) => {
    // patientB: patientA already has an open pregnancy conversation (from the
    // urgent-path test), and an open conversation on the topic skips triage.
    await loginAs(page, TEST_USERS.patientB.email);
    await page.goto(`/triage?topic=pregnancy`);
    // weeks question first (multiple-choice), pick first option
    await page.getByTestId('triage-option-0').click();
    // bleeding (emergency level) → "yes" shows the 112 alert.
    await expect(page.getByTestId('triage-option-yes')).toBeVisible();
    await page.getByTestId('triage-option-yes').click();
    await expect(page.getByTestId('triage-alert')).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByTestId('triage-alert')).toContainText('Emergência');
    await expect(page.getByTestId('triage-alert-call')).toContainText('112');
  });

  // Regression: a red flag on the *last* question used to submit immediately,
  // navigating away before the alert was seen and dropping that answer, so the
  // conversation wasn't marked urgent.
  test('red flag on the last question shows the alert and marks urgent', async ({
    page,
  }) => {
    // patientB: patientA already has an open pregnancy conversation (from the
    // urgent-path test), and an open conversation on the topic skips triage.
    await loginAs(page, TEST_USERS.patientB.email);
    await page.goto(`/triage?topic=pregnancy`);
    // 'Não tenho a certeza' hides the baby-movements question (24+ weeks only).
    await page.getByTestId('triage-option-0').click(); // weeks
    await page.getByTestId('triage-option-no').click(); // bleeding
    await page.getByTestId('triage-option-no').click(); // abdominal-pain
    await page.getByTestId('triage-option-no').click(); // preeclampsia-signs
    await page.getByTestId('triage-option-yes').click(); // fluid-loss (last)

    await expect(page.getByTestId('triage-alert')).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/triage/);

    await page.getByTestId('triage-alert-dismiss').click();
    await expect(page).toHaveURL(/\/conversations\//, { timeout: 15_000 });
    const convs = await listConversationsForPatient(TEST_USERS.patientB.email);
    // Newest first.
    const latest = convs[0];
    expect(latest.topic).toBe('pregnancy');
    expect(latest.priority).toBe('urgent');
  });

  test('time-sensitive: unprotected sex shows the emergency-contraception message, no call button', async ({
    page,
  }) => {
    await loginAs(page, TEST_USERS.patientB.email);
    await page.goto(`/triage?topic=contraception`);
    await page.getByTestId('triage-option-0').click(); // current-method
    await page.getByTestId('triage-option-1').click(); // main-concern: Eficácia do método
    await page.getByTestId('triage-option-yes').click(); // unprotected
    const alert = page.getByTestId('triage-alert');
    await expect(alert).toBeVisible({ timeout: 5_000 });
    await expect(alert).toContainText('Sensível ao tempo');
    await expect(alert).toContainText('contraceção de emergência');
    await expect(page.getByTestId('triage-alert-call')).toHaveCount(0);

    await page.getByTestId('triage-alert-dismiss').click();
    await expect(page).toHaveURL(/\/conversations\//, { timeout: 15_000 });
    const latest = (await listConversationsForPatient(TEST_USERS.patientB.email))[0];
    expect(latest.topic).toBe('contraception');
    expect(latest.alertLevel).toBe('time-sensitive');
    expect(latest.priority).toBe('high');
  });

  test('priority: visible lesions show no alert but raise the conversation', async ({ page }) => {
    await loginAs(page, TEST_USERS.patientB.email);
    await page.goto(`/triage?topic=sti`);
    await page.getByTestId('triage-option-no').click(); // discharge
    await page.getByTestId('triage-option-yes').click(); // lesions
    await expect(page.getByTestId('triage-alert')).toHaveCount(0);
    await page.getByTestId('triage-option-no').click(); // urination-pain
    await page.getByTestId('triage-option-no').click(); // fever-pain (last)

    await expect(page).toHaveURL(/\/conversations\//, { timeout: 15_000 });
    const latest = (await listConversationsForPatient(TEST_USERS.patientB.email))[0];
    expect(latest.topic).toBe('sti');
    expect(latest.alertLevel).toBe('priority');
    expect(latest.priority).toBe('high');
  });
});
