import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import z from "zod";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const PartialCheckInSchema = z.object({
  sleepHours: z.number().min(0).max(24).optional(),
  sleepQuality: z.number().int().min(1).max(5).optional(),
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
      temperature: 0.4,
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
      return NextResponse.json({ error: "Model returned non-JSON content", raw: rawContent }, { status: 500 });
    }

    const parsedModel = IntakeModelOutputSchema.safeParse(modelJson);
    if (!parsedModel.success) {
      return NextResponse.json(
        { error: "Model output invalid", details: parsedModel.error.flatten(), raw: modelJson },
        { status: 500 }
      );
    }

    const extractedRaw = parsedModel.data.extracted ?? {};
    const normalizedExtracted = {
      ...("sleepHours" in extractedRaw && extractedRaw.sleepHours !== null
        ? { sleepHours: extractedRaw.sleepHours }
        : {}),
      ...("sleepQuality" in extractedRaw && extractedRaw.sleepQuality !== null
        ? { sleepQuality: extractedRaw.sleepQuality }
        : {}),
      ...("energy" in extractedRaw && extractedRaw.energy !== null ? { energy: extractedRaw.energy } : {}),
      ...("soreness" in extractedRaw && extractedRaw.soreness !== null
        ? { soreness: extractedRaw.soreness }
        : {}),
      ...("stress" in extractedRaw && extractedRaw.stress !== null ? { stress: extractedRaw.stress } : {}),
      ...("sorenessAreas" in extractedRaw && extractedRaw.sorenessAreas !== null
        ? { sorenessAreas: extractedRaw.sorenessAreas }
        : {}),
      ...("notes" in extractedRaw && extractedRaw.notes !== null ? { notes: extractedRaw.notes } : {}),
    };

    const mergedCandidate = {
      ...currentCheckIn,
      ...normalizedExtracted,
    };

    const parsedMerged = PartialCheckInSchema.safeParse(mergedCandidate);
    if (!parsedMerged.success) {
      return NextResponse.json(
        {
          error: "Extracted values invalid",
          details: parsedMerged.error.flatten(),
          extracted: normalizedExtracted,
        },
        { status: 400 }
      );
    }

    const mergedCheckIn = parsedMerged.data;
    const missing = computeMissing(mergedCheckIn);

    return NextResponse.json({
      coachReply: parsedModel.data.coachReply,
      checkIn: mergedCheckIn,
      missing,
      done: missing.length === 0,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
