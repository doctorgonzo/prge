"use client";

import { useEffect, useRef, useState } from "react";
import type { CallerPopup as CallerPopupData } from "@/lib/caller-popups";
import { useTTS } from "@/hooks/useTTS";

// AIM-style text-in popup. Appears over the broadcast view in the bottom-right
// corner like a buddy-list message window — someone out there in Madison texted
// the station and their words are bleeding through to the viewer.
//
// Auto-dismisses after 8–12s (longer messages get more time), then calls
// onComplete so the parent can schedule the next one or clean up.

interface CallerPopupProps {
  caller: CallerPopupData;
  onComplete: () => void;
}

/** Border color by tone — subtle shift so repeat viewers start pattern-matching. */
const TONE_BORDER: Record<CallerPopupData["tone"], string> = {
  scared: "border-amber-500",
  angry: "border-red-500",
  "dark-humor": "border-green-400",
  wholesome: "border-green-300",
  cryptic: "border-purple-400",
};

/** Indicator dot color by tone. */
const TONE_DOT: Record<CallerPopupData["tone"], string> = {
  scared: "bg-amber-400",
  angry: "bg-red-400",
  "dark-humor": "bg-green-400",
  wholesome: "bg-green-300",
  cryptic: "bg-purple-400",
};

/**
 * Compute display duration based on message length.
 * Short messages (~60 chars): 8s. Long messages (~200+ chars): 12s.
 */
function displayDurationMs(message: string): number {
  const base = 8_000;
  const extra = Math.min(4_000, Math.floor(message.length / 50) * 1_000);
  return base + extra;
}

export function CallerPopup({ caller, onComplete }: CallerPopupProps) {
  // Phase: "enter" → scale-up + border pulse, "visible" → steady, "exit" → fade out.
  const [phase, setPhase] = useState<"enter" | "visible" | "exit">("enter");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { speak: speakTTS, stop: stopTTS } = useTTS(true);

  const duration = displayDurationMs(caller.message);

  // TTS: caller reads their message when the popup appears.
  useEffect(() => {
    speakTTS(caller.message, "caller");
    return () => { stopTTS(); };
  }, [caller.message]); // eslint-disable-line react-hooks/exhaustive-deps

  // Entry animation: flash the border brighter for 300ms, then settle.
  useEffect(() => {
    const t1 = setTimeout(() => setPhase("visible"), 300);
    return () => clearTimeout(t1);
  }, []);

  // Auto-dismiss: wait `duration`, then exit, then call onComplete after fade.
  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setPhase("exit");
      // Let the exit animation play (400ms) before unmounting.
      setTimeout(() => onComplete(), 400);
    }, duration);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [duration, onComplete]);

  const borderClass = TONE_BORDER[caller.tone];
  const dotClass = TONE_DOT[caller.tone];

  return (
    <div
      className={[
        // Position: bottom-right, above the newsticker (bottom-20 gives clearance).
        "fixed bottom-20 right-4 z-[60]",
        // Size.
        "w-[300px] max-w-[calc(100vw-2rem)]",
        // Window chrome.
        "bg-black/90 backdrop-blur-sm border-2 rounded-sm shadow-lg shadow-black/50",
        borderClass,
        // Font.
        "font-mono text-xs",
        // Transitions.
        "transition-all duration-300 ease-out",
        phase === "enter"
          ? "scale-95 opacity-0"
          : phase === "exit"
            ? "scale-95 opacity-0 translate-y-2"
            : "scale-100 opacity-100",
      ].join(" ")}
      style={{
        // Extra ring flash on entry — the "bloop."
        boxShadow:
          phase === "enter"
            ? "0 0 12px 2px rgba(251, 191, 36, 0.4), 0 4px 24px rgba(0,0,0,0.5)"
            : "0 4px 24px rgba(0,0,0,0.5)",
        transitionDuration: phase === "exit" ? "400ms" : "300ms",
      }}
    >
      {/* ── Title bar ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-green-900/60 bg-black/60">
        {/* Blinking indicator dot */}
        <span
          className={[dotClass, "w-2 h-2 rounded-full animate-pulse"].join(" ")}
        />
        <span className="text-green-500 tracking-widest text-[10px] uppercase">
          Incoming Text-In
        </span>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────── */}
      <div className="px-3 py-2.5 leading-relaxed">
        {/* Caller attribution */}
        <div className="text-amber-400 font-bold mb-1">
          {caller.name} from {caller.neighborhood}:
        </div>
        {/* Message */}
        <div className="text-green-100">{caller.message}</div>
      </div>
    </div>
  );
}
