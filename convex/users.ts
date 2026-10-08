import { internalMutation, mutation, query, type MutationCtx } from './_generated/server';
import { internal } from './_generated/api';
import { paginationOptsValidator } from 'convex/server';
import type { Id } from './_generated/dataModel';
import { requireAdmin } from './lib/auth';
import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';
import { userError, NOT_AUTHENTICATED, ADMIN_ONLY } from './lib/errors';

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

// Creates the caller's profile on first sign-in. Always a patient: the role is
// never taken from the client. Professionals come in through
// submitProfessionalVerification (pending until an admin approves) and admins
// through setRole (admin only) or bootstrapAdmin (only while no admin exists).
export const ensureProfile = mutation({
  args: {
    isGuest: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw userError(NOT_AUTHENTICATED);
    const existing = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    if (existing) return existing;
    const id = await ctx.db.insert('userProfiles', {
      userId,
      role: 'patient',
      isGuest: args.isGuest,
    });
    return ctx.db.get(id);
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw userError(NOT_AUTHENTICATED);
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
    if (!userId) throw userError(NOT_AUTHENTICATED);
    if (!args.professionalLicenseNumber.trim()) {
      throw userError('Cédula obrigatória.');
    }
    if (!args.professionalSpecialty.trim()) {
      throw userError('Especialidade obrigatória.');
    }
    if (args.professionalVerificationDocuments.length === 0) {
      throw userError('Pelo menos um documento é obrigatório.');
    }

    const existing = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();

    // An admin account would lose its role (and possibly the last admin).
    if (existing?.role === 'admin') {
      throw userError('Uma conta de administrador não pode pedir verificação de profissional.');
    }

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
    if (!userId) throw userError(NOT_AUTHENTICATED);
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    if (!profile) throw userError('Não encontrámos o teu perfil.');
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

// First-run only: makes the caller admin while the deployment has no admin at
// all. Once one exists this always fails, and setRole refuses to remove the
// last admin, so it can't be reopened.
export const bootstrapAdmin = mutation({
  args: {},
  handler: async (ctx) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw userError(NOT_AUTHENTICATED);
    const anyAdmin = await ctx.db
      .query('userProfiles')
      .filter((q) => q.eq(q.field('role'), 'admin'))
      .first();
    if (anyAdmin) {
      throw userError('Já existe um administrador.');
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
    if (!callerId) throw userError(NOT_AUTHENTICATED);
    const callerProfile = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', callerId))
      .unique();
    if (callerProfile?.role !== 'admin') throw userError(ADMIN_ONLY);
    // Another admin has to change it: an admin can't demote or lock themselves out.
    if (args.targetUserId === callerId) throw userError('Não podes alterar o teu próprio role.');
    const targetProfile = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', args.targetUserId))
      .unique();
    if (!targetProfile) throw userError('Não encontrámos o perfil deste utilizador.');
    // Never leave the deployment without an admin: that would reopen
    // bootstrapAdmin to any signed-in account.
    if (targetProfile.role === 'admin' && args.role !== 'admin') {
      const otherAdmin = await ctx.db
        .query('userProfiles')
        .filter((q) =>
          q.and(q.eq(q.field('role'), 'admin'), q.neq(q.field('_id'), targetProfile._id))
        )
        .first();
      if (!otherAdmin) throw userError('Não é possível remover o último administrador.');
    }
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
        // Account management only: leave out the patient's clinical fields.
        const {
          conditions: _conditions,
          medications: _medications,
          pregnancyStatus: _pregnancyStatus,
          aiSummary: _aiSummary,
          aiSummaryAt: _aiSummaryAt,
          ...account
        } = p;
        return { ...account, user };
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
    throw userError('Este utilizador não tem um pedido de verificação de profissional.');
  }
  if (profile.professionalVerificationStatus !== 'pending') {
    throw userError('Este pedido já foi analisado.');
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

// One-off migration: every professional account no admin ever reviewed
// (guest demo sign-ins, old ensureProfile auto-verifications, promotions from
// before setRole recorded a reviewer) goes back to pending, so it loses
// access and shows up in the admin's "Pedidos de verificação".
// Idempotent: reviewed, pending and rejected accounts are left alone.
// Run it from the Convex dashboard (Functions → users:requireReviewForUnreviewedProfessionals,
// args {}) or, with the production CONVEX_DEPLOY_KEY set:
// bunx convex run --prod users:requireReviewForUnreviewedProfessionals
export const requireReviewForUnreviewedProfessionals = internalMutation({
  args: { paginationOpts: v.optional(paginationOptsValidator) },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query('userProfiles')
      .paginate(args.paginationOpts ?? { numItems: 200, cursor: null });
    const now = Date.now();
    let changed = 0;
    for (const profile of page.page) {
      if (profile.role !== 'professional') continue;
      if (profile.professionalVerificationReviewedBy) continue;
      const status = profile.professionalVerificationStatus;
      if (status === 'pending' || status === 'rejected') continue;
      await ctx.db.patch(profile._id, {
        professionalVerificationStatus: 'pending',
        professionalVerificationRequestedAt: now,
      });
      await ctx.db.insert('auditLog', {
        targetUserId: profile.userId,
        action: 'professional-review-required',
        details: profile.isGuest
          ? 'Conta de convidado sem revisão: acesso suspenso até aprovação.'
          : 'Conta sem revisão registada: acesso suspenso até aprovação.',
      });
      changed++;
    }
    console.log(`requireReviewForUnreviewedProfessionals: ${changed} account(s) set to pending`);
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.users.requireReviewForUnreviewedProfessionals, {
        paginationOpts: { numItems: 200, cursor: page.continueCursor },
      });
    }
    return { changed, isDone: page.isDone };
  },
});

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
