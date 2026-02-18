import React from "react";
import { ScrollView } from "react-native";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { api } from "@/convex/_generated/api";
import { TrainingItemCard } from "@/components/training-item-card";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Button, ButtonText } from "@/components/ui/button";
import { Plus } from "lucide-react-native";
import { colors, cardShadow, screenPadding } from "@/lib/theme";

export default function MyItemsScreen() {
  const router = useRouter();
  const items = useQuery(api.trainingItems.listMyItems);
  const deleteItem = useMutation(api.trainingItems.deleteDraft);

  if (items === undefined) {
    return (
      <Box className="flex-1 items-center justify-center">
        <Text className="text-typography-500">Loading...</Text>
      </Box>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ ...screenPadding, gap: 16 }}
      style={{ backgroundColor: colors.bg }}
    >
      <Box className="flex-row items-center justify-between">
        <Text className="text-2xl font-bold text-typography-900">My Exercises</Text>
        <Button className="rounded-xl" onPress={() => router.push("/items/new")}>
          <Plus size={16} color="#fff" strokeWidth={2.5} />
          <ButtonText className="font-semibold">New Exercise</ButtonText>
        </Button>
      </Box>

      {items.length === 0 ? (
        <Box
          className="rounded-2xl p-6 items-center gap-2"
          style={{ ...cardShadow, backgroundColor: colors.bgCard }}
        >
          <Text className="text-typography-500 text-center">
            No exercises yet. Create your first exercise.
          </Text>
        </Box>
      ) : null}

      <Box className="gap-3">
        {items.map((item) => (
          <TrainingItemCard
            key={item._id}
            item={item}
            onPressPrimary={() => router.push(`/items/${item._id}`)}
            primaryLabel="Edit"
            onPressSecondary={() => void deleteItem({ itemId: item._id })}
            secondaryLabel="Delete"
          />
        ))}
      </Box>
    </ScrollView>
  );
}
