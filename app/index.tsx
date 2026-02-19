import React from "react";
import { KeyboardAvoidingView, Platform, TextInput } from "react-native";
import { useGlobalSearchParams, useRouter } from "expo-router";
import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { makeRedirectUri } from "expo-auth-session";
import { openAuthSessionAsync } from "expo-web-browser";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Button, ButtonText } from "@/components/ui/button";
import { Mountain } from "lucide-react-native";
import { colors, inputStyle } from "@/lib/theme";
import { api } from "@/convex/_generated/api";

const redirectTo = makeRedirectUri({ scheme: "betabreak" });

export default function Home() {
  const router = useRouter();
  const params = useGlobalSearchParams<{ code?: string | string[] }>();
  const { signIn, signOut } = useAuthActions();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const profile = useQuery(api.profiles.getMyProfile);
  const [authError, setAuthError] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [passwordFlow, setPasswordFlow] = React.useState<"signIn" | "signUp">(
    "signIn",
  );
  const [isAuthSubmitting, setIsAuthSubmitting] = React.useState(false);
  const needsOnboarding =
    isAuthenticated &&
    profile !== undefined &&
    (!profile?.username?.trim() || profile.bodyWeightKg === undefined || profile.bodyWeightKg <= 0);

  React.useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    if (profile === undefined) {
      return;
    }
    router.replace(needsOnboarding ? "/onboarding" : "/tabs/train");
  }, [isAuthenticated, needsOnboarding, profile, router]);

  React.useEffect(() => {
    const codeParam = params.code;
    const code = Array.isArray(codeParam) ? codeParam[0] : codeParam;
    if (!code || isAuthenticated) {
      return;
    }

    let cancelled = false;
    const finishSignIn = async () => {
      try {
        await signIn("google", { code });
      } catch (error) {
        if (!cancelled) {
          setAuthError(error instanceof Error ? error.message : "Could not complete Google sign-in.");
        }
      }
    };

    void finishSignIn();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, params.code, signIn]);

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    try {
      const { redirect } = await signIn("google", { redirectTo });
      if (Platform.OS === "web") {
        return;
      }
      if (!redirect) {
        throw new Error("Google redirect URL is missing");
      }
      const result = await openAuthSessionAsync(redirect.toString(), redirectTo);
      if (result.type === "success") {
        const code = new URL(result.url).searchParams.get("code");
        if (code) {
          await signIn("google", { code });
        }
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Could not start Google sign-in.");
    }
  };

  const handlePasswordAuth = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setAuthError("Email is required.");
      return;
    }
    if (!password) {
      setAuthError("Password is required.");
      return;
    }

    setAuthError(null);
    setIsAuthSubmitting(true);
    try {
      await signIn("password", {
        email: trimmedEmail,
        password,
        flow: passwordFlow,
      });
    } catch (error) {
      setAuthError(
        error instanceof Error
          ? error.message
          : `Could not ${passwordFlow === "signIn" ? "sign in" : "sign up"} with email.`,
      );
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Box className="flex-1 items-center justify-center px-8" style={{ backgroundColor: "#ffffff" }}>
        <Box className="items-center gap-3 mb-12">
          <Box
            className="items-center justify-center rounded-3xl mb-2"
            style={{ width: 80, height: 80, backgroundColor: colors.primaryBg }}
          >
            <Mountain size={40} color={colors.primary} strokeWidth={2} />
          </Box>
          <Text className="text-4xl font-bold text-typography-900" style={{ letterSpacing: -0.5 }}>
            Beta Break
          </Text>
          <Text className="text-center text-typography-500 text-base" style={{ maxWidth: 260, lineHeight: 22 }}>
            Plan your climbing training.{"\n"}Track progress. Get stronger.
          </Text>
        </Box>

        <Box className="w-full gap-3" style={{ maxWidth: 320 }}>
          {authError ? (
            <Box className="rounded-xl p-3" style={{ backgroundColor: colors.errorBg }}>
              <Text className="text-error-600 text-center text-sm">{authError}</Text>
            </Box>
          ) : null}
          {isAuthenticated ? (
            <Button
              onPress={() => void signOut()}
              size="lg"
              className="rounded-xl"
            >
              <ButtonText className="font-semibold">Sign out</ButtonText>
            </Button>
          ) : (
            <>
              <TextInput
                placeholder="Email"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                style={inputStyle}
              />
              <TextInput
                placeholder="Password"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                style={inputStyle}
              />
              <Button
                onPress={() => void handlePasswordAuth()}
                size="lg"
                className="rounded-xl"
                disabled={isLoading || isAuthSubmitting}
              >
                <ButtonText className="font-semibold">
                  {isAuthSubmitting
                    ? passwordFlow === "signIn"
                      ? "Signing in..."
                      : "Signing up..."
                    : passwordFlow === "signIn"
                      ? "Sign in with email"
                      : "Sign up with email"}
                </ButtonText>
              </Button>
              <Button
                onPress={() =>
                  setPasswordFlow((prev) => (prev === "signIn" ? "signUp" : "signIn"))
                }
                variant="outline"
                size="lg"
                className="rounded-xl"
                disabled={isLoading || isAuthSubmitting}
              >
                <ButtonText className="font-semibold">
                  {passwordFlow === "signIn"
                    ? "Need an account? Switch to sign up"
                    : "Have an account? Switch to sign in"}
                </ButtonText>
              </Button>
              <Button
                onPress={() => void handleGoogleSignIn()}
                size="lg"
                className="rounded-xl"
                disabled={isLoading || isAuthSubmitting}
              >
                <ButtonText className="font-semibold">
                  {isLoading ? "Checking session..." : "Continue with Google"}
                </ButtonText>
              </Button>
            </>
          )}
        </Box>
      </Box>
    </KeyboardAvoidingView>
  );
}
