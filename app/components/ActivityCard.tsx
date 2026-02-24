import { Paper, Stack, Typography } from "@mui/material";
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
			<Stack direction="row" alignItems="center" justifyContent="space-between" className="mb-1.5">
				<Stack direction="row" alignItems="center" spacing={1}>
					<Typography className="!text-sm !font-bold !capitalize !text-[var(--foreground)]">{activity.type}</Typography>
					<Typography className="!text-xs !font-medium">
						{activity.durationMin} min
					</Typography>
				</Stack>
			
				
				<span
					className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${intensityPillClass(activity.intensity)}`}
				>
					{activity.intensity}
				</span>

			</Stack>
			<Typography className="!text-sm !leading-6 !text-[rgba(60,51,45,0.9)]">{activity.description}</Typography>
			
		</Paper>)

	}; 

	export default ActivityCard;