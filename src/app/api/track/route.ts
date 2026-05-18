// src/app/api/track/route.ts
// Resolve { artist, title } → { videoId, embedUrl, ... } using the upgraded
// two-tier resolver (YouTube Data API v3 primary, yt-search scraper fallback).
// Disk-cached so repeat lookups don't re-hit either path.
//
// Headers:
//   X-PRGE-Cache:        hit | miss-resolved | miss-no-result
//   X-PRGE-Track-Source: api | scraper        (omitted on no-result)
//
//   GET /api/track?artist=Ramones&title=Blitzkrieg+Bop
//     → 200 { videoId, embedUrl, embeddable, resolvedTitle, resolvedChannel,
//             resolvedAt, source, durationSec }
//     → 404 { error: "No video found", artist, title }
//     → 400 { error: "Missing artist or title" }
//
// `durationSec` is total track length in seconds, or null when neither the
// API videos.list call nor the scraper's yt-search entry produced a usable
// value. Legacy cache rows from before this field existed read back as
// `undefined`; the route normalizes to `null` for the wire shape so the
// client sees one canonical "unknown" value.

import { NextResponse } from "next/server";
import { resolveTrack, readCachedResolution } from "@/lib/track-resolver";

// Force Node.js runtime — yt-search uses `got` (Node streams) and our
// resolver writes to the filesystem. (The Data API call uses global `fetch`,
// which works in either runtime, but the scraper fallback pins us to Node.)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Build the youtube.com/embed URL that the music-block iframe will load.
 * PRGE is a broadcast — viewers shouldn't really be in control of pacing,
 * but they DO need a volume slider (no controls = no volume on YouTube's
 * embed; the `controls` param is all-or-nothing). So we leave controls
 * visible. Pause/seek are technically available, but the broadcast clock
 * doesn't respect them: trackIndex advances on its own timer regardless of
 * iframe playback state. They can pause; the broadcast doesn't wait.
 *
 * Other flags: `disablekb=1` still blocks keyboard shortcuts (small bit
 * of friction against accidental space-pauses). `fs=0` hides fullscreen
 * (broadcast doesn't go fullscreen, stays in its bezel). `iv_load_policy=3`
 * suppresses video annotations / cards. `rel=0` no related-video grid at
 * end. `modestbranding=1` minimal YouTube logo.
 */
function buildEmbedUrl(videoId: string): string {
  // enablejsapi=1 lets the parent page listen to player events via postMessage
  // — the chrome around the iframe reads playerState/currentTime/duration off
  // those messages to drive the SIGNAL / PROGRESS / SPECTROGRAM readouts.
  return `https://www.youtube.com/embed/${encodeURIComponent(
    videoId,
  )}?autoplay=1&controls=1&disablekb=1&modestbranding=1&rel=0&fs=0&iv_load_policy=3&enablejsapi=1`;
}

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const artist = url.searchParams.get("artist");
  const title = url.searchParams.get("title");

  if (!artist || !title) {
    return NextResponse.json(
      { error: "Missing artist or title" },
      { status: 400 },
    );
  }

  // Pre-check the cache so we can label the response. We could collapse this
  // into resolveTrack() and infer hit/miss from timing, but an explicit pre-
  // check is clearer for ops + costs nothing extra (the cache file is tiny).
  const cachedBefore = await readCachedResolution(artist, title);
  const wasHit = cachedBefore !== null;

  const resolved = wasHit ? cachedBefore : await resolveTrack(artist, title);

  if (!resolved) {
    return NextResponse.json(
      { error: "No video found", artist, title },
      {
        status: 404,
        headers: { "X-PRGE-Cache": "miss-no-result" },
      },
    );
  }

  // `source` is a recent addition — pre-upgrade cache rows lack it. Default
  // to "scraper" since that's what produced them. (Going forward every new
  // write includes the field.)
  const source = resolved.source ?? "scraper";

  // Normalize legacy cache rows: pre-upgrade entries have no `durationSec`
  // field at all (reads as `undefined`). Coerce to `null` on the wire so the
  // client only has to handle one "unknown" sentinel.
  const durationSec: number | null = resolved.durationSec ?? null;

  return NextResponse.json(
    {
      videoId: resolved.videoId,
      embedUrl: buildEmbedUrl(resolved.videoId),
      embeddable: resolved.embeddable,
      resolvedTitle: resolved.resolvedTitle,
      resolvedChannel: resolved.resolvedChannel,
      resolvedAt: resolved.resolvedAt,
      source,
      durationSec,
    },
    {
      headers: {
        "X-PRGE-Cache": wasHit ? "hit" : "miss-resolved",
        "X-PRGE-Track-Source": source,
      },
    },
  );
}
