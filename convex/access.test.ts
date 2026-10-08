/// <reference types="vite/client" />
import { describe, it, expect, vi, afterEach } from 'vitest';
import { convexTest } from 'convex-test';
import schema from './schema';
import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import {
  ATTACHMENT_SIZE_ERROR,
  ATTACHMENT_TYPE_ERROR,
  MAX_ATTACHMENT_BYTES,
  storedAttachmentError,
} from './lib/attachments';

const modules = import.meta.glob('./**/*.ts');

afterEach(() => {
  vi.useRealTimers();
});

// A patient, the professional assigned to her conversation, another approved
// professional, a stranger (another patient) and an admin.
async function setup() {
  vi.useFakeTimers();
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const mk = async (profile: Record<string, unknown>) => {
      const id = (await ctx.db.insert('users', {} as any)) as Id<'users'>;
      await ctx.db.insert('userProfiles', { userId: id, ...(profile as any) });
      return id;
    };
    const patientId = await mk({ role: 'patient', conditions: ['Asma'], medications: ['Salbutamol'] });
    const nurseId = await mk({ role: 'professional', professionalVerificationStatus: 'verified', displayName: 'Enf.ª Ana' });
    const otherNurseId = await mk({ role: 'professional', professionalVerificationStatus: 'verified' });
    const strangerId = await mk({ role: 'patient' });
    const adminId = await mk({ role: 'admin' });
    const convId = await ctx.db.insert('conversations', {
      patientId,
      professionalId: nurseId,
      topic: 'contraception',
      title: 'Contraceção',
      priority: 'low',
      status: 'active',
      lastMessageAt: 0,
      kind: 'human-async',
      aiSummary: 'Resumo clínico',
    });
    await ctx.db.insert('messages', { conversationId: convId, senderId: patientId, content: 'Olá', messageType: 'text' });
    await ctx.db.insert('messages', {
      conversationId: convId, senderId: nurseId, content: 'Nota', messageType: 'text', isInternal: true,
    });
    return { patientId, nurseId, otherNurseId, strangerId, adminId, convId };
  });
  const as = (id: Id<'users'>) => t.withIdentity({ subject: `${id}|s` });
  return {
    t, ...ids,
    patient: as(ids.patientId), nurse: as(ids.nurseId), otherNurse: as(ids.otherNurseId),
    stranger: as(ids.strangerId), admin: as(ids.adminId),
  };
}

const send = (who: any, conversationId: Id<'conversations'>, extra: Record<string, unknown> = {}) =>
  who.mutation(api.messages.send, { conversationId, content: 'mensagem', ...extra });

describe('A1: messages.send only for the conversation members', () => {
  it('the patient and the assigned professional can write', async () => {
    const { patient, nurse, convId } = await setup();
    await send(patient, convId);
    await send(nurse, convId);
    await send(nurse, convId, { isInternal: true });
  });

  it('a stranger, another professional or an admin cannot write', async () => {
    const { stranger, otherNurse, admin, convId } = await setup();
    for (const who of [stranger, otherNurse, admin]) {
      await expect(send(who, convId)).rejects.toThrow('Não tens acesso a esta conversa.');
    }
  });

  it('only the assigned professional writes internal notes', async () => {
    const { patient, convId, t } = await setup();
    await expect(send(patient, convId, { isInternal: true })).rejects.toThrow('notas internas');
    const notes = await t.run((ctx) => ctx.db.query('messages').collect());
    expect(notes.filter((m) => m.isInternal)).toHaveLength(1);
  });

  it('nobody writes in a closed conversation', async () => {
    const { t, patient, nurse, convId } = await setup();
    await t.run((ctx) => ctx.db.patch(convId, { status: 'closed' }));
    for (const who of [patient, nurse]) {
      await expect(send(who, convId)).rejects.toThrow('encerrada');
    }
  });

  it('the client cannot forge system or triage lines', async () => {
    const { patient, convId } = await setup();
    for (const messageType of ['system', 'triage-response']) {
      await expect(send(patient, convId, { messageType })).rejects.toThrow('Tipo de mensagem inválido.');
    }
  });
});

describe('B1: an AI answer being prepared is never returned', () => {
  it('messages.list hides the content of a streaming answer', async () => {
    const { t, patient, patientId, convId } = await setup();
    await t.run((ctx) =>
      ctx.db.insert('messages', {
        conversationId: convId, senderId: patientId, content: 'rascunho', messageType: 'ai-response', streaming: true,
      }),
    );
    const msgs = await patient.query(api.messages.list, { conversationId: convId });
    const ai = msgs.find((m: any) => m.messageType === 'ai-response');
    expect(ai).toMatchObject({ content: '', streaming: true });
  });
});

describe('A2: admins have no access to clinical content', () => {
  it('cannot read the queue, cases, messages or summaries', async () => {
    const { t, admin, adminId, patientId, convId } = await setup();
    expect(await admin.query(api.conversations.listForProfessional, {})).toEqual([]);
    expect(await admin.query(api.conversations.get, { id: convId })).toBeNull();
    expect(await admin.query(api.messages.list, { conversationId: convId })).toEqual([]);
    const chat = await t.query(internal.ai.chatSummary.assertAccess, { conversationId: convId, userId: adminId });
    expect(chat.allowed).toBe(false);
    const profile = await t.query(internal.ai.userSummary.assertAccess, { callerId: adminId, patientId });
    expect(profile.allowed).toBe(false);
  });

  it('still manages users, without the clinical fields', async () => {
    const { admin, patientId } = await setup();
    const users = await admin.query(api.users.listUsers, {});
    const patient = users.find((u: any) => u.userId === patientId) as any;
    expect(patient.role).toBe('patient');
    expect(patient.conditions).toBeUndefined();
    expect(patient.medications).toBeUndefined();
  });

  it('the approved professional still sees the case and the internal notes', async () => {
    const { nurse, convId } = await setup();
    const msgs = await nurse.query(api.messages.list, { conversationId: convId });
    expect(msgs.some((m: any) => m.isInternal)).toBe(true);
  });
});

describe('A3: attachments are checked on the server', () => {
  // convex-test doesn't record a stored file's content type, so the type rules
  // are tested on storedAttachmentError; the send path is tested for size and
  // for files with no (or an unknown) type.
  const store = (t: any, bytes: number) =>
    t.run((ctx: any) => ctx.storage.store(new Blob([new Uint8Array(bytes)])));

  it('type and size rules', () => {
    expect(storedAttachmentError({ size: 2048, contentType: 'image/jpeg' }, 'image')).toBeNull();
    expect(storedAttachmentError({ size: 2048, contentType: 'application/pdf' }, 'document')).toBeNull();
    expect(storedAttachmentError({ size: 2048, contentType: 'image/png' }, 'document')).toBeNull();
    expect(storedAttachmentError({ size: 2048, contentType: 'application/pdf' }, 'image')).toBe(ATTACHMENT_TYPE_ERROR);
    expect(storedAttachmentError({ size: 2048, contentType: 'application/x-msdownload' }, 'document')).toBe(ATTACHMENT_TYPE_ERROR);
    expect(storedAttachmentError({ size: 2048 }, 'document')).toBe(ATTACHMENT_TYPE_ERROR);
    expect(storedAttachmentError({ size: MAX_ATTACHMENT_BYTES + 1, contentType: 'image/png' }, 'image')).toBe(ATTACHMENT_SIZE_ERROR);
  });

  it('send rejects a file over 10 MB and one with no known type', async () => {
    const { t, patient, convId } = await setup();
    const big = await store(t, MAX_ATTACHMENT_BYTES + 1);
    await expect(send(patient, convId, { messageType: 'image', imageId: big })).rejects.toThrow('10 MB');
    const untyped = await store(t, 100);
    await expect(
      send(patient, convId, { messageType: 'file', attachmentId: untyped, attachmentMimeType: 'application/pdf' }),
    ).rejects.toThrow('PDF');
    const files = await t.run((ctx) => ctx.db.query('messages').collect());
    expect(files.some((m) => m.imageId || m.attachmentId)).toBe(false);
  });
});
