import {
	Accordion,
	AccordionDetails,
	AccordionSummary,
	Box,
	Button,
	Paper,
	Stack,
	TextField,
	Typography
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { DailyCheckIn, WorkoutPlan } from "../lib/schemas";
import { ChatMessage } from "../model/chatMessage";
import TypingAnimation from "./TypingAnimation";
import PlanDetails from "./PlanDetail";
import { CaretDownIcon, CheckCircleIcon } from "@phosphor-icons/react";

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
	return `${getGreetingByTime()}! How are you feeling today? Rate your energy, soreness, stress, sleep quality, and how your body feels on a scale of 1-10 so I can build a plan that fits you perfectly.`;
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

const TrainerChat = () => {
	const initialPrompt = useMemo(() => buildInitialPrompt(), []);
	const [messages, setMessages] = useState<ChatMessage[]>([
		{ id: uid(), role: "trainer", content: initialPrompt },
	]);
	const [checkIn, setCheckIn] = useState<PartialCheckIn>({});
	const [input, setInput] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [plan, setPlan] = useState<WorkoutPlan | null>(null);
	const [chatExpanded, setChatExpanded] = useState(true);

	useEffect(() => {
		if (plan) setChatExpanded(false);
	}, [plan]);

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
		setChatExpanded(true);
		setCheckIn({});
		setInput("");
		setError(null);
		setIsLoading(false);
		setMessages([{ id: uid(), role: "trainer", content: buildInitialPrompt() }]);
	}

	return (
		<>
			<Accordion
				expanded={chatExpanded}
				onChange={(_, expanded) => setChatExpanded(expanded)}
				disableGutters
				elevation={0}
				className="!mb-3 !rounded-3xl !border !border-[var(--surface-border)] !bg-white !shadow-lg"
				sx={{ "&::before": { display: "none" } }}
			>
				{plan && (
					<AccordionSummary expandIcon={<CaretDownIcon />}>
						<Stack direction="row" spacing={1} alignItems="center">
							<Typography className="!text-sm !font-semibold !text-[var(--foreground)]">
								Today&apos;s check in 
							</Typography>
							<CheckCircleIcon weight="bold" className="!text-green-500 !ml-1" size={20} />
						</Stack>
					</AccordionSummary>
				)}
				<AccordionDetails className="!bg-white border-none rounded-3xl p-2">
					<Stack spacing={1} alignContent="center" className="!bg-white">
						{messages.map((msg) => (
							<Paper
								key={msg.id}
								elevation={0}
								className={`rounded-3xl !border-none ${msg.role === "user" ? "!bg-gray-1 self-end" : "!bg-orange-3 self-start"} max-w-[85%] px-3 py-2.5 rounded-lg whitespace-pre-wrap`}
							>
								{msg.content}
							</Paper>
						))}
					</Stack>
					{isLoading && (<TypingAnimation />)}
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
				</AccordionDetails>
			</Accordion>

			{plan && (<PlanDetails plan={plan} reset={reset} />)}
		</>
	);
}

export default TrainerChat;
