import React from "react";
import { Toast, ToastDescription, ToastTitle, useToast } from "@/components/ui/toast";

type ToastAction = "error" | "warning" | "success" | "info" | "muted";

type ShowToastOptions = {
  title: string;
  description?: string;
  action?: ToastAction;
  duration?: number;
};

function showErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function useAppToast() {
  const toast = useToast();

  const showToast = React.useCallback(
    ({ title, description, action = "muted", duration = 3200 }: ShowToastOptions) => {
      toast.show({
        placement: "top",
        duration,
        render: () => (
          <Toast action={action} variant="solid" className="mx-3">
            <ToastTitle>{title}</ToastTitle>
            {description ? <ToastDescription>{description}</ToastDescription> : null}
          </Toast>
        ),
      });
    },
    [toast],
  );

  const success = React.useCallback(
    (title: string, description?: string) => showToast({ title, description, action: "success" }),
    [showToast],
  );
  const error = React.useCallback(
    (title: string, description?: string) =>
      showToast({ title, description, action: "error", duration: 4200 }),
    [showToast],
  );
  const info = React.useCallback(
    (title: string, description?: string) => showToast({ title, description, action: "info" }),
    [showToast],
  );

  return {
    showToast,
    success,
    error,
    info,
  };
}

export { showErrorMessage };
