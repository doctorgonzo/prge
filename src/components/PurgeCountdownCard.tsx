"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface PurgeCountdownCardProps {
  /** Current in-world Madison time as "HH:MM" (24-hour format) */
  inWorldTime: string;
}

const PURGE_START_HOUR = 19; // 19:00 — Purge begins

/**
 * Compute seconds from the given HH:MM until 19:00.
 * Only meaningful during daytime hours (07:00-17:59).
 */
function secondsUntilPurge(hhMM: string): number {
  const [hStr, mStr] = hhMM.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const nowSec = h * 3600 + m * 60;
  const targetSec = PURGE_START_HOUR * 3600;
  return Math.max(0, targetSec - nowSec);
}

/**
 * Is this HH:MM in the daytime countdown window (07:00-17:59)?
 * The 18:xx hour has its own countdown (CountdownLayout) — we stay out of it.
 */
function isInDaytimeWindow(hhMM: string): boolean {
  const h = parseInt(hhMM.split(":")[0], 10);
  return h >= 7 && h < 18;
}

/**
 * PurgeCountdownCard — daytime "off air" countdown to Purge Night.
 *
 * Renders a shareable card with:
 *   - "PURGE NIGHT BEGINS IN Xh Ym Zs" ticking in real time
 *   - PRGE aesthetic: amber/green monospace, subtle pulse on digits
 *   - Station tagline
 *   - Small "COPY LINK" button for sharing
 *
 * Visible 07:00-17:59 Madison time. The 18:00 hour is already handled
 * by the emergency-preparedness CountdownLayout — no overlap.
 */
export function PurgeCountdownCard({ inWorldTime }: PurgeCountdownCardProps) {
  // ── Visibility gate ──────────────────────────────────────────────
  const visible = isInDaytimeWindow(inWorldTime);

  // ── Countdown state ──────────────────────────────────────────────
  const baseline = useMemo(
    () => secondsUntilPurge(inWorldTime),
    [inWorldTime],
  );

  const [secondsLeft, setSecondsLeft] = useState(baseline);

  // Resync whenever the parent pushes a new Madison time string.
  useEffect(() => {
    setSecondsLeft(secondsUntilPurge(inWorldTime));
  }, [inWorldTime]);

  // Tick down every second for smooth display between parent updates.
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [secondsLeft > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Copy link ────────────────────────────────────────────────────
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers / insecure contexts.
      const ta = document.createElement("textarea");
      ta.value = window.location.href;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, []);

  // ── Don't render outside the daytime window ──────────────────────
  if (!visible) return null;

  // ── Format the countdown ─────────────────────────────────────────
  const hours = Math.floor(secondsLeft / 3600);
  const minutes = Math.floor((secondsLeft % 3600) / 60);
  const seconds = secondsLeft % 60;

  const pad = (n: number) => String(n).padStart(2, "0");

  // Intensity ramp: gets more urgent as evening approaches.
  const isAfternoon = secondsLeft < 4 * 3600; // under 4 hours
  const isLate = secondsLeft < 2 * 3600; // under 2 hours

  return (
    <div className="flex flex-col items-center gap-6 select-none">
      {/* OFF AIR header */}
      <div className="text-center space-y-1">
        <div
          className={
            "text-xs tracking-[0.4em] uppercase font-bold " +
            (isLate
              ? "text-amber-300"
              : isAfternoon
                ? "text-amber-400/80"
                : "text-green-500/60")
          }
        >
          OFF AIR
        </div>
      </div>

      {/* Main countdown */}
      <div
        className={
          "border rounded-sm px-6 py-5 md:px-10 md:py-8 text-center " +
          (isLate
            ? "border-amber-500/50 bg-amber-950/15"
            : "border-green-700/40 bg-green-950/10")
        }
      >
        <div
          className={
            "text-[10px] tracking-[0.3em] uppercase mb-4 " +
            (isLate ? "text-amber-400/90" : "text-green-500/60")
          }
        >
          PURGE NIGHT BEGINS IN
        </div>

        {/* The big digits */}
        <div className="flex items-baseline justify-center gap-1 md:gap-2 font-mono font-bold tabular-nums">
          <DigitBlock value={pad(hours)} label="h" late={isLate} afternoon={isAfternoon} />
          <Separator late={isLate} afternoon={isAfternoon} />
          <DigitBlock value={pad(minutes)} label="m" late={isLate} afternoon={isAfternoon} />
          <Separator late={isLate} afternoon={isAfternoon} />
          <DigitBlock value={pad(seconds)} label="s" late={isLate} afternoon={isAfternoon} />
        </div>
      </div>

      {/* Tagline */}
      <div
        className={
          "text-[10px] tracking-[0.3em] uppercase " +
          (isLate ? "text-amber-500/50" : "text-green-600/40")
        }
      >
        MADISON, WI &middot; FREQ 420.69 MHz
      </div>

      {/* Copy link button — small and subtle */}
      <button
        type="button"
        onClick={handleCopy}
        className={
          "text-[9px] tracking-[0.25em] uppercase px-3 py-1.5 border rounded-sm transition-all duration-300 cursor-pointer " +
          (copied
            ? "border-green-500/60 text-green-400 bg-green-950/20"
            : "border-green-800/30 text-green-600/50 hover:text-green-400 hover:border-green-600/40 bg-transparent")
        }
      >
        {copied ? "COPIED" : "COPY LINK"}
      </button>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

function DigitBlock({
  value,
  label,
  late,
  afternoon,
}: {
  value: string;
  label: string;
  late: boolean;
  afternoon: boolean;
}) {
  return (
    <span className="inline-flex items-baseline">
      <span
        className={
          "text-4xl md:text-6xl lg:text-7xl leading-none " +
          (late
            ? "text-amber-200 prge-purge-countdown-pulse"
            : afternoon
              ? "text-amber-300/90"
              : "text-green-300/80")
        }
        style={{
          textShadow: late
            ? "0 0 14px rgba(251, 191, 36, 0.5), 0 0 30px rgba(251, 191, 36, 0.2)"
            : afternoon
              ? "0 0 8px rgba(251, 191, 36, 0.25)"
              : "0 0 6px rgba(74, 222, 128, 0.15)",
        }}
      >
        {value}
      </span>
      <span
        className={
          "text-xs md:text-sm ml-0.5 " +
          (late ? "text-amber-500/60" : "text-green-600/40")
        }
      >
        {label}
      </span>
    </span>
  );
}

function Separator({
  late,
  afternoon,
}: {
  late: boolean;
  afternoon: boolean;
}) {
  return (
    <span
      className={
        "text-2xl md:text-4xl leading-none mx-0.5 " +
        (late
          ? "text-amber-400/50"
          : afternoon
            ? "text-amber-500/30"
            : "text-green-700/30")
      }
    >
      :
    </span>
  );
}
