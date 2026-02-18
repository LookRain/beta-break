import React from "react";
import { Image, ImageSourcePropType, StyleSheet, View } from "react-native";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Repeat, Layers, Timer, Weight } from "lucide-react-native";
import { colors, cardShadow } from "@/lib/theme";

export type SessionSnapshot = {
  title: string;
  description?: string;
  category: string;
  tags: string[];
  trainingType?: "hang" | "weight_training" | "climbing" | "others";
  hangDetails?: {
    apparatus: "fingerboard" | "bar";
    edgeSizeMm?: number;
    crimpType?: "open" | "half" | "full";
    loadPreference?: "below_100" | "above_100";
  };
  difficulty: "beginner" | "intermediate" | "advanced";
  equipment: string[];
  variables: {
    weight?: number;
    reps?: number;
    sets?: number;
    restSeconds?: number;
    durationSeconds?: number;
  };
};

export type SessionVariables = {
  weight?: number;
  reps?: number;
  sets?: number;
  restSeconds?: number;
  durationSeconds?: number;
};

type SessionCardProps = {
  snapshot: SessionSnapshot;
  finalVariables: SessionVariables;
  statusBadge?: React.ReactNode;
  children?: React.ReactNode;
};

const typeAccentColors: Record<string, string> = {
  hang: "#f59e0b",
  weight_training: "#3b82f6",
  climbing: "#22c55e",
  others: "#8b5cf6",
};

const trainingImages: Record<string, ImageSourcePropType> = {
  fingerboard: require("@/assets/images/training/fingerboard.png"),
  bar: require("@/assets/images/training/bar.png"),
  climbing: require("@/assets/images/training/boulder.png"),
  weight_training: require("@/assets/images/training/strength.png"),
  others: require("@/assets/images/training/flexibility.png"),
  "finger-strength": require("@/assets/images/training/fingerboard.png"),
  "power-endurance": require("@/assets/images/training/boulder.png"),
  mobility: require("@/assets/images/training/flexibility.png"),
  conditioning: require("@/assets/images/training/strength.png"),
  technique: require("@/assets/images/training/boulder2.png"),
};

function resolveImage(snapshot: SessionSnapshot): ImageSourcePropType | null {
  if (snapshot.trainingType === "hang" && snapshot.hangDetails?.apparatus) {
    return (
      trainingImages[snapshot.hangDetails.apparatus] ??
      trainingImages.fingerboard
    );
  }
  if (snapshot.trainingType && trainingImages[snapshot.trainingType]) {
    return trainingImages[snapshot.trainingType];
  }
  if (snapshot.category && trainingImages[snapshot.category]) {
    return trainingImages[snapshot.category];
  }
  return null;
}

export function SessionCard({
  snapshot,
  finalVariables,
  statusBadge,
  children,
}: SessionCardProps) {
  const accentColor =
    typeAccentColors[snapshot.trainingType ?? ""] ?? colors.primary;
  const bgImage = resolveImage(snapshot);
  const isBodyweightPercent = !!snapshot.trainingType;

  const loadLabel = finalVariables.weight
    ? isBodyweightPercent
      ? `${finalVariables.weight}% BW`
      : `${finalVariables.weight}kg`
    : null;

  const hasStats =
    finalVariables.sets != null ||
    finalVariables.reps != null ||
    loadLabel != null ||
    finalVariables.restSeconds != null;

  return (
    <View style={[styles.card, cardShadow]}>
      <View style={[styles.accentStrip, { backgroundColor: accentColor }]} />

      {bgImage ? (
        <View style={styles.imageContainer}>
          <Image source={bgImage} style={styles.bgImage} resizeMode="cover" />
          <View style={styles.imageFadeLeft} />
          <View style={styles.imageFadeTop} />
        </View>
      ) : null}

      <View style={styles.content}>
        <Box className="flex-row items-center justify-between gap-2">
          <Text className="font-bold text-typography-900 text-base flex-1 flex-shrink">
            {snapshot.title}
          </Text>
          {statusBadge}
        </Box>

        {hasStats ? (
          <View style={styles.statsRow}>
            {finalVariables.sets != null ? (
              <View style={styles.statChip}>
                <Layers size={11} color={colors.textSecondary} />
                <Text className="text-xs font-medium text-typography-600">
                  {finalVariables.sets} sets
                </Text>
              </View>
            ) : null}
            {finalVariables.reps != null ? (
              <View style={styles.statChip}>
                <Repeat size={11} color={colors.textSecondary} />
                <Text className="text-xs font-medium text-typography-600">
                  {finalVariables.reps} reps
                </Text>
              </View>
            ) : null}
            {loadLabel ? (
              <View style={styles.statChip}>
                <Weight size={11} color={colors.textSecondary} />
                <Text className="text-xs font-medium text-typography-600">
                  {loadLabel}
                </Text>
              </View>
            ) : null}
            {finalVariables.restSeconds ? (
              <View style={styles.statChip}>
                <Timer size={11} color={colors.textSecondary} />
                <Text className="text-xs font-medium text-typography-600">
                  {finalVariables.restSeconds}s rest
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    overflow: "hidden",
    flexDirection: "row",
    minHeight: 128,
  },
  accentStrip: {
    width: 4,
  },
  imageContainer: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: "45%",
    overflow: "hidden",
  },
  bgImage: {
    width: "100%",
    height: "100%",
    opacity: 0.09,
  },
  imageFadeLeft: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: "50%",
    backgroundColor: colors.bgCard,
    opacity: 0.9,
  },
  imageFadeTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "30%",
    backgroundColor: colors.bgCard,
    opacity: 0.6,
  },
  content: {
    flex: 1,
    padding: 16,
    gap: 12,
    zIndex: 1,
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.borderLight,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
});
