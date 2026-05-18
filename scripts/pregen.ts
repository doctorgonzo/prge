// scripts/pregen.ts
// Offline broadcast pre-generation CLI for PRGE.
//
// Walks BROADCAST_SCHEDULE and generates ONE segment per hour-block (12 total),
// writing each result to .prge/segments/ so the live API never has to call
// Anthropic during demo traffic.
//
// Usage:
//   npm run pregen
//   npm run pregen -- --format=news
//   npm run pregen -- --force          # burn tokens, regenerate everything
//   npm run pregen -- --dry-run        # no API calls, no writes — just log
//
// Env loading:
//   The npm script invokes via `tsx --env-file=.env.local`, which Node loads
//   natively. If that ever fails to inject (older Node, weird shell), fall back
//   to shell-exported env:
//     set -a; source .env.local; set +a; npx tsx scripts/pregen.ts
//
// Safety:
//   - Re-running is cheap & idempotent thanks to the disk cache (each entry
//     skips with [CACHED] if already present, unless --force).
//   - Budget gate runs before every generation; the script bails (exit 1) the
//     moment we cross the daily cap, logging how many slots remain unfilled.
//   - On parse failure we log the raw output prefix, bump a counter, and keep
//     going — one flaky JSON response shouldn't kill the whole run.

import { BROADCAST_SCHEDULE } from "../src/lib/scheduler";
import { generateSegment } from "../src/lib/generator";
import { readCached, writeCached } from "../src/lib/cache";
import { budgetStatus, recordCost, costForUsage } from "../src/lib/budget";
import type { SegmentFormat } from "../src/lib/types";

// ---------------------------------------------------------------------------
// CLI flag parsing
// ---------------------------------------------------------------------------

interface CliFlags {
  format: SegmentFormat | null;
  force: boolean;
  dryRun: boolean;
}

function parseFlags(argv: readonly string[]): CliFlags {
  let format: SegmentFormat | null = null;
  let force = false;
  let dryRun = false;

  for (const arg of argv) {
    if (arg === "--force") {
      force = true;
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg.startsWith("--format=")) {
      format = arg.slice("--format=".length) as SegmentFormat;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      console.warn(`[pregen] Unknown arg: ${arg} (ignored)`);
    }
  }

  return { format, force, dryRun };
}

function printHelp(): void {
  console.log(
    [
      "Usage: npm run pregen [-- <flags>]",
      "",
      "Flags:",
      "  --format=<id>   Only pre-gen entries matching this format (e.g. news, wellness).",
      "  --force         Ignore existing cache and regenerate. Burns tokens.",
      "  --dry-run       Don't call the API or write files; just log what would happen.",
      "  -h, --help      Show this help.",
    ].join("\n"),
  );
}

// ---------------------------------------------------------------------------
// Output helpers — mirror the API route's fence-stripping behavior.
// ---------------------------------------------------------------------------

/** Strip leading/trailing whitespace and ```json ... ``` code fences from a model body. */
function stripFences(raw: string): string {
  let s = raw.trim();
  const fence = /^```(?:json|JSON)?\s*\n?([\s\S]*?)\n?```$/;
  const m = s.match(fence);
  if (m) s = m[1].trim();
  return s;
}

function fmtUsd(n: number): string {
  return `$${n.toFixed(4)}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

interface RunStats {
  generated: number;
  cached: number;
  failed: number;
  skipped: number;
  spentUsdThisRun: number;
}

async function main(): Promise<number> {
  const flags = parseFlags(process.argv.slice(2));

  console.log("[pregen] PRGE broadcast pre-generation");
  console.log(
    `[pregen] flags: format=${flags.format ?? "*"} force=${flags.force} dry-run=${flags.dryRun}`,
  );

  // Filter the schedule by --format if requested.
  const targets = flags.format
    ? BROADCAST_SCHEDULE.filter((e) => e.format === flags.format)
    : BROADCAST_SCHEDULE;

  if (targets.length === 0) {
    console.error(
      `[pregen] No schedule entries match --format=${flags.format}. Nothing to do.`,
    );
    return 1;
  }

  console.log(
    `[pregen] target entries: ${targets.length} / ${BROADCAST_SCHEDULE.length}`,
  );

  // Budget status at start of run — informational, useful for the operator.
  const initialBudget = await budgetStatus();
  console.log(
    `[pregen] budget at start: spent=${fmtUsd(initialBudget.spentUsd)} cap=${fmtUsd(
      initialBudget.capUsd,
    )} remaining=${fmtUsd(initialBudget.remainingUsd)} calls=${initialBudget.callCountToday}`,
  );

  const stats: RunStats = {
    generated: 0,
    cached: 0,
    failed: 0,
    skipped: 0,
    spentUsdThisRun: 0,
  };

  for (let i = 0; i < targets.length; i++) {
    const entry = targets[i];
    const slotLabel = `${entry.format} @ ${entry.startInWorldTime}`;
    const progress = `[${i + 1}/${targets.length}]`;

    // 1. Budget gate. Bail loudly if we're already over the cap — note the
    //    "allowed" flag flips false the moment we cross, so a long run won't
    //    silently blow past the limit.
    const budget = await budgetStatus();
    if (!budget.allowed) {
      const unfilled = targets.length - i;
      console.error(
        `[pregen] ${progress} BUDGET EXCEEDED before ${slotLabel}: ` +
          `spent=${fmtUsd(budget.spentUsd)} cap=${fmtUsd(budget.capUsd)}. ` +
          `${unfilled} segment(s) remain unfilled. Bailing.`,
      );
      stats.skipped = unfilled;
      return summarize(stats, targets.length, 1);
    }

    // 2. Cache check (unless --force).
    if (!flags.force) {
      const cached = await readCached(entry.format, entry.startInWorldTime);
      if (cached) {
        console.log(`${progress} [CACHED] ${slotLabel}`);
        stats.cached++;
        continue;
      }
    }

    // 3. Dry run short-circuit — log the intent and move on.
    if (flags.dryRun) {
      console.log(
        `${progress} [DRY  ] ${slotLabel} · would call generateSegment(hosts=[${entry.hosts.join(
          ",",
        )}], durationSec=${entry.durationSec})`,
      );
      stats.generated++;
      continue;
    }

    // 4. Generate.
    const startedAt = Date.now();
    let generated;
    try {
      generated = await generateSegment({
        format: entry.format,
        inWorldTime: entry.startInWorldTime,
        hosts: [...entry.hosts],
        durationSec: entry.durationSec,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`${progress} [FAIL ] ${slotLabel} · API error: ${msg}`);
      stats.failed++;
      // Be polite even on failure — Anthropic 5xx loops shouldn't hammer.
      await sleep(500);
      continue;
    }

    // 5. Strip fences + parse JSON in try/catch. On parse failure, log raw
    //    prefix and continue — don't kill the whole run on one flaky response.
    const cleaned = stripFences(generated.body);
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        `${progress} [FAIL ] ${slotLabel} · JSON parse error: ${msg}`,
      );
      console.error(
        `${progress}         raw (first 500 chars): ${generated.body.slice(0, 500)}`,
      );
      stats.failed++;
      // Still record the cost — we paid for the tokens regardless.
      await recordCost(generated.usage).catch((e) =>
        console.error(`[pregen] recordCost failed: ${e}`),
      );
      stats.spentUsdThisRun += costForUsage(generated.usage);
      await sleep(500);
      continue;
    }

    // 6. Persist cache + record cost.
    const cost = costForUsage(generated.usage);
    try {
      await writeCached({
        format: entry.format,
        inWorldTime: entry.startInWorldTime,
        body: parsed,
        generatedAt: new Date().toISOString(),
        modelId: generated.modelId,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        `${progress} [WARN ] ${slotLabel} · writeCached failed: ${msg} (continuing)`,
      );
    }

    await recordCost(generated.usage).catch((e) =>
      console.error(`[pregen] recordCost failed: ${e}`),
    );
    stats.spentUsdThisRun += cost;
    stats.generated++;

    const elapsedMs = Date.now() - startedAt;
    console.log(
      `${progress} [GEN  ] ${slotLabel} · ${fmtUsd(cost)} · ${elapsedMs}ms`,
    );

    // 7. Polite delay between calls. Skip on the last iteration.
    if (i < targets.length - 1) {
      await sleep(500);
    }
  }

  return summarize(stats, targets.length, stats.failed > 0 ? 1 : 0);
}

async function summarize(
  stats: RunStats,
  total: number,
  exitCode: number,
): Promise<number> {
  const finalBudget = await budgetStatus();

  console.log("");
  console.log("[pregen] ──── summary ────");
  console.log(`[pregen]  Generated : ${stats.generated}`);
  console.log(`[pregen]  Cached    : ${stats.cached}`);
  console.log(`[pregen]  Failed    : ${stats.failed}`);
  if (stats.skipped > 0) {
    console.log(`[pregen]  Skipped   : ${stats.skipped} (budget bailout)`);
  }
  console.log(`[pregen]  Total     : ${total}`);
  console.log(`[pregen]  Spend (this run) : ${fmtUsd(stats.spentUsdThisRun)}`);
  console.log(
    `[pregen]  Spend (today)    : ${fmtUsd(finalBudget.spentUsd)} / ${fmtUsd(
      finalBudget.capUsd,
    )} cap (${finalBudget.callCountToday} calls)`,
  );
  console.log("");

  return exitCode;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error("[pregen] fatal:", err);
    process.exit(1);
  });
