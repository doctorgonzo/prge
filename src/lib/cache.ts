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

function keyFor(format: string, inWorldTime: string): string {
  // inWorldTime like "19:02" — strip the ":" for filesystem safety
  const safeTime = inWorldTime.replace(":", "");
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
): Promise<CachedSegment | null> {
  const path = join(CACHE_DIR, keyFor(format, inWorldTime));
  try {
    const text = await readFile(path, "utf-8");
    return JSON.parse(text) as CachedSegment;
  } catch {
    return null;
  }
}

export async function writeCached(seg: CachedSegment): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
  const path = join(CACHE_DIR, keyFor(seg.format, seg.inWorldTime));
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
