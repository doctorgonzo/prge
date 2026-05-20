"use client";

import { useEffect, useRef, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────
interface ViewerCountProps {
  inWorldTime: string; // "HH:MM" format
}

interface ViewerData {
  realCount: number;
  fakeCount: number;
}

// ── Heartbeat config ──────────────────────────────────────────────────
const HEARTBEAT_INTERVAL_MS = 45_000; // 45 seconds

// ── Animated number display ───────────────────────────────────────────
// Brief flash when the number changes, then settles.
function AnimatedCount({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const [flash, setFlash] = useState(false);
  const prevRef = useRef(value);

  useEffect(() => {
    if (value === prevRef.current) return;

    setFlash(true);
    const start = prevRef.current;
    const diff = value - start;
    const steps = Math.min(Math.abs(diff), 8);
    prevRef.current = value;

    if (steps <= 1) {
      // Small change — just snap
      setDisplay(value);
    } else {
      // Animate through intermediate values over ~300ms
      let step = 0;
      const id = setInterval(() => {
        step++;
        if (step >= steps) {
          setDisplay(value);
          clearInterval(id);
        } else {
          setDisplay(Math.round(start + (diff * step) / steps));
        }
      }, Math.floor(300 / steps));

      // Cleanup if value changes again mid-animation or unmount
      const flashTimer = setTimeout(() => setFlash(false), 400);
      return () => {
        clearInterval(id);
        clearTimeout(flashTimer);
        setDisplay(value); // snap to final on cleanup
      };
    }

    const flashTimer = setTimeout(() => setFlash(false), 400);
    return () => clearTimeout(flashTimer);
  }, [value]);

  return (
    <span
      className={`${className ?? ""} transition-colors duration-300 ${
        flash ? "brightness-150" : ""
      }`}
    >
      {display.toLocaleString()}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────
export function ViewerCount({ inWorldTime }: ViewerCountProps) {
  const sessionIdRef = useRef<string | null>(null);
  const [data, setData] = useState<ViewerData | null>(null);
  // Anomalous "resolving" state — shows ?? briefly on first load
  const [anomalousResolved, setAnomalousResolved] = useState(false);

  // ── ALONE state ─────────────────────────────────────────────────────
  // When the real viewer count has been exactly 1 for 60 continuous
  // seconds, flip to "ALONE" — a slower, dimmer glitch. Reverts
  // immediately when a second viewer joins.
  const [isAlone, setIsAlone] = useState(false);
  const aloneTimestampRef = useRef<number | null>(null);
  const aloneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Generate a stable session ID on mount
  useEffect(() => {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      sessionIdRef.current = crypto.randomUUID();
    } else {
      // Fallback for older browsers
      sessionIdRef.current =
        Math.random().toString(36).slice(2) +
        Math.random().toString(36).slice(2);
    }
  }, []);

  // Heartbeat loop
  useEffect(() => {
    // Wait for sessionId to be generated
    if (!sessionIdRef.current) return;

    const sessionId = sessionIdRef.current;

    async function heartbeat() {
      try {
        const res = await fetch("/api/viewers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, inWorldTime }),
        });
        if (res.ok) {
          const json: ViewerData = await res.json();
          setData(json);
          // Delay "resolving" the anomalous count on first load
          if (!anomalousResolved) {
            setTimeout(() => setAnomalousResolved(true), 1200);
          }
        }
      } catch {
        // Silent fail — the fake count keeps the display populated,
        // and we'll retry next heartbeat.
      }
    }

    // Immediate first heartbeat
    heartbeat();
    const id = setInterval(heartbeat, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(id);
  }, [inWorldTime]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── ALONE detection effect ──────────────────────────────────────────
  // Track how long realCount has been exactly 1. After 60 continuous
  // seconds at count=1, set isAlone. Revert immediately when count > 1.
  const realCount = data?.realCount ?? 0;

  useEffect(() => {
    if (realCount === 1) {
      // Start the clock if not already ticking
      if (aloneTimestampRef.current === null) {
        aloneTimestampRef.current = Date.now();
        aloneTimerRef.current = setTimeout(() => {
          setIsAlone(true);
        }, 60_000);
      }
    } else {
      // Count changed away from 1 — reset everything
      aloneTimestampRef.current = null;
      if (aloneTimerRef.current) {
        clearTimeout(aloneTimerRef.current);
        aloneTimerRef.current = null;
      }
      setIsAlone(false);
    }

    return () => {
      if (aloneTimerRef.current) {
        clearTimeout(aloneTimerRef.current);
        aloneTimerRef.current = null;
      }
    };
  }, [realCount]);

  // ── Render ────────────────────────────────────────────────────────
  const fakeCount = data?.fakeCount ?? 0;

  // Don't render anything until we have at least one response
  if (!data) return null;

  // Anomalous display logic:
  // - 0 real viewers (cold start / no heartbeats yet) → "--"
  // - First load, not yet resolved → "??"
  // - Resolved → actual number
  let anomalousDisplay: React.ReactNode;
  if (realCount === 0) {
    anomalousDisplay = (
      <span className="text-green-300 font-bold tabular-nums">--</span>
    );
  } else if (!anomalousResolved) {
    anomalousDisplay = (
      <span className="text-green-300 font-bold animate-pulse">??</span>
    );
  } else {
    anomalousDisplay = (
      <AnimatedCount value={realCount} className="text-green-300 font-bold tabular-nums" />
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-[10px] tracking-widest font-mono select-none">
      {/* RECEIVERS — fake in-universe count */}
      <span className="text-amber-400/50">RECEIVERS</span>
      <AnimatedCount
        value={fakeCount}
        className="text-amber-400 font-bold tabular-nums"
      />

      {/* Separator */}
      <span className="text-green-700 mx-0.5">{"\u250A"}</span>

      {/* ANOMALOUS / ALONE — real viewer count */}
      <span className={isAlone ? "text-red-400/60 viewer-count-alone-label" : "text-green-400/50 viewer-count-anomalous-label"}>
        {isAlone ? "ALONE" : "ANOMALOUS"}
      </span>
      <span className={isAlone ? "viewer-count-alone-value" : "viewer-count-anomalous-value"}>
        {anomalousDisplay}
      </span>

      {/* Glitch flicker on the anomalous/alone section — inline <style> for
          self-contained keyframes without styled-jsx dependency */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .viewer-count-anomalous-label {
              animation: anomalous-flicker 4s ease-in-out infinite;
            }
            .viewer-count-anomalous-value {
              animation: anomalous-glitch 3s ease-in-out infinite;
            }
            .viewer-count-alone-label {
              animation: alone-flicker 8s ease-in-out infinite;
            }
            .viewer-count-alone-value {
              animation: alone-glitch 6s ease-in-out infinite;
            }
            @keyframes anomalous-flicker {
              0%, 92%, 100% { opacity: 1; }
              93% { opacity: 0.3; }
              94% { opacity: 0.8; }
              95% { opacity: 0.2; }
              96% { opacity: 1; }
            }
            @keyframes anomalous-glitch {
              0%, 88%, 100% {
                transform: translateX(0);
                opacity: 1;
              }
              89% {
                transform: translateX(1px);
                opacity: 0.7;
              }
              90% {
                transform: translateX(-1px);
                opacity: 0.4;
              }
              91% {
                transform: translateX(2px);
                opacity: 0.9;
              }
              92% {
                transform: translateX(0);
                opacity: 1;
              }
            }
            @keyframes alone-flicker {
              0%, 94%, 100% { opacity: 0.7; }
              95% { opacity: 0.3; }
              96% { opacity: 0.5; }
              97% { opacity: 0.25; }
              98% { opacity: 0.7; }
            }
            @keyframes alone-glitch {
              0%, 93%, 100% {
                transform: translateX(0);
                opacity: 0.7;
              }
              94% {
                transform: translateX(1px);
                opacity: 0.4;
              }
              95% {
                transform: translateX(0);
                opacity: 0.6;
              }
              96% {
                transform: translateX(-1px);
                opacity: 0.3;
              }
              97% {
                transform: translateX(0);
                opacity: 0.7;
              }
            }
          `,
        }}
      />
    </div>
  );
}
