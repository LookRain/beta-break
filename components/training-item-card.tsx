import React from "react";
import { Pressable } from "react-native";
import { useQuery } from "convex/react";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Button, ButtonText } from "@/components/ui/button";
import { Bookmark, BookmarkCheck } from "lucide-react-native";
import { api } from "@/convex/_generated/api";
import { colors, cardShadow } from "@/lib/theme";

export type TrainingItemCardItem = {
  _id: string;
  title: string;
  description?: string;
  categories: string[];
  tags: string[];
  trainingType?: "hang" | "weight_training" | "climbing" | "others";
  hangDetails?: {
    apparatus: "fingerboard" | "bar";
    edgeSizeMm?: 8 | 10 | 15 | 20 | 25;
    crimpType?: "open" | "half" | "full";
    loadPreference?: "below_100" | "above_100";
  };
  difficulty: "beginner" | "intermediate" | "advanced";
  equipment?: string[];
  variables: {
    weight?: number;
    reps?: number;
    sets?: number;
    restSeconds?: number;
    restBetweenSetsSeconds?: number;
    durationSeconds?: number;
  };
  publisher?: {
    userId: string;
    username: string | null;
    image: string | null;
  } | null;
};

type Props = {
  item: TrainingItemCardItem;
  onPressPrimary?: () => void;
  primaryLabel?: string;
  onPressSecondary?: () => void;
  secondaryLabel?: string;
  onToggleSave?: () => void;
  saveLabel?: string;
  onPressCard?: () => void;
};

const difficultyColors: Record<string, { bg: string; text: string }> = {
  beginner: { bg: "#f0fdfa", text: "#0d9488" },
  intermediate: { bg: "#fffbeb", text: "#d97706" },
  advanced: { bg: "#fef2f2", text: "#dc2626" },
};

export function TrainingItemCard({
  item,
  onPressPrimary,
  primaryLabel,
  onPressSecondary,
  secondaryLabel,
  onToggleSave,
  saveLabel,
  onPressCard,
}: Props) {
  const profile = useQuery(api.profiles.getMyProfile);
  const isSaved = saveLabel === "Unsave";
  const diffColors = difficultyColors[item.difficulty] ?? difficultyColors.beginner;
  const publisherUsername = item.publisher?.username ?? null;
  const trainingTypeText =
    item.trainingType === "hang"
      ? "Hang"
      : item.trainingType === "weight_training"
        ? "Weight training"
        : item.trainingType === "climbing"
          ? "Climbing"
          : item.trainingType === "others"
            ? "Others"
            : null;
  const usesBodyweightPercent = !!item.trainingType;
  const weightPercent = item.variables.weight;
  const additionalWeightPercent =
    usesBodyweightPercent && weightPercent !== undefined && weightPercent > 100
      ? Number((weightPercent - 100).toFixed(1))
      : undefined;
  const personalizedWeightKg =
    usesBodyweightPercent &&
    weightPercent !== undefined &&
    additionalWeightPercent === undefined &&
    profile?.bodyWeightKg
      ? Number(((weightPercent / 100) * profile.bodyWeightKg).toFixed(1))
      : undefined;
  const additionalWeightKg =
    additionalWeightPercent !== undefined && profile?.bodyWeightKg
      ? Number(((additionalWeightPercent / 100) * profile.bodyWeightKg).toFixed(1))
      : undefined;
  const loadLabel =
    additionalWeightPercent !== undefined
      ? `Additional Weight: +${additionalWeightPercent}% BW${additionalWeightKg !== undefined ? ` (+${additionalWeightKg}kg for you)` : ""}`
      : weightPercent !== undefined
        ? `${weightPercent}% BW${personalizedWeightKg !== undefined ? ` (${personalizedWeightKg}kg for you)` : ""}`
        : null;
  const legacyLoadLabel = weightPercent !== undefined ? `${weightPercent}kg` : null;
  const itemCategories = item.categories.slice(0, 3);

  const cardBody = (
    <Box
      className="rounded-2xl p-4 gap-3"
      style={{ ...cardShadow, backgroundColor: colors.bgCard }}
    >
      <Box className="flex-row items-start justify-between gap-2">
        <Box className="flex-1 gap-1">
          <Text className="text-base font-bold text-typography-900">{item.title}</Text>
          {item.description ? (
            <Text className="text-sm text-typography-500" numberOfLines={2}>
              {item.description}
            </Text>
          ) : null}
        </Box>
        {onToggleSave ? (
          <Button variant="link" size="sm" onPress={onToggleSave} className="p-1">
            {isSaved ? (
              <BookmarkCheck size={20} color={colors.primary} strokeWidth={2} />
            ) : (
              <Bookmark size={20} color={colors.textMuted} strokeWidth={1.5} />
            )}
          </Button>
        ) : null}
      </Box>

      <Box className="flex-row flex-wrap gap-1.5">
        <Box className="rounded-full px-2.5 py-0.5" style={{ backgroundColor: diffColors.bg }}>
          <Text
            className="text-xs font-semibold"
            style={{ color: diffColors.text, textTransform: "capitalize" }}
          >
            {item.difficulty}
          </Text>
        </Box>
        {itemCategories.map((category) => (
          <Box
            key={category}
            className="rounded-full px-2.5 py-0.5"
            style={{ backgroundColor: colors.borderLight }}
          >
            <Text className="text-xs font-medium text-typography-600">{category}</Text>
          </Box>
        ))}
        {trainingTypeText ? (
          <Box className="rounded-full px-2.5 py-0.5" style={{ backgroundColor: "#dbeafe" }}>
            <Text className="text-xs font-medium" style={{ color: "#1d4ed8" }}>
              {trainingTypeText}
            </Text>
          </Box>
        ) : null}
        {item.tags.slice(0, 3).map((tag) => (
          <Box
            key={tag}
            className="rounded-full px-2.5 py-0.5"
            style={{ backgroundColor: colors.borderLight }}
          >
            <Text className="text-xs text-typography-500">{tag}</Text>
          </Box>
        ))}
      </Box>

      <Text className="text-sm text-typography-600">
        {item.variables.sets ?? "—"} sets x {item.variables.reps ?? "—"} reps
        {usesBodyweightPercent
          ? loadLabel
            ? ` @ ${loadLabel}`
            : ""
          : legacyLoadLabel
            ? ` @ ${legacyLoadLabel}`
            : ""}
        {item.variables.restSeconds ? ` · ${item.variables.restSeconds}s rep rest` : ""}
        {item.variables.restBetweenSetsSeconds
          ? ` · ${item.variables.restBetweenSetsSeconds}s set rest`
          : ""}
      </Text>
      {item.trainingType === "hang" && item.hangDetails ? (
        <Text className="text-xs text-typography-500">
          {item.hangDetails.apparatus}
          {item.hangDetails.edgeSizeMm ? ` · ${item.hangDetails.edgeSizeMm}mm` : ""}
          {item.hangDetails.crimpType ? ` · ${item.hangDetails.crimpType} crimp` : ""}
          {item.hangDetails.loadPreference
            ? ` · ${item.hangDetails.loadPreference === "below_100" ? "below 100%" : "above 100%"}`
            : ""}
        </Text>
      ) : null}
      {publisherUsername ? (
        <Text className="text-xs text-typography-500">By @{publisherUsername}</Text>
      ) : null}

      {onPressPrimary || onPressSecondary ? (
        <Box className="flex-row flex-wrap gap-2">
          {onPressPrimary && primaryLabel ? (
            <Button className="rounded-xl" onPress={onPressPrimary}>
              <ButtonText className="text-sm font-semibold">{primaryLabel}</ButtonText>
            </Button>
          ) : null}
          {onPressSecondary && secondaryLabel ? (
            <Button variant="outline" className="rounded-xl" onPress={onPressSecondary}>
              <ButtonText className="text-sm">{secondaryLabel}</ButtonText>
            </Button>
          ) : null}
        </Box>
      ) : null}
    </Box>
  );

  if (onPressCard) {
    return (
      <Pressable onPress={onPressCard} accessibilityRole="button">
        {cardBody}
      </Pressable>
    );
  }

  return cardBody;
}
