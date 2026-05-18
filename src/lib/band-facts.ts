// src/lib/band-facts.ts
// Per-band research cache. Music-block generation is two-phase:
//   Phase A — pick the track list (tool-free Haiku call)
//   Phase B — research each unique artist (THIS file)
//   Phase C — write the segment with the facts injected as context (tool-free)
//
// Band facts essentially don't change (Joey Ramone isn't going to gain a new
// birth-year), so the cache has NO TTL. Manual eviction = delete the file or
// jq-strip a single key.
//
// Storage: a single JSON blob at `.prge/band-facts.json`, keyed by the
// lowercased+trimmed artist name. We mirror the single-file pattern from
// track-resolver.ts because the data is small and write-rare, and a single
// inspectable file is easier to surgically edit by hand.
//
// On cache miss, we make ONE focused Anthropic call per artist with the
// server-side `web_search_20250305` tool enabled (max_uses: 2 — one search is
// usually enough; the extra is headroom). Model: claude-haiku-4-5-20251001
// (cheap by design — this exists to REDUCE spend on regens).

import Anthropic from "@anthropic-ai/sdk";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { PRGE_STATE_DIR } from "./state-dir";
import bakedFactsRaw from "./band-facts-baked.json";

const CACHE_FILE = join(PRGE_STATE_DIR, "band-facts.json");

// Baked-in facts cache. Committed to the repo + shipped in every deploy, so
// the bible's curated artists hit zero-cost cache on every cold container.
// Populated by `npm run research-bands` (one-time spend; persistent ever-after).
// Read-only at runtime — runtime writes only go to the /tmp overflow cache.
const BAKED_FACTS = bakedFactsRaw as Record<string, BandFacts>;

// Cheap model is the whole point — this cache exists to keep regens free.
const RESEARCH_MODEL = "claude-haiku-4-5-20251001";

// One web_search is plenty per band; the second is headroom in case the first
// turn comes back empty (rare but possible for obscure-ish 90s-2010s acts).
const MAX_SEARCHES_PER_BAND = 2;

// Roomy enough for a 200-400 word prose blob plus any preamble the model
// can't quite suppress. We extract only the final text block downstream.
const MAX_TOKENS_PER_BAND = 1200;

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface BandFacts {
  /** Normalized cache-key form (lowercased + trimmed). */
  artist: string;
  /** Canonical display form — whatever the caller passed in, trimmed. */
  displayName: string;
  /** Multi-paragraph research blob in Nick-DJ-friendly prose. */
  rawNotes: string;
  /** ISO timestamp of when the research call landed. */
  searchedAt: string;
}

type CacheBlob = Record<string, BandFacts>;

/** Cache-key normalization. Matches the readCachedResolution pattern. */
function cacheKey(artist: string): string {
  return artist.trim().toLowerCase();
}

async function readCacheBlob(): Promise<CacheBlob> {
  try {
    const text = await readFile(CACHE_FILE, "utf-8");
    const parsed = JSON.parse(text);
    if (parsed !== null && typeof parsed === "object") {
      return parsed as CacheBlob;
    }
    return {};
  } catch {
    // File missing or unreadable → empty cache. We'll create on first write.
    return {};
  }
}

async function writeCacheBlob(blob: CacheBlob): Promise<void> {
  await mkdir(dirname(CACHE_FILE), { recursive: true });
  await writeFile(CACHE_FILE, JSON.stringify(blob, null, 2), "utf-8");
}

/**
 * Pull the research prose out of the model response. Per Anthropic's
 * web_search semantics, the response.content may contain a mix of
 * server_tool_use, web_search_tool_result, and text blocks. The final text
 * block is the model's settled answer. We grab the LAST text block; if the
 * model split prose across multiple text blocks (uncommon), we concatenate
 * them in order so we don't drop content.
 */
function extractProse(response: Anthropic.Messages.Message): string {
  const textBlocks = response.content.filter(
    (b): b is Anthropic.Messages.TextBlock => b.type === "text",
  );
  if (textBlocks.length === 0) {
    throw new Error("No text content in band-facts research response");
  }
  if (textBlocks.length === 1) return textBlocks[0].text.trim();
  // Multiple text blocks → join in order. The trailing block is usually the
  // final answer, but joining is the safer default (nothing lost on edge cases).
  return textBlocks.map((b) => b.text).join("\n\n").trim();
}

/**
 * Build the research prompt for a single band. Plain prose, no JSON — Nick's
 * monologue prompt later weaves these notes into per-track facts in his voice.
 * Asking for JSON here would force the downstream model to reformat anyway.
 */
function researchPrompt(artist: string): string {
  return `Research the punk band ${artist}. Use web_search. Return a Nick-DJ-friendly prose blob covering: real member names, origin city, formation year, key albums, recording venues/studios, scene history, 2-3 specific anecdotes, lyrical themes. ~200-400 words. Plain text, no JSON, no headers, no markdown.`;
}

/**
 * Make the one-shot research call for a single artist. Throws on Anthropic
 * error — the caller decides whether to retry. We deliberately don't
 * implement automatic retry here: a transient failure should bubble so the
 * generator knows to abort the segment (better than silently storing a
 * partial/empty fact blob in the forever-cache).
 */
export async function researchArtist(artist: string): Promise<BandFacts> {
  const displayName = artist.trim();
  const response = await client.messages.create({
    model: RESEARCH_MODEL,
    max_tokens: MAX_TOKENS_PER_BAND,
    messages: [{ role: "user", content: researchPrompt(displayName) }],
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: MAX_SEARCHES_PER_BAND,
      },
    ],
  });

  const rawNotes = extractProse(response);
  if (rawNotes.length === 0) {
    throw new Error(`Empty band-facts blob for ${displayName}`);
  }

  return {
    artist: cacheKey(displayName),
    displayName,
    rawNotes,
    searchedAt: new Date().toISOString(),
  };
}

/**
 * Get band facts for a single artist. Cache-first; on miss, research and
 * persist. Forever cache — only manual eviction (rm `.prge/band-facts.json`)
 * will clear an entry.
 */
export async function getBandFacts(artist: string): Promise<BandFacts> {
  const key = cacheKey(artist);
  // 1. Baked-in repo cache — zero cost, ships in every deploy.
  const baked = BAKED_FACTS[key];
  if (baked) return baked;
  // 2. Runtime /tmp overflow — survives within a warm container.
  const blob = await readCacheBlob();
  const hit = blob[key];
  if (hit) return hit;
  // 3. Cold miss — pay for fresh research.
  const facts = await researchArtist(artist);

  // Re-read before write — defensive against concurrent batch calls writing
  // separate entries to the same blob. (Promise.all in getBandFactsBatch
  // could otherwise race; we want every result to land in the merged blob.)
  const fresh = await readCacheBlob();
  fresh[key] = facts;
  await writeCacheBlob(fresh);

  return facts;
}

/**
 * Cap on simultaneous in-flight research calls. The Anthropic Haiku tier has
 * a 50K input-tokens-per-minute org cap; web_search responses can be quite
 * input-heavy (search results are echoed back into the conversation), so
 * fanning out 4-8 artists in pure parallel will blow the cap and 429. Two
 * in flight is a comfortable margin — still much faster than fully serial,
 * still under the ceiling for any realistic batch.
 */
const BATCH_CONCURRENCY = 2;

/**
 * Batch variant. Parallelizes with a small concurrency cap — each artist is
 * an independent call, but the Haiku tier rate-limits at 50K input-tokens-
 * per-minute and fanning out all 4-8 unique bands at once trips that cap
 * (web_search responses echo a lot of input tokens). Errors propagate
 * (first rejection cancels in-flight work), matching `getBandFacts`'s
 * "throw on Anthropic error" contract.
 *
 * Note: deduplicates by cache-key so passing ["Ramones", "ramones"] only
 * makes one research call. The returned array MIRRORS the input order; if
 * the input contains dupes, the same BandFacts object appears at each index.
 */
export async function getBandFactsBatch(
  artists: string[],
): Promise<BandFacts[]> {
  // Dedupe while preserving input order. We want the public result to mirror
  // `artists` 1:1, but we only want to make one network call per unique key.
  const uniqueKeys = new Map<string, string>(); // cacheKey → original displayName
  for (const a of artists) {
    const k = cacheKey(a);
    if (!uniqueKeys.has(k)) uniqueKeys.set(k, a.trim());
  }

  // Resolve each unique artist with capped concurrency. We split into
  // cached vs. uncached up front: cache hits don't count against the
  // rate-limit budget (they don't hit the API at all), so we resolve those
  // immediately and only throttle the actual research calls.
  const resolved = new Map<string, BandFacts>();
  const needsResearch: Array<[string, string]> = []; // [cacheKey, displayName]

  const initialBlob = await readCacheBlob();
  for (const [key, displayName] of uniqueKeys) {
    // Check baked-in repo cache first, then runtime /tmp overflow.
    const hit = BAKED_FACTS[key] ?? initialBlob[key];
    if (hit) {
      resolved.set(key, hit);
    } else {
      needsResearch.push([key, displayName]);
    }
  }

  // Worker-pool pattern: each worker pulls the next pending artist off a
  // shared cursor. Cleaner than chunking when the batch is small and call
  // latencies are variable (typical for web_search responses).
  let cursor = 0;
  async function worker(): Promise<void> {
    while (true) {
      const idx = cursor++;
      if (idx >= needsResearch.length) return;
      const [key, displayName] = needsResearch[idx];
      const facts = await getBandFacts(displayName);
      resolved.set(key, facts);
    }
  }

  const workerCount = Math.min(BATCH_CONCURRENCY, needsResearch.length);
  await Promise.all(
    Array.from({ length: workerCount }, () => worker()),
  );

  // Map back to input order.
  return artists.map((a) => {
    const facts = resolved.get(cacheKey(a));
    if (!facts) {
      // Defensive — should be unreachable given the population loop above.
      throw new Error(`Internal: missing band-facts for ${a}`);
    }
    return facts;
  });
}
