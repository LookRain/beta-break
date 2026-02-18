import React from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { NativeTabs, Icon, Label, VectorIcon } from 'expo-router/unstable-native-tabs';
import { colors } from '@/lib/theme';

export default function TabLayout() {
  const tintColor = colors.primary;
  const textColor = '#111827';

  return (
    <NativeTabs tintColor={tintColor} labelStyle={{ color: textColor }}>
      <NativeTabs.Trigger name="train">
        <Label>Train</Label>
        <Icon
          src={{
            default: <VectorIcon family={Ionicons} name="barbell-outline" />,
            selected: <VectorIcon family={Ionicons} name="barbell" />,
          }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="calendar">
        <Label>Plan</Label>
        <Icon
          src={{
            default: <VectorIcon family={Ionicons} name="calendar-outline" />,
            selected: <VectorIcon family={Ionicons} name="calendar" />,
          }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="discover">
        <Label>Exercises</Label>
        <Icon
          src={{
            default: <VectorIcon family={Ionicons} name="compass-outline" />,
            selected: <VectorIcon family={Ionicons} name="compass" />,
          }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <Label>Profile</Label>
        <Icon
          src={{
            default: <VectorIcon family={Ionicons} name="person-outline" />,
            selected: <VectorIcon family={Ionicons} name="person" />,
          }}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
