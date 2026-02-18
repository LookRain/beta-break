import React from "react";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";

type Props = {
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
};

const titleStyle = {
  letterSpacing: -0.3,
};

export function PageHeader({ title, subtitle, rightSlot }: Props) {
  if (rightSlot) {
    return (
      <Box className="flex-row items-center justify-between">
        <Box className="gap-1 flex-1 pr-3">
          <Text className="text-3xl font-bold text-typography-900" style={titleStyle}>
            {title}
          </Text>
          {subtitle ? (
            <Text className="text-base text-typography-500">
              {subtitle}
            </Text>
          ) : null}
        </Box>
        <Box>{rightSlot}</Box>
      </Box>
    );
  }

  return (
    <Box className="gap-1">
      <Text className="text-3xl font-bold text-typography-900" style={titleStyle}>
        {title}
      </Text>
      {subtitle ? (
        <Text className="text-base text-typography-500">
          {subtitle}
        </Text>
      ) : null}
    </Box>
  );
}
