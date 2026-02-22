"use client";

export default function TypingIndicator() {
  return (
    <div
      aria-label="Trainer is typing"
      className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white/60 px-2.5 py-1.5 backdrop-blur-[6px]"
    >
      <Dot delay="0ms" />
      <Dot delay="150ms" />
      <Dot delay="300ms" />
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="h-1.5 w-1.5 animate-typing-dot rounded-full bg-foreground opacity-[0.35]"
      style={{ animationDelay: delay }}
    />
  );
}
