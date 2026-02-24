import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { DailyCheckInSchema, WorkoutPlanSchema } from "@/app/lib/schemas";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 1. Validate input
    const parsed = DailyCheckInSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const checkIn = parsed.data;
    const context = {
      longTermGoals: body.longTermGoals ?? body.goals ?? body.goal ?? null,
      trainingHistory: body.trainingHistory ?? body.recentWorkouts ?? body.last7Days ?? null,
      previousWorkout: body.previousWorkout ?? body.yesterdayWorkout ?? body.lastWorkout ?? null,
      equipment: body.equipment ?? body.availableEquipment ?? null,
      limitations: body.limitations ?? body.injuries ?? null,
      preferences: body.preferences ?? null,
      availableTimeMin: body.availableTimeMin ?? body.timeAvailableMin ?? null,
    };

    // 2. Deterministic safety gate BEFORE model call
    if (checkIn.soreness >= 8 || checkIn.energy <= 2) {
      const recoveryPlan = {
        date: new Date().toISOString(),
        modality: "recovery",
        durationMin: 20,
        intensity: "easy",
        activities: [
          {
            type: "warmup",
            description: "Gentle walk",
            durationMin: 5,
            intensity: "easy",
          },
          {
            type: "mobility",
            description: "Light mobility flow and foam rolling",
            durationMin: 10,
            intensity: "easy",
          },
          {
            type: "cooldown",
            description: "Breathing exercises",
            durationMin: 5,
            intensity: "easy",
          },
        ],
        rationale:
          "High soreness or very low energy detected. Prioritizing recovery.",
        stopIf: ["Pain increases", "Dizziness", "Sharp joint pain"],
      };

      return NextResponse.json(recoveryPlan);
    }

    // 3. Call GPT
    const response = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: `
You are an elite, safety-first personal trainer and daily programming coach.
You write plans that are personalized to:
1) long-term goals and training progression
2) today's readiness and recovery signals
3) what muscle groups and stressors were trained recently

You must adapt session design based on readiness:
- poor sleep, high stress, high soreness, illness signals -> reduce intensity and total load
- high energy + good recovery -> allow productive load and progression

You must avoid training the same stressed muscle groups hard on consecutive days.
If previous training data is missing, infer cautiously from notes/soreness and choose balanced/low-risk programming.

Output policy:
- Return ONLY valid JSON.
- Do not include markdown.
- Follow the exact response schema and allowed enum values.
`,
        },
        {
          role: "user",
          content: `
Athlete context (may be partially missing):
${JSON.stringify(context, null, 2)}

Today's check-in:

${JSON.stringify(checkIn, null, 2)}

Task:
Create today's workout plan with hyper-personalization and sustainable progression.

Constraints:
- If sleep < 5 hours → intensity must be "easy"
- If soreness > 6 → avoid strength
- If energy > 7 and soreness < 4 → moderate or hard allowed
- Keep duration realistic (30–60 min typical)
- If notes imply illness (e.g. "sick", "fever", "flu", "cold", "nausea", "dizzy"), choose "recovery" or "rest" with easy intensity
- If previousWorkout/trainingHistory includes major muscle groups trained yesterday, avoid repeating those groups at hard intensity today
- activities must be internally consistent with modality and intensity
- Sum of activities.durationMin should approximately match durationMin
- rationale should explicitly mention readiness factors (sleep/energy/soreness/stress/notes) and progression logic

Return ONLY a JSON object with exactly these keys:
{
  "modality": "dance" | "strength" | "zone2" | "recovery" | "rest",
  "durationMin": number,
  "intensity": "easy" | "moderate" | "hard",
  "rationale": string,
  "stopIf": string[],
  "activities": [{"type": string, "description": string, "durationMin": number, "intensity": "easy"|"moderate"|"hard"}]
}

Rules:
- Do NOT include any other keys.
- Do NOT wrap the object in "workoutPlan".
- Use "durationMin" (not durationMinutes).
`,
        },
      ],
    });
    const content = response.choices[0].message.content;

    if (!content) {
      return NextResponse.json(
        { error: "No response from model" },
        { status: 500 }
      );
    }

    // 4. Parse model output
    const parsedPlan = WorkoutPlanSchema.safeParse(JSON.parse(content));
    if (!parsedPlan.success) {
      return NextResponse.json(
        { error: "Model output invalid", details: parsedPlan.error.flatten() },
        { status: 500 }
      );
    }

    return NextResponse.json(parsedPlan.data);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
