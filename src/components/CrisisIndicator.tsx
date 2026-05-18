"use client";

import { useEffect, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────

type CrisisType =
  | "weather"
  | "fire"
  | "gun-violence"
  | "break-in"
  | "infrastructure"
  | "signal"
  | "medical";

interface CrisisIndicatorProps {
  type: CrisisType;
  title: string;
  severity: 1 | 2 | 3;
}

// ── Color + label config per crisis type ──────────────────────────────

const TYPE_CONFIG: Record<
  CrisisType,
  { icon: string; color: string; colorDim: string; label: string }
> = {
  weather: {
    icon: "⛈",
    color: "rgba(59, 130, 246, 0.9)",   // blue
    colorDim: "rgba(59, 130, 246, 0.3)",
    label: "WEATHER EMERGENCY",
  },
  fire: {
    icon: "🔥",
    color: "rgba(249, 115, 22, 0.9)",   // orange
    colorDim: "rgba(249, 115, 22, 0.3)",
    label: "STRUCTURE FIRE",
  },
  "gun-violence": {
    icon: "⚠",
    color: "rgba(239, 68, 68, 0.9)",    // red
    colorDim: "rgba(239, 68, 68, 0.3)",
    label: "ACTIVE THREAT",
  },
  "break-in": {
    icon: "🚨",
    color: "rgba(239, 68, 68, 0.95)",   // bright red
    colorDim: "rgba(239, 68, 68, 0.4)",
    label: "SECURITY BREACH",
  },
  infrastructure: {
    icon: "⚡",
    color: "rgba(245, 158, 11, 0.9)",   // amber
    colorDim: "rgba(245, 158, 11, 0.3)",
    label: "INFRASTRUCTURE FAILURE",
  },
  signal: {
    icon: "📡",
    color: "rgba(168, 85, 247, 0.9)",   // purple
    colorDim: "rgba(168, 85, 247, 0.3)",
    label: "SIGNAL THREAT",
  },
  medical: {
    icon: "🏥",
    color: "rgba(239, 68, 68, 0.8)",    // red
    colorDim: "rgba(239, 68, 68, 0.3)",
    label: "MEDICAL EMERGENCY",
  },
};

// ── Component ─────────────────────────────────────────────────────────

/**
 * Persistent pulsing bar across the top of the screen during an active
 * crisis event. Not subtle — this should feel like something is WRONG
 * with the broadcast. Sits below the top HUD (z-15) so it doesn't
 * block controls but is always visible.
 */
export function CrisisIndicator({ type, title, severity }: CrisisIndicatorProps) {
  const [visible, setVisible] = useState(false);

  // Slide in on mount.
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const config = TYPE_CONFIG[type];

  // Pulse speed scales with severity: 3 = fast, 1 = slow.
  const pulseDuration = severity === 3 ? "0.6s" : severity === 2 ? "1.2s" : "2s";

  return (
    <div
      className={`fixed top-14 inset-x-0 z-[15] transition-all duration-500 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
      }`}
    >
      <div
        className="w-full px-6 py-2 font-mono text-center"
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.85)",
          borderBottom: `2px solid ${config.color}`,
          animation: `crisis-pulse ${pulseDuration} ease-in-out infinite alternate`,
        }}
      >
        <style>{`
          @keyframes crisis-pulse {
            from {
              border-color: ${config.color};
              box-shadow: 0 2px 12px ${config.colorDim}, inset 0 0 20px ${config.colorDim};
            }
            to {
              border-color: ${config.colorDim};
              box-shadow: 0 2px 4px transparent, inset 0 0 4px transparent;
            }
          }
          @keyframes crisis-text-flash {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
        `}</style>

        <div className="flex items-center justify-center gap-3">
          {/* Icon */}
          <span
            className="text-sm"
            style={{ animation: `crisis-text-flash ${pulseDuration} ease-in-out infinite` }}
          >
            {config.icon}
          </span>

          {/* Label */}
          <span
            className="text-[10px] md:text-xs tracking-[0.3em] font-bold"
            style={{
              color: config.color,
              animation: `crisis-text-flash ${pulseDuration} ease-in-out infinite`,
            }}
          >
            {config.label}
          </span>

          {/* Separator */}
          <span className="text-green-700 text-xs">┊</span>

          {/* Title */}
          <span className="text-[10px] md:text-xs tracking-[0.15em] text-green-300/70 uppercase">
            {title}
          </span>

          {/* Separator */}
          <span className="text-green-700 text-xs">┊</span>

          {/* Icon */}
          <span
            className="text-sm"
            style={{ animation: `crisis-text-flash ${pulseDuration} ease-in-out infinite` }}
          >
            {config.icon}
          </span>
        </div>
      </div>
    </div>
  );
}
