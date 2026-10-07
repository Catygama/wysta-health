import { mutation, query } from './_generated/server';
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

// Self-service profiles are always patients. Professionals go through
// submitProfessionalVerification and admins are promoted via setRole.
export const ensureProfile = mutation({
  args: {
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

    // TODO: remove auto-verify — change to 'pending' once admin review UI
    // is in place so accounts must be manually approved before granting
    // professional access.
    const professionalVerificationStatus = 'verified' as const;

    const data = {
      role: 'professional' as const,
      displayName: args.displayName?.trim() || existing?.displayName,
      professionalLicenseNumber: args.professionalLicenseNumber.trim(),
      professionalSpecialty: args.professionalSpecialty.trim(),
      professionalVerificationDocuments: args.professionalVerificationDocuments,
      professionalVerificationNotes:
        args.professionalVerificationNotes?.trim() || undefined,
      professionalVerificationStatus,
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
    await ctx.db.patch(targetProfile._id, { role: args.role });
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
