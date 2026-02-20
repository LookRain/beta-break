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

const recurrenceValidator = v.object({
  frequency: v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly")),
  interval: v.number(),
  byWeekdays: v.optional(v.array(v.number())),
  until: v.optional(v.number()),
});

function startOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function addDays(timestamp: number, days: number): number {
  return timestamp + days * 24 * 60 * 60 * 1000;
}

function startOfMonth(timestamp: number): number {
  const date = new Date(timestamp);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function endOfMonth(timestamp: number): number {
  const date = new Date(timestamp);
  date.setMonth(date.getMonth() + 1);
  date.setDate(0);
  date.setHours(23, 59, 59, 999);
  return date.getTime();
}

function ruleDateKey(ruleId: string, scheduledFor: number): string {
  return `${ruleId}:${scheduledFor}`;
}

function occursOnDate(
  rule: {
    startDate: number;
    recurrence: {
      frequency: "daily" | "weekly" | "monthly";
      interval: number;
      byWeekdays?: number[];
      until?: number;
    };
  },
  dateTimestamp: number,
): boolean {
  const date = startOfDay(dateTimestamp);
  const start = startOfDay(rule.startDate);
  const interval = Math.max(1, Math.floor(rule.recurrence.interval));

  if (date < start) {
    return false;
  }
  if (rule.recurrence.until !== undefined && date > startOfDay(rule.recurrence.until)) {
    return false;
  }

  if (rule.recurrence.frequency === "daily") {
    const daysBetween = Math.floor((date - start) / (24 * 60 * 60 * 1000));
    return daysBetween % interval === 0;
  }

  if (rule.recurrence.frequency === "weekly") {
    const startWeekDate = new Date(start);
    const currentWeekDate = new Date(date);
    const startWeekAnchor = startOfDay(
      startWeekDate.getTime() - startWeekDate.getDay() * 24 * 60 * 60 * 1000,
    );
    const currentWeekAnchor = startOfDay(
      currentWeekDate.getTime() - currentWeekDate.getDay() * 24 * 60 * 60 * 1000,
    );
    const weeksBetween = Math.floor(
      (currentWeekAnchor - startWeekAnchor) / (7 * 24 * 60 * 60 * 1000),
    );
    if (weeksBetween % interval !== 0) {
      return false;
    }
    const weekdays = rule.recurrence.byWeekdays?.length
      ? rule.recurrence.byWeekdays
      : [new Date(start).getDay()];
    return weekdays.includes(new Date(date).getDay());
  }

  const startDate = new Date(start);
  const currentDate = new Date(date);
  const monthsBetween =
    (currentDate.getFullYear() - startDate.getFullYear()) * 12 +
    (currentDate.getMonth() - startDate.getMonth());
  if (monthsBetween % interval !== 0) {
    return false;
  }
  return currentDate.getDate() === startDate.getDate();
}

async function createSessionFromRule(
  ctx: any,
  rule: any,
  scheduledFor: number,
  options?: { canceledAt?: number },
) {
  const now = Date.now();
  return await ctx.db.insert("trainingScheduleSessions", {
    ownerId: rule.ownerId,
    trainingItemId: rule.trainingItemId,
    isImpromptu: false,
    recurrenceRuleId: rule._id,
    scheduledFor: startOfDay(scheduledFor),
    completedAt: undefined,
    canceledAt: options?.canceledAt,
    snapshot: rule.snapshot,
    overrides: rule.defaultOverrides ?? {},
    notes: rule.notes,
    createdAt: now,
    updatedAt: now,
  });
}

async function getMaterializedRuleSessionForDate(ctx: any, ruleId: any, scheduledFor: number) {
  return await ctx.db
    .query("trainingScheduleSessions")
    .withIndex("by_rule_scheduled_for", (q: any) =>
      q.eq("recurrenceRuleId", ruleId).eq("scheduledFor", startOfDay(scheduledFor)),
    )
    .first();
}

async function assertOwnedRecurringRule(ctx: any, userId: any, ruleId: any) {
  const rule = await ctx.db.get(ruleId);
  if (!rule) {
    throw new Error("Recurring rule not found.");
  }
  if (rule.ownerId !== userId) {
    throw new Error("Forbidden");
  }
  return rule;
}

async function ensureRuleDateCanceled(ctx: any, rule: any, scheduledFor: number) {
  const targetDate = startOfDay(scheduledFor);
  const existing = await getMaterializedRuleSessionForDate(ctx, rule._id, targetDate);
  if (existing) {
    if (!existing.canceledAt && !existing.completedAt) {
      await ctx.db.patch(existing._id, {
        canceledAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
    return await ctx.db.get(existing._id);
  }

  const sessionId = await createSessionFromRule(ctx, rule, targetDate, { canceledAt: Date.now() });
  return await ctx.db.get(sessionId);
}

async function assertItemCanBeScheduled(ctx: any, userId: any, itemId: any) {
  const item = await ctx.db.get(itemId);
  if (!item) {
    throw new Error("Exercise not found.");
  }

  if (item.ownerId === userId) {
    return item;
  }

  const saved = await ctx.db
    .query("savedItems")
    .withIndex("by_user_item", (q: any) => q.eq("userId", userId).eq("itemId", itemId))
    .first();

  if (!saved) {
    throw new Error("You can only schedule your own or saved items.");
  }

  return item;
}

function normalizeItemCategories(categories: string[] | undefined): string[] {
  const normalized = Array.from(
    new Set((categories ?? []).map((entry) => entry.trim()).filter((entry) => entry.length > 0)),
  );
  if (normalized.length === 0) {
    throw new Error("Training item must have at least one category.");
  }
  return normalized;
}

export const addSession = mutationGeneric({
  args: {
    trainingItemId: v.id("trainingItems"),
    scheduledFor: v.number(),
    overrides: v.optional(variablesValidator),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const item = await assertItemCanBeScheduled(ctx, userId, args.trainingItemId);
    const snapshotCategories = normalizeItemCategories(item.categories);
    const now = Date.now();
    const sessionId = await ctx.db.insert("trainingScheduleSessions", {
      ownerId: userId,
      trainingItemId: args.trainingItemId,
      isImpromptu: false,
      recurrenceRuleId: undefined,
      scheduledFor: startOfDay(args.scheduledFor),
      completedAt: undefined,
      canceledAt: undefined,
      snapshot: {
        title: item.title,
        description: item.description,
        categories: snapshotCategories,
        tags: item.tags,
        trainingType: item.trainingType,
        hangDetails: item.hangDetails,
        difficulty: item.difficulty,
        equipment: item.equipment,
        variables: item.variables,
      },
      overrides: args.overrides ?? {},
      notes: args.notes?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    });

    return await ctx.db.get(sessionId);
  },
});

export const startImpromptuSession = mutationGeneric({
  args: {
    trainingItemId: v.id("trainingItems"),
    overrides: v.optional(variablesValidator),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const item = await assertItemCanBeScheduled(ctx, userId, args.trainingItemId);
    const snapshotCategories = normalizeItemCategories(item.categories);
    const now = Date.now();
    const sessionId = await ctx.db.insert("trainingScheduleSessions", {
      ownerId: userId,
      trainingItemId: args.trainingItemId,
      isImpromptu: true,
      recurrenceRuleId: undefined,
      scheduledFor: startOfDay(now),
      completedAt: undefined,
      canceledAt: undefined,
      snapshot: {
        title: item.title,
        description: item.description,
        categories: snapshotCategories,
        tags: item.tags,
        trainingType: item.trainingType,
        hangDetails: item.hangDetails,
        difficulty: item.difficulty,
        equipment: item.equipment,
        variables: item.variables,
      },
      overrides: args.overrides ?? {},
      notes: args.notes?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    });

    return await ctx.db.get(sessionId);
  },
});

export const addRecurringSeries = mutationGeneric({
  args: {
    trainingItemId: v.id("trainingItems"),
    startDate: v.number(),
    recurrence: recurrenceValidator,
    overrides: v.optional(variablesValidator),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    if (!Number.isFinite(args.recurrence.interval) || args.recurrence.interval < 1) {
      throw new Error("Interval must be at least 1.");
    }

    const item = await assertItemCanBeScheduled(ctx, userId, args.trainingItemId);
    const snapshotCategories = normalizeItemCategories(item.categories);
    const now = Date.now();
    const startDate = startOfDay(args.startDate);
    const until =
      args.recurrence.until !== undefined ? startOfDay(args.recurrence.until) : undefined;

    const ruleId = await ctx.db.insert("trainingScheduleRecurrenceRules", {
      ownerId: userId,
      trainingItemId: args.trainingItemId,
      startDate,
      recurrence: {
        ...args.recurrence,
        interval: Math.floor(args.recurrence.interval),
        byWeekdays: args.recurrence.byWeekdays,
        until,
      },
      snapshot: {
        title: item.title,
        description: item.description,
        categories: snapshotCategories,
        tags: item.tags,
        trainingType: item.trainingType,
        hangDetails: item.hangDetails,
        difficulty: item.difficulty,
        equipment: item.equipment,
        variables: item.variables,
      },
      defaultOverrides: args.overrides ?? {},
      notes: args.notes?.trim() || undefined,
      active: true,
      createdAt: now,
      updatedAt: now,
    });

    return await ctx.db.get(ruleId);
  },
});

export const ensureRecurringCoverage = mutationGeneric({
  args: {
    rangeStart: v.number(),
    rangeEnd: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }
    void args;
    // Recurring sessions are computed at query time and are materialized lazily
    // only when a user updates/completes/removes a concrete occurrence.
    return { generated: 0 };
  },
});

export const materializeRecurringOccurrence = mutationGeneric({
  args: {
    ruleId: v.id("trainingScheduleRecurrenceRules"),
    scheduledFor: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const rule = await assertOwnedRecurringRule(ctx, userId, args.ruleId);
    if (!rule.active) {
      throw new Error("Recurring rule is inactive.");
    }

    const scheduledFor = startOfDay(args.scheduledFor);
    if (!occursOnDate(rule, scheduledFor)) {
      throw new Error("This occurrence is not part of the recurring rule.");
    }

    const existing = await getMaterializedRuleSessionForDate(ctx, rule._id, scheduledFor);
    if (existing) {
      if (existing.canceledAt) {
        throw new Error("This occurrence was removed.");
      }
      return existing;
    }

    const sessionId = await createSessionFromRule(ctx, rule, scheduledFor);
    return await ctx.db.get(sessionId);
  },
});

export const cancelRecurringOccurrence = mutationGeneric({
  args: {
    ruleId: v.id("trainingScheduleRecurrenceRules"),
    scheduledFor: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const rule = await assertOwnedRecurringRule(ctx, userId, args.ruleId);
    if (!rule.active) {
      throw new Error("Recurring rule is inactive.");
    }

    const scheduledFor = startOfDay(args.scheduledFor);
    const today = startOfDay(Date.now());
    if (scheduledFor < today) {
      throw new Error("Only upcoming sessions can be removed.");
    }
    if (!occursOnDate(rule, scheduledFor)) {
      throw new Error("This occurrence is not part of the recurring rule.");
    }

    const existing = await getMaterializedRuleSessionForDate(ctx, rule._id, scheduledFor);
    if (existing) {
      if (existing.completedAt || existing.scheduledFor < today) {
        throw new Error("Only upcoming sessions can be removed.");
      }
      if (!existing.canceledAt) {
        await ctx.db.patch(existing._id, {
          canceledAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
      return { success: true };
    }

    await createSessionFromRule(ctx, rule, scheduledFor, { canceledAt: Date.now() });
    return { success: true };
  },
});

export const updateUpcomingSession = mutationGeneric({
  args: {
    sessionId: v.id("trainingScheduleSessions"),
    scheduledFor: v.optional(v.number()),
    overrides: v.optional(variablesValidator),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found.");
    }
    if (session.ownerId !== userId) {
      throw new Error("Forbidden");
    }
    if (session.canceledAt) {
      throw new Error("Removed sessions are immutable.");
    }
    if (session.completedAt) {
      throw new Error("Completed sessions are immutable.");
    }

    const today = startOfDay(Date.now());
    if (session.scheduledFor < today) {
      throw new Error("Past sessions are immutable.");
    }

    const nextScheduledFor =
      args.scheduledFor !== undefined ? startOfDay(args.scheduledFor) : session.scheduledFor;
    if (nextScheduledFor < today) {
      throw new Error("You can only move to today or future dates.");
    }

    const previousScheduledFor = session.scheduledFor;
    await ctx.db.patch(args.sessionId, {
      scheduledFor: nextScheduledFor,
      overrides: args.overrides ?? session.overrides,
      notes: args.notes?.trim() || undefined,
      updatedAt: Date.now(),
    });

    if (session.recurrenceRuleId && nextScheduledFor !== previousScheduledFor) {
      const rule = await ctx.db.get(session.recurrenceRuleId);
      if (rule && rule.ownerId === userId && rule.active && occursOnDate(rule, previousScheduledFor)) {
        await ensureRuleDateCanceled(ctx, rule, previousScheduledFor);
      }
    }

    return await ctx.db.get(args.sessionId);
  },
});

export const removeUpcomingSession = mutationGeneric({
  args: {
    sessionId: v.id("trainingScheduleSessions"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found.");
    }
    if (session.ownerId !== userId) {
      throw new Error("Forbidden");
    }
    if (session.canceledAt) {
      return { success: true };
    }

    const today = startOfDay(Date.now());
    if (session.completedAt || session.scheduledFor < today) {
      throw new Error("Only upcoming sessions can be removed.");
    }

    if (session.recurrenceRuleId) {
      const rule = await ctx.db.get(session.recurrenceRuleId);
      if (rule && rule.ownerId === userId && rule.active && occursOnDate(rule, session.scheduledFor)) {
        await ensureRuleDateCanceled(ctx, rule, session.scheduledFor);
        return { success: true };
      }
    }

    await ctx.db.delete(args.sessionId);
    return { success: true };
  },
});

export const completeSession = mutationGeneric({
  args: {
    sessionId: v.id("trainingScheduleSessions"),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found.");
    }
    if (session.ownerId !== userId) {
      throw new Error("Forbidden");
    }
    if (session.canceledAt) {
      throw new Error("Session was removed.");
    }
    if (session.completedAt) {
      return session;
    }

    await ctx.db.patch(args.sessionId, {
      completedAt: Date.now(),
      notes: args.notes?.trim() || session.notes,
      updatedAt: Date.now(),
    });
    return await ctx.db.get(args.sessionId);
  },
});

export const updateRecurringRuleFuture = mutationGeneric({
  args: {
    ruleId: v.id("trainingScheduleRecurrenceRules"),
    effectiveFrom: v.number(),
    overrides: v.optional(variablesValidator),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const rule = await ctx.db.get(args.ruleId);
    if (!rule) {
      throw new Error("Recurring rule not found.");
    }
    if (rule.ownerId !== userId) {
      throw new Error("Forbidden");
    }

    const effectiveFrom = startOfDay(args.effectiveFrom);

    await ctx.db.patch(rule._id, {
      defaultOverrides: args.overrides ?? rule.defaultOverrides,
      notes: args.notes?.trim() || rule.notes,
      updatedAt: Date.now(),
    });

    const sessions = await ctx.db
      .query("trainingScheduleSessions")
      .withIndex("by_rule_scheduled_for", (q: any) =>
        q.eq("recurrenceRuleId", rule._id).gte("scheduledFor", effectiveFrom),
      )
      .collect();

    const today = startOfDay(Date.now());
    await Promise.all(
      sessions.map(async (session: any) => {
        if (session.canceledAt || session.completedAt || session.scheduledFor < today) {
          return;
        }
        await ctx.db.patch(session._id, {
          overrides: args.overrides ?? session.overrides,
          notes: args.notes?.trim() || session.notes,
          updatedAt: Date.now(),
        });
      }),
    );

    return await ctx.db.get(rule._id);
  },
});

export const removeRecurringRuleFuture = mutationGeneric({
  args: {
    ruleId: v.id("trainingScheduleRecurrenceRules"),
    effectiveFrom: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const rule = await ctx.db.get(args.ruleId);
    if (!rule) {
      throw new Error("Recurring rule not found.");
    }
    if (rule.ownerId !== userId) {
      throw new Error("Forbidden");
    }

    const effectiveFrom = startOfDay(args.effectiveFrom);
    const today = startOfDay(Date.now());
    if (effectiveFrom < today) {
      throw new Error("You can only delete recurring sessions from today or a future date.");
    }

    const sessions = await ctx.db
      .query("trainingScheduleSessions")
      .withIndex("by_rule_scheduled_for", (q: any) =>
        q.eq("recurrenceRuleId", rule._id).gte("scheduledFor", effectiveFrom),
      )
      .collect();

    const removableSessions = sessions.filter(
      (session: any) => !session.completedAt && session.scheduledFor >= today,
    );
    await Promise.all(removableSessions.map((session: any) => ctx.db.delete(session._id)));
    const removedCount = removableSessions.length;

    const disableRule = effectiveFrom <= rule.startDate;
    const cutoffUntil = addDays(effectiveFrom, -1);
    const currentUntil =
      rule.recurrence.until !== undefined ? startOfDay(rule.recurrence.until) : undefined;
    const nextUntil =
      currentUntil === undefined ? cutoffUntil : Math.min(currentUntil, cutoffUntil);

    const nextActive = disableRule ? false : nextUntil >= today && rule.active;

    await ctx.db.patch(rule._id, {
      active: nextActive,
      recurrence: disableRule
        ? rule.recurrence
        : {
            ...rule.recurrence,
            until: nextUntil,
          },
      updatedAt: Date.now(),
    });

    return {
      removedCount,
      active: nextActive,
    };
  },
});

export const listCalendarSessionsInRange = queryGeneric({
  args: {
    rangeStart: v.number(),
    rangeEnd: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const rangeStart = startOfDay(args.rangeStart);
    const rangeEnd = startOfDay(args.rangeEnd);
    const monthStart = startOfMonth(rangeStart);
    const monthEnd = endOfMonth(rangeEnd);

    const materializedSessions = await ctx.db
      .query("trainingScheduleSessions")
      .withIndex("by_owner_scheduled_for", (q: any) =>
        q.eq("ownerId", userId).gte("scheduledFor", monthStart).lte("scheduledFor", monthEnd),
      )
      .order("asc")
      .collect();

    const blockedRuleDates = new Set<string>();
    const sessions: any[] = [];
    for (const session of materializedSessions) {
      if (session.recurrenceRuleId) {
        blockedRuleDates.add(ruleDateKey(String(session.recurrenceRuleId), session.scheduledFor));
      }
      if (session.canceledAt) {
        continue;
      }
      sessions.push({
        ...session,
        isVirtual: false,
      });
    }

    const rules = await ctx.db
      .query("trainingScheduleRecurrenceRules")
      .withIndex("by_owner_active_start_date", (q: any) =>
        q.eq("ownerId", userId).eq("active", true).lte("startDate", monthEnd),
      )
      .collect();

    for (const rule of rules) {
      const effectiveStart = Math.max(startOfDay(rule.startDate), monthStart);
      const ruleUntil =
        rule.recurrence.until !== undefined ? startOfDay(rule.recurrence.until) : undefined;
      const effectiveEnd = ruleUntil !== undefined ? Math.min(ruleUntil, monthEnd) : monthEnd;
      if (effectiveEnd < effectiveStart) {
        continue;
      }

      for (let cursor = effectiveStart; cursor <= effectiveEnd; cursor = addDays(cursor, 1)) {
        if (!occursOnDate(rule, cursor)) {
          continue;
        }
        const key = ruleDateKey(String(rule._id), cursor);
        if (blockedRuleDates.has(key)) {
          continue;
        }
        sessions.push({
          _id: `virtual:${rule._id}:${cursor}`,
          ownerId: rule.ownerId,
          trainingItemId: rule.trainingItemId,
          isImpromptu: false,
          recurrenceRuleId: rule._id,
          scheduledFor: cursor,
          completedAt: undefined,
          canceledAt: undefined,
          snapshot: rule.snapshot,
          overrides: rule.defaultOverrides ?? {},
          notes: rule.notes,
          createdAt: rule.createdAt,
          updatedAt: rule.updatedAt,
          isVirtual: true,
        });
      }
    }

    sessions.sort((a, b) => a.scheduledFor - b.scheduledFor);

    return {
      sessions,
      monthStart,
      monthEnd,
      today: startOfDay(Date.now()),
    };
  },
});

export const getSessionById = queryGeneric({
  args: {
    sessionId: v.id("trainingScheduleSessions"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.ownerId !== userId || session.canceledAt) {
      return null;
    }
    return session;
  },
});
