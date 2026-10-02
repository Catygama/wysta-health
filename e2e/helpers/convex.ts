import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../convex/_generated/api';

const CONVEX_URL =
  process.env.EXPO_PUBLIC_CONVEX_URL ??
  'http://127.0.0.1:3210';

export const convexClient = new ConvexHttpClient(CONVEX_URL);

export const TEST_USERS = {
  patientA: { email: 'patient-a@e2e.local', password: 'e2e-test-pw' },
  patientB: { email: 'patient-b@e2e.local', password: 'e2e-test-pw' },
  professionalA: { email: 'prof-a@e2e.local', password: 'e2e-test-pw' },
  admin: { email: 'admin@e2e.local', password: 'e2e-test-pw' },
} as const;

export type TestUserKey = keyof typeof TEST_USERS;

export async function resetBackend() {
  return convexClient.mutation(api.testing.resetAll, {});
}

export async function seedDomainContent() {
  return convexClient.mutation(api.testing.seedDomainContent, {});
}

export async function seedUser(args: {
  email: string;
  password: string;
  role: 'patient' | 'professional' | 'admin';
  profile?: {
    displayName?: string;
    ageRange?: string;
    pregnancyStatus?: string;
    location?: string;
    professionalLicenseNumber?: string;
    professionalSpecialty?: string;
    professionalVerificationStatus?: 'pending' | 'verified' | 'rejected';
  };
}) {
  return convexClient.action(api.testing.seedUser, args);
}

export async function setUserProfile(args: {
  email: string;
  role: 'patient' | 'professional' | 'admin';
  profile?: Parameters<typeof seedUser>[0]['profile'];
}) {
  return convexClient.mutation(api.testing.setUserProfile, args);
}

export async function seedConversation(args: {
  patientEmail: string;
  professionalEmail?: string;
  topic: 'contraception' | 'pregnancy' | 'sti' | 'menstrual-cycle' | 'general';
  title?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  status?: 'waiting' | 'active' | 'escalated' | 'closed';
  riskLevel?: 'low' | 'medium' | 'high';
  initialMessage?: string;
}) {
  return convexClient.mutation(api.testing.seedConversation, args);
}

export async function listConversationsForPatient(email: string) {
  return convexClient.query(api.testing.listConversationsForPatient, {
    email,
  });
}

export async function getConversation(id: string) {
  return convexClient.query(api.testing.getConversation, { id: id as any });
}

export async function listMessages(conversationId: string) {
  return convexClient.query(api.testing.listMessages, {
    conversationId: conversationId as any,
  });
}
