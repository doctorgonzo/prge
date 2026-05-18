// src/app/api/segment/route.ts
// Live segment generation endpoint.
//
// Flow:
//   1. Resolve format + Madison time — either from the ?format= override, the
//      ?at=HH:MM dev override, or from the broadcast scheduler (default).
//   2. Daytime station-id: short-circuit to a hand-written Tim bumper (no LLM).
//   3. Disk-cache lookup keyed by (format, Madison HH:MM). Hit = serve, no API call.
//   4. Budget gate. If the daily USD cap is spent, 429 (cache miss can't generate).
//   5. Generate via Anthropic, strip code fences, parse JSON.
//   6. Record cost + persist to disk cache.
//
// The X-PRGE-Cache header documents the path taken for ops visibility.

import { NextResponse } from "next/server";
import { generateSegment } from "@/lib/generator";
import { budgetStatus, recordCost } from "@/lib/budget";
import { readCached, writeCached } from "@/lib/cache";
import {
  getCurrentSegmentFormat,
  getSegmentAtInWorldTime,
} from "@/lib/scheduler";
import { pickTimBumper } from "@/lib/tim-bumpers";
import { getNickCutIns } from "@/lib/nick-cut-ins";
import { buildStaticDaytimeMusicBlock, buildStaticDaytimeCommercial } from "@/lib/daytime-static";
import { enrichTracksWithFacts, getTrackFacts } from "@/lib/track-facts";
import type { SegmentFormat, HostId } from "@/lib/types";

// Shape of an HH:MM 24-hour clock string. Mirrors the validation regex used by
// the scheduler's `getSegmentAtInWorldTime`.
const AT_PARAM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Force Node.js runtime (Anthropic SDK + fs in generator.ts / cache.ts / budget.ts).
export const runtime = "nodejs";
// Don't pre-render; each request is dynamic (the disk cache handles the dedupe).
export const dynamic = "force-dynamic";
// Music-block cold-cache path runs Phase B (band-facts web_search × 4-8 artists
// at concurrency=2). On a cold /tmp/prge that's 2-3 minutes worst case. Vercel
// default is 10s; bump to the Pro-plan ceiling so cold music-block calls don't
// die mid-research. Subsequent warm-container calls hit the band-facts cache
// and return in seconds.
export const maxDuration = 300;

const VALID_FORMATS: ReadonlySet<SegmentFormat> = new Set<SegmentFormat>([
  "sign-on",
  "news",
  "weather",
  "sports",
  "late-night-talk",
  "field-report",
  "wellness",
  "music-block",
  "mixed",
  "commercial-break",
  "station-id",
  "operator-cutin",
  "sign-off",
]);

function hostsForFormat(format: SegmentFormat): HostId[] {
  switch (format) {
    case "news":
      return ["quinn", "caroline", "holden", "tim"];
    case "weather":
      // Occasionally include Holden — ~25% of the time — for the data-rant interjection.
      return Math.random() < 0.25 ? ["caroline", "holden"] : ["caroline"];
    case "sports":
      return ["holden"];
    case "late-night-talk":
      return ["quinn"];
    case "field-report":
      return ["tucker"];
    case "wellness":
      return ["marigold"];
    case "music-block":
      return ["nick"];
    case "mixed":
      return ["quinn", "caroline", "holden"];
    case "commercial-break":
      return [];
    case "station-id":
    case "operator-cutin":
    case "sign-on":
    case "sign-off":
      return ["tim"];
  }
}

function durationForFormat(format: SegmentFormat): number {
  switch (format) {
    case "news":
      return 240;
    case "weather":
      return 90;
    case "sports":
      return 120;
    case "late-night-talk":
      return 360;
    case "field-report":
      return 180;
    case "wellness":
      return 150;
    case "music-block":
      return 600;
    case "mixed":
      return 300;
    case "commercial-break":
      return 60;
    case "station-id":
      return 30;
    case "operator-cutin":
      return 45;
    case "sign-on":
      return 90;
    case "sign-off":
      return 90;
  }
}

/** Strip leading/trailing whitespace and ```json ... ``` code fences from a model body. */
function stripFences(raw: string): string {
  let s = raw.trim();
  // Match ```json\n...\n``` or ```\n...\n```
  const fence = /^```(?:json|JSON)?\s*\n?([\s\S]*?)\n?```$/;
  const m = s.match(fence);
  if (m) s = m[1].trim();
  return s;
}

interface ResolvedSlot {
  format: SegmentFormat;
  /** Real Madison minute ("21:47") — passed to the generator so the model
   *  references the correct time in its content. */
  inWorldTime: string;
  /** Stable slot-start key ("21:00") — used for disk cache lookup so every
   *  minute within a slot hits the same cached segment. */
  cacheKey: string;
  hosts: HostId[];
  durationSec: number;
  /** Human-readable title for the segment, shown on the player. */
  title: string;
  /** True when this slot belongs to the unmanned 07:00–18:59 Madison block. */
  daytime: boolean;
}

const IS_DEV = process.env.NODE_ENV === "development";

/**
 * Decide which slot to serve.
 *
 * Precedence:
 *  1. `?format=` — manual format override (testing/QA). Format dominates.
 *     If `?at=` is ALSO provided, it's used purely as the cache key /
 *     Madison time so manual format previews respect the time-travel timeline.
 *  2. `?at=HH:MM` — DEV-ONLY time travel. Honored only in development;
 *     ignored in production (silent fallthrough — no error so legacy demo
 *     links don't 400 in prod). The scheduler resolves the slot containing
 *     that Madison time and serves its format/title/daytime.
 *  3. Default — consult the scheduler with `new Date()`.
 */
function resolveSlot(url: URL): ResolvedSlot | { error: string } {
  const formatParam = url.searchParams.get("format");
  const rawAtParam = url.searchParams.get("at");
  // Dev-only: ignore ?at= entirely in prod so a leaked dev link doesn't poison
  // a real visitor's clock. Keep the param visible in dev for the regen overlay
  // and the page.tsx HUD-pin path.
  const atParam = IS_DEV ? rawAtParam : null;

  // Validate `at` up-front when present — applies to both `?at` alone and
  // `?at` + `?format` (since `at` always drives cache keying in dev).
  if (atParam !== null && !AT_PARAM_RE.test(atParam)) {
    return { error: "Invalid 'at' format, expected HH:MM" };
  }

  if (formatParam !== null) {
    if (!VALID_FORMATS.has(formatParam as SegmentFormat)) {
      return { error: `Unknown format: ${formatParam}` };
    }
    const format = formatParam as SegmentFormat;
    // Cache key precedence: ?at= → ?inWorldTime= → scheduler-derived current.
    // When time-traveling with a manual format, cache by the travel time so
    // repeated visits to the same slot hit the same cache entry.
    let inWorldTime: string;
    let cacheKey: string;
    let daytime: boolean;
    if (atParam !== null) {
      try {
        const entry = getSegmentAtInWorldTime(atParam);
        inWorldTime = entry.inWorldTime;
        cacheKey = entry.startInWorldTime; // slot start for cache
        daytime = entry.daytime;
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) };
      }
    } else {
      const current = getCurrentSegmentFormat(new Date());
      inWorldTime = url.searchParams.get("inWorldTime") ?? current.inWorldTime;
      cacheKey = current.cacheKey;
      daytime = current.daytime;
    }
    return {
      format,
      inWorldTime,
      cacheKey,
      hosts: hostsForFormat(format),
      durationSec: durationForFormat(format),
      title: `${format.replace(/-/g, " ").toUpperCase()} · MANUAL`,
      daytime,
    };
  }

  if (atParam !== null) {
    let entry: ReturnType<typeof getSegmentAtInWorldTime>;
    try {
      entry = getSegmentAtInWorldTime(atParam);
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
    return {
      format: entry.format,
      inWorldTime: entry.inWorldTime,
      cacheKey: entry.startInWorldTime,
      hosts: entry.hosts,
      durationSec: entry.durationSec,
      title: entry.title,
      daytime: entry.daytime,
    };
  }

  const current = getCurrentSegmentFormat(new Date());
  return {
    format: current.format,
    inWorldTime: current.inWorldTime,
    cacheKey: current.cacheKey,
    hosts: current.hosts,
    durationSec: current.durationSec,
    title: current.title,
    daytime: current.daytime,
  };
}

/**
 * Compute elapsed Purge time as a human-readable string.
 * Purge starts at 19:00, so 22:17 → "3 hours and 17 minutes".
 */
function computeElapsed(inWorldTime: string): string {
  const [hh, mm] = inWorldTime.split(":").map(Number);
  // Elapsed minutes since 19:00, wrapping past midnight.
  const totalMin = hh >= 19 ? (hh - 19) * 60 + mm : (hh + 24 - 19) * 60 + mm;
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours === 0) return `${mins} minute${mins !== 1 ? "s" : ""}`;
  if (mins === 0) return `${hours} hour${hours !== 1 ? "s" : ""}`;
  return `${hours} hour${hours !== 1 ? "s" : ""} and ${mins} minute${mins !== 1 ? "s" : ""}`;
}

/**
 * Replace {{CLOCK}} and {{ELAPSED}} placeholders in all string values of the
 * parsed segment body. {{CLOCK}} → the real Madison HH:MM; {{ELAPSED}} → the
 * human-readable elapsed Purge time. This lets cached segments stay time-accurate
 * across the full hour slot.
 */
function interpolateTimePlaceholders(
  body: unknown,
  inWorldTime: string,
): unknown {
  const elapsed = computeElapsed(inWorldTime);
  const json = JSON.stringify(body);
  const replaced = json
    .replace(/\{\{CLOCK\}\}/g, inWorldTime)
    .replace(/\{\{ELAPSED\}\}/g, elapsed);
  return JSON.parse(replaced);
}

/**
 * Enrich the AI-generated body with the player-facing metadata fields
 * (inWorldTime + segmentTitle). The model doesn't know its own broadcast slot,
 * so we attach it at the API boundary. Also interpolates {{CLOCK}}/{{ELAPSED}}
 * placeholders so cached content reflects the real current time.
 */
function enrichSegment(
  body: unknown,
  inWorldTime: string,
  segmentTitle: string,
): Record<string, unknown> {
  const interpolated = interpolateTimePlaceholders(body, inWorldTime);
  const base =
    interpolated !== null && typeof interpolated === "object"
      ? (interpolated as Record<string, unknown>)
      : {};
  return { ...base, inWorldTime, segmentTitle };
}

// Station-offline circuit-breaker. When true, /api/segment short-circuits
// to an in-character "PRGE is dark" segment and makes ZERO Anthropic calls.
// Reads from env so Vercel can toggle it without a code change.
const STATION_OFFLINE = process.env.STATION_OFFLINE === "true";

const OFFLINE_SEGMENT = {
  type: "news" as const,
  inWorldTime: "—:—",
  segmentTitle: "STATION OFFLINE",
  lines: [
    {
      host: "tim",
      text: "Folks, this is Tim Peplinski. PRGE has gone dark. Operator pulled the signal.",
    },
    {
      host: "tim",
      text: "The rig got expensive. Faster than the donation jar could keep up. So we're off the air until we figure out the next move.",
    },
    {
      host: "tim",
      text: "Quinn's safe. Caroline and Holden are safe. Tucker's... Tucker. Marigold is wherever Marigold goes between broadcasts. Nick's nursing a hangover. Everyone's accounted for.",
    },
    {
      host: "tim",
      text: "Same frequency, next Purge. We'll be back when the rig's back. Stay home. Stay alive. Stay tuned.",
    },
    {
      host: "tim",
      text: "PRGE out. Pep signing off.",
    },
  ],
  tickerItems: [
    {
      category: "emergency",
      text: "STATION OFFLINE — PRGE has gone dark, signal restoration pending",
    },
    {
      category: "ad",
      text: "Last broadcast cached. Real signal returns when the rig comes back online.",
    },
    {
      category: "local-news",
      text: "Operator Pep apologizes — cost of broadcast forced the cut",
    },
  ],
};

/**
 * Attach Nick's cut-in(s) to a segment response. Nick interrupts other hosts
 * to play a song — minimum 1 per interruptible hour, scaling with his
 * drunkenness through the night, hard cap 4. Returns the segment unchanged
 * for non-interruptible formats (music-block, commercials, ops).
 */
async function attachNickCutIns(
  segment: Record<string, unknown>,
  format: string,
  inWorldTime: string,
  cacheKey: string,
): Promise<Record<string, unknown>> {
  const madisonDate = new Date()
    .toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
  const cutIns = getNickCutIns(format, inWorldTime, madisonDate, cacheKey);
  if (cutIns.length === 0) return segment;
  // Enrich each cut-in track with facts from the database.
  const enrichedCutIns = await Promise.all(
    cutIns.map(async (cutIn) => {
      const facts = await getTrackFacts(cutIn.track.artist, cutIn.track.title);
      if (facts.length === 0) return cutIn;
      const existingLines = cutIn.track.lines ?? [];
      const existingTexts = new Set(existingLines.map((l) => l.text.toLowerCase()));
      const newLines = facts
        .filter((f) => !existingTexts.has(f.toLowerCase()))
        .slice(0, Math.max(0, 10 - existingLines.length))
        .map((f) => ({ host: "nick", text: f }));
      return {
        ...cutIn,
        track: { ...cutIn.track, lines: [...existingLines, ...newLines] },
      };
    }),
  );
  return { ...segment, nickCutIns: enrichedCutIns };
}

export async function GET(request: Request): Promise<NextResponse> {
  if (STATION_OFFLINE) {
    return NextResponse.json(OFFLINE_SEGMENT, {
      headers: { "X-PRGE-Cache": "offline" },
    });
  }

  const url = new URL(request.url);
  const resolved = resolveSlot(url);

  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: 400 });
  }

  const { format, inWorldTime, cacheKey, hosts, durationSec, title, daytime } = resolved;

  // ?force=1 — dev-only regen. Skip cache lookup and overwrite the existing
  // entry. Budget gate still applies (force does NOT bypass budget).
  const force = url.searchParams.get("force") === "1";

  // Daytime station-id short-circuit — NEVER call the LLM for these. They're
  // hand-written Tim bumpers selected deterministically by (Madison-date, slot-
  // index). Same wallet-protection pattern as the baked band-facts and the
  // STATION_OFFLINE flag. Honors ?force=1 by re-rolling the bumper selection
  // off a different slot-index nonce (date stays the same, so still stable
  // within a single day's rotation).
  if (daytime && format === "station-id") {
    const madisonDate = new Date()
      .toLocaleDateString("en-CA", { timeZone: "America/Chicago" }); // YYYY-MM-DD
    const slotIndex = hashStringToInt(cacheKey);
    const bumper = pickTimBumper(madisonDate, slotIndex);
    const body = {
      type: "station-id" as const,
      lines: bumper.lines,
      tickerItems: bumper.tickerItems,
    };
    const enriched = enrichSegment(body, inWorldTime, "UNMANNED · AUTOPLAY");
    // No attachNickCutIns — daytime is unmanned, no DJ interrupts.
    return NextResponse.json(enriched, {
      headers: { "X-PRGE-Cache": "bumper" },
    });
  }

  // Daytime music-block short-circuit — static track picks from a baked pool.
  // ZERO LLM calls. Same wallet-protection pattern as the Tim bumper above.
  // Track facts enrichment adds 10+ rotating lines per song.
  if (daytime && format === "music-block") {
    const body = buildStaticDaytimeMusicBlock(cacheKey);
    const withFacts = await enrichTracksWithFacts(body, "prge");
    const enriched = enrichSegment(withFacts, inWorldTime, "UNMANNED · AUTOPLAY");
    return NextResponse.json(enriched, {
      headers: { "X-PRGE-Cache": "static-daytime-music" },
    });
  }

  // Daytime commercial-break short-circuit — static ad cards from the locked
  // brand list. ZERO LLM calls.
  if (daytime && format === "commercial-break") {
    const body = buildStaticDaytimeCommercial(cacheKey);
    const enriched = enrichSegment(body, inWorldTime, "UNMANNED · AUTOPLAY");
    return NextResponse.json(enriched, {
      headers: { "X-PRGE-Cache": "static-daytime-commercial" },
    });
  }

  // 1. Disk cache lookup — keyed by SLOT START (cacheKey), not the current
  //    minute. Every minute within a slot hits the same cached segment.
  //    When force=1, skip this entirely — we always want a fresh generation.
  if (!force) {
    const cached = await readCached(format, cacheKey);
    if (cached) {
      const headerTitle = daytime ? "UNMANNED · AUTOPLAY" : title;
      // Enrich music-block tracks with facts from the pre-baked database.
      let body = cached.body as Record<string, unknown>;
      if (format === "music-block") {
        const factHost = daytime ? "prge" : "nick";
        body = await enrichTracksWithFacts(body, factHost);
      }
      const enriched = enrichSegment(body, inWorldTime, headerTitle);
      return NextResponse.json(await attachNickCutIns(enriched, format, inWorldTime, cacheKey), {
        headers: { "X-PRGE-Cache": "hit" },
      });
    }
  }

  // 2. Budget gate. Cache miss → we'd need to call the API. Make sure we can afford it.
  //    Force does NOT bypass this — protect Doc's wallet.
  const budget = await budgetStatus();
  if (!budget.allowed) {
    return NextResponse.json(
      {
        error: "Daily token budget exceeded",
        spentUsd: budget.spentUsd,
        capUsd: budget.capUsd,
      },
      {
        status: 429,
        headers: { "X-PRGE-Cache": "miss-budget-blocked" },
      },
    );
  }

  // 3. Generate — pass the REAL Madison minute (inWorldTime) so the model
  //    references the correct clock time in its content.
  let generated;
  try {
    generated = await generateSegment({
      format,
      inWorldTime,
      hosts,
      durationSec,
      daytime,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/segment] Anthropic API error:", message);
    return NextResponse.json(
      { error: message },
      { status: 500, headers: { "X-PRGE-Cache": "error" } },
    );
  }

  // 4. Strip fences, parse JSON.
  const cleaned = stripFences(generated.body);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    console.error("[api/segment] Failed to parse model output:", err);
    console.error("[api/segment] Raw body was:", generated.body);
    return NextResponse.json(
      {
        error: "Failed to parse model output",
        raw: generated.body.slice(0, 500),
      },
      { status: 500, headers: { "X-PRGE-Cache": "error" } },
    );
  }

  // 5. Record cost + persist cache. Cache is keyed by slot start (cacheKey)
  //    so all subsequent requests within this slot are free.
  await Promise.all([
    recordCost(generated.usage).catch((err) => {
      console.error("[api/segment] recordCost failed:", err);
    }),
    writeCached({
      format,
      inWorldTime: cacheKey,
      body: parsed,
      generatedAt: new Date().toISOString(),
      modelId: generated.modelId,
    }).catch((err) => {
      console.error("[api/segment] writeCached failed:", err);
    }),
  ]);

  const headerTitle = daytime ? "UNMANNED · AUTOPLAY" : title;
  const enriched = enrichSegment(parsed, inWorldTime, headerTitle);
  return NextResponse.json(await attachNickCutIns(enriched, format, inWorldTime, cacheKey), {
    headers: {
      "X-PRGE-Cache": force ? "miss-forced" : "miss-generated",
    },
  });
}

/** Small string→int hash used as a stable nonce for the Tim-bumper selection.
 *  Same algorithm as in tim-bumpers.ts so cross-validation is trivial. */
function hashStringToInt(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return h;
}
