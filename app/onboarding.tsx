import React from "react";
import { KeyboardAvoidingView, Platform, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Button, ButtonText } from "@/components/ui/button";
import { colors, inputStyle } from "@/lib/theme";

function parseBodyWeight(value: string): number | undefined {
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }
  return parsed;
}

export default function OnboardingScreen() {
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const profile = useQuery(api.profiles.getMyProfile);
  const upsertProfile = useMutation(api.profiles.upsertMyProfile);
  const [username, setUsername] = React.useState("");
  const [bodyWeightKg, setBodyWeightKg] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const needsOnboarding =
    profile !== undefined &&
    (!profile?.username?.trim() || profile.bodyWeightKg === undefined || profile.bodyWeightKg <= 0);

  React.useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/");
      return;
    }
    if (profile === undefined || needsOnboarding) {
      return;
    }
    router.replace("/tabs/train");
  }, [isAuthenticated, needsOnboarding, profile, router]);

  React.useEffect(() => {
    if (profile === undefined) {
      return;
    }
    setUsername(profile?.username ?? "");
    setBodyWeightKg(profile?.bodyWeightKg ? String(profile.bodyWeightKg) : "");
  }, [profile]);

  const handleContinue = async () => {
    const trimmedUsername = username.trim();
    const parsedBodyWeightKg = parseBodyWeight(bodyWeightKg);

    if (!trimmedUsername) {
      setError("Username is required.");
      return;
    }
    if (parsedBodyWeightKg === undefined) {
      setError("Body weight must be a positive number.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await upsertProfile({
        username: trimmedUsername,
        bodyWeightKg: parsedBodyWeightKg,
        styles: profile?.styles ?? [],
        climbingAgeMonths: profile?.climbingAgeMonths,
        boulderingGrade: profile?.boulderingGrade,
        sportGrade: profile?.sportGrade,
        tradGrade: profile?.tradGrade,
        regions: profile?.regions ?? [],
        bio: profile?.bio,
        goals: profile?.goals,
        showProfilePublic: profile?.showProfilePublic ?? true,
        showHistoryPublic: profile?.showHistoryPublic ?? true,
      });
      router.replace("/tabs/train");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not save profile.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (profile === undefined) {
    return (
      <Box className="flex-1 items-center justify-center">
        <Text className="text-typography-500">Loading profile...</Text>
      </Box>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Box className="flex-1 justify-center px-6" style={{ backgroundColor: "#ffffff" }}>
        <Box className="gap-3 mb-8">
          <Text className="text-3xl font-bold text-typography-900">Welcome to Beta Break</Text>
          <Text className="text-typography-500">
            Add your username and body weight to personalize your training.
          </Text>
        </Box>

        <Box className="gap-3">
          {error ? (
            <Box className="rounded-xl p-3" style={{ backgroundColor: colors.errorBg }}>
              <Text className="text-error-600 text-sm">{error}</Text>
            </Box>
          ) : null}
          <TextInput
            placeholder="Username"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            value={username}
            onChangeText={setUsername}
            style={inputStyle}
          />
          <TextInput
            placeholder="Body weight (kg)"
            placeholderTextColor={colors.textMuted}
            keyboardType="numeric"
            value={bodyWeightKg}
            onChangeText={setBodyWeightKg}
            style={inputStyle}
          />
          <Button
            onPress={() => void handleContinue()}
            size="lg"
            className="rounded-xl"
            disabled={isSubmitting}
          >
            <ButtonText className="font-semibold">
              {isSubmitting ? "Saving..." : "Continue"}
            </ButtonText>
          </Button>
        </Box>
      </Box>
    </KeyboardAvoidingView>
  );
}
