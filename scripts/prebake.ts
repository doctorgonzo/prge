#!/usr/bin/env npx tsx
// scripts/prebake.ts
//
// Pre-generates all 12 Purge Night hour-slots and saves them to the disk
// cache (.prge/segments/). After running this, the segment API serves cached
// content for every hour — ZERO Anthropic calls at runtime.
//
// Usage:
//   npx tsx scripts/prebake.ts           # bake all 12 hours
//   npx tsx scripts/prebake.ts --force   # re-bake even if cached
//
// Prerequisites:
//   - ANTHROPIC_API_KEY set in .env.local
//   - Local dev server does NOT need to be running (this calls the
//     generator directly, not the API route)
//
// Cost: ~$0.10-0.30 total for all 12 slots on Haiku 4.5.

import { generateSegment } from "../src/lib/generator";
import { readCached, writeCached } from "../src/lib/cache";
import { BROADCAST_SCHEDULE } from "../src/lib/scheduler";
import { recordCost } from "../src/lib/budget";
import type { SegmentFormat, HostId } from "../src/lib/types";

// Load env
import { config } from "dotenv";
config({ path: ".env.local" });

const FORCE = process.argv.includes("--force");

function hostsForFormat(format: SegmentFormat): HostId[] {
  switch (format) {
    case "news":
      return ["quinn", "caroline", "holden", "tim"];
    case "weather":
      return ["caroline"];
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
    case "countdown":
      return ["tim"];
  }
}

function durationForFormat(format: SegmentFormat): number {
  switch (format) {
    case "news": return 240;
    case "weather": return 90;
    case "sports": return 120;
    case "late-night-talk": return 360;
    case "field-report": return 180;
    case "wellness": return 150;
    case "music-block": return 600;
    case "mixed": return 300;
    case "commercial-break": return 60;
    case "station-id": return 30;
    case "operator-cutin": return 45;
    case "sign-on": return 90;
    case "sign-off": return 90;
    case "countdown": return 3600;
  }
}

function stripFences(raw: string): string {
  let s = raw.trim();
  const fence = /^```(?:json|JSON)?\s*\n?([\s\S]*?)\n?```$/;
  const m = s.match(fence);
  if (m) s = m[1].trim();
  return s;
}

async function main() {
  console.log("🏴‍☠️ PRGE Pre-Bake — generating all 12 Purge Night hour-slots\n");

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("❌ ANTHROPIC_API_KEY not set. Add it to .env.local");
    process.exit(1);
  }

  let totalCost = 0;
  let generated = 0;
  let skipped = 0;

  for (const entry of BROADCAST_SCHEDULE) {
    const format = entry.format;
    const cacheKey = entry.startInWorldTime;
    const label = `Hour ${entry.hour} · ${cacheKey} · ${entry.title} (${format})`;

    // Check cache unless --force
    if (!FORCE) {
      const cached = await readCached(format, cacheKey);
      if (cached) {
        console.log(`  ✅ ${label} — cached, skipping`);
        skipped++;
        continue;
      }
    }

    console.log(`  ⏳ ${label} — generating...`);

    try {
      const result = await generateSegment({
        format,
        inWorldTime: cacheKey,
        hosts: hostsForFormat(format),
        durationSec: durationForFormat(format),
        daytime: false,
      });

      const cleaned = stripFences(result.body);
      const parsed = JSON.parse(cleaned);

      await writeCached({
        format,
        inWorldTime: cacheKey,
        body: parsed,
        generatedAt: new Date().toISOString(),
        modelId: result.modelId,
      });

      await recordCost(result.usage).catch(() => {});

      const cost = estimateCost(result.usage);
      totalCost += cost;
      generated++;

      console.log(`  ✅ ${label} — done ($${cost.toFixed(4)})`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ❌ ${label} — FAILED: ${msg}`);
    }
  }

  console.log(`\n📻 Pre-bake complete: ${generated} generated, ${skipped} skipped`);
  console.log(`💰 Estimated cost: $${totalCost.toFixed(4)}`);
  console.log(`\nCached segments are in .prge/segments/`);
  console.log(`The API route will serve these with zero Anthropic calls.`);
}

function estimateCost(usage: { input_tokens: number; output_tokens: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number }): number {
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const standardInput = Math.max(0, usage.input_tokens - cacheRead - cacheWrite);
  return (
    (standardInput / 1_000_000) * 1.0 +
    (cacheRead / 1_000_000) * 0.1 +
    (cacheWrite / 1_000_000) * 1.25 +
    (usage.output_tokens / 1_000_000) * 5.0
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
