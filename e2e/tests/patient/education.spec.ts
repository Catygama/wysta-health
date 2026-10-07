import { test, expect } from '@playwright/test';
import { loginAs } from '../../helpers/auth';
import { TEST_USERS } from '../../helpers/convex';

test.describe('Education browsing', () => {
  test('filters by topic and opens an article', async ({
    page,
  }) => {
    await loginAs(page, TEST_USERS.patientA.email);
    await page.goto('/(patient)/education');
    await expect(page.getByTestId('edu-topic')).toBeVisible({
      timeout: 15_000,
    });

    // Filter by contraception chip — only contraception articles remain.
    await page.getByTestId('edu-topic').click();
    await page.getByTestId('edu-topic-contraception').click();
    const article = page
      .getByText('Métodos contracetivos: guia completo')
      .first();
    await expect(article).toBeVisible({ timeout: 10_000 });
    await article.click();

    await expect(page.getByText('Quando procurar ajuda')).toBeVisible({
      timeout: 10_000,
    });
  });

  test('search narrows results', async ({ page }) => {
    await loginAs(page, TEST_USERS.patientA.email);
    await page.goto('/(patient)/education');
    await page.getByTestId('edu-search').fill('gravidez');
    await expect(page.getByText('Sinais de alerta na gravidez').first()).toBeVisible();
  });
});
