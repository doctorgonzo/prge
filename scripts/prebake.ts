#!/usr/bin/env npx tsx
// scripts/prebake.ts
//
// Pre-generates 14 VARIANTS of every Purge Night hour-slot and saves them
// to the disk cache (.prge/segments/). After running this, the segment API
// serves cached content for every hour — ZERO Anthropic calls at runtime.
// The runtime picks a variant per night using a date-seeded hash, so each
// night for 14 consecutive days looks completely unique.
//
// Usage:
//   npx tsx scripts/prebake.ts              # bake all 168 segments
//   npx tsx scripts/prebake.ts --force      # re-bake even if cached
//   npx tsx scripts/prebake.ts --slot=19:00 # bake only one slot (all 14 variants)
//   npx tsx scripts/prebake.ts --slot=19:00 --variant=3  # bake one specific variant
//
// Prerequisites:
//   - ANTHROPIC_API_KEY set in .env.local
//   - Local dev server does NOT need to be running
//
// Cost: ~$2-5 total for all 168 segments on Haiku 4.5.

import { generateSegment } from "../src/lib/generator";
import { readCached, writeCached, PREBAKE_VARIANT_COUNT } from "../src/lib/cache";
import { BROADCAST_SCHEDULE } from "../src/lib/scheduler";
import { recordCost } from "../src/lib/budget";
import type { SegmentFormat, HostId } from "../src/lib/types";

// Env loaded by `npm run prebake` (source .env.local before tsx).
// If running manually: source .env.local && npx tsx scripts/prebake.ts

const FORCE = process.argv.includes("--force");
const SLOT_FILTER = process.argv.find((a) => a.startsWith("--slot="))?.split("=")[1] ?? null;
const VARIANT_FILTER = process.argv.find((a) => a.startsWith("--variant="))?.split("=")[1] ?? null;
const VARIANT_NUM = VARIANT_FILTER !== null ? parseInt(VARIANT_FILTER, 10) : null;
const FORMAT_FILTER = process.argv.find((a) => a.startsWith("--format="))?.split("=")[1] ?? null;

// Per-format line count overrides. When set, a hard "generate EXACTLY N lines"
// instruction is injected into the notes. Formats not listed here use the
// default from the format prompt.
const LINE_COUNT_OVERRIDE: Partial<Record<SegmentFormat, number>> = {};
const lineCountArg = process.argv.find((a) => a.startsWith("--lines="))?.split("=")[1];
if (lineCountArg) {
  // --lines=100 applies to all formats being baked
  const n = parseInt(lineCountArg, 10);
  if (!isNaN(n) && n > 0) {
    // We'll apply this in variantNotes based on what format we're generating
    LINE_COUNT_OVERRIDE["_default" as SegmentFormat] = n;
  }
}
// Format-specific overrides: --lines-news=100 --lines-wellness=50 etc.
for (const arg of process.argv) {
  const m = arg.match(/^--lines-([a-z-]+)=(\d+)$/);
  if (m) LINE_COUNT_OVERRIDE[m[1] as SegmentFormat] = parseInt(m[2], 10);
}

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
  // If we have a line count override, scale duration proportionally.
  // Base assumption: ~15 seconds per line of dialog.
  const lineOverride = LINE_COUNT_OVERRIDE[format] ?? LINE_COUNT_OVERRIDE["_default" as SegmentFormat];
  if (lineOverride) return lineOverride * 15;

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

function lineCountFor(format: SegmentFormat): number | null {
  return LINE_COUNT_OVERRIDE[format] ?? LINE_COUNT_OVERRIDE["_default" as SegmentFormat] ?? null;
}

function stripFences(raw: string): string {
  let s = raw.trim();
  // Full fence pair: ```json ... ```
  const fence = /^```(?:json|JSON)?\s*\n?([\s\S]*?)\n?```$/;
  const m = s.match(fence);
  if (m) return m[1].trim();
  // Opening fence only (output truncated before closing fence).
  // Strip the opening line and try to parse what's left.
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json|JSON)?\s*\n?/, "");
    // Also strip trailing ``` if it's there but the regex missed it
    s = s.replace(/\n?```\s*$/, "");
  }
  return s.trim();
}

// ── Variant diversity notes ───────────────────────────────────────────
// Injected into the user message so the model produces distinct content
// for each variant. Each variant gets a unique "creative seed" that
// nudges the model toward different topics, moods, and references
// WITHOUT changing the format or the host's voice.

function variantNotes(variant: number, format: SegmentFormat, inWorldTime: string): string {
  // Creative seeds — each variant gets a different thematic nudge
  const SEEDS = [
    "Focus on East Side neighborhoods tonight. Reference Atwood, Willy Street, Tenney Park.",
    "Heavy weather element — wind is picking up, temperature dropping. Characters comment on it.",
    "Quieter night so far — fewer incidents than usual. The calm is making people nervous.",
    "Multiple fires reported. Smoke smell carries across the isthmus. Visibility issues.",
    "Power outages are widespread. Characters work by flashlight/candlelight. Equipment running on backup.",
    "An unusual number of callers tonight. The phone lines are busier than anyone remembers.",
    "West Side focus tonight. Monroe Street, Nakoma, Hilldale references. Action is shifting west.",
    "Helicopters overhead all night. Nobody knows whose they are. Government? Private security?",
    "This is a particularly violent year. The numbers are worse than expected. Everyone knows it.",
    "Strange radio interference tonight. Signal keeps cutting. Technical difficulties are real.",
    "Full moon tonight. Characters remark on the light — you can see too much.",
    "Anniversary of something bad from a previous Purge. Characters dance around mentioning it directly.",
    "Someone important is missing tonight — a regular caller hasn't checked in. Hosts notice.",
    "An unexpectedly quiet, eerie night. The silence is worse than the noise. Something feels wrong.",
  ];

  const seed = SEEDS[variant % SEEDS.length];

  // Time-of-night mood context
  const hour = parseInt(inWorldTime.split(":")[0], 10);
  let moodContext: string;

  if (hour === 19 || hour === 20) {
    moodContext = "MOOD: Early night. Professional, controlled. Hosts are settling into the broadcast. Adrenaline is up but contained. This is the beginning — everyone is alert and competent.";
  } else if (hour === 21 || hour === 22) {
    moodContext = "MOOD: Edge creeping in. The first reports are coming through and they're not good. Hosts maintain composure but cracks are starting to show. Dark humor as a defense mechanism.";
  } else if (hour === 23 || hour === 0) {
    moodContext = "MOOD: Midnight territory. The broadcast has been running for hours. Fatigue and the weight of what's happening are real. Hosts are leaning on their coping mechanisms harder.";
  } else if (hour >= 1 && hour <= 3) {
    moodContext = "MOOD: Darkest hours. This is the worst of the night. Hosts are degrading per their personality (Quinn's mask slipping, Tucker going quiet, Marigold drifting, Holden drowning in data, Caroline tightening). EXCEPTION: Nick stays Nick — energized, cocky, immune to the pressure. Tim gets SHARPER, not worse.";
  } else if (hour === 4) {
    moodContext = "MOOD: The bottom. Maximum strain. Everyone except Nick and Tim is running on fumes. The audience can feel sunrise approaching but it's not here yet. This is the hour people break.";
  } else if (hour === 5) {
    moodContext = "MOOD: Pre-dawn. First light is coming. Hope is returning cautiously — nobody trusts it yet. Relief is mixing with exhaustion. Hosts are starting to sound human again instead of survival machines.";
  } else {
    moodContext = "MOOD: Dawn / sign-off. It's over. Relief, exhaustion, grief for who didn't make it, defiance that the station survived another year. Tim's sign-off is an emotional paragraph — mourning, inspiration, unrelenting spirit. The one time he stops being the operator.";
  }

  // Host-specific character notes for this variant
  let hostNotes = "";
  if (format === "music-block") {
    hostNotes = `
NICK CHARACTER NOTES: Nick does NOT degrade through the night. He is energized by Purge night — this is his reason for existing. He stays cocky, alive, having fun.
- Between songs: roast Holden (affectionate), co-sign whatever Quinn said too enthusiastically, conspiracy theories that escalate as the night goes on, Star Wars and Dune references woven in naturally
- During songs: music nerd facts, band history, why he picked this track
- He's a punk rock nerd who compares the Purge to the spice wars on Arrakis and nobody bats an eye
- Generate 10-20 tracks for this music block (more songs than usual — this is a REAL radio set)`;
  } else if (format === "field-report") {
    hostNotes = `
TUCKER CHARACTER NOTES: Clinical, data-first, treats the Purge like a dataset. Uses they/them pronouns.
- ALSO perpetually fighting their own hardware — installing Linux or Windows or Linux again, switched to Mac and can't figure it out. Sometimes late to their slot because they were partitioning a drive. Reports occasionally cut to "hold on, my laptop just—" then static.
- At 22:00 they're in the field and might get cut off mid-sentence.
- Under stress: pauses between sentences get longer. Never breaks character — just gets quieter.`;
  } else if (format === "sports" || (format === "mixed" && inWorldTime >= "20:00")) {
    hostNotes = `
HOLDEN CHARACTER NOTES: Everything is a chess/board game analogy. Neighborhood defense = "castling." Kill rate spikes = "trading pieces in the middle game." Will pivot from Purge analytics to actual board game tangent until Caroline reels him back. Uses analogies heavily in general speech. Under stress: over-explains, more data, more methodology, longer sentences. Burying fear in spreadsheets.

CAROLINE CHARACTER NOTES: Clipped, professional, cites sources (including NWS even though they're not operating). Under stress: gets shorter, not longer. One-word corrections. Control tightening, not fear showing.

TIM/HOLDEN DYNAMIC: Tim occasionally badgers Holden for real baseball scores even though it's Purge night and there are no games. Tim's one human crack.`;
  } else if (format === "wellness") {
    hostNotes = `
MARIGOLD CHARACTER NOTES: At 23:00 she's coherent, helpful, grounding. By 03:00 the script drifts — free-associating, borderline glossolalia, talking about light and silence and things she's seen that she won't name. Not scared — untethered. Channeling something she didn't invite.`;
  } else if (format === "sign-off") {
    hostNotes = `
TIM SIGN-OFF: This is the emotional climax of the entire broadcast. Tim — who has been nothing but clipped efficiency for 12 hours — delivers a LONG paragraph. Not one sentence. A full, uninterrupted monologue: inspirational, mourning the dead, unrelenting spirit. This is his annual sermon. The one time he stops being the operator and becomes the voice. Make it land.

All other hosts are present but Tim's paragraph is the centerpiece.`;
  } else if (format === "sign-on") {
    hostNotes = `
SIGN-ON: Tim does equipment checks. Quinn sets the tone. Procedural with personality. The Purge is about to start (or just started). This is "we're live, stay inside, here we go."`;
  }

  return `VARIANT DIVERSITY SEED (variant ${variant + 1} of ${PREBAKE_VARIANT_COUNT}):
${seed}

${moodContext}
${hostNotes}

IMPORTANT: This is one of ${PREBAKE_VARIANT_COUNT} pre-generated variants for this time slot. Each variant MUST be substantially different from others — different topics, different specific references, different jokes, different energy. Do NOT produce generic/template content. Be specific, vivid, and unique to this variant's creative seed.${lineCountInstruction(format)}`;
}

function lineCountInstruction(format: SegmentFormat): string {
  const count = lineCountFor(format);
  if (!count) return "";
  return `

CRITICAL LINE COUNT REQUIREMENT: Generate EXACTLY ${count} spoken lines in the "lines" array. Not 8, not 12 — exactly ${count}. This is a long-form broadcast segment that fills a full hour slot. Every line should advance the narrative, reveal character, or build atmosphere. Vary the pacing: some lines are short punchy reactions, some are longer monologues. Keep the voice consistent and specific throughout all ${count} lines. Do NOT pad with filler or repeat yourself — each line must earn its place. Think of this as a full radio show transcript, not a highlight reel.`;
}

// ── Main ──────────────────────────────────────────────────────────────

async function main() {
  const totalVariants = PREBAKE_VARIANT_COUNT;
  const totalSlots = BROADCAST_SCHEDULE.length;
  const totalSegments = totalSlots * totalVariants;

  console.log(`🏴‍☠️ PRGE Pre-Bake — generating ${totalSegments} segments (${totalSlots} slots × ${totalVariants} variants)\n`);

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("❌ ANTHROPIC_API_KEY not set. Add it to .env.local");
    process.exit(1);
  }

  let totalCost = 0;
  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const entry of BROADCAST_SCHEDULE) {
    const format = entry.format;
    const cacheKey = entry.startInWorldTime;

    // Slot filter
    if (SLOT_FILTER && cacheKey !== SLOT_FILTER) continue;
    // Format filter
    if (FORMAT_FILTER && format !== FORMAT_FILTER) continue;

    const startVariant = VARIANT_NUM ?? 0;
    const endVariant = VARIANT_NUM !== null ? VARIANT_NUM + 1 : totalVariants;

    for (let v = startVariant; v < endVariant; v++) {
      const label = `Hour ${entry.hour} · ${cacheKey} · ${entry.title} (${format}) · v${String(v).padStart(2, "0")}`;

      // Check cache unless --force
      if (!FORCE) {
        const cached = await readCached(format, cacheKey, v);
        if (cached) {
          console.log(`  ✅ ${label} — cached, skipping`);
          skipped++;
          continue;
        }
      }

      console.log(`  ⏳ ${label} — generating...`);

      try {
        const notes = variantNotes(v, format, cacheKey);
        const result = await generateSegment({
          format,
          inWorldTime: cacheKey,
          hosts: hostsForFormat(format),
          durationSec: durationForFormat(format),
          daytime: false,
          notes,
        });

        const cleaned = stripFences(result.body);
        const parsed = JSON.parse(cleaned);

        await writeCached(
          {
            format,
            inWorldTime: cacheKey,
            body: parsed,
            generatedAt: new Date().toISOString(),
            modelId: result.modelId,
          },
          v,
        );

        await recordCost(result.usage).catch(() => {});

        const cost = estimateCost(result.usage);
        totalCost += cost;
        generated++;

        console.log(`  ✅ ${label} — done ($${cost.toFixed(4)})`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  ❌ ${label} — FAILED: ${msg}`);
        failed++;
      }

      // Small delay between API calls to avoid rate limiting
      if (generated % 5 === 0 && generated > 0) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  console.log(`\n📻 Pre-bake complete: ${generated} generated, ${skipped} skipped, ${failed} failed`);
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
