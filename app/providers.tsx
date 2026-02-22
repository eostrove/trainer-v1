"use client";

import { CssBaseline } from "@mui/material";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { PropsWithChildren } from "react";

const theme = createTheme({
  typography: {
    fontFamily: 'var(--font-geist-sans), "Avenir Next", "Segoe UI", sans-serif',
  },
});

export default function AppProviders({ children }: PropsWithChildren) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
