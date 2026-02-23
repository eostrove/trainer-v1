
"use client";

import { Box, Stack, Typography } from "@mui/material";
import TrainerChat from "./components/TrainerChat";

export default function App() {
  return (
	<main className="flex h-screen overflow-hidden items-start justify-center px-2 py-3 md:px-4 md:py-6">
		<Box className="m-1 h-[calc(100vh-1.5rem)] w-full max-w-[780px] overflow-y-auto rounded-3xl border border-[var(--surface-border)] bg-[var(--surface)] p-4 shadow-xl md:m-0 md:h-[calc(100vh-3rem)] md:p-8">
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
			<TrainerChat />
		</Box>
	</main>
  );
}
