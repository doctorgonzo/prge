"use client";

import { useState, useEffect, useCallback } from "react";

interface DawnCountdownProps {
  /** Current in-world time as "HH:MM" (24-hour format) */
  inWorldTime: string;
}

const PURGE_END_HOUR = 7; // 07:00 — sunrise, Purge ends
const DAWN_WINDOW_START = 4; // 04:00 — countdown becomes visible

function parseInWorldTime(timeStr: string): { hours: number; minutes: number } {
  const [h, m] = timeStr.split(":").map(Number);
  return { hours: h, minutes: m };
}

function isInDawnWindow(hours: number, minutes: number): boolean {
  const totalMinutes = hours * 60 + minutes;
  const startMinutes = DAWN_WINDOW_START * 60; // 04:00 = 240
  const endMinutes = PURGE_END_HOUR * 60; // 07:00 = 420
  return totalMinutes >= startMinutes && totalMinutes < endMinutes;
}

function getSecondsUntilSunrise(hours: number, minutes: number): number {
  const nowSeconds = hours * 3600 + minutes * 60;
  const sunriseSeconds = PURGE_END_HOUR * 3600;
  return Math.max(0, sunriseSeconds - nowSeconds);
}

function formatCountdown(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

type ColorTier =
  | "standard"
  | "two-hours"
  | "one-hour"
  | "thirty-min"
  | "ten-min"
  | "final";

function getColorTier(totalSeconds: number): ColorTier {
  if (totalSeconds <= 300) return "final"; // under 5 min
  if (totalSeconds <= 600) return "ten-min"; // under 10 min
  if (totalSeconds <= 1800) return "thirty-min"; // under 30 min
  if (totalSeconds <= 3600) return "one-hour"; // under 1 hour
  if (totalSeconds <= 7200) return "two-hours"; // under 2 hours
  return "standard"; // 2-3 hours out
}

const tierStyles: Record<ColorTier, string> = {
  standard: "text-amber-400",
  "two-hours": "text-amber-300",
  "one-hour": "text-amber-200",
  "thirty-min": "text-yellow-300",
  "ten-min": "text-yellow-200 drop-shadow-[0_0_6px_rgba(253,224,71,0.4)]",
  final:
    "text-yellow-100 drop-shadow-[0_0_12px_rgba(253,224,71,0.7)] animate-pulse",
};

function getSunIcon(totalSeconds: number): string {
  if (totalSeconds <= 1800) return "\u2600"; // full sun — last 30 min
  return "\u25D0"; // half circle — still rising
}

export function DawnCountdown({ inWorldTime }: DawnCountdownProps) {
  const { hours, minutes } = parseInWorldTime(inWorldTime);

  const [secondsLeft, setSecondsLeft] = useState<number>(() =>
    getSecondsUntilSunrise(hours, minutes)
  );

  // Sync whenever the parent passes a new inWorldTime
  useEffect(() => {
    const { hours: h, minutes: m } = parseInWorldTime(inWorldTime);
    setSecondsLeft(getSecondsUntilSunrise(h, m));
  }, [inWorldTime]);

  // Tick down once per second
  useEffect(() => {
    if (secondsLeft <= 0) return;

    const id = setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(id);
  }, [secondsLeft > 0]); // restart only on zero-boundary transitions

  const visible = isInDawnWindow(hours, minutes);
  if (!visible) return null;

  const tier = getColorTier(secondsLeft);
  const icon = getSunIcon(secondsLeft);

  return (
    <div
      className={`
        fixed top-12 left-1/2 -translate-x-1/2 z-50
        pointer-events-none select-none
        font-mono tracking-[0.2em] text-xs uppercase
        ${tierStyles[tier]}
        transition-colors duration-1000
      `}
      role="timer"
      aria-label={`Sunrise in ${formatCountdown(secondsLeft)}`}
    >
      <span className="mr-2 text-sm">{icon}</span>
      <span>SUNRISE IN {formatCountdown(secondsLeft)}</span>
    </div>
  );
}
