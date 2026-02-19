import React from "react";
import { useMutation } from "convex/react";
import { useRouter } from "expo-router";
import { api } from "@/convex/_generated/api";
import { TrainingItemForm } from "@/components/training-item-form";

export default function NewItemScreen() {
  const router = useRouter();
  const createItem = useMutation(api.trainingItems.createDraft);
  const goBackToItems = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/my-exercises");
  };

  return (
    <TrainingItemForm
      submitLabel="Create exercise"
      onSubmit={async (values) => {
        await createItem(values);
        goBackToItems();
      }}
    />
  );
}
