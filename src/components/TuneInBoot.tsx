"use client";

import { useEffect, useState } from "react";

// First-load boot sequence — sells the "tuning into a pirate signal" world
// before the live broadcast appears. SessionStorage-gated so a refresh inside
// the same tab session doesn't re-boot. Click anywhere to skip.

const BOOT_LINES: { text: string; delayMs: number }[] = [
  { text: "PRGE TRANSMITTER · INITIALIZING...", delayMs: 0 },
  { text: "FREQ 420.69 MHz · UNLICENSED BAND", delayMs: 240 },
  { text: "FCC DETECTION SCAN... NEGATIVE", delayMs: 320 },
  { text: "ROUTING THROUGH NEXUS-9 RELAY", delayMs: 260 },
  { text: "AUTHENTICATING BROADCAST KEY... OK", delayMs: 300 },
  { text: "DECRYPTING SIGNAL...", delayMs: 240 },
  { text: "▓▓▓▓▓▓▓▓▓▓ 100%", delayMs: 520 },
  { text: " ", delayMs: 220 },
  { text: "WELCOME TO PURGE NIGHT.", delayMs: 120 },
  { text: "STAY HOME. STAY ALIVE. STAY TUNED.", delayMs: 360 },
];

const FINAL_HOLD_MS = 1200;
const FADE_OUT_MS = 700;
const SESSION_KEY = "prge-booted-v1";

export function TuneInBoot() {
  // null = haven't checked sessionStorage yet (SSR-safe). false = boot in
  // progress. true = boot done or skipped.
  const [done, setDone] = useState<boolean | null>(null);
  const [visibleCount, setVisibleCount] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const booted = sessionStorage.getItem(SESSION_KEY) === "1";
    setDone(booted);
  }, []);

  useEffect(() => {
    if (done !== false) return;
    let cancelled = false;
    let cumulative = 0;
    const timers: number[] = [];
    BOOT_LINES.forEach((line, i) => {
      cumulative += line.delayMs;
      timers.push(
        window.setTimeout(() => {
          if (!cancelled) setVisibleCount(i + 1);
        }, cumulative),
      );
    });
    const fadeStart = cumulative + FINAL_HOLD_MS;
    timers.push(
      window.setTimeout(() => {
        if (!cancelled) setFading(true);
      }, fadeStart),
    );
    timers.push(
      window.setTimeout(() => {
        if (cancelled) return;
        sessionStorage.setItem(SESSION_KEY, "1");
        setDone(true);
      }, fadeStart + FADE_OUT_MS),
    );
    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [done]);

  function skip() {
    sessionStorage.setItem(SESSION_KEY, "1");
    setDone(true);
  }

  if (done === null || done === true) return null;

  return (
    <div
      onClick={skip}
      className={`fixed inset-0 z-[100] bg-black flex items-end justify-start p-8 md:p-12 cursor-pointer transition-opacity ${
        fading ? "opacity-0" : "opacity-100"
      }`}
      style={{ transitionDuration: `${FADE_OUT_MS}ms` }}
    >
      <div className="text-amber-300 font-mono text-sm md:text-base leading-relaxed max-w-3xl">
        {BOOT_LINES.slice(0, visibleCount).map((line, i) => (
          <div key={i} className="prge-boot-line">
            {line.text}
          </div>
        ))}
        {visibleCount > 0 && visibleCount < BOOT_LINES.length && (
          <span
            className="prge-boot-cursor inline-block w-2 h-4 bg-amber-300 align-middle ml-1"
            aria-hidden
          />
        )}
      </div>
      <div className="absolute bottom-4 right-6 text-amber-700/70 text-[10px] tracking-widest">
        CLICK TO SKIP
      </div>
    </div>
  );
}
