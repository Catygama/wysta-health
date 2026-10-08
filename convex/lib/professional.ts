// Who may see clinical content (queue, cases, patient conversations, notes and
// summaries): professionals whose account an admin has approved. Pending and
// rejected professionals are kept out, and so are admins: they manage users,
// verification and the AI setup, never clinical content.
import type { Doc } from '../_generated/dataModel';

type Profile = Pick<Doc<'userProfiles'>, 'role' | 'professionalVerificationStatus'> | null | undefined;

export function isVerifiedProfessional(profile: Profile): boolean {
  // Only an explicit approval counts: a missing status blocks, like pending.
  return profile?.role === 'professional' && profile.professionalVerificationStatus === 'verified';
}

// Professional-side (clinical) access. Admins are deliberately excluded.
export function hasProfessionalAccess(profile: Profile): boolean {
  return isVerifiedProfessional(profile);
}
