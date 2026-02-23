import { Box, Button, Stack, Typography } from "@mui/material";
import { WorkoutPlan } from "../lib/schemas";
import ActivityCard from "./ActivityCard";

function Badge({ label }: { label: string }) {
	return (
		<span className="inline-flex items-center rounded-full border border-[var(--surface-border)] bg-[var(--white)] px-3 py-1 text-xs font-semibold text-[var(--foreground)] shadow-[0_4px_14px_rgba(80,52,32,0.06)]">
			{label}
		</span>
	);
}

function Section({ title, items }: { title: string; items: string[] }) {
	return (
		<Stack className="m-4">
			<Typography className="!mb-1 !text-sm !font-bold">{title}</Typography>
			<ul className="list-disc space-y-1 pl-5 text-sm text-[rgba(60,51,45,0.9)]">
				{items.map((it, idx) => (
					<li key={`${title}-${idx}`}>{it}</li>
				))}
			</ul>
		</Stack>
	);
}

const headerStyles = "mb-3 rounded-2xl border border-[var(--surface-border)] bg-gradient-to-r from-[var(--orange-1)] via-[var(--accent-soft)] to-[var(--pink-1)] px-4 py-3"

const PlanDetails = ({ plan, reset }: { plan: WorkoutPlan; reset: () => void }) => {
	return (
		<Box className="mt-4 rounded-3xl border border-surface-border bg-white p-4 shadow-lg md:p-5">
			<div className={headerStyles}>
				<Typography className="!text-xl !font-bold">Workout Plan</Typography>
				<Typography variant="body2">
					Built for how you feel right now.
				</Typography>
			</div>

			<Stack direction="row" alignItems="center" spacing={2} className="mb-3">
				<Badge label={`Modality: ${plan.modality}`} />
				<Badge label={`Duration: ${plan.durationMin} min`} />
				<Badge label={`Intensity: ${plan.intensity}`} />
			</Stack>

			<div className="space-y-2.5">
				{plan.activities.map((act, idx) => (
					<ActivityCard key={idx} activity={act} />
				))}
			</div>

			<Stack direction="column" className="m-4" spacing={0}>
				<Typography className="!mb-1 !text-sm !font-bold !text-[var(--foreground)]">Rationale</Typography>
				<Typography className="!text-sm !leading-6 !text-[rgba(60,51,45,0.9)]">{plan.rationale}</Typography>
			</Stack>

			<Section title="Stop if" items={plan.stopIf} />

			<Button
				onClick={reset}
				variant="contained"
				className="!mt-4 !rounded-3xl !bg-[var(--accent)] !px-4 !py-2 !font-semibold !text-white hover:!bg-[var(--cocoa-1)]"
			>
				New check-in
			</Button>
		</Box>
	);
};

export default PlanDetails;
