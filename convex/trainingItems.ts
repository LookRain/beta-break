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

function normalizeCategories(input: { category?: string; categories?: string[] }): {
  category: string;
  categories: string[];
} {
  const categories = collectCategories(input);
  if (categories.length === 0) {
    throw new Error("At least one category is required.");
  }
  return {
    category: categories[0],
    categories,
  };
}

function collectCategories(input: { category?: string; categories?: string[] }): string[] {
  const merged = [...(input.categories ?? []), ...(input.category ? [input.category] : [])]
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return Array.from(new Set(merged));
}

function categoriesAreEqual(left: string[] | undefined, right: string[]): boolean {
  const normalizedLeft = collectCategories({ categories: left });
  if (normalizedLeft.length !== right.length) {
    return false;
  }
  return normalizedLeft.every((entry, index) => entry === right[index]);
}

export const createDraft = mutationGeneric({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    categories: v.optional(v.array(v.string())),
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
    const normalizedCategories = normalizeCategories({
      category: args.category,
      categories: args.categories,
    });
    const now = Date.now();
    const itemId = await ctx.db.insert("trainingItems", {
      ...args,
      category: normalizedCategories.category,
      categories: normalizedCategories.categories,
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
    category: v.optional(v.string()),
    categories: v.optional(v.array(v.string())),
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
    const normalizedCategories = normalizeCategories({
      category: args.category,
      categories: args.categories,
    });
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
      category: normalizedCategories.category,
      categories: normalizedCategories.categories,
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
    categories: v.optional(v.array(v.string())),
    difficulty: v.optional(difficultyValidator),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const items = await ctx.db.query("trainingItems").collect();

    const normalizedSearch = args.searchText?.trim().toLowerCase();
    const requestedTags = new Set((args.tags ?? []).map((tag) => tag.toLowerCase()));
    const requestedCategories = new Set(
      [...(args.categories ?? []), ...(args.category ? [args.category] : [])]
        .map((entry) => entry.toLowerCase().trim())
        .filter((entry) => entry.length > 0),
    );
    const filtered = items
      .filter((item) => {
        const itemCategories = (
          item.categories?.length ? item.categories : item.category ? [item.category] : []
        )
          .map((entry: string) => entry.toLowerCase().trim())
          .filter((entry: string) => entry.length > 0);
        if (
          requestedCategories.size > 0 &&
          !itemCategories.some((entry: string) => requestedCategories.has(entry))
        ) {
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
          const searchableCategories = (
            item.categories?.length ? item.categories : item.category ? [item.category] : []
          ).join(" ");
          const haystack =
            `${item.title} ${item.description ?? ""} ${item.tags.join(" ")} ${searchableCategories}`.toLowerCase();
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

export const migrateLegacyCategoryToCategories = mutationGeneric({
  args: {
    dryRun: v.optional(v.boolean()),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? false;
    const requestedBatchSize = Math.floor(args.batchSize ?? 200);
    const batchSize = Math.max(1, Math.min(500, requestedBatchSize));

    let scanned = 0;
    let updated = 0;
    let cursor: string | null = null;

    while (true) {
      const page = await ctx.db.query("trainingItems").paginate({
        cursor,
        numItems: batchSize,
      });

      for (const item of page.page) {
        scanned += 1;
        const nextCategories = collectCategories({
          categories: item.categories,
          category: item.category,
        });
        if (nextCategories.length === 0 || categoriesAreEqual(item.categories, nextCategories)) {
          continue;
        }
        if (!dryRun) {
          await ctx.db.patch(item._id, {
            categories: nextCategories,
            updatedAt: Date.now(),
          });
        }
        updated += 1;
      }

      if (page.isDone) {
        break;
      }
      cursor = page.continueCursor;
    }

    return {
      dryRun,
      scanned,
      updated,
      message: dryRun
        ? "Dry run complete. Re-run with { dryRun: false } to apply updates."
        : "Migration complete.",
    };
  },
});
