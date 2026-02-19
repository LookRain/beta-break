import React from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Button, ButtonText } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { parseCommaSeparated, toCommaSeparated } from "@/lib/trainingItemFilters";
import { cardShadow, colors, inputStyle, screenPadding } from "@/lib/theme";

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

function parseOptionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function ProfileForm({ initialValues, onSubmit, onSignOut }: Props) {
  const insets = useSafeAreaInsets();
  const [username, setUsername] = React.useState(initialValues?.username ?? "");
  const [bodyWeightKg, setBodyWeightKg] = React.useState(initialValues?.bodyWeightKg?.toString() ?? "");
  const [stylesInput, setStylesInput] = React.useState(toCommaSeparated(initialValues?.styles ?? []));
  const [climbingAgeMonths, setClimbingAgeMonths] = React.useState(initialValues?.climbingAgeMonths?.toString() ?? "");
  const [boulderingGrade, setBoulderingGrade] = React.useState(initialValues?.boulderingGrade ?? "");
  const [sportGrade, setSportGrade] = React.useState(initialValues?.sportGrade ?? "");
  const [tradGrade, setTradGrade] = React.useState(initialValues?.tradGrade ?? "");
  const [regionsInput, setRegionsInput] = React.useState(toCommaSeparated(initialValues?.regions ?? []));
  const [bio, setBio] = React.useState(initialValues?.bio ?? "");
  const [goals, setGoals] = React.useState(initialValues?.goals ?? "");
  const [showProfilePublic, setShowProfilePublic] = React.useState(initialValues?.showProfilePublic ?? true);
  const [showHistoryPublic, setShowHistoryPublic] = React.useState(initialValues?.showHistoryPublic ?? true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSigningOut, setIsSigningOut] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const stickyFooterBottomPadding = insets.bottom + (Platform.OS === "ios" ? 56 : 64);
  const scrollBottomPadding = Math.max(screenPadding.paddingBottom, insets.bottom + 120);

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit({
        username: username.trim() || undefined,
        bodyWeightKg: parseOptionalNumber(bodyWeightKg),
        styles: parseCommaSeparated(stylesInput),
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
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not save profile.");
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
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : "Could not sign out.");
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
            <Text className={fieldLabelClassName}>Styles</Text>
            <TextInput
              placeholder="Styles (bouldering, sport, trad)"
              placeholderTextColor={colors.textMuted}
              value={stylesInput}
              onChangeText={setStylesInput}
              style={inputStyle}
            />
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
                <TextInput
                  placeholder="e.g. V7"
                  placeholderTextColor={colors.textMuted}
                  value={boulderingGrade}
                  onChangeText={setBoulderingGrade}
                  style={inputStyle}
                />
              </Box>
              <Box className="flex-1">
                <Text className="text-xs text-typography-500 mb-1">Sport</Text>
                <TextInput
                  placeholder="e.g. 7a+"
                  placeholderTextColor={colors.textMuted}
                  value={sportGrade}
                  onChangeText={setSportGrade}
                  style={inputStyle}
                />
              </Box>
              <Box className="flex-1">
                <Text className="text-xs text-typography-500 mb-1">Trad</Text>
                <TextInput
                  placeholder="e.g. 5.10"
                  placeholderTextColor={colors.textMuted}
                  value={tradGrade}
                  onChangeText={setTradGrade}
                  style={inputStyle}
                />
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
