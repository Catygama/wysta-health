// Account lifecycle shared by the patient's own GDPR erasure (privacy.ts) and
// the admin's block / delete (users.ts).
import { getAuthUserId } from '@convex-dev/auth/server';
import type { ActionCtx, MutationCtx, QueryCtx } from '../_generated/server';
import { internal } from '../_generated/api';
import type { Id } from '../_generated/dataModel';

const MAX_CONVERSATIONS = 500;
const MAX_MESSAGES_PER_CONVERSATION = 2000;

// The signed-in user, or null when signed out or blocked by an admin: a
// blocked account is treated as signed out by every query and mutation.
// (users.currentUser reads the raw session so the app can say it's blocked.)
export async function getActiveUserId(ctx: QueryCtx | MutationCtx): Promise<Id<'users'> | null> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  const profile = await ctx.db
    .query('userProfiles')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .unique();
  return profile?.blockedAt ? null : userId;
}

// Ends every session of the user (all devices): they are signed out at once.
export async function signOutEverywhere(ctx: MutationCtx, userId: Id<'users'>) {
  for (const s of await ctx.db
    .query('authSessions')
    .withIndex('userId', (q) => q.eq('userId', userId))
    .take(500)) {
    for (const t of await ctx.db
      .query('authRefreshTokens')
      .withIndex('sessionId', (q) => q.eq('sessionId', s._id))
      .take(1000)) {
      await ctx.db.delete(t._id);
    }
    await ctx.db.delete(s._id);
  }
}

// A patient's data: conversations, all their messages (internal notes
// included), attached files, wellbeing check-ins and consents. Kept but
// anonymised: the audit log (who did what, when) loses the link to the
// conversation and any free text; AI usage rows keep only cost metrics.
async function erasePatientData(ctx: MutationCtx, userId: Id<'users'>) {
  const conversations = await ctx.db
    .query('conversations')
    .withIndex('by_patient', (q) => q.eq('patientId', userId))
    .take(MAX_CONVERSATIONS);
  for (const c of conversations) {
    const messages = await ctx.db
      .query('messages')
      .withIndex('by_conversation', (q) => q.eq('conversationId', c._id))
      .take(MAX_MESSAGES_PER_CONVERSATION);
    for (const m of messages) {
      for (const fileId of [m.imageId, m.attachmentId]) {
        if (fileId && (await ctx.db.system.get(fileId))) await ctx.storage.delete(fileId);
      }
      await ctx.db.delete(m._id);
    }
    for (const entry of await ctx.db
      .query('auditLog')
      .withIndex('by_conversation', (q) => q.eq('conversationId', c._id))
      .take(1000)) {
      await ctx.db.patch(entry._id, { conversationId: undefined, details: 'Conta da utente apagada.' });
    }
    for (const inv of await ctx.db
      .query('aiInvocations')
      .withIndex('by_conversation', (q) => q.eq('conversationId', c._id))
      .take(5000)) {
      await ctx.db.patch(inv._id, { conversationId: undefined, userId: undefined });
    }
    await ctx.db.delete(c._id);
  }

  for (const inv of await ctx.db
    .query('aiInvocations')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .take(5000)) {
    await ctx.db.patch(inv._id, { userId: undefined });
  }
  for (const c of await ctx.db
    .query('wellbeingCheckins')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .take(1000)) {
    await ctx.db.delete(c._id);
  }
  for (const c of await ctx.db
    .query('privacyConsents')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .take(100)) {
    await ctx.db.delete(c._id);
  }
}

// A professional's open conversations go back to the queue; what they wrote
// stays in the patients' conversations (it is part of the clinical record).
async function releaseProfessionalConversations(ctx: MutationCtx, userId: Id<'users'>) {
  for (const c of await ctx.db
    .query('conversations')
    .withIndex('by_professional', (q) => q.eq('professionalId', userId))
    .take(MAX_CONVERSATIONS)) {
    if (c.status === 'closed') continue;
    await ctx.db.patch(c._id, { professionalId: undefined, status: 'waiting' });
  }
}

// Deletes the account: the person's data for their role, their profile, sign-in
// accounts and sessions, and the user itself.
export async function eraseAccount(ctx: MutationCtx, userId: Id<'users'>) {
  const profile = await ctx.db
    .query('userProfiles')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .unique();

  if (!profile || profile.role === 'patient') await erasePatientData(ctx, userId);
  if (profile?.role === 'professional') {
    await releaseProfessionalConversations(ctx, userId);
    for (const fileId of profile.professionalVerificationDocuments ?? []) {
      if (await ctx.db.system.get(fileId)) await ctx.storage.delete(fileId);
    }
  }
  if (profile) await ctx.db.delete(profile._id);

  await signOutEverywhere(ctx, userId);
  for (const a of await ctx.db
    .query('authAccounts')
    .withIndex('userIdAndProvider', (q) => q.eq('userId', userId))
    .take(50)) {
    for (const code of await ctx.db
      .query('authVerificationCodes')
      .withIndex('accountId', (q) => q.eq('accountId', a._id))
      .take(50)) {
      await ctx.db.delete(code._id);
    }
    await ctx.db.delete(a._id);
  }
  await ctx.db.delete(userId);
}

// getActiveUserId for actions, which can't read the database directly.
export async function getActiveUserIdInAction(ctx: ActionCtx): Promise<Id<'users'> | null> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  return (await ctx.runQuery(internal.users.isActive, { userId })) ? userId : null;
}
