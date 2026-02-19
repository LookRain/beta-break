import React from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { ChevronDown } from "lucide-react-native";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Button, ButtonText } from "@/components/ui/button";
import {
  Select,
  SelectBackdrop,
  SelectContent,
  SelectDragIndicator,
  SelectDragIndicatorWrapper,
  SelectIcon,
  SelectInput,
  SelectItem,
  SelectPortal,
  SelectTrigger,
} from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import {
  HANG_CRIMP_TYPES,
  HANG_EDGE_MM_OPTIONS,
  HANG_EQUIPMENT_OPTIONS,
  parseCommaSeparated,
  toCommaSeparated,
  TRAINING_CATEGORIES,
  TRAINING_DIFFICULTIES,
  TRAINING_EQUIPMENT_PRESETS,
  TRAINING_TYPES,
  TrainingDifficulty,
  TrainingType,
} from "@/lib/trainingItemFilters";
import { cardShadow, colors, inputStyle, screenPadding } from "@/lib/theme";
import { showErrorMessage, useAppToast } from "@/lib/useAppToast";

type TrainingItemFormValues = {
  title: string;
  description?: string;
  category: string;
  tags: string[];
  variables: {
    weight?: number;
    reps?: number;
    sets?: number;
    restSeconds?: number;
    durationSeconds?: number;
  };
  trainingType?: TrainingType;
  hangDetails?: {
    apparatus: "fingerboard" | "bar";
    edgeSizeMm?: 8 | 10 | 15 | 20 | 25;
    crimpType?: "open" | "half" | "full";
    loadPreference?: "below_100" | "above_100";
  };
  difficulty: TrainingDifficulty;
  equipment: string[];
};

type Props = {
  initialValues?: TrainingItemFormValues;
  submitLabel: string;
  onSubmit: (values: TrainingItemFormValues) => Promise<void>;
  disabled?: boolean;
};

function parseOptionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toggleArrayValue(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];
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

const difficultyColors: Record<string, { bg: string; text: string; activeBg: string }> = {
  beginner: { bg: colors.borderLight, text: colors.text, activeBg: "#0d9488" },
  intermediate: { bg: colors.borderLight, text: colors.text, activeBg: "#d97706" },
  advanced: { bg: colors.borderLight, text: colors.text, activeBg: "#dc2626" },
};

const presetFieldValues = {
  sets: ["3", "4", "5", "6"],
  reps: ["5", "7", "10", "12"],
  restSeconds: ["60", "90", "120", "180"],
  durationSeconds: ["7", "10", "20", "30"],
};

const trainingTypeLabel: Record<TrainingType, string> = {
  hang: "Hang",
  weight_training: "Weight training",
  climbing: "Climbing",
  others: "Others",
};

const sectionCardStyle = {
  ...cardShadow,
  backgroundColor: colors.bgCard,
  borderRadius: 16,
  padding: 16,
  borderWidth: 1,
  borderColor: colors.border,
  gap: 12,
} as const;

export function TrainingItemForm({
  initialValues,
  submitLabel,
  onSubmit,
  disabled = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { success: showSuccessToast, error: showErrorToast } = useAppToast();
  const profile = useQuery(api.profiles.getMyProfile);
  const initialCategory = initialValues?.category ?? TRAINING_CATEGORIES[0];
  const initialUsesCustomCategory = !TRAINING_CATEGORIES.includes(
    initialCategory as (typeof TRAINING_CATEGORIES)[number],
  );
  const initialCustomEquipment = (initialValues?.equipment ?? [])
    .filter(
      (entry) =>
        !TRAINING_EQUIPMENT_PRESETS.includes(entry as (typeof TRAINING_EQUIPMENT_PRESETS)[number]),
    )
    .join(", ");
  const [title, setTitle] = React.useState(initialValues?.title ?? "");
  const [description, setDescription] = React.useState(initialValues?.description ?? "");
  const [selectedCategory, setSelectedCategory] = React.useState(
    initialUsesCustomCategory ? TRAINING_CATEGORIES[0] : initialCategory,
  );
  const [isCustomCategory, setIsCustomCategory] = React.useState(initialUsesCustomCategory);
  const [customCategory, setCustomCategory] = React.useState(
    initialUsesCustomCategory ? initialCategory : "",
  );
  const [tagsInput, setTagsInput] = React.useState(toCommaSeparated(initialValues?.tags ?? []));
  const [trainingType, setTrainingType] = React.useState<TrainingType | undefined>(
    initialValues?.trainingType,
  );
  const [equipment, setEquipment] = React.useState<string[]>(
    (initialValues?.equipment ?? []).filter((entry) =>
      TRAINING_EQUIPMENT_PRESETS.includes(entry as (typeof TRAINING_EQUIPMENT_PRESETS)[number]),
    ),
  );
  const [customEquipment, setCustomEquipment] = React.useState(initialCustomEquipment);
  const [difficulty, setDifficulty] = React.useState<TrainingDifficulty>(
    initialValues?.difficulty ?? "beginner",
  );
  const [weightInputMode, setWeightInputMode] = React.useState<"percent" | "absolute">("percent");
  const [weight, setWeight] = React.useState(initialValues?.variables.weight?.toString() ?? "");
  const [reps, setReps] = React.useState(initialValues?.variables.reps?.toString() ?? "7");
  const [sets, setSets] = React.useState(initialValues?.variables.sets?.toString() ?? "6");
  const [restSeconds, setRestSeconds] = React.useState(
    initialValues?.variables.restSeconds?.toString() ?? "120",
  );
  const [durationSeconds, setDurationSeconds] = React.useState(
    initialValues?.variables.durationSeconds?.toString() ?? "7",
  );
  const [hangApparatus, setHangApparatus] = React.useState<"fingerboard" | "bar">(
    initialValues?.hangDetails?.apparatus ?? "fingerboard",
  );
  const [hangEdgeSizeMm, setHangEdgeSizeMm] = React.useState<8 | 10 | 15 | 20 | 25 | undefined>(
    initialValues?.hangDetails?.edgeSizeMm,
  );
  const [hangCrimpType, setHangCrimpType] = React.useState<"open" | "half" | "full" | undefined>(
    initialValues?.hangDetails?.crimpType,
  );
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showTagsField, setShowTagsField] = React.useState(Boolean(initialValues?.tags?.length));
  const [showCustomEquipmentField, setShowCustomEquipmentField] = React.useState(
    Boolean(initialCustomEquipment),
  );
  const [showStructureQuickPicks, setShowStructureQuickPicks] = React.useState(false);
  const scrollBottomPadding = Math.max(128, insets.bottom + 180);

  const handleWeightInputModeChange = (nextMode: "percent" | "absolute") => {
    if (nextMode === weightInputMode) {
      return;
    }
    setWeight((previous) =>
      convertWeightValue(previous, weightInputMode, nextMode, profile?.bodyWeightKg),
    );
    setWeightInputMode(nextMode);
  };

  const handleSubmit = async () => {
    const finalCategory = isCustomCategory ? customCategory.trim() : selectedCategory.trim();
    if (!title.trim() || !finalCategory) {
      setError("Title and category are required.");
      return;
    }
    const parsedWeight = parseOptionalNumber(weight);
    const bodyWeightKg = profile?.bodyWeightKg;
    const weightPercent =
      parsedWeight === undefined
        ? undefined
        : weightInputMode === "percent"
          ? parsedWeight
          : bodyWeightKg && bodyWeightKg > 0
            ? (parsedWeight / bodyWeightKg) * 100
            : undefined;

    if (
      parsedWeight !== undefined &&
      weightInputMode === "absolute" &&
      weightPercent === undefined
    ) {
      setError(
        "Body weight is required before saving absolute loads. Open your profile and add body weight.",
      );
      return;
    }

    const normalizedEquipment = parseCommaSeparated(
      [...equipment, customEquipment.trim()].filter(Boolean).join(","),
    );
    const finalEquipment =
      trainingType === "hang" && hangApparatus
        ? Array.from(new Set([...normalizedEquipment, hangApparatus]))
        : normalizedEquipment;

    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || undefined,
        category: finalCategory,
        tags: parseCommaSeparated(tagsInput),
        trainingType,
        hangDetails:
          trainingType === "hang"
            ? {
                apparatus: hangApparatus,
                edgeSizeMm: hangApparatus === "fingerboard" ? hangEdgeSizeMm : undefined,
                crimpType: hangApparatus === "fingerboard" ? hangCrimpType : undefined,
                loadPreference: initialValues?.hangDetails?.loadPreference,
              }
            : undefined,
        difficulty,
        equipment: finalEquipment,
        variables: {
          weight: weightPercent === undefined ? undefined : Number(weightPercent.toFixed(2)),
          reps: parseOptionalNumber(reps),
          sets: parseOptionalNumber(sets),
          restSeconds: parseOptionalNumber(restSeconds),
          durationSeconds: parseOptionalNumber(durationSeconds),
        },
      });
      showSuccessToast("Exercise saved.");
    } catch (submitError) {
      const message = showErrorMessage(submitError, "Could not save exercise.");
      setError(message);
      showErrorToast("Could not save exercise", message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Box className="flex-1" style={{ backgroundColor: colors.bg }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ ...screenPadding, gap: 14, paddingBottom: scrollBottomPadding }}
        >
          <Box style={sectionCardStyle}>
            <Text className="text-base font-semibold text-typography-900">Essentials</Text>
            <TextInput
              editable={!disabled}
              placeholder="Exercise name *"
              placeholderTextColor={colors.textMuted}
              value={title}
              onChangeText={setTitle}
              style={inputStyle}
            />
            <Select
              selectedValue={trainingType}
              isDisabled={disabled}
              onValueChange={(value) => setTrainingType(value as TrainingType)}
            >
              <SelectTrigger
                variant="outline"
                size="lg"
                className="w-full justify-between"
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  minHeight: 50,
                  backgroundColor: colors.bgCard,
                  paddingHorizontal: 0,
                }}
              >
                <SelectInput
                  placeholder="Training type"
                  value={trainingType ? trainingTypeLabel[trainingType] : ""}
                  className="flex-1 text-left"
                  style={{ textAlign: "left", color: colors.text }}
                />
                <SelectIcon as={ChevronDown} className="mr-0" />
              </SelectTrigger>
              <SelectPortal>
                <SelectBackdrop />
                <SelectContent>
                  <SelectDragIndicatorWrapper>
                    <SelectDragIndicator />
                  </SelectDragIndicatorWrapper>
                  {TRAINING_TYPES.map((option) => (
                    <SelectItem key={option} label={trainingTypeLabel[option]} value={option} />
                  ))}
                </SelectContent>
              </SelectPortal>
            </Select>
            <Box className="gap-2">
              <Text className="text-xs font-medium text-typography-600">Category *</Text>
              <Box className="flex-row flex-wrap gap-2">
                {TRAINING_CATEGORIES.map((presetCategory) => {
                  const isActive = !isCustomCategory && selectedCategory === presetCategory;
                  return (
                    <Pressable
                      key={presetCategory}
                      onPress={() => {
                        if (disabled) return;
                        setSelectedCategory(presetCategory);
                        setIsCustomCategory(false);
                      }}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 999,
                        backgroundColor: isActive ? colors.primary : colors.borderLight,
                        opacity: disabled ? 0.6 : 1,
                      }}
                    >
                      <Text
                        style={{
                          color: isActive ? "#fff" : colors.text,
                          fontSize: 12,
                          fontWeight: "600",
                        }}
                      >
                        {presetCategory}
                      </Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  onPress={() => !disabled && setIsCustomCategory(true)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: isCustomCategory ? colors.primary : colors.borderLight,
                    opacity: disabled ? 0.6 : 1,
                  }}
                >
                  <Text
                    style={{
                      color: isCustomCategory ? "#fff" : colors.text,
                      fontSize: 12,
                      fontWeight: "600",
                    }}
                  >
                    Other
                  </Text>
                </Pressable>
              </Box>
              {isCustomCategory ? (
                <TextInput
                  editable={!disabled}
                  placeholder="Custom category"
                  placeholderTextColor={colors.textMuted}
                  value={customCategory}
                  onChangeText={setCustomCategory}
                  style={inputStyle}
                />
              ) : null}
            </Box>
            <TextInput
              editable={!disabled}
              placeholder="Description"
              placeholderTextColor={colors.textMuted}
              multiline
              value={description}
              onChangeText={setDescription}
              style={{ ...inputStyle, minHeight: 72, textAlignVertical: "top" }}
            />
          </Box>

          <Box style={sectionCardStyle}>
            <Text className="text-base font-semibold text-typography-900">Difficulty</Text>
            <Box className="flex-row gap-2">
              {TRAINING_DIFFICULTIES.map((option) => {
                const isActive = difficulty === option;
                const dc = difficultyColors[option];
                return (
                  <Pressable
                    key={option}
                    onPress={() => !disabled && setDifficulty(option)}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 12,
                      alignItems: "center",
                      backgroundColor: isActive ? dc.activeBg : dc.bg,
                      opacity: disabled ? 0.5 : 1,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "600",
                        color: isActive ? "#fff" : dc.text,
                        textTransform: "capitalize",
                      }}
                    >
                      {option}
                    </Text>
                  </Pressable>
                );
              })}
            </Box>
          </Box>

          <Box style={sectionCardStyle}>
            <Text className="text-base font-semibold text-typography-900">Workout Parameters</Text>
            <Box className="flex-row gap-2">
              <Box className="flex-1">
                <Text className="text-xs text-typography-500 mb-1">Sets</Text>
                <TextInput
                  editable={!disabled}
                  placeholder="—"
                  placeholderTextColor={colors.textMuted}
                  value={sets}
                  onChangeText={setSets}
                  keyboardType="numeric"
                  style={inputStyle}
                />
              </Box>
              <Box className="flex-1">
                <Text className="text-xs text-typography-500 mb-1">Reps</Text>
                <TextInput
                  editable={!disabled}
                  placeholder="—"
                  placeholderTextColor={colors.textMuted}
                  value={reps}
                  onChangeText={setReps}
                  keyboardType="numeric"
                  style={inputStyle}
                />
              </Box>
            </Box>
            <Box className="flex-row gap-2">
              <Box className="flex-1">
                <Text className="text-xs text-typography-500 mb-1">Rest (s)</Text>
                <TextInput
                  editable={!disabled}
                  placeholder="—"
                  placeholderTextColor={colors.textMuted}
                  value={restSeconds}
                  onChangeText={setRestSeconds}
                  keyboardType="numeric"
                  style={inputStyle}
                />
              </Box>
              <Box className="flex-1">
                <Text className="text-xs text-typography-500 mb-1">Duration (s)</Text>
                <TextInput
                  editable={!disabled}
                  placeholder="—"
                  placeholderTextColor={colors.textMuted}
                  value={durationSeconds}
                  onChangeText={setDurationSeconds}
                  keyboardType="numeric"
                  style={inputStyle}
                />
              </Box>
            </Box>
            <Pressable
              onPress={() => !disabled && setShowStructureQuickPicks((previous) => !previous)}
            >
              <Text className="text-sm font-medium" style={{ color: colors.primary }}>
                {showStructureQuickPicks ? "Hide quick picks" : "+ Show quick picks"}
              </Text>
            </Pressable>
            {showStructureQuickPicks ? (
              <Box className="gap-2">
                <Box className="flex-row gap-1 flex-wrap">
                  {presetFieldValues.sets.map((entry) => (
                    <Pressable
                      key={`sets-${entry}`}
                      onPress={() => !disabled && setSets(entry)}
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 999,
                        backgroundColor: sets === entry ? colors.primary : colors.borderLight,
                      }}
                    >
                      <Text style={{ color: sets === entry ? "#fff" : colors.text, fontSize: 11 }}>
                        Sets {entry}
                      </Text>
                    </Pressable>
                  ))}
                  {presetFieldValues.reps.map((entry) => (
                    <Pressable
                      key={`reps-${entry}`}
                      onPress={() => !disabled && setReps(entry)}
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 999,
                        backgroundColor: reps === entry ? colors.primary : colors.borderLight,
                      }}
                    >
                      <Text style={{ color: reps === entry ? "#fff" : colors.text, fontSize: 11 }}>
                        Reps {entry}
                      </Text>
                    </Pressable>
                  ))}
                </Box>
                <Box className="flex-row gap-1 flex-wrap">
                  {presetFieldValues.restSeconds.map((entry) => (
                    <Pressable
                      key={`rest-${entry}`}
                      onPress={() => !disabled && setRestSeconds(entry)}
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 999,
                        backgroundColor:
                          restSeconds === entry ? colors.primary : colors.borderLight,
                      }}
                    >
                      <Text
                        style={{
                          color: restSeconds === entry ? "#fff" : colors.text,
                          fontSize: 11,
                        }}
                      >
                        Rest {entry}s
                      </Text>
                    </Pressable>
                  ))}
                  {presetFieldValues.durationSeconds.map((entry) => (
                    <Pressable
                      key={`duration-${entry}`}
                      onPress={() => !disabled && setDurationSeconds(entry)}
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 999,
                        backgroundColor:
                          durationSeconds === entry ? colors.primary : colors.borderLight,
                      }}
                    >
                      <Text
                        style={{
                          color: durationSeconds === entry ? "#fff" : colors.text,
                          fontSize: 11,
                        }}
                      >
                        Duration {entry}s
                      </Text>
                    </Pressable>
                  ))}
                </Box>
              </Box>
            ) : null}
          </Box>

          {trainingType === "hang" ? (
            <Box style={sectionCardStyle}>
              <Text className="text-base font-semibold text-typography-900">Hang Details</Text>
              <Box className="flex-row gap-2">
                {HANG_EQUIPMENT_OPTIONS.map((option) => {
                  const isActive = hangApparatus === option;
                  return (
                    <Pressable
                      key={option}
                      onPress={() => !disabled && setHangApparatus(option)}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 12,
                        alignItems: "center",
                        backgroundColor: isActive ? colors.primary : colors.borderLight,
                        opacity: disabled ? 0.6 : 1,
                      }}
                    >
                      <Text
                        style={{
                          color: isActive ? "#fff" : colors.text,
                          fontSize: 13,
                          fontWeight: "600",
                        }}
                      >
                        {option}
                      </Text>
                    </Pressable>
                  );
                })}
              </Box>
              {hangApparatus === "fingerboard" ? (
                <>
                  <Text className="text-xs text-typography-500">Edge (mm)</Text>
                  <Box className="flex-row gap-2 flex-wrap">
                    {HANG_EDGE_MM_OPTIONS.map((edge) => {
                      const isActive = hangEdgeSizeMm === edge;
                      return (
                        <Pressable
                          key={edge}
                          onPress={() => !disabled && setHangEdgeSizeMm(edge)}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 999,
                            backgroundColor: isActive ? colors.primary : colors.borderLight,
                            opacity: disabled ? 0.6 : 1,
                          }}
                        >
                          <Text
                            style={{
                              color: isActive ? "#fff" : colors.text,
                              fontSize: 12,
                              fontWeight: "600",
                            }}
                          >
                            {edge}mm
                          </Text>
                        </Pressable>
                      );
                    })}
                  </Box>
                  <Text className="text-xs text-typography-500">Crimp type</Text>
                  <Box className="flex-row gap-2 flex-wrap">
                    {HANG_CRIMP_TYPES.map((crimp) => {
                      const isActive = hangCrimpType === crimp;
                      return (
                        <Pressable
                          key={crimp}
                          onPress={() => !disabled && setHangCrimpType(crimp)}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 999,
                            backgroundColor: isActive ? colors.primary : colors.borderLight,
                            opacity: disabled ? 0.6 : 1,
                          }}
                        >
                          <Text
                            style={{
                              color: isActive ? "#fff" : colors.text,
                              fontSize: 12,
                              fontWeight: "600",
                            }}
                          >
                            {crimp}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </Box>
                </>
              ) : null}
            </Box>
          ) : null}

          <Box style={sectionCardStyle}>
            <Text className="text-base font-semibold text-typography-900">Load</Text>
            <Text className="text-xs text-typography-500">
              Usually for hang exercises: 100% means no extra weight, 80% means assisted (band or
              feet on ground), and 120% means added weight.
            </Text>
            {profile?.bodyWeightKg ? (
              <Text className="text-xs text-typography-500">
                Your body weight: {profile.bodyWeightKg}kg
              </Text>
            ) : (
              <Box className="rounded-xl p-3" style={{ backgroundColor: colors.accentBg }}>
                <Text className="text-xs mb-2" style={{ color: colors.accent }}>
                  Add your body weight in Profile to unlock personalized exercise loads.
                </Text>
                <Button variant="outline" size="sm" onPress={() => router.push("/tabs/profile")}>
                  <ButtonText>Open profile panel</ButtonText>
                </Button>
              </Box>
            )}
            <Box className="flex-row gap-2">
              <Pressable
                onPress={() => !disabled && handleWeightInputModeChange("percent")}
                style={{
                  flex: 1,
                  borderRadius: 12,
                  paddingVertical: 10,
                  alignItems: "center",
                  backgroundColor:
                    weightInputMode === "percent" ? colors.primary : colors.borderLight,
                  opacity: disabled ? 0.6 : 1,
                }}
              >
                <Text
                  style={{
                    color: weightInputMode === "percent" ? "#fff" : colors.text,
                    fontWeight: "600",
                    fontSize: 13,
                  }}
                >
                  % bodyweight
                </Text>
              </Pressable>
              <Pressable
                onPress={() => !disabled && handleWeightInputModeChange("absolute")}
                style={{
                  flex: 1,
                  borderRadius: 12,
                  paddingVertical: 10,
                  alignItems: "center",
                  backgroundColor:
                    weightInputMode === "absolute" ? colors.primary : colors.borderLight,
                  opacity: disabled ? 0.6 : 1,
                }}
              >
                <Text
                  style={{
                    color: weightInputMode === "absolute" ? "#fff" : colors.text,
                    fontWeight: "600",
                    fontSize: 13,
                  }}
                >
                  kg absolute
                </Text>
              </Pressable>
            </Box>
            <TextInput
              editable={!disabled}
              placeholder={weightInputMode === "percent" ? "Load (% BW)" : "Load (kg)"}
              placeholderTextColor={colors.textMuted}
              value={weight}
              onChangeText={setWeight}
              keyboardType="numeric"
              style={inputStyle}
            />
          </Box>

          <Box style={sectionCardStyle}>
            <Text className="text-base font-semibold text-typography-900">Equipment & Tags</Text>
            <Box className="flex-row flex-wrap gap-2">
              {TRAINING_EQUIPMENT_PRESETS.map((entry) => {
                const isActive = equipment.includes(entry);
                return (
                  <Pressable
                    key={entry}
                    onPress={() =>
                      !disabled && setEquipment((prev) => toggleArrayValue(prev, entry))
                    }
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 999,
                      backgroundColor: isActive ? colors.primary : colors.borderLight,
                      opacity: disabled ? 0.6 : 1,
                    }}
                  >
                    <Text
                      style={{
                        color: isActive ? "#fff" : colors.text,
                        fontSize: 12,
                        fontWeight: "600",
                      }}
                    >
                      {entry}
                    </Text>
                  </Pressable>
                );
              })}
            </Box>
            <Pressable
              onPress={() => !disabled && setShowCustomEquipmentField((previous) => !previous)}
            >
              <Text className="text-sm font-medium" style={{ color: colors.primary }}>
                {showCustomEquipmentField ? "Hide custom equipment" : "+ Add custom equipment"}
              </Text>
            </Pressable>
            {showCustomEquipmentField ? (
              <TextInput
                editable={!disabled}
                placeholder="Custom equipment (comma separated)"
                placeholderTextColor={colors.textMuted}
                value={customEquipment}
                onChangeText={setCustomEquipment}
                style={inputStyle}
              />
            ) : null}
            <Pressable onPress={() => !disabled && setShowTagsField((previous) => !previous)}>
              <Text className="text-sm font-medium" style={{ color: colors.primary }}>
                {showTagsField ? "Hide tags" : "+ Add tags"}
              </Text>
            </Pressable>
            {showTagsField ? (
              <TextInput
                editable={!disabled}
                placeholder="Tags (comma separated)"
                placeholderTextColor={colors.textMuted}
                value={tagsInput}
                onChangeText={setTagsInput}
                style={inputStyle}
              />
            ) : null}
          </Box>
        </ScrollView>

        <Box
          style={{
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.bgCard,
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 20,
            gap: 8,
          }}
        >
          {error ? (
            <Box className="rounded-xl p-3" style={{ backgroundColor: colors.errorBg }}>
              <Text className="text-error-600 text-sm">{error}</Text>
            </Box>
          ) : null}
          <Button
            className="rounded-xl"
            size="lg"
            onPress={() => void handleSubmit()}
            disabled={disabled || isSubmitting}
          >
            <ButtonText className="font-semibold">
              {isSubmitting ? "Saving..." : submitLabel}
            </ButtonText>
          </Button>
        </Box>
      </Box>
    </KeyboardAvoidingView>
  );
}

export type { TrainingItemFormValues };
