import {
	Box,
	Button,
	Chip,
	Divider,
	List,
	ListItem,
	Paper,
	Stack,
	TextField,
	Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import { ChatMessage } from "../model/chatMessage";
import { DailyCheckIn, WorkoutPlan } from "../lib/schemas";

function uid() {
	return Math.random().toString(16).slice(2);
}

type PartialCheckIn = Partial<DailyCheckIn>;

type IntakeResponse = {
	coachReply: string;
	checkIn: PartialCheckIn;
	missing: RequiredCheckInKey[];
	done: boolean;
};

const REQUIRED_CHECK_IN_KEYS = ["sleepHours", "sleepQuality", "energy", "soreness", "stress"] as const;
type RequiredCheckInKey = (typeof REQUIRED_CHECK_IN_KEYS)[number];

function getGreetingByTime() {
	const hour = new Date().getHours();
	if (hour < 12) return "Good morning";
	if (hour < 18) return "Good afternoon";
	return "Good evening";
}

function buildInitialPrompt() {
	return `${getGreetingByTime()}! How are you feeling today? Give me a quick check-in in your own words. Share your energy, soreness, stress, sleep quality, and how your body feels so I can build a plan that fits you perfectly.`;
}

function hasRequiredCheckInValues(checkIn: PartialCheckIn): checkIn is PartialCheckIn & Record<RequiredCheckInKey, number> {
	return REQUIRED_CHECK_IN_KEYS.every((key) => typeof checkIn[key] === "number");
}

function formatApiError(data: unknown, fallback: string): string {
	if (!data || typeof data !== "object") return fallback;
	if ("error" in data) {
		const errValue = (data as { error: unknown }).error;
		if (typeof errValue === "string") return errValue;
		return JSON.stringify(errValue);
	}
	return fallback;
}

export default function TrainerChatBox() {
	const initialPrompt = useMemo(() => buildInitialPrompt(), []);
	const [messages, setMessages] = useState<ChatMessage[]>([
		{ id: uid(), role: "trainer", content: initialPrompt },
	]);
	const [checkIn, setCheckIn] = useState<PartialCheckIn>({});
	const [input, setInput] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [plan, setPlan] = useState<WorkoutPlan | null>(null);

	async function requestPlan(finalCheckIn: PartialCheckIn) {
		if (!hasRequiredCheckInValues(finalCheckIn)) {
			throw new Error("I still need a couple details before I can build your workout plan.");
		}

		const payload = {
			sleepHours: finalCheckIn.sleepHours,
			sleepQuality: finalCheckIn.sleepQuality,
			energy: finalCheckIn.energy,
			soreness: finalCheckIn.soreness,
			stress: finalCheckIn.stress,
			notes: (finalCheckIn.notes ?? "").toString().trim() || undefined,
			sorenessAreas: finalCheckIn.sorenessAreas,
		};

		const res = await fetch("/api/plan", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});

		const data: unknown = await res.json();
		if (!res.ok) {
			throw new Error(formatApiError(data, "Could not create workout plan."));
		}

		setPlan(data as WorkoutPlan);
		setMessages((m) => [
			...m,
			{
				id: uid(),
				role: "trainer",
				content: `Here’s your plan: ${(data as WorkoutPlan).modality} • ${(data as WorkoutPlan).durationMin} min • ${(data as WorkoutPlan).intensity}`,
			},
		]);
	}

	async function submit() {
		if (isLoading) return;

		const raw = input.trim();
		if (!raw) {
			setError("Please enter a message.");
			return;
		}

		setError(null);
		setInput("");

		const userMessage: ChatMessage = { id: uid(), role: "user", content: raw };
		const nextHistory = [...messages, userMessage];
		setMessages(nextHistory);
		setIsLoading(true);

		try {
			const intakeRes = await fetch("/api/intake", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					message: raw,
					checkIn,
					history: nextHistory,
				}),
			});

			const intakeData: unknown = await intakeRes.json();
			if (!intakeRes.ok) {
				throw new Error(formatApiError(intakeData, "Could not process your check-in."));
			}

			const intake = intakeData as IntakeResponse;
			const updatedCheckIn = intake.checkIn ?? checkIn;
			setCheckIn(updatedCheckIn);

			if (intake.coachReply) {
				setMessages((m) => [...m, { id: uid(), role: "trainer", content: intake.coachReply }]);
			}

			if (intake.done) {
				setMessages((m) => [
					...m,
					{ id: uid(), role: "trainer", content: "Perfect. I have what I need. Building your workout plan now..." },
				]);
				await requestPlan(updatedCheckIn);
			}
		} catch (e: unknown) {
			setError(e instanceof Error ? e.message : "Network error.");
		} finally {
			setIsLoading(false);
		}
	}

	function reset() {
		setPlan(null);
		setCheckIn({});
		setInput("");
		setError(null);
		setIsLoading(false);
		setMessages([{ id: uid(), role: "trainer", content: buildInitialPrompt() }]);
	}

	return (
		<>
			<Box className="!bg-white rounded-lg p-4">
				<Stack spacing={1} alignContent="center" className="!bg-white">
					{messages.map((msg) => (
						<Paper
							key={msg.id}
							elevation={0}
							className={msg.role === "user" ? "!bg-gray-1" : "!bg-orange-3"}
							sx={{
								alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
								maxWidth: "85%",
								px: 1.5,
								py: 1.25,
								borderRadius: 2,
								whiteSpace: "pre-wrap",
							}}
						>
							{msg.content}
						</Paper>
					))}
				</Stack>
				{!plan && (
					<Box className="mt-4">
						<Box
							component="form"
							onSubmit={(e) => {
								e.preventDefault();
								submit();
							}}
							sx={{ display: "flex", gap: 1 }}
						>
							<TextField
								value={input}
								onChange={(e) => setInput(e.target.value)}
								placeholder="Share how you're feeling today in your own words..."
								disabled={isLoading}
								size="small"
								fullWidth
							/>
							<Button type="submit" disabled={isLoading} variant="outlined">
								Send
							</Button>
						</Box>

						{error && (
							<Typography color="error" sx={{ mt: 1, whiteSpace: "pre-wrap" }}>
								{error}
							</Typography>
						)}
					</Box>
				)}
			</Box>

				{/* {!plan && (
					<Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1.5 }}>
						{missingRequired.map((key) => (
							<Chip key={key} size="small" label={`Need ${key}`} variant="outlined" />
						))}
					</Stack>
				)} */}

			{plan && (
				<Box sx={{ mt: 2, pt: 2 }}>
					<Divider className="mb-2" />
					<Typography variant="h6" className="mb-1">
						Workout Plan
					</Typography>

					<Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" className="mb-1">
						<Badge label={`Modality: ${plan.modality}`} />
						<Badge label={`Duration: ${plan.durationMin} min`} />
						<Badge label={`Intensity: ${plan.intensity}`} />
					</Stack>

					{plan.activities.map((act, idx) => (
						<Paper key={idx} variant="outlined" sx={{ mb: 1.25, p: 1.25, borderRadius: 2 }}>
							<Typography sx={{ fontWeight: 600 }}>{act.type}</Typography>
							<Typography>{act.description}</Typography>
							<Typography variant="caption" color="text.secondary">
								{act.durationMin} min • {act.intensity}
							</Typography>
						</Paper>
					))}

					<Typography sx={{ mt: 1.25 }}>
						<Box component="span" sx={{ fontWeight: 700 }}>
							Rationale:
						</Box>{" "}
						{plan.rationale}
					</Typography>

					<Section title="Stop if" items={plan.stopIf} />

					<Button onClick={reset} variant="outlined" sx={{ mt: 1.75 }}>
						New check-in
					</Button>
				</Box>
			)}
		</>
	);
}

function Badge({ label }: { label: string }) {
	return <Chip label={label} variant="outlined" size="small" sx={{ bgcolor: "grey.50" }} />;
}

function Section({ title, items }: { title: string; items: string[] }) {
	return (
		<Box sx={{ mt: 1.25 }}>
			<Typography sx={{ fontWeight: 700, mb: 0.5 }}>{title}</Typography>
			<List dense disablePadding sx={{ pl: 2 }}>
				{items.map((it, idx) => (
					<ListItem key={`${title}-${idx}`} sx={{ display: "list-item", py: 0 }}>
						{it}
					</ListItem>
				))}
			</List>
		</Box>
	);
}
