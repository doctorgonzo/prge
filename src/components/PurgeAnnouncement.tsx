"use client";

import { useEffect, useRef, useState } from "react";

// Canonical Purge emergency-broadcast announcement. Plays after TuneInBoot
// fades to fill the segment-fetch window with diegetic content before the
// pirate broadcast view reveals. SessionStorage-gated; click anywhere to skip.

// Each entry is a "stanza" — a logical paragraph that reveals as one chunk.
// Per-stanza delay is ~1100–1300ms so the eye lands on each paragraph at a
// readable cadence, and the total runtime fits the segment-fetch window
// (~12s) rather than the per-line cadence dragging it past the budget.
const ANNOUNCEMENT_LINES: { text: string; delayMs: number }[] = [
  { text: "\u26A0", delayMs: 0 },
  { text: "EMERGENCY BROADCAST SYSTEM", delayMs: 900 },
  { text: "THIS IS NOT A TEST", delayMs: 800 },
  {
    text:
      "This is your Emergency Broadcast System\nannouncing the commencement of\nthe Annual Purge sanctioned by\nthe United States Government.",
    delayMs: 1300,
  },
  {
    text:
      "Weapons of Class 4 and lower have been\nauthorized for use during the Purge.\nAll other weapons remain restricted.",
    delayMs: 1200,
  },
  {
    text:
      "Government officials of ranking 10 and above\nhave been granted immunity from the Purge\nand shall not be harmed.",
    delayMs: 1200,
  },
  {
    text:
      "Commencing at the siren, any and all crime \u2014\nincluding murder \u2014 will be legal\nfor twelve continuous hours.",
    delayMs: 1200,
  },
  {
    text:
      "Police, fire, and emergency medical services\nwill be unavailable until tomorrow morning\nat seven a.m. when the Purge concludes.",
    delayMs: 1200,
  },
  {
    text:
      "Blessed be the New Founding Fathers\nand America, a nation reborn.\nMay God be with you all.",
    delayMs: 1200,
  },
  {
    text:
      "\u2014 END OFFICIAL TRANSMISSION \u2014\nTUNING TO PIRATE FREQUENCY 420.69 MHz",
    delayMs: 1300,
  },
];

const FINAL_HOLD_MS = 800;
const FADE_OUT_MS = 600;
const SESSION_KEY = "prge-purge-announced-v1";
const EBS_AMBER = "#f5c945";

export function PurgeAnnouncement() {
  // null = haven't checked sessionStorage yet (SSR-safe). false = playing.
  // true = done or skipped.
  const [done, setDone] = useState<boolean | null>(null);
  const [visibleCount, setVisibleCount] = useState(0);
  const [fading, setFading] = useState(false);
  // Ref to the EBS audio element. We control playback from useEffect because
  // browser autoplay policy can reject `autoPlay` on a fresh page without prior
  // user interaction; we catch the rejection and degrade gracefully (text-only).
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const announced = sessionStorage.getItem(SESSION_KEY) === "1";
    setDone(announced);
  }, []);

  // Kick off audio playback when the overlay becomes visible. The Purge
  // announcement is diegetic — it's THE opening moment, so it plays
  // regardless of the global sound toggle. Autoplay may be rejected on a
  // cold page (no user gesture yet) — that's fine, text reveals still play
  // out. The TuneInBoot above us often gets a skip-click, which qualifies
  // as a user gesture and unlocks autoplay for us downstream.
  useEffect(() => {
    if (done !== false) return;
    const el = audioRef.current;
    if (!el) return;
    el.volume = 1;
    void el.play().catch(() => {
      // Autoplay blocked — leave the player silent; text carries the content.
    });
  }, [done]);

  // When the overlay fades, ramp audio volume to 0 in lockstep with the visual
  // fade so the announcement doesn't keep blaring over the live broadcast.
  // Linear ramp across FADE_OUT_MS in ~30ms steps — smooth enough.
  useEffect(() => {
    if (!fading) return;
    const el = audioRef.current;
    if (!el) return;
    const startVol = el.volume;
    const startTs = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - startTs) / FADE_OUT_MS);
      el.volume = Math.max(0, startVol * (1 - t));
      if (t < 1) {
        raf = requestAnimationFrame(step);
      } else {
        el.pause();
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [fading]);

  // Set document.title to "EMERGENCY BROADCAST SYSTEM" while announcement plays.
  useEffect(() => {
    if (done === false) {
      document.title = "EMERGENCY BROADCAST SYSTEM";
    }
  }, [done]);

  useEffect(() => {
    if (done !== false) return;
    let cancelled = false;
    let cumulative = 0;
    const timers: number[] = [];
    ANNOUNCEMENT_LINES.forEach((line, i) => {
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
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
    setDone(true);
  }

  if (done === null || done === true) return null;

  // First line is the warning triangle, rendered centered + large.
  // Lines 2-3 are the EBS header (bold, centered). Remainder is the body.
  return (
    <div
      onClick={skip}
      className={`fixed inset-0 z-[99] bg-black flex flex-col items-center justify-center p-8 md:p-12 cursor-pointer transition-opacity ${
        fading ? "opacity-0" : "opacity-100"
      }`}
      style={{ transitionDuration: `${FADE_OUT_MS}ms` }}
    >
      <div
        className="font-mono text-sm md:text-base leading-relaxed text-center max-w-2xl whitespace-pre-line"
        style={{ color: EBS_AMBER }}
      >
        {ANNOUNCEMENT_LINES.slice(0, visibleCount).map((line, i) => {
          if (i === 0) {
            return (
              <div key={i} className="text-5xl md:text-6xl mb-4" aria-hidden>
                {line.text}
              </div>
            );
          }
          if (i === 1 || i === 2) {
            return (
              <div key={i} className="font-bold tracking-widest">
                {line.text}
              </div>
            );
          }
          // Body stanzas — extra top margin separates paragraphs visually
          // since blank "spacer" lines were collapsed into the stanza model.
          return (
            <div key={i} className="mt-4">
              {line.text}
            </div>
          );
        })}
      </div>
      <div
        className="absolute bottom-4 right-6 text-[10px] tracking-widest"
        style={{ color: "rgba(245, 201, 69, 0.45)" }}
      >
        CLICK TO SKIP
      </div>
      {/* Real Purge announcement audio from the films. ~69s clip; we fade it
          out when the overlay fades so it doesn't keep playing over the
          pirate broadcast that comes up underneath. */}
      <audio
        ref={audioRef}
        src="/purge-announcement.mp3"
        preload="auto"
        playsInline
      />
    </div>
  );
}
