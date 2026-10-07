// Who may act as a health professional: admins, and professionals whose
// account an admin has approved. Pending and rejected professionals are kept
// out of the queue, cases and conversations.
import type { Doc } from '../_generated/dataModel';

type Profile = Pick<Doc<'userProfiles'>, 'role' | 'professionalVerificationStatus'> | null | undefined;

export function isVerifiedProfessional(profile: Profile): boolean {
  // Only an explicit approval counts: a missing status blocks, like pending.
  return profile?.role === 'professional' && profile.professionalVerificationStatus === 'verified';
}

// Professional-side access (queue, cases, patient conversations).
export function hasProfessionalAccess(profile: Profile): boolean {
  return profile?.role === 'admin' || isVerifiedProfessional(profile);
}
