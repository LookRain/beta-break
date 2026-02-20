import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text as RNText,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { useNavigation } from "@react-navigation/native";
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
  ActionsheetItem,
  ActionsheetItemText,
} from "@/components/ui/actionsheet";
import { Plus, CheckCircle2, Zap, ChevronDown, ChevronRight } from "lucide-react-native";
import { SessionCard } from "@/components/session-card";
import { UpcomingSessionCard } from "@/components/upcoming-session-card";
import { PageHeader } from "@/components/page-header";
import { colors, cardShadow, inputStyle, screenPadding } from "@/lib/theme";
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

function startOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function monthRangeFor(timestamp: number): { rangeStart: number; rangeEnd: number } {
  const date = new Date(timestamp);
  const rangeStart = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
  const rangeEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
  return { rangeStart, rangeEnd };
}

function toDayString(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function mergeVariables(
  base: {
    weight?: number;
    reps?: number;
    sets?: number;
    restSeconds?: number;
    restBetweenSetsSeconds?: number;
    durationSeconds?: number;
  },
  overrides: {
    weight?: number;
    reps?: number;
    sets?: number;
    restSeconds?: number;
    restBetweenSetsSeconds?: number;
    durationSeconds?: number;
  },
) {
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

export default function TrainScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { success: showSuccessToast, error: showErrorToast } = useAppToast();
  const today = startOfDay(Date.now());
  const tomorrow = today + 24 * 60 * 60 * 1000;
  const { rangeStart, rangeEnd } = React.useMemo(() => monthRangeFor(today), [today]);

  const sessionsResult = useQuery(api.trainingSchedule.listCalendarSessionsInRange, {
    rangeStart,
    rangeEnd,
  });
  const myItems = useQuery(api.trainingItems.listMyItems);
  const savedItems = useQuery(api.savedItems.listSavedItems);
  const profile = useQuery(api.profiles.getMyProfile);

  const startImpromptuSession = useMutation(api.trainingSchedule.startImpromptuSession);
  const completeSession = useMutation(api.trainingSchedule.completeSession);
  const updateUpcomingSession = useMutation(api.trainingSchedule.updateUpcomingSession);
  const updateRecurringRuleFuture = useMutation(api.trainingSchedule.updateRecurringRuleFuture);
  const removeRecurringRuleFuture = useMutation(api.trainingSchedule.removeRecurringRuleFuture);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [dialogError, setDialogError] = React.useState<string | null>(null);
  const [showCompleted, setShowCompleted] = React.useState(false);
  const [expandedSessionId, setExpandedSessionId] = React.useState<string | null>(null);
  const [editDrafts, setEditDrafts] = React.useState<Record<string, SessionEditDraft>>({});
  const [overrideSessionId, setOverrideSessionId] = React.useState<string | null>(null);
  const [overrideError, setOverrideError] = React.useState<string | null>(null);
  const [isSavingOverride, setIsSavingOverride] = React.useState(false);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => router.push("/items/new")}
          style={{ paddingHorizontal: 8, paddingVertical: 4 }}
        >
          <Plus size={22} color={colors.primary} strokeWidth={2.5} />
        </Pressable>
      ),
    });
  }, [navigation, router]);

  const todaySessions = React.useMemo(
    () =>
      (sessionsResult?.sessions ?? [])
        .filter((session) => session.scheduledFor >= today && session.scheduledFor < tomorrow)
        .sort((a, b) => a.scheduledFor - b.scheduledFor),
    [sessionsResult?.sessions, today, tomorrow],
  );

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

  const startImpromptuNow = async (trainingItemId: string) => {
    setDialogError(null);
    try {
      const session = await startImpromptuSession({ trainingItemId: trainingItemId as never });
      setDialogOpen(false);
      showSuccessToast("Session started.");
      if (session?._id) {
        router.push({ pathname: "/timer", params: { sessionId: session._id } });
      }
    } catch (error) {
      const message = showErrorMessage(error, "Could not start impromptu session.");
      setDialogError(message);
      showErrorToast("Could not start session", message);
    }
  };

  const completedCount = todaySessions.filter((s) => s.completedAt).length;
  const pendingCount = todaySessions.filter((s) => !s.completedAt).length;
  const pendingSessions = todaySessions.filter((s) => !s.completedAt);
  const completedSessions = todaySessions.filter((s) => !!s.completedAt);
  const overrideSession = React.useMemo(
    () => pendingSessions.find((session) => session._id === overrideSessionId) ?? null,
    [overrideSessionId, pendingSessions],
  );
  const overrideDraft = overrideSession ? editDrafts[overrideSession._id] : undefined;

  React.useEffect(() => {
    setEditDrafts((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const session of pendingSessions) {
        if (next[session._id]) continue;
        next[session._id] = buildEditDraft(session.snapshot.variables, session.overrides);
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [pendingSessions]);

  React.useEffect(() => {
    if (!overrideSessionId) return;
    const stillExists = pendingSessions.some((session) => session._id === overrideSessionId);
    if (!stillExists) {
      setOverrideSessionId(null);
      setOverrideError(null);
    }
  }, [overrideSessionId, pendingSessions]);

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

  const handleCompleteSession = React.useCallback(
    async (sessionId: string) => {
      try {
        await completeSession({ sessionId: sessionId as never });
        showSuccessToast("Session marked complete.");
      } catch (completeError) {
        const message = showErrorMessage(completeError, "Could not complete session.");
        showErrorToast("Could not complete session", message);
      }
    },
    [completeSession, showErrorToast, showSuccessToast],
  );

  if (sessionsResult === undefined || myItems === undefined || savedItems === undefined) {
    return (
      <Box className="flex-1 items-center justify-center">
        <Text className="text-typography-500">Loading...</Text>
      </Box>
    );
  }

  return (
    <>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustContentInsets={Platform.OS === "ios"}
        contentContainerStyle={{ ...screenPadding, gap: 20 }}
        style={{ backgroundColor: colors.bg }}
      >
        <PageHeader title="Today's Training" subtitle={toDayString(today)} />

        {todaySessions.length > 0 ? (
          <Box className="flex-row gap-3">
            <Box
              className="flex-1 rounded-2xl p-4 items-center"
              style={{ backgroundColor: colors.primaryBg }}
            >
              <Text className="text-2xl font-bold" style={{ color: colors.primary }}>
                {pendingCount}
              </Text>
              <Text className="text-xs font-semibold text-typography-500 mt-1">REMAINING</Text>
            </Box>
            <Box
              className="flex-1 rounded-2xl p-4 items-center"
              style={{ backgroundColor: colors.successBg }}
            >
              <Text className="text-2xl font-bold" style={{ color: colors.success }}>
                {completedCount}
              </Text>
              <Text className="text-xs font-semibold text-typography-500 mt-1">COMPLETED</Text>
            </Box>
          </Box>
        ) : null}

        <Pressable
          onPress={() => setDialogOpen(true)}
          style={{
            backgroundColor: colors.primary,
            borderRadius: 14,
            paddingVertical: 14,
            paddingHorizontal: 20,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
          }}
        >
          <Zap size={20} color="#fff" strokeWidth={2.5} />
          <RNText style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>Quick Start</RNText>
        </Pressable>

        <Box className="gap-3">
          <Text className="text-lg font-bold text-typography-900">Scheduled Sessions</Text>
          {todaySessions.length === 0 ? (
            <Box
              className="rounded-2xl p-6 items-center gap-2"
              style={{ ...cardShadow, backgroundColor: colors.bgCard }}
            >
              <Text className="text-typography-500 text-center">
                No sessions planned for today.
              </Text>
              <Button variant="link" onPress={() => router.push("/tabs/calendar")}>
                <ButtonText className="font-semibold">Go to calendar</ButtonText>
              </Button>
            </Box>
          ) : null}
          {pendingSessions.map((session) => {
            const isExpanded = expandedSessionId === session._id;
            const draft = editDrafts[session._id];
            return (
              <UpcomingSessionCard
                key={session._id}
                session={session}
                isExpanded={isExpanded}
                onToggle={() => setExpandedSessionId(isExpanded ? null : session._id)}
                onStart={() =>
                  router.push({ pathname: "/timer", params: { sessionId: session._id } })
                }
                onDone={() => void handleCompleteSession(session._id)}
                expandedContent={
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
                    {draft?.weightInputMode === "absolute" && !profile?.bodyWeightKg ? (
                      <Text className="text-xs text-error-600">
                        Add body weight in Profile to save kg loads.
                      </Text>
                    ) : null}
                  </Box>
                }
              />
            );
          })}

          {completedSessions.length > 0 ? (
            <Box className="gap-2 pt-1">
              <Pressable
                onPress={() => setShowCompleted((prev) => !prev)}
                style={{
                  ...cardShadow,
                  backgroundColor: colors.bgCard,
                  borderRadius: 14,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Text className="font-semibold text-typography-900">
                  Completed sessions ({completedSessions.length})
                </Text>
                {showCompleted ? (
                  <ChevronDown size={18} color={colors.textMuted} strokeWidth={2.2} />
                ) : (
                  <ChevronRight size={18} color={colors.textMuted} strokeWidth={2.2} />
                )}
              </Pressable>

              {showCompleted
                ? completedSessions.map((session) => {
                    const final = mergeVariables(session.snapshot.variables, session.overrides);
                    const isExpanded = expandedSessionId === session._id;
                    return (
                      <Pressable
                        key={session._id}
                        onPress={() => setExpandedSessionId(isExpanded ? null : session._id)}
                      >
                        <SessionCard
                          snapshot={session.snapshot}
                          finalVariables={final}
                          statusBadge={
                            <Box className="flex-row items-center gap-2">
                              <Box
                                className="flex-row items-center gap-1 rounded-full px-2.5 py-1"
                                style={{ backgroundColor: colors.successBg }}
                              >
                                <CheckCircle2 size={14} color={colors.success} strokeWidth={2.5} />
                                <Text
                                  className="text-xs font-semibold"
                                  style={{ color: colors.success }}
                                >
                                  Done
                                </Text>
                              </Box>
                              <ChevronRight
                                size={18}
                                color={colors.textMuted}
                                strokeWidth={2}
                                style={{ transform: [{ rotate: isExpanded ? "90deg" : "0deg" }] }}
                              />
                            </Box>
                          }
                        >
                          {isExpanded ? (
                            <Text className="text-xs text-typography-500">Completed session.</Text>
                          ) : null}
                        </SessionCard>
                      </Pressable>
                    );
                  })
                : null}
            </Box>
          ) : null}
        </Box>
      </ScrollView>

      <Actionsheet isOpen={dialogOpen} onClose={() => setDialogOpen(false)}>
        <ActionsheetBackdrop />
        <ActionsheetContent className="max-h-[80%]">
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>
          <Text className="w-full text-xl font-bold text-typography-900 px-4 pb-3 pt-1">
            Choose an exercise
          </Text>
          <ScrollView style={{ width: "100%", maxHeight: 420 }}>
            <Box className="gap-1 w-full px-1">
              {libraryItems.map((item) => (
                <ActionsheetItem
                  key={item._id}
                  onPress={() => void startImpromptuNow(item._id)}
                  className="rounded-xl"
                >
                  <ActionsheetItemText className="font-medium">{item.title}</ActionsheetItemText>
                </ActionsheetItem>
              ))}
              {libraryItems.length === 0 ? (
                <Box
                  className="rounded-xl p-4 gap-3 mx-3 my-2"
                  style={{ backgroundColor: colors.borderLight }}
                >
                  <Text className="text-typography-600 text-sm">
                    No exercises yet. Create one now, or open the Exercises tab to browse and save.
                  </Text>
                  <Box className="flex-row gap-2">
                    <Button
                      className="flex-1 rounded-xl"
                      onPress={() => {
                        setDialogOpen(false);
                        router.push("/items/new");
                      }}
                    >
                      <ButtonText className="font-semibold text-sm">Create exercise</ButtonText>
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 rounded-xl"
                      onPress={() => {
                        setDialogOpen(false);
                        router.push("/tabs/discover");
                      }}
                    >
                      <ButtonText className="text-sm">Open Exercises</ButtonText>
                    </Button>
                  </Box>
                </Box>
              ) : null}
            </Box>
          </ScrollView>
          {dialogError ? (
            <Text className="text-error-600 w-full px-4 pt-2">{dialogError}</Text>
          ) : null}
          <Button
            variant="outline"
            onPress={() => setDialogOpen(false)}
            className="w-full mt-3 rounded-xl"
          >
            <ButtonText>Cancel</ButtonText>
          </Button>
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
              contentContainerStyle={{ gap: 12, paddingHorizontal: 4, paddingBottom: 20 }}
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
                          : overrideSession.snapshot.category || "Not set"
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
                          await updateUpcomingSession({
                            sessionId: overrideSession._id,
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
    </>
  );
}
