import React from "react";
import { Pressable, ScrollView } from "react-native";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { api } from "@/convex/_generated/api";
import { TrainingItemCard } from "@/components/training-item-card";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Button, ButtonText } from "@/components/ui/button";
import { Plus } from "lucide-react-native";
import { colors, cardShadow, screenPadding } from "@/lib/theme";
import { showErrorMessage, useAppToast } from "@/lib/useAppToast";

type Tab = "created" | "saved";

export default function MyExercisesScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState<Tab>("created");
  const { success: showSuccessToast, error: showErrorToast } = useAppToast();

  const myItems = useQuery(api.trainingItems.listMyItems);
  const deleteItem = useMutation(api.trainingItems.deleteDraft);

  const savedItems = useQuery(api.savedItems.listSavedItems);
  const unsaveItem = useMutation(api.savedItems.unsaveItem);

  const isLoading =
    (activeTab === "created" && myItems === undefined) ||
    (activeTab === "saved" && savedItems === undefined);

  const handleDeleteItem = React.useCallback(
    async (itemId: string) => {
      try {
        await deleteItem({ itemId: itemId as never });
        showSuccessToast("Exercise deleted.");
      } catch (deleteError) {
        const message = showErrorMessage(deleteError, "Could not delete exercise.");
        showErrorToast("Delete failed", message);
      }
    },
    [deleteItem, showErrorToast, showSuccessToast],
  );

  const handleUnsaveItem = React.useCallback(
    async (itemId: string) => {
      try {
        await unsaveItem({ itemId: itemId as never });
        showSuccessToast("Removed from saved exercises.");
      } catch (unsaveError) {
        const message = showErrorMessage(unsaveError, "Could not unsave exercise.");
        showErrorToast("Unsave failed", message);
      }
    },
    [showErrorToast, showSuccessToast, unsaveItem],
  );

  return (
    <ScrollView
      contentContainerStyle={{ ...screenPadding, gap: 16 }}
      style={{ backgroundColor: colors.bg }}
    >
      <Box
        className="flex-row rounded-xl overflow-hidden"
        style={{ backgroundColor: colors.borderLight }}
      >
        {[
          { key: "created" as const, label: "My Creations" },
          { key: "saved" as const, label: "Saved" },
        ].map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 10,
              margin: 3,
              backgroundColor: activeTab === tab.key ? colors.bgCard : "transparent",
              ...(activeTab === tab.key ? cardShadow : {}),
            }}
          >
            <Text
              style={{
                textAlign: "center",
                fontSize: 14,
                fontWeight: activeTab === tab.key ? "700" : "500",
                color: activeTab === tab.key ? colors.text : colors.textMuted,
              }}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </Box>

      {isLoading ? (
        <Box className="py-8 items-center">
          <Text className="text-typography-500">Loading...</Text>
        </Box>
      ) : activeTab === "created" ? (
        <>
          <Box className="flex-row items-center justify-end">
            <Button className="rounded-xl" onPress={() => router.push("/items/new")}>
              <Plus size={16} color="#fff" strokeWidth={2.5} />
              <ButtonText className="font-semibold">New Exercise</ButtonText>
            </Button>
          </Box>

          {(myItems ?? []).length === 0 ? (
            <Box
              className="rounded-2xl p-6 items-center gap-2"
              style={{ ...cardShadow, backgroundColor: colors.bgCard }}
            >
              <Text className="text-typography-500 text-center">
                No exercises yet. Create your first exercise.
              </Text>
            </Box>
          ) : (
            <Box className="gap-3">
              {(myItems ?? []).map((item) => (
                <TrainingItemCard
                  key={item._id}
                  item={item}
                  onPressPrimary={() => router.push(`/items/${item._id}`)}
                  primaryLabel="Edit"
                  onPressSecondary={() => void handleDeleteItem(item._id)}
                  secondaryLabel="Delete"
                />
              ))}
            </Box>
          )}
        </>
      ) : (
        <>
          {(savedItems ?? []).length === 0 ? (
            <Box className="py-8 items-center">
              <Text className="text-typography-500">No saved exercises yet.</Text>
            </Box>
          ) : (
            <Box className="gap-3">
              {(savedItems ?? []).map((entry) =>
                entry.item ? (
                  <TrainingItemCard
                    key={entry._id}
                    item={entry.item}
                    onToggleSave={() => void handleUnsaveItem(entry.item!._id)}
                    saveLabel="Unsave"
                  />
                ) : null,
              )}
            </Box>
          )}
        </>
      )}
    </ScrollView>
  );
}
