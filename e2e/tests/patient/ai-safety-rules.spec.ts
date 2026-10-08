import { test, expect } from '@playwright/test';
import { loginAs } from '../../helpers/auth';
import { TEST_USERS } from '../../helpers/convex';

// Baby movements, sexual violence and suicidal ideation are answered by the
// rule-based detection with fixed contacts, without the language model (so
// this runs without an OpenAI key).
const CASES = [
  { text: 'o meu bebé quase não se mexe hoje', expect: 'SNS Grávida (808 24 24 24)' },
  { text: 'ele obrigou-me a ter relações', expect: 'APAV, 116 006' },
  { text: 'não consigo continuar a viver assim', expect: 'SNS 24 (808 24 24 24)' },
];

test('urgent situations get the fixed answer with concrete contacts', async ({ page }) => {
  await loginAs(page, TEST_USERS.patientB.email);
  await page.goto('/anonymous');
  for (const c of CASES) {
    await page.getByTestId('anonymous-input').fill(c.text);
    await page.getByTestId('anonymous-send').click();
    await expect(page.getByTestId('anonymous-messages').getByText(c.expect, { exact: false })).toBeVisible({
      timeout: 15_000,
    });
  }
});
