import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
  SelectScrollView,
  SelectTrigger,
} from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { ChevronDown } from "lucide-react-native";
import { parseCommaSeparated, toCommaSeparated } from "@/lib/trainingItemFilters";
import { BOULDER_GRADES, ROPE_GRADES } from "@/lib/profileGrades";
import { cardShadow, colors, inputStyle, screenPadding } from "@/lib/theme";
import { showErrorMessage, useAppToast } from "@/lib/useAppToast";

const sectionCardStyle = {
  ...cardShadow,
  backgroundColor: colors.bgCard,
  borderRadius: 16,
  padding: 16,
  borderWidth: 1,
  borderColor: colors.border,
  gap: 12,
} as const;
const fieldLabelClassName = "text-xs text-typography-500 mb-1";
const gradeSelectSheetClassName = "max-h-[55%]";
const gradeSelectItemClassName = "py-2";
const BOULDER_FONT_GRADES: Record<string, string> = {
  VB: "3",
  V0: "4",
  V1: "5",
  V2: "5+",
  V3: "6A",
  V4: "6B",
  V5: "6C",
  V6: "6C+",
  V7: "7A",
  V8: "7B",
  V9: "7C",
  V10: "7C+",
  V11: "8A",
  V12: "8A+",
  V13: "8B",
  V14: "8B+",
  V15: "8C",
  V16: "8C+",
  V17: "9A",
};
const YDS_TO_FRENCH_GRADES: Record<string, string> = {
  "5.6": "4C",
  "5.7": "5A",
  "5.8": "5B",
  "5.9": "5C",
  "5.10a": "6A",
  "5.10b": "6A+",
  "5.10c": "6B",
  "5.10d": "6B+",
  "5.11a": "6C",
  "5.11b": "6C+",
  "5.11c": "7A",
  "5.11d": "7A+",
  "5.12a": "7B+",
  "5.12b": "7C",
  "5.12c": "7C+",
  "5.12d": "8A",
  "5.13a": "8A+",
  "5.13b": "8B",
  "5.13c": "8B+",
  "5.13d": "8C",
  "5.14a": "8C+",
  "5.14b": "9A",
  "5.14c": "9A+",
  "5.14d": "9B",
  "5.15a": "9B+",
  "5.15b": "9C",
  "5.15c": "9C+",
  "5.15d": "9C+/10A",
};

function formatBoulderingGradeLabel(grade: string): string {
  if (!grade) return "";
  const fontGrade = BOULDER_FONT_GRADES[grade];
  return fontGrade ? `${grade} (${fontGrade})` : grade;
}

function formatSportGradeLabel(grade: string): string {
  if (!grade) return "";
  const frenchGrade = YDS_TO_FRENCH_GRADES[grade];
  return frenchGrade ? `${frenchGrade} (${grade})` : grade;
}

type ProfileValues = {
  username?: string;
  bodyWeightKg?: number;
  styles: string[];
  climbingAgeMonths?: number;
  boulderingGrade?: string;
  sportGrade?: string;
  tradGrade?: string;
  regions: string[];
  bio?: string;
  goals?: string;
  showProfilePublic: boolean;
  showHistoryPublic: boolean;
};

type Props = {
  initialValues?: ProfileValues;
  onSubmit: (values: ProfileValues) => Promise<void>;
  onSignOut?: () => Promise<void> | void;
};

const CLIMBING_DISCIPLINE_OPTIONS = [
  { value: "bouldering", label: "Bouldering" },
  { value: "sport", label: "Sport" },
  { value: "trad", label: "Trad" },
] as const;

function parseOptionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toggleArrayValue(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];
}

function toDisciplineLabel(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter((entry) => entry.length > 0)
    .map((entry) => entry.charAt(0).toUpperCase() + entry.slice(1))
    .join(" ");
}

export function ProfileForm({ initialValues, onSubmit, onSignOut }: Props) {
  const insets = useSafeAreaInsets();
  const { success: showSuccessToast, error: showErrorToast } = useAppToast();
  const [username, setUsername] = React.useState(initialValues?.username ?? "");
  const [bodyWeightKg, setBodyWeightKg] = React.useState(
    initialValues?.bodyWeightKg?.toString() ?? "",
  );
  const [preferredDisciplines, setPreferredDisciplines] = React.useState<string[]>(() =>
    Array.from(
      new Set(
        (initialValues?.styles ?? [])
          .map((entry) => entry.trim())
          .filter((entry) => entry.length > 0),
      ),
    ),
  );
  const [climbingAgeMonths, setClimbingAgeMonths] = React.useState(
    initialValues?.climbingAgeMonths?.toString() ?? "",
  );
  const [boulderingGrade, setBoulderingGrade] = React.useState(
    initialValues?.boulderingGrade ?? "",
  );
  const [sportGrade, setSportGrade] = React.useState(initialValues?.sportGrade ?? "");
  const [tradGrade, setTradGrade] = React.useState(initialValues?.tradGrade ?? "");
  const [regionsInput, setRegionsInput] = React.useState(
    toCommaSeparated(initialValues?.regions ?? []),
  );
  const [bio, setBio] = React.useState(initialValues?.bio ?? "");
  const [goals, setGoals] = React.useState(initialValues?.goals ?? "");
  const [showProfilePublic, setShowProfilePublic] = React.useState(
    initialValues?.showProfilePublic ?? true,
  );
  const [showHistoryPublic, setShowHistoryPublic] = React.useState(
    initialValues?.showHistoryPublic ?? true,
  );
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSigningOut, setIsSigningOut] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const stickyFooterBottomPadding = insets.bottom + (Platform.OS === "ios" ? 56 : 64);
  const scrollBottomPadding = Math.max(screenPadding.paddingBottom, insets.bottom + 120);
  const disciplineOptions = React.useMemo(() => {
    const presetValues = new Set(CLIMBING_DISCIPLINE_OPTIONS.map((option) => option.value));
    const customOptions = preferredDisciplines
      .filter((value) => !presetValues.has(value))
      .map((value) => ({ value, label: toDisciplineLabel(value) }));
    return [...CLIMBING_DISCIPLINE_OPTIONS, ...customOptions];
  }, [preferredDisciplines]);

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit({
        username: username.trim() || undefined,
        bodyWeightKg: parseOptionalNumber(bodyWeightKg),
        styles: Array.from(
          new Set(
            preferredDisciplines.map((entry) => entry.trim()).filter((entry) => entry.length > 0),
          ),
        ),
        climbingAgeMonths: parseOptionalNumber(climbingAgeMonths),
        boulderingGrade: boulderingGrade.trim() || undefined,
        sportGrade: sportGrade.trim() || undefined,
        tradGrade: tradGrade.trim() || undefined,
        regions: parseCommaSeparated(regionsInput),
        bio: bio.trim() || undefined,
        goals: goals.trim() || undefined,
        showProfilePublic,
        showHistoryPublic,
      });
      showSuccessToast("Profile saved.");
    } catch (submitError) {
      const message = showErrorMessage(submitError, "Could not save profile.");
      setError(message);
      showErrorToast("Could not save profile", message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    if (!onSignOut) return;
    setError(null);
    setIsSigningOut(true);
    try {
      await onSignOut();
      showSuccessToast("Signed out.");
    } catch (signOutError) {
      const message = showErrorMessage(signOutError, "Could not sign out.");
      setError(message);
      showErrorToast("Could not sign out", message);
    } finally {
      setIsSigningOut(false);
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
          <PageHeader
            title="Profile"
            subtitle="Set your details, climbing background, and privacy settings."
          />

          <Box style={sectionCardStyle}>
            <Text className="text-base font-semibold text-typography-900">Identity</Text>
            <Text className={fieldLabelClassName}>Username</Text>
            <TextInput
              placeholder="Username (public, letters/numbers/_)"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              value={username}
              onChangeText={setUsername}
              style={inputStyle}
            />
          </Box>

          <Box style={sectionCardStyle}>
            <Text className="text-base font-semibold text-typography-900">Climbing Info</Text>
            <Text className={fieldLabelClassName}>Body weight (kg)</Text>
            <TextInput
              placeholder="Body weight (kg) * for personalized training loads"
              placeholderTextColor={colors.textMuted}
              value={bodyWeightKg}
              onChangeText={setBodyWeightKg}
              keyboardType="numeric"
              style={inputStyle}
            />
            <Text className={fieldLabelClassName}>Preferred discipline</Text>
            <Box className="flex-row flex-wrap gap-2">
              {disciplineOptions.map((discipline) => {
                const isActive = preferredDisciplines.includes(discipline.value);
                return (
                  <Pressable
                    key={discipline.value}
                    onPress={() =>
                      setPreferredDisciplines((prev) => toggleArrayValue(prev, discipline.value))
                    }
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 999,
                      backgroundColor: isActive ? colors.primary : colors.borderLight,
                    }}
                  >
                    <Text
                      style={{
                        color: isActive ? "#fff" : colors.text,
                        fontSize: 12,
                        fontWeight: "600",
                      }}
                    >
                      {discipline.label}
                    </Text>
                  </Pressable>
                );
              })}
            </Box>
            <Text className="text-xs text-typography-500">Select all that apply.</Text>
            <Text className={fieldLabelClassName}>Climbing experience (months)</Text>
            <TextInput
              placeholder="Climbing experience (months)"
              placeholderTextColor={colors.textMuted}
              value={climbingAgeMonths}
              onChangeText={setClimbingAgeMonths}
              keyboardType="numeric"
              style={inputStyle}
            />
            <Text className={fieldLabelClassName}>Regions climbed</Text>
            <TextInput
              placeholder="Regions climbed (comma separated)"
              placeholderTextColor={colors.textMuted}
              value={regionsInput}
              onChangeText={setRegionsInput}
              style={inputStyle}
            />
          </Box>

          <Box style={sectionCardStyle}>
            <Text className="text-base font-semibold text-typography-900">Best Grades</Text>
            <Box className="flex-row gap-2">
              <Box className="flex-1">
                <Text className="text-xs text-typography-500 mb-1">Bouldering</Text>
                <Select selectedValue={boulderingGrade} onValueChange={setBoulderingGrade}>
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
                      placeholder="Select"
                      value={formatBoulderingGradeLabel(boulderingGrade)}
                      className="flex-1 text-left"
                      style={{ textAlign: "left", color: colors.text }}
                    />
                    <SelectIcon as={ChevronDown} className="mr-2" />
                  </SelectTrigger>
                  <SelectPortal>
                    <SelectBackdrop />
                    <SelectContent className={gradeSelectSheetClassName}>
                      <SelectDragIndicatorWrapper>
                        <SelectDragIndicator />
                      </SelectDragIndicatorWrapper>
                      <SelectScrollView className="w-full">
                        <SelectItem
                          className={gradeSelectItemClassName}
                          label="Not set"
                          value=""
                        />
                        {BOULDER_GRADES.map((grade) => (
                          <SelectItem
                            className={gradeSelectItemClassName}
                            key={grade}
                            label={formatBoulderingGradeLabel(grade)}
                            value={grade}
                          />
                        ))}
                      </SelectScrollView>
                    </SelectContent>
                  </SelectPortal>
                </Select>
              </Box>
              <Box className="flex-1">
                <Text className="text-xs text-typography-500 mb-1">Sport</Text>
                <Select selectedValue={sportGrade} onValueChange={setSportGrade}>
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
                      placeholder="Select"
                      value={formatSportGradeLabel(sportGrade)}
                      className="flex-1 text-left"
                      style={{ textAlign: "left", color: colors.text }}
                    />
                    <SelectIcon as={ChevronDown} className="mr-2" />
                  </SelectTrigger>
                  <SelectPortal>
                    <SelectBackdrop />
                    <SelectContent className={gradeSelectSheetClassName}>
                      <SelectDragIndicatorWrapper>
                        <SelectDragIndicator />
                      </SelectDragIndicatorWrapper>
                      <SelectScrollView className="w-full">
                        <SelectItem
                          className={gradeSelectItemClassName}
                          label="Not set"
                          value=""
                        />
                        {ROPE_GRADES.map((grade) => (
                          <SelectItem
                            className={gradeSelectItemClassName}
                            key={grade}
                            label={formatSportGradeLabel(grade)}
                            value={grade}
                          />
                        ))}
                      </SelectScrollView>
                    </SelectContent>
                  </SelectPortal>
                </Select>
              </Box>
              <Box className="flex-1">
                <Text className="text-xs text-typography-500 mb-1">Trad</Text>
                <Select selectedValue={tradGrade} onValueChange={setTradGrade}>
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
                      placeholder="Select"
                      value={tradGrade}
                      className="flex-1 text-left"
                      style={{ textAlign: "left", color: colors.text }}
                    />
                    <SelectIcon as={ChevronDown} className="mr-2" />
                  </SelectTrigger>
                  <SelectPortal>
                    <SelectBackdrop />
                    <SelectContent className={gradeSelectSheetClassName}>
                      <SelectDragIndicatorWrapper>
                        <SelectDragIndicator />
                      </SelectDragIndicatorWrapper>
                      <SelectScrollView className="w-full">
                        <SelectItem
                          className={gradeSelectItemClassName}
                          label="Not set"
                          value=""
                        />
                        {ROPE_GRADES.map((grade) => (
                          <SelectItem
                            className={gradeSelectItemClassName}
                            key={grade}
                            label={grade}
                            value={grade}
                          />
                        ))}
                      </SelectScrollView>
                    </SelectContent>
                  </SelectPortal>
                </Select>
              </Box>
            </Box>
          </Box>

          <Box style={sectionCardStyle}>
            <Text className="text-base font-semibold text-typography-900">About</Text>
            <Text className={fieldLabelClassName}>Bio</Text>
            <TextInput
              placeholder="Bio"
              placeholderTextColor={colors.textMuted}
              multiline
              value={bio}
              onChangeText={setBio}
              style={{ ...inputStyle, minHeight: 72, textAlignVertical: "top" }}
            />
            <Text className={fieldLabelClassName}>Goals</Text>
            <TextInput
              placeholder="Goals"
              placeholderTextColor={colors.textMuted}
              multiline
              value={goals}
              onChangeText={setGoals}
              style={{ ...inputStyle, minHeight: 72, textAlignVertical: "top" }}
            />
          </Box>

          <Box style={sectionCardStyle}>
            <Text className="text-base font-semibold text-typography-900">Privacy</Text>
            <Pressable
              onPress={() => setShowProfilePublic(!showProfilePublic)}
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                backgroundColor: colors.borderLight,
                borderRadius: 12,
                padding: 14,
              }}
            >
              <Text className="text-typography-900 font-medium">Public profile</Text>
              <Switch
                value={showProfilePublic}
                onValueChange={setShowProfilePublic}
                trackColor={{ false: "#d1d5db", true: colors.primaryBg }}
                thumbColor={showProfilePublic ? colors.primary : "#f4f4f5"}
              />
            </Pressable>
            <Pressable
              onPress={() => setShowHistoryPublic(!showHistoryPublic)}
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                backgroundColor: colors.borderLight,
                borderRadius: 12,
                padding: 14,
              }}
            >
              <Text className="text-typography-900 font-medium">Public workout history</Text>
              <Switch
                value={showHistoryPublic}
                onValueChange={setShowHistoryPublic}
                trackColor={{ false: "#d1d5db", true: colors.primaryBg }}
                thumbColor={showHistoryPublic ? colors.primary : "#f4f4f5"}
              />
            </Pressable>
          </Box>

          {onSignOut ? (
            <Button
              className="rounded-xl"
              size="lg"
              variant="outline"
              onPress={() => void handleSignOut()}
              disabled={isSubmitting || isSigningOut}
            >
              <ButtonText className="font-semibold">
                {isSigningOut ? "Signing out..." : "Sign out"}
              </ButtonText>
            </Button>
          ) : null}
        </ScrollView>

        <Box
          style={{
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.bgCard,
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: stickyFooterBottomPadding,
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
            disabled={isSubmitting || isSigningOut}
          >
            <ButtonText className="font-semibold">
              {isSubmitting ? "Saving..." : "Save profile"}
            </ButtonText>
          </Button>
        </Box>
      </Box>
    </KeyboardAvoidingView>
  );
}

export type { ProfileValues };
