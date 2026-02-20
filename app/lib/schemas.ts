import z from "zod"

export const DailyCheckInSchema = z.object({
	sleepHours: z.number(),
	sleepQuality: z.number(),
	energy: z.number(),
	soreness: z.number(),
	sorenessAreas: z.array(z.string()).optional(),
	stress: z.number(),
	notes: z.string(),
})

export type DailyCheckIn = z.infer<typeof DailyCheckInSchema>;

export const WorkoutPlanSchema = z.object({
  date: z.string(),
  modality: z.enum(["dance", "strength", "zone2", "recovery", "rest"]),
  durationMin: z.number().int().min(0).max(180),
  intensity: z.enum(["easy", "moderate", "hard"]),
  warmup: z.array(z.string()),
  main: z.array(z.string()),
  cooldown: z.array(z.string()),
  rationale: z.string(),
  stopIf: z.array(z.string()),
});

export type WorkoutPlan = z.infer<typeof WorkoutPlanSchema>;
