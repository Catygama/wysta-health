import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  // User profiles with health information
  userProfiles: defineTable({
    userId: v.id("users"),
    ageRange: v.optional(v.string()), // "18-25", "26-35", etc.
    location: v.optional(v.string()),
    pregnancyStatus: v.optional(v.string()), // "pregnant", "not-pregnant", "trying", "prefer-not-to-say"
    conditions: v.optional(v.array(v.string())),
    medications: v.optional(v.array(v.string())),
    isNurse: v.optional(v.boolean()),
  }).index("by_user", ["userId"]),

  // Conversations between patients and nurses
  conversations: defineTable({
    patientId: v.id("users"),
    nurseId: v.optional(v.id("users")),
    category: v.string(), // "period-pain", "contraception", "uti", "pregnancy", "menopause", etc.
    priority: v.string(), // "low", "medium", "high", "urgent"
    status: v.string(), // "waiting", "active", "escalated", "closed"
    title: v.string(),
    lastMessageAt: v.number(),
    escalationLevel: v.optional(v.string()), // "gp-routine", "gp-urgent", "emergency"
    escalationNotes: v.optional(v.string()),
  })
    .index("by_patient", ["patientId"])
    .index("by_nurse", ["nurseId"])
    .index("by_status", ["status"])
    .index("by_priority", ["priority"]),

  // Messages within conversations
  messages: defineTable({
    conversationId: v.id("conversations"),
    senderId: v.id("users"),
    content: v.string(),
    messageType: v.string(), // "text", "image", "system", "triage-response"
    imageId: v.optional(v.id("_storage")),
    isInternal: v.optional(v.boolean()), // for nurse-only notes
    metadata: v.optional(v.object({
      triageData: v.optional(v.object({
        category: v.string(),
        responses: v.record(v.string(), v.any()),
        riskLevel: v.string(),
      })),
    })),
  }).index("by_conversation", ["conversationId"]),

  // Voice call appointments
  appointments: defineTable({
    conversationId: v.id("conversations"),
    patientId: v.id("users"),
    nurseId: v.optional(v.id("users")),
    scheduledTime: v.number(),
    duration: v.number(), // in minutes
    status: v.string(), // "scheduled", "completed", "cancelled", "no-show"
    callNotes: v.optional(v.string()),
  })
    .index("by_patient", ["patientId"])
    .index("by_nurse", ["nurseId"])
    .index("by_scheduled_time", ["scheduledTime"]),

  // Triage questionnaires
  triageQuestions: defineTable({
    category: v.string(),
    questions: v.array(v.object({
      id: v.string(),
      question: v.string(),
      type: v.string(), // "multiple-choice", "yes-no", "scale", "text"
      options: v.optional(v.array(v.string())),
      isRedFlag: v.optional(v.boolean()),
      required: v.boolean(),
    })),
    riskAssessment: v.object({
      lowRisk: v.object({
        criteria: v.array(v.string()),
        guidance: v.string(),
      }),
      mediumRisk: v.object({
        criteria: v.array(v.string()),
        guidance: v.string(),
      }),
      highRisk: v.object({
        criteria: v.array(v.string()),
        guidance: v.string(),
      }),
    }),
  }).index("by_category", ["category"]),

  // Educational content
  educationalContent: defineTable({
    title: v.string(),
    category: v.string(),
    content: v.string(),
    whenToSeekHelp: v.string(),
    tags: v.array(v.string()),
    isPublished: v.boolean(),
    readingTime: v.number(), // in minutes
  })
    .index("by_category", ["category"])
    .index("by_published", ["isPublished"]),

  // Audit trail for clinical decisions
  auditLog: defineTable({
    conversationId: v.id("conversations"),
    nurseId: v.id("users"),
    action: v.string(), // "escalation", "closure", "priority-change", "note-added"
    details: v.string(),
    timestamp: v.number(),
  }).index("by_conversation", ["conversationId"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
