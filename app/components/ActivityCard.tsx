import { Paper, Typography } from "@mui/material";
import { Activity, WorkoutPlan } from "../lib/schemas";

function intensityPillClass(intensity: WorkoutPlan["intensity"]) {
	if (intensity === "hard") return "bg-[var(--accent)]/20 text-[var(--cocoa-1)] border-[var(--accent)]/40";
	if (intensity === "moderate") return "bg-[var(--orange-1)] text-[var(--cocoa-1)] border-[var(--surface-border)]";
	return "bg-[var(--sage-1)] text-[var(--foreground)] border-[var(--moss-1)]";
}

const ActivityCard = ({ activity }: { activity: Activity }) => {
	return (
		<Paper
			variant="outlined"
			className="!rounded-3xl border-surface-border bg-surface p-3.5 shadow-sm"
		>
			<div className="mb-1.5 flex items-start justify-between gap-3">
				<Typography className="!text-sm !font-bold !capitalize !text-[var(--foreground)]">{activity.type}</Typography>
				<span
					className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${intensityPillClass(activity.intensity)}`}
				>
					{activity.intensity}
				</span>
			</div>
			<Typography className="!text-sm !leading-6 !text-[rgba(60,51,45,0.9)]">{activity.description}</Typography>
			<Typography className="!mt-1.5 !text-xs !font-medium !text-[rgba(60,51,45,0.7)]">
				{activity.durationMin} min
			</Typography>
		</Paper>)

	}; 

	export default ActivityCard;