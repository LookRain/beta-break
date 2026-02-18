export const TRAINING_CATEGORIES = [
  "finger-strength",
  "power-endurance",
  "mobility",
  "technique",
  "conditioning",
] as const;

export const TRAINING_TYPES = [
  "hang",
  "weight_training",
  "climbing",
  "others",
] as const;

export const HANG_EQUIPMENT_OPTIONS = [
  "fingerboard",
  "bar",
] as const;

export const HANG_EDGE_MM_OPTIONS = [8, 10, 15, 20, 25] as const;

export const HANG_CRIMP_TYPES = [
  "open",
  "half",
  "full",
] as const;

export const HANG_LOAD_PREFERENCES = [
  "below_100",
  "above_100",
] as const;

export type TrainingType = (typeof TRAINING_TYPES)[number];
export type HangEquipment = (typeof HANG_EQUIPMENT_OPTIONS)[number];
export type HangCrimpType = (typeof HANG_CRIMP_TYPES)[number];
export type HangLoadPreference = (typeof HANG_LOAD_PREFERENCES)[number];
export type HangEdgeMm = (typeof HANG_EDGE_MM_OPTIONS)[number];

export const TRAINING_EQUIPMENT_PRESETS = [
  "fingerboard",
  "bar",
  "dumbbell",
  "kettlebell",
  "barbell",
  "pull-up belt",
  "resistance band",
  "weight vest",
] as const;

export const TRAINING_DIFFICULTIES = [
  "beginner",
  "intermediate",
  "advanced",
] as const;

export type TrainingDifficulty = (typeof TRAINING_DIFFICULTIES)[number];

export function parseCommaSeparated(input: string): string[] {
  return input
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export function toCommaSeparated(values: string[]): string {
  return values.join(", ");
}
