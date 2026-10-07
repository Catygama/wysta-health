import { mutation, query, type MutationCtx } from './_generated/server';
import type { Id } from './_generated/dataModel';
import { requireAdmin } from './lib/auth';
import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    return { ...user, profile };
  },
});

export const ensureProfile = mutation({
  args: {
    role: v.optional(
      v.union(
        v.literal('patient'),
        v.literal('professional'),
        v.literal('admin')
      )
    ),
    isGuest: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');
    const existing = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    if (existing) return existing;
    const role = args.role ?? 'patient';
    const id = await ctx.db.insert('userProfiles', {
      userId,
      role,
      isGuest: args.isGuest,
      // TODO: remove auto-verify before launching to real professionals.
      // Guest professionals are auto-verified to keep the testing flow simple;
      // real professional accounts must go through submitProfessionalVerification.
      ...(role === 'professional'
        ? { professionalVerificationStatus: 'verified' as const }
        : {}),
    });
    return ctx.db.get(id);
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');
    return ctx.storage.generateUploadUrl();
  },
});

export const submitProfessionalVerification = mutation({
  args: {
    displayName: v.optional(v.string()),
    professionalLicenseNumber: v.string(),
    professionalSpecialty: v.string(),
    professionalVerificationDocuments: v.array(v.id('_storage')),
    professionalVerificationNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');
    if (!args.professionalLicenseNumber.trim()) {
      throw new Error('Cédula obrigatória.');
    }
    if (!args.professionalSpecialty.trim()) {
      throw new Error('Especialidade obrigatória.');
    }
    if (args.professionalVerificationDocuments.length === 0) {
      throw new Error('Pelo menos um documento é obrigatório.');
    }

    const existing = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();

    // An admin confirms the licence (Ordem dos Enfermeiros) before the account
    // gets professional access: see approveProfessional / rejectProfessional.

    const data = {
      role: 'professional' as const,
      displayName: args.displayName?.trim() || existing?.displayName,
      professionalLicenseNumber: args.professionalLicenseNumber.trim(),
      professionalSpecialty: args.professionalSpecialty.trim(),
      professionalVerificationDocuments: args.professionalVerificationDocuments,
      professionalVerificationNotes:
        args.professionalVerificationNotes?.trim() || undefined,
      professionalVerificationStatus: 'pending' as const,
      professionalVerificationRequestedAt: Date.now(),
      // A resubmission starts a fresh review.
      professionalVerificationReviewedBy: undefined,
      professionalVerificationReviewedAt: undefined,
      professionalVerificationRejectionReason: undefined,
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
      return existing._id;
    }
    return ctx.db.insert('userProfiles', { userId, ...data });
  },
});

export const updateProfile = mutation({
  args: {
    displayName: v.optional(v.string()),
    ageRange: v.optional(v.string()),
    location: v.optional(v.string()),
    pregnancyStatus: v.optional(v.string()),
    conditions: v.optional(v.array(v.string())),
    medications: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    if (!profile) throw new Error('Profile not found');
    await ctx.db.patch(profile._id, args);
  },
});

export const hasAnyAdmin = query({
  args: {},
  handler: async (ctx) => {
    const admin = await ctx.db
      .query('userProfiles')
      .filter((q) => q.eq(q.field('role'), 'admin'))
      .first();
    return admin !== null;
  },
});

export const bootstrapAdmin = mutation({
  args: {},
  handler: async (ctx) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error('Not authenticated');
    const anyAdmin = await ctx.db
      .query('userProfiles')
      .filter((q) => q.eq(q.field('role'), 'admin'))
      .first();
    if (anyAdmin) {
      throw new Error('Já existe um administrador.');
    }
    let profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', callerId))
      .unique();
    if (!profile) {
      const id = await ctx.db.insert('userProfiles', {
        userId: callerId,
        role: 'admin',
      });
      profile = await ctx.db.get(id);
    } else {
      await ctx.db.patch(profile._id, { role: 'admin' });
    }
    return profile;
  },
});

export const setRole = mutation({
  args: {
    targetUserId: v.id('users'),
    role: v.union(
      v.literal('patient'),
      v.literal('professional'),
      v.literal('admin')
    ),
  },
  handler: async (ctx, args) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error('Not authenticated');
    const callerProfile = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', callerId))
      .unique();
    if (callerProfile?.role !== 'admin') throw new Error('Unauthorized');
    const targetProfile = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', args.targetUserId))
      .unique();
    if (!targetProfile) throw new Error('Target user profile not found');
    // Promoting someone to professional is itself an admin decision, so the
    // account is approved at the same time.
    await ctx.db.patch(targetProfile._id, {
      role: args.role,
      ...(args.role === 'professional'
        ? {
            professionalVerificationStatus: 'verified' as const,
            professionalVerificationReviewedBy: callerId,
            professionalVerificationReviewedAt: Date.now(),
          }
        : {}),
    });
  },
});

export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) return [];
    const callerProfile = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', callerId))
      .unique();
    if (callerProfile?.role !== 'admin') return [];
    const profiles = await ctx.db.query('userProfiles').collect();
    return Promise.all(
      profiles.map(async (p) => {
        const user = await ctx.db.get(p.userId);
        return { ...p, user };
      })
    );
  },
});

// ── Professional verification (admin review) ─────────────────────────────

// Pending professional sign-ups, oldest first, with what the admin needs to
// check the licence with the Ordem dos Enfermeiros.
export const listPendingVerifications = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const pending = await ctx.db
      .query('userProfiles')
      .withIndex('by_professionalVerificationStatus', (q) =>
        q.eq('professionalVerificationStatus', 'pending')
      )
      .take(200);
    const rows = await Promise.all(
      pending
        .filter((p) => p.role === 'professional')
        .map(async (p) => {
          const user = await ctx.db.get(p.userId);
          const documents = await Promise.all(
            (p.professionalVerificationDocuments ?? []).map(async (id) => ({
              id,
              url: await ctx.storage.getUrl(id),
            }))
          );
          return {
            userId: p.userId,
            displayName: p.displayName ?? null,
            email: user?.email ?? null,
            licenseNumber: p.professionalLicenseNumber ?? null,
            specialty: p.professionalSpecialty ?? null,
            notes: p.professionalVerificationNotes ?? null,
            requestedAt: p.professionalVerificationRequestedAt ?? p._creationTime,
            documents,
          };
        })
    );
    return rows.sort((a, b) => a.requestedAt - b.requestedAt);
  },
});

async function reviewProfessional(
  ctx: MutationCtx,
  targetUserId: Id<'users'>,
  decision: 'verified' | 'rejected',
  reason?: string
) {
  const { userId: adminId } = await requireAdmin(ctx);
  const profile = await ctx.db
    .query('userProfiles')
    .withIndex('by_user', (q) => q.eq('userId', targetUserId))
    .unique();
  if (!profile || profile.role !== 'professional') {
    throw new Error('Este utilizador não tem um pedido de verificação de profissional.');
  }
  if (profile.professionalVerificationStatus !== 'pending') {
    throw new Error('Este pedido já foi analisado.');
  }
  const trimmed = reason?.trim() || undefined;
  await ctx.db.patch(profile._id, {
    professionalVerificationStatus: decision,
    professionalVerificationReviewedBy: adminId,
    professionalVerificationReviewedAt: Date.now(),
    professionalVerificationRejectionReason: decision === 'rejected' ? trimmed : undefined,
  });
  await ctx.db.insert('auditLog', {
    adminId,
    targetUserId,
    action: decision === 'verified' ? 'professional-approved' : 'professional-rejected',
    details:
      decision === 'verified'
        ? `Cédula ${profile.professionalLicenseNumber ?? '—'} aprovada.`
        : `Pedido recusado${trimmed ? `: ${trimmed}` : '.'}`,
  });
}

export const approveProfessional = mutation({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    await reviewProfessional(ctx, args.userId, 'verified');
    return null;
  },
});

export const rejectProfessional = mutation({
  args: { userId: v.id('users'), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await reviewProfessional(ctx, args.userId, 'rejected', args.reason);
    return null;
  },
});

// Whether the "guest professional" demo sign-in is enabled on this deployment
// (ALLOW_GUEST_PROFESSIONAL, see convex/auth.ts). The app hides the button
// otherwise.
export const guestProfessionalEnabled = query({
  args: {},
  handler: async () => process.env.ALLOW_GUEST_PROFESSIONAL === 'true',
});
