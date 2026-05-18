// src/lib/generator.ts
// Calls the Anthropic API with the station bible + a per-format writer prompt + variable context.
// Returns the generated segment as raw text (caller parses JSON).
//
// Per-format wiring:
//   - music-block is THREE-PHASE:
//       A) Pick tracks   — tool-free Haiku call, returns ONLY a track list.
//       B) Research bands — getBandFactsBatch (cache-first; cheap Haiku +
//          web_search on miss, forever cache). Bypasses Anthropic entirely
//          on cache hit, which is the whole point of this refactor.
//       C) Generate segment — tool-free Haiku call with the picked tracks +
//          band-facts injected into the user message. NO web_search at this
//          stage; the model grounds in the provided facts.
//   - All other formats run a single tool-free call (no change from before).

import Anthropic from "@anthropic-ai/sdk";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { SegmentFormat, HostId } from "./types";
import { getBandFactsBatch, type BandFacts } from "./band-facts";
import { getBroadcastPosition } from "./scheduler";
import { formatDaytimeBrandsBlock } from "./daytime-brands";

/**
 * Build the chronology context block injected into every generator user message.
 * Tells the model: "you are at hour X of 12; here is what's aired so far in
 * chronological order; here is the constraint about not referencing the
 * future." Together with station-bible constraint #7 this keeps generated
 * segments anchored to a real point in the broadcast arc.
 *
 * Token cost: ~80-200 tokens depending on how many prior hours have aired.
 * Cheap relative to a 4000-token Phase-C music-block budget.
 *
 * Returns null when called for a daytime (unmanned) slot — callers should
 * skip injecting chronology in that case (daytime music-block skips Phase C
 * entirely; daytime commercials don't need the "earlier tonight" framing).
 */
function buildChronologyContext(inWorldTime: string): string | null {
  const pos = getBroadcastPosition(inWorldTime);
  if (pos.daytime || pos.currentEntry === null) return null;

  const hoursIn = pos.hourIndex + 1;
  const purgeStatusLine = `THE PURGE IS HAPPENING RIGHT NOW. It commenced at 19:00 Madison. We are ${hoursIn} hour${hoursIn > 1 ? "s" : ""} into the 12-hour Purge (use {{ELAPSED}} for the exact elapsed time). It ends at 07:00 tomorrow morning. The Purge is NOT in the future — it is CURRENTLY underway. IMPORTANT: elapsed Purge time is (clock minus 19:00), NOT the clock time itself. If the clock reads 22:00, that is 3 hours elapsed, not 22.`;

  const positionLine = `Broadcast position: hour ${hoursIn} of ${pos.totalHours}. This hour started at ${pos.currentEntry.startInWorldTime} Madison and is the "${pos.currentEntry.title}" slot.`;
  const hostsLine = `Hosts on mic THIS HOUR (use ONLY these names — no other host appears in this segment): ${pos.currentEntry.hosts.join(", ")}.`;

  let airedLine: string;
  if (pos.airedEntries.length === 0) {
    airedLine =
      "Earlier tonight: nothing — this is the first hour of the broadcast. The Purge began moments ago at 19:00.";
  } else {
    const list = pos.airedEntries
      .map(
        (e) =>
          `${e.startInWorldTime} ${e.title} (${e.hosts.join(" + ")})`,
      )
      .join("; ");
    airedLine = `Earlier tonight (aired, audience heard these): ${list}.`;
  }

  const constraintLine =
    "Constraints: (1) The Purge started at 19:00 — NEVER say the Purge is starting soon or in the future. (2) Reference only the aired segments above and pre-19:00 events; nothing later in the schedule has happened yet. (3) Only the listed hosts speak in this segment; do not introduce other hosts even if the bible's character set is larger.";

  return `${purgeStatusLine}\n${positionLine}\n${hostsLine}\n${airedLine}\n${constraintLine}`;
}

// Haiku 4.5 — fast + cheap. Quality is good enough for structured JSON
// segment generation. Opus was 60x more expensive and the voice quality
// difference doesn't justify it for a pirate radio station.
const ANTHROPIC_MODEL = "claude-haiku-4-5";

const PROMPTS_DIR = join(process.cwd(), "src/lib/prompts");

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  // 90-second ceiling. Cold music-block Phase B (web_search × 8 artists) can
  // take 60s; 90s gives headroom without letting a hung TCP socket block the
  // entire dev server forever. The route-level maxDuration (300s) is the outer
  // fence for Vercel; this is the per-call fence for the SDK.
  timeout: 90_000,
});

const promptCache = new Map<string, string>();
async function loadPrompt(name: string): Promise<string> {
  if (promptCache.has(name)) return promptCache.get(name)!;
  const text = await readFile(join(PROMPTS_DIR, name), "utf-8");
  promptCache.set(name, text);
  return text;
}

export interface GenerateSegmentContext {
  format: SegmentFormat;
  /** Madison wall-clock time, "HH:MM" 24h. */
  inWorldTime: string;
  /** Hosts on mic. */
  hosts: HostId[];
  /** Approximate target duration in seconds. */
  durationSec: number;
  /** Anything context-specific (e.g., the previous segment's last line, current schedule beat). */
  notes?: string;
  /** True when generating for the unmanned 07:00–18:59 daytime block. Changes
   *  music-block behavior (Phase A only — no host patter) and trims commercial
   *  framing. Other formats currently treat this as a no-op. */
  daytime?: boolean;
}

export interface GeneratedSegment {
  /** Raw text the model returned. Expected to be JSON matching the format prompt's schema. */
  body: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  modelId: string;
}

type AnthropicUsage = GeneratedSegment["usage"];

/** Sum usage across phases. We surface a single concatenated usage record
 * to the caller so budget accounting stays simple — the cost recorder sees
 * the full cost of the music-block segment as one number. */
function sumUsage(a: AnthropicUsage, b: AnthropicUsage): AnthropicUsage {
  return {
    input_tokens: a.input_tokens + b.input_tokens,
    output_tokens: a.output_tokens + b.output_tokens,
    cache_creation_input_tokens:
      (a.cache_creation_input_tokens ?? 0) + (b.cache_creation_input_tokens ?? 0) ||
      undefined,
    cache_read_input_tokens:
      (a.cache_read_input_tokens ?? 0) + (b.cache_read_input_tokens ?? 0) ||
      undefined,
  };
}

function usageFromResponse(response: Anthropic.Messages.Message): AnthropicUsage {
  return {
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    cache_creation_input_tokens:
      response.usage.cache_creation_input_tokens ?? undefined,
    cache_read_input_tokens: response.usage.cache_read_input_tokens ?? undefined,
  };
}

/**
 * Pull the LAST text block (the model's settled answer) out of an Anthropic
 * response. If the model split its answer across multiple text blocks (rare
 * in practice, but possible after tool turns), concatenate them in order
 * defensively. Throws if there's no text content at all.
 */
function extractFinalText(response: Anthropic.Messages.Message): string {
  const textBlocks = response.content.filter(
    (b): b is Anthropic.Messages.TextBlock => b.type === "text",
  );
  if (textBlocks.length === 0) {
    throw new Error("No text content in Anthropic response");
  }
  return textBlocks.length === 1
    ? textBlocks[0].text
    : textBlocks.map((b) => b.text).join("");
}

/** Strip leading/trailing whitespace and ```json ... ``` code fences. */
function stripFences(raw: string): string {
  let s = raw.trim();
  const fence = /^```(?:json|JSON)?\s*\n?([\s\S]*?)\n?```$/;
  const m = s.match(fence);
  if (m) s = m[1].trim();
  return s;
}

// ─── Generic (non-music-block) single-phase path ───────────────────────────

/** Token budget per format. Music-block's per-phase budgets are handled
 * separately in the three-phase flow; everything else stays tight. */
function maxTokensForFormat(format: SegmentFormat): number {
  if (format === "music-block") return 4000; // unused in three-phase path; reserved for Phase C
  return 1500;
}

async function generateSingleCallSegment(
  ctx: GenerateSegmentContext,
): Promise<GeneratedSegment> {
  const bible = await loadPrompt("station-bible.md");
  const lastYearStats = await loadPrompt("last-year-purge.md");
  const stationMemories = await loadPrompt("station-memories-2168.md");
  // Combine stats + memories into one block to stay within Anthropic's
  // 4-block cache_control limit (bible + lastYear + formatPrompt + userBlock = 4).
  const lastYearRef = `${lastYearStats}\n\n---\n\n${stationMemories}`;
  const formatPrompt = await loadPrompt(`format-${ctx.format}.md`);

  // Chronology only applies during the Purge broadcast. During daytime
  // (commercial-break is the only LLM-touched daytime format) the "earlier
  // tonight" framing is irrelevant — the broadcast isn't on air.
  const chronology = buildChronologyContext(ctx.inWorldTime);
  const chronologyBlock = chronology
    ? `${chronology}\n\n`
    : ctx.daytime
      ? "DAYTIME MODE: the live Purge broadcast is OFF the air. This is an unmanned automation slot. No host patter; just the ad.\n\n"
      : "";

  // Static per-(format, slot). Within a single Madison-minute slot, the
  // chronology + format prompt + bible are identical → prefix cache hits.
  const cachedUserBlock = `Generate a ${ctx.format} segment.

${chronologyBlock}Output: JSON only, no fences, matching the schema in the format prompt.`;

  // Daytime brand list — locked sponsor inventory for the unmanned 07:00–
  // 18:59 commercial slots. Only fires for daytime commercial-breaks. Other
  // formats / nighttime never see this block.
  const daytimeBrandsBlock =
    ctx.daytime && ctx.format === "commercial-break"
      ? `\n\n${formatDaytimeBrandsBlock()}\n\nWrite ad copy ONLY for brands in the list above. Do not invent new daytime brands. 2-4 ads, picked from the list. Each ad must respect its category's brand voice and may quote or riff on the provided tagline seed.`
      : "";

  // Dynamic per-call suffix. The clock label changes per slot.
  const clockLine = ctx.daytime
    ? `MADISON DAYTIME — the clock reads ${ctx.inWorldTime}. Real broadcast resumes at 19:00 Madison. Keep references neutral (no "tonight," no specific Purge framing).`
    : `THE CLOCK READS ${ctx.inWorldTime} Madison. This is the EXACT time on the broadcast clock the audience is looking at right now. Every "what time is it" / "morning/evening/night" reference in your output must match ${ctx.inWorldTime}.

DYNAMIC TIME PLACEHOLDERS — two distinct placeholders, used for DIFFERENT purposes:

  {{CLOCK}} = the current Madison wall-clock time (HH:MM, e.g. "22:38").
      Use for: "The clock reads {{CLOCK}}," "It's {{CLOCK}} Madison time."
      Do NOT use for elapsed time — {{CLOCK}} is NOT how long the Purge has been going.

  {{ELAPSED}} = how long since the Purge started at 19:00 (e.g. "3 hours and 38 minutes").
      Use for: "We're {{ELAPSED}} in," "{{ELAPSED}} since commencement."
      CRITICAL: The Purge starts at 19:00. If the clock reads 22:38, that is 3 hours and 38 minutes elapsed — NOT "22 hours." The math is (current time minus 19:00). The server computes this correctly.

Do NOT write literal times like "22:07" or "three hours and seven minutes" — always use {{CLOCK}} or {{ELAPSED}} as appropriate. The server replaces these on every request so cached content stays accurate.`;
  const dynamicUserBlock = `${clockLine}

Target duration: ${ctx.durationSec}s.${ctx.notes ? `\nNotes: ${ctx.notes}` : ""}${daytimeBrandsBlock}`;

  const response = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: maxTokensForFormat(ctx.format),
    system: [
      { type: "text", text: bible, cache_control: { type: "ephemeral" } },
      { type: "text", text: lastYearRef, cache_control: { type: "ephemeral" } },
      { type: "text", text: formatPrompt, cache_control: { type: "ephemeral" } },
    ],
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: cachedUserBlock,
            cache_control: { type: "ephemeral" },
          },
          { type: "text", text: dynamicUserBlock },
        ],
      },
    ],
  });

  const body = extractFinalText(response);

  return {
    body,
    usage: usageFromResponse(response),
    modelId: response.model,
  };
}

// ─── Music-block three-phase path ──────────────────────────────────────────

/** Minimal Phase-A schema. The model returns only this; we don't trust the
 * fields beyond shape-checking and discard anything else. */
interface PickedTrack {
  artist: string;
  title: string;
  year: number | null;
}

/** Coerce a raw value from JSON into a PickedTrack, or null if it doesn't
 * have the minimum required fields (artist + title). */
function asPickedTrack(raw: unknown): PickedTrack | null {
  if (raw === null || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const artist = typeof r.artist === "string" ? r.artist.trim() : "";
  const title = typeof r.title === "string" ? r.title.trim() : "";
  if (artist.length === 0 || title.length === 0) return null;
  let year: number | null = null;
  if (typeof r.year === "number" && Number.isFinite(r.year)) {
    year = Math.trunc(r.year);
  } else if (typeof r.year === "string") {
    const parsed = Number.parseInt(r.year, 10);
    if (Number.isFinite(parsed)) year = parsed;
  }
  return { artist, title, year };
}

/**
 * Phase A — pick the track list. Cheap tool-free call. We give the model the
 * station bible + the music-block format prompt + a "tracks only" instruction
 * so it returns the minimum data we need to drive Phase B. The full segment
 * (intro/fact/outro lines) is NOT generated here — it would be wasted output
 * since we're going to call the model again with grounding facts.
 */
async function generateMusicBlockTracks(
  ctx: GenerateSegmentContext,
): Promise<{ tracks: PickedTrack[]; usage: AnthropicUsage; modelId: string }> {
  const bible = await loadPrompt("station-bible.md");
  const formatPrompt = await loadPrompt("format-music-block.md");

  // Daytime is the unmanned block — no chronology, less collapse-hour weight,
  // catalog-broad picks. Purge nighttime keeps the full chronology + hour
  // energy framing.
  const chronology = buildChronologyContext(ctx.inWorldTime);
  const energyLine = ctx.daytime
    ? "DAYTIME MODE — pick neutral catalog tracks across Nick's full punk inventory. No collapse-hour weighting, no midnight-cocky framing. The audience is mid-day; treat the rotation as the rig's autoplay between Purge nights."
    : "Tracks should fit the time-of-day energy (midnight = cocky, 4am = collapse hour) and vary across the bible's listed bands.";
  const chronologyBlock = chronology ? `${chronology}\n\n` : "";

  // Static per-slot for Phase A: same hour = same chronology = same instruction.
  const cachedUserBlock = `Phase 1 of music-block generation: pick the track list ONLY.

${chronologyBlock}Pick 4-8 real punk tracks from the catalog described in the format prompt. ${energyLine}

Output: JSON only, no prose, no fences, matching this shape:

{
  "tracks": [
    { "artist": "Ramones", "title": "Blitzkrieg Bop", "year": 1976 }
  ]
}

Year is your best estimate; null is acceptable if uncertain.`;

  const clockLine = ctx.daytime
    ? `MADISON DAYTIME — the clock reads ${ctx.inWorldTime}. Real broadcast resumes at 19:00. Pick neutral catalog tracks — no hour-specific energy weighting.`
    : `THE IN-WORLD CLOCK READS ${ctx.inWorldTime}. Pick tracks appropriate to that hour (e.g., 00:xx = midnight-cocky; 04:xx = collapse-hour quiet). This is a track-list-only phase — no dialogue, so no {{CLOCK}} placeholders needed here.`;
  const dynamicUserBlock = `${clockLine}

Target duration: ${ctx.durationSec}s.`;

  const response = await client.messages.create({
    model: ANTHROPIC_MODEL,
    // Just a short JSON list — no need for the full 4000-token Phase-C budget.
    max_tokens: 800,
    system: [
      { type: "text", text: bible, cache_control: { type: "ephemeral" } },
      { type: "text", text: formatPrompt, cache_control: { type: "ephemeral" } },
    ],
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: cachedUserBlock,
            cache_control: { type: "ephemeral" },
          },
          { type: "text", text: dynamicUserBlock },
        ],
      },
    ],
  });

  const raw = extractFinalText(response);
  const cleaned = stripFences(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(
      `Phase A (tracks) JSON parse failed: ${err instanceof Error ? err.message : String(err)}. Raw: ${raw.slice(0, 300)}`,
    );
  }

  if (parsed === null || typeof parsed !== "object") {
    throw new Error("Phase A returned non-object");
  }
  const rawTracks = (parsed as Record<string, unknown>).tracks;
  if (!Array.isArray(rawTracks)) {
    throw new Error("Phase A returned object without `tracks` array");
  }
  const tracks: PickedTrack[] = [];
  for (const t of rawTracks) {
    const picked = asPickedTrack(t);
    if (picked) tracks.push(picked);
  }
  if (tracks.length === 0) {
    throw new Error("Phase A returned zero valid tracks");
  }

  return {
    tracks,
    usage: usageFromResponse(response),
    modelId: response.model,
  };
}

/**
 * Format the band-facts blob for Phase C's user message. Plain text section
 * the model can lean on as ground truth. Bracketed delimiters make it easy
 * for the model to recognize and quote from.
 */
function formatBandFactsBlock(facts: BandFacts[]): string {
  const sections = facts.map(
    (f) => `--- ${f.displayName} ---\n${f.rawNotes}`,
  );
  return `=== BAND FACTS ===\n${sections.join("\n\n")}\n=== END BAND FACTS ===`;
}

/**
 * Phase C — generate the full segment from the picked tracks + band facts.
 * No web_search at this stage — the facts are already in context. The model
 * just has to write Nick's voice around them.
 */
async function generateMusicBlockWithFacts(
  ctx: GenerateSegmentContext,
  tracks: PickedTrack[],
  bandFacts: BandFacts[],
): Promise<{ body: string; usage: AnthropicUsage; modelId: string }> {
  const bible = await loadPrompt("station-bible.md");
  const lastYearStats = await loadPrompt("last-year-purge.md");
  const stationMemories = await loadPrompt("station-memories-2168.md");
  const lastYearRef = `${lastYearStats}\n\n---\n\n${stationMemories}`;
  const formatPrompt = await loadPrompt("format-music-block.md");

  const trackList = tracks
    .map(
      (t, i) =>
        `${i + 1}. "${t.title}" — ${t.artist}${t.year !== null ? ` (${t.year})` : ""}`,
    )
    .join("\n");

  // Phase C only fires for nighttime music-blocks. Daytime music-blocks short-
  // circuit at the generateMusicBlock dispatcher and never reach Phase C.
  // chronology is therefore always present here in normal operation; we still
  // guard against null defensively so a stale daytime invocation surfaces
  // clearly instead of crashing in a string template.
  const chronology = buildChronologyContext(ctx.inWorldTime);
  if (chronology === null) {
    throw new Error(
      "Phase C reached for a daytime slot — daytime music-block should skip Phase C entirely",
    );
  }

  // Phase C static-per-slot block. Track list + band facts are unique per
  // call so they go in the dynamic suffix below.
  const cachedUserBlock = `Generate a music-block segment.

${chronology}

Ground every fact line in the BAND FACTS material provided in this message. Do not invent facts beyond what's provided.

Output: JSON only, no fences, matching the schema in the format prompt.`;

  const dynamicUserBlock = `THE CLOCK READS ${ctx.inWorldTime} Madison. This is the EXACT time on the broadcast clock the audience is looking at right now. Every "what time is it" / "morning/evening/night" reference in your output must match ${ctx.inWorldTime}.

DYNAMIC TIME PLACEHOLDERS — two distinct placeholders, used for DIFFERENT purposes:

  {{CLOCK}} = the current Madison wall-clock time (HH:MM, e.g. "22:38").
      Use for: "The clock reads {{CLOCK}}," "It's {{CLOCK}} Madison time."
      Do NOT use for elapsed time — {{CLOCK}} is NOT how long the Purge has been going.

  {{ELAPSED}} = how long since the Purge started at 19:00 (e.g. "3 hours and 38 minutes").
      Use for: "We're {{ELAPSED}} in," "{{ELAPSED}} since commencement."
      CRITICAL: The Purge starts at 19:00. If the clock reads 22:38, that is 3 hours and 38 minutes elapsed — NOT "22 hours." The math is (current time minus 19:00). The server computes this correctly.

Do NOT write literal times — always use {{CLOCK}} or {{ELAPSED}} as appropriate.

Target duration: ${ctx.durationSec}s.${ctx.notes ? `\nNotes: ${ctx.notes}` : ""}

=== TRACK LIST (use exactly these, in this order) ===
${trackList}

${formatBandFactsBlock(bandFacts)}`;

  const response = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: maxTokensForFormat("music-block"),
    system: [
      { type: "text", text: bible, cache_control: { type: "ephemeral" } },
      { type: "text", text: lastYearRef, cache_control: { type: "ephemeral" } },
      { type: "text", text: formatPrompt, cache_control: { type: "ephemeral" } },
    ],
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: cachedUserBlock,
            cache_control: { type: "ephemeral" },
          },
          { type: "text", text: dynamicUserBlock },
        ],
      },
    ],
  });

  return {
    body: extractFinalText(response),
    usage: usageFromResponse(response),
    modelId: response.model,
  };
}

/** Dedupe artists for band-facts research. Order-preserving so the returned
 * facts can be passed straight to Phase C in a stable layout. */
function uniqueArtists(tracks: PickedTrack[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tracks) {
    const k = t.artist.trim().toLowerCase();
    if (k.length === 0 || seen.has(k)) continue;
    seen.add(k);
    out.push(t.artist.trim());
  }
  return out;
}

/**
 * Synthesize a daytime music-block body. Skips Phase B (no band facts needed
 * without patter) and Phase C entirely. The player gets a tracks-only segment
 * with empty `lines` arrays — the layout already handles that path via
 * MusicBlockLayout's fallback. Daytime ticker carries a "PRGE returns at 19:00"
 * card so the audience knows what they're hearing.
 */
function buildDaytimeMusicBody(
  ctx: GenerateSegmentContext,
  tracks: PickedTrack[],
): string {
  const body = {
    type: "music-block" as const,
    tracks: tracks.map((t) => ({
      title: t.title,
      artist: t.artist,
      year: t.year ?? undefined,
      lines: [] as Array<{ host: string; text: string }>,
    })),
    lines: [],
    tickerItems: [
      {
        category: "local-news",
        text: "PRGE daytime feed — automated music until 19:00 Madison sign-on",
      },
    ],
    // Smuggle the daytime flag through to the player via a top-level marker.
    // The frontend can render a "UNMANNED · AUTOPLAY" cue without re-deriving
    // the clock state from scratch. Unknown to the LLM path so we set it here.
    daytime: true,
  };
  void ctx; // ctx is only used for Phase A track picking; nothing else here.
  return JSON.stringify(body);
}

async function generateMusicBlock(
  ctx: GenerateSegmentContext,
): Promise<GeneratedSegment> {
  // Phase A — pick tracks. Daytime tweaks Phase A's prompt (neutral catalog
  // picks, no collapse-hour weighting); see generateMusicBlockTracks.
  const phaseA = await generateMusicBlockTracks(ctx);

  // Daytime short-circuit: skip Phase B (no patter = no band-fact need) and
  // Phase C (no LLM call to write Nick's voice — there is no Nick). Synthesize
  // a tracks-only body so the player just rotates tracks. Cost lands at
  // Phase A only (~$0.005/call).
  if (ctx.daytime) {
    return {
      body: buildDaytimeMusicBody(ctx, phaseA.tracks),
      usage: phaseA.usage,
      modelId: phaseA.modelId,
    };
  }

  // Phase B — research each unique band. Cache-first; only misses cost
  // money. This is the whole point of the refactor.
  const artists = uniqueArtists(phaseA.tracks);
  const bandFacts = await getBandFactsBatch(artists);

  // Phase C — write the segment with facts grounded.
  const phaseC = await generateMusicBlockWithFacts(
    ctx,
    phaseA.tracks,
    bandFacts,
  );

  // Note on usage accounting: Phase B (band-facts) calls go through a
  // separate Anthropic path and don't roll into this Phase A+C usage record.
  // That's intentional — band-facts research happens at most once per band
  // EVER, and on cache hit Phase B is free. Bundling its cost into the
  // per-segment usage would over-attribute spend on the first generation
  // after a fresh band, and under-attribute on every subsequent regen.
  // Leaving it separate keeps the per-segment budget signal clean.
  return {
    body: phaseC.body,
    usage: sumUsage(phaseA.usage, phaseC.usage),
    modelId: phaseC.modelId,
  };
}

// ─── Public entry point ────────────────────────────────────────────────────

export async function generateSegment(
  ctx: GenerateSegmentContext,
): Promise<GeneratedSegment> {
  if (ctx.format === "music-block") {
    return generateMusicBlock(ctx);
  }
  return generateSingleCallSegment(ctx);
}
