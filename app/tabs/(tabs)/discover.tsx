import React from "react";
import { Platform, Pressable, ScrollView, TextInput } from "react-native";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/convex/_generated/api";
import { TrainingItemCard } from "@/components/training-item-card";
import { PageHeader } from "@/components/page-header";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { parseCommaSeparated } from "@/lib/trainingItemFilters";
import { ChevronRight, FolderOpen, Plus, Search } from "lucide-react-native";
import { colors, inputStyle, screenPadding } from "@/lib/theme";
import { showErrorMessage, useAppToast } from "@/lib/useAppToast";

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();
  const { success: showSuccessToast, error: showErrorToast } = useAppToast();
  const { isAuthenticated } = useConvexAuth();
  const [searchText, setSearchText] = React.useState("");
  const [categoriesInput, setCategoriesInput] = React.useState("");
  const [difficulty, setDifficulty] = React.useState<"" | "beginner" | "intermediate" | "advanced">(
    "",
  );
  const [tagsInput, setTagsInput] = React.useState("");
  const tags = React.useMemo(() => parseCommaSeparated(tagsInput), [tagsInput]);
  const categories = React.useMemo(() => parseCommaSeparated(categoriesInput), [categoriesInput]);
  const normalizedSearchText = searchText.trim();
  const queryArgs = React.useMemo(
    () => ({
      searchText: normalizedSearchText || undefined,
      categories: categories.length > 0 ? categories : undefined,
      difficulty: difficulty || undefined,
      tags: tags.length > 0 ? tags : undefined,
    }),
    [normalizedSearchText, categories, difficulty, tags],
  );

  const items = useQuery(api.trainingItems.listPublishedItems, queryArgs);
  const savedItems = useQuery(api.savedItems.listSavedItems, isAuthenticated ? {} : "skip");
  const saveItem = useMutation(api.savedItems.saveItem);
  const unsaveItem = useMutation(api.savedItems.unsaveItem);
  const isLoadingItems = items === undefined;
  const scrollBottomPadding = Math.max(screenPadding.paddingBottom, insets.bottom + 48);

  const savedIds = React.useMemo(
    () => new Set((savedItems ?? []).map((entry) => entry.item?._id).filter(Boolean)),
    [savedItems],
  );

  const toggleSave = async (itemId: string) => {
    if (!isAuthenticated) {
      showErrorToast("Sign in required", "Sign in to save exercises.");
      return;
    }
    try {
      if (savedIds.has(itemId)) {
        await unsaveItem({ itemId: itemId as never });
        showSuccessToast("Removed from saved exercises.");
        return;
      }
      await saveItem({ itemId: itemId as never });
      showSuccessToast("Exercise saved.");
    } catch (toggleError) {
      const message = showErrorMessage(toggleError, "Could not update saved exercises.");
      showErrorToast("Save failed", message);
    }
  };

  const visibleItems = items ?? [];

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => router.push("/items/new")}
          style={{ paddingHorizontal: 8, paddingVertical: 4 }}
        >
          <Plus size={22} color={colors.primary} strokeWidth={2.5} />
        </Pressable>
      ),
    });
  }, [navigation, router]);

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ ...screenPadding, gap: 16, paddingBottom: scrollBottomPadding }}
      style={{ backgroundColor: colors.bg }}
    >
      <PageHeader title="Exercises" subtitle="Discover exercises" />

      <Box style={{ position: "relative" }}>
        <Search
          size={18}
          color={colors.textMuted}
          strokeWidth={2}
          style={{ position: "absolute", left: 14, top: 13, zIndex: 1 }}
        />
        <TextInput
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search exercises..."
          placeholderTextColor={colors.textMuted}
          style={{ ...inputStyle, paddingLeft: 42 }}
        />
      </Box>

      <Box className="flex-row gap-2">
        <Box className="flex-1">
          <TextInput
            value={categoriesInput}
            onChangeText={setCategoriesInput}
            placeholder="Categories (comma separated)"
            placeholderTextColor={colors.textMuted}
            style={{ ...inputStyle, fontSize: 13, paddingVertical: 10 }}
          />
        </Box>
        <Box className="flex-1">
          <TextInput
            value={tagsInput}
            onChangeText={setTagsInput}
            placeholder="Tags"
            placeholderTextColor={colors.textMuted}
            style={{ ...inputStyle, fontSize: 13, paddingVertical: 10 }}
          />
        </Box>
      </Box>

      <Box className="flex-row gap-2 flex-wrap">
        {(["beginner", "intermediate", "advanced"] as const).map((option) => (
          <Pressable
            key={option}
            onPress={() => setDifficulty((prev) => (prev === option ? "" : option))}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 20,
              backgroundColor: difficulty === option ? colors.primary : colors.borderLight,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: "600",
                color: difficulty === option ? "#fff" : colors.text,
                textTransform: "capitalize",
              }}
            >
              {option}
            </Text>
          </Pressable>
        ))}
      </Box>

      <Box className="flex-row gap-2">
        <Pressable
          onPress={() => router.push("/my-exercises")}
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.primaryBg,
            borderRadius: 14,
            padding: 14,
            gap: 12,
          }}
        >
          <FolderOpen size={20} color={colors.primary} strokeWidth={2} />
          <Box style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>
              My Exercises
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>
              Manage your creations & saved exercises
            </Text>
          </Box>
          <ChevronRight size={18} color={colors.textMuted} strokeWidth={2} />
        </Pressable>
        <Pressable
          onPress={() => router.push("/items/new")}
          style={{
            width: 108,
            borderRadius: 14,
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
          }}
        >
          <Plus size={18} color="#fff" strokeWidth={2.5} />
          <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>Create</Text>
        </Pressable>
      </Box>

      {isLoadingItems ? (
        <Box className="py-8 items-center">
          <Text className="text-typography-500">Loading exercises...</Text>
        </Box>
      ) : visibleItems.length === 0 ? (
        <Box className="py-8 items-center">
          <Text className="text-typography-500">No exercises found. Try different filters.</Text>
        </Box>
      ) : (
        <Box className="gap-3">
          {visibleItems.map((item) => (
            <TrainingItemCard
              key={item._id}
              item={item}
              onToggleSave={isAuthenticated ? () => void toggleSave(item._id) : undefined}
              saveLabel={savedIds.has(item._id) ? "Unsave" : "Save"}
            />
          ))}
        </Box>
      )}
    </ScrollView>
  );
}
