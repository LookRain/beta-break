import { getAuthUserId } from "@convex-dev/auth/server";
import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

export const saveItem = mutationGeneric({
  args: {
    itemId: v.id("trainingItems"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const item = await ctx.db.get(args.itemId);
    if (!item) {
      throw new Error("Exercise not found");
    }

    const existing = await ctx.db
      .query("savedItems")
      .withIndex("by_user_created_at", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("itemId"), args.itemId))
      .first();

    if (existing) {
      return existing;
    }

    const savedItemId = await ctx.db.insert("savedItems", {
      userId,
      itemId: args.itemId,
      createdAt: Date.now(),
    });
    return await ctx.db.get(savedItemId);
  },
});

export const unsaveItem = mutationGeneric({
  args: {
    itemId: v.id("trainingItems"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const existing = await ctx.db
      .query("savedItems")
      .withIndex("by_user_created_at", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("itemId"), args.itemId))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    return { success: true };
  },
});

export const isItemSaved = queryGeneric({
  args: {
    itemId: v.id("trainingItems"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return false;
    }

    const existing = await ctx.db
      .query("savedItems")
      .withIndex("by_user_created_at", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("itemId"), args.itemId))
      .first();

    return !!existing;
  },
});

export const listSavedItems = queryGeneric({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const records = await ctx.db
      .query("savedItems")
      .withIndex("by_user_created_at", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    const items = await Promise.all(records.map((record) => ctx.db.get(record.itemId)));
    const publishers = new Map<
      string,
      {
        userId: string;
        username: string | null;
        image: string | null;
      }
    >();

    await Promise.all(
      items.map(async (item) => {
        if (!item || publishers.has(item.ownerId)) {
          return;
        }

        const profile = await ctx.db
          .query("profiles")
          .withIndex("by_user_id", (q) => q.eq("userId", item.ownerId))
          .first();

        publishers.set(item.ownerId, {
          userId: item.ownerId,
          username: profile?.username ?? null,
          image: null,
        });
      }),
    );

    return records
      .map((record, index) => ({
        _id: record._id,
        createdAt: record.createdAt,
        item: items[index]
          ? {
              ...items[index],
              publisher: publishers.get(items[index]!.ownerId) ?? null,
            }
          : null,
      }))
      .filter((entry) => !!entry.item);
  },
});
