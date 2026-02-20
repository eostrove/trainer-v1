import z from "zod"

export const DailyCheckInSchema = z.object({
	sleepHours: z.number(),
	sleepQuality: z.number(),
	energy: z.number(),
	soreness: z.number(),
	stress: z.number(),
	notes: z.string(),
})

export const WorkoutPlanSchema = z.object({
	category: z.string(),
	durationMinutes: z.number(),
	intensity: z.number(),
	heartRateZone: z.number(),
})
