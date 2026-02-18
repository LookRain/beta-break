import { Platform } from "react-native";

/**
 * Shared theme constants for inline styles where Tailwind classes aren't available
 * (e.g. TextInput, Calendar, react-native-calendars).
 */

export const colors = {
  primary: "#6366f1",
  primaryLight: "#818cf8",
  primaryDark: "#4f46e5",
  primaryBg: "#eef2ff",
  primaryBgSubtle: "#e0e7ff",

  accent: "#f43f5e",
  accentBg: "#fff1f2",

  text: "#111827",
  textSecondary: "#6b7280",
  textMuted: "#9ca3af",
  textInverse: "#ffffff",

  bg: "#fafaf9",
  bgCard: "#ffffff",

  border: "#e5e7eb",
  borderLight: "#f3f4f6",
  borderFocus: "#6366f1",

  success: "#14b8a6",
  successBg: "#f0fdfa",
  warning: "#f59e0b",
  warningBg: "#fffbeb",
  error: "#ef4444",
  errorBg: "#fef2f2",

  timer: {
    work: "#22c55e",
    workBg: "#052e16",
    workTrack: "#14532d",
    rest: "#f97316",
    restBg: "#431407",
    restTrack: "#7c2d12",
    complete: "#3b82f6",
    completeBg: "#172554",
    completeTrack: "#1e3a5f",
  },

  calendar: {
    dotCompleted: "#14b8a6",
    dotUpcoming: "#6366f1",
    dotPast: "#d1d5db",
    selectedBg: "#6366f1",
    todayText: "#6366f1",
  },
};

export const cardShadow = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  android: {
    elevation: 2,
  },
  default: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
});

export const inputStyle = {
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: 12,
  paddingHorizontal: 16,
  paddingVertical: 12,
  fontSize: 15,
  color: colors.text,
  backgroundColor: colors.bgCard,
} as const;

export const calendarTheme = {
  backgroundColor: "transparent",
  calendarBackground: "transparent",
  textSectionTitleColor: colors.textSecondary,
  selectedDayBackgroundColor: colors.calendar.selectedBg,
  selectedDayTextColor: colors.textInverse,
  todayTextColor: colors.calendar.todayText,
  dayTextColor: colors.text,
  textDisabledColor: "#d1d5db",
  dotColor: colors.calendar.dotUpcoming,
  selectedDotColor: colors.textInverse,
  arrowColor: colors.primary,
  monthTextColor: colors.text,
  textDayFontWeight: "500" as const,
  textMonthFontWeight: "700" as const,
  textDayHeaderFontWeight: "600" as const,
  textDayFontSize: 15,
  textMonthFontSize: 17,
  textDayHeaderFontSize: 13,
};

export const screenPadding = { padding: 20, paddingBottom: 40 };
