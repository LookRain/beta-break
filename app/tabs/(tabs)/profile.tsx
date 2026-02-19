import React from "react";
import { useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import { ProfileForm } from "@/components/profile-form";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";

export default function ProfileScreen() {
  const profile = useQuery(api.profiles.getMyProfile);
  const upsertProfile = useMutation(api.profiles.upsertMyProfile);
  const { signOut } = useAuthActions();

  if (profile === undefined) {
    return (
      <Box className="flex-1 items-center justify-center">
        <Text className="text-typography-500">Loading profile...</Text>
      </Box>
    );
  }

  return (
    <ProfileForm
      initialValues={
        profile
          ? {
              styles: profile.styles,
              climbingAgeMonths: profile.climbingAgeMonths,
              boulderingGrade: profile.boulderingGrade,
              sportGrade: profile.sportGrade,
              tradGrade: profile.tradGrade,
              regions: profile.regions,
              bio: profile.bio,
              goals: profile.goals,
              showProfilePublic: profile.showProfilePublic,
              showHistoryPublic: profile.showHistoryPublic,
              username: profile.username,
              bodyWeightKg: profile.bodyWeightKg,
            }
          : {
              username: undefined,
              bodyWeightKg: undefined,
              styles: [],
              regions: [],
              showProfilePublic: true,
              showHistoryPublic: true,
            }
      }
      onSubmit={(values) =>
        upsertProfile({
          username: values.username,
          bodyWeightKg: values.bodyWeightKg,
          styles: values.styles,
          climbingAgeMonths: values.climbingAgeMonths,
          boulderingGrade: values.boulderingGrade,
          sportGrade: values.sportGrade,
          tradGrade: values.tradGrade,
          regions: values.regions,
          bio: values.bio,
          goals: values.goals,
          showProfilePublic: values.showProfilePublic,
          showHistoryPublic: values.showHistoryPublic,
        })}
      onSignOut={() => signOut()}
    />
  );
}
