import React from "react";
import { Image, ImageSourcePropType, StyleSheet, View } from "react-native";
import { useQuery } from "convex/react";
import { Text } from "@/components/ui/text";
import { Repeat, Layers, Timer, Weight } from "lucide-react-native";
import { api } from "@/convex/_generated/api";
import { colors, cardShadow } from "@/lib/theme";

export type SessionSnapshot = {
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
  equipment: string[];
  variables: {
    weight?: number;
    reps?: number;
    sets?: number;
    restSeconds?: number;
    restBetweenSetsSeconds?: number;
    durationSeconds?: number;
  };
};

export type SessionVariables = {
  weight?: number;
  reps?: number;
  sets?: number;
  restSeconds?: number;
  restBetweenSetsSeconds?: number;
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

function withAlpha(color: string, alpha: number): string {
  if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
    return color;
  }
  const clampedAlpha = Math.max(0, Math.min(1, alpha));
  const alphaHex = Math.round(clampedAlpha * 255)
    .toString(16)
    .padStart(2, "0");
  return `${color}${alphaHex}`;
}

function resolveImage(snapshot: SessionSnapshot): ImageSourcePropType | null {
  if (snapshot.trainingType === "hang" && snapshot.hangDetails?.apparatus) {
    return trainingImages[snapshot.hangDetails.apparatus] ?? trainingImages.fingerboard;
  }
  if (snapshot.trainingType && trainingImages[snapshot.trainingType]) {
    return trainingImages[snapshot.trainingType];
  }
  for (const entry of snapshot.categories) {
    if (trainingImages[entry]) {
      return trainingImages[entry];
    }
  }
  return null;
}

export function SessionCard({ snapshot, finalVariables, statusBadge, children }: SessionCardProps) {
  const profile = useQuery(api.profiles.getMyProfile);
  const accentColor = typeAccentColors[snapshot.trainingType ?? ""] ?? colors.primary;
  const bgImage = resolveImage(snapshot);
  const iconBackground = withAlpha(accentColor, 0.12);
  const iconBorder = withAlpha(accentColor, 0.28);
  const isBodyweightPercent = !!snapshot.trainingType;
  const bodyWeightKg = profile?.bodyWeightKg;

  const loadLabel =
    finalVariables.weight != null
      ? isBodyweightPercent
        ? finalVariables.weight > 100
          ? bodyWeightKg && bodyWeightKg > 0
            ? `Additional Weight: +${Number((((finalVariables.weight - 100) / 100) * bodyWeightKg).toFixed(1))}kg`
            : `Additional Weight: +${Number((finalVariables.weight - 100).toFixed(1))}% BW`
          : `${finalVariables.weight}% BW`
        : `${finalVariables.weight}kg`
      : null;

  const hasStats =
    finalVariables.sets != null ||
    finalVariables.reps != null ||
    loadLabel != null ||
    finalVariables.restSeconds != null ||
    finalVariables.restBetweenSetsSeconds != null;

  return (
    <View style={[styles.card, cardShadow]}>
      <View style={[styles.accentStrip, { backgroundColor: accentColor }]} />

      <View style={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.titleRow}>
            {bgImage ? (
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: iconBackground, borderColor: iconBorder },
                ]}
              >
                <Image source={bgImage} style={styles.iconImage} resizeMode="contain" />
              </View>
            ) : null}
            <Text className="font-bold text-typography-900 text-base flex-1 flex-shrink">
              {snapshot.title}
            </Text>
          </View>
          {statusBadge}
        </View>

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
                <Text className="text-xs font-medium text-typography-600">{loadLabel}</Text>
              </View>
            ) : null}
            {finalVariables.restSeconds ? (
              <View style={styles.statChip}>
                <Timer size={11} color={colors.textSecondary} />
                <Text className="text-xs font-medium text-typography-600">
                  {finalVariables.restSeconds}s rep rest
                </Text>
              </View>
            ) : null}
            {finalVariables.restBetweenSetsSeconds ? (
              <View style={styles.statChip}>
                <Timer size={11} color={colors.textSecondary} />
                <Text className="text-xs font-medium text-typography-600">
                  {finalVariables.restBetweenSetsSeconds}s set rest
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
  content: {
    flex: 1,
    padding: 16,
    gap: 12,
    zIndex: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  titleRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  iconImage: {
    width: 24,
    height: 24,
    opacity: 0.92,
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
