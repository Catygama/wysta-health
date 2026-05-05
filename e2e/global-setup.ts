import {
  resetBackend,
  seedDomainContent,
  seedUser,
  TEST_USERS,
} from './helpers/convex';

export default async function globalSetup() {
  console.log('[e2e] resetting Convex backend...');
  try {
    await resetBackend();
  } catch (e: any) {
    throw new Error(
      `Convex reset failed (is local Convex running and CONVEX_E2E_ENABLED=true?): ${e?.message ?? e}`,
    );
  }
  console.log('[e2e] seeding triage + articles...');
  await seedDomainContent();
  console.log('[e2e] seeding users...');
  await seedUser({
    email: TEST_USERS.patientA.email,
    password: TEST_USERS.patientA.password,
    role: 'patient',
    profile: {
      displayName: 'Maria Patient',
      ageRange: '26-35',
      pregnancyStatus: 'not-pregnant',
    },
  });
  await seedUser({
    email: TEST_USERS.patientB.email,
    password: TEST_USERS.patientB.password,
    role: 'patient',
    profile: { displayName: 'Joana Patient', ageRange: '18-25' },
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
  console.log('[e2e] seed complete.');
}
