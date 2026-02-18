import { getAuthUserId } from "@convex-dev/auth/server";
import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

function normalizeUsername(username: string | undefined): {
  username: string | undefined;
  usernameLower: string | undefined;
} {
  const normalized = username?.trim();
  if (!normalized) {
    return { username: undefined, usernameLower: undefined };
  }

  if (!/^[a-zA-Z0-9_]{3,24}$/.test(normalized)) {
    throw new Error("Username must be 3-24 chars and only letters, numbers, or underscore.");
  }

  return {
    username: normalized,
    usernameLower: normalized.toLowerCase(),
  };
}

export const getMyProfile = queryGeneric({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    return await ctx.db
      .query("profiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();
  },
});

export const upsertMyProfile = mutationGeneric({
  args: {
    username: v.optional(v.string()),
    bodyWeightKg: v.optional(v.number()),
    styles: v.array(v.string()),
    climbingAgeMonths: v.optional(v.number()),
    boulderingGrade: v.optional(v.string()),
    sportGrade: v.optional(v.string()),
    tradGrade: v.optional(v.string()),
    regions: v.array(v.string()),
    bio: v.optional(v.string()),
    goals: v.optional(v.string()),
    showProfilePublic: v.boolean(),
    showHistoryPublic: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const { username, usernameLower } = normalizeUsername(args.username);
    const bodyWeightKg =
      args.bodyWeightKg !== undefined && args.bodyWeightKg <= 0
        ? undefined
        : args.bodyWeightKg;

    if (usernameLower) {
      const existingByUsername = await ctx.db
        .query("profiles")
        .withIndex("by_username_lower", (q) => q.eq("usernameLower", usernameLower))
        .first();

      if (existingByUsername && existingByUsername.userId !== userId) {
        throw new Error("Username is already taken.");
      }
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    if (!existing) {
      const profileId = await ctx.db.insert("profiles", {
        userId,
        ...args,
        bodyWeightKg,
        username,
        usernameLower,
        createdAt: now,
        updatedAt: now,
      });
      return await ctx.db.get(profileId);
    }

    await ctx.db.patch(existing._id, {
      ...args,
      bodyWeightKg,
      username,
      usernameLower,
      updatedAt: now,
    });
    return await ctx.db.get(existing._id);
  },
});
