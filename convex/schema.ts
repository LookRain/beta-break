import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,
  counter: defineTable({
    value: v.number(),
  }),
  profiles: defineTable({
    userId: v.id("users"),
    username: v.optional(v.string()),
    usernameLower: v.optional(v.string()),
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
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_id", ["userId"])
    .index("by_username_lower", ["usernameLower"]),
  trainingItems: defineTable({
    ownerId: v.id("users"),
    title: v.string(),
    description: v.optional(v.string()),
    categories: v.array(v.string()),
    tags: v.array(v.string()),
    variables: v.object({
      weight: v.optional(v.number()),
      reps: v.optional(v.number()),
      sets: v.optional(v.number()),
      restSeconds: v.optional(v.number()),
      restBetweenSetsSeconds: v.optional(v.number()),
      durationSeconds: v.optional(v.number()),
    }),
    trainingType: v.optional(
      v.union(
        v.literal("hang"),
        v.literal("weight_training"),
        v.literal("climbing"),
        v.literal("others"),
      ),
    ),
    hangDetails: v.optional(
      v.object({
        apparatus: v.union(v.literal("fingerboard"), v.literal("bar")),
        edgeSizeMm: v.optional(
          v.union(v.literal(8), v.literal(10), v.literal(15), v.literal(20), v.literal(25)),
        ),
        crimpType: v.optional(v.union(v.literal("open"), v.literal("half"), v.literal("full"))),
        loadPreference: v.optional(v.union(v.literal("below_100"), v.literal("above_100"))),
      }),
    ),
    difficulty: v.union(v.literal("beginner"), v.literal("intermediate"), v.literal("advanced")),
    equipment: v.array(v.string()),
    status: v.union(v.literal("draft"), v.literal("published")),
    publishedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner_updated_at", ["ownerId", "updatedAt"])
    .index("by_status_published_at", ["status", "publishedAt"])
    .index("by_difficulty", ["difficulty"]),
  savedItems: defineTable({
    userId: v.id("users"),
    itemId: v.id("trainingItems"),
    createdAt: v.number(),
  })
    .index("by_user_item", ["userId", "itemId"])
    .index("by_user_created_at", ["userId", "createdAt"]),
  trainingScheduleSessions: defineTable({
    ownerId: v.id("users"),
    trainingItemId: v.id("trainingItems"),
    isImpromptu: v.optional(v.boolean()),
    recurrenceRuleId: v.optional(v.id("trainingScheduleRecurrenceRules")),
    scheduledFor: v.number(),
    completedAt: v.optional(v.number()),
    canceledAt: v.optional(v.number()),
    snapshot: v.object({
      title: v.string(),
      description: v.optional(v.string()),
      categories: v.array(v.string()),
      tags: v.array(v.string()),
      trainingType: v.optional(
        v.union(
          v.literal("hang"),
          v.literal("weight_training"),
          v.literal("climbing"),
          v.literal("others"),
        ),
      ),
      hangDetails: v.optional(
        v.object({
          apparatus: v.union(v.literal("fingerboard"), v.literal("bar")),
          edgeSizeMm: v.optional(
            v.union(v.literal(8), v.literal(10), v.literal(15), v.literal(20), v.literal(25)),
          ),
          crimpType: v.optional(v.union(v.literal("open"), v.literal("half"), v.literal("full"))),
          loadPreference: v.optional(v.union(v.literal("below_100"), v.literal("above_100"))),
        }),
      ),
      difficulty: v.union(v.literal("beginner"), v.literal("intermediate"), v.literal("advanced")),
      equipment: v.array(v.string()),
      variables: v.object({
        weight: v.optional(v.number()),
        reps: v.optional(v.number()),
        sets: v.optional(v.number()),
        restSeconds: v.optional(v.number()),
        restBetweenSetsSeconds: v.optional(v.number()),
        durationSeconds: v.optional(v.number()),
      }),
    }),
    overrides: v.object({
      weight: v.optional(v.number()),
      reps: v.optional(v.number()),
      sets: v.optional(v.number()),
      restSeconds: v.optional(v.number()),
      restBetweenSetsSeconds: v.optional(v.number()),
      durationSeconds: v.optional(v.number()),
    }),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner_scheduled_for", ["ownerId", "scheduledFor"])
    .index("by_owner_completed_at", ["ownerId", "completedAt"])
    .index("by_rule_scheduled_for", ["recurrenceRuleId", "scheduledFor"]),
  trainingScheduleRecurrenceRules: defineTable({
    ownerId: v.id("users"),
    trainingItemId: v.id("trainingItems"),
    startDate: v.number(),
    recurrence: v.object({
      frequency: v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly")),
      interval: v.number(),
      byWeekdays: v.optional(v.array(v.number())),
      until: v.optional(v.number()),
    }),
    snapshot: v.object({
      title: v.string(),
      description: v.optional(v.string()),
      categories: v.array(v.string()),
      tags: v.array(v.string()),
      trainingType: v.optional(
        v.union(
          v.literal("hang"),
          v.literal("weight_training"),
          v.literal("climbing"),
          v.literal("others"),
        ),
      ),
      hangDetails: v.optional(
        v.object({
          apparatus: v.union(v.literal("fingerboard"), v.literal("bar")),
          edgeSizeMm: v.optional(
            v.union(v.literal(8), v.literal(10), v.literal(15), v.literal(20), v.literal(25)),
          ),
          crimpType: v.optional(v.union(v.literal("open"), v.literal("half"), v.literal("full"))),
          loadPreference: v.optional(v.union(v.literal("below_100"), v.literal("above_100"))),
        }),
      ),
      difficulty: v.union(v.literal("beginner"), v.literal("intermediate"), v.literal("advanced")),
      equipment: v.array(v.string()),
      variables: v.object({
        weight: v.optional(v.number()),
        reps: v.optional(v.number()),
        sets: v.optional(v.number()),
        restSeconds: v.optional(v.number()),
        restBetweenSetsSeconds: v.optional(v.number()),
        durationSeconds: v.optional(v.number()),
      }),
    }),
    defaultOverrides: v.object({
      weight: v.optional(v.number()),
      reps: v.optional(v.number()),
      sets: v.optional(v.number()),
      restSeconds: v.optional(v.number()),
      restBetweenSetsSeconds: v.optional(v.number()),
      durationSeconds: v.optional(v.number()),
    }),
    notes: v.optional(v.string()),
    active: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner_start_date", ["ownerId", "startDate"])
    .index("by_owner_active_start_date", ["ownerId", "active", "startDate"]),
  trainingSessionLogs: defineTable({
    ownerId: v.id("users"),
    scheduleSessionId: v.id("trainingScheduleSessions"),
    trainingItemId: v.id("trainingItems"),
    status: v.union(v.literal("active"), v.literal("completed"), v.literal("stopped_early")),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    planned: v.object({
      sets: v.optional(v.number()),
      reps: v.optional(v.number()),
      restSeconds: v.optional(v.number()),
      restBetweenSetsSeconds: v.optional(v.number()),
      durationSeconds: v.optional(v.number()),
    }),
    summary: v.object({
      completedSets: v.number(),
      completedReps: v.number(),
      skippedSets: v.number(),
      totalRepDurationMs: v.number(),
      totalRestDurationMs: v.number(),
    }),
    steps: v.array(
      v.object({
        kind: v.union(v.literal("rep"), v.literal("rest"), v.literal("set_skipped")),
        setNumber: v.number(),
        repNumber: v.optional(v.number()),
        completedReps: v.optional(v.number()),
        plannedDurationSeconds: v.optional(v.number()),
        actualDurationMs: v.number(),
        note: v.optional(v.string()),
        createdAt: v.number(),
      }),
    ),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner_started_at", ["ownerId", "startedAt"])
    .index("by_owner_status_started_at", ["ownerId", "status", "startedAt"])
    .index("by_session_started_at", ["scheduleSessionId", "startedAt"]),
});
