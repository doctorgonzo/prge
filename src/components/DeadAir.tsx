"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// ── Dead Air ──────────────────────────────────────────────────────────
// Scheduled silence event. Everything goes black — no ticker, no HUD
// content, just TV static hiss. After 15-45 seconds, Tim comes back:
// "We're here. We're still here. Stand by."
//
// The static sound is generated via Web Audio API (white noise buffer)
// so there's no file dependency.

interface DeadAirProps {
  /** Duration in seconds (15-45, typically). */
  durationSec: number;
  /** Called when dead air ends — parent should clear the state. */
  onComplete: () => void;
  /** Whether audio is enabled (user's sound toggle). */
  soundEnabled?: boolean;
}

/** Tim's comeback lines — picked randomly when dead air ends. */
const TIM_COMEBACK_LINES: readonly string[] = [
  "We're here. We're still here. Stand by.",
  "Signal reacquired. We're back. Stay with us.",
  "— Tim. We lost the feed. We're back now. Don't touch that dial.",
  "Technical difficulties. Nobody panic. That includes me.",
  "We had a dropout. Still broadcasting. Still alive. Carry on.",
  "That wasn't planned. We're fine. The rig's fine. Continue.",
  "Dead air. My fault. Battery swap. We're back.",
  "Lost you for a second. You still there? Good. So are we.",
];

/** Generate a white noise AudioBuffer — sounds like TV static. */
function createStaticNoise(ctx: AudioContext, durationSec: number): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * durationSec;
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

export function DeadAir({
  durationSec,
  onComplete,
  soundEnabled = false,
}: DeadAirProps) {
  const [phase, setPhase] = useState<"static" | "comeback" | "done">("static");
  const [comebackLine] = useState(
    () => TIM_COMEBACK_LINES[Math.floor(Math.random() * TIM_COMEBACK_LINES.length)],
  );
  const [comebackVisible, setComebackVisible] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const completedRef = useRef(false);

  const handleComplete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    // Stop audio
    try {
      sourceRef.current?.stop();
      audioCtxRef.current?.close();
    } catch {
      // Already stopped
    }
    onComplete();
  }, [onComplete]);

  // Play static hiss via Web Audio API
  useEffect(() => {
    if (!soundEnabled) return;

    try {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      // Create white noise buffer for the full duration + comeback hold
      const totalDuration = durationSec + 5;
      const buffer = createStaticNoise(ctx, totalDuration);
      const source = ctx.createBufferSource();
      source.buffer = buffer;

      // Gain node — start at moderate volume, fade up slightly mid-way
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, ctx.currentTime);
      // Fade in over 0.5s
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.5);
      // Hold
      gain.gain.setValueAtTime(0.15, ctx.currentTime + durationSec - 0.5);
      // Fade out over 1s as Tim comes back
      gain.gain.linearRampToValueAtTime(0.03, ctx.currentTime + durationSec + 1.5);
      // Kill
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + durationSec + 3);

      source.connect(gain);
      gain.connect(ctx.destination);
      source.start();
      sourceRef.current = source;
    } catch {
      // Web Audio not available — silent fallback
    }

    return () => {
      try {
        sourceRef.current?.stop();
        audioCtxRef.current?.close();
      } catch {
        // Already cleaned up
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Phase transitions: static → comeback → done
  useEffect(() => {
    // After durationSec, show Tim's comeback line
    const comebackTimer = setTimeout(() => {
      setPhase("comeback");
      // Animate the line in after a beat
      setTimeout(() => setComebackVisible(true), 300);
    }, durationSec * 1000);

    // After comeback holds for 4 seconds, complete
    const completeTimer = setTimeout(() => {
      setPhase("done");
      handleComplete();
    }, (durationSec + 4) * 1000);

    return () => {
      clearTimeout(comebackTimer);
      clearTimeout(completeTimer);
    };
  }, [durationSec, handleComplete]);

  if (phase === "done") return null;

  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center cursor-pointer"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.97)" }}
      onClick={handleComplete}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Escape" || e.key === " ") handleComplete();
      }}
    >
      {/* Subtle static grain overlay */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "256px 256px",
          animation: "dead-air-grain 0.1s steps(3) infinite",
        }}
      />

      {/* Static animation keyframe */}
      <style>{`
        @keyframes dead-air-grain {
          0% { transform: translate(0, 0); }
          33% { transform: translate(-2px, 1px); }
          66% { transform: translate(1px, -2px); }
          100% { transform: translate(-1px, 2px); }
        }
        @keyframes dead-air-fade-in {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes dead-air-scanline {
          from { top: -4px; }
          to { top: 100%; }
        }
      `}</style>

      {/* Slow-moving scanline */}
      <div
        className="absolute left-0 right-0 h-[2px] bg-white/[0.03]"
        style={{
          animation: "dead-air-scanline 4s linear infinite",
        }}
      />

      {/* Tim's comeback */}
      {phase === "comeback" && (
        <div
          className="relative z-10 max-w-md text-center font-mono px-6"
          style={{
            opacity: comebackVisible ? 1 : 0,
            transform: comebackVisible ? "translateY(0)" : "translateY(4px)",
            transition: "opacity 0.8s ease-out, transform 0.8s ease-out",
          }}
        >
          <div className="text-amber-500/60 text-[10px] tracking-[0.3em] mb-3">
            TIM PEPLINSKI
          </div>
          <div className="text-green-100/80 text-sm leading-relaxed">
            {comebackLine}
          </div>
        </div>
      )}
    </div>
  );
}
