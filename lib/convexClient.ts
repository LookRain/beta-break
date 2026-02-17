import { ConvexReactClient } from "convex/react";

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  console.warn(
    "EXPO_PUBLIC_CONVEX_URL is not set. Convex features are disabled until you configure it.",
  );
}

export const convexClient = convexUrl ? new ConvexReactClient(convexUrl) : null;
