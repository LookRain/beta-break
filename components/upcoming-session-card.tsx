import React from "react";
import { Pressable } from "react-native";
import { ChevronRight, Play } from "lucide-react-native";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Button, ButtonText } from "@/components/ui/button";
import { SessionCard, type SessionSnapshot, type SessionVariables } from "@/components/session-card";
import { colors } from "@/lib/theme";

type UpcomingSessionData = {
  _id: string;
  snapshot: SessionSnapshot;
  overrides: SessionVariables;
};

type UpcomingSessionCardProps = {
  session: UpcomingSessionData;
  isExpanded: boolean;
  onToggle: () => void;
  onStart: () => void;
  onDone: () => void;
  expandedContent?: React.ReactNode;
  startLabel?: string;
  doneLabel?: string;
  showReadyBadge?: boolean;
  startIconSize?: number;
  startButtonTextClassName?: string;
  doneButtonTextClassName?: string;
};

function mergeVariables(
  base: SessionVariables,
  overrides: SessionVariables,
): SessionVariables {
  return {
    weight: overrides.weight ?? base.weight,
    reps: overrides.reps ?? base.reps,
    sets: overrides.sets ?? base.sets,
    restSeconds: overrides.restSeconds ?? base.restSeconds,
    durationSeconds: overrides.durationSeconds ?? base.durationSeconds,
  };
}

export function UpcomingSessionCard({
  session,
  isExpanded,
  onToggle,
  onStart,
  onDone,
  expandedContent,
  startLabel = "Start",
  doneLabel = "Done",
  showReadyBadge = true,
  startIconSize = 16,
  startButtonTextClassName = "font-semibold",
  doneButtonTextClassName = "",
}: UpcomingSessionCardProps) {
  const finalVariables = mergeVariables(session.snapshot.variables, session.overrides);

  return (
    <Pressable onPress={onToggle}>
      <SessionCard
        snapshot={session.snapshot}
        finalVariables={finalVariables}
        statusBadge={
          <Box className="flex-row items-center gap-2">
            {showReadyBadge ? (
              <Box className="rounded-full px-2.5 py-1" style={{ backgroundColor: colors.primaryBg }}>
                <Text className="text-xs font-semibold" style={{ color: colors.primary }}>
                  Ready
                </Text>
              </Box>
            ) : null}
            <ChevronRight
              size={18}
              color={colors.textMuted}
              strokeWidth={2}
              style={{ transform: [{ rotate: isExpanded ? "90deg" : "0deg" }] }}
            />
          </Box>
        }
      >
        <Box className="flex-row gap-2">
          <Button className="rounded-xl flex-1" onPress={onStart}>
            <Play size={startIconSize} color="#fff" strokeWidth={2.5} />
            <ButtonText className={startButtonTextClassName}>{startLabel}</ButtonText>
          </Button>
          <Button variant="outline" className="rounded-xl" onPress={onDone}>
            <ButtonText className={doneButtonTextClassName}>{doneLabel}</ButtonText>
          </Button>
        </Box>
        {isExpanded ? expandedContent : null}
      </SessionCard>
    </Pressable>
  );
}
