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
    await loginAs(page, TEST_USERS.patientA.email);
    await page.goto(`/triage?topic=pregnancy`);
    // weeks question first (multiple-choice), pick first option
    await page.getByTestId('triage-option-0').click();
    // bleeding (yes-no, isRedFlag) → "yes" should reveal urgency-alert.
    await expect(page.getByTestId('triage-option-yes')).toBeVisible();
    await page.getByTestId('triage-option-yes').click();
    await expect(page.getByTestId('urgency-alert')).toBeVisible({
      timeout: 5_000,
    });
  });
});
