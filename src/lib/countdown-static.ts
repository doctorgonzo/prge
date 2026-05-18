// src/lib/countdown-static.ts
// Static segment builder for the pre-Purge countdown hour (18:00–19:00).
// No LLM calls — serves baked survival PSA content with video tracks.
//
// Entrypoint:
//   buildStaticCountdownSegment(cacheKey, madisonHHMM)
//     → countdown segment JSON with PSA video tracks + text lines
//
// The countdown segment is structured like a music-block (tracks array with
// per-track lines, played through the MusicBlockLayout iframe) but carries
// survival PSA videos instead of songs. The text lines are urgent
// preparedness tips from Tim and the station automation.

import { COUNTDOWN_PSAS } from "./countdown-psas";
import { COUNTDOWN_VIDEOS } from "./countdown-videos";

// ── Deterministic hash (same algo as daytime-static.ts) ─────────────────
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// ── PSA category labels for the player chrome ───────────────────────────
const CATEGORY_LABELS: Record<string, string> = {
  fortification: "HOME DEFENSE",
  supplies: "EMERGENCY SUPPLIES",
  communication: "COMMS",
  medical: "MEDICAL",
  movement: "MOVEMENT & EVASION",
  vehicle: "VEHICLE SAFETY",
  defense: "SELF-DEFENSE",
  psychological: "MENTAL PREP",
  madison: "MADISON ADVISORY",
  legal: "LEGAL / TIMING",
  community: "MUTUAL AID",
  "post-purge": "POST-PURGE",
};

// ── Segment builder ─────────────────────────────────────────────────────

/**
 * Build a static countdown segment for the pre-Purge countdown hour.
 * Deterministically picks 6-8 PSA videos (or text PSAs if no videos)
 * and pairs each with 2-3 rotating text PSA lines.
 *
 * @param cacheKey - Stable key for deterministic selection ("18:00")
 * @param madisonHHMM - Current Madison time for countdown computation
 */
export function buildStaticCountdownSegment(
  cacheKey: string,
  madisonHHMM: string,
): Record<string, unknown> {
  const seed = hashStr(cacheKey);

  // Compute seconds until Purge start (19:00)
  const [hStr, mStr] = madisonHHMM.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const secondsUntilPurge = Math.max(0, (19 - h) * 3600 - m * 60);

  // Shuffle PSAs deterministically for text line selection.
  const psaIndices = Array.from({ length: COUNTDOWN_PSAS.length }, (_, i) => i);
  for (let i = psaIndices.length - 1; i > 0; i--) {
    const j = hashStr(`${cacheKey}::psa::${i}`) % (i + 1);
    [psaIndices[i], psaIndices[j]] = [psaIndices[j], psaIndices[i]];
  }

  if (COUNTDOWN_VIDEOS.length > 0) {
    // Video mode — pick 6-8 videos and pair with PSA text lines.
    const videoCount = Math.min(COUNTDOWN_VIDEOS.length, 6 + (seed % 3)); // 6-8

    // Shuffle-pick videos without replacement.
    const videoIndices = Array.from({ length: COUNTDOWN_VIDEOS.length }, (_, i) => i);
    for (let i = videoIndices.length - 1; i > 0; i--) {
      const j = hashStr(`${cacheKey}::vid::${i}`) % (i + 1);
      [videoIndices[i], videoIndices[j]] = [videoIndices[j], videoIndices[i]];
    }

    const picks = videoIndices.slice(0, videoCount).map((i) => COUNTDOWN_VIDEOS[i]);

    // Build tracks — each video is a "track" with PSA text lines underneath.
    let psaCursor = 0;
    const tracks = picks.map((vid, idx) => {
      // Each track gets 2-3 PSA text lines.
      const lineCount = 2 + (hashStr(`${cacheKey}::lc::${idx}`) % 2);
      const lines = [];

      // First line: category header + video context
      lines.push({
        host: "prge",
        text: idx === 0
          ? `PRGE 420.69 FM — EMERGENCY PREPAREDNESS BROADCAST. ${formatCountdown(secondsUntilPurge)} until Purge commencement. Now showing: ${vid.title}.`
          : `SURVIVAL PSA: ${vid.title}. ${formatCountdown(secondsUntilPurge)} remaining.`,
      });

      // Remaining lines: pulled from shuffled PSA pool
      for (let i = 0; i < lineCount; i++) {
        const psa = COUNTDOWN_PSAS[psaIndices[psaCursor % psaIndices.length]];
        psaCursor++;
        lines.push({
          host: psa.host,
          text: psa.text,
        });
      }

      return {
        title: vid.title,
        artist: vid.channel,
        year: undefined,
        videoId: vid.videoId,
        durationSec: vid.durationSec,
        lines,
      };
    });

    return {
      type: "countdown",
      tracks,
      lines: [
        {
          host: "tim",
          text: `Listen up, Madison. ${formatCountdown(secondsUntilPurge)} until the Purge siren. Everything you're about to see could save your life tonight. Pay attention.`,
        },
      ],
      tickerItems: buildCountdownTicker(secondsUntilPurge, psaIndices, psaCursor),
      secondsUntilPurge,
    };
  }

  // Text-only mode — no videos available. Cycle through PSA text lines.
  const textLineCount = 12;
  const lines = psaIndices.slice(0, textLineCount).map((i, idx) => {
    const psa = COUNTDOWN_PSAS[i];
    const categoryLabel = CATEGORY_LABELS[psa.category] ?? psa.category.toUpperCase();
    return {
      host: psa.host,
      text: idx === 0
        ? `[${categoryLabel}] ${formatCountdown(secondsUntilPurge)} until Purge commencement. ${psa.text}`
        : `[${categoryLabel}] ${psa.text}`,
    };
  });

  return {
    type: "countdown",
    lines,
    tickerItems: buildCountdownTicker(secondsUntilPurge, psaIndices, textLineCount),
    secondsUntilPurge,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────

function formatCountdown(secondsUntilPurge: number): string {
  const h = Math.floor(secondsUntilPurge / 3600);
  const m = Math.floor((secondsUntilPurge % 3600) / 60);
  if (h > 0 && m > 0) return `${h} hour${h > 1 ? "s" : ""} ${m} minute${m > 1 ? "s" : ""}`;
  if (h > 0) return `${h} hour${h > 1 ? "s" : ""}`;
  if (m > 0) return `${m} minute${m > 1 ? "s" : ""}`;
  return "less than 1 minute";
}

function buildCountdownTicker(
  secondsUntilPurge: number,
  psaIndices: number[],
  startCursor: number,
): Array<{ category: string; text: string }> {
  const items: Array<{ category: string; text: string }> = [
    {
      category: "breaking",
      text: `⚠ PURGE COMMENCEMENT IN ${formatCountdown(secondsUntilPurge).toUpperCase()} — ALL CRIME INCLUDING MURDER WILL BE LEGAL FOR 12 HOURS`,
    },
    {
      category: "breaking",
      text: "EMERGENCY SERVICES SUSPENDED AT 19:00 — NO POLICE, FIRE, OR EMS RESPONSE UNTIL 07:00",
    },
    {
      category: "local-news",
      text: "PRGE 420.69 FM — EMERGENCY PREPAREDNESS BROADCAST — SURVIVAL INFORMATION FOR MADISON RESIDENTS",
    },
  ];

  // Add 3-4 PSA-derived ticker items
  for (let i = 0; i < 4; i++) {
    const psa = COUNTDOWN_PSAS[psaIndices[(startCursor + i) % psaIndices.length]];
    const categoryLabel = CATEGORY_LABELS[psa.category] ?? psa.category.toUpperCase();
    items.push({
      category: "ad",
      text: `[${categoryLabel}] ${psa.text.slice(0, 120)}${psa.text.length > 120 ? "…" : ""}`,
    });
  }

  return items;
}
