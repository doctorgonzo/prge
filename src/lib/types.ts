// PRGE — Purge Radio · core type definitions.
// These shapes are referenced by the scheduler, generator, content cache, and player.

export type HostId =
  | "quinn"
  | "tucker"
  | "marigold"
  | "nick"
  | "tim"
  | "holden"
  | "caroline";

/**
 * The distinct content formats that can play. Each format maps to a per-format
 * writer prompt in src/lib/prompts/format-*.md and a visual treatment in the player.
 */
export type SegmentFormat =
  | "sign-on"
  | "news"
  | "weather"
  | "sports"
  | "late-night-talk"
  | "field-report"
  | "wellness"
  | "music-block"
  | "mixed"
  | "commercial-break"
  | "station-id"
  | "operator-cutin"
  | "sign-off";

export interface Segment {
  /** Unique id within a broadcast (e.g. "hour-3-segment-2"). */
  id: string;
  /** Format determines which writer prompt produces the content. */
  format: SegmentFormat;
  /** Wall-clock time within the in-world broadcast, "HH:MM" 24-hour. */
  startTime: string;
  /** Duration in seconds. */
  durationSec: number;
  /** Primary host(s) on mic for this segment. */
  hosts: HostId[];
  /** The generated content body (markdown / plain text). */
  body: string;
  /** Optional structured metadata for the player (newsticker triggers, ad cards, etc.). */
  meta?: Record<string, unknown>;
}

export interface NewstickerItem {
  id: string;
  text: string;
  category:
    | "kill-count"
    | "neighborhood"
    | "ad"
    | "emergency"
    | "caller-text-in"
    | "local-news"
    | "marigold-quote";
  /** ms offset from broadcast start when this item begins scrolling. */
  showAtOffsetMs: number;
  /** How long it stays in the rotation (ms). */
  durationMs: number;
}

export interface Broadcast {
  /** Year-stamp the broadcast represents (e.g., "2169"). */
  year: string;
  /** Ordered segments comprising the 12-hour broadcast. */
  segments: Segment[];
  /** Ambient newsticker items scheduled independently of segments. */
  ticker: NewstickerItem[];
  meta: {
    generatedAt: string;
    modelId: string;
  };
}
