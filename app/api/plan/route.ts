import { NextResponse } from "next/server";

type CheckInInput = {
  sleepHours: number;
  sleepQuality: number;
  energy: number;
  soreness: number;
  stress: number;
  notes: string;
};

type PlanOutput = {
  type: "recovery" | "base" | "build";
  durationMin: number;
  intensity: "low" | "moderate" | "high";
  modality: string;
  warmup: string[];
  main: string[];
  cooldown: string[];
  rationale: string;
  stopIf: string;
};

const REQUIRED_KEYS: Array<keyof CheckInInput> = [
  "sleepHours",
  "sleepQuality",
  "energy",
  "soreness",
  "stress",
  "notes",
];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateInput(body: unknown): { ok: true; data: CheckInInput } | { ok: false; error: string } {
  if (!isObject(body)) {
    return { ok: false, error: "Body must be a JSON object." };
  }

  const keys = Object.keys(body);
  if (keys.length !== REQUIRED_KEYS.length || !REQUIRED_KEYS.every((key) => key in body)) {
    return { ok: false, error: `Body must contain exactly: ${REQUIRED_KEYS.join(", ")}.` };
  }

  const sleepHours = body.sleepHours;
  const sleepQuality = body.sleepQuality;
  const energy = body.energy;
  const soreness = body.soreness;
  const stress = body.stress;
  const notes = body.notes;

  if (
    typeof sleepHours !== "number" ||
    typeof sleepQuality !== "number" ||
    typeof energy !== "number" ||
    typeof soreness !== "number" ||
    typeof stress !== "number" ||
    typeof notes !== "string"
  ) {
    return { ok: false, error: "Invalid field types in request body." };
  }

  if (
    sleepHours < 0 ||
    sleepHours > 24 ||
    sleepQuality < 1 ||
    sleepQuality > 10 ||
    energy < 1 ||
    energy > 10 ||
    soreness < 1 ||
    soreness > 10 ||
    stress < 1 ||
    stress > 10
  ) {
    return { ok: false, error: "Numeric values out of range." };
  }

  return {
    ok: true,
    data: {
      sleepHours,
      sleepQuality,
      energy,
      soreness,
      stress,
      notes: notes.trim(),
    },
  };
}

function buildPlan(input: CheckInInput): PlanOutput {
  const readiness =
    input.energy * 1.2 +
    input.sleepQuality * 1.1 +
    Math.min(input.sleepHours, 9) -
    input.soreness * 0.9 -
    input.stress * 0.8;

  if (input.sleepHours < 5 || input.stress >= 9 || readiness < 7) {
    return {
      type: "recovery",
      durationMin: 30,
      intensity: "low",
      modality: "walk + mobility",
      warmup: ["5 min easy walk", "2 min breathing"],
      main: ["15 min zone 1 walk", "8 min mobility flow"],
      cooldown: ["3 min nasal breathing", "2 min light stretch"],
      rationale:
        "Low readiness today; favor circulation, tissue quality, and nervous-system downshift over load.",
      stopIf: "Dizziness, pain above 3/10, or unusual fatigue appears.",
    };
  }

  if (readiness < 12) {
    return {
      type: "base",
      durationMin: 45,
      intensity: "moderate",
      modality: "steady cardio + basic strength",
      warmup: ["6 min easy bike/row", "2 rounds dynamic prep"],
      main: [
        "20 min zone 2 cardio",
        "3 rounds: squat, push, hinge, row (moderate effort)",
      ],
      cooldown: ["5 min easy spin/walk", "4 min hips + t-spine mobility"],
      rationale:
        "Readiness is moderate, so today supports consistency and aerobic/strength base without excessive fatigue.",
      stopIf: "Form degrades repeatedly or effort spikes unexpectedly early.",
    };
  }

  return {
    type: "build",
    durationMin: 60,
    intensity: "high",
    modality: "strength + intervals",
    warmup: ["8 min progressive cardio", "movement prep + activation"],
    main: [
      "Strength block: 4 sets each of squat, press, hinge (RPE 7-8)",
      "Conditioning: 8 x 45s hard / 75s easy",
    ],
    cooldown: ["5 min easy movement", "5 min full-body mobility + breathing"],
    rationale:
      "High readiness allows productive overload while still capping volume to protect tomorrow's quality.",
    stopIf: "Sharp pain, loss of coordination, or inability to recover between intervals.",
  };
}

export async function POST(request: Request) {
  let parsed: unknown;

  try {
    parsed = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const validated = validateInput(parsed);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const plan = buildPlan(validated.data);
  return NextResponse.json(plan, { status: 200 });
}
