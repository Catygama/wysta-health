import { type Page, expect } from '@playwright/test';
import path from 'node:path';

const FIXTURES = path.resolve(__dirname, '..', 'fixtures');

export async function sendMessage(page: Page, text: string) {
  await page.getByTestId('message-input').fill(text);
  await page.getByTestId('message-send').click();
}

export async function sendInternalNote(page: Page, text: string) {
  await page.getByTestId('thread-tab-internal').click();
  await page.getByTestId('message-input-internal').fill(text);
  await page.getByTestId('message-send-internal').click();
}

export async function attachImage(
  page: Page,
  fixtureFile = 'sample-image.png',
) {
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByTestId('message-attach-image').click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(path.join(FIXTURES, fixtureFile));
}

export async function attachDocument(
  page: Page,
  fixtureFile = 'sample-document.pdf',
) {
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByTestId('message-attach-document').click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(path.join(FIXTURES, fixtureFile));
}

export async function expectMessageVisible(page: Page, text: string) {
  await expect(page.getByText(text).first()).toBeVisible({ timeout: 10_000 });
}
