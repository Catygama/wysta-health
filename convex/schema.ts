import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { authTables } from '@convex-dev/auth/server';
import { aiPurposeValidator as aiPurpose, aiProviderValidator as aiProvider } from './ai/registry';
import { topicValidator as topic } from './lib/topics';

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
    // Guest sessions (Anonymous provider) — for testing only
    isGuest: v.optional(v.boolean()),
    // Expo push tokens for this user (max 15, oldest evicted on overflow).
    pushTokens: v.optional(
      v.array(
        v.object({
          token: v.string(),
          platform: v.union(v.literal('ios'), v.literal('android')),
          addedAt: v.number(),
        })
      )
    ),
    aiSummary: v.optional(v.string()),
    aiSummaryAt: v.optional(v.number()),
  }).index('by_user', ['userId']),

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
    // Legacy escalation fields kept for old records. New flow uses
    // needsReview + priority bump + closureReason instead.
    escalationLevel: v.optional(escalationLevel),
    escalationNotes: v.optional(v.string()),
    needsReview: v.optional(v.boolean()),
    reviewQuestion: v.optional(v.string()),
    reviewRequestedBy: v.optional(v.id('users')),
    closureReason: v.optional(
      v.union(
        v.literal('resolved'),
        v.literal('redirected-to-in-person'),
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
          })
        ),
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
        isRedFlag: v.optional(v.boolean()),
        required: v.boolean(),
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
    conversationId: v.id('conversations'),
    professionalId: v.id('users'),
    action: v.union(
      v.literal('escalation'),
      v.literal('closure'),
      v.literal('priority-change'),
      v.literal('note-added'),
      v.literal('assigned'),
      v.literal('unassigned'),
      v.literal('review-requested'),
      v.literal('review-cleared'),
      v.literal('redirect-recommended')
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
