// Shared type definitions for player UI. Kept here (not in /lib/types) because
// these are the player's *view* shape — looser than the wire schema, and not
// referenced by the generator/scheduler.
export interface PlayerLine {
  host: string;
  text: string;
}

export interface PlayerTickerItem {
  category: string;
  text: string;
}

export interface PlayerTrack {
  title: string;
  artist: string;
  year?: number;
  /** Music-block: per-track host lines (intro + facts). Optional so legacy
   *  cached segments without per-track lines still satisfy the type. The
   *  layout falls back to top-level `segment.lines` when this is missing. */
  lines?: PlayerLine[];
  /** Pre-resolved YouTube video ID. When present, MusicBlockLayout skips
   *  the /api/track resolution step and embeds this video directly. Used by
   *  countdown PSA videos where the videoId is baked into the segment. */
  videoId?: string;
  /** Pre-known duration in seconds. Paired with videoId for pre-resolved
   *  tracks so the player can set the correct advance timer without waiting
   *  for an API round-trip. */
  durationSec?: number;
}

export interface PlayerAd {
  brand: string;
  tagline: string;
  body?: string;
}

/** A Nick Trulino cut-in — he breaks in during someone else's segment to
 *  force a song on air. The frontend schedules these at intervals throughout
 *  the segment and temporarily swaps to MusicBlockLayout. */
export interface NickCutIn {
  introLines: PlayerLine[];
  track: PlayerTrack;
}

export interface PlayerSegment {
  type: string;
  inWorldTime?: string;
  segmentTitle?: string;
  lines: PlayerLine[];
  tickerItems: PlayerTickerItem[];
  // Format-specific optional fields. The API/generator only emits these for
  // the relevant `type`, but we type them loosely here so any layout can read
  // them defensively without casting.
  tracks?: PlayerTrack[];
  ads?: PlayerAd[];
  /** Nick's random song interruptions. 0-4 per hour depending on how drunk
   *  he is. The frontend schedules them at staggered delays. */
  nickCutIns?: NickCutIn[];
}

export const HOST_LABEL: Record<string, string> = {
  quinn: "QUINN FOLEY",
  caroline: "CAROLINE",
  holden: "HOLDEN",
  tim: "TIM PEPLINSKI",
  tucker: "TUCKER TRAYWICK",
  marigold: "SISTER MARIGOLD VANCE",
  nick: "NICK TRULINO",
  prge: "PRGE AUTOPLAY",
};

export const CATEGORY_LABEL: Record<string, string> = {
  "kill-count": "STATS",
  neighborhood: "AREA",
  ad: "SPONSOR",
  emergency: "ALERT",
  "caller-text-in": "CALLER",
  "local-news": "LOCAL",
  "marigold-quote": "MARIGOLD",
  breaking: "BREAKING",
  weather: "WEATHER",
};

// Per-line read time scales with character count so longer lines hang on screen
// longer. Floor for short punchy lines, ceiling so an unusually long line doesn't
// stall the cycle. ~150 wpm reading speed → ~50ms per character + 3s buffer.
export function readDurationMs(text: string): number {
  return Math.max(5000, Math.min(20000, 3000 + text.length * 50));
}

// Wellness gets longer dwell time — the segment is supposed to feel slow.
export function wellnessReadDurationMs(text: string): number {
  return Math.max(8000, Math.min(24000, 5000 + text.length * 60));
}
