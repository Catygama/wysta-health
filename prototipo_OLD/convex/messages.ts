import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

export const getMessages = query({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    // Verify user has access to this conversation
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) return [];

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    const isNurse = profile?.isNurse;
    const hasAccess = conversation.patientId === userId || 
                     conversation.nurseId === userId || 
                     isNurse;

    if (!hasAccess) return [];

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .collect();

    // Filter out internal notes for patients
    const filteredMessages = !isNurse 
      ? messages.filter(msg => !msg.isInternal)
      : messages;

    // Add image URLs for messages with images
    return Promise.all(
      filteredMessages.map(async (message) => ({
        ...message,
        imageUrl: message.imageId ? await ctx.storage.getUrl(message.imageId) : null,
      }))
    );
  },
});

export const sendMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
    messageType: v.optional(v.string()),
    imageId: v.optional(v.id("_storage")),
    isInternal: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      senderId: userId,
      content: args.content,
      messageType: args.messageType || "text",
      imageId: args.imageId,
      isInternal: args.isInternal,
    });

    // Update conversation last message time
    await ctx.db.patch(args.conversationId, {
      lastMessageAt: Date.now(),
    });
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    return await ctx.storage.generateUploadUrl();
  },
});
