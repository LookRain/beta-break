import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useKeepAwake } from "expo-keep-awake";
import { useMutation, useQuery } from "convex/react";
import { Text } from "@/components/ui/text";
import { api } from "@/convex/_generated/api";
import { Pause, Play, SkipForward, X, Check, ChevronDown, ChevronRight } from "lucide-react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  withRepeat,
  withSequence,
  cancelAnimation,
  interpolateColor,
  Easing,
} from "react-native-reanimated";
import { soundManager } from "@/lib/sounds";
import { colors } from "@/lib/theme";

type TimerPhase = "prep" | "rep" | "rest" | "completed";
type RestPhaseKind = "between_reps" | "between_sets" | null;

const PHASE_THEME = {
  prep: { accent: colors.timer.rest, bg: colors.timer.restBg, track: colors.timer.restTrack },
  rep: { accent: colors.timer.work, bg: colors.timer.workBg, track: colors.timer.workTrack },
  rest: { accent: colors.timer.rest, bg: colors.timer.restBg, track: colors.timer.restTrack },
  completed: {
    accent: colors.timer.complete,
    bg: colors.timer.completeBg,
    track: colors.timer.completeTrack,
  },
} as const;

const RING_SIZE = 240;
const RING_STROKE = 8;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const COUNTDOWN_BEEP_THRESHOLD = 3;
const WORK_TICK_THRESHOLD = 5;
const REST_BREATHE_THRESHOLD = 5000;
const COMPLETION_DELAY_MS = 3500;
const PREP_PHASE_SECONDS = 5;

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function clampPositiveInt(value: number | undefined, fallback: number): number {
  if (!value || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.floor(value));
}

function describeLoad(
  trainingType: "hang" | "weight_training" | "climbing" | "others" | undefined,
  weight: number | undefined,
  bodyWeightKg: number | undefined,
): string {
  if (weight === undefined) return "Not set";
  if (!trainingType) return `${weight}kg`;
  if (weight > 100) {
    if (bodyWeightKg && bodyWeightKg > 0) {
      const additionalKg = Number((((weight - 100) / 100) * bodyWeightKg).toFixed(1));
      return `Additional Weight +${additionalKg}kg`;
    }
    return `Additional Weight +${Number((weight - 100).toFixed(1))}% BW`;
  }
  return `${weight}% BW`;
}

const TRAINING_TYPE_LABEL: Record<string, string> = {
  hang: "Hang",
  weight_training: "Weight training",
  climbing: "Climbing",
  others: "Others",
};

export default function TimerScreen() {
  useKeepAwake();
  const getNowMs = React.useCallback(
    () => (typeof performance !== "undefined" ? performance.now() : Date.now()),
    [],
  );
  const router = useRouter();
  const params = useLocalSearchParams<{ sessionId?: string | string[] }>();
  const sessionIdParam = Array.isArray(params.sessionId) ? params.sessionId[0] : params.sessionId;
  const sessionId = sessionIdParam ?? null;

  const session = useQuery(
    api.trainingSchedule.getSessionById,
    sessionId ? { sessionId: sessionId as never } : "skip",
  );
  const profile = useQuery(api.profiles.getMyProfile);
  const startSessionExecution = useMutation(api.trainingLogs.startSessionExecution);
  const appendExecutionStep = useMutation(api.trainingLogs.appendExecutionStep);
  const finishSessionExecution = useMutation(api.trainingLogs.finishSessionExecution);

  const [error, setError] = React.useState<string | null>(null);
  const [logId, setLogId] = React.useState<string | null>(null);
  const [plannedSets, setPlannedSets] = React.useState(3);
  const [plannedReps, setPlannedReps] = React.useState(6);
  const [plannedRepDurationSeconds, setPlannedRepDurationSeconds] = React.useState(30);
  const [plannedRepRestSeconds, setPlannedRepRestSeconds] = React.useState(60);
  const [plannedSetRestSeconds, setPlannedSetRestSeconds] = React.useState(60);
  const [currentSet, setCurrentSet] = React.useState(1);
  const [currentRep, setCurrentRep] = React.useState(1);
  const [restPhaseKind, setRestPhaseKind] = React.useState<RestPhaseKind>(null);
  const [phase, setPhase] = React.useState<TimerPhase>("prep");
  const [awaitingStart, setAwaitingStart] = React.useState(true);
  const [phaseEndsAt, setPhaseEndsAt] = React.useState<number | null>(null);
  const [pausedRemainingMs, setPausedRemainingMs] = React.useState<number | null>(null);
  const [nowTick, setNowTick] = React.useState(() => performance.now());
  const [detailsExpanded, setDetailsExpanded] = React.useState(false);

  const initializingRef = React.useRef(false);
  const transitioningRef = React.useRef(false);

  // --------------- tick ---------------
  React.useEffect(() => {
    const interval = setInterval(() => setNowTick(getNowMs()), 100);
    return () => clearInterval(interval);
  }, [getNowMs]);

  const currentPhaseDurationSeconds =
    phase === "prep"
      ? PREP_PHASE_SECONDS
      : phase === "rep"
        ? plannedRepDurationSeconds
        : restPhaseKind === "between_sets"
          ? plannedSetRestSeconds
          : plannedRepRestSeconds;
  const remainingMs =
    phase === "completed"
      ? 0
      : awaitingStart && phase === "prep"
        ? PREP_PHASE_SECONDS * 1000
        : (pausedRemainingMs ?? Math.max(0, (phaseEndsAt ?? getNowMs()) - nowTick));

  // --------------- Reanimated: background color ---------------
  const bgValue = useSharedValue(0);

  React.useEffect(() => {
    const target = phase === "rep" ? 0 : phase === "completed" ? 2 : 1;
    bgValue.value = withTiming(target, { duration: 600, easing: Easing.out(Easing.cubic) });
  }, [phase, bgValue]);

  const bgStyle = useAnimatedStyle(() => ({
    flex: 1,
    backgroundColor: interpolateColor(
      bgValue.value,
      [0, 1, 2],
      [PHASE_THEME.rep.bg, PHASE_THEME.prep.bg, PHASE_THEME.completed.bg],
    ),
  }));

  // --------------- Reanimated: breathing overlay for rest ---------------
  const breatheValue = useSharedValue(0);
  const ringProgress = useSharedValue(0);
  const isBreathing =
    phase === "rest" &&
    remainingMs <= REST_BREATHE_THRESHOLD &&
    remainingMs > 0 &&
    pausedRemainingMs === null;

  React.useEffect(() => {
    if (isBreathing) {
      breatheValue.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 500, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 500, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
      );
    } else {
      cancelAnimation(breatheValue);
      breatheValue.value = withTiming(0, { duration: 200 });
    }
  }, [isBreathing, breatheValue]);

  const breatheOverlayStyle = useAnimatedStyle(() => ({
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#ffa500",
    opacity: breatheValue.value * 0.14,
  }));

  const ringAnimatedProps = useAnimatedProps(() => ({
    strokeDashoffset: RING_CIRCUMFERENCE * (1 - ringProgress.value),
  }));

  React.useEffect(() => {
    if (phase === "completed") {
      cancelAnimation(ringProgress);
      ringProgress.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
      return;
    }

    if (phase === "prep" && awaitingStart) {
      cancelAnimation(ringProgress);
      ringProgress.value = 0;
      return;
    }

    if (pausedRemainingMs !== null) {
      cancelAnimation(ringProgress);
      return;
    }

    if (!phaseEndsAt) return;

    const now = getNowMs();
    const totalPhaseMs = currentPhaseDurationSeconds * 1000;
    const remainingPhaseMs = Math.max(0, phaseEndsAt - now);
    const startProgress =
      totalPhaseMs > 0 ? Math.max(0, Math.min(1, 1 - remainingPhaseMs / totalPhaseMs)) : 0;

    ringProgress.value = startProgress;
    ringProgress.value = withTiming(1, {
      duration: remainingPhaseMs,
      easing: Easing.linear,
    });
  }, [
    awaitingStart,
    currentPhaseDurationSeconds,
    getNowMs,
    pausedRemainingMs,
    phase,
    phaseEndsAt,
    ringProgress,
  ]);

  // --------------- sounds ---------------
  React.useEffect(() => {
    void soundManager.init();
    return () => {
      void soundManager.cleanup();
    };
  }, []);

  const lastBeepRef = React.useRef(-1);
  React.useEffect(() => {
    if (pausedRemainingMs !== null || phase === "completed" || (phase === "prep" && awaitingStart))
      return;
    const seconds = Math.ceil(remainingMs / 1000);

    if (
      (phase === "rest" || phase === "prep") &&
      seconds <= COUNTDOWN_BEEP_THRESHOLD &&
      seconds >= 1 &&
      seconds !== lastBeepRef.current
    ) {
      lastBeepRef.current = seconds;
      if (seconds === 1) void soundManager.play("countdown1");
      else void soundManager.play("countdown3");
    }

    if (
      phase === "rep" &&
      seconds <= WORK_TICK_THRESHOLD &&
      seconds >= 1 &&
      seconds !== lastBeepRef.current
    ) {
      lastBeepRef.current = seconds;
      if (seconds === 1) void soundManager.play("go");
      else void soundManager.play("workTick");
    }
  }, [remainingMs, phase, pausedRemainingMs, awaitingStart]);

  React.useEffect(() => {
    lastBeepRef.current = -1;
  }, [phase]);

  React.useEffect(() => {
    if (phase === "completed") {
      void soundManager.play("complete");
    }
  }, [phase]);

  // --------------- session init ---------------
  const setPhaseRunning = React.useCallback(
    (nextPhase: TimerPhase, durationSeconds: number, nextRestKind: RestPhaseKind = null) => {
      setAwaitingStart(false);
      setPhase(nextPhase);
      setRestPhaseKind(nextPhase === "rest" ? nextRestKind : null);
      setPausedRemainingMs(null);
      setPhaseEndsAt(getNowMs() + durationSeconds * 1000);
    },
    [getNowMs],
  );

  const initialize = React.useCallback(async () => {
    if (!sessionId || initializingRef.current) return;
    initializingRef.current = true;
    setError(null);
    try {
      const log = await startSessionExecution({ sessionId: sessionId as never });
      const resolvedSets = clampPositiveInt(log?.planned?.sets, 3);
      const resolvedReps = clampPositiveInt(log?.planned?.reps, 6);
      const resolvedRepDuration = clampPositiveInt(log?.planned?.durationSeconds, 30);
      const resolvedRepRestDuration = clampPositiveInt(log?.planned?.restSeconds, 60);
      const resolvedSetRestDuration = clampPositiveInt(
        log?.planned?.restBetweenSetsSeconds,
        resolvedRepRestDuration,
      );
      let resumedSet = 1;
      let resumedRep = 1;
      let resumedPhase: TimerPhase = "rep";
      let resumedRestKind: RestPhaseKind = null;
      let didCompleteAllReps = false;
      for (const step of log?.steps ?? []) {
        if (step.kind === "rep") {
          const stepSet = Math.min(Math.max(1, step.setNumber), resolvedSets);
          const stepRep = Math.min(
            Math.max(
              1,
              step.repNumber ?? ((step.completedReps ?? 0) >= resolvedReps ? resolvedReps : 1),
            ),
            resolvedReps,
          );
          const isLastRepInSet = stepRep >= resolvedReps;
          const isLastSet = stepSet >= resolvedSets;
          if (isLastRepInSet && isLastSet) {
            resumedSet = resolvedSets;
            resumedRep = resolvedReps;
            resumedPhase = "completed";
            resumedRestKind = null;
            didCompleteAllReps = true;
            continue;
          }
          resumedSet = stepSet;
          resumedRep = stepRep;
          resumedPhase = "rest";
          resumedRestKind = isLastRepInSet ? "between_sets" : "between_reps";
          continue;
        }

        if (step.kind === "rest") {
          const stepSet = Math.min(Math.max(1, step.setNumber), resolvedSets);
          const stepRep = Math.min(Math.max(1, step.repNumber ?? 1), resolvedReps);
          const inferredRestKind: RestPhaseKind =
            step.note === "between_reps"
              ? "between_reps"
              : step.note === "between_sets"
                ? "between_sets"
                : step.repNumber === undefined
                  ? "between_sets"
                  : stepRep >= resolvedReps
                    ? "between_sets"
                    : "between_reps";
          if (inferredRestKind === "between_reps") {
            resumedSet = stepSet;
            resumedRep = Math.min(stepRep + 1, resolvedReps);
          } else {
            resumedSet = Math.min(stepSet + 1, resolvedSets);
            resumedRep = 1;
          }
          resumedPhase = "rep";
          resumedRestKind = null;
          continue;
        }

        if (step.kind === "set_skipped") {
          resumedSet = Math.min(Math.max(1, step.setNumber + 1), resolvedSets);
          resumedRep = 1;
          resumedPhase = "rep";
          resumedRestKind = null;
        }
      }
      resumedSet = Math.min(Math.max(1, resumedSet), resolvedSets);
      resumedRep = Math.min(Math.max(1, resumedRep), resolvedReps);
      setLogId(log?._id ?? null);
      setPlannedSets(resolvedSets);
      setPlannedReps(resolvedReps);
      setPlannedRepDurationSeconds(resolvedRepDuration);
      setPlannedRepRestSeconds(resolvedRepRestDuration);
      setPlannedSetRestSeconds(resolvedSetRestDuration);
      setCurrentSet(resumedSet);
      setCurrentRep(resumedRep);
      setRestPhaseKind(resumedRestKind);
      const hasRecordedSteps = (log?.steps?.length ?? 0) > 0;
      if (hasRecordedSteps && !didCompleteAllReps) {
        setAwaitingStart(false);
        setPhase(resumedPhase);
        const duration =
          resumedPhase === "rep"
            ? resolvedRepDuration
            : resumedRestKind === "between_sets"
              ? resolvedSetRestDuration
              : resolvedRepRestDuration;
        setPhaseEndsAt(getNowMs() + duration * 1000);
      } else if (didCompleteAllReps) {
        setAwaitingStart(false);
        setPhase("completed");
        setRestPhaseKind(null);
        setPhaseEndsAt(null);
      } else {
        setAwaitingStart(true);
        setPhase("prep");
        setRestPhaseKind(null);
        setPhaseEndsAt(null);
      }
      setPausedRemainingMs(null);
    } catch (initError) {
      setError(initError instanceof Error ? initError.message : "Could not start timer.");
    } finally {
      initializingRef.current = false;
    }
  }, [getNowMs, sessionId, startSessionExecution]);

  React.useEffect(() => {
    if (!sessionId) return;
    void initialize();
  }, [initialize, sessionId]);

  // --------------- step recording ---------------
  const recordStep = React.useCallback(
    async (step: {
      kind: "rep" | "rest" | "set_skipped";
      setNumber: number;
      repNumber?: number;
      completedReps?: number;
      plannedDurationSeconds?: number;
      actualDurationMs: number;
      note?: string;
    }) => {
      if (!logId) return;
      await appendExecutionStep({ logId: logId as never, step });
    },
    [appendExecutionStep, logId],
  );

  // --------------- phase transitions ---------------
  const completeRepPhase = React.useCallback(async () => {
    if (!logId || transitioningRef.current) return;
    transitioningRef.current = true;
    setError(null);
    try {
      const actualDurationMs = Math.max(0, currentPhaseDurationSeconds * 1000 - remainingMs);
      await recordStep({
        kind: "rep",
        setNumber: currentSet,
        repNumber: currentRep,
        completedReps: 1,
        plannedDurationSeconds: plannedRepDurationSeconds,
        actualDurationMs,
      });
      const isLastRepInSet = currentRep >= plannedReps;
      if (!isLastRepInSet) {
        setPhaseRunning("rest", plannedRepRestSeconds, "between_reps");
        return;
      }
      if (currentSet >= plannedSets) {
        setPhase("completed");
        setRestPhaseKind(null);
        setPhaseEndsAt(null);
        setPausedRemainingMs(null);
        return;
      }
      setPhaseRunning("rest", plannedSetRestSeconds, "between_sets");
    } catch (phaseError) {
      setError(phaseError instanceof Error ? phaseError.message : "Could not save rep step.");
    } finally {
      transitioningRef.current = false;
    }
  }, [
    currentPhaseDurationSeconds,
    currentRep,
    currentSet,
    logId,
    plannedReps,
    plannedRepDurationSeconds,
    plannedRepRestSeconds,
    plannedSetRestSeconds,
    plannedSets,
    recordStep,
    remainingMs,
    setPhaseRunning,
  ]);

  const completeRestPhase = React.useCallback(async () => {
    if (!logId || transitioningRef.current) return;
    transitioningRef.current = true;
    setError(null);
    try {
      const actualDurationMs = Math.max(0, currentPhaseDurationSeconds * 1000 - remainingMs);
      const activeRestKind = restPhaseKind ?? "between_sets";
      const restDuration =
        activeRestKind === "between_sets" ? plannedSetRestSeconds : plannedRepRestSeconds;
      await recordStep({
        kind: "rest",
        setNumber: currentSet,
        repNumber: currentRep,
        plannedDurationSeconds: restDuration,
        actualDurationMs,
        note: activeRestKind,
      });
      if (activeRestKind === "between_reps" && currentRep < plannedReps) {
        setCurrentRep((prev) => Math.min(prev + 1, plannedReps));
        setPhaseRunning("rep", plannedRepDurationSeconds);
        return;
      }
      if (currentSet >= plannedSets) {
        setPhase("completed");
        setRestPhaseKind(null);
        setPhaseEndsAt(null);
        setPausedRemainingMs(null);
        return;
      }
      setCurrentSet((prev) => Math.min(prev + 1, plannedSets));
      setCurrentRep(1);
      setPhaseRunning("rep", plannedRepDurationSeconds);
    } catch (phaseError) {
      setError(phaseError instanceof Error ? phaseError.message : "Could not save rest step.");
    } finally {
      transitioningRef.current = false;
    }
  }, [
    currentPhaseDurationSeconds,
    currentRep,
    currentSet,
    logId,
    plannedReps,
    plannedRepDurationSeconds,
    plannedRepRestSeconds,
    plannedSetRestSeconds,
    plannedSets,
    recordStep,
    remainingMs,
    restPhaseKind,
    setPhaseRunning,
  ]);

  // auto-advance when timer hits zero
  React.useEffect(() => {
    if (
      !logId ||
      pausedRemainingMs !== null ||
      remainingMs > 0 ||
      transitioningRef.current ||
      phase === "completed" ||
      (phase === "prep" && awaitingStart)
    )
      return;
    if (phase === "prep") {
      setPhaseRunning("rep", plannedRepDurationSeconds);
      return;
    }
    if (phase === "rep") {
      void completeRepPhase();
      return;
    }
    void completeRestPhase();
  }, [
    completeRepPhase,
    completeRestPhase,
    logId,
    pausedRemainingMs,
    phase,
    remainingMs,
    awaitingStart,
    setPhaseRunning,
    plannedRepDurationSeconds,
  ]);

  // completion → navigate after delay
  React.useEffect(() => {
    if (phase !== "completed" || !logId) return;
    const timeout = setTimeout(async () => {
      try {
        await finishSessionExecution({ logId: logId as never, outcome: "completed" });
      } catch {
        /* navigate anyway */
      }
      router.replace("/tabs/calendar");
    }, COMPLETION_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [phase, logId, finishSessionExecution, router]);

  // --------------- controls ---------------
  const startPreparation = () => {
    setError(null);
    setAwaitingStart(false);
    setPhase("prep");
    setRestPhaseKind(null);
    setPausedRemainingMs(null);
    setPhaseEndsAt(getNowMs() + PREP_PHASE_SECONDS * 1000);
  };

  const pauseOrResume = () => {
    if (!phaseEndsAt || phase === "completed" || (phase === "prep" && awaitingStart)) return;
    if (pausedRemainingMs === null) {
      setPausedRemainingMs(Math.max(0, phaseEndsAt - getNowMs()));
      return;
    }
    setPhaseEndsAt(getNowMs() + pausedRemainingMs);
    setPausedRemainingMs(null);
  };

  const jumpToRep = React.useCallback(
    (targetSet: number, targetRep: number) => {
      if (phase !== "rep" && phase !== "rest") return;
      const nextSet = Math.min(Math.max(1, targetSet), plannedSets);
      const nextRep = Math.min(Math.max(1, targetRep), plannedReps);
      setError(null);
      setCurrentSet(nextSet);
      setCurrentRep(nextRep);
      setPhaseRunning("rep", plannedRepDurationSeconds);
    },
    [phase, plannedRepDurationSeconds, plannedReps, plannedSets, setPhaseRunning],
  );

  const goToPreviousRep = () => {
    if (phase !== "rep" && phase !== "rest") return;
    if (currentRep > 1) {
      jumpToRep(currentSet, currentRep - 1);
      return;
    }
    if (currentSet > 1) {
      jumpToRep(currentSet - 1, plannedReps);
    }
  };

  const goToNextRep = () => {
    if (phase !== "rep" && phase !== "rest") return;
    if (currentRep < plannedReps) {
      jumpToRep(currentSet, currentRep + 1);
      return;
    }
    if (currentSet < plannedSets) {
      jumpToRep(currentSet + 1, 1);
    }
  };

  const goToPreviousSet = () => {
    if (phase !== "rep" && phase !== "rest") return;
    if (currentSet <= 1) return;
    jumpToRep(currentSet - 1, Math.min(currentRep, plannedReps));
  };

  const goToNextSet = () => {
    if (phase !== "rep" && phase !== "rest") return;
    if (currentSet >= plannedSets) return;
    jumpToRep(currentSet + 1, Math.min(currentRep, plannedReps));
  };

  const skipSet = async () => {
    if (!logId || transitioningRef.current || phase === "completed" || phase === "prep") return;
    transitioningRef.current = true;
    setError(null);
    try {
      await recordStep({
        kind: "set_skipped",
        setNumber: currentSet,
        repNumber: currentRep,
        plannedDurationSeconds: currentPhaseDurationSeconds,
        actualDurationMs: 0,
        note: "Skipped by user",
      });
      if (currentSet >= plannedSets) {
        await finishSessionExecution({
          logId: logId as never,
          outcome: "stopped_early",
          notes: "Stopped after skipping final set.",
        });
        router.replace("/tabs/calendar");
        return;
      }
      setCurrentSet((prev) => Math.min(prev + 1, plannedSets));
      setCurrentRep(1);
      setPhaseRunning("rep", plannedRepDurationSeconds);
    } catch (skipError) {
      setError(skipError instanceof Error ? skipError.message : "Could not skip set.");
    } finally {
      transitioningRef.current = false;
    }
  };

  const stopEarly = async () => {
    if (!logId) {
      router.replace("/tabs/calendar");
      return;
    }
    setError(null);
    try {
      await finishSessionExecution({ logId: logId as never, outcome: "stopped_early" });
      router.replace("/tabs/calendar");
    } catch (stopError) {
      setError(stopError instanceof Error ? stopError.message : "Could not stop session.");
    }
  };

  // --------------- derived display values ---------------
  const isRep = phase === "rep";
  const isPrep = phase === "prep";
  const isCompleted = phase === "completed";
  const theme = PHASE_THEME[phase];
  const isPaused = pausedRemainingMs !== null;
  const showReadyGate = isPrep && awaitingStart;
  const canJumpBetweenSteps = phase === "rep" || phase === "rest";
  const totalCycles = plannedSets * plannedReps;
  const completedCycles = isCompleted
    ? totalCycles
    : showReadyGate
      ? 0
      : phase === "rest"
        ? Math.min(totalCycles, (currentSet - 1) * plannedReps + currentRep)
        : Math.min(totalCycles, Math.max(0, (currentSet - 1) * plannedReps + (currentRep - 1)));
  const currentCycle = showReadyGate
    ? 0
    : isCompleted
      ? totalCycles
      : phase === "rep"
        ? Math.min(totalCycles, completedCycles + 1)
        : completedCycles;
  const cycleProgressPercent = totalCycles > 0 ? (completedCycles / totalCycles) * 100 : 0;
  const displaySet = Math.min(currentSet, plannedSets);
  const displayRep =
    phase === "rest" && restPhaseKind === "between_sets"
      ? plannedReps
      : Math.min(currentRep, plannedReps);

  const phaseLabel = isCompleted
    ? "DONE"
    : showReadyGate
      ? "READY"
      : isPaused
        ? "PAUSED"
        : isPrep
          ? "GET READY"
          : isRep
            ? "WORK"
            : restPhaseKind === "between_sets"
              ? "SET REST"
              : "REST";
  const mergedVariables = React.useMemo(
    () => ({
      weight: session?.overrides.weight ?? session?.snapshot.variables.weight,
      reps: session?.overrides.reps ?? session?.snapshot.variables.reps,
      sets: session?.overrides.sets ?? session?.snapshot.variables.sets,
      restSeconds: session?.overrides.restSeconds ?? session?.snapshot.variables.restSeconds,
      restBetweenSetsSeconds:
        session?.overrides.restBetweenSetsSeconds ??
        session?.snapshot.variables.restBetweenSetsSeconds,
      durationSeconds:
        session?.overrides.durationSeconds ?? session?.snapshot.variables.durationSeconds,
    }),
    [session],
  );
  const currentExerciseDescription =
    session?.snapshot.description?.trim() || "No detailed description provided for this exercise.";
  const currentExerciseTypeLabel = session?.snapshot.trainingType
    ? TRAINING_TYPE_LABEL[session.snapshot.trainingType]
    : "Not set";
  const currentExerciseCategory =
    session?.snapshot.categories?.length &&
    session.snapshot.categories.some((entry) => !!entry.trim())
      ? session.snapshot.categories.join(", ")
      : session?.snapshot.category || "Not set";
  const currentExerciseTags = session?.snapshot.tags.length
    ? session.snapshot.tags.join(", ")
    : "None";
  const currentExerciseEquipment = session?.snapshot.equipment.length
    ? session.snapshot.equipment.join(", ")
    : "None";
  const effectiveSetRestSeconds =
    mergedVariables.restBetweenSetsSeconds ?? mergedVariables.restSeconds;
  const currentExerciseSummary = `Load ${describeLoad(
    session?.snapshot.trainingType,
    mergedVariables.weight,
    profile?.bodyWeightKg,
  )} · ${mergedVariables.sets ?? "—"} sets · ${mergedVariables.reps ?? "—"} reps · Rep rest ${
    mergedVariables.restSeconds ?? "—"
  }s · Set rest ${effectiveSetRestSeconds ?? "—"}s · Duration ${mergedVariables.durationSeconds ?? "—"}s`;

  // --------------- missing session fallback ---------------
  if (!sessionId) {
    return (
      <View style={[styles.center, { backgroundColor: PHASE_THEME.rep.bg }]}>
        <Text style={styles.missingTitle}>Missing session</Text>
        <Pressable
          onPress={() => router.replace("/tabs/calendar")}
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.primaryBtnText}>Back to calendar</Text>
        </Pressable>
      </View>
    );
  }

  // --------------- main UI ---------------
  return (
    <Animated.View style={bgStyle}>
      <Animated.View style={breatheOverlayStyle} pointerEvents="none" />

      <View style={styles.container}>
        {/* ---- header ---- */}
        <View style={styles.header}>
          <Text style={styles.sessionTitle} numberOfLines={2}>
            {session?.snapshot.title ?? "Training session"}
          </Text>
          <View style={styles.setRow}>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${cycleProgressPercent}%`,
                    backgroundColor: isCompleted ? colors.success : theme.accent,
                  },
                ]}
              />
            </View>
            <Text style={styles.setText}>
              Cycle {currentCycle}/{totalCycles} · Set {displaySet}/{plannedSets} · Rep {displayRep}
              /{plannedReps}
            </Text>
          </View>
        </View>

        {/* ---- center ---- */}
        <View style={styles.centerSection}>
          {/* phase label */}
          <Text style={[styles.phaseLabel, { color: theme.accent }]}>{phaseLabel}</Text>

          {showReadyGate ? (
            <View style={styles.readyGate}>
              <View style={styles.exerciseDetailsCard}>
                <Text style={styles.exerciseDetailsTitle}>Current exercise details</Text>
                <Text style={styles.exerciseDetailsDescription}>{currentExerciseDescription}</Text>
                <Text style={styles.exerciseDetailsMeta}>{currentExerciseSummary}</Text>
                <Text style={styles.exerciseDetailsMeta}>Type: {currentExerciseTypeLabel}</Text>
                <Text style={styles.exerciseDetailsMeta}>Category: {currentExerciseCategory}</Text>
                <Text style={styles.exerciseDetailsMeta}>
                  Equipment: {currentExerciseEquipment}
                </Text>
                <Text style={styles.exerciseDetailsMeta}>Tags: {currentExerciseTags}</Text>
              </View>
              <Text style={styles.readyHint}>Tap when you are ready.</Text>
              <Pressable
                onPress={startPreparation}
                style={[styles.readyBtn, { backgroundColor: theme.accent }]}
              >
                <Text style={styles.readyBtnText}>I'M READY</Text>
              </Pressable>
              <Text style={styles.readySubHint}>
                A 5 second prep countdown starts after you tap.
              </Text>
            </View>
          ) : (
            <>
              {/* progress ring + timer */}
              {isCompleted ? (
                <View style={styles.completionCircle}>
                  <View style={[styles.checkCircle, { backgroundColor: theme.accent }]}>
                    <Check size={64} color="#fff" strokeWidth={3} />
                  </View>
                </View>
              ) : (
                <View style={styles.ringContainer}>
                  <Svg width={RING_SIZE} height={RING_SIZE} style={StyleSheet.absoluteFill}>
                    <Circle
                      cx={RING_SIZE / 2}
                      cy={RING_SIZE / 2}
                      r={RING_RADIUS}
                      stroke={theme.track}
                      strokeWidth={RING_STROKE}
                      fill="none"
                    />
                    <AnimatedCircle
                      cx={RING_SIZE / 2}
                      cy={RING_SIZE / 2}
                      r={RING_RADIUS}
                      stroke={theme.accent}
                      strokeWidth={RING_STROKE}
                      fill="none"
                      strokeDasharray={`${RING_CIRCUMFERENCE}`}
                      animatedProps={ringAnimatedProps}
                      strokeLinecap="round"
                      transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
                    />
                  </Svg>
                  <Text allowFontScaling={false} style={styles.timerText}>
                    {formatDuration(remainingMs)}
                  </Text>
                </View>
              )}

              {/* subtitle */}
              {isCompleted ? (
                <Text style={styles.completionSub}>Session complete!</Text>
              ) : (
                <Text style={styles.subtitle}>
                  {isPrep
                    ? "Preparation countdown before work starts"
                    : isRep
                      ? `Set ${displaySet}/${plannedSets} · Rep ${displayRep}/${plannedReps} · ${currentPhaseDurationSeconds}s work`
                      : restPhaseKind === "between_sets"
                        ? `Set rest before next set · ${currentPhaseDurationSeconds}s`
                        : `Rep rest before next rep · ${currentPhaseDurationSeconds}s`}
                </Text>
              )}

              <View style={styles.exerciseDetailsSection}>
                <Pressable
                  onPress={() => setDetailsExpanded((prev) => !prev)}
                  style={styles.exerciseDetailsToggle}
                >
                  <Text style={styles.exerciseDetailsToggleText}>Exercise details</Text>
                  {detailsExpanded ? (
                    <ChevronDown size={18} color="rgba(255,255,255,0.8)" strokeWidth={2.2} />
                  ) : (
                    <ChevronRight size={18} color="rgba(255,255,255,0.8)" strokeWidth={2.2} />
                  )}
                </Pressable>
                {detailsExpanded ? (
                  <View style={styles.exerciseDetailsCard}>
                    <Text style={styles.exerciseDetailsDescription}>
                      {currentExerciseDescription}
                    </Text>
                    <Text style={styles.exerciseDetailsMeta}>{currentExerciseSummary}</Text>
                    <Text style={styles.exerciseDetailsMeta}>Type: {currentExerciseTypeLabel}</Text>
                    <Text style={styles.exerciseDetailsMeta}>
                      Category: {currentExerciseCategory}
                    </Text>
                    <Text style={styles.exerciseDetailsMeta}>
                      Equipment: {currentExerciseEquipment}
                    </Text>
                    <Text style={styles.exerciseDetailsMeta}>Tags: {currentExerciseTags}</Text>
                  </View>
                ) : null}
              </View>
            </>
          )}
        </View>

        {/* ---- controls ---- */}
        <View style={styles.footer}>
          {isCompleted ? (
            <Pressable
              onPress={() => router.replace("/tabs/calendar")}
              style={[styles.doneBtn, { backgroundColor: theme.accent }]}
            >
              <Text style={styles.doneBtnText}>Back to Calendar</Text>
            </Pressable>
          ) : showReadyGate ? (
            <Pressable onPress={() => void stopEarly()} style={styles.secondaryActionBtn}>
              <Text style={styles.secondaryActionBtnText}>Cancel session</Text>
            </Pressable>
          ) : (
            <View style={styles.controlsGroup}>
              <View style={styles.stepNavRow}>
                <Pressable
                  onPress={goToPreviousSet}
                  disabled={!canJumpBetweenSteps || currentSet <= 1}
                  style={[
                    styles.stepNavBtn,
                    (!canJumpBetweenSteps || currentSet <= 1) && styles.stepNavBtnDisabled,
                  ]}
                >
                  <Text style={styles.stepNavBtnText}>Prev Set</Text>
                </Pressable>
                <Pressable
                  onPress={goToPreviousRep}
                  disabled={!canJumpBetweenSteps || (currentSet <= 1 && currentRep <= 1)}
                  style={[
                    styles.stepNavBtn,
                    (!canJumpBetweenSteps || (currentSet <= 1 && currentRep <= 1)) &&
                      styles.stepNavBtnDisabled,
                  ]}
                >
                  <Text style={styles.stepNavBtnText}>Prev Rep</Text>
                </Pressable>
                <Pressable
                  onPress={goToNextRep}
                  disabled={
                    !canJumpBetweenSteps || (currentSet >= plannedSets && currentRep >= plannedReps)
                  }
                  style={[
                    styles.stepNavBtn,
                    (!canJumpBetweenSteps ||
                      (currentSet >= plannedSets && currentRep >= plannedReps)) &&
                      styles.stepNavBtnDisabled,
                  ]}
                >
                  <Text style={styles.stepNavBtnText}>Next Rep</Text>
                </Pressable>
                <Pressable
                  onPress={goToNextSet}
                  disabled={!canJumpBetweenSteps || currentSet >= plannedSets}
                  style={[
                    styles.stepNavBtn,
                    (!canJumpBetweenSteps || currentSet >= plannedSets) &&
                      styles.stepNavBtnDisabled,
                  ]}
                >
                  <Text style={styles.stepNavBtnText}>Next Set</Text>
                </Pressable>
              </View>

              <View style={styles.controlsRow}>
                <Pressable onPress={() => void skipSet()} style={styles.secondaryBtn}>
                  <SkipForward size={22} color="rgba(255,255,255,0.6)" strokeWidth={2} />
                </Pressable>

                <Pressable
                  onPress={pauseOrResume}
                  style={[styles.playBtn, { backgroundColor: theme.accent }]}
                >
                  {isPaused ? (
                    <Play size={30} color="#fff" strokeWidth={2.5} fill="#fff" />
                  ) : (
                    <Pause size={30} color="#fff" strokeWidth={2.5} />
                  )}
                </Pressable>

                <Pressable onPress={() => void stopEarly()} style={styles.secondaryBtn}>
                  <X size={22} color="#ef4444" strokeWidth={2.5} />
                </Pressable>
              </View>
            </View>
          )}

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  missingTitle: { fontSize: 18, fontWeight: "600", color: "#fff" },
  primaryBtn: { borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  primaryBtnText: { color: "#fff", fontWeight: "600" },

  container: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 48,
  },

  header: { gap: 8 },
  sessionTitle: { fontSize: 20, fontWeight: "700", color: "#fff" },
  setRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  progressTrack: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.2)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  setText: { fontSize: 14, color: "rgba(255,255,255,0.5)" },

  centerSection: { alignItems: "center", gap: 16, overflow: "visible" },
  phaseLabel: {
    fontSize: 44,
    lineHeight: 58,
    fontWeight: "900",
    letterSpacing: 6,
    textTransform: "uppercase",
    paddingTop: 4,
  },

  ringContainer: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  timerText: {
    fontSize: 72,
    lineHeight: 80,
    fontWeight: "700",
    color: "#ffffff",
    fontVariant: ["tabular-nums"],
    letterSpacing: -2,
    textAlign: "center",
  },

  completionCircle: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  checkCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: "center",
    justifyContent: "center",
  },
  completionSub: { fontSize: 20, fontWeight: "600", color: "rgba(255,255,255,0.8)", marginTop: 4 },

  subtitle: { fontSize: 14, color: "rgba(255,255,255,0.45)" },
  readyGate: {
    width: "100%",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  readyHint: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
  },
  readyBtn: {
    minWidth: 230,
    minHeight: 88,
    borderRadius: 20,
    paddingVertical: 22,
    paddingHorizontal: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  readyBtnText: {
    color: "#fff",
    fontSize: 26,
    lineHeight: 34,
    fontWeight: "900",
    letterSpacing: 1,
    textAlign: "center",
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  readySubHint: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 13,
    textAlign: "center",
  },
  exerciseDetailsSection: {
    width: "100%",
    gap: 8,
    marginTop: 4,
  },
  exerciseDetailsToggle: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  exerciseDetailsToggleText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 13,
    fontWeight: "700",
  },
  exerciseDetailsCard: {
    width: "100%",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  exerciseDetailsTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  exerciseDetailsDescription: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 13,
    lineHeight: 18,
  },
  exerciseDetailsMeta: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    lineHeight: 16,
  },

  footer: { gap: 16 },
  controlsGroup: { gap: 12 },
  stepNavRow: { flexDirection: "row", gap: 8, justifyContent: "center" },
  stepNavBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  stepNavBtnDisabled: {
    opacity: 0.4,
  },
  stepNavBtnText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontWeight: "700",
  },
  controlsRow: { flexDirection: "row", gap: 16, justifyContent: "center", alignItems: "center" },
  secondaryBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  playBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryActionBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryActionBtnText: { color: "rgba(255,255,255,0.85)", fontSize: 14, fontWeight: "600" },
  doneBtn: { borderRadius: 16, paddingVertical: 16, alignItems: "center" },
  doneBtnText: { color: "#fff", fontSize: 17, fontWeight: "700" },

  errorBox: { borderRadius: 12, padding: 12, backgroundColor: "rgba(239,68,68,0.15)" },
  errorText: { textAlign: "center", fontSize: 14, color: "#fca5a5" },
});
