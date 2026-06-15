import { test, expect } from '@playwright/test';
import { loginAs } from '../../helpers/auth';
import { TEST_USERS, seedConversation } from '../../helpers/convex';

// The patient can request an AI assistant reply from the conversation's
// header overflow (kebab) menu — not from a per-bubble pill. The menu acts on
// the patient's most recent text message.
test('Kebab menu offers an assistant reply on a professional conversation', async ({
  page,
}) => {
  await seedConversation({
    patientEmail: TEST_USERS.patientA.email,
    topic: 'contraception',
    title: 'Pedir AI — teste',
    initialMessage: 'Posso tomar a pílula e amoxicilina ao mesmo tempo?',
  });
  await loginAs(page, TEST_USERS.patientA.email);

  // Open the conversation from the care feed.
  const card = page.getByTestId(/^patient-conversation-/).first();
  await expect(card).toBeVisible({ timeout: 15_000 });
  await card.click();
  await expect(page).toHaveURL(/\/conversations\//);
  await expect(
    page.getByText('Posso tomar a pílula e amoxicilina ao mesmo tempo?').first(),
  ).toBeVisible({ timeout: 10_000 });

  // No inline per-bubble AI pill anymore.
  await expect(page.getByTestId('ask-ai-inline')).toHaveCount(0);

  // The kebab is in the header; opening it reveals the assistant action.
  await page.getByTestId('conversation-menu-button').click();
  const askItem = page.getByTestId('conversation-ask-ai');
  await expect(askItem).toBeVisible();
  await expect(page.getByText('Pedir resposta da assistente')).toBeVisible();

  // Triggering it closes the menu and shows the thinking state.
  await askItem.click();
  await expect(askItem).toHaveCount(0);
  await expect(page.getByText('A assistente está a pensar…')).toBeVisible();
});
