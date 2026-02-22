
"use client";

import { Box, Stack, Typography } from "@mui/material";
import TrainerChatBox from "./components/trainerChatBox";

export default function App() {
  return (
	<main className="flex min-h-screen items-start justify-center px-2 py-3 md:px-4 md:py-6">
		<Box className="w-full max-w-[780px] rounded-[32px] border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[0_12px_40px_rgba(118,76,42,0.08)] backdrop-blur-[6px] md:p-8">
			<Stack spacing={1} alignItems="center" className="pb-4">
				<Typography
					variant="h2"
					className="!font-bold"
				>
					Tempo Trainer
				</Typography>
				<Typography variant="subtitle1" color="text.secondary" align="center">
					Your friendly coach for a workout that fits your body and your day.
				</Typography>
			</Stack>
			<TrainerChatBox />
		</Box>
	</main>
  );
}
