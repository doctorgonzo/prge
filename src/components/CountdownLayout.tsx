"use client";

import { useEffect, useMemo, useState } from "react";
import { HOST_LABEL, type PlayerLine } from "./player-types";

interface Props {
  /** Current PSA line to display underneath the clock */
  current?: PlayerLine;
  /** Line cycle index — drives fade animation key */
  lineIndex: number;
  /** Current Madison wall-clock time "HH:MM" */
  madisonTime: string;
}

// ── Countdown clock computation ─────────────────────────────────────────
// Computes real-time seconds until 19:00 Madison time. Updates every second
// for a smooth countdown display. The parent passes madisonTime (updated
// every 30s by the HUD clock), but we tick our own internal second counter
// so the display doesn't stutter between parent updates.

function computeSecondsUntilPurge(madisonHHMM: string): number {
  const [hStr, mStr] = madisonHHMM.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  // 19:00 = target. If we're at 18:30, that's 30 minutes = 1800 seconds.
  const targetSec = 19 * 3600;
  const currentSec = h * 3600 + m * 60;
  return Math.max(0, targetSec - currentSec);
}

function formatCountdownParts(totalSeconds: number): {
  hours: string;
  minutes: string;
  seconds: string;
} {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return {
    hours: String(h).padStart(2, "0"),
    minutes: String(m).padStart(2, "0"),
    seconds: String(s).padStart(2, "0"),
  };
}

/**
 * CountdownLayout — the pre-Purge countdown display.
 *
 * Renders:
 *   1. A large ticking countdown clock to 19:00 (Purge commencement)
 *   2. Urgent survival PSA text cycling underneath
 *   3. Emergency broadcast framing
 *
 * The countdown ticks every second using a local interval synced to the
 * parent's Madison time on each update. This gives smooth per-second
 * updates without requiring the parent to poll that fast.
 */
export function CountdownLayout({ current, lineIndex, madisonTime }: Props) {
  // Baseline seconds-until-Purge from the parent's Madison time. Recomputed
  // whenever madisonTime updates (every 30s from the HUD clock).
  const baselineSeconds = useMemo(
    () => computeSecondsUntilPurge(madisonTime),
    [madisonTime],
  );

  // Local tick counter — counts down from baseline, resyncs on parent update.
  const [secondsLeft, setSecondsLeft] = useState(baselineSeconds);

  // Resync when baseline changes (parent clock update).
  useEffect(() => {
    setSecondsLeft(baselineSeconds);
  }, [baselineSeconds]);

  // Tick every second.
  useEffect(() => {
    const id = setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const { hours, minutes, seconds } = formatCountdownParts(secondsLeft);
  const isUrgent = secondsLeft < 600; // under 10 minutes
  const isCritical = secondsLeft < 120; // under 2 minutes

  return (
    <div className="max-w-3xl mx-auto w-full text-center space-y-8">
      {/* Emergency header */}
      <div className="space-y-2">
        <div
          className={
            "text-xs tracking-[0.4em] uppercase font-bold " +
            (isCritical
              ? "text-red-400 animate-pulse"
              : isUrgent
                ? "text-red-400"
                : "text-amber-400")
          }
        >
          EMERGENCY PREPAREDNESS BROADCAST
        </div>
        <div className="text-[10px] tracking-[0.3em] text-green-400/60 uppercase">
          PRGE 420.69 FM &middot; MADISON, WI &middot; ALL CHANNELS
        </div>
      </div>

      {/* Countdown clock */}
      <div className="relative">
        {/* Outer frame */}
        <div
          className={
            "border-2 rounded-sm p-6 md:p-8 " +
            (isCritical
              ? "border-red-500/80 bg-red-950/20"
              : isUrgent
                ? "border-red-500/50 bg-red-950/10"
                : "border-amber-500/40 bg-amber-950/10")
          }
        >
          <div
            className={
              "text-[10px] tracking-[0.3em] uppercase mb-4 " +
              (isCritical ? "text-red-400" : "text-amber-400/80")
            }
          >
            TIME TO PURGE COMMENCEMENT
          </div>

          {/* The big clock digits */}
          <div className="flex items-center justify-center gap-2 md:gap-4">
            <ClockDigitGroup value={hours} label="HRS" urgent={isUrgent} critical={isCritical} />
            <ClockSeparator critical={isCritical} />
            <ClockDigitGroup value={minutes} label="MIN" urgent={isUrgent} critical={isCritical} />
            <ClockSeparator critical={isCritical} />
            <ClockDigitGroup value={seconds} label="SEC" urgent={isUrgent} critical={isCritical} />
          </div>

          {/* Status line */}
          <div
            className={
              "mt-4 text-[10px] tracking-[0.2em] uppercase " +
              (isCritical
                ? "text-red-300 animate-pulse"
                : isUrgent
                  ? "text-red-300/80"
                  : "text-amber-300/60")
            }
          >
            {isCritical
              ? "IMMINENT — SEEK SHELTER NOW"
              : isUrgent
                ? "FINAL MINUTES — COMPLETE ALL PREPARATIONS"
                : "PREPARE NOW — REVIEW ALL SURVIVAL PROTOCOLS"}
          </div>
        </div>
      </div>

      {/* Warning banner */}
      <div
        className={
          "py-2 px-4 text-[10px] tracking-[0.25em] uppercase font-bold " +
          (isCritical
            ? "bg-red-900/40 text-red-200 border border-red-500/50 animate-pulse"
            : "bg-amber-900/20 text-amber-300 border border-amber-500/30")
        }
      >
        {isCritical
          ? "ALL EMERGENCY SERVICES WILL SUSPEND IN LESS THAN 2 MINUTES"
          : isUrgent
            ? "EMERGENCY SERVICES SUSPEND AT 19:00 — NO 911 FOR 12 HOURS"
            : "ALL CRIME INCLUDING MURDER LEGAL FOR 12 HOURS STARTING AT 19:00"}
      </div>

      {/* PSA text line */}
      {current && (
        <div key={lineIndex} className="prge-line">
          <div
            className={
              "text-xs uppercase tracking-[0.2em] mb-3 font-bold " +
              (current.host === "tim" ? "text-red-400" : "text-amber-400")
            }
          >
            {HOST_LABEL[current.host] ?? current.host.toUpperCase()}
            <span className="text-green-500/40 ml-2">// SURVIVAL PSA</span>
          </div>
          <div className="text-green-100 text-base md:text-lg leading-relaxed italic">
            &ldquo;{current.text}&rdquo;
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

function ClockDigitGroup({
  value,
  label,
  urgent,
  critical,
}: {
  value: string;
  label: string;
  urgent: boolean;
  critical: boolean;
}) {
  return (
    <div className="flex flex-col items-center">
      <div
        className={
          "font-mono font-bold tabular-nums leading-none " +
          "text-5xl md:text-7xl lg:text-8xl " +
          (critical
            ? "text-red-400 prge-countdown-pulse"
            : urgent
              ? "text-red-300"
              : "text-amber-200")
        }
        style={{
          textShadow: critical
            ? "0 0 20px rgba(239, 68, 68, 0.6), 0 0 40px rgba(239, 68, 68, 0.3)"
            : urgent
              ? "0 0 15px rgba(239, 68, 68, 0.4)"
              : "0 0 10px rgba(251, 191, 36, 0.3)",
        }}
      >
        {value}
      </div>
      <div
        className={
          "text-[9px] tracking-[0.3em] mt-2 uppercase " +
          (critical ? "text-red-400/60" : "text-amber-400/50")
        }
      >
        {label}
      </div>
    </div>
  );
}

function ClockSeparator({ critical }: { critical: boolean }) {
  return (
    <div
      className={
        "font-mono font-bold text-4xl md:text-6xl lg:text-7xl leading-none -mt-4 " +
        (critical ? "text-red-500 animate-pulse" : "text-amber-400/60")
      }
    >
      :
    </div>
  );
}
