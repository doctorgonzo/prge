"use client";

import { useEffect, useState } from "react";

interface SignalLostFlashProps {
  active: boolean;
  onComplete: () => void;
}

/**
 * Full-screen "SIGNAL LOST" flash card. Fires for 1.5 seconds when a station
 * breach or high-severity crisis begins — the beat of dread before Tim's EBS
 * alert takes over. Pure black, bold red text, scanlines, static noise burst.
 *
 * z-[88] — above dead air (85), below Tim EBS (90).
 */
export function SignalLostFlash({ active, onComplete }: SignalLostFlashProps) {
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState<"in" | "hold" | "out">("in");

  useEffect(() => {
    if (!active) {
      setVisible(false);
      setPhase("in");
      return;
    }

    setVisible(true);
    setPhase("in");

    // Flash-in is instant (the CSS handles the slam). Hold for the bulk of
    // the 1.5s, then a quick fade-to-black before handing off to EBS.
    const holdTimer = setTimeout(() => setPhase("hold"), 80);
    const outTimer = setTimeout(() => setPhase("out"), 1200);
    const doneTimer = setTimeout(() => {
      setVisible(false);
      setPhase("in");
      onComplete();
    }, 1500);

    return () => {
      clearTimeout(holdTimer);
      clearTimeout(outTimer);
      clearTimeout(doneTimer);
    };
  }, [active, onComplete]);

  if (!visible) return null;

  return (
    <div
      className={`
        fixed inset-0 z-[88] flex items-center justify-center
        transition-opacity duration-200
        ${phase === "out" ? "opacity-0" : "opacity-100"}
      `}
      style={{ background: "#000" }}
    >
      {/* Static noise burst — CSS-animated grain layer */}
      <div className="signal-lost-static absolute inset-0 pointer-events-none" />

      {/* Horizontal interference bars — quick sweep */}
      <div className="signal-lost-bars absolute inset-0 pointer-events-none" />

      {/* CRT scanlines on top of everything */}
      <div className="prge-scanlines absolute inset-0 pointer-events-none" />

      {/* The text */}
      <div className="relative z-10 flex flex-col items-center gap-4 select-none">
        {/* Glitch-doubled shadow text for depth */}
        <div
          className="signal-lost-glitch absolute font-mono text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-black tracking-widest text-red-600/30"
          aria-hidden="true"
        >
          SIGNAL LOST
        </div>

        {/* Primary text — slams in, pulses once */}
        <h1
          className={`
            signal-lost-text font-mono text-5xl sm:text-7xl md:text-8xl lg:text-9xl
            font-black tracking-widest text-red-600
            ${phase === "in" ? "signal-lost-slam" : ""}
          `}
        >
          SIGNAL LOST
        </h1>

        {/* Subtext — fades in after the slam */}
        <p
          className={`
            font-mono text-sm sm:text-base text-red-900/80 tracking-[0.3em] uppercase
            transition-opacity duration-500 delay-300
            ${phase === "in" ? "opacity-0" : "opacity-100"}
          `}
        >
          no carrier
        </p>
      </div>
    </div>
  );
}
