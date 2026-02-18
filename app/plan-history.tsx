import React from "react";
import { ScrollView } from "react-native";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { CheckCircle2, Clock } from "lucide-react-native";
import { SessionCard } from "@/components/session-card";
import { colors, cardShadow, screenPadding } from "@/lib/theme";

function startOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function toDayString(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function mergeVariables(
  base: { weight?: number; reps?: number; sets?: number; restSeconds?: number; durationSeconds?: number },
  overrides: { weight?: number; reps?: number; sets?: number; restSeconds?: number; durationSeconds?: number },
) {
  return {
    weight: overrides.weight ?? base.weight,
    reps: overrides.reps ?? base.reps,
    sets: overrides.sets ?? base.sets,
    restSeconds: overrides.restSeconds ?? base.restSeconds,
    durationSeconds: overrides.durationSeconds ?? base.durationSeconds,
  };
}

export default function PlanHistoryScreen() {
  const today = startOfDay(Date.now());
  const oneYearAgo = startOfDay(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const sessionsResult = useQuery(api.trainingSchedule.listCalendarSessionsInRange, {
    rangeStart: oneYearAgo,
    rangeEnd: today,
  });

  const pastSessions = React.useMemo(
    () =>
      (sessionsResult?.sessions ?? [])
        .filter((session) => session.completedAt || session.scheduledFor < today)
        .sort((a, b) => {
          const aSortTime = a.completedAt ?? a.scheduledFor;
          const bSortTime = b.completedAt ?? b.scheduledFor;
          return bSortTime - aSortTime;
        }),
    [sessionsResult?.sessions, today],
  );

  if (sessionsResult === undefined) {
    return (
      <Box className="flex-1 items-center justify-center">
        <Text className="text-typography-500">Loading past sessions...</Text>
      </Box>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ ...screenPadding, gap: 16 }}
      style={{ backgroundColor: colors.bg }}
    >
      <Box className="gap-1">
        <Text className="text-2xl font-bold text-typography-900">Past Sessions</Text>
        <Text className="text-sm text-typography-500">Your training history from the last year</Text>
      </Box>

      {pastSessions.length === 0 ? (
        <Box className="rounded-2xl p-6 items-center" style={{ ...cardShadow, backgroundColor: colors.bgCard }}>
          <Text className="text-typography-500">No past sessions yet.</Text>
        </Box>
      ) : null}

      {pastSessions.map((session) => {
        const final = mergeVariables(session.snapshot.variables, session.overrides);
        const isCompleted = !!session.completedAt;
        const isImpromptu = !!session.isImpromptu;
        return (
          <SessionCard
            key={session._id}
            snapshot={session.snapshot}
            finalVariables={final}
            statusBadge={
              <Box className="flex-row items-center gap-1.5">
                {isImpromptu ? (
                  <Box className="rounded-full px-2.5 py-1" style={{ backgroundColor: colors.accentBg }}>
                    <Text className="text-xs font-semibold" style={{ color: colors.accent }}>Impromptu</Text>
                  </Box>
                ) : null}
                {isCompleted ? (
                  <Box className="flex-row items-center gap-1">
                    <CheckCircle2 size={14} color={colors.success} strokeWidth={2.5} />
                    <Text className="text-xs font-semibold" style={{ color: colors.success }}>Completed</Text>
                  </Box>
                ) : (
                  <Box className="flex-row items-center gap-1">
                    <Clock size={14} color={colors.textMuted} strokeWidth={2} />
                    <Text className="text-xs text-typography-400">Missed</Text>
                  </Box>
                )}
              </Box>
            }
          >
            {isImpromptu ? (
              <Text className="text-sm text-typography-500">
                {session.completedAt ? `Completed ${toDayString(session.completedAt)}` : "Impromptu session"}
              </Text>
            ) : (
              <Text className="text-sm text-typography-500">
                {toDayString(session.scheduledFor)}
                {session.completedAt ? ` · Completed ${toDayString(session.completedAt)}` : ""}
              </Text>
            )}
          </SessionCard>
        );
      })}
    </ScrollView>
  );
}
