import { query, mutation } from './_generated/server';
import { v } from 'convex/values';
import { topicValidator as topic } from './lib/topics';
import { alertLevelValidator } from './lib/alerts';
import { requireAdmin } from './lib/auth';
import { userError } from './lib/errors';

export const getByTopic = query({
  args: { topic },
  handler: async (ctx, args) => {
    return ctx.db
      .query('triageQuestions')
      .withIndex('by_topic', (q) => q.eq('topic', args.topic))
      .unique();
  },
});

// One triage question as the admin editor sends it (same shape as stored).
export const questionValidator = v.object({
  id: v.string(),
  question: v.string(),
  type: v.union(v.literal('multiple-choice'), v.literal('yes-no'), v.literal('scale'), v.literal('text')),
  options: v.optional(v.array(v.string())),
  alert: v.optional(
    v.object({
      level: alertLevelValidator,
      minScale: v.optional(v.number()),
      equals: v.optional(v.array(v.string())),
    })
  ),
  required: v.boolean(),
  showIf: v.optional(v.object({ questionId: v.string(), equals: v.array(v.string()) })),
});

type Question = typeof questionValidator.type;

// The answers a question can take, as stored in the responses ('yes'/'no' for
// yes/no). Null for free text.
function answersOf(q: Question): string[] | null {
  if (q.type === 'yes-no') return ['yes', 'no'];
  if (q.type === 'text') return null;
  return q.options ?? [];
}

// Checks the editor's questions before saving; throws a message the admin can act on.
export function validateQuestions(questions: Question[]): Question[] {
  if (questions.length === 0) throw userError('A triagem precisa de pelo menos uma pergunta.');
  const seen = new Map<string, Question>();
  return questions.map((raw, i) => {
    const n = i + 1;
    const q: Question = {
      ...raw,
      question: raw.question.trim(),
      options: raw.options?.map((o) => o.trim()).filter(Boolean),
    };
    if (!q.id.trim()) throw userError(`Pergunta ${n}: falta o identificador.`);
    if (seen.has(q.id)) throw userError(`Pergunta ${n}: identificador repetido.`);
    if (!q.question) throw userError(`Pergunta ${n}: escreve o texto da pergunta.`);

    if (q.type === 'yes-no' || q.type === 'text') q.options = undefined;
    if (q.type === 'multiple-choice') {
      if (!q.options || q.options.length < 2) throw userError(`Pergunta ${n}: precisa de pelo menos duas opções.`);
      if (new Set(q.options).size !== q.options.length) throw userError(`Pergunta ${n}: há opções repetidas.`);
    }
    if (q.type === 'scale') {
      const nums = (q.options ?? []).map(Number);
      if (nums.length < 2 || nums.some((x) => !Number.isInteger(x))) {
        throw userError(`Pergunta ${n}: a escala precisa de um mínimo e um máximo.`);
      }
    }

    if (q.alert) {
      if (q.type === 'text') throw userError(`Pergunta ${n}: uma resposta de texto livre não pode dar alerta.`);
      if (q.type === 'yes-no') q.alert = { level: q.alert.level };
      if (q.type === 'scale') {
        const nums = (q.options ?? []).map(Number);
        const min = q.alert.minScale;
        if (min === undefined || min < Math.min(...nums) || min > Math.max(...nums)) {
          throw userError(`Pergunta ${n}: indica a partir de que valor da escala há alerta.`);
        }
        q.alert = { level: q.alert.level, minScale: min };
      }
      if (q.type === 'multiple-choice') {
        const equals = (q.alert.equals ?? []).filter((e) => q.options!.includes(e));
        if (equals.length === 0) throw userError(`Pergunta ${n}: escolhe que resposta dá alerta.`);
        q.alert = { level: q.alert.level, equals };
      }
    }

    if (q.showIf) {
      const parent = seen.get(q.showIf.questionId);
      if (!parent) throw userError(`Pergunta ${n}: só pode depender de uma pergunta anterior.`);
      const allowed = answersOf(parent);
      const equals = q.showIf.equals.filter((e) => !allowed || allowed.includes(e));
      if (equals.length === 0) throw userError(`Pergunta ${n}: escolhe a resposta que a faz aparecer.`);
      q.showIf = { questionId: parent.id, equals };
    }

    seen.set(q.id, q);
    return q;
  });
}

// Admin "Conteúdos → Triagem": the questions of one topic.
export const adminGet = query({
  args: { topic },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const doc = await ctx.db
      .query('triageQuestions')
      .withIndex('by_topic', (q) => q.eq('topic', args.topic))
      .unique();
    return doc ? { questions: doc.questions, updatedAt: doc.updatedAt ?? null } : null;
  },
});

// Replaces a topic's questions. Only new triages use them: conversations keep
// the answers they were created with.
export const saveQuestions = mutation({
  args: { topic, questions: v.array(questionValidator) },
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);
    const questions = validateQuestions(args.questions);
    const existing = await ctx.db
      .query('triageQuestions')
      .withIndex('by_topic', (q) => q.eq('topic', args.topic))
      .unique();
    const updatedAt = Date.now();
    if (existing) await ctx.db.patch(existing._id, { questions, updatedAt });
    else await ctx.db.insert('triageQuestions', { topic: args.topic, questions, updatedAt });
    await ctx.db.insert('auditLog', {
      adminId: userId,
      action: 'triage-updated',
      details: `Triagem "${args.topic}": ${questions.length} perguntas.`,
    });
    return null;
  },
});
