// Who may act as a health professional: admins, and professionals whose
// account an admin has approved. Pending and rejected professionals are kept
// out of the queue, cases and conversations.
import type { Doc } from '../_generated/dataModel';

type Profile = Pick<Doc<'userProfiles'>, 'role' | 'professionalVerificationStatus'> | null | undefined;

export function isVerifiedProfessional(profile: Profile): boolean {
  if (profile?.role !== 'professional') return false;
  // No status: professionals an admin promoted directly (users.setRole)
  // before manual review existed. Only an explicit pending/rejected blocks.
  const status = profile.professionalVerificationStatus;
  return status !== 'pending' && status !== 'rejected';
}

// Professional-side access (queue, cases, patient conversations).
export function hasProfessionalAccess(profile: Profile): boolean {
  return profile?.role === 'admin' || isVerifiedProfessional(profile);
}
