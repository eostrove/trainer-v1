export type WorkoutPlan = {
  date: string;
  modality: "dance" | "strength" | "zone2" | "recovery" | "rest";
  durationMin: number;
  intensity: "easy" | "moderate" | "hard";
  warmup: string[];
  main: string[];
  cooldown: string[];
  rationale: string;
  stopIf: string[];
};