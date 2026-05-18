// src/lib/track-resolver.ts
// Resolve a { artist, title } pair to an actual YouTube videoId.
//
// Two-tier strategy:
//   1. PRIMARY — YouTube Data API v3 `search.list` when YOUTUBE_API_KEY is set.
//      The API supports `videoEmbeddable=true`, which pre-filters out label-
//      blocked uploads at the source. The scraper can't do this and
//      occasionally hands back a videoId whose iframe renders "video
//      unavailable." Bulletproof when the key works.
//   2. FALLBACK — `yt-search` HTML scraper, the original key-free path. Used
//      when no key is configured, when the API errors (quota, 4xx, network),
//      or when the API returns zero hits. Trusts the first video result and
//      optimistically marks `embeddable: true` (no way to know without an
//      oEmbed probe).
//
// Disk cache:
//   Both paths feed the same JSON blob at `.prge/track-resolutions.json`. A
//   resolved videoId doesn't change based on which path found it, so the
//   cache makes no API-vs-scraper distinction. The `source` field on the
//   stored record is a breadcrumb for ops, not a lookup discriminator.
//
// To wipe and re-resolve: rm .prge/track-resolutions.json
//   or delete a single entry: jq 'del(.["artist::title"])' …

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { PRGE_STATE_DIR } from "./state-dir";
// yt-search is loaded lazily (see loadYtsModule below). Eager-importing it
// at module load broke the Vercel serverless build — yt-search dynamically
// requires cheerio + a chain of transitive deps (domutils, etc.) that
// Turbopack's tracing doesn't follow. Lazy-loading inside the scraper path
// means the route can boot even when yt-search is partially broken; the
// YouTube Data API primary path handles everything when the key is set.

const CACHE_FILE = join(PRGE_STATE_DIR, "track-resolutions.json");

/**
 * Which path resolved this track. Purely informational — included in the
 * cache and surfaced via the route for ops visibility. Old cache entries
 * written before this field existed will read back as `undefined`; callers
 * that care can default to `"scraper"` (the pre-upgrade behavior).
 */
export type ResolutionSource = "api" | "scraper";

export interface ResolvedTrack {
  videoId: string;
  /**
   * Whether the video is known to be embeddable.
   *   - API path: guaranteed `true` (we query with `videoEmbeddable=true`).
   *   - Scraper path: optimistically `true` — yt-search doesn't expose this
   *     and we have no cheap way to verify per result.
   */
  embeddable: boolean;
  resolvedTitle: string;
  resolvedChannel: string;
  /** ISO timestamp when this resolution was performed. */
  resolvedAt: string;
  /** Which lookup path produced this record. */
  source: ResolutionSource;
  /**
   * Total track duration in seconds, or null when unknown.
   *   - API path: parsed from `contentDetails.duration` (ISO 8601 PT#H#M#S).
   *   - Scraper path: pulled from yt-search's `duration.seconds` (or parsed
   *     from `duration.timestamp` like "2:30").
   *   - Legacy cache entries pre-dating this field deserialize as `undefined`;
   *     callers must treat `undefined` and `null` identically (i.e. unknown).
   */
  durationSec?: number | null;
}

/** Build the cache key. Lowercased to defang minor case drift across calls. */
function cacheKey(artist: string, title: string): string {
  return `${artist.trim().toLowerCase()}::${title.trim().toLowerCase()}`;
}

type CacheBlob = Record<string, ResolvedTrack>;

/**
 * Read the entire cache file. We do a single-file blob (not one file per
 * resolution) because the file is small and write-rare, and a single JSON
 * blob is easier to inspect by hand.
 */
async function readCacheBlob(): Promise<CacheBlob> {
  try {
    const text = await readFile(CACHE_FILE, "utf-8");
    const parsed = JSON.parse(text);
    if (parsed !== null && typeof parsed === "object") {
      return parsed as CacheBlob;
    }
    return {};
  } catch {
    return {};
  }
}

async function writeCacheBlob(blob: CacheBlob): Promise<void> {
  await mkdir(dirname(CACHE_FILE), { recursive: true });
  await writeFile(CACHE_FILE, JSON.stringify(blob, null, 2), "utf-8");
}

export async function readCachedResolution(
  artist: string,
  title: string,
): Promise<ResolvedTrack | null> {
  const blob = await readCacheBlob();
  const hit = blob[cacheKey(artist, title)];
  return hit ?? null;
}

export async function writeCachedResolution(
  artist: string,
  title: string,
  resolved: ResolvedTrack,
): Promise<void> {
  const blob = await readCacheBlob();
  blob[cacheKey(artist, title)] = resolved;
  await writeCacheBlob(blob);
}

// ─── Data API v3 path ──────────────────────────────────────────────────────

/**
 * Narrow types for the subset of the YouTube Data API search.list response
 * we actually read. Anything missing/unexpected is treated as absent and
 * gracefully skipped — we never trust the shape blindly.
 *
 * See: https://developers.google.com/youtube/v3/docs/search/list
 */
interface YtApiSearchItem {
  id?: { kind?: string; videoId?: string };
  snippet?: { title?: string; channelTitle?: string };
}

interface YtApiSearchResponse {
  items?: YtApiSearchItem[];
}

/** Subset of the videos.list response we read (contentDetails part only). */
interface YtApiVideosItem {
  contentDetails?: { duration?: string };
}

interface YtApiVideosResponse {
  items?: YtApiVideosItem[];
}

/**
 * Parse an ISO 8601 duration string (the form YouTube returns) into total
 * seconds. Handles missing components: PT1H, PT45S, PT2M30S, PT1H2M3S all
 * work; "P0D" / "PT0S" / nonsense input returns null.
 *
 * YouTube only emits the time portion (PT...) — no years/months/days — so we
 * deliberately don't implement the date side of the standard. If a value
 * arrives without the leading "PT" we treat it as malformed and bail.
 *
 * Examples:
 *   "PT2M30S" → 150
 *   "PT45S"   → 45
 *   "PT1H"    → 3600
 *   "PT1H2M3S" → 3723
 *   "PT0S"    → 0          (valid but unusable; caller may want to ignore)
 *   "garbage" → null
 */
export function isoDurationToSeconds(iso: string): number | null {
  if (typeof iso !== "string") return null;
  // Anchor on PT — the time-portion sentinel. YouTube never emits the date
  // portion, and we don't want to half-parse e.g. "P1D" into 0.
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso.trim());
  if (!match) return null;
  const [, h, m, s] = match;
  // At least one component must be present — bare "PT" is malformed.
  if (h === undefined && m === undefined && s === undefined) return null;
  const hours = h ? Number.parseInt(h, 10) : 0;
  const mins = m ? Number.parseInt(m, 10) : 0;
  const secs = s ? Number.parseInt(s, 10) : 0;
  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(mins) ||
    !Number.isFinite(secs)
  ) {
    return null;
  }
  return hours * 3600 + mins * 60 + secs;
}

/**
 * Second-step Data API call: given a videoId, fetch its `contentDetails`
 * and pull the ISO 8601 duration out. Returns null on any failure so the
 * caller can persist `durationSec: null` (still a valid record; the iframe
 * just falls back to the default dwell).
 */
async function fetchDurationSecViaApi(
  videoId: string,
  apiKey: string,
): Promise<number | null> {
  const params = new URLSearchParams({
    part: "contentDetails",
    id: videoId,
    key: apiKey,
  });
  const endpoint = `https://www.googleapis.com/youtube/v3/videos?${params.toString()}`;

  let response: Response;
  try {
    response = await fetch(endpoint);
  } catch (err) {
    console.error("[track-resolver] videos.list network error:", err);
    return null;
  }

  if (!response.ok) {
    let bodyPreview = "";
    try {
      bodyPreview = (await response.text()).slice(0, 500);
    } catch {
      // ignore
    }
    console.error(
      `[track-resolver] videos.list HTTP ${response.status} ${response.statusText}: ${bodyPreview}`,
    );
    return null;
  }

  let parsed: YtApiVideosResponse;
  try {
    parsed = (await response.json()) as YtApiVideosResponse;
  } catch (err) {
    console.error("[track-resolver] videos.list JSON parse error:", err);
    return null;
  }

  const items = Array.isArray(parsed.items) ? parsed.items : [];
  for (const item of items) {
    const iso = item.contentDetails?.duration;
    if (typeof iso !== "string") continue;
    const secs = isoDurationToSeconds(iso);
    if (secs !== null) return secs;
  }
  return null;
}

/**
 * Query the YouTube Data API v3 for the first embeddable video matching
 * `${artist} ${title}`. Returns null on any failure (HTTP non-2xx, network
 * error, malformed body, zero results) so the caller can fall through to
 * the scraper. We deliberately swallow errors here rather than throwing —
 * the contract is "best-effort primary path."
 */
async function resolveViaApi(
  artist: string,
  title: string,
  apiKey: string,
): Promise<ResolvedTrack | null> {
  const query = `${artist} ${title}`;
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    videoEmbeddable: "true",
    maxResults: "5",
    q: query,
    key: apiKey,
  });
  const endpoint = `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;

  let response: Response;
  try {
    response = await fetch(endpoint);
  } catch (err) {
    console.error("[track-resolver] API network error:", err);
    return null;
  }

  if (!response.ok) {
    // 403 = quota exceeded or key disabled; 400 = bad request; 401 = bad key.
    // Log enough to diagnose but don't throw — we want the scraper fallback
    // to fire transparently. The body sometimes contains useful detail
    // (Google returns `{ error: { message, errors: [...] } }`), so include it.
    let bodyPreview = "";
    try {
      bodyPreview = (await response.text()).slice(0, 500);
    } catch {
      // ignore — we already have the status
    }
    console.error(
      `[track-resolver] API HTTP ${response.status} ${response.statusText}: ${bodyPreview}`,
    );
    return null;
  }

  let parsed: YtApiSearchResponse;
  try {
    parsed = (await response.json()) as YtApiSearchResponse;
  } catch (err) {
    console.error("[track-resolver] API JSON parse error:", err);
    return null;
  }

  const items = Array.isArray(parsed.items) ? parsed.items : [];
  for (const item of items) {
    const videoId = asNonEmptyString(item.id?.videoId);
    if (!videoId) continue;
    const resolvedTitle = asNonEmptyString(item.snippet?.title) ?? title;
    const resolvedChannel =
      asNonEmptyString(item.snippet?.channelTitle) ?? artist;
    // Second API call to grab the duration. This is a separate endpoint
    // (videos.list) because search.list never returns contentDetails. A null
    // here is non-fatal — we persist null and the player uses the default
    // dwell. Quota: this is +1 unit per cache miss on the API path.
    const durationSec = await fetchDurationSecViaApi(videoId, apiKey);
    return {
      videoId,
      // videoEmbeddable=true in the query guarantees this; we just mirror it.
      embeddable: true,
      resolvedTitle,
      resolvedChannel,
      resolvedAt: new Date().toISOString(),
      source: "api",
      durationSec,
    };
  }

  // Zero embeddable results. Fall through to scraper — it may surface a
  // user-uploaded copy the API filter excluded.
  return null;
}

// ─── Scraper fallback path ─────────────────────────────────────────────────

// Narrow types for the subset of yt-search's return shape we consume. The
// package is untyped JS, so we manually describe what we read. Anything
// missing is treated as `unknown` and gracefully coerced.
//
// `duration` is the loosest field: yt-search has historically shipped it as
// `{ timestamp: "2:30", seconds: 150 }`, but older or odd entries may omit
// `seconds` or the whole object. We type all members optional and parse
// defensively (see `extractScraperDurationSec`).
interface YtsVideoDuration {
  timestamp?: string;
  seconds?: number;
}

interface YtsVideo {
  type?: string;
  videoId?: string;
  title?: string;
  author?: { name?: string };
  duration?: YtsVideoDuration;
}

interface YtsResult {
  videos?: YtsVideo[];
}

// Module-callable function shape: `yts('query')` returns Promise<YtsResult>.
type YtsFn = (query: string) => Promise<YtsResult>;

// Lazy yt-search loader. Cached after first successful load; returns null
// when the import itself fails (typical on Vercel where cheerio's transitive
// deps don't make it into the bundle). Caller treats null as "scraper
// unavailable" and falls through to a null resolution.
let cachedYts: YtsFn | null = null;
let ytsLoadFailed = false;
async function loadYtsModule(): Promise<YtsFn | null> {
  if (cachedYts) return cachedYts;
  if (ytsLoadFailed) return null;
  try {
    const mod = await import("yt-search");
    const raw = (mod as unknown as { default?: unknown }).default ?? mod;
    const fn: YtsFn =
      typeof raw === "function"
        ? (raw as YtsFn)
        : ((raw as { default?: YtsFn }).default as YtsFn);
    if (typeof fn !== "function") {
      ytsLoadFailed = true;
      console.error("[track-resolver] yt-search loaded but no callable export");
      return null;
    }
    cachedYts = fn;
    return fn;
  } catch (err) {
    ytsLoadFailed = true;
    console.error("[track-resolver] yt-search lazy-load failed:", err);
    return null;
  }
}

/** Safely coerce an unknown to a non-empty trimmed string, or null. */
function asNonEmptyString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Parse a "M:SS" or "H:MM:SS" timestamp (the format yt-search emits for
 * `duration.timestamp`) into seconds. Returns null on malformed input.
 *
 * Accepts: "2:30" → 150, "1:02:03" → 3723, "0:45" → 45.
 * Rejects: empty string, non-numeric parts, more than 3 colon-separated
 * components.
 */
function parseTimestampToSeconds(timestamp: string): number | null {
  const parts = timestamp.split(":").map((p) => p.trim());
  if (parts.length < 1 || parts.length > 3) return null;
  const nums = parts.map((p) => Number.parseInt(p, 10));
  if (nums.some((n) => !Number.isFinite(n) || n < 0)) return null;
  if (parts.length === 3) {
    const [h, m, s] = nums as [number, number, number];
    return h * 3600 + m * 60 + s;
  }
  if (parts.length === 2) {
    const [m, s] = nums as [number, number];
    return m * 60 + s;
  }
  return nums[0] ?? null;
}

/**
 * Extract a duration in seconds from a yt-search video entry. Prefers the
 * already-parsed `.seconds` numeric field; falls back to parsing
 * `.timestamp` when seconds is missing or non-finite. Returns null when no
 * usable duration is present — the entry is still valid, the player just
 * uses its default dwell.
 *
 * We cast the `duration` field through `unknown` because yt-search ships
 * without bundled types and its actual runtime shape can drift slightly
 * across versions (one release dropped `.seconds` for a stretch).
 */
function extractScraperDurationSec(dur: YtsVideoDuration | undefined): number | null {
  if (!dur || typeof dur !== "object") return null;
  if (typeof dur.seconds === "number" && Number.isFinite(dur.seconds) && dur.seconds >= 0) {
    return Math.floor(dur.seconds);
  }
  if (typeof dur.timestamp === "string" && dur.timestamp.trim().length > 0) {
    return parseTimestampToSeconds(dur.timestamp.trim());
  }
  return null;
}

/**
 * Scraper fallback. Identical to the pre-upgrade implementation, just
 * extracted into its own function and tagged with `source: "scraper"`.
 *
 * yt-search separates its return into `.videos`, `.playlists`, `.channels`,
 * and `.live`. We read only `.videos` to avoid latching onto a playlist ID
 * that wouldn't embed as a single video anyway.
 */
async function resolveViaScraper(
  artist: string,
  title: string,
): Promise<ResolvedTrack | null> {
  const yts = await loadYtsModule();
  if (!yts) return null; // scraper unavailable in this environment
  const query = `${artist} ${title}`;
  let result: YtsResult;
  try {
    result = await yts(query);
  } catch (err) {
    console.error("[track-resolver] scraper error:", err);
    return null;
  }

  const videos = Array.isArray(result?.videos) ? result.videos : [];
  if (videos.length === 0) return null;

  // Walk the top 5 candidates. Take the first that yields a real videoId.
  // yt-search marks the entry's category in `.type`, but VIDEO-typed entries
  // are what populate `.videos`, so we just need a non-empty id.
  const TOP_N = 5;
  for (const item of videos.slice(0, TOP_N)) {
    const videoId = asNonEmptyString(item.videoId);
    if (!videoId) continue;
    const resolvedTitle = asNonEmptyString(item.title) ?? title;
    const resolvedChannel = asNonEmptyString(item.author?.name) ?? artist;
    // yt-search's `duration` is loosely typed; the helper handles missing
    // `.seconds`, missing `.timestamp`, and malformed strings by returning
    // null. A null here is fine — we persist it and the player uses its
    // default dwell for this track.
    const durationSec = extractScraperDurationSec(item.duration);

    return {
      videoId,
      // Scraper gives us no embeddable signal; stay optimistic as before.
      embeddable: true,
      resolvedTitle,
      resolvedChannel,
      resolvedAt: new Date().toISOString(),
      source: "scraper",
      durationSec,
    };
  }

  return null;
}

// ─── Public resolver ───────────────────────────────────────────────────────

/**
 * Resolve a track to a concrete YouTube videoId.
 *
 *  - Cache hit → return immediately (no network).
 *  - Cache miss + YOUTUBE_API_KEY set → try Data API first. On HTTP error,
 *    network error, or zero embeddable results, fall through to scraper.
 *  - Cache miss + no key (or empty key) → go straight to scraper.
 *  - Both paths exhausted → return null.
 *
 * The cache is written once, by whichever path succeeded, so subsequent
 * calls for the same (artist, title) skip the network entirely.
 */
export async function resolveTrack(
  artist: string,
  title: string,
): Promise<ResolvedTrack | null> {
  // 1. Cache first.
  const cached = await readCachedResolution(artist, title);
  if (cached) return cached;

  // 2. API path, if a key is configured. Empty string counts as "not set"
  //    so a half-configured `.env.local` doesn't punish us with a 400.
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (apiKey && apiKey.trim().length > 0) {
    const apiResolved = await resolveViaApi(artist, title, apiKey.trim());
    if (apiResolved) {
      await writeCachedResolution(artist, title, apiResolved);
      return apiResolved;
    }
    // Fall through. resolveViaApi already logged the reason.
  }

  // 3. Scraper fallback.
  const scraped = await resolveViaScraper(artist, title);
  if (scraped) {
    await writeCachedResolution(artist, title, scraped);
    return scraped;
  }

  return null;
}
