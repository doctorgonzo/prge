// src/lib/tim-bumpers.ts
// Hand-written Tim Peplinski station IDs for the daytime (07:00–18:59 Madison)
// rotation. NEVER pass these through the LLM — they're the "rig is on, mic is
// off" bumpers and the whole point is they're prerecorded.
//
// Tim's voice per the bible: tall, husky, can-do attitude, steady Midwest
// baritone, no embellishment. He's the station's spine. He says "Goodnight
// Madison" without irony. He references PRGE returning at 19:00 because that's
// the next time anyone speaks live on the air.
//
// Selection: deterministic. The daytime station-id slot index is hashed with
// the Madison date so the same (date, slot) pair always returns the same
// bumper. Listeners hear variety across the day; reloading inside a slot
// keeps the same bumper.

import type { PlayerLine, PlayerTickerItem } from "@/components/player-types";

export interface TimBumper {
  /** Host lines — always Tim, kept as an array so the segment shape matches
   *  the regular station-id payload. */
  lines: PlayerLine[];
  /** 0–1 ticker items per bumper. Keep them quiet — daytime ticker is sparse. */
  tickerItems: PlayerTickerItem[];
}

/** The bumper rotation. Tim's register only. No clever twists. */
export const TIM_BUMPERS: readonly TimBumper[] = [
  {
    lines: [
      { host: "tim", text: "This is PRGE. We return at seven. Stay home." },
    ],
    tickerItems: [],
  },
  {
    lines: [
      { host: "tim", text: "Pep here. Rig's on, mic's off. PRGE comes back at sundown." },
    ],
    tickerItems: [
      { category: "local-news", text: "PRGE returns at 19:00 — broadcast resumes Purge Night sign-on" },
    ],
  },
  {
    lines: [
      { host: "tim", text: "Madison — broadcast resumes at nineteen-hundred. Take care of each other." },
    ],
    tickerItems: [],
  },
  {
    lines: [
      { host: "tim", text: "If you're hearing this, you're tuned to PRGE. Nobody at the desk. Music's on shuffle. Doors locked, lights low. We come back tonight." },
    ],
    tickerItems: [],
  },
  {
    lines: [
      { host: "tim", text: "Tim Peplinski. Quick note — we're on automation until nineteen-hundred. Be kind to the daytime hours. They don't last." },
    ],
    tickerItems: [],
  },
  {
    lines: [
      { host: "tim", text: "PRGE. Daytime feed. Real broadcast at seven tonight. Walk the dog while you can." },
    ],
    tickerItems: [],
  },
  {
    lines: [
      { host: "tim", text: "This is the operator. The rig is warm, the mic is cold. We're back when the sun is gone." },
    ],
    tickerItems: [],
  },
  {
    lines: [
      { host: "tim", text: "Madison — Pep here. Nothing live until nineteen-hundred. Use the daylight. Stock the basement. Charge what charges." },
    ],
    tickerItems: [
      { category: "local-news", text: "Daytime checklist — fresh batteries, refilled water, doors tested" },
    ],
  },
  {
    lines: [
      { host: "tim", text: "PRGE is on the air. Nobody is. That's a difference worth noticing. Live broadcast resumes at seven." },
    ],
    tickerItems: [],
  },
  {
    lines: [
      { host: "tim", text: "Quinn's asleep. Caroline's at the co-op. Holden's on the lake. Tucker's doing whatever Tucker does. Marigold is wherever Marigold goes. Nick is hungover. Real broadcast at seven. Pep out." },
    ],
    tickerItems: [],
  },
  {
    lines: [
      { host: "tim", text: "Pep here. If you need the station, the station is here. If you need a voice — sit tight. Voice comes back at sundown." },
    ],
    tickerItems: [],
  },
  {
    lines: [
      { host: "tim", text: "This is PRGE. Daytime hours. Music until the Purge. Goodnight Madison." },
    ],
    tickerItems: [],
  },
  {
    lines: [
      { host: "tim", text: "Tim Peplinski. The signal's stable. The studio's empty. The night's coming. Same as always." },
    ],
    tickerItems: [],
  },
  {
    lines: [
      { host: "tim", text: "PRGE. We broadcast one night a year. You're hearing the wait. Use it. Live mic at seven." },
    ],
    tickerItems: [],
  },
  {
    lines: [
      { host: "tim", text: "Operator's note — automation only until nineteen-hundred Madison time. If the rig drops out, give it a minute. It comes back. It always comes back." },
    ],
    tickerItems: [],
  },
] as const;

/**
 * Pick the bumper for a (date, slot) pair. Deterministic — same input always
 * returns the same bumper. Date is the Madison YYYY-MM-DD string; slotIndex
 * is the cycle index within that day so multiple slots on the same day spread
 * across the rotation instead of repeating.
 *
 * Algorithm: simple string-hash → modulo. Doesn't need to be cryptographic;
 * just needs to be stable and reasonably uniform across slot indices.
 */
export function pickTimBumper(
  madisonDate: string,
  slotIndex: number,
): TimBumper {
  const seed = `${madisonDate}__${slotIndex}`;
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  const idx = ((h % TIM_BUMPERS.length) + TIM_BUMPERS.length) % TIM_BUMPERS.length;
  return TIM_BUMPERS[idx];
}
