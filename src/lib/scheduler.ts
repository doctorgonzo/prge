// PRGE — Purge Radio · broadcast scheduler.
//
// The station broadcasts on REAL Madison wall-clock time (America/Chicago,
// DST-aware). The 12-hour Purge-Night broadcast runs 19:00 → 06:59 Madison
// real time. The other 12 hours (07:00 → 18:59 Madison) are DAYTIME MODE:
// unmanned auto-playing music block, frequent commercial breaks, Tim's pre-
// recorded station IDs. "The rig is on but nobody's at the mic."
//
// Module responsibilities:
//   1. Declare the canonical 12-hour Purge schedule (BROADCAST_SCHEDULE).
//   2. Declare the daytime rotation cycle (DAYTIME_ROTATION).
//   3. Resolve a Madison wall-clock "HH:MM" to a current segment slot.
//   4. Compute the next transition for the "NEXT UP" chip.
//
// No `Date` mutation, no I/O. DST handling delegated to Intl.DateTimeFormat —
// never use getTimezoneOffset() or hardcoded offsets, the server box may be
// running anywhere.

import type { HostId, SegmentFormat } from "./types";

export interface ScheduleEntry {
  /** Hour index within the broadcast, 0..11 (0 = sign-on hour). */
  hour: number;
  /** Madison wall-clock start of this hour block, "HH:MM" 24-hour. */
  startInWorldTime: string;
  /** Which format dominates this hour. */
  format: SegmentFormat;
  /** Primary host(s) on mic for this hour. */
  hosts: HostId[];
  /** Nominal duration for the hour block in seconds. */
  durationSec: number;
  /** Human-readable hour title (matches the station-bible focus column). */
  title: string;
}

/**
 * The canonical 12-hour Purge-Night broadcast schedule.
 *
 * Indexing: `hour` is 0..11, corresponding to Madison 19:00, 20:00, ... 06:00.
 * These are REAL Madison wall-clock times — no in-world conversion. A listener
 * tuning in at 23:15 Madison is hearing hour 4 (Marigold's wellness block).
 *
 * NOTE: `startInWorldTime` is kept as the field name for backwards-compatible
 * cache keys and existing callers, but its meaning is now "Madison wall-clock
 * HH:MM" not "in-world HH:MM." There is no longer any distinction.
 */
export const BROADCAST_SCHEDULE: readonly ScheduleEntry[] = [
  {
    hour: 0,
    startInWorldTime: "19:00",
    format: "news",
    hosts: ["quinn", "caroline", "holden", "tim"],
    durationSec: 3600,
    title: "Sign-on / Opening News",
  },
  {
    hour: 1,
    startInWorldTime: "20:00",
    format: "mixed",
    hosts: ["caroline", "holden"],
    durationSec: 3600,
    title: "The Caroline + Holden Hour",
  },
  {
    hour: 2,
    startInWorldTime: "21:00",
    format: "late-night-talk",
    hosts: ["quinn"],
    durationSec: 3600,
    title: "Solo Late-Night Talk",
  },
  {
    hour: 3,
    startInWorldTime: "22:00",
    format: "field-report",
    hosts: ["tucker"],
    durationSec: 3600,
    title: "Field Hour (analytics + cut-off)",
  },
  {
    hour: 4,
    startInWorldTime: "23:00",
    format: "wellness",
    hosts: ["marigold"],
    durationSec: 3600,
    title: "Wellness Block (script drifts)",
  },
  {
    hour: 5,
    startInWorldTime: "00:00",
    format: "music-block",
    hosts: ["nick"],
    durationSec: 3600,
    title: "Music Block (early, cocky)",
  },
  {
    hour: 6,
    startInWorldTime: "01:00",
    format: "mixed",
    hosts: ["quinn", "caroline", "holden"],
    durationSec: 3600,
    title: "Mixed cut-ins",
  },
  {
    hour: 7,
    startInWorldTime: "02:00",
    format: "field-report",
    hosts: ["tucker", "holden"],
    durationSec: 3600,
    title: "Numbers / Methodology",
  },
  {
    hour: 8,
    startInWorldTime: "03:00",
    format: "wellness",
    hosts: ["marigold"],
    durationSec: 3600,
    title: "Marigold Returns (glossolalia)",
  },
  {
    hour: 9,
    startInWorldTime: "04:00",
    format: "music-block",
    hosts: ["nick"],
    durationSec: 3600,
    title: "Collapse Hour",
  },
  {
    hour: 10,
    startInWorldTime: "05:00",
    format: "late-night-talk",
    hosts: ["quinn"],
    durationSec: 3600,
    title: "Pre-dawn / Survivor Calls",
  },
  {
    hour: 11,
    startInWorldTime: "06:00",
    format: "sign-off",
    hosts: ["quinn", "tucker", "marigold", "nick", "tim", "holden", "caroline"],
    durationSec: 3600,
    title: "Final Hour / Sunrise",
  },
] as const;

// ---------------------------------------------------------------------------
// Daytime rotation (07:00 — 18:59 Madison)
// ---------------------------------------------------------------------------
//
// Daytime is the 12 hours OFF the Purge broadcast. The rig is up but
// unstaffed — what plays is a deterministic loop of:
//
//   17min music-block (Phase A only — track picking, no host patter)
//   2min  commercial-break (real LLM-generated ads, cached as usual)
//   30sec station-id (hand-written Tim bumper, NOT LLM-generated)
//
// Total cycle: 19.5min. Runs ~37x across 12 daytime hours.
//
// Slot resolution: minutes-since-07:00 → slot offset in seconds → which slot
// of the cycle. Deterministic so the same Madison minute always resolves to
// the same slot (a listener reloading inside a slot stays in the slot).

interface DaytimeSlot {
  format: SegmentFormat;
  hosts: HostId[];
  /** Seconds offset into the cycle where this slot begins. */
  startSec: number;
  /** Slot duration in seconds. */
  durationSec: number;
  /** Display title for the slot. */
  title: string;
}

const DAYTIME_MUSIC_SEC = 10 * 60; // 10min → ~5 music blocks per hour (was 17)
const DAYTIME_COMMERCIAL_SEC = 2 * 60;
const DAYTIME_STATION_ID_SEC = 30;

export const DAYTIME_ROTATION: readonly DaytimeSlot[] = [
  {
    format: "music-block",
    hosts: ["nick"],
    startSec: 0,
    durationSec: DAYTIME_MUSIC_SEC,
    title: "Unmanned Autoplay",
  },
  {
    format: "commercial-break",
    hosts: [],
    startSec: DAYTIME_MUSIC_SEC,
    durationSec: DAYTIME_COMMERCIAL_SEC,
    title: "Daytime Spots",
  },
  {
    format: "station-id",
    hosts: ["tim"],
    startSec: DAYTIME_MUSIC_SEC + DAYTIME_COMMERCIAL_SEC,
    durationSec: DAYTIME_STATION_ID_SEC,
    title: "Pep ID",
  },
] as const;

const DAYTIME_CYCLE_SEC =
  DAYTIME_MUSIC_SEC + DAYTIME_COMMERCIAL_SEC + DAYTIME_STATION_ID_SEC; // 750s = 12m30s (~5/hr)

// ---------------------------------------------------------------------------
// Madison time
// ---------------------------------------------------------------------------

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

// Cached formatter — Intl.DateTimeFormat construction is non-trivial and we
// hit this on every poll. America/Chicago handles DST automatically (CST/CDT).
const MADISON_TZ_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/**
 * Get Madison wall-clock time as "HH:MM" (24-hour). DST-aware via
 * Intl.DateTimeFormat. Default to `new Date()` so callers can pass a fixed
 * Date for tests.
 *
 * Returns 24-hour HH:MM. Intl's en-US locale renders midnight as "24:XX" in
 * some engine versions — we normalize that to "00:XX" defensively.
 */
export function madisonNowHHMM(date: Date = new Date()): string {
  const parts = MADISON_TZ_FORMATTER.formatToParts(date);
  let hh = "00";
  let mm = "00";
  for (const p of parts) {
    if (p.type === "hour") hh = p.value;
    else if (p.type === "minute") mm = p.value;
  }
  // Node's en-US locale historically emits "24" for midnight; normalize.
  if (hh === "24") hh = "00";
  return `${hh}:${mm}`;
}

/** Parse "HH:MM" → seconds-since-00:00. */
function hhmmToSecondsOfDay(hhmm: string): number {
  const [hStr, mStr] = hhmm.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  return h * 3600 + m * 60;
}

/** Render seconds-since-00:00 as "HH:MM". */
function secondsOfDayToHHMM(sec: number): string {
  const total = ((sec % 86_400) + 86_400) % 86_400;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return `${pad2(h)}:${pad2(m)}`;
}

// ---------------------------------------------------------------------------
// Purge-window arithmetic
// ---------------------------------------------------------------------------
//
// The Purge broadcast runs 19:00 (today) → 06:59 (next day) Madison.
// In seconds-of-day terms that's [19:00, 24:00) ∪ [00:00, 07:00).
// Daytime is [07:00, 19:00).

const PURGE_START_SEC = 19 * 3600; // 68400 — 19:00
const PURGE_END_SEC = 7 * 3600; // 25200 — 07:00 (next day, in next-day seconds-of-day)
const DAYTIME_START_SEC = PURGE_END_SEC; // 25200 — 07:00. Daytime window is
// [DAYTIME_START_SEC, PURGE_START_SEC) — i.e. 07:00 (inclusive) to 19:00
// (exclusive). The implicit upper bound is PURGE_START_SEC so we don't
// duplicate the constant.

/** True if the given seconds-of-day falls in the Purge broadcast window. */
function isPurgeWindow(secondsOfDay: number): boolean {
  return secondsOfDay >= PURGE_START_SEC || secondsOfDay < PURGE_END_SEC;
}

/** Parse "HH:MM" → seconds-since-19:00 within the broadcast loop.
 *  Hours 19..23 stay where they are; hours 00..06 are treated as +24h. */
function purgeHHMMToBroadcastSec(hhmm: string): number {
  const [hStr, mStr] = hhmm.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  const absHour = h >= 19 ? h : h + 24; // 0..6 → 24..30
  return (absHour - 19) * 3600 + m * 60;
}

// ---------------------------------------------------------------------------
// Current-segment resolution
// ---------------------------------------------------------------------------

export interface CurrentSegmentInfo {
  format: SegmentFormat;
  /** Current Madison wall-clock "HH:MM" 24-hour — the REAL minute for content
   *  generation (so the model says "it's 21:47" not "it's 21:00"). */
  inWorldTime: string;
  /** Stable cache key — the START of the current slot ("21:00" for the whole
   *  hour, or the daytime cycle-slot start). Callers use this for disk cache
   *  lookup so that every minute within a slot hits the same cached segment
   *  instead of triggering a fresh Anthropic call. */
  cacheKey: string;
  hosts: HostId[];
  durationSec: number;
  title: string;
  /** True when we're in the unmanned daytime block (07:00–18:59 Madison). */
  daytime: boolean;
}

/**
 * Resolve the schedule slot owning the given Madison wall-clock moment.
 *
 * - If Madison time is in the Purge window [19:00, 06:59], pick the matching
 *   BROADCAST_SCHEDULE entry.
 * - Otherwise we're in daytime. Compute the rotation offset (minutes since
 *   07:00 → second offset → slot in DAYTIME_ROTATION). Returns the matching
 *   daytime slot with `daytime: true` so downstream code (generator, prompt
 *   context) can branch on it.
 */
export function getCurrentSegmentFormat(
  date: Date = new Date(),
): CurrentSegmentInfo {
  const madisonTime = madisonNowHHMM(date);
  return resolveSegmentForMadisonHHMM(madisonTime);
}

/**
 * Pure resolver — same logic as `getCurrentSegmentFormat` but takes the
 * Madison HH:MM directly. Used by the API route's `?at=` dev override and
 * by `getSegmentAtInWorldTime` (kept for callers that still use the old name).
 */
function resolveSegmentForMadisonHHMM(
  madisonHHMM: string,
): CurrentSegmentInfo {
  const secondsOfDay = hhmmToSecondsOfDay(madisonHHMM);

  if (isPurgeWindow(secondsOfDay)) {
    // Purge window. Find the BROADCAST_SCHEDULE entry containing this minute.
    const broadcastSec = purgeHHMMToBroadcastSec(madisonHHMM);
    let entry: ScheduleEntry = BROADCAST_SCHEDULE[0];
    for (const candidate of BROADCAST_SCHEDULE) {
      const candidateSec = purgeHHMMToBroadcastSec(candidate.startInWorldTime);
      if (candidateSec <= broadcastSec) {
        entry = candidate;
      } else {
        break;
      }
    }
    return {
      format: entry.format,
      inWorldTime: madisonHHMM,           // real minute for content generation
      cacheKey: entry.startInWorldTime,    // hour start for disk cache
      hosts: [...entry.hosts],
      durationSec: entry.durationSec,
      title: entry.title,
      daytime: false,
    };
  }

  // Daytime window. Map seconds-since-07:00 → cycle position → slot.
  const daytimeOffsetSec = secondsOfDay - DAYTIME_START_SEC; // 0..43199
  const cycleOffsetSec = daytimeOffsetSec % DAYTIME_CYCLE_SEC;

  // Walk the rotation for the slot containing cycleOffsetSec. Linear scan is
  // fine — three slots.
  let slot: DaytimeSlot = DAYTIME_ROTATION[0];
  for (const candidate of DAYTIME_ROTATION) {
    if (candidate.startSec <= cycleOffsetSec) slot = candidate;
    else break;
  }

  // Cache key: start of THIS cycle slot's absolute position in the day.
  const cycleNumber = Math.floor(daytimeOffsetSec / DAYTIME_CYCLE_SEC);
  const slotStartSec = DAYTIME_START_SEC + cycleNumber * DAYTIME_CYCLE_SEC + slot.startSec;
  const slotStartHHMM = secondsOfDayToHHMM(slotStartSec);

  return {
    format: slot.format,
    inWorldTime: madisonHHMM,       // real minute for content generation
    cacheKey: slotStartHHMM,        // cycle-slot start for disk cache
    hosts: [...slot.hosts],
    durationSec: slot.durationSec,
    title: slot.title,
    daytime: true,
  };
}

export interface BroadcastPosition {
  /** 0..11 — which Purge-hour block contains this Madison time.
   *  -1 when in daytime (no hour-block applies). */
  hourIndex: number;
  /** Always 12. */
  totalHours: number;
  /** The Purge schedule entry currently on air, or null in daytime. */
  currentEntry: ScheduleEntry | null;
  /** Purge schedule entries that have fully ended before now.
   *  - In Purge window: prior entries this broadcast.
   *  - In morning daytime (07:00–18:59): ALL 12 entries from last night.
   *  - Edge case at exact 07:00: empty (broadcast just signed off — last hour
   *    counts as aired). */
  airedEntries: ScheduleEntry[];
  /** True when we're in the unmanned daytime block. */
  daytime: boolean;
}

/**
 * Locate a Madison wall-clock time inside the schedule. The model still needs
 * "what's aired so far tonight" context during the Purge window — that drives
 * station-bible constraint #7 (no referencing un-aired hours).
 *
 * For daytime calls, this returns hourIndex=-1, currentEntry=null,
 * airedEntries=[entire BROADCAST_SCHEDULE]. The daytime music-block path
 * skips the prompt entirely (Phase A only), so the empty/full distinction
 * never actually surfaces to the model — but callers can still introspect.
 */
export function getBroadcastPosition(madisonHHMM: string): BroadcastPosition {
  const secondsOfDay = hhmmToSecondsOfDay(madisonHHMM);

  if (!isPurgeWindow(secondsOfDay)) {
    // Daytime — broadcast is OVER (audience already heard it last night).
    return {
      hourIndex: -1,
      totalHours: BROADCAST_SCHEDULE.length,
      currentEntry: null,
      airedEntries: BROADCAST_SCHEDULE.map((e) => ({
        ...e,
        hosts: [...e.hosts],
      })),
      daytime: true,
    };
  }

  const broadcastSec = purgeHHMMToBroadcastSec(madisonHHMM);
  let currentEntry: ScheduleEntry = BROADCAST_SCHEDULE[0];
  let currentIndex = 0;
  for (let i = 0; i < BROADCAST_SCHEDULE.length; i++) {
    const candidate = BROADCAST_SCHEDULE[i];
    const candidateSec = purgeHHMMToBroadcastSec(candidate.startInWorldTime);
    if (candidateSec <= broadcastSec) {
      currentEntry = candidate;
      currentIndex = i;
    } else {
      break;
    }
  }

  return {
    hourIndex: currentIndex,
    totalHours: BROADCAST_SCHEDULE.length,
    currentEntry,
    airedEntries: BROADCAST_SCHEDULE.slice(0, currentIndex).map((e) => ({
      ...e,
      hosts: [...e.hosts],
    })),
    daytime: false,
  };
}

// ---------------------------------------------------------------------------
// Next-transition computation
// ---------------------------------------------------------------------------

export interface NextSegmentInfo {
  /** Real-world seconds until the Madison clock crosses into nextEntry. */
  realSecondsUntil: number;
  /** The schedule entry that begins at the next transition. */
  nextEntry: ScheduleEntry;
}

/**
 * Compute the next Purge-schedule transition relative to `date`.
 *
 * - In the Purge window: returns the upcoming hour boundary within
 *   BROADCAST_SCHEDULE. Returns null on the final sign-off hour (06:00–06:59)
 *   since there's no "next" Purge entry that day.
 * - In daytime: returns the upcoming 19:00 sign-on entry, with realSecondsUntil
 *   counted from now to today's 19:00 Madison (or tomorrow's if we're already
 *   past 19:00, which shouldn't happen given the window split).
 *
 * Times are REAL seconds — no conversion factor.
 */
export function getNextSegmentTransition(
  date: Date = new Date(),
): NextSegmentInfo | null {
  const madisonHHMM = madisonNowHHMM(date);
  const secondsOfDay = hhmmToSecondsOfDay(madisonHHMM);

  if (!isPurgeWindow(secondsOfDay)) {
    // Daytime — next transition is the 19:00 sign-on.
    const nextEntry = BROADCAST_SCHEDULE[0];
    const realSecondsUntil = PURGE_START_SEC - secondsOfDay;
    return { realSecondsUntil, nextEntry };
  }

  // Purge window — find the next entry whose start is strictly greater than
  // current broadcastSec. Final hour (06:00) has no next entry; return null
  // for the chip to suppress itself.
  const broadcastSec = purgeHHMMToBroadcastSec(madisonHHMM);
  let nextEntry: ScheduleEntry | null = null;
  for (const candidate of BROADCAST_SCHEDULE) {
    const candidateSec = purgeHHMMToBroadcastSec(candidate.startInWorldTime);
    if (candidateSec > broadcastSec) {
      nextEntry = candidate;
      break;
    }
  }
  if (!nextEntry) return null;

  const nextSec = purgeHHMMToBroadcastSec(nextEntry.startInWorldTime);
  const realSecondsUntil = nextSec - broadcastSec;
  return { realSecondsUntil, nextEntry };
}

// ---------------------------------------------------------------------------
// Time-travel resolver (API ?at= path)
// ---------------------------------------------------------------------------

/**
 * Resolve the slot owning a given Madison "HH:MM". This is the public form
 * of the internal resolver used by the API route's dev `?at=` override.
 *
 * Returns the standard CurrentSegmentInfo plus a synthetic ScheduleEntry-like
 * shape with `startInWorldTime` set to a sensible value (the canonical hour
 * boundary in Purge mode, or the slot start in daytime). This keeps the
 * API route's existing cache-key flow working.
 *
 * Throws on malformed input. Unlike the old version this never throws "outside
 * window" — every minute of the day resolves to a slot now.
 */
export function getSegmentAtInWorldTime(
  madisonHHMM: string,
): ScheduleEntry & { inWorldTime: string; daytime: boolean } {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(madisonHHMM)) {
    throw new Error(
      `Invalid time '${madisonHHMM}', expected HH:MM (24-hour)`,
    );
  }

  const info = resolveSegmentForMadisonHHMM(madisonHHMM);

  if (!info.daytime) {
    // Purge window — find the actual schedule entry so callers can read
    // its canonical startInWorldTime field for cache keys, etc.
    const broadcastSec = purgeHHMMToBroadcastSec(madisonHHMM);
    let entry: ScheduleEntry = BROADCAST_SCHEDULE[0];
    let entryHour = 0;
    for (let i = 0; i < BROADCAST_SCHEDULE.length; i++) {
      const candidate = BROADCAST_SCHEDULE[i];
      const candidateSec = purgeHHMMToBroadcastSec(candidate.startInWorldTime);
      if (candidateSec <= broadcastSec) {
        entry = candidate;
        entryHour = i;
      } else {
        break;
      }
    }
    return {
      hour: entryHour,
      startInWorldTime: entry.startInWorldTime,
      format: entry.format,
      hosts: [...entry.hosts],
      durationSec: entry.durationSec,
      title: entry.title,
      inWorldTime: madisonHHMM,
      daytime: false,
    };
  }

  // Daytime — synthesize a ScheduleEntry from the rotation slot. Use the
  // slot's start-of-cycle Madison time so cache keys are stable per slot
  // (a 17-min music slot collapses to a single cache key regardless of
  // when in the slot the listener tunes in).
  const secondsOfDay = hhmmToSecondsOfDay(madisonHHMM);
  const daytimeOffsetSec = secondsOfDay - DAYTIME_START_SEC;
  const cycleNum = Math.floor(daytimeOffsetSec / DAYTIME_CYCLE_SEC);
  const cycleStartOffset = cycleNum * DAYTIME_CYCLE_SEC;
  const cycleOffsetSec = daytimeOffsetSec - cycleStartOffset;

  let slot: DaytimeSlot = DAYTIME_ROTATION[0];
  for (const candidate of DAYTIME_ROTATION) {
    if (candidate.startSec <= cycleOffsetSec) slot = candidate;
    else break;
  }

  const slotStartSecondsOfDay =
    DAYTIME_START_SEC + cycleStartOffset + slot.startSec;
  const slotStartHHMM = secondsOfDayToHHMM(slotStartSecondsOfDay);

  return {
    hour: -1,
    startInWorldTime: slotStartHHMM,
    format: slot.format,
    hosts: [...slot.hosts],
    durationSec: slot.durationSec,
    title: slot.title,
    inWorldTime: madisonHHMM,   // real minute, not slot start
    daytime: true,
  };
}
