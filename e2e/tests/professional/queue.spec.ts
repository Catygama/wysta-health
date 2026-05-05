import { test, expect } from '@playwright/test';
import { loginAs } from '../../helpers/auth';
import {
  TEST_USERS,
  seedConversation,
  getConversation,
} from '../../helpers/convex';

test.describe('Professional queue', () => {
  test('filters scope/status/priority and assign updates DB', async ({
    page,
  }) => {
    const unassigned = await seedConversation({
      patientEmail: TEST_USERS.patientA.email,
      topic: 'general',
      title: 'Fila — não atribuída',
      priority: 'urgent',
      status: 'waiting',
    });
    await seedConversation({
      patientEmail: TEST_USERS.patientB.email,
      topic: 'sti',
      title: 'Fila — atribuída a outro',
      priority: 'low',
      status: 'active',
      professionalEmail: TEST_USERS.admin.email, // someone else owns it
    });

    await loginAs(page, TEST_USERS.professionalA.email);
    await page.goto('/(professional)/queue');
    await expect(page.getByTestId('queue-stat-mine')).toBeVisible({
      timeout: 15_000,
    });

    // Scope: unassigned shows the urgent waiting row.
    await page.getByTestId('queue-scope-unassigned').click();
    await expect(
      page.getByTestId(`conversation-row-${unassigned.conversationId}`),
    ).toBeVisible({ timeout: 10_000 });

    // Open and assign to self.
    await page
      .getByTestId(`conversation-row-${unassigned.conversationId}`)
      .click();
    await expect(page.getByTestId('conversation-assign-button')).toBeVisible({
      timeout: 10_000,
    });
    await page.getByTestId('conversation-assign-button').click();

    await expect
      .poll(
        async () => {
          const c = await getConversation(unassigned.conversationId);
          return c?.status;
        },
        { timeout: 10_000 },
      )
      .toBe('active');
  });
});
