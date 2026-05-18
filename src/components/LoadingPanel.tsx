"use client";

import { useEffect, useState } from "react";

// Loading panel for the dev-mode "tuning in" state. Music-block generation on
// a cold slot can take 60-90s (5 web searches + 4000-token model output), so
// this panel has to feel alive for a full minute+ without looking stuck:
// cycling status messages, a moving "frequency" readout, an indeterminate
// sweep bar, and a long-wait hint that softens at the 25/45-second marks so
// the user knows it's expected, not broken.

const TUNING_MESSAGES = [
  "ACQUIRING SIGNAL",
  "LOCKING ONTO FREQUENCY",
  "DECODING TRANSMISSION",
  "AUTHENTICATING BROADCAST",
  "BUFFERING UPSTREAM",
  "CONTACTING NEXUS-9",
  "DOWNLINKING CONTENT",
  "COMPILING SCRIPT",
  "ENGAGING RECEIVERS",
  "RUNNING SYSTEMS CHECK",
  "REROUTING PIRATE FEED",
  "VERIFYING TRANSMITTER",
];

const MESSAGE_INTERVAL_MS = 1600;

export function LoadingPanel() {
  const [messageIndex, setMessageIndex] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    const messageId = window.setInterval(() => {
      setMessageIndex((i) => (i + 1) % TUNING_MESSAGES.length);
    }, MESSAGE_INTERVAL_MS);
    const tickId = window.setInterval(() => {
      setElapsedSec((s) => s + 1);
    }, 1000);
    return () => {
      window.clearInterval(messageId);
      window.clearInterval(tickId);
    };
  }, []);

  const message = TUNING_MESSAGES[messageIndex];
  // Decorative "frequency" readout that drifts so it feels alive.
  const freq = (87.4 + Math.sin(elapsedSec * 0.3) * 0.5).toFixed(2);

  // Asymptotic determinate progress: approaches 95% as elapsed grows. With
  // tau=30s the bar hits ~63% at 30s, ~86% at 60s, ~95% at 90s — matches the
  // typical music-block cold-cache cost curve. The panel unmounts when the
  // segment lands; the user reads that abrupt removal as "snap to 100%."
  const progressPct = Math.min(
    95,
    Math.round(95 * (1 - Math.exp(-elapsedSec / 30))),
  );

  // Reassuring text at the bottom — softens after 25s, then again after 45s
  // so a slow cold-cache fetch doesn't feel like it's hung.
  const longWaitHint =
    elapsedSec > 45
      ? "FIRST LOAD TAKES A MOMENT"
      : elapsedSec > 25
        ? "STILL WORKING..."
        : "SIGNAL // ESTABLISHING";

  return (
    <div className="max-w-md w-full">
      {/* Stencil header */}
      <div className="text-amber-500/70 text-[10px] tracking-[0.32em] uppercase mb-3">
        PRGE // TRANSMISSION
      </div>

      {/* Big title with pulsing amber indicator */}
      <div className="flex items-center gap-3 mb-6">
        <span className="prge-alien-amber-pulse inline-block w-3 h-3 bg-amber-400" />
        <span className="text-amber-100 text-3xl md:text-4xl font-bold tracking-[0.18em] uppercase">
          TUNING IN
        </span>
      </div>

      {/* Drifting frequency readout — pure decoration */}
      <div className="flex items-baseline gap-4 mb-3">
        <span className="text-amber-500/70 text-[11px] tracking-[0.22em] uppercase">
          FREQ
        </span>
        <span className="text-amber-200 text-2xl font-bold tabular-nums tracking-wider">
          {freq}
        </span>
        <span className="text-amber-500/70 text-[11px] tracking-[0.22em] uppercase">
          MHz
        </span>
      </div>

      {/* Cycling status message */}
      <div className="text-pink-400 text-[11px] tracking-[0.32em] uppercase mb-4 h-4">
        {message}
      </div>

      {/* Determinate progress bar — fills with elapsed time on an asymptotic
          curve so the user sees actual motion instead of an endless sweep. */}
      <div className="h-2 w-full bg-amber-900/40 overflow-hidden">
        <div
          className="h-full bg-amber-400 shadow-[0_0_8px_rgba(255,170,0,0.6)] transition-[width] duration-1000 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Elapsed counter + soft long-wait hint + live % readout */}
      <div className="flex justify-between mt-3 text-amber-500/70 text-[10px] tracking-[0.22em] uppercase">
        <span>{longWaitHint}</span>
        <span className="tabular-nums">
          {progressPct.toString().padStart(2, "0")}% · {String(elapsedSec).padStart(3, "0")}s
        </span>
      </div>
    </div>
  );
}
