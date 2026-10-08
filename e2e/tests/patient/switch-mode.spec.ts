import { test, expect } from '@playwright/test';
import { loginAs } from '../../helpers/auth';
import { TEST_USERS, seedConversation } from '../../helpers/convex';

// A professional conversation offers a "Conversar com IA" header button (no
// kebab menu). It opens a separate AI conversation; from there "Falar com
// profissional" returns to the original one with a waiting notice.
test('Patient toggles between professional and AI conversations', async ({ page }) => {
  await seedConversation({
    patientEmail: TEST_USERS.patientA.email,
    topic: 'contraception',
    title: 'Mudar para AI — teste',
    initialMessage: 'Posso tomar a pílula e amoxicilina ao mesmo tempo?',
  });
  await loginAs(page, TEST_USERS.patientA.email);
  // Open conversations live in the Conversas tab.
  await page.goto('/(patient)/conversations');

  const card = page.getByTestId(/^patient-conversation-/).first();
  await expect(card).toBeVisible({ timeout: 15_000 });
  await card.click();
  await expect(page).toHaveURL(/\/conversations\//);
  const professionalUrl = page.url();

  await expect(page.getByTestId('conversation-menu-button')).toHaveCount(0);
  await page.getByTestId('conversation-switch-to-ai').click();

  // New AI conversation with the visibility notice.
  await expect(page).not.toHaveURL(professionalUrl, { timeout: 10_000 });
  await expect(page.getByText('Um enfermeiro pode ou não')).toBeVisible();

  // Back to the same professional conversation, now with the waiting notice.
  await page.getByTestId('conversation-switch-to-professional').click();
  await expect(page).toHaveURL(new RegExp(professionalUrl.split('/conversations/')[1].split('?')[0]));
  await expect(page.getByTestId('waiting-professional-banner')).toBeVisible();
});
