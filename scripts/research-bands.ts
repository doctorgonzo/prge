// scripts/research-bands.ts
// Build-time band-facts pre-research CLI for PRGE.
//
// Walks a curated artist list (sourced from station-bible's punk catalog),
// calls researchArtist() for each, and writes results into the baked JSON
// at src/lib/band-facts-baked.json. Commit that file → ships with every
// deploy → zero cold-start cost for bible-curated bands forever.
//
// Idempotent: bands already present in baked JSON are skipped. To force
// re-research a single band, edit baked JSON to remove that key first.
//
// Usage:
//   npm run research-bands
//
// Cost estimate: ~$0.05-0.10 per band × ~29 bands ≈ $1.50-2.90 one-time spend.
// Verify budget before running. Each band fetches via web_search (max 2 uses)
// and writes ~200-400 words of prose into the baked blob.
//
// Concurrency capped at 2 to respect the Haiku tier's 50K input-tokens-per-
// minute org cap (web_search responses echo a lot of input tokens).

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { researchArtist, type BandFacts } from "../src/lib/band-facts";

const BAKED_FILE = join(process.cwd(), "src/lib/band-facts-baked.json");

// Curated punk catalog — sourced from station-bible.md's Nick Trulino cast
// block. Order doesn't matter; cache-key is lowercased on lookup.
const ARTISTS: readonly string[] = [
  // Core
  "The Ramones",
  "The Descendents",
  "NOFX",
  "Propagandhi",
  "Anti-Flag",
  // Pop-punk
  "Green Day",
  "Blink-182",
  "Sum 41",
  "New Found Glory",
  "Alkaline Trio",
  "The Menzingers",
  "Joyce Manor",
  // Political-punk
  "Bad Religion",
  "Rise Against",
  "Strike Anywhere",
  "Dead Kennedys",
  // Punks-doing-covers
  "Me First and the Gimme Gimmes",
  "Goldfinger",
  "Reel Big Fish",
  // Cowpunk / psychobilly / outlaw wildcards
  "Mojo Nixon",
  "Reverend Horton Heat",
  "Hank Williams III",
  "The Cramps",
  // Satirical / weirdo-college-radio
  "Dead Milkmen",
  // 4am collapse rotation
  "Hot Water Music",
  "Bouncing Souls",
  "Against Me!",
  "The Lawrence Arms",
  // Doc-added
  "Face to Face",
];

const CONCURRENCY = 2;

type BakedBlob = Record<string, BandFacts>;

function cacheKey(artist: string): string {
  return artist.trim().toLowerCase();
}

async function loadBaked(): Promise<BakedBlob> {
  try {
    const text = await readFile(BAKED_FILE, "utf-8");
    const parsed = JSON.parse(text);
    if (parsed !== null && typeof parsed === "object") {
      return parsed as BakedBlob;
    }
    return {};
  } catch {
    return {};
  }
}

async function saveBaked(blob: BakedBlob): Promise<void> {
  await writeFile(BAKED_FILE, JSON.stringify(blob, null, 2) + "\n", "utf-8");
}

async function main(): Promise<void> {
  const baked = await loadBaked();
  const todo = ARTISTS.filter((a) => !baked[cacheKey(a)]);
  const skipped = ARTISTS.length - todo.length;

  if (todo.length === 0) {
    console.log(
      `All ${ARTISTS.length} artists already baked. Nothing to research.`,
    );
    return;
  }

  console.log(
    `Baked: ${skipped}/${ARTISTS.length}. To research: ${todo.length} (concurrency=${CONCURRENCY}).`,
  );
  console.log(
    `Estimated spend: $${(todo.length * 0.075).toFixed(2)} (rough; varies by web_search depth).`,
  );
  console.log("");

  let cursor = 0;
  let done = 0;
  let failed = 0;

  async function worker(workerId: number): Promise<void> {
    while (true) {
      const idx = cursor++;
      if (idx >= todo.length) return;
      const artist = todo[idx];
      const tag = `[w${workerId} ${String(idx + 1).padStart(2)}/${todo.length}]`;
      try {
        console.log(`${tag} researching ${artist}...`);
        const facts = await researchArtist(artist);
        baked[cacheKey(artist)] = facts;
        // Save incrementally — a crash mid-batch doesn't lose prior progress.
        await saveBaked(baked);
        done++;
        console.log(`${tag} ✓ ${artist} (${facts.rawNotes.length} chars)`);
      } catch (err) {
        failed++;
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`${tag} ✗ ${artist}: ${msg}`);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, todo.length) }, (_, i) =>
      worker(i + 1),
    ),
  );

  console.log("");
  console.log(`Done. Researched: ${done}. Failed: ${failed}. Skipped: ${skipped}.`);
  console.log(`Baked file: ${BAKED_FILE}`);
  console.log(`Commit src/lib/band-facts-baked.json to persist this cache.`);
}

main().catch((err) => {
  console.error("research-bands fatal:", err);
  process.exit(1);
});
