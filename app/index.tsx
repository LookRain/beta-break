import React from "react";
import { Platform } from "react-native";
import { useGlobalSearchParams, useRouter } from "expo-router";
import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { makeRedirectUri } from "expo-auth-session";
import { openAuthSessionAsync } from "expo-web-browser";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Button, ButtonText } from "@/components/ui/button";
import { Mountain } from "lucide-react-native";
import { colors } from "@/lib/theme";

const redirectTo = makeRedirectUri({ scheme: "betabreak" });

export default function Home() {
  const router = useRouter();
  const params = useGlobalSearchParams<{ code?: string | string[] }>();
  const { signIn, signOut } = useAuthActions();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [authError, setAuthError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isAuthenticated) {
      router.replace("/tabs/train");
    }
  }, [isAuthenticated, router]);

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

  return (
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
          <Button
            onPress={() => void handleGoogleSignIn()}
            size="lg"
            className="rounded-xl"
            disabled={isLoading}
          >
            <ButtonText className="font-semibold">
              {isLoading ? "Checking session..." : "Sign in with Google"}
            </ButtonText>
          </Button>
        )}
      </Box>
    </Box>
  );
}
