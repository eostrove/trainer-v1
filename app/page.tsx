
"use client";

import { Typography } from "@mui/material";
import TrainerChatBox from "./components/trainerChatBox";

export default function App() {
  return (
	<main style={{ padding: 24, fontFamily: "system-ui" }}>
		<Typography variant="h1">Trainer V1</Typography>
  		<TrainerChatBox />
  	</main>
  );
}