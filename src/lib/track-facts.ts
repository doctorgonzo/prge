// src/lib/track-facts.ts
// Runtime loader for the pre-baked track facts database.
// The prebake-facts script generates .prge/track-facts.json with 10+ facts
// per track. This module loads it once and provides a lookup function.
//
// Lookup is case-insensitive on artist::title to handle minor variations
// between sources (e.g., "Descendents" vs "The Descendents").

import { readFile } from "node:fs/promises";
import { join } from "node:path";

type FactsDb = Record<string, string[]>;

let cachedDb: FactsDb | null = null;

const FACTS_PATH = join(process.cwd(), ".prge", "track-facts.json");

/** Load the facts database (cached after first read). */
async function loadDb(): Promise<FactsDb> {
  if (cachedDb) return cachedDb;
  try {
    const raw = await readFile(FACTS_PATH, "utf-8");
    cachedDb = JSON.parse(raw) as FactsDb;
  } catch {
    cachedDb = {};
  }
  return cachedDb;
}

/**
 * Look up facts for a track. Returns an array of fact strings (10+),
 * or an empty array if the track isn't in the database.
 *
 * Tries exact match first, then case-insensitive, then partial artist
 * match (handles "Descendents" vs "The Descendents" etc.).
 */
export async function getTrackFacts(
  artist: string,
  title: string,
): Promise<string[]> {
  const db = await loadDb();

  // Exact match
  const exactKey = `${artist}::${title}`;
  if (db[exactKey]) return db[exactKey];

  // Case-insensitive match
  const lowerKey = exactKey.toLowerCase();
  for (const [k, v] of Object.entries(db)) {
    if (k.toLowerCase() === lowerKey) return v;
  }

  // Partial artist match (strip leading "The ")
  const strippedArtist = artist.replace(/^the\s+/i, "").toLowerCase();
  const strippedTitle = title.toLowerCase();
  for (const [k, v] of Object.entries(db)) {
    const [kArtist, kTitle] = k.split("::");
    if (!kArtist || !kTitle) continue;
    const kStripped = kArtist.replace(/^the\s+/i, "").toLowerCase();
    if (kStripped === strippedArtist && kTitle.toLowerCase() === strippedTitle) {
      return v;
    }
  }

  return [];
}

/**
 * Enrich a music-block segment body with facts from the database.
 * For each track, if the track has fewer than `minLines` lines, supplement
 * with facts to reach at least that many. Existing lines are preserved.
 *
 * @param body - The parsed segment body (must have a `tracks` array)
 * @param host - The host to attribute new fact lines to ("nick" or "prge")
 * @param minLines - Minimum number of lines per track (default 10)
 */
export async function enrichTracksWithFacts(
  body: Record<string, unknown>,
  host: string,
  minLines = 10,
): Promise<Record<string, unknown>> {
  const tracks = body.tracks;
  if (!Array.isArray(tracks) || tracks.length === 0) return body;

  const enriched = await Promise.all(
    tracks.map(async (track: Record<string, unknown>) => {
      const artist = typeof track.artist === "string" ? track.artist : "";
      const title = typeof track.title === "string" ? track.title : "";
      if (!artist || !title) return track;

      const existingLines = Array.isArray(track.lines) ? track.lines : [];
      if (existingLines.length >= minLines) return track;

      const facts = await getTrackFacts(artist, title);
      if (facts.length === 0) return track;

      // Deduplicate: don't add facts that are already in existing lines.
      const existingTexts = new Set(
        existingLines.map((l: { text?: string }) =>
          typeof l.text === "string" ? l.text.toLowerCase() : "",
        ),
      );

      const newLines = facts
        .filter((f) => !existingTexts.has(f.toLowerCase()))
        .slice(0, minLines - existingLines.length)
        .map((f) => ({ host, text: f }));

      return {
        ...track,
        lines: [...existingLines, ...newLines],
      };
    }),
  );

  return { ...body, tracks: enriched };
}
