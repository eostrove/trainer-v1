import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import z from "zod";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const PartialCheckInSchema = z.object({
  sleepHours: z.number().min(0).max(24).optional(),
  sleepQuality: z.number().int().min(1).max(10).optional(),
  energy: z.number().int().min(1).max(10).optional(),
  soreness: z.number().int().min(0).max(10).optional(),
  stress: z.number().int().min(1).max(10).optional(),
  sorenessAreas: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

const IntakeRequestSchema = z.object({
  message: z.string().min(1),
  checkIn: PartialCheckInSchema.optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["trainer", "user"]),
        content: z.string(),
      })
    )
    .optional(),
  context: z
    .object({
      longTermGoals: z.union([z.string(), z.array(z.string())]).optional(),
      trainingHistory: z.unknown().optional(),
      previousWorkout: z.union([z.string(), z.object({}).passthrough()]).optional(),
      equipment: z.unknown().optional(),
      limitations: z.unknown().optional(),
      preferences: z.unknown().optional(),
      availableTimeMin: z.number().optional(),
    })
    .partial()
    .optional(),
});

const IntakeModelOutputSchema = z.object({
  coachReply: z.string(),
  extracted: z
    .object({
      sleepHours: z.number().nullable().optional(),
      sleepQuality: z.number().nullable().optional(),
      energy: z.number().nullable().optional(),
      soreness: z.number().nullable().optional(),
      stress: z.number().nullable().optional(),
      sorenessAreas: z.array(z.string()).nullable().optional(),
      notes: z.string().nullable().optional(),
    })
    .optional(),
});

const REQUIRED_KEYS = ["sleepHours", "sleepQuality", "energy", "soreness", "stress"] as const;
type RequiredCheckInKey = (typeof REQUIRED_KEYS)[number];

function computeMissing(checkIn: z.infer<typeof PartialCheckInSchema>): RequiredCheckInKey[] {
  return REQUIRED_KEYS.filter((key) => typeof checkIn[key] !== "number");
}

function buildFollowUpPrompt(missing: RequiredCheckInKey[]) {
  const labels: Record<RequiredCheckInKey, string> = {
    sleepHours: "hours of sleep (0-24)",
    sleepQuality: "sleep quality (1-10)",
    energy: "energy (1-10)",
    soreness: "soreness (0-10)",
    stress: "stress (1-10)",
  };

  if (missing.length === 0) {
    return "Perfect, I have what I need to build your plan.";
  }

  if (missing.length === 1) {
    return `Thanks, that helps. One more quick one: ${labels[missing[0]]}?`;
  }

  const requested = missing.slice(0, 2).map((key) => labels[key]).join(" and ");
  return `Got it. To dial this in, can you quickly share your ${requested}?`;
}

function finalizeCoachReply(coachReply: string, missing: RequiredCheckInKey[]) {
  const trimmed = coachReply.trim();
  if (missing.length > 0) return trimmed || buildFollowUpPrompt(missing);

  // Intake is complete: avoid extra probing questions and keep it as a concise confirmation.
  if (!trimmed) return "Awesome, thanks. I have everything I need.";
  if (trimmed.includes("?")) return "Awesome, thanks. I have everything I need.";
  return trimmed;
}

function normalizeExtracted(extractedRaw: z.infer<typeof IntakeModelOutputSchema>["extracted"]) {
  const normalized: z.infer<typeof PartialCheckInSchema> = {};
  if (!extractedRaw) return normalized;

  const putIfValid = <K extends keyof z.infer<typeof PartialCheckInSchema>>(
    key: K,
    value: unknown,
    schema: z.ZodType<z.infer<typeof PartialCheckInSchema>[K]>
  ) => {
    const parsed = schema.safeParse(value);
    if (parsed.success) {
      normalized[key] = parsed.data;
    }
  };

  if (extractedRaw.sleepHours !== null && extractedRaw.sleepHours !== undefined) {
    putIfValid("sleepHours", extractedRaw.sleepHours, z.number().min(0).max(24).optional());
  }
  if (extractedRaw.sleepQuality !== null && extractedRaw.sleepQuality !== undefined) {
    putIfValid("sleepQuality", extractedRaw.sleepQuality, z.number().int().min(1).max(10).optional());
  }
  if (extractedRaw.energy !== null && extractedRaw.energy !== undefined) {
    putIfValid("energy", extractedRaw.energy, z.number().int().min(1).max(10).optional());
  }
  if (extractedRaw.soreness !== null && extractedRaw.soreness !== undefined) {
    putIfValid("soreness", extractedRaw.soreness, z.number().int().min(0).max(10).optional());
  }
  if (extractedRaw.stress !== null && extractedRaw.stress !== undefined) {
    putIfValid("stress", extractedRaw.stress, z.number().int().min(1).max(10).optional());
  }
  if (extractedRaw.sorenessAreas !== null && extractedRaw.sorenessAreas !== undefined) {
    putIfValid("sorenessAreas", extractedRaw.sorenessAreas, z.array(z.string()).optional());
  }
  if (extractedRaw.notes !== null && extractedRaw.notes !== undefined) {
    putIfValid("notes", extractedRaw.notes, z.string().optional());
  }

  return normalized;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsedReq = IntakeRequestSchema.safeParse(body);

    if (!parsedReq.success) {
      return NextResponse.json({ error: parsedReq.error.flatten() }, { status: 400 });
    }

    const currentCheckIn = parsedReq.data.checkIn ?? {};
    const history = parsedReq.data.history ?? [];
    const context = parsedReq.data.context ?? {};

    const response = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.8,
      messages: [
        {
          role: "system",
          content: `
You are a world-class personal trainer chatting with an athlete.
Your job in this turn:
1) Extract any check-in fields from the athlete message
2) Reply like a human coach (brief, warm, practical)
3) Ask only for the missing required fields

Required daily check-in fields:
- sleepHours: number 0-24
- sleepQuality: integer 1-10
- energy: integer 1-10
- soreness: integer 0-10
- stress: integer 1-10

Optional fields:
- notes: string
- sorenessAreas: string[]

Rules:
- Do not invent values.
- If user implies illness, acknowledge and ask safety-focused follow-up.
- Keep coachReply concise (1-3 sentences).
- coachReply should feel conversational like you're chatting with a good friend, not like a survey.
- If user gives vague language (e.g., "just okay", "kinda tired"), ask a friendly clarifying question for exact numeric values.
- Ask for at most 1-2 missing required fields per turn, but only if there is a missing required field. If all required fields are present, do not ask for anything else.
- If all required fields are present, coachReply must be a brief confirmation that acknowledges how the athlete is feeling and must not contain a question.
- Return valid JSON only.
`,
        },
        {
          role: "user",
          content: JSON.stringify(
            {
              athleteContext: context,
              currentKnownCheckIn: currentCheckIn,
              recentConversation: history.slice(-8),
              latestUserMessage: parsedReq.data.message,
              outputContract: {
                coachReply: "string",
                extracted: {
                  sleepHours: "number | null",
                  sleepQuality: "number | null",
                  energy: "number | null",
                  soreness: "number | null",
                  stress: "number | null",
                  sorenessAreas: "string[] | null",
                  notes: "string | null",
                },
              },
            },
            null,
            2
          ),
        },
      ],
    });

    const rawContent = response.choices[0]?.message?.content;
    if (!rawContent) {
      return NextResponse.json({ error: "No response from model" }, { status: 500 });
    }

    let modelJson: unknown;
    try {
      modelJson = JSON.parse(rawContent);
    } catch {
      const missing = computeMissing(currentCheckIn);
      return NextResponse.json({
        coachReply: buildFollowUpPrompt(missing),
        checkIn: currentCheckIn,
        missing,
        done: missing.length === 0,
      });
    }

    const parsedModel = IntakeModelOutputSchema.safeParse(modelJson);
    if (!parsedModel.success) {
      const missing = computeMissing(currentCheckIn);
      return NextResponse.json({
        coachReply: buildFollowUpPrompt(missing),
        checkIn: currentCheckIn,
        missing,
        done: missing.length === 0,
      });
    }

    const normalizedExtracted = normalizeExtracted(parsedModel.data.extracted);

    const mergedCandidate = {
      ...currentCheckIn,
      ...normalizedExtracted,
    };

    const parsedMerged = PartialCheckInSchema.safeParse(mergedCandidate);
    if (!parsedMerged.success) {
      const missing = computeMissing(currentCheckIn);
      return NextResponse.json({
        coachReply: buildFollowUpPrompt(missing),
        checkIn: currentCheckIn,
        missing,
        done: missing.length === 0,
      });
    }

    const mergedCheckIn = parsedMerged.data;
    const missing = computeMissing(mergedCheckIn);
    return NextResponse.json({
      coachReply: finalizeCoachReply(parsedModel.data.coachReply, missing),
      checkIn: mergedCheckIn,
      missing,
      done: missing.length === 0,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
