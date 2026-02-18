import Google from "@auth/core/providers/google";
import { convexAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Google],
  callbacks: {
    async redirect({ redirectTo }) {
      const siteUrl = process.env.SITE_URL;
      const redirectValue = redirectTo ?? siteUrl;

      if (!redirectValue) {
        throw new Error("Missing redirect URL. Set SITE_URL on Convex.");
      }

      if (
        redirectValue.startsWith("exp://") ||
        redirectValue.startsWith("betabreak://")
      ) {
        return redirectValue;
      }

      const redirectUrl = new URL(redirectValue);
      const isLocalhost =
        redirectUrl.protocol.startsWith("http") &&
        redirectUrl.hostname === "localhost";
      const isSiteUrlMatch =
        !!siteUrl && redirectUrl.origin === new URL(siteUrl).origin;

      if (isLocalhost || isSiteUrlMatch) {
        return redirectValue;
      }

      throw new Error(`Invalid redirectTo URI ${redirectValue}`);
    },
  },
});
