import { getAuthUserId } from "@convex-dev/auth/server";
import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

const variablesValidator = v.object({
  weight: v.optional(v.number()),
  reps: v.optional(v.number()),
  sets: v.optional(v.number()),
  restSeconds: v.optional(v.number()),
  restBetweenSetsSeconds: v.optional(v.number()),
  durationSeconds: v.optional(v.number()),
});

const trainingTypeValidator = v.union(
  v.literal("hang"),
  v.literal("weight_training"),
  v.literal("climbing"),
  v.literal("others"),
);

const hangDetailsValidator = v.object({
  apparatus: v.union(v.literal("fingerboard"), v.literal("bar")),
  edgeSizeMm: v.optional(
    v.union(v.literal(8), v.literal(10), v.literal(15), v.literal(20), v.literal(25)),
  ),
  crimpType: v.optional(v.union(v.literal("open"), v.literal("half"), v.literal("full"))),
  loadPreference: v.optional(v.union(v.literal("below_100"), v.literal("above_100"))),
});

const difficultyValidator = v.union(
  v.literal("beginner"),
  v.literal("intermediate"),
  v.literal("advanced"),
);

export const createDraft = mutationGeneric({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    category: v.string(),
    tags: v.array(v.string()),
    variables: variablesValidator,
    trainingType: v.optional(trainingTypeValidator),
    hangDetails: v.optional(hangDetailsValidator),
    difficulty: difficultyValidator,
    equipment: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const ownerId = await getAuthUserId(ctx);
    if (!ownerId) {
      throw new Error("Unauthorized");
    }
    const now = Date.now();
    const itemId = await ctx.db.insert("trainingItems", {
      ...args,
      ownerId,
      // Keep legacy fields populated for backwards compatibility.
      status: "published",
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    return await ctx.db.get(itemId);
  },
});

export const updateDraft = mutationGeneric({
  args: {
    itemId: v.id("trainingItems"),
    title: v.string(),
    description: v.optional(v.string()),
    category: v.string(),
    tags: v.array(v.string()),
    variables: variablesValidator,
    trainingType: v.optional(trainingTypeValidator),
    hangDetails: v.optional(hangDetailsValidator),
    difficulty: difficultyValidator,
    equipment: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const ownerId = await getAuthUserId(ctx);
    if (!ownerId) {
      throw new Error("Unauthorized");
    }
    const item = await ctx.db.get(args.itemId);

    if (!item) {
      throw new Error("Item not found");
    }
    if (item.ownerId !== ownerId) {
      throw new Error("Forbidden");
    }

    await ctx.db.patch(args.itemId, {
      title: args.title,
      description: args.description,
      category: args.category,
      tags: args.tags,
      variables: args.variables,
      trainingType: args.trainingType,
      hangDetails: args.hangDetails,
      difficulty: args.difficulty,
      equipment: args.equipment,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(args.itemId);
  },
});

export const deleteDraft = mutationGeneric({
  args: {
    itemId: v.id("trainingItems"),
  },
  handler: async (ctx, args) => {
    const ownerId = await getAuthUserId(ctx);
    if (!ownerId) {
      throw new Error("Unauthorized");
    }
    const item = await ctx.db.get(args.itemId);

    if (!item) {
      throw new Error("Item not found");
    }
    if (item.ownerId !== ownerId) {
      throw new Error("Forbidden");
    }

    await ctx.db.delete(args.itemId);
    return { success: true };
  },
});

export const publishItem = mutationGeneric({
  args: {
    itemId: v.id("trainingItems"),
  },
  handler: async (ctx, args) => {
    const ownerId = await getAuthUserId(ctx);
    if (!ownerId) {
      throw new Error("Unauthorized");
    }
    const item = await ctx.db.get(args.itemId);

    if (!item) {
      throw new Error("Item not found");
    }
    if (item.ownerId !== ownerId) {
      throw new Error("Forbidden");
    }

    // Legacy no-op endpoint retained so older clients do not break.
    await ctx.db.patch(args.itemId, { updatedAt: Date.now() });
    return await ctx.db.get(args.itemId);
  },
});

export const unpublishItem = mutationGeneric({
  args: {
    itemId: v.id("trainingItems"),
  },
  handler: async (ctx, args) => {
    const ownerId = await getAuthUserId(ctx);
    if (!ownerId) {
      throw new Error("Unauthorized");
    }
    const item = await ctx.db.get(args.itemId);

    if (!item) {
      throw new Error("Item not found");
    }
    if (item.ownerId !== ownerId) {
      throw new Error("Forbidden");
    }

    // Legacy no-op endpoint retained so older clients do not break.
    await ctx.db.patch(args.itemId, { updatedAt: Date.now() });
    return await ctx.db.get(args.itemId);
  },
});

export const listMyItems = queryGeneric({
  handler: async (ctx) => {
    const ownerId = await getAuthUserId(ctx);
    if (!ownerId) {
      throw new Error("Unauthorized");
    }
    return await ctx.db
      .query("trainingItems")
      .withIndex("by_owner_updated_at", (q) => q.eq("ownerId", ownerId))
      .order("desc")
      .collect();
  },
});

export const listPublishedItems = queryGeneric({
  args: {
    searchText: v.optional(v.string()),
    category: v.optional(v.string()),
    difficulty: v.optional(difficultyValidator),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const items = await ctx.db.query("trainingItems").collect();

    const normalizedSearch = args.searchText?.trim().toLowerCase();
    const requestedTags = new Set((args.tags ?? []).map((tag) => tag.toLowerCase()));

    const filtered = items
      .filter((item) => {
        if (args.category && item.category !== args.category) {
          return false;
        }
        if (args.difficulty && item.difficulty !== args.difficulty) {
          return false;
        }
        if (requestedTags.size > 0) {
          const itemTags = new Set(item.tags.map((tag: string) => tag.toLowerCase()));
          for (const tag of requestedTags) {
            if (!itemTags.has(tag)) {
              return false;
            }
          }
        }
        if (normalizedSearch) {
          const haystack =
            `${item.title} ${item.description ?? ""} ${item.tags.join(" ")}`.toLowerCase();
          if (!haystack.includes(normalizedSearch)) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);

    const publishers = new Map<
      string,
      {
        userId: string;
        username: string | null;
        image: string | null;
      }
    >();
    await Promise.all(
      filtered.map(async (item) => {
        if (publishers.has(item.ownerId)) {
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

    return filtered.map((item) => ({
      ...item,
      publisher: publishers.get(item.ownerId) ?? null,
    }));
  },
});

export const getItemById = queryGeneric({
  args: {
    itemId: v.id("trainingItems"),
  },
  handler: async (ctx, args) => {
    const viewerId = await getAuthUserId(ctx);
    if (!viewerId) {
      return null;
    }

    const item = await ctx.db.get(args.itemId);
    if (!item) {
      return null;
    }

    return item.ownerId === viewerId ? item : null;
  },
});
