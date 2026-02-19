import { getAuthUserId } from "@convex-dev/auth/server";
import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

const stepValidator = v.object({
  kind: v.union(v.literal("rep"), v.literal("rest"), v.literal("set_skipped")),
  setNumber: v.number(),
  repNumber: v.optional(v.number()),
  completedReps: v.optional(v.number()),
  plannedDurationSeconds: v.optional(v.number()),
  actualDurationMs: v.number(),
  note: v.optional(v.string()),
});

function mergeVariables(
  snapshot: {
    sets?: number;
    reps?: number;
    restSeconds?: number;
    restBetweenSetsSeconds?: number;
    durationSeconds?: number;
  },
  overrides: {
    sets?: number;
    reps?: number;
    restSeconds?: number;
    restBetweenSetsSeconds?: number;
    durationSeconds?: number;
  },
) {
  return {
    sets: overrides.sets ?? snapshot.sets,
    reps: overrides.reps ?? snapshot.reps,
    restSeconds: overrides.restSeconds ?? snapshot.restSeconds,
    restBetweenSetsSeconds: overrides.restBetweenSetsSeconds ?? snapshot.restBetweenSetsSeconds,
    durationSeconds: overrides.durationSeconds ?? snapshot.durationSeconds,
  };
}

export const startSessionExecution = mutationGeneric({
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
    if (session.completedAt) {
      throw new Error("Completed sessions are immutable.");
    }

    const existing = await ctx.db
      .query("trainingSessionLogs")
      .withIndex("by_session_started_at", (q) => q.eq("scheduleSessionId", args.sessionId))
      .order("desc")
      .first();

    if (existing && existing.status === "active") {
      return existing;
    }

    const now = Date.now();
    const variables = mergeVariables(session.snapshot.variables, session.overrides);
    const logId = await ctx.db.insert("trainingSessionLogs", {
      ownerId: userId,
      scheduleSessionId: session._id,
      trainingItemId: session.trainingItemId,
      status: "active",
      startedAt: now,
      endedAt: undefined,
      planned: {
        sets: variables.sets,
        reps: variables.reps,
        restSeconds: variables.restSeconds,
        restBetweenSetsSeconds: variables.restBetweenSetsSeconds,
        durationSeconds: variables.durationSeconds,
      },
      summary: {
        completedSets: 0,
        completedReps: 0,
        skippedSets: 0,
        totalRepDurationMs: 0,
        totalRestDurationMs: 0,
      },
      steps: [],
      notes: undefined,
      createdAt: now,
      updatedAt: now,
    });

    return await ctx.db.get(logId);
  },
});

export const appendExecutionStep = mutationGeneric({
  args: {
    logId: v.id("trainingSessionLogs"),
    step: stepValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const log = await ctx.db.get(args.logId);
    if (!log) {
      throw new Error("Execution log not found.");
    }
    if (log.ownerId !== userId) {
      throw new Error("Forbidden");
    }
    if (log.status !== "active") {
      throw new Error("Only active logs can receive new steps.");
    }

    const step = {
      ...args.step,
      note: args.step.note?.trim() || undefined,
      createdAt: Date.now(),
    };

    const summary = { ...log.summary };
    if (step.kind === "rep") {
      const plannedReps = Math.max(1, log.planned.reps ?? 1);
      const completedRepsForStep = step.completedReps ?? (step.repNumber ? 1 : plannedReps);
      const didFinishSet =
        (step.repNumber ?? completedRepsForStep) >= plannedReps ||
        completedRepsForStep >= plannedReps;
      summary.totalRepDurationMs += step.actualDurationMs;
      summary.completedReps += completedRepsForStep;
      if (didFinishSet) {
        summary.completedSets = Math.max(summary.completedSets, step.setNumber);
      }
    } else if (step.kind === "rest") {
      summary.totalRestDurationMs += step.actualDurationMs;
    } else {
      summary.skippedSets += 1;
    }

    await ctx.db.patch(args.logId, {
      steps: [...log.steps, step],
      summary,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(args.logId);
  },
});

export const finishSessionExecution = mutationGeneric({
  args: {
    logId: v.id("trainingSessionLogs"),
    outcome: v.union(v.literal("completed"), v.literal("stopped_early")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const log = await ctx.db.get(args.logId);
    if (!log) {
      throw new Error("Execution log not found.");
    }
    if (log.ownerId !== userId) {
      throw new Error("Forbidden");
    }
    if (log.status !== "active") {
      return log;
    }

    const now = Date.now();
    await ctx.db.patch(args.logId, {
      status: args.outcome,
      endedAt: now,
      notes: args.notes?.trim() || undefined,
      updatedAt: now,
    });

    const session = await ctx.db.get(log.scheduleSessionId);
    if (session && !session.completedAt) {
      await ctx.db.patch(session._id, {
        completedAt: now,
        updatedAt: now,
      });
    }

    return await ctx.db.get(args.logId);
  },
});

export const listRecentExecutionLogs = queryGeneric({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const requestedLimit = Math.floor(args.limit ?? 20);
    const limit = Math.max(1, Math.min(50, requestedLimit));

    const logs = await ctx.db
      .query("trainingSessionLogs")
      .withIndex("by_owner_started_at", (q) => q.eq("ownerId", userId))
      .order("desc")
      .take(limit);

    return await Promise.all(
      logs.map(async (log) => {
        const session = await ctx.db.get(log.scheduleSessionId);
        return {
          ...log,
          sessionTitle: session?.snapshot.title ?? "Session",
          scheduledFor: session?.scheduledFor,
        };
      }),
    );
  },
});

export const getActiveExecutionForSession = queryGeneric({
  args: {
    sessionId: v.id("trainingScheduleSessions"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const log = await ctx.db
      .query("trainingSessionLogs")
      .withIndex("by_session_started_at", (q) => q.eq("scheduleSessionId", args.sessionId))
      .order("desc")
      .first();

    if (!log || log.ownerId !== userId || log.status !== "active") {
      return null;
    }
    return log;
  },
});
