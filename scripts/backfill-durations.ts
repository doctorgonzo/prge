// scripts/backfill-durations.ts
// One-time (idempotent) pass that stamps real YouTube durations onto every
// music-block track in the prebaked segment cache. The music-block player
// derives its wall-clock playhead (which track + seek offset) from these
// durations, so without them the playlist can't sync across viewers or
// survive a reload.
//
// For each music-block segment file we walk body.tracks, resolve any track
// missing a finite durationSec via the same resolver the /api/track route
// uses (YouTube Data API primary, scraper fallback, disk-cached), and write
// the duration back into the file. Already-stamped tracks are skipped, so
// re-running only fills gaps.
//
// Run: npm run backfill-durations   (sources .env.local for YOUTUBE_API_KEY)

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PRGE_STATE_DIR } from "../src/lib/state-dir";
import { resolveTrack } from "../src/lib/track-resolver";

const SEGMENTS_DIR = join(PRGE_STATE_DIR, "segments");

interface TrackRow {
  artist?: string;
  title?: string;
  durationSec?: number | null;
  [k: string]: unknown;
}

interface SegmentFile {
  body?: {
    type?: string;
    tracks?: TrackRow[];
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

function hasFiniteDuration(t: TrackRow): boolean {
  return typeof t.durationSec === "number" && Number.isFinite(t.durationSec) && t.durationSec > 0;
}

async function main(): Promise<void> {
  const files = (await readdir(SEGMENTS_DIR))
    .filter((f) => f.endsWith(".json") && !f.endsWith(".bak"))
    .sort();

  let filesTouched = 0;
  let resolved = 0;
  let failed = 0;
  let skipped = 0;
  const failures: string[] = [];

  for (const file of files) {
    const path = join(SEGMENTS_DIR, file);
    let parsed: SegmentFile;
    try {
      parsed = JSON.parse(await readFile(path, "utf-8")) as SegmentFile;
    } catch {
      continue;
    }

    const body = parsed.body;
    if (!body || body.type !== "music-block") continue;
    const tracks = Array.isArray(body.tracks) ? body.tracks : [];
    if (tracks.length === 0) continue;

    let changed = false;
    for (const track of tracks) {
      if (!track.artist || !track.title) continue;
      if (hasFiniteDuration(track)) {
        skipped++;
        continue;
      }
      const result = await resolveTrack(track.artist, track.title);
      const dur = result?.durationSec ?? null;
      if (typeof dur === "number" && Number.isFinite(dur) && dur > 0) {
        track.durationSec = dur;
        resolved++;
        changed = true;
        console.log(`  ✓ ${track.artist} — ${track.title} → ${dur}s`);
      } else {
        track.durationSec = null;
        failed++;
        changed = true;
        failures.push(`${track.artist} — ${track.title}`);
        console.log(`  ✗ ${track.artist} — ${track.title} (no duration)`);
      }
    }

    if (changed) {
      await writeFile(path, JSON.stringify(parsed, null, 2) + "\n", "utf-8");
      filesTouched++;
    }
  }

  console.log("\n── backfill-durations summary ──");
  console.log(`files touched : ${filesTouched}`);
  console.log(`resolved      : ${resolved}`);
  console.log(`already set   : ${skipped}`);
  console.log(`no duration   : ${failed}`);
  if (failures.length > 0) {
    console.log("\nunresolved (left null):");
    for (const f of failures) console.log(`  - ${f}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
