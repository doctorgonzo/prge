"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { TimInterrupt } from "@/lib/tim-interrupts";

interface EmergencyAlertProps {
  interrupt: TimInterrupt;
  onComplete: () => void;
  /** Whether audio is enabled (user's sound toggle). */
  soundEnabled?: boolean;
}

/** Time between each line reveal (ms). */
const LINE_INTERVAL_MS = 2500;
/** How long the full message holds after the last line appears. */
const HOLD_MS = 3000;

/**
 * Full-screen emergency broadcast overlay. Tim cuts all programming and
 * talks to Madison directly. Lines reveal sequentially, hold, then the
 * overlay auto-dismisses via onComplete.
 *
 * Severity 1 = amber border, "PRGE OPERATOR NOTICE" header.
 * Severity 2 = amber border + faster pulse, "PRGE EMERGENCY BROADCAST" header.
 * Severity 3 = red border + fast pulse, "PRGE EMERGENCY BROADCAST" header.
 */
export function EmergencyAlert({ interrupt, onComplete, soundEnabled = false }: EmergencyAlertProps) {
  const [visibleCount, setVisibleCount] = useState(0);
  const completedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const interruptIdRef = useRef(interrupt);

  // If the interrupt prop changes (new alert replacing old), reset state
  // so the new alert can play through and complete properly.
  if (interrupt !== interruptIdRef.current) {
    interruptIdRef.current = interrupt;
    completedRef.current = false;
    setVisibleCount(0);
  }

  const handleComplete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    // Stop the tone on dismiss.
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    onComplete();
  }, [onComplete]);

  // Play the EBS attention tone when the alert mounts (if sound enabled).
  useEffect(() => {
    if (!soundEnabled) return;
    try {
      const audio = new Audio("/ebs-tone.mp3");
      audio.volume = interrupt.severity === 3 ? 0.5 : 0.35;
      audioRef.current = audio;
      audio.play().catch(() => {/* autoplay blocked — silent fallback */});
    } catch {
      // No audio support — carry on without sound.
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sequential line reveal + hold + auto-dismiss.
  useEffect(() => {
    let cancelled = false;
    const timers: number[] = [];

    // Reveal lines one at a time.
    interrupt.lines.forEach((_, i) => {
      timers.push(
        window.setTimeout(() => {
          if (!cancelled) setVisibleCount(i + 1);
        }, LINE_INTERVAL_MS * (i + 1)),
      );
    });

    // After all lines + hold period, fire onComplete.
    const totalMs = LINE_INTERVAL_MS * interrupt.lines.length + HOLD_MS;
    timers.push(
      window.setTimeout(() => {
        if (!cancelled) handleComplete();
      }, totalMs),
    );

    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [interrupt, handleComplete]);

  const isCritical = interrupt.severity === 3;
  const isNotice = interrupt.severity === 1;

  // Border color: red for severity 3, amber for 1-2.
  const borderColor = isCritical ? "rgba(239, 68, 68, 0.9)" : "rgba(245, 158, 11, 0.9)";
  const borderColorDim = isCritical ? "rgba(239, 68, 68, 0.4)" : "rgba(245, 158, 11, 0.4)";

  // Pulse speed: severity 3 = fast (0.8s), severity 2 = medium (1.6s), severity 1 = slow (2.4s).
  const pulseDuration = isCritical ? "0.8s" : interrupt.severity === 2 ? "1.6s" : "2.4s";

  const headerText = isNotice
    ? "PRGE OPERATOR NOTICE"
    : "\u26A0 PRGE EMERGENCY BROADCAST \u26A0";

  // Header color: red-400 for critical, amber-400 for everything else.
  const headerColorClass = isCritical ? "text-red-400" : "text-amber-400";

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-6 md:p-12"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.88)" }}
    >
      {/* Pulsing border container */}
      <div
        className="relative w-full max-w-2xl border-2 p-6 md:p-10 font-mono"
        style={{
          borderColor,
          animation: `emergency-pulse ${pulseDuration} ease-in-out infinite alternate`,
        }}
      >
        {/* Inline keyframe — avoids needing a global CSS file. */}
        <style>{`
          @keyframes emergency-pulse {
            from { border-color: ${borderColor}; box-shadow: 0 0 20px ${borderColorDim}, inset 0 0 20px ${borderColorDim}; }
            to   { border-color: ${borderColorDim}; box-shadow: 0 0 6px transparent, inset 0 0 6px transparent; }
          }
          @keyframes line-fade-in {
            from { opacity: 0; transform: translateY(6px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>

        {/* Header */}
        <div
          className={`text-xs md:text-sm tracking-[0.3em] ${headerColorClass} text-center mb-6 md:mb-8 font-bold`}
        >
          {headerText}
        </div>

        {/* Tim's lines */}
        <div className="space-y-4">
          {interrupt.lines.slice(0, visibleCount).map((line, i) => (
            <div
              key={i}
              style={{ animation: "line-fade-in 0.4s ease-out forwards" }}
            >
              {/* Host label */}
              <div
                className={`text-[10px] md:text-xs tracking-[0.25em] mb-1 ${
                  isCritical ? "text-red-400/70" : "text-amber-400/70"
                }`}
              >
                TIM PEPLINSKI
              </div>
              {/* Line text */}
              <div className="text-sm md:text-base text-green-100 leading-relaxed">
                {line}
              </div>
            </div>
          ))}
        </div>

        {/* Severity badge — bottom right, very quiet */}
        <div
          className={`absolute bottom-3 right-4 text-[9px] tracking-[0.2em] ${
            isCritical ? "text-red-500/40" : "text-amber-500/40"
          }`}
        >
          {isNotice
            ? "SEVERITY 1 \u2014 TECHNICAL"
            : interrupt.severity === 2
              ? "SEVERITY 2 \u2014 ZONE ALERT"
              : "SEVERITY 3 \u2014 CRITICAL"}
        </div>
      </div>
    </div>
  );
}
