import React from "react";
import { useMutation, useQuery } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@/convex/_generated/api";
import { TrainingItemForm } from "@/components/training-item-form";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";

export default function ItemDetailScreen() {
  const router = useRouter();
  const goBackToItems = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/my-exercises");
  };
  const params = useLocalSearchParams<{ itemId?: string | string[] }>();
  const itemIdParam = params.itemId;
  const itemId = Array.isArray(itemIdParam) ? itemIdParam[0] : itemIdParam;

  const item = useQuery(
    api.trainingItems.getItemById,
    itemId ? { itemId: itemId as never } : "skip",
  );
  const updateItem = useMutation(api.trainingItems.updateDraft);

  if (!itemId) {
    return (
      <Box className="flex-1 items-center justify-center">
        <Text className="text-typography-700">Missing exercise id.</Text>
      </Box>
    );
  }

  if (item === undefined) {
    return (
      <Box className="flex-1 items-center justify-center">
        <Text className="text-typography-700">Loading exercise...</Text>
      </Box>
    );
  }

  if (!item) {
    return (
      <Box className="flex-1 items-center justify-center">
        <Text className="text-typography-700">Exercise not found or no access.</Text>
      </Box>
    );
  }

  return (
    <TrainingItemForm
      initialValues={{
        title: item.title,
        description: item.description,
        category: item.category,
        tags: item.tags,
        variables: item.variables,
        trainingType: item.trainingType,
        hangDetails: item.hangDetails,
        difficulty: item.difficulty,
        equipment: item.equipment,
      }}
      submitLabel="Save exercise"
      onSubmit={async (values) => {
        await updateItem({
          itemId: item._id,
          ...values,
        });
        goBackToItems();
      }}
    />
  );
}
