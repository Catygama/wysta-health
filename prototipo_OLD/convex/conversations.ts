import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

export const createConversation = mutation({
  args: {
    category: v.string(),
    title: v.string(),
    triageData: v.optional(v.object({
      responses: v.record(v.string(), v.any()),
      riskLevel: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Determine priority based on triage data
    let priority = "low";
    if (args.triageData?.riskLevel === "high") {
      priority = "urgent";
    } else if (args.triageData?.riskLevel === "medium") {
      priority = "medium";
    }

    const conversationId = await ctx.db.insert("conversations", {
      patientId: userId,
      category: args.category,
      priority,
      status: "waiting",
      title: args.title,
      lastMessageAt: Date.now(),
    });

    // Add initial triage message if provided
		if (args.triageData) {
			await ctx.db.insert("messages", {
				conversationId,
				senderId: userId,
				content: "Questionário de triagem concluído",
				messageType: "triage-response",
				metadata: {
					triageData: {
						category: args.category,
						responses: args.triageData.responses,
						riskLevel: args.triageData.riskLevel,
					},
				},
			});
		}

    return conversationId;
  },
});

export const getPatientConversations = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("conversations")
      .withIndex("by_patient", (q) => q.eq("patientId", userId))
      .order("desc")
      .collect();
  },
});

export const getNurseQueue = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    // Check if user is a nurse
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!profile?.isNurse) return [];

    // Get conversations assigned to this nurse or unassigned
    const conversations = await ctx.db
      .query("conversations")
      .filter((q) =>
        q.or(
          q.eq(q.field("nurseId"), userId),
          q.eq(q.field("status"), "waiting")
        )
      )
      .order("desc")
      .collect();

    // Sort by priority and last message time
    return conversations.sort((a, b) => {
      const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
      const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] || 1;
      const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] || 1;

      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }
      return b.lastMessageAt - a.lastMessageAt;
    });
  },
});

export const getConversationById = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) return null;
    // Check access: patient, nurse, or assigned nurse
    if (
      conversation.patientId === userId ||
      conversation.nurseId === userId
    ) {
      return conversation;
    }
    // If user is a nurse (from profile), allow access
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (profile?.isNurse) return conversation;
    return null;
  },
});

export const assignConversation = mutation({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!profile?.isNurse) throw new Error("Only nurses can assign conversations");

    await ctx.db.patch(args.conversationId, {
      nurseId: userId,
      status: "active",
    });
  },
});

export const escalateConversation = mutation({
  args: {
    conversationId: v.id("conversations"),
    escalationLevel: v.string(),
    notes: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await ctx.db.patch(args.conversationId, {
      status: "escalated",
      escalationLevel: args.escalationLevel,
      escalationNotes: args.notes,
    });

    // Log the escalation
    await ctx.db.insert("auditLog", {
      conversationId: args.conversationId,
      nurseId: userId,
      action: "escalation",
      details: `Escalated to ${args.escalationLevel}: ${args.notes}`,
      timestamp: Date.now(),
    });
  },
});
