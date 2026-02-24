import z from "zod"

export const DailyCheckInSchema = z.object({
	sleepHours: z.number(),
	sleepQuality: z.number(),
	energy: z.number(),
	soreness: z.number(),
	sorenessAreas: z.array(z.string()).optional(),
	stress: z.number(),
	notes: z.string().optional(),
})

export type DailyCheckIn = z.infer<typeof DailyCheckInSchema>;

export const ActivitySchema = z.object({
	type: z.string(),
	description: z.string(),
	durationMin: z.number().int().min(0).max(180),
	intensity: z.enum(["easy", "moderate", "hard"]),
});

export type Activity = z.infer<typeof ActivitySchema>;

export const WorkoutPlanSchema = z.object({
  date: z.string().optional(),
  summary: z.string(),
  modality: z.enum(["dance", "strength", "zone2", "recovery", "rest"]),
  durationMin: z.number().int().min(0).max(180),
  activities: z.array(ActivitySchema).min(1),
  intensity: z.enum(["easy", "moderate", "hard"]),
  rationale: z.string(),
  stopIf: z.array(z.string()),
});

export type WorkoutPlan = z.infer<typeof WorkoutPlanSchema>;
