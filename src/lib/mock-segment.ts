// src/lib/mock-segment.ts
// Placeholder content used by the player until the live generator is wired in.
// Same schema the news writer prompt produces.

// Player-side fallback that the client shows ONLY when /api/segment fails
// mid-poll AND no live segment has landed yet. Kept deliberately time-neutral
// — no "clock just hit X" claims, no specific in-world timestamp, no hour-
// number — so if it ever leaks past a brief failure window the player isn't
// caught lying about what time it is. Tim (the calmest voice + the only host
// who reliably survives every year) owns the temporary-signal-loss patter.
export const mockSegment = {
  type: "news" as const,
  inWorldTime: "—:—",
  segmentTitle: "SIGNAL DROP",
  lines: [
    {
      host: "tim",
      text:
        "Tim Peplinski here. Brief signal drop on our end — give us a moment to bring the feed back up.",
    },
    {
      host: "tim",
      text:
        "If you're hearing this, you're tuned to PRGE. The rig coughed. Happens. Stay where you are. The broadcast resumes the second this clears.",
    },
    {
      host: "tim",
      text:
        "Doors locked. Lights low. Whatever you were doing five minutes ago — keep doing it. We'll be right back.",
    },
  ],
  tickerItems: [
    {
      category: "emergency",
      text: "SIGNAL DROP — temporary feed loss, restoration pending",
    },
    {
      category: "local-news",
      text: "Stand by — Pep is on it",
    },
  ],
} as const;
