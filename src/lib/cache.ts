// src/lib/cache.ts
// Disk-persistent segment cache. Keyed by (format, inWorldTime).
// Generated segments live on disk under .prge/segments/ so the same hour-block
// only triggers ONE Anthropic call per broadcast cycle.
//
// To wipe and regenerate: rm -rf .prge/segments

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { PRGE_STATE_DIR } from "./state-dir";

const CACHE_DIR = join(PRGE_STATE_DIR, "segments");

// Baked segments shipped in the repo — fallback when runtime cache is empty.
// On Vercel, /tmp is ephemeral, so these pre-baked files ensure every hour-slot
// has content without needing any Anthropic calls.
const BAKED_DIR = join(process.cwd(), ".prge", "segments");

/** Total prebake variants per slot. Runtime picks one via date-seeded hash. */
export const PREBAKE_VARIANT_COUNT = 14;

function keyFor(format: string, inWorldTime: string, variant?: number): string {
  // inWorldTime like "19:02" — strip the ":" for filesystem safety
  const safeTime = inWorldTime.replace(":", "");
  if (variant !== undefined) {
    return `${format}__${safeTime}__v${String(variant).padStart(2, "0")}.json`;
  }
  return `${format}__${safeTime}.json`;
}

export interface CachedSegment {
  format: string;
  inWorldTime: string;
  /** The parsed segment body (whatever the format prompt returns). */
  body: unknown;
  /** ISO timestamp when this segment was generated. */
  generatedAt: string;
  /** Model ID that produced it. */
  modelId: string;
}

export async function readCached(
  format: string,
  inWorldTime: string,
  variant?: number,
): Promise<CachedSegment | null> {
  const key = keyFor(format, inWorldTime, variant);
  // 1. Try runtime cache first (hot — written by recent generations).
  try {
    const text = await readFile(join(CACHE_DIR, key), "utf-8");
    return JSON.parse(text) as CachedSegment;
  } catch {
    // miss — fall through to baked
  }
  // 2. Try baked segments shipped in the repo (cold fallback for Vercel).
  try {
    const text = await readFile(join(BAKED_DIR, key), "utf-8");
    return JSON.parse(text) as CachedSegment;
  } catch {
    return null;
  }
}

/**
 * Pick the variant index for a given slot + Madison date. Deterministic —
 * same date always picks the same variant. Different dates cycle through
 * the pool so each night looks unique.
 */
export function pickVariant(cacheKey: string, madisonDate: string): number {
  let h = 0x811c9dc5;
  const s = `${madisonDate}::${cacheKey}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x45d9f3b);
  h ^= h >>> 16;
  return (h >>> 0) % PREBAKE_VARIANT_COUNT;
}

export async function writeCached(
  seg: CachedSegment,
  variant?: number,
): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
  const path = join(CACHE_DIR, keyFor(seg.format, seg.inWorldTime, variant));
  await writeFile(path, JSON.stringify(seg, null, 2), "utf-8");
}

/** Returns the list of cached (format, inWorldTime) pairs currently on disk. */
export async function listCached(): Promise<
  Array<{ format: string; inWorldTime: string }>
> {
  try {
    const files = await readdir(CACHE_DIR);
    return files
      .filter((f) => f.endsWith(".json"))
      .map((f) => {
        const stem = f.replace(/\.json$/, "");
        const [format, safeTime] = stem.split("__");
        const inWorldTime = safeTime
          ? `${safeTime.slice(0, 2)}:${safeTime.slice(2, 4)}`
          : "";
        return { format, inWorldTime };
      });
  } catch {
    return [];
  }
}
