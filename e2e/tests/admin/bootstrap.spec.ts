import { test, expect } from '@playwright/test';
import { loginAs } from '../../helpers/auth';
import {
  resetBackend,
  seedDomainContent,
  seedUser,
  TEST_USERS,
} from '../../helpers/convex';

// Tests bootstrap admin promotion by resetting state to "no admin yet". After
// the test we restore the canonical seeded users so downstream specs keep
// working. Single worker keeps ordering deterministic.
test.describe.serial('Admin bootstrap', () => {
  test.beforeAll(async () => {
    await resetBackend();
    await seedDomainContent();
    await seedUser({
      email: TEST_USERS.patientA.email,
      password: TEST_USERS.patientA.password,
      role: 'patient',
      profile: { displayName: 'Maria Patient' },
    });
  });

  test.afterAll(async () => {
    await resetBackend();
    await seedDomainContent();
    await seedUser({
      email: TEST_USERS.patientA.email,
      password: TEST_USERS.patientA.password,
      role: 'patient',
      profile: { displayName: 'Maria Patient' },
    });
    await seedUser({
      email: TEST_USERS.patientB.email,
      password: TEST_USERS.patientB.password,
      role: 'patient',
      profile: { displayName: 'Joana Patient' },
    });
    await seedUser({
      email: TEST_USERS.professionalA.email,
      password: TEST_USERS.professionalA.password,
      role: 'professional',
      profile: {
        displayName: 'Dra. Ana',
        professionalLicenseNumber: '12345',
        professionalSpecialty: 'Ginecologia / Obstetrícia',
        professionalVerificationStatus: 'verified',
      },
    });
    await seedUser({
      email: TEST_USERS.admin.email,
      password: TEST_USERS.admin.password,
      role: 'admin',
      profile: { displayName: 'Admin Wysta' },
    });
  });

  test('Patient sees bootstrap card and self-promotes', async ({ page }) => {
    await loginAs(page, TEST_USERS.patientA.email);
    await page.goto('/(patient)/profile');
    await expect(
      page.getByTestId('profile-bootstrap-admin-button'),
    ).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('profile-bootstrap-admin-button').click();
    // After promotion the patient layout sees role=admin and redirects to
    // /(admin)/. Route groups don't appear in the URL — assert on the admin
    // search input, which only exists on that screen.
    await expect(page.getByTestId('admin-search-input')).toBeVisible({
      timeout: 20_000,
    });
  });
});
