
"use client";

import { Box, Stack, Typography } from "@mui/material";
import TrainerChatBox from "./components/trainerChatBox";

export default function App() {
  return (
	<main className="flex min-h-screen items-start justify-center px-2 py-3 md:px-4 md:py-6">
		<Box className="w-full max-w-[780px] rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-4 m-6 shadow-md md:p-8">
			<Stack spacing={1} alignItems="center" className="pb-4">
				<Typography
					variant="h2"
					className="!font-bold"
				>
					Tempo Trainer
				</Typography>
				<Typography variant="h6" color="text.secondary" align="center">
					Train at the right pace for <i><b>you</b></i>, every day.
				</Typography>
			</Stack>
			<TrainerChatBox />
		</Box>
	</main>
  );
}
