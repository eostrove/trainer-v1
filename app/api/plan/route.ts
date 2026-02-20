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

    console.log("parsed check-in", parsed.data);

    const checkIn = parsed.data;

    // 2. Deterministic safety gate BEFORE model call
    if (checkIn.soreness >= 8 || checkIn.energy <= 2) {
      const recoveryPlan = {
        date: new Date().toISOString(),
        modality: "recovery",
        durationMin: 20,
        intensity: "easy",
        warmup: ["5 min gentle walk"],
        main: ["Light mobility flow", "Foam rolling","Incline treadmill walk"],
        cooldown: ["Breathing exercises"],
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
You are a conservative, safety-focused personal trainer.
Return ONLY valid JSON.
Do not include markdown.
Follow the exact schema provided.
`,
        },
        {
          role: "user",
          content: `
Here is today's check-in:

${JSON.stringify(checkIn, null, 2)}

Create a workout plan.
Constraints:
- If sleep < 5 hours → intensity must be "easy"
- If soreness > 6 → avoid strength
- If energy > 7 and soreness < 4 → moderate or hard allowed
- Keep duration realistic (30–60 min typical)

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
    console.log("response okay")
    const content = response.choices[0].message.content;
    console.log("content", content)

    if (!content) {
      return NextResponse.json(
        { error: "No response from model" },
        { status: 500 }
      );
    }

    // 4. Parse model output
    const parsedPlan = WorkoutPlanSchema.safeParse(JSON.parse(content));
    console.log("parsedPlan", parsedPlan);
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
