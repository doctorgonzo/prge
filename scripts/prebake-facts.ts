#!/usr/bin/env npx tsx
// scripts/prebake-facts.ts
//
// Pre-generates 10 short music facts per track for every song in the PRGE
// track universe (daytime pool, nick cut-ins, baked Purge segments). Saves
// to .prge/track-facts.json. The API route enriches music-block responses
// with these facts so each song has 10+ rotating lines instead of 2-3.
//
// Usage:
//   npx tsx scripts/prebake-facts.ts           # generate missing only
//   npx tsx scripts/prebake-facts.ts --force   # regenerate all
//
// Cost: ~$0.05-0.10 total on Haiku for ~55 tracks.

import Anthropic from "@anthropic-ai/sdk";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { config } from "dotenv";
config({ path: ".env.local" });

const FORCE = process.argv.includes("--force");
const FACTS_PATH = join(process.cwd(), ".prge", "track-facts.json");
const SEGMENTS_DIR = join(process.cwd(), ".prge", "segments");

interface TrackKey {
  artist: string;
  title: string;
  year?: number;
}

// ── Collect tracks from all sources ──────────────────────────────────

async function collectAllTracks(): Promise<TrackKey[]> {
  const seen = new Set<string>();
  const tracks: TrackKey[] = [];

  function add(artist: string, title: string, year?: number) {
    const key = `${artist}::${title}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    tracks.push({ artist, title, year });
  }

  // 1. Daytime static pool — parse the source for track definitions since
  // the DAYTIME_TRACKS array isn't exported.
  const daytimeSrc = await readFile(
    join(process.cwd(), "src/lib/daytime-static.ts"),
    "utf-8",
  );
  const daytimeMatches = daytimeSrc.matchAll(
    /title:\s*"([^"]+)",\s*\n\s*artist:\s*"([^"]+)",\s*\n\s*year:\s*(\d+)/g,
  );
  for (const m of daytimeMatches) {
    add(m[2], m[1], parseInt(m[3], 10));
  }

  // 2. Nick cut-in pool
  const nickSrc = await readFile(
    join(process.cwd(), "src/lib/nick-cut-ins.ts"),
    "utf-8",
  );
  const nickMatches = nickSrc.matchAll(
    /title:\s*"([^"]+)",\s*\n\s*artist:\s*"([^"]+)",\s*\n\s*year:\s*(\d+)/g,
  );
  for (const m of nickMatches) {
    add(m[2], m[1], parseInt(m[3], 10));
  }

  // 3. Baked segment JSONs (music-block tracks)
  try {
    const files = await readdir(SEGMENTS_DIR);
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      const raw = await readFile(join(SEGMENTS_DIR, f), "utf-8");
      const seg = JSON.parse(raw);
      const body = seg.body ?? seg;
      if (body.tracks && Array.isArray(body.tracks)) {
        for (const t of body.tracks) {
          if (t.artist && t.title) {
            add(t.artist, t.title, t.year);
          }
        }
      }
    }
  } catch {
    // No segments dir — that's fine
  }

  return tracks;
}

// ── Generate facts via Haiku ─────────────────────────────────────────

async function generateFacts(
  client: Anthropic,
  track: TrackKey,
): Promise<string[]> {
  const yearStr = track.year ? ` (${track.year})` : "";
  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1200,
    messages: [
      {
        role: "user",
        content: `Generate exactly 10 interesting facts about the song "${track.title}" by ${track.artist}${yearStr}.

Rules:
- Each fact is ONE sentence, 12-30 words.
- Be specific: use names, dates, studios, producers, chart positions, label names, real anecdotes.
- Cover a MIX of: recording details, chart/sales, band history, cultural impact, cover versions, music video, live performances, connections to other artists, gear/equipment, lyrical meaning.
- Punchy radio-copy tone — not dry Wikipedia, not overly casual. Like liner notes.
- If you're unsure about a detail, make it plausible and specific rather than vague.
- No numbering, no introductions. Just the 10 facts as a JSON array of strings.

Return ONLY a JSON array of 10 strings. No other text.`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  // Strip code fences if present
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/, "")
    .trim();
  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("Expected array of facts");
  }
  return parsed.map(String).slice(0, 12); // cap at 12 in case model over-delivers
}

// ── Main ─────────────────────────────────────────────────────────────

type FactsDb = Record<string, string[]>;

async function main() {
  console.log("🎸 PRGE Track Facts Pre-Bake\n");

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("❌ ANTHROPIC_API_KEY not set. Add it to .env.local");
    process.exit(1);
  }

  const client = new Anthropic();

  // Load existing database
  let db: FactsDb = {};
  try {
    const raw = await readFile(FACTS_PATH, "utf-8");
    db = JSON.parse(raw) as FactsDb;
  } catch {
    // Fresh start
  }

  const tracks = await collectAllTracks();
  console.log(`  Found ${tracks.length} unique tracks across all sources\n`);

  let generated = 0;
  let skipped = 0;
  let totalInput = 0;
  let totalOutput = 0;

  for (const track of tracks) {
    const key = `${track.artist}::${track.title}`;
    if (!FORCE && db[key] && db[key].length >= 8) {
      console.log(`  ✅ ${key} — cached (${db[key].length} facts)`);
      skipped++;
      continue;
    }

    console.log(`  ⏳ ${key} — generating...`);
    try {
      const facts = await generateFacts(client, track);
      db[key] = facts;
      generated++;
      totalInput += 200; // rough estimate
      totalOutput += 400;
      console.log(`  ✅ ${key} — ${facts.length} facts`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ❌ ${key} — FAILED: ${msg}`);
    }
  }

  // Save
  await mkdir(join(process.cwd(), ".prge"), { recursive: true });
  await writeFile(FACTS_PATH, JSON.stringify(db, null, 2), "utf-8");

  const estimatedCost =
    (totalInput / 1_000_000) * 1.0 + (totalOutput / 1_000_000) * 5.0;

  console.log(
    `\n📻 Done: ${generated} generated, ${skipped} cached`,
  );
  console.log(`💰 Estimated cost: $${estimatedCost.toFixed(4)}`);
  console.log(`📁 Saved to ${FACTS_PATH}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
