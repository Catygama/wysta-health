import { test, expect } from '@playwright/test';
import { loginAs, logoutViaBridge } from '../../helpers/auth';
import { TEST_USERS, seedUser } from '../../helpers/convex';

// A professional signs up pending; the admin checks the licence and approves
// it in the admin panel; the professional then reaches the queue. The approve
// and reject paths are also covered in convex/professionalVerification.test.ts.
const PENDING = { email: 'prof-pending@e2e.local', password: 'e2e-test-pw' };

test('pending professional waits for admin approval, then reaches the queue', async ({ page }) => {
  await seedUser({
    ...PENDING,
    role: 'professional',
    profile: {
      displayName: 'Enf. Pendente',
      professionalLicenseNumber: '54321',
      professionalSpecialty: 'Enfermagem',
      professionalVerificationStatus: 'pending',
    },
  });

  await loginAs(page, PENDING.email, PENDING.password);
  await page.goto('/queue');
  await expect(page.getByTestId('verification-pending')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('queue-sort')).toHaveCount(0);
  await logoutViaBridge(page);

  await loginAs(page, TEST_USERS.admin.email);
  await page.goto('/verifications');
  const request = page.getByTestId(`verification-request-${PENDING.email}`);
  await expect(request).toBeVisible({ timeout: 15_000 });
  await expect(request).toContainText('54321');
  await request.getByTestId('verification-approve').click();
  await page.getByTestId('verification-dialog-confirm').click();
  await expect(request).toHaveCount(0, { timeout: 10_000 });
  await logoutViaBridge(page);

  await loginAs(page, PENDING.email, PENDING.password);
  await page.goto('/queue');
  await expect(page.getByTestId('queue-sort')).toBeVisible({ timeout: 15_000 });
});
