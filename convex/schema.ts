import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { authTables } from '@convex-dev/auth/server';
import { aiPurposeValidator as aiPurpose, aiProviderValidator as aiProvider } from './ai/registry';
import { topicValidator as topic } from './lib/topics';
import { alertLevelValidator as alertLevel } from './lib/alerts';

const priority = v.union(
  v.literal('low'),
  v.literal('medium'),
  v.literal('high'),
  v.literal('urgent')
);

const status = v.union(
  v.literal('waiting'),
  v.literal('active'),
  v.literal('escalated'),
  v.literal('closed')
);

const escalationLevel = v.union(
  v.literal('routine'),
  v.literal('urgent'),
  v.literal('same-day'),
  v.literal('emergency')
);

const riskBucket = v.object({
  criteria: v.array(v.string()),
  guidance: v.string(),
});

export default defineSchema({
  ...authTables,

  userProfiles: defineTable({
    userId: v.id('users'),
    role: v.union(
      v.literal('patient'),
      v.literal('professional'),
      v.literal('admin')
    ),
    displayName: v.optional(v.string()),
    ageRange: v.optional(v.string()),
    location: v.optional(v.string()),
    pregnancyStatus: v.optional(v.string()),
    conditions: v.optional(v.array(v.string())),
    medications: v.optional(v.array(v.string())),
    // Professional-only fields (always prefixed with "professional"
    // for clarity; never re-used for other roles).
    professionalLicenseNumber: v.optional(v.string()),
    professionalSpecialty: v.optional(v.string()),
    professionalVerificationStatus: v.optional(
      v.union(
        v.literal('pending'),
        v.literal('verified'),
        v.literal('rejected')
      )
    ),
    professionalVerificationDocuments: v.optional(v.array(v.id('_storage'))),
    professionalVerificationNotes: v.optional(v.string()),
    // Manual review by an admin (users.approveProfessional / rejectProfessional).
    professionalVerificationRequestedAt: v.optional(v.number()),
    professionalVerificationReviewedBy: v.optional(v.id('users')),
    professionalVerificationReviewedAt: v.optional(v.number()),
    professionalVerificationRejectionReason: v.optional(v.string()),
    // Guest sessions (Anonymous provider) — for testing only
    isGuest: v.optional(v.boolean()),
    // Push destinations (max 15, oldest evicted on overflow). Native entries
    // hold an Expo push token; web entries hold the subscription endpoint in
    // `token` plus its encryption keys.
    pushTokens: v.optional(
      v.array(
        v.object({
          token: v.string(),
          platform: v.union(v.literal('ios'), v.literal('android'), v.literal('web')),
          webKeys: v.optional(v.object({ p256dh: v.string(), auth: v.string() })),
          addedAt: v.number(),
        })
      )
    ),
    aiSummary: v.optional(v.string()),
    aiSummaryAt: v.optional(v.number()),
  })
    .index('by_user', ['userId'])
    .index('by_professionalVerificationStatus', ['professionalVerificationStatus']),

  conversations: defineTable({
    patientId: v.id('users'),
    professionalId: v.optional(v.id('users')),
    topic,
    priority,
    status,
    title: v.string(),
    wellbeingGoal: v.optional(v.string()),
    lastMessageAt: v.number(),
    riskLevel: v.optional(v.union(v.literal('low'), v.literal('medium'), v.literal('high'))),
    // Most severe triage alert from the patient's answers (see lib/alerts.ts);
    // orders the professional queue.
    alertLevel: v.optional(alertLevel),
    // Legacy escalation fields kept for old records. New flow uses
    // needsReview + priority bump + closureReason instead.
    escalationLevel: v.optional(escalationLevel),
    escalationNotes: v.optional(v.string()),
    // Legacy "2ª opinião" feature (removed); kept so existing documents validate.
    needsReview: v.optional(v.boolean()),
    reviewQuestion: v.optional(v.string()),
    reviewRequestedBy: v.optional(v.id('users')),
    closureReason: v.optional(
      v.union(
        v.literal('resolved'),
        v.literal('redirected-to-in-person'),
        // Superseded by another conversation (legacy: AI chats used to be
        // converted into the professional conversation).
        v.literal('continued-elsewhere'),
      )
    ),
    aiSummary: v.optional(v.string()),
    aiSummaryAt: v.optional(v.number()),
    // 'ai-only' conversations never enter the professional queue. The patient
    // can request a human handoff which flips this to 'human-async'.
    kind: v.optional(
      v.union(v.literal('human-async'), v.literal('ai-only'))
    ),
    aiHandoffRequestedAt: v.optional(v.number()),
    // Conversation this one was spawned from. Its messages are context for
    // the AI and visible to professionals. Never changes after creation.
    contextConversationId: v.optional(v.id('conversations')),
    // The open conversation of the other kind (ai-only ↔ human-async) the
    // patient toggles to from the chat header. Cleared when either side
    // closes or converts.
    counterpartConversationId: v.optional(v.id('conversations')),
  })
    .index('by_patient', ['patientId'])
    .index('by_professional', ['professionalId'])
    .index('by_status', ['status'])
    .index('by_priority', ['priority'])
    .index('by_review', ['needsReview']),

  messages: defineTable({
    conversationId: v.id('conversations'),
    senderId: v.id('users'),
    content: v.string(),
    messageType: v.union(
      v.literal('text'),
      v.literal('image'),
      v.literal('file'),
      v.literal('system'),
      v.literal('triage-response'),
      v.literal('ai-response')
    ),
    aiInvocationId: v.optional(v.id('aiInvocations')),
    streaming: v.optional(v.boolean()),
    imageId: v.optional(v.id('_storage')),
    attachmentId: v.optional(v.id('_storage')),
    attachmentName: v.optional(v.string()),
    attachmentMimeType: v.optional(v.string()),
    attachmentSize: v.optional(v.number()),
    isInternal: v.optional(v.boolean()),
    metadata: v.optional(
      v.object({
        triageData: v.optional(
          v.object({
            topic: v.string(),
            responses: v.record(v.string(), v.any()),
            riskLevel: v.string(),
            alertLevel: v.optional(alertLevel),
          })
        ),
        // AI answer that suggests ending the conversation (shows a
        // "Terminar conversa" button to the patient).
        suggestClose: v.optional(v.boolean()),
      })
    ),
  }).index('by_conversation', ['conversationId']),

  triageQuestions: defineTable({
    topic,
    questions: v.array(
      v.object({
        id: v.string(),
        question: v.string(),
        type: v.union(
          v.literal('multiple-choice'),
          v.literal('yes-no'),
          v.literal('scale'),
          v.literal('text')
        ),
        options: v.optional(v.array(v.string())),
        // What a risky answer triggers (lib/alerts.ts): the level, plus
        // minScale for scale questions or equals for multiple choice.
        alert: v.optional(
          v.object({
            level: alertLevel,
            minScale: v.optional(v.number()),
            equals: v.optional(v.array(v.string())),
          })
        ),
        // Superseded by `alert`. Kept optional so stored docs stay valid until
        // the admin Seed rewrites them.
        isRedFlag: v.optional(v.boolean()),
        required: v.boolean(),
        // Only asked when another question's answer is one of `equals`.
        showIf: v.optional(v.object({ questionId: v.string(), equals: v.array(v.string()) })),
      })
    ),
    riskAssessment: v.optional(
      v.object({
        lowRisk: riskBucket,
        mediumRisk: riskBucket,
        highRisk: riskBucket,
      })
    ),
  }).index('by_topic', ['topic']),

  educationalContent: defineTable({
    title: v.string(),
    topic,
    content: v.string(),
    summary: v.string(),
    whenToSeekHelp: v.optional(v.string()),
    tags: v.array(v.string()),
    isPublished: v.boolean(),
    readingTimeMinutes: v.number(),
    // Last edit by an admin in Conteúdos (seeded articles have none).
    updatedAt: v.optional(v.number()),
    // Title of the built-in article this one came from, so re-running the
    // seed still finds it after an admin renames it.
    seedKey: v.optional(v.string()),
  })
    .index('by_topic', ['topic'])
    .index('by_published', ['isPublished']),

  wellbeingCheckins: defineTable({
    userId: v.id('users'),
    desire: v.number(), // 1–5
    satisfaction: v.number(), // 1–5
    pain: v.number(), // 0–5 (0 = sem dor)
    distress: v.number(), // 1–5 (mal-estar / sofrimento)
    note: v.optional(v.string()),
  }).index('by_user', ['userId']),

  auditLog: defineTable({
    // Conversation actions set conversationId + professionalId; account
    // reviews (professional-approved/-rejected) set adminId + targetUserId;
    // professional-review-required (a migration, no admin) sets targetUserId;
    // article edits (article-*) set adminId, with the article in details.
    conversationId: v.optional(v.id('conversations')),
    professionalId: v.optional(v.id('users')),
    adminId: v.optional(v.id('users')),
    targetUserId: v.optional(v.id('users')),
    action: v.union(
      v.literal('escalation'),
      v.literal('closure'),
      v.literal('priority-change'),
      v.literal('note-added'),
      v.literal('assigned'),
      v.literal('unassigned'),
      v.literal('review-requested'),
      v.literal('review-cleared'),
      v.literal('redirect-recommended'),
      v.literal('professional-approved'),
      v.literal('professional-rejected'),
      v.literal('professional-review-required'),
      v.literal('article-saved'),
      v.literal('article-published'),
      v.literal('article-unpublished')
    ),
    details: v.string(),
  }).index('by_conversation', ['conversationId']),

  aiConfigs: defineTable({
    purpose: aiPurpose,
    provider: aiProvider,
    modelId: v.string(),
    endpoint: v.optional(v.string()),
    apiKey: v.string(),
    createdBy: v.id('users'),
    notes: v.optional(v.string()),
  }).index('by_purpose', ['purpose']),

  aiPrompts: defineTable({
    purpose: aiPurpose,
    topic: v.optional(topic),
    systemPrompt: v.string(),
    userTemplate: v.optional(v.string()),
    temperature: v.optional(v.number()),
    maxTokens: v.optional(v.number()),
    createdBy: v.id('users'),
    notes: v.optional(v.string()),
  })
    .index('by_purpose', ['purpose'])
    .index('by_purpose_and_topic', ['purpose', 'topic']),

  aiSettings: defineTable({
    dailyCostCapUsd: v.number(),
    createdBy: v.id('users'),
    notes: v.optional(v.string()),
  }),

  aiInvocations: defineTable({
    purpose: aiPurpose,
    configId: v.id('aiConfigs'),
    promptId: v.id('aiPrompts'),
    userId: v.optional(v.id('users')),
    conversationId: v.optional(v.id('conversations')),
    parentInvocationId: v.optional(v.id('aiInvocations')),
    status: v.union(
      v.literal('pending'),
      v.literal('success'),
      v.literal('error'),
      v.literal('blocked')
    ),
    errorMessage: v.optional(v.string()),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    costUsd: v.optional(v.number()),
    latencyMs: v.optional(v.number()),
  })
    .index('by_user', ['userId'])
    .index('by_conversation', ['conversationId'])
    .index('by_parent', ['parentInvocationId'])
    .index('by_purpose', ['purpose']),
});
