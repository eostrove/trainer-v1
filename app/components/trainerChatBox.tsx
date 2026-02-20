import { Box, Typography } from "@mui/material";
import { useMemo, useState } from "react";
import { ChatMessage } from "../model/chatMessage";
import { DailyCheckIn, WorkoutPlan } from "../lib/schemas";

function uid() {
	return Math.random().toString(16).slice(2);
}

const QUESTIONS = [
	{
		key: "sleepHours",
		prompt: "Good morning. How many hours did you sleep?",
		parse: (v: string) => {
			const n = Number(v);
			if (!Number.isFinite(n) || n < 0 || n > 24) throw new Error("Enter 0–24.");
			return n;
		},
	},
	{
		key: "sleepQuality",
		prompt: "How was sleep quality (1–5)?",
		parse: (v: string) => {
			const n = Number(v);
			if (!Number.isInteger(n) || n < 1 || n > 5) throw new Error("Enter 1–5.");
			return n;
		},
	},
	{
		key: "energy",
		prompt: "Energy level right now (1–10)?",
		parse: (v: string) => {
			const n = Number(v);
			if (!Number.isInteger(n) || n < 1 || n > 10) throw new Error("Enter 1–10.");
			return n;
		},
	},
	{
		key: "soreness",
		prompt: "Overall soreness (0–10)?",
		parse: (v: string) => {
			const n = Number(v);
			if (!Number.isInteger(n) || n < 0 || n > 10) throw new Error("Enter 0–10.");
			return n;
		},
	},
	{
		key: "stress",
		prompt: "Stress level (1–10)?",
		parse: (v: string) => {
			const n = Number(v);
			if (!Number.isInteger(n) || n < 1 || n > 10) throw new Error("Enter 1–10.");
			return n;
		},
	},
	{
		key: "notes",
		prompt:
			"Any notes (e.g., where you're sore, how yesterday’s workout felt, injuries)? (optional)",
		parse: (v: string) => v.trim(),
		optional: true,
	},
] as const;

export default function TrainerChatBox() {
	const [messages, setMessages] = useState<ChatMessage[]>([
		{ id: uid(), role: "trainer", content: QUESTIONS[0].prompt },
	]);
	const [checkIn, setCheckIn] = useState<DailyCheckIn>({});
	const [step, setStep] = useState(0);
	const [input, setInput] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [plan, setPlan] = useState<WorkoutPlan | null>(null);

	const current = QUESTIONS[step];

	const placeholder = useMemo(() => {
		if (!current) return "Type here…";
		if (current.key === "sleepHours") return "e.g. 7.5";
		if (current.key === "sleepQuality") return "1–5";
		if (current.key === "energy") return "1–10";
		if (current.key === "soreness") return "0–10";
		if (current.key === "stress") return "1–10";
		return "Optional";
	}, [current]);

	async function submit() {
		if (!current || isLoading) return;

		setError(null);
		const raw = input;

		// add user's message
		if (raw.trim().length > 0) {
			setMessages((m) => [...m, { id: uid(), role: "user", content: raw.trim() }]);
		} else if (!("optional" in current) || !current.optional) {
			setError("Please enter a value.");
			return;
		}

		// parse + store
		try {
			if (raw.trim().length > 0) {
				const parsedValue = current.parse(raw);
				console.log("parsedValue", parsedValue);
				setCheckIn((c) => ({ ...c, [current.key]: parsedValue }));
			}
		} catch (e: any) {
			setError(e?.message ?? "Invalid value.");
			return;
		}

		setInput("");

		// advance or call API
		if (step < QUESTIONS.length - 1) {
			const nextStep = step + 1;
			setStep(nextStep);
			setMessages((m) => [...m, { id: uid(), role: "trainer", content: QUESTIONS[nextStep].prompt }]);
			return;
		}

		// final step: call /api/plan
		setIsLoading(true);
		setMessages((m) => [...m, { id: uid(), role: "trainer", content: "Got it. Building your plan…" }]);

		// build payload with required fields (notes optional)
		const payload = {
			sleepHours: checkIn.sleepHours,
			sleepQuality: checkIn.sleepQuality,
			energy: checkIn.energy,
			soreness: checkIn.soreness,
			stress: checkIn.stress,
			notes: (checkIn.notes ?? "").toString().trim() || undefined,
			// sorenessAreas not collected yet; can add later
		};

		try {
			const res = await fetch("/api/plan", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});

			const data = await res.json();

			if (!res.ok) {
				setError(data?.error ? JSON.stringify(data.error) : "Request failed.");
				setIsLoading(false);
				return;
			}

			setPlan(data);

			setMessages((m) => [
				...m,
				{
					id: uid(),
					role: "trainer",
					content: `Here’s your plan: ${data.modality} • ${data.durationMin} min • ${data.intensity}`,
				},
			]);
		} catch (e: any) {
			setError(e?.message ?? "Network error.");
		} finally {
			setIsLoading(false);
		}
	}

	function reset() {
		setPlan(null);
		setCheckIn({});
		setStep(0);
		setInput("");
		setError(null);
		setIsLoading(false);
		setMessages([{ id: uid(), role: "trainer", content: QUESTIONS[0].prompt }]);
	}

	return (
		<>
			<Box>
				{messages.map((msg) => (
					<div
						key={msg.id}
						style={{
							alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
							maxWidth: "85%",
							padding: "10px 12px",
							borderRadius: 12,
							background: msg.role === "user" ? "#f3f4f6" : "#eef2ff",
							whiteSpace: "pre-wrap",
						}}
					>
						{msg.content}
					</div>
				))}
			</Box>
			{plan && (
				<div style={{ marginTop: 16, borderTop: "1px solid #eee", paddingTop: 16 }}>
					<h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Workout Plan</h2>

					<div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
						<Badge label={`Modality: ${plan.modality}`} />
						<Badge label={`Duration: ${plan.durationMin} min`} />
						<Badge label={`Intensity: ${plan.intensity}`} />
					</div>

					{plan.activities.map((act, idx) => (
						<div key={idx} style={{ marginBottom: 10, padding: 10, border: "1px solid #ddd", borderRadius: 8 }}>
							<div style={{ fontWeight: 600 }}>{act.type}</div>
							<div>{act.description}</div>
							<div style={{ fontSize: 12, color: "#555" }}>
								{act.durationMin} min • {act.intensity}
							</div>
						</div>
					))}

					<p style={{ marginTop: 10 }}>
						<strong>Rationale:</strong> {plan.rationale}
					</p>

					<Section title="Stop if" items={plan.stopIf} />

					<button
						onClick={reset}
						style={{
							marginTop: 14,
							padding: "10px 12px",
							borderRadius: 10,
							border: "1px solid #ddd",
							background: "#fff",
							cursor: "pointer",
						}}
					>
						New check-in
					</button>
				</div>
			)}

			{!plan && (
				<div style={{ marginTop: 12 }}>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							submit();
						}}
						style={{ display: "flex", gap: 8 }}
					>
						<input
							value={input}
							onChange={(e) => setInput(e.target.value)}
							placeholder={placeholder}
							disabled={isLoading}
							style={{
								flex: 1,
								padding: "10px 12px",
								borderRadius: 10,
								border: "1px solid #ddd",
							}}
						/>
						<button
							type="submit"
							disabled={isLoading}
							style={{
								padding: "10px 12px",
								borderRadius: 10,
								border: "1px solid #ddd",
								background: isLoading ? "#f3f4f6" : "#fff",
								cursor: isLoading ? "not-allowed" : "pointer",
							}}
						>
							Send
						</button>
					</form>

					{error && (
						<p style={{ marginTop: 8, color: "#b91c1c", whiteSpace: "pre-wrap" }}>
							{error}
						</p>
					)}
				</div>
			)}
		</>
	);
}

function Badge({ label }: { label: string }) {
	return (
		<span
			style={{
				display: "inline-block",
				padding: "6px 10px",
				borderRadius: 999,
				border: "1px solid #e5e7eb",
				background: "#fafafa",
				fontSize: 12,
			}}
		>
			{label}
		</span>
	);
}

function Section({ title, items }: { title: string; items: string[] }) {
	return (
		<div style={{ marginTop: 10 }}>
			<div style={{ fontWeight: 700, marginBottom: 4 }}>{title}</div>
			<ul style={{ margin: 0, paddingLeft: 18 }}>
				{items.map((it, idx) => (
					<li key={`${title}-${idx}`}>{it}</li>
				))}
			</ul>
		</div>
	);
}
