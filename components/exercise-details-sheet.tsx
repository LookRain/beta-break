import React from "react";
import { ScrollView } from "react-native";
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
import { colors } from "@/lib/theme";

export type ExerciseDetailVariables = {
  weight?: number;
  reps?: number;
  sets?: number;
  restSeconds?: number;
  restBetweenSetsSeconds?: number;
  durationSeconds?: number;
};

export type ExerciseDetailItem = {
  title: string;
  description?: string;
  categories: string[];
  tags: string[];
  trainingType?: "hang" | "weight_training" | "climbing" | "others";
  hangDetails?: {
    apparatus: "fingerboard" | "bar";
    edgeSizeMm?: number;
    crimpType?: "open" | "half" | "full";
    loadPreference?: "below_100" | "above_100";
  };
  difficulty: "beginner" | "intermediate" | "advanced";
  equipment?: string[];
  variables: ExerciseDetailVariables;
  publisher?: {
    userId: string;
    username: string | null;
    image: string | null;
  } | null;
};

type ExerciseDetailsSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  exercise: ExerciseDetailItem | null;
  finalVariables?: ExerciseDetailVariables;
  bodyWeightKg?: number;
};

const difficultyColors: Record<string, { bg: string; text: string }> = {
  beginner: { bg: "#f0fdfa", text: "#0d9488" },
  intermediate: { bg: "#fffbeb", text: "#d97706" },
  advanced: { bg: "#fef2f2", text: "#dc2626" },
};

const trainingTypeLabel: Record<string, string> = {
  hang: "Hang",
  weight_training: "Weight training",
  climbing: "Climbing",
  others: "Others",
};

const loadPreferenceLabel: Record<string, string> = {
  below_100: "below 100%",
  above_100: "above 100%",
};

function formatList(values: string[] | undefined, fallback: string): string {
  const normalized = (values ?? [])
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return normalized.length > 0 ? normalized.join(", ") : fallback;
}

function formatLoadLabel(
  weight: number | undefined,
  trainingType: ExerciseDetailItem["trainingType"],
  bodyWeightKg?: number,
): string {
  if (weight === undefined) {
    return "not set";
  }

  const usesBodyweightPercent = !!trainingType;
  if (!usesBodyweightPercent) {
    return `${weight}kg`;
  }

  if (weight > 100) {
    const additionalPercent = Number((weight - 100).toFixed(1));
    const additionalKg =
      bodyWeightKg && bodyWeightKg > 0
        ? Number(((additionalPercent / 100) * bodyWeightKg).toFixed(1))
        : undefined;
    return additionalKg !== undefined
      ? `+${additionalPercent}% BW (+${additionalKg}kg for you)`
      : `+${additionalPercent}% BW`;
  }

  const personalizedKg =
    bodyWeightKg && bodyWeightKg > 0
      ? Number(((weight / 100) * bodyWeightKg).toFixed(1))
      : undefined;
  return personalizedKg !== undefined
    ? `${weight}% BW (${personalizedKg}kg for you)`
    : `${weight}% BW`;
}

function resolveVariables(
  base: ExerciseDetailVariables,
  finalVariables?: ExerciseDetailVariables,
): ExerciseDetailVariables {
  if (!finalVariables) {
    return base;
  }
  return {
    weight: finalVariables.weight ?? base.weight,
    reps: finalVariables.reps ?? base.reps,
    sets: finalVariables.sets ?? base.sets,
    restSeconds: finalVariables.restSeconds ?? base.restSeconds,
    restBetweenSetsSeconds: finalVariables.restBetweenSetsSeconds ?? base.restBetweenSetsSeconds,
    durationSeconds: finalVariables.durationSeconds ?? base.durationSeconds,
  };
}

export function ExerciseDetailsSheet({
  isOpen,
  onClose,
  exercise,
  finalVariables,
  bodyWeightKg,
}: ExerciseDetailsSheetProps) {
  if (!exercise) {
    return null;
  }

  const diffColors = difficultyColors[exercise.difficulty] ?? difficultyColors.beginner;
  const variables = resolveVariables(exercise.variables, finalVariables);
  const displayLoad = formatLoadLabel(variables.weight, exercise.trainingType, bodyWeightKg);
  const setRest = variables.restBetweenSetsSeconds ?? variables.restSeconds;
  const categoriesText = formatList(exercise.categories, "not set");
  const tagsText = formatList(exercise.tags, "none");
  const equipmentText = formatList(exercise.equipment, "none");
  const typeText = exercise.trainingType ? trainingTypeLabel[exercise.trainingType] : "Not set";
  const hasHangDetails = exercise.trainingType === "hang" && !!exercise.hangDetails;

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="min-h-[62%] max-h-[92%]">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <ScrollView style={{ width: "100%" }} contentContainerStyle={{ paddingBottom: 8 }}>
          <Box className="w-full gap-4 px-1">
            <Box className="gap-1">
              <Text className="text-xl font-bold text-typography-900">{exercise.title}</Text>
              <Text className="text-sm text-typography-500">
                {exercise.description?.trim() || "No description provided for this exercise."}
              </Text>
            </Box>

            <Box className="flex-row flex-wrap gap-2">
              <Box className="rounded-full px-3 py-1" style={{ backgroundColor: diffColors.bg }}>
                <Text
                  className="text-xs font-semibold"
                  style={{ color: diffColors.text, textTransform: "capitalize" }}
                >
                  {exercise.difficulty}
                </Text>
              </Box>
              <Box className="rounded-full px-3 py-1" style={{ backgroundColor: "#dbeafe" }}>
                <Text className="text-xs font-medium" style={{ color: "#1d4ed8" }}>
                  {typeText}
                </Text>
              </Box>
            </Box>

            <Box className="rounded-xl p-3 gap-1.5" style={{ backgroundColor: colors.borderLight }}>
              <Text className="text-xs font-semibold text-typography-500 uppercase tracking-wide">
                Workout
              </Text>
              <Text className="text-sm text-typography-700">
                {variables.sets ?? "-"} sets | {variables.reps ?? "-"} reps | load {displayLoad}
              </Text>
              <Text className="text-sm text-typography-700">
                Rep duration: {variables.durationSeconds ?? "-"}s
              </Text>
              <Text className="text-sm text-typography-700">
                Rep rest: {variables.restSeconds ?? "-"}s | Set rest: {setRest ?? "-"}s
              </Text>
            </Box>

            {hasHangDetails ? (
              <Box className="rounded-xl p-3 gap-1.5" style={{ backgroundColor: colors.primaryBg }}>
                <Text className="text-xs font-semibold text-typography-500 uppercase tracking-wide">
                  Hang details
                </Text>
                <Text className="text-sm text-typography-700">
                  Apparatus: {exercise.hangDetails?.apparatus ?? "not set"}
                </Text>
                <Text className="text-sm text-typography-700">
                  Edge:{" "}
                  {exercise.hangDetails?.edgeSizeMm
                    ? `${exercise.hangDetails.edgeSizeMm}mm`
                    : "not set"}
                </Text>
                <Text className="text-sm text-typography-700">
                  Crimp: {exercise.hangDetails?.crimpType ?? "not set"}
                </Text>
                <Text className="text-sm text-typography-700">
                  Load preference:{" "}
                  {exercise.hangDetails?.loadPreference
                    ? loadPreferenceLabel[exercise.hangDetails.loadPreference]
                    : "not set"}
                </Text>
              </Box>
            ) : null}

            <Box className="gap-1">
              <Text className="text-xs font-semibold text-typography-500 uppercase tracking-wide">
                Categories
              </Text>
              <Text className="text-sm text-typography-700">{categoriesText}</Text>
            </Box>

            <Box className="gap-1">
              <Text className="text-xs font-semibold text-typography-500 uppercase tracking-wide">
                Equipment
              </Text>
              <Text className="text-sm text-typography-700">{equipmentText}</Text>
            </Box>

            <Box className="gap-1">
              <Text className="text-xs font-semibold text-typography-500 uppercase tracking-wide">
                Tags
              </Text>
              <Text className="text-sm text-typography-700">{tagsText}</Text>
            </Box>

            {exercise.publisher?.username ? (
              <Text className="text-xs text-typography-500">By @{exercise.publisher.username}</Text>
            ) : null}
          </Box>
        </ScrollView>

        <Button variant="outline" className="w-full mt-3 rounded-xl" onPress={onClose}>
          <ButtonText>Close</ButtonText>
        </Button>
      </ActionsheetContent>
    </Actionsheet>
  );
}
