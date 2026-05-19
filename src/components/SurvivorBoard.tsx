"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// ── Survivor Board ────────────────────────────────────────────────────
// Hidden panel that tracks every caller who texted in during the session.
// Name, neighborhood, and a fate status that silently updates over time:
//
//   ALIVE → UNCONFIRMED → SIGNAL LOST
//
// Some upgrade to CONFIRMED SAFE near dawn (after 05:00 Madison).
// Turns passive caller popups into a persistent narrative — viewers
// check back on callers they remember and find their status changed.
//
// Session-scoped (state lives in this component, fed by parent).
// Opens as a slide-out panel from the left edge.

export type CallerFate =
  | "ALIVE"
  | "UNCONFIRMED"
  | "SIGNAL LOST"
  | "CONFIRMED SAFE";

export interface TrackedCaller {
  /** Caller name. */
  name: string;
  /** Madison neighborhood. */
  neighborhood: string;
  /** Tone from the original popup. */
  tone: string;
  /** Current fate status. */
  fate: CallerFate;
  /** Timestamp when first registered (HH:MM). */
  registeredAt: string;
  /** Timestamp of last status update (HH:MM). */
  lastUpdate: string;
  /** Internal: scheduled fate transitions. */
  _fateQueue: CallerFate[];
  /** Internal: seconds until next fate transition. */
  _nextTransitionSec: number;
}

interface SurvivorBoardProps {
  /** Whether the panel is visible. */
  isOpen: boolean;
  /** Close handler. */
  onClose: () => void;
  /** Tracked callers list (managed by parent). */
  callers: TrackedCaller[];
  /** Current Madison time string (HH:MM). */
  madisonTime: string;
}

// ── Fate logic ────────────────────────────────────────────────────────

/** Determine the initial fate queue for a caller based on tone + time.
 *  Wholesome/scared callers tend to survive; angry/cryptic callers drift. */
export function buildFateQueue(
  tone: string,
  madisonTime: string,
): { initialFate: CallerFate; queue: CallerFate[]; firstDelaySec: number } {
  const hour = parseInt(madisonTime.split(":")[0], 10);
  // Purge runs 19:00→07:00. Map hours to night phases:
  //   19-00 = early/mid night (default path)
  //   01-04 = late night (tension peaks)
  //   05-07 = near dawn (survivors emerge)
  const isLateNight = hour >= 1 && hour < 5;
  const isNearDawn = hour >= 5 && hour < 8;
  const roll = Math.random();

  if (isNearDawn) {
    // Near dawn — most callers survive
    return {
      initialFate: "ALIVE",
      queue: roll < 0.7 ? ["CONFIRMED SAFE"] : ["UNCONFIRMED"],
      firstDelaySec: 120 + Math.random() * 180,
    };
  }

  if (isLateNight) {
    // Late night — tension peaks, more fate drift
    if (tone === "scared" || tone === "cryptic") {
      // Scared/cryptic callers: higher chance of signal loss
      if (roll < 0.3) {
        return {
          initialFate: "ALIVE",
          queue: ["UNCONFIRMED", "SIGNAL LOST"],
          firstDelaySec: 180 + Math.random() * 240,
        };
      }
      return {
        initialFate: "ALIVE",
        queue: ["UNCONFIRMED"],
        firstDelaySec: 240 + Math.random() * 300,
      };
    }
    // Others — mostly hold
    return {
      initialFate: "ALIVE",
      queue: roll < 0.2 ? ["UNCONFIRMED"] : [],
      firstDelaySec: 300 + Math.random() * 300,
    };
  }

  // Early-to-mid night (19:00–01:00)
  if (tone === "wholesome") {
    return {
      initialFate: "ALIVE",
      queue: [],
      firstDelaySec: 600,
    };
  }
  if (tone === "angry") {
    return {
      initialFate: "ALIVE",
      queue: roll < 0.4 ? ["UNCONFIRMED", "SIGNAL LOST"] : ["UNCONFIRMED"],
      firstDelaySec: 300 + Math.random() * 300,
    };
  }
  if (tone === "cryptic") {
    return {
      initialFate: "ALIVE",
      queue: roll < 0.5 ? ["UNCONFIRMED"] : [],
      firstDelaySec: 240 + Math.random() * 360,
    };
  }
  // Default (scared, dark-humor, etc.)
  return {
    initialFate: "ALIVE",
    queue: roll < 0.25 ? ["UNCONFIRMED"] : [],
    firstDelaySec: 300 + Math.random() * 300,
  };
}

// ── Fate colors ───────────────────────────────────────────────────────

function fateColor(fate: CallerFate): string {
  switch (fate) {
    case "ALIVE":
      return "text-green-400";
    case "CONFIRMED SAFE":
      return "text-green-300";
    case "UNCONFIRMED":
      return "text-amber-400";
    case "SIGNAL LOST":
      return "text-red-500";
  }
}

function fateDot(fate: CallerFate): string {
  switch (fate) {
    case "ALIVE":
      return "bg-green-400";
    case "CONFIRMED SAFE":
      return "bg-green-300";
    case "UNCONFIRMED":
      return "bg-amber-400";
    case "SIGNAL LOST":
      return "bg-red-500";
  }
}

function fatePulse(fate: CallerFate): boolean {
  return fate === "ALIVE" || fate === "CONFIRMED SAFE";
}

// ── Component ─────────────────────────────────────────────────────────

export function SurvivorBoard({
  isOpen,
  onClose,
  callers,
  madisonTime,
}: SurvivorBoardProps) {
  // Sort: SIGNAL LOST first, then UNCONFIRMED, then ALIVE, then CONFIRMED SAFE
  const sorted = [...callers].sort((a, b) => {
    const order: Record<CallerFate, number> = {
      "SIGNAL LOST": 0,
      UNCONFIRMED: 1,
      ALIVE: 2,
      "CONFIRMED SAFE": 3,
    };
    return order[a.fate] - order[b.fate];
  });

  const aliveCount = callers.filter(
    (c) => c.fate === "ALIVE" || c.fate === "CONFIRMED SAFE",
  ).length;
  const lostCount = callers.filter((c) => c.fate === "SIGNAL LOST").length;
  const unknownCount = callers.filter((c) => c.fate === "UNCONFIRMED").length;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[55] bg-black/60"
          onClick={onClose}
          aria-hidden
        />
      )}

      {/* Panel */}
      <div
        className={[
          "fixed top-0 left-0 bottom-0 z-[56] w-[340px] max-w-[85vw]",
          "bg-black/95 border-r border-green-900/50 font-mono",
          "transform transition-transform duration-300 ease-out",
          "overflow-y-auto",
          isOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        {/* Header */}
        <div className="sticky top-0 bg-black/95 border-b border-green-900/40 px-4 py-3 z-10">
          <div className="flex items-center justify-between mb-2">
            <div className="text-green-500 text-[11px] tracking-[0.3em] font-bold">
              SURVIVOR BOARD
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-green-700 hover:text-green-400 text-sm cursor-pointer transition-colors"
            >
              ✕
            </button>
          </div>
          <div className="text-[10px] tracking-widest text-green-700">
            {madisonTime} · {callers.length} REGISTERED
          </div>

          {/* Summary counts */}
          {callers.length > 0 && (
            <div className="flex gap-3 mt-2 text-[10px] tracking-wider">
              <span className="text-green-400">● {aliveCount} ALIVE</span>
              {unknownCount > 0 && (
                <span className="text-amber-400">● {unknownCount} UNCONFIRMED</span>
              )}
              {lostCount > 0 && (
                <span className="text-red-500">● {lostCount} LOST</span>
              )}
            </div>
          )}
        </div>

        {/* Caller list */}
        {callers.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <div className="text-green-800 text-[12px] tracking-widest mb-2">
              NO CALLERS REGISTERED
            </div>
            <div className="text-green-900 text-[11px]">
              Callers appear here as they text in to the station.
            </div>
          </div>
        ) : (
          <div className="divide-y divide-green-900/20">
            {sorted.map((caller, i) => (
              <div
                key={`${caller.name}-${caller.neighborhood}-${i}`}
                className="px-4 py-2.5 hover:bg-green-900/10 transition-colors"
              >
                <div className="flex items-center justify-between mb-0.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={[
                        "w-1.5 h-1.5 rounded-full",
                        fateDot(caller.fate),
                        fatePulse(caller.fate) ? "animate-pulse" : "",
                      ].join(" ")}
                    />
                    <span className="text-green-300 text-[13px] font-bold">
                      {caller.name}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] tracking-widest ${fateColor(caller.fate)}`}
                  >
                    {caller.fate}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-green-700 pl-3.5">
                  <span>{caller.neighborhood}</span>
                  <span>
                    reg {caller.registeredAt}
                    {caller.lastUpdate !== caller.registeredAt && (
                      <> · upd {caller.lastUpdate}</>
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="sticky bottom-0 bg-black/95 border-t border-green-900/30 px-4 py-2 text-[10px] text-green-800 tracking-widest">
          // STATUS UPDATES ARE AUTOMATIC //
        </div>
      </div>
    </>
  );
}
