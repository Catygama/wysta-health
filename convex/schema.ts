import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { authTables } from '@convex-dev/auth/server';

const topic = v.union(
  v.literal('contraception'),
  v.literal('pregnancy'),
  v.literal('sti'),
  v.literal('menstrual-cycle'),
  v.literal('general')
);

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

const aiPurpose = v.union(
  v.literal('chat-summary'),
  v.literal('user-summary'),
  v.literal('chat'),
  v.literal('chat-validator-safety'),
  v.literal('chat-validator-clinical'),
  v.literal('chat-judge')
);

const aiProvider = v.union(
  v.literal('openai'),
  v.literal('anthropic'),
  v.literal('mistral'),
  v.literal('google'),
  v.literal('azure-openai'),
  v.literal('custom')
);

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
  }).index('by_user', ['userId']),

  conversations: defineTable({
    patientId: v.id('users'),
    professionalId: v.optional(v.id('users')),
    topic,
    priority,
    status,
    title: v.string(),
    lastMessageAt: v.number(),
    riskLevel: v.optional(v.union(v.literal('low'), v.literal('medium'), v.literal('high'))),
    escalationLevel: v.optional(escalationLevel),
    escalationNotes: v.optional(v.string()),
    aiSummary: v.optional(v.string()),
    aiSummaryAt: v.optional(v.number()),
  })
    .index('by_patient', ['patientId'])
    .index('by_professional', ['professionalId'])
    .index('by_status', ['status'])
    .index('by_priority', ['priority']),

  messages: defineTable({
    conversationId: v.id('conversations'),
    senderId: v.id('users'),
    content: v.string(),
    messageType: v.union(
      v.literal('text'),
      v.literal('image'),
      v.literal('file'),
      v.literal('system'),
      v.literal('triage-response')
    ),
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

  auditLog: defineTable({
    conversationId: v.id('conversations'),
    professionalId: v.id('users'),
    action: v.union(
      v.literal('escalation'),
      v.literal('closure'),
      v.literal('priority-change'),
      v.literal('note-added'),
      v.literal('assigned'),
      v.literal('unassigned')
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
    systemPrompt: v.string(),
    userTemplate: v.optional(v.string()),
    temperature: v.optional(v.number()),
    maxTokens: v.optional(v.number()),
    createdBy: v.id('users'),
    notes: v.optional(v.string()),
  }).index('by_purpose', ['purpose']),

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
