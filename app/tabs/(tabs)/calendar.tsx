import React from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Calendar } from "react-native-calendars";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Button, ButtonText } from "@/components/ui/button";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
} from "@/components/ui/actionsheet";
import { Plus, CheckCircle2, Trash2, ChevronRight, Clock } from "lucide-react-native";
import { SessionCard, type SessionSnapshot } from "@/components/session-card";
import { UpcomingSessionCard } from "@/components/upcoming-session-card";
import {
  ExerciseDetailsSheet,
  type ExerciseDetailItem,
  type ExerciseDetailVariables,
} from "@/components/exercise-details-sheet";
import { PageHeader } from "@/components/page-header";
import { colors, cardShadow, inputStyle, calendarTheme, screenPadding } from "@/lib/theme";
import {
  HANG_CRIMP_TYPES,
  HANG_EDGE_MM_OPTIONS,
  HANG_EQUIPMENT_OPTIONS,
} from "@/lib/trainingItemFilters";
import { showErrorMessage, useAppToast } from "@/lib/useAppToast";

type SessionOverrides = {
  weight?: number;
  reps?: number;
  sets?: number;
  restSeconds?: number;
  restBetweenSetsSeconds?: number;
  durationSeconds?: number;
};

type SessionEditDraft = {
  weight: string;
  reps: string;
  sets: string;
  restSeconds: string;
  restBetweenSetsSeconds: string;
  durationSeconds: string;
  weightInputMode: "percent" | "absolute";
};

type Frequency = "daily" | "weekly" | "monthly";

function startOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime();
}

function addDays(timestamp: number, days: number): number {
  return startOfDay(timestamp + days * 24 * 60 * 60 * 1000);
}

function dayStringToTimestamp(dateString: string): number {
  const [year, month, day] = dateString.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function monthRangeFromDateString(dateString: string): { rangeStart: number; rangeEnd: number } {
  const [year, month] = dateString.split("-").map(Number);
  const monthStart = Date.UTC(year, month - 1, 1);
  const monthEnd = Date.UTC(year, month, 0, 23, 59, 59, 999);
  return { rangeStart: monthStart, rangeEnd: monthEnd };
}

function toDayString(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateLabel(dateString: string): string {
  const date = new Date(dayStringToTimestamp(dateString));
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function localTodayString(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dayOfWeekFromDayString(dateString: string): number {
  return new Date(dayStringToTimestamp(dateString)).getUTCDay();
}

function parseOptionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function convertWeightValue(
  raw: string,
  from: "percent" | "absolute",
  to: "percent" | "absolute",
  bodyWeightKg?: number,
): string {
  const parsed = parseOptionalNumber(raw);
  if (parsed === undefined || from === to) {
    return raw;
  }
  if (!bodyWeightKg || bodyWeightKg <= 0) {
    return raw;
  }

  const converted =
    from === "percent" && to === "absolute"
      ? (parsed / 100) * bodyWeightKg
      : (parsed / bodyWeightKg) * 100;
  return Number(converted.toFixed(2)).toString();
}

function mergeVariables(base: SessionOverrides, overrides: SessionOverrides): SessionOverrides {
  return {
    weight: overrides.weight ?? base.weight,
    reps: overrides.reps ?? base.reps,
    sets: overrides.sets ?? base.sets,
    restSeconds: overrides.restSeconds ?? base.restSeconds,
    restBetweenSetsSeconds: overrides.restBetweenSetsSeconds ?? base.restBetweenSetsSeconds,
    durationSeconds: overrides.durationSeconds ?? base.durationSeconds,
  };
}

const sectionCardStyle = {
  ...cardShadow,
  backgroundColor: colors.bgCard,
  borderRadius: 16,
  padding: 16,
  borderWidth: 1,
  borderColor: colors.border,
  gap: 12,
} as const;

const sectionOverlayContainerStyle = {
  position: "relative",
  overflow: "hidden",
} as const;

const sectionOverlayStyle = {
  position: "absolute",
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  backgroundColor: "rgba(255, 255, 255, 0.72)",
  alignItems: "center",
  justifyContent: "center",
  paddingHorizontal: 12,
} as const;

const trainingTypeLabel: Record<string, string> = {
  hang: "Hang",
  weight_training: "Weight training",
  climbing: "Climbing",
  others: "Others",
};

function OverrideUnavailableOverlay() {
  return (
    <Box pointerEvents="none" style={sectionOverlayStyle}>
      <Text className="text-xs font-semibold text-typography-500">Override not available</Text>
    </Box>
  );
}

function buildEditDraft(base: SessionOverrides, overrides: SessionOverrides): SessionEditDraft {
  const merged = mergeVariables(base, overrides);
  return {
    weight: merged.weight?.toString() ?? "",
    reps: merged.reps?.toString() ?? "",
    sets: merged.sets?.toString() ?? "",
    restSeconds: merged.restSeconds?.toString() ?? "",
    restBetweenSetsSeconds: merged.restBetweenSetsSeconds?.toString() ?? "",
    durationSeconds: merged.durationSeconds?.toString() ?? "",
    weightInputMode: "percent",
  };
}

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { success: showSuccessToast, error: showErrorToast } = useAppToast();
  const todayStr = localTodayString();
  const [selectedDate, setSelectedDate] = React.useState(todayStr);
  const [visibleMonth, setVisibleMonth] = React.useState(todayStr);

  const { rangeStart, rangeEnd } = React.useMemo(
    () => monthRangeFromDateString(visibleMonth),
    [visibleMonth],
  );

  const myItems = useQuery(api.trainingItems.listMyItems);
  const savedItems = useQuery(api.savedItems.listSavedItems);
  const profile = useQuery(api.profiles.getMyProfile);
  const sessionsResult = useQuery(api.trainingSchedule.listCalendarSessionsInRange, {
    rangeStart,
    rangeEnd,
  });

  const addSession = useMutation(api.trainingSchedule.addSession);
  const addRecurringSeries = useMutation(api.trainingSchedule.addRecurringSeries);
  const materializeRecurringOccurrence = useMutation(
    api.trainingSchedule.materializeRecurringOccurrence,
  );
  const cancelRecurringOccurrence = useMutation(api.trainingSchedule.cancelRecurringOccurrence);
  const updateUpcomingSession = useMutation(api.trainingSchedule.updateUpcomingSession);
  const updateRecurringRuleFuture = useMutation(api.trainingSchedule.updateRecurringRuleFuture);
  const removeRecurringRuleFuture = useMutation(api.trainingSchedule.removeRecurringRuleFuture);
  const removeUpcomingSession = useMutation(api.trainingSchedule.removeUpcomingSession);
  const completeSession = useMutation(api.trainingSchedule.completeSession);

  const [selectedItemId, setSelectedItemId] = React.useState<string>("");
  const [scheduleMode, setScheduleMode] = React.useState<"single" | "recurring">("single");
  const [frequency, setFrequency] = React.useState<Frequency>("weekly");
  const [intervalInput, setIntervalInput] = React.useState("1");
  const [weeklyDays, setWeeklyDays] = React.useState<number[]>([dayOfWeekFromDayString(todayStr)]);
  const [endMode, setEndMode] = React.useState<"none" | "3m" | "6m" | "12m">("none");
  const [error, setError] = React.useState<string | null>(null);
  const [scheduleSheetOpen, setScheduleSheetOpen] = React.useState(false);
  const pageBottomPadding = Math.max(screenPadding.paddingBottom, insets.bottom + 48);
  const sheetBottomPadding = Math.max(20, insets.bottom + 24);

  const [editDrafts, setEditDrafts] = React.useState<Record<string, SessionEditDraft>>({});
  const [expandedSessionId, setExpandedSessionId] = React.useState<string | null>(null);
  const [overrideSessionId, setOverrideSessionId] = React.useState<string | null>(null);
  const [overrideError, setOverrideError] = React.useState<string | null>(null);
  const [isSavingOverride, setIsSavingOverride] = React.useState(false);
  const [selectedExercise, setSelectedExercise] = React.useState<{
    exercise: ExerciseDetailItem;
    finalVariables: ExerciseDetailVariables;
  } | null>(null);

  const libraryItems = React.useMemo(() => {
    const byId = new Map<string, { _id: string; title: string }>();
    for (const item of myItems ?? []) {
      byId.set(item._id, { _id: item._id, title: item.title });
    }
    for (const entry of savedItems ?? []) {
      if (!entry.item) continue;
      byId.set(entry.item._id, { _id: entry.item._id, title: entry.item.title });
    }
    return Array.from(byId.values());
  }, [myItems, savedItems]);

  // Keep previous month data visible while the next month is loading.
  const latestSessionsResultRef = React.useRef(sessionsResult);
  React.useEffect(() => {
    if (sessionsResult !== undefined) {
      latestSessionsResultRef.current = sessionsResult;
    }
  }, [sessionsResult]);
  const stableSessionsResult = sessionsResult ?? latestSessionsResultRef.current;
  const isMonthSwitchLoading =
    sessionsResult === undefined && latestSessionsResultRef.current !== undefined;

  const sessions = stableSessionsResult?.sessions ?? [];
  const serverToday = stableSessionsResult?.today ?? dayStringToTimestamp(todayStr);

  React.useEffect(() => {
    setEditDrafts((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const session of sessions) {
        if (next[session._id]) continue;
        next[session._id] = buildEditDraft(session.snapshot.variables, session.overrides);
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [sessions]);

  React.useEffect(() => {
    if (!overrideSessionId) return;
    const stillExists = sessions.some((session) => session._id === overrideSessionId);
    if (!stillExists) {
      setOverrideSessionId(null);
      setOverrideError(null);
    }
  }, [overrideSessionId, sessions]);

  const markedDates = React.useMemo(() => {
    const marks: Record<
      string,
      { marked?: boolean; dotColor?: string; selected?: boolean; selectedColor?: string }
    > = {};
    for (const session of sessions) {
      const key = toDayString(session.scheduledFor);
      const isCompleted = !!session.completedAt;
      const isPast = session.scheduledFor < serverToday && !isCompleted;
      marks[key] = {
        marked: true,
        dotColor: isCompleted
          ? colors.calendar.dotCompleted
          : isPast
            ? colors.calendar.dotPast
            : colors.calendar.dotUpcoming,
      };
    }
    marks[selectedDate] = {
      ...(marks[selectedDate] ?? {}),
      selected: true,
      selectedColor: colors.calendar.selectedBg,
    };
    return marks;
  }, [selectedDate, sessions, serverToday]);

  const selectedDaySessions = React.useMemo(
    () =>
      sessions
        .filter((session) => toDayString(session.scheduledFor) === selectedDate)
        .sort((a, b) => a.scheduledFor - b.scheduledFor),
    [selectedDate, sessions],
  );
  const selectedDayUpcomingSessions = React.useMemo(
    () =>
      selectedDaySessions.filter(
        (session) => !session.completedAt && session.scheduledFor >= serverToday,
      ),
    [selectedDaySessions, serverToday],
  );
  const selectedDayPastCount = selectedDaySessions.length - selectedDayUpcomingSessions.length;
  const overrideSession = React.useMemo(
    () => sessions.find((session) => session._id === overrideSessionId) ?? null,
    [overrideSessionId, sessions],
  );
  const overrideDraft = overrideSession ? editDrafts[overrideSession._id] : undefined;

  const updateSessionDraft = React.useCallback(
    (sessionId: string, patch: Partial<SessionEditDraft>) => {
      setEditDrafts((prev) => {
        const current = prev[sessionId];
        if (!current) return prev;
        return {
          ...prev,
          [sessionId]: { ...current, ...patch },
        };
      });
    },
    [],
  );

  const draftToOverrides = React.useCallback(
    (draft: SessionEditDraft): SessionOverrides | null => {
      const rawWeight = parseOptionalNumber(draft.weight);
      const bodyWeightKg = profile?.bodyWeightKg;
      const convertedWeight =
        rawWeight === undefined
          ? undefined
          : draft.weightInputMode === "percent"
            ? rawWeight
            : bodyWeightKg && bodyWeightKg > 0
              ? Number(((rawWeight / bodyWeightKg) * 100).toFixed(2))
              : null;

      if (convertedWeight === null) {
        return null;
      }

      return {
        weight: convertedWeight,
        reps: parseOptionalNumber(draft.reps),
        sets: parseOptionalNumber(draft.sets),
        restSeconds: parseOptionalNumber(draft.restSeconds),
        restBetweenSetsSeconds: parseOptionalNumber(draft.restBetweenSetsSeconds),
        durationSeconds: parseOptionalNumber(draft.durationSeconds),
      };
    },
    [profile?.bodyWeightKg],
  );

  const handleDraftWeightInputModeChange = React.useCallback(
    (sessionId: string, nextMode: "percent" | "absolute") => {
      setEditDrafts((prev) => {
        const current = prev[sessionId];
        if (!current || current.weightInputMode === nextMode) {
          return prev;
        }
        return {
          ...prev,
          [sessionId]: {
            ...current,
            weight: convertWeightValue(
              current.weight,
              current.weightInputMode,
              nextMode,
              profile?.bodyWeightKg,
            ),
            weightInputMode: nextMode,
          },
        };
      });
    },
    [profile?.bodyWeightKg],
  );

  const resolveConcreteSessionId = React.useCallback(
    async (session: any): Promise<string> => {
      if (!session.isVirtual) {
        return session._id;
      }
      if (!session.recurrenceRuleId) {
        throw new Error("Recurring session reference is missing.");
      }
      const materialized = await materializeRecurringOccurrence({
        ruleId: session.recurrenceRuleId as never,
        scheduledFor: session.scheduledFor,
      });
      if (!materialized?._id) {
        throw new Error("Could not load session.");
      }
      return materialized._id;
    },
    [materializeRecurringOccurrence],
  );

  const handleStartSession = React.useCallback(
    async (session: any) => {
      try {
        const sessionId = await resolveConcreteSessionId(session);
        router.push({ pathname: "/timer", params: { sessionId } });
      } catch (startError) {
        const message = showErrorMessage(startError, "Could not open session timer.");
        showErrorToast("Could not open timer", message);
      }
    },
    [resolveConcreteSessionId, router, showErrorToast],
  );

  const handleCompleteSession = React.useCallback(
    async (session: any) => {
      try {
        const sessionId = await resolveConcreteSessionId(session);
        await completeSession({ sessionId: sessionId as never });
        showSuccessToast("Session marked complete.");
      } catch (completeError) {
        const message = showErrorMessage(completeError, "Could not complete session.");
        showErrorToast("Could not complete session", message);
      }
    },
    [completeSession, resolveConcreteSessionId, showErrorToast, showSuccessToast],
  );

  const openSessionDetails = React.useCallback(
    (snapshot: SessionSnapshot, finalVariables: ExerciseDetailVariables) => {
      setSelectedExercise({
        exercise: {
          title: snapshot.title,
          description: snapshot.description,
          categories: snapshot.categories,
          tags: snapshot.tags,
          trainingType: snapshot.trainingType,
          hangDetails: snapshot.hangDetails,
          difficulty: snapshot.difficulty,
          equipment: snapshot.equipment,
          variables: snapshot.variables,
        },
        finalVariables,
      });
    },
    [],
  );

  const handleDelaySessionByWeek = React.useCallback(
    async (session: any) => {
      try {
        const sessionId = await resolveConcreteSessionId(session);
        await updateUpcomingSession({
          sessionId: sessionId as never,
          scheduledFor: addDays(session.scheduledFor, 7),
          overrides: session.overrides,
        });
        showSuccessToast("Session moved by 7 days.");
      } catch (delayError) {
        const message = showErrorMessage(delayError, "Could not move session.");
        showErrorToast("Could not move session", message);
      }
    },
    [resolveConcreteSessionId, showErrorToast, showSuccessToast, updateUpcomingSession],
  );

  const handleRemoveUpcomingSession = React.useCallback(
    async (session: any) => {
      try {
        if (session.isVirtual) {
          if (!session.recurrenceRuleId) {
            throw new Error("Recurring session reference is missing.");
          }
          await cancelRecurringOccurrence({
            ruleId: session.recurrenceRuleId as never,
            scheduledFor: session.scheduledFor,
          });
        } else {
          await removeUpcomingSession({ sessionId: session._id as never });
        }
        showSuccessToast("Session removed.");
      } catch (removeError) {
        const message = showErrorMessage(removeError, "Could not remove session.");
        showErrorToast("Could not remove session", message);
      }
    },
    [cancelRecurringOccurrence, removeUpcomingSession, showErrorToast, showSuccessToast],
  );

  const handleRemoveRecurringFuture = React.useCallback(
    async (ruleId: string, effectiveFrom: number) => {
      try {
        await removeRecurringRuleFuture({
          ruleId: ruleId as never,
          effectiveFrom,
        });
        showSuccessToast("Recurring sessions deleted.");
      } catch (removeError) {
        const message = showErrorMessage(removeError, "Could not delete recurring sessions.");
        showErrorToast("Could not delete recurring sessions", message);
      }
    },
    [removeRecurringRuleFuture, showErrorToast, showSuccessToast],
  );

  const onAdd = async () => {
    if (!selectedItemId) {
      setError("Select an exercise first.");
      return;
    }
    setError(null);
    const scheduledFor = dayStringToTimestamp(selectedDate);

    try {
      if (scheduleMode === "single") {
        await addSession({ trainingItemId: selectedItemId as never, scheduledFor });
        showSuccessToast("Session added to your plan.");
      } else {
        const interval = Math.max(1, Math.floor(Number(intervalInput) || 1));
        const until =
          endMode === "none"
            ? undefined
            : addDays(scheduledFor, endMode === "3m" ? 90 : endMode === "6m" ? 180 : 365);
        await addRecurringSeries({
          trainingItemId: selectedItemId as never,
          startDate: scheduledFor,
          recurrence: {
            frequency,
            interval,
            byWeekdays: frequency === "weekly" ? weeklyDays : undefined,
            until,
          },
        });
        showSuccessToast("Recurring series created.");
      }
      setScheduleSheetOpen(false);
    } catch (addError) {
      const message = showErrorMessage(addError, "Could not schedule session.");
      setError(message);
      showErrorToast("Could not schedule session", message);
    }
  };

  if (myItems === undefined || savedItems === undefined || stableSessionsResult === undefined) {
    return (
      <Box className="flex-1 items-center justify-center">
        <Text className="text-typography-500">Loading calendar...</Text>
      </Box>
    );
  }

  return (
    <>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.bg }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ ...screenPadding, gap: 16, paddingBottom: pageBottomPadding }}
          style={{ backgroundColor: colors.bg }}
        >
          <PageHeader
            title="Plan"
            rightSlot={
              <Pressable
                onPress={() => setScheduleSheetOpen(true)}
                style={{
                  backgroundColor: colors.primary,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Plus size={16} color="#fff" strokeWidth={2.5} />
                <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>Add session</Text>
              </Pressable>
            }
          />

          <Box
            className="rounded-2xl overflow-hidden"
            style={{
              ...cardShadow,
              backgroundColor: colors.bgCard,
              padding: 8,
              position: "relative",
            }}
          >
            <Calendar
              current={visibleMonth}
              onDayPress={(day) => setSelectedDate(day.dateString)}
              onMonthChange={(month) => setVisibleMonth(month.dateString)}
              markedDates={markedDates}
              theme={calendarTheme}
            />
            {isMonthSwitchLoading ? (
              <Box
                className="flex-row items-center gap-1 rounded-full px-2 py-1"
                style={{
                  position: "absolute",
                  top: 12,
                  right: 12,
                  backgroundColor: "rgba(255, 255, 255, 0.92)",
                }}
              >
                <ActivityIndicator size="small" color={colors.primary} />
                <Text className="text-xs text-typography-500">Updating…</Text>
              </Box>
            ) : null}
          </Box>

          <Box className="gap-3">
            <Box className="flex-row items-center justify-between">
              <Text className="text-lg font-bold text-typography-900">
                {formatDateLabel(selectedDate)}
              </Text>
              {selectedDayPastCount > 0 ? (
                <Text className="text-xs text-typography-400">+{selectedDayPastCount} past</Text>
              ) : null}
            </Box>

            {selectedDayUpcomingSessions.length === 0 ? (
              <Box
                className="rounded-2xl p-5 items-center"
                style={{ ...cardShadow, backgroundColor: colors.bgCard }}
              >
                <Text className="text-typography-500 text-center text-sm">
                  No upcoming sessions on this day.
                </Text>
              </Box>
            ) : null}

            {selectedDayUpcomingSessions.map((session) => {
              const editable = !session.completedAt && session.scheduledFor >= serverToday;
              const isExpanded = expandedSessionId === session._id;
              return (
                <UpcomingSessionCard
                  key={session._id}
                  session={session}
                  isExpanded={isExpanded}
                  onToggle={() => setExpandedSessionId(isExpanded ? null : session._id)}
                  onStart={() => void handleStartSession(session)}
                  onDone={() => void handleCompleteSession(session)}
                  onViewDetails={() =>
                    openSessionDetails(
                      session.snapshot,
                      mergeVariables(session.snapshot.variables, session.overrides),
                    )
                  }
                  startLabel="Timer"
                  startIconSize={14}
                  startButtonTextClassName="font-semibold text-sm"
                  doneButtonTextClassName="text-sm"
                  showReadyBadge={false}
                  expandedContent={
                    editable ? (
                      <Box className="flex-row flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl"
                          onPress={() => {
                            setOverrideError(null);
                            setEditDrafts((prev) => ({
                              ...prev,
                              [session._id]: buildEditDraft(
                                session.snapshot.variables,
                                session.overrides,
                              ),
                            }));
                            setOverrideSessionId(session._id);
                          }}
                        >
                          <ButtonText className="text-xs">Override</ButtonText>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl"
                          onPress={() => void handleDelaySessionByWeek(session)}
                        >
                          <Clock size={12} color={colors.primary} strokeWidth={2} />
                          <ButtonText className="text-xs">+7d</ButtonText>
                        </Button>
                        <Button
                          size="sm"
                          action="negative"
                          variant="outline"
                          className="rounded-xl"
                          onPress={() => void handleRemoveUpcomingSession(session)}
                        >
                          <Trash2 size={12} color={colors.error} strokeWidth={2} />
                          <ButtonText className="text-xs">
                            {session.recurrenceRuleId ? "Remove once" : "Remove"}
                          </ButtonText>
                        </Button>
                        {session.recurrenceRuleId ? (
                          <Button
                            size="sm"
                            action="negative"
                            variant="outline"
                            className="rounded-xl"
                            onPress={() =>
                              void handleRemoveRecurringFuture(
                                session.recurrenceRuleId!,
                                session.scheduledFor,
                              )
                            }
                          >
                            <Trash2 size={12} color={colors.error} strokeWidth={2} />
                            <ButtonText className="text-xs">Delete this & future</ButtonText>
                          </Button>
                        ) : null}
                      </Box>
                    ) : null
                  }
                />
              );
            })}
          </Box>

          <Button
            variant="outline"
            className="rounded-xl"
            onPress={() => router.push("/plan-history")}
          >
            <ButtonText>View Past Sessions</ButtonText>
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>

      <Actionsheet isOpen={scheduleSheetOpen} onClose={() => setScheduleSheetOpen(false)}>
        <ActionsheetBackdrop />
        <ActionsheetContent className="max-h-[90%]">
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>
          <KeyboardAvoidingView
            style={{ width: "100%" }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
              automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
              contentInsetAdjustmentBehavior="automatic"
              style={{ width: "100%" }}
              contentContainerStyle={{
                gap: 12,
                paddingHorizontal: 4,
                paddingBottom: sheetBottomPadding,
              }}
            >
              <Box className="gap-4">
                <Text className="text-xl font-bold text-typography-900">
                  Schedule on {formatDateLabel(selectedDate)}
                </Text>

                <Box className="flex-row gap-2">
                  {(["single", "recurring"] as const).map((mode) => (
                    <Pressable
                      key={mode}
                      onPress={() => setScheduleMode(mode)}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 12,
                        alignItems: "center",
                        backgroundColor:
                          scheduleMode === mode ? colors.primary : colors.borderLight,
                      }}
                    >
                      <Text
                        style={{
                          fontWeight: "600",
                          fontSize: 14,
                          color: scheduleMode === mode ? "#fff" : colors.text,
                        }}
                      >
                        {mode === "single" ? "One-time" : "Recurring"}
                      </Text>
                    </Pressable>
                  ))}
                </Box>

                <Box className="gap-2">
                  <Text className="text-xs font-semibold text-typography-400 uppercase tracking-wide">
                    Exercise
                  </Text>
                  {libraryItems.length > 0 ? (
                    <ScrollView style={{ maxHeight: 120 }} showsVerticalScrollIndicator={false}>
                      <Box className="flex-row flex-wrap gap-2">
                        {libraryItems.map((item) => (
                          <Pressable
                            key={item._id}
                            onPress={() => setSelectedItemId(item._id)}
                            style={{
                              paddingHorizontal: 14,
                              paddingVertical: 8,
                              borderRadius: 20,
                              backgroundColor:
                                selectedItemId === item._id ? colors.primary : colors.borderLight,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 13,
                                fontWeight: "600",
                                color: selectedItemId === item._id ? "#fff" : colors.text,
                              }}
                            >
                              {item.title}
                            </Text>
                          </Pressable>
                        ))}
                      </Box>
                    </ScrollView>
                  ) : (
                    <Box
                      className="rounded-xl p-4 gap-3"
                      style={{ backgroundColor: colors.borderLight }}
                    >
                      <Text className="text-sm text-typography-600">
                        No exercises yet. Create one now, or open the Exercises tab to browse and
                        save.
                      </Text>
                      <Box className="flex-row gap-2">
                        <Button
                          className="flex-1 rounded-xl"
                          onPress={() => {
                            setScheduleSheetOpen(false);
                            router.push("/items/new");
                          }}
                        >
                          <ButtonText className="font-semibold text-sm">Create exercise</ButtonText>
                        </Button>
                        <Button
                          variant="outline"
                          className="flex-1 rounded-xl"
                          onPress={() => {
                            setScheduleSheetOpen(false);
                            router.push("/tabs/discover");
                          }}
                        >
                          <ButtonText className="text-sm">Open Exercises</ButtonText>
                        </Button>
                      </Box>
                    </Box>
                  )}
                </Box>

                {scheduleMode === "recurring" ? (
                  <Box className="gap-3">
                    <Text className="text-xs font-semibold text-typography-400 uppercase tracking-wide">
                      Recurrence
                    </Text>
                    <Box className="flex-row gap-2">
                      {(["daily", "weekly", "monthly"] as const).map((option) => (
                        <Pressable
                          key={option}
                          onPress={() => setFrequency(option)}
                          style={{
                            flex: 1,
                            paddingVertical: 8,
                            borderRadius: 10,
                            alignItems: "center",
                            backgroundColor:
                              frequency === option ? colors.primary : colors.borderLight,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: "600",
                              color: frequency === option ? "#fff" : colors.text,
                            }}
                          >
                            {option.charAt(0).toUpperCase() + option.slice(1)}
                          </Text>
                        </Pressable>
                      ))}
                    </Box>
                    <TextInput
                      value={intervalInput}
                      onChangeText={setIntervalInput}
                      placeholder="Interval (e.g. every 1 week)"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      style={inputStyle}
                    />
                    {frequency === "weekly" ? (
                      <Box className="flex-row flex-wrap gap-2">
                        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((label, dayIndex) => (
                          <Pressable
                            key={label}
                            onPress={() =>
                              setWeeklyDays((prev) =>
                                prev.includes(dayIndex)
                                  ? prev.filter((v) => v !== dayIndex)
                                  : [...prev, dayIndex],
                              )
                            }
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 20,
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor: weeklyDays.includes(dayIndex)
                                ? colors.primary
                                : colors.borderLight,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 12,
                                fontWeight: "700",
                                color: weeklyDays.includes(dayIndex) ? "#fff" : colors.text,
                              }}
                            >
                              {label}
                            </Text>
                          </Pressable>
                        ))}
                      </Box>
                    ) : null}
                    <Box className="flex-row gap-2 flex-wrap">
                      {(
                        [
                          ["none", "No end"],
                          ["3m", "3 months"],
                          ["6m", "6 months"],
                          ["12m", "1 year"],
                        ] as const
                      ).map(([mode, label]) => (
                        <Pressable
                          key={mode}
                          onPress={() => setEndMode(mode as typeof endMode)}
                          style={{
                            paddingHorizontal: 14,
                            paddingVertical: 8,
                            borderRadius: 20,
                            backgroundColor: endMode === mode ? colors.primary : colors.borderLight,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: "600",
                              color: endMode === mode ? "#fff" : colors.text,
                            }}
                          >
                            {label}
                          </Text>
                        </Pressable>
                      ))}
                    </Box>
                    {endMode === "none" ? (
                      <Text className="text-xs text-typography-500">
                        No-end series are generated in a rolling window to keep scheduling scalable.
                      </Text>
                    ) : null}
                  </Box>
                ) : null}

                <Box className="rounded-xl p-3" style={{ backgroundColor: colors.borderLight }}>
                  <Text className="text-sm text-typography-600">
                    You can have overrides on the parameter after you schedule your session.
                  </Text>
                </Box>

                <Box className="flex-row gap-2">
                  <Button className="flex-1 rounded-xl" onPress={() => void onAdd()}>
                    <ButtonText className="font-semibold">
                      {scheduleMode === "single" ? "Add session" : "Create series"}
                    </ButtonText>
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    onPress={() => setScheduleSheetOpen(false)}
                  >
                    <ButtonText>Cancel</ButtonText>
                  </Button>
                </Box>
                {error ? (
                  <Box className="rounded-xl p-3" style={{ backgroundColor: colors.errorBg }}>
                    <Text className="text-error-600 text-sm">{error}</Text>
                  </Box>
                ) : null}
              </Box>
            </ScrollView>
          </KeyboardAvoidingView>
        </ActionsheetContent>
      </Actionsheet>

      <Actionsheet
        isOpen={!!overrideSession}
        onClose={() => {
          setOverrideSessionId(null);
          setOverrideError(null);
        }}
      >
        <ActionsheetBackdrop />
        <ActionsheetContent className="min-h-[72%] max-h-[92%]">
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>
          <KeyboardAvoidingView
            style={{ width: "100%" }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
              automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
              contentInsetAdjustmentBehavior="automatic"
              style={{ width: "100%" }}
              contentContainerStyle={{
                gap: 12,
                paddingHorizontal: 4,
                paddingBottom: sheetBottomPadding,
              }}
            >
              {overrideSession && overrideDraft ? (
                <Box className="gap-4">
                  <Text className="text-xl font-bold text-typography-900">Override session</Text>

                  <Box style={[sectionCardStyle, sectionOverlayContainerStyle]}>
                    <Text className="text-base font-semibold text-typography-900">Essentials</Text>
                    <TextInput
                      editable={false}
                      value={overrideSession.snapshot.title}
                      style={{ ...inputStyle, color: colors.textMuted }}
                    />
                    <TextInput
                      editable={false}
                      value={
                        trainingTypeLabel[overrideSession.snapshot.trainingType ?? ""] ?? "Not set"
                      }
                      style={{ ...inputStyle, color: colors.textMuted }}
                    />
                    <TextInput
                      editable={false}
                      value={
                        overrideSession.snapshot.categories?.length &&
                        overrideSession.snapshot.categories.some((entry: string) => !!entry.trim())
                          ? overrideSession.snapshot.categories.join(", ")
                          : "Not set"
                      }
                      style={{ ...inputStyle, color: colors.textMuted }}
                    />
                    <TextInput
                      editable={false}
                      multiline
                      value={overrideSession.snapshot.description ?? "Not set"}
                      style={{
                        ...inputStyle,
                        color: colors.textMuted,
                        minHeight: 72,
                        textAlignVertical: "top",
                      }}
                    />
                    <OverrideUnavailableOverlay />
                  </Box>

                  <Box style={[sectionCardStyle, sectionOverlayContainerStyle]}>
                    <Text className="text-base font-semibold text-typography-900">Difficulty</Text>
                    <Box className="flex-row gap-2">
                      {(["beginner", "intermediate", "advanced"] as const).map((difficulty) => (
                        <Pressable
                          key={difficulty}
                          disabled
                          style={{
                            flex: 1,
                            paddingVertical: 10,
                            borderRadius: 12,
                            alignItems: "center",
                            backgroundColor:
                              overrideSession.snapshot.difficulty === difficulty
                                ? colors.primary
                                : colors.borderLight,
                            opacity: 0.6,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: "600",
                              color:
                                overrideSession.snapshot.difficulty === difficulty
                                  ? "#fff"
                                  : colors.text,
                              textTransform: "capitalize",
                            }}
                          >
                            {difficulty}
                          </Text>
                        </Pressable>
                      ))}
                    </Box>
                    <OverrideUnavailableOverlay />
                  </Box>

                  <Box style={sectionCardStyle}>
                    <Text className="text-base font-semibold text-typography-900">
                      Workout Parameters
                    </Text>
                    <Text className="text-xs text-typography-500">
                      Reps are work cycles per set. Sets are repeated rounds. Rep duration is work
                      time per rep; rest values are recovery between reps and sets.
                    </Text>
                    <Box className="flex-row gap-2">
                      <Box className="flex-1">
                        <Text className="text-xs text-typography-500 mb-1">Reps</Text>
                        <TextInput
                          placeholder="—"
                          placeholderTextColor={colors.textMuted}
                          value={overrideDraft.reps}
                          onChangeText={(value) =>
                            updateSessionDraft(overrideSession._id, { reps: value })
                          }
                          keyboardType="numeric"
                          style={inputStyle}
                        />
                      </Box>
                      <Box className="flex-1">
                        <Text className="text-xs text-typography-500 mb-1">Sets</Text>
                        <TextInput
                          placeholder="—"
                          placeholderTextColor={colors.textMuted}
                          value={overrideDraft.sets}
                          onChangeText={(value) =>
                            updateSessionDraft(overrideSession._id, { sets: value })
                          }
                          keyboardType="numeric"
                          style={inputStyle}
                        />
                      </Box>
                    </Box>
                    <Box className="flex-row gap-2">
                      <Box className="flex-1">
                        <Text className="text-xs text-typography-500 mb-1">Rep duration (s)</Text>
                        <TextInput
                          placeholder="—"
                          placeholderTextColor={colors.textMuted}
                          value={overrideDraft.durationSeconds}
                          onChangeText={(value) =>
                            updateSessionDraft(overrideSession._id, { durationSeconds: value })
                          }
                          keyboardType="numeric"
                          style={inputStyle}
                        />
                      </Box>
                    </Box>
                    <Box className="flex-row gap-2">
                      <Box className="flex-1">
                        <Text className="text-xs text-typography-500 mb-1">
                          Rest between reps (s)
                        </Text>
                        <TextInput
                          placeholder="—"
                          placeholderTextColor={colors.textMuted}
                          value={overrideDraft.restSeconds}
                          onChangeText={(value) =>
                            updateSessionDraft(overrideSession._id, { restSeconds: value })
                          }
                          keyboardType="numeric"
                          style={inputStyle}
                        />
                      </Box>
                      <Box className="flex-1">
                        <Text className="text-xs text-typography-500 mb-1">
                          Rest between sets (s)
                        </Text>
                        <TextInput
                          placeholder="Defaults to rep rest"
                          placeholderTextColor={colors.textMuted}
                          value={overrideDraft.restBetweenSetsSeconds}
                          onChangeText={(value) =>
                            updateSessionDraft(overrideSession._id, {
                              restBetweenSetsSeconds: value,
                            })
                          }
                          keyboardType="numeric"
                          style={inputStyle}
                        />
                      </Box>
                    </Box>
                  </Box>

                  {overrideSession.snapshot.trainingType === "hang" ? (
                    <Box style={[sectionCardStyle, sectionOverlayContainerStyle]}>
                      <Text className="text-base font-semibold text-typography-900">
                        Hang Details
                      </Text>
                      <Box className="flex-row gap-2">
                        {HANG_EQUIPMENT_OPTIONS.map((option) => (
                          <Pressable
                            key={option}
                            disabled
                            style={{
                              flex: 1,
                              paddingVertical: 10,
                              borderRadius: 12,
                              alignItems: "center",
                              backgroundColor:
                                overrideSession.snapshot.hangDetails?.apparatus === option
                                  ? colors.primary
                                  : colors.borderLight,
                              opacity: 0.6,
                            }}
                          >
                            <Text
                              style={{
                                color:
                                  overrideSession.snapshot.hangDetails?.apparatus === option
                                    ? "#fff"
                                    : colors.text,
                                fontSize: 13,
                                fontWeight: "600",
                              }}
                            >
                              {option}
                            </Text>
                          </Pressable>
                        ))}
                      </Box>
                      {overrideSession.snapshot.hangDetails?.apparatus === "fingerboard" ? (
                        <>
                          <Box className="flex-row gap-2 flex-wrap">
                            {HANG_EDGE_MM_OPTIONS.map((edge) => (
                              <Pressable
                                key={edge}
                                disabled
                                style={{
                                  paddingHorizontal: 12,
                                  paddingVertical: 8,
                                  borderRadius: 999,
                                  backgroundColor:
                                    overrideSession.snapshot.hangDetails?.edgeSizeMm === edge
                                      ? colors.primary
                                      : colors.borderLight,
                                  opacity: 0.6,
                                }}
                              >
                                <Text
                                  style={{
                                    color:
                                      overrideSession.snapshot.hangDetails?.edgeSizeMm === edge
                                        ? "#fff"
                                        : colors.text,
                                    fontSize: 12,
                                    fontWeight: "600",
                                  }}
                                >
                                  {edge}mm
                                </Text>
                              </Pressable>
                            ))}
                          </Box>
                          <Box className="flex-row gap-2 flex-wrap">
                            {HANG_CRIMP_TYPES.map((crimp) => (
                              <Pressable
                                key={crimp}
                                disabled
                                style={{
                                  paddingHorizontal: 12,
                                  paddingVertical: 8,
                                  borderRadius: 999,
                                  backgroundColor:
                                    overrideSession.snapshot.hangDetails?.crimpType === crimp
                                      ? colors.primary
                                      : colors.borderLight,
                                  opacity: 0.6,
                                }}
                              >
                                <Text
                                  style={{
                                    color:
                                      overrideSession.snapshot.hangDetails?.crimpType === crimp
                                        ? "#fff"
                                        : colors.text,
                                    fontSize: 12,
                                    fontWeight: "600",
                                  }}
                                >
                                  {crimp}
                                </Text>
                              </Pressable>
                            ))}
                          </Box>
                        </>
                      ) : null}
                      <OverrideUnavailableOverlay />
                    </Box>
                  ) : null}

                  <Box style={sectionCardStyle}>
                    <Text className="text-base font-semibold text-typography-900">Load</Text>
                    <Text className="text-xs text-typography-500">
                      Usually for hang exercises: 100% means no extra weight, 80% means assisted,
                      and 120% means added weight.
                    </Text>
                    {profile?.bodyWeightKg ? (
                      <Text className="text-xs text-typography-500">
                        Your body weight: {profile.bodyWeightKg}kg
                      </Text>
                    ) : null}
                    <Box className="flex-row gap-2">
                      <Pressable
                        onPress={() =>
                          handleDraftWeightInputModeChange(overrideSession._id, "percent")
                        }
                        style={{
                          flex: 1,
                          borderRadius: 12,
                          paddingVertical: 10,
                          alignItems: "center",
                          backgroundColor:
                            overrideDraft.weightInputMode === "percent"
                              ? colors.primary
                              : colors.borderLight,
                        }}
                      >
                        <Text
                          style={{
                            color:
                              overrideDraft.weightInputMode === "percent" ? "#fff" : colors.text,
                            fontWeight: "600",
                            fontSize: 13,
                          }}
                        >
                          % bodyweight
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() =>
                          handleDraftWeightInputModeChange(overrideSession._id, "absolute")
                        }
                        style={{
                          flex: 1,
                          borderRadius: 12,
                          paddingVertical: 10,
                          alignItems: "center",
                          backgroundColor:
                            overrideDraft.weightInputMode === "absolute"
                              ? colors.primary
                              : colors.borderLight,
                        }}
                      >
                        <Text
                          style={{
                            color:
                              overrideDraft.weightInputMode === "absolute" ? "#fff" : colors.text,
                            fontWeight: "600",
                            fontSize: 13,
                          }}
                        >
                          kg absolute
                        </Text>
                      </Pressable>
                    </Box>
                    <TextInput
                      placeholder={
                        overrideDraft.weightInputMode === "percent" ? "Load (% BW)" : "Load (kg)"
                      }
                      placeholderTextColor={colors.textMuted}
                      value={overrideDraft.weight}
                      onChangeText={(value) =>
                        updateSessionDraft(overrideSession._id, { weight: value })
                      }
                      keyboardType="numeric"
                      style={inputStyle}
                    />
                  </Box>

                  <Box style={[sectionCardStyle, sectionOverlayContainerStyle]}>
                    <Text className="text-base font-semibold text-typography-900">
                      Equipment & Tags
                    </Text>
                    <Box className="flex-row flex-wrap gap-2">
                      {overrideSession.snapshot.equipment.length > 0 ? (
                        overrideSession.snapshot.equipment.map((entry: string) => (
                          <Box
                            key={entry}
                            className="rounded-full px-2.5 py-1"
                            style={{ backgroundColor: colors.borderLight, opacity: 0.6 }}
                          >
                            <Text className="text-xs text-typography-600">{entry}</Text>
                          </Box>
                        ))
                      ) : (
                        <Text className="text-xs text-typography-500">No equipment tags</Text>
                      )}
                    </Box>
                    <Box className="flex-row flex-wrap gap-2">
                      {overrideSession.snapshot.tags.length > 0 ? (
                        overrideSession.snapshot.tags.map((tag: string) => (
                          <Box
                            key={tag}
                            className="rounded-full px-2.5 py-1"
                            style={{ backgroundColor: colors.borderLight, opacity: 0.6 }}
                          >
                            <Text className="text-xs text-typography-600">{tag}</Text>
                          </Box>
                        ))
                      ) : (
                        <Text className="text-xs text-typography-500">No tags</Text>
                      )}
                    </Box>
                    <OverrideUnavailableOverlay />
                  </Box>

                  <Box className="gap-2">
                    <Button
                      className="rounded-xl"
                      disabled={isSavingOverride}
                      onPress={async () => {
                        setOverrideError(null);
                        const overrides = draftToOverrides(overrideDraft);
                        if (!overrides) {
                          setOverrideError(
                            "Body weight is required before saving kg loads. Add body weight in Profile or switch to % bodyweight.",
                          );
                          return;
                        }
                        setIsSavingOverride(true);
                        try {
                          const sessionId = await resolveConcreteSessionId(overrideSession);
                          await updateUpcomingSession({
                            sessionId: sessionId as never,
                            overrides,
                          });
                          setOverrideSessionId(null);
                          showSuccessToast("Session override saved.");
                        } catch (saveError) {
                          const message = showErrorMessage(
                            saveError,
                            "Could not save session override.",
                          );
                          setOverrideError(message);
                          showErrorToast("Could not save override", message);
                        } finally {
                          setIsSavingOverride(false);
                        }
                      }}
                    >
                      <ButtonText className="font-semibold">
                        {isSavingOverride ? "Saving..." : "Save for this session"}
                      </ButtonText>
                    </Button>
                    {overrideSession.recurrenceRuleId ? (
                      <>
                        <Button
                          variant="outline"
                          className="rounded-xl"
                          disabled={isSavingOverride}
                          onPress={async () => {
                            setOverrideError(null);
                            const overrides = draftToOverrides(overrideDraft);
                            if (!overrides) {
                              setOverrideError(
                                "Body weight is required before saving kg loads. Add body weight in Profile or switch to % bodyweight.",
                              );
                              return;
                            }
                            setIsSavingOverride(true);
                            try {
                              await updateRecurringRuleFuture({
                                ruleId: overrideSession.recurrenceRuleId!,
                                effectiveFrom: overrideSession.scheduledFor,
                                overrides,
                              });
                              setOverrideSessionId(null);
                              showSuccessToast("Future sessions updated.");
                            } catch (saveError) {
                              const message = showErrorMessage(
                                saveError,
                                "Could not save recurring overrides.",
                              );
                              setOverrideError(message);
                              showErrorToast("Could not save recurring override", message);
                            } finally {
                              setIsSavingOverride(false);
                            }
                          }}
                        >
                          <ButtonText>Save for this and future sessions</ButtonText>
                        </Button>
                        <Button
                          variant="outline"
                          action="negative"
                          className="rounded-xl"
                          disabled={isSavingOverride}
                          onPress={async () => {
                            setOverrideError(null);
                            setIsSavingOverride(true);
                            try {
                              await removeRecurringRuleFuture({
                                ruleId: overrideSession.recurrenceRuleId! as never,
                                effectiveFrom: overrideSession.scheduledFor,
                              });
                              setOverrideSessionId(null);
                              showSuccessToast("Recurring sessions deleted.");
                            } catch (removeError) {
                              const message = showErrorMessage(
                                removeError,
                                "Could not delete recurring sessions.",
                              );
                              setOverrideError(message);
                              showErrorToast("Could not delete recurring sessions", message);
                            } finally {
                              setIsSavingOverride(false);
                            }
                          }}
                        >
                          <ButtonText>Delete this and future sessions</ButtonText>
                        </Button>
                      </>
                    ) : null}
                    <Button
                      variant="outline"
                      className="rounded-xl"
                      onPress={() => {
                        setOverrideSessionId(null);
                        setOverrideError(null);
                      }}
                    >
                      <ButtonText>Cancel</ButtonText>
                    </Button>
                  </Box>

                  {overrideError ? (
                    <Box className="rounded-xl p-3" style={{ backgroundColor: colors.errorBg }}>
                      <Text className="text-error-600 text-sm">{overrideError}</Text>
                    </Box>
                  ) : null}
                </Box>
              ) : null}
            </ScrollView>
          </KeyboardAvoidingView>
        </ActionsheetContent>
      </Actionsheet>

      <ExerciseDetailsSheet
        isOpen={!!selectedExercise}
        onClose={() => setSelectedExercise(null)}
        exercise={selectedExercise?.exercise ?? null}
        finalVariables={selectedExercise?.finalVariables}
        bodyWeightKg={profile?.bodyWeightKg ?? undefined}
      />
    </>
  );
}
