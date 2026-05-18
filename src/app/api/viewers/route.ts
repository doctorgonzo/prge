// src/app/api/viewers/route.ts
//
// Real-time viewer tracking for the PRGE broadcast HUD.
//
// Two numbers:
//   RECEIVERS  — fake in-universe count of Madison listeners tuned to PRGE's
//                frequency. Time-curved, jittered, deterministic within a 30s
//                polling window so all clients see the same number.
//   ANOMALOUS  — actual unique visitors with a heartbeat in the last 90 seconds.
//                Tim's equipment can't explain these signal locks from outside
//                the broadcast radius. They're us.
//
// In-memory session map resets on cold start. That's fine — the fake count is
// always there as baseline, and the real count rebuilds within one heartbeat
// cycle (45s).

import { NextResponse } from "next/server";

// ── Session tracking ──────────────────────────────────────────────────
// sessionId → last heartbeat timestamp (epoch ms)
const sessions: Map<string, number> = new Map();

const SESSION_TTL_MS = 90_000; // 90 seconds — dead if no heartbeat

function pruneStale() {
  const cutoff = Date.now() - SESSION_TTL_MS;
  const stale: string[] = [];
  sessions.forEach((ts, id) => {
    if (ts < cutoff) stale.push(id);
  });
  stale.forEach((id) => sessions.delete(id));
}

function realCount(): number {
  pruneStale();
  return sessions.size;
}

// ── Fake count: time-curved Madison receiver estimate ─────────────────
//
// The curve models a pirate radio audience in a city under Purge lockdown.
// People tune in as night falls, word spreads, peaks around midnight-1am,
// then thins out as dawn approaches. Sign-off spike at 6:30am as regulars
// catch the farewell.
//
// Input: "HH:MM" in Madison wall-clock time (24-hour).

/** Deterministic seeded jitter — same seed = same jitter within a window. */
function seededRandom(seed: number): number {
  // Simple hash-based PRNG (good enough for jitter, not crypto)
  let x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  x = x - Math.floor(x);
  return x;
}

/** Convert "HH:MM" to fractional hours (e.g. "21:30" → 21.5). */
function parseHHMM(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h + m / 60;
}

/**
 * Base receiver count for a given fractional hour.
 * Piecewise linear interpolation between anchor points.
 */
function baseCurve(hour: number): number {
  // Anchor points: [fractionalHour, receiverCount]
  // The broadcast runs 19:00 → ~06:30.
  const anchors: [number, number][] = [
    [7, 0],       // off-air morning — nobody
    [18, 50],     // pre-broadcast hum — a few scanners
    [19, 800],    // sign-on: word is out, people tune in
    [20, 1000],   // settling in
    [21, 1200],   // prime time building
    [22, 1600],   // peak approach
    [23, 2400],   // late night surge
    [0, 3500],    // midnight peak
    [1, 3200],    // holding strong
    [2, 2800],    // starting to thin
    [3, 2000],    // deep night
    [4, 1400],    // the faithful
    [5, 800],     // dawn thinning
    [6, 400],     // almost done
    [6.5, 1800],  // sign-off spike — regulars tune in for farewell
    [6.75, 600],  // post sign-off drop
    [7, 0],       // off air
  ];

  // Wrap to handle the midnight crossing: if hour < 7, treat as hour + 24
  // for interpolation purposes, and add matching anchor copies.
  const normalizedHour = hour < 7 ? hour + 24 : hour;
  const extendedAnchors = anchors.map(
    ([h, c]) => [h < 7 ? h + 24 : h, c] as [number, number]
  );

  // Sort by hour
  extendedAnchors.sort((a, b) => a[0] - b[0]);

  // Clamp at boundaries
  if (normalizedHour <= extendedAnchors[0][0]) return extendedAnchors[0][1];
  if (normalizedHour >= extendedAnchors[extendedAnchors.length - 1][0]) {
    return extendedAnchors[extendedAnchors.length - 1][1];
  }

  // Linear interpolation between surrounding anchors
  for (let i = 0; i < extendedAnchors.length - 1; i++) {
    const [h1, c1] = extendedAnchors[i];
    const [h2, c2] = extendedAnchors[i + 1];
    if (normalizedHour >= h1 && normalizedHour <= h2) {
      const t = (normalizedHour - h1) / (h2 - h1);
      return Math.round(c1 + t * (c2 - c1));
    }
  }

  return 800; // fallback
}

/**
 * Compute the fake receiver count for a given in-world time.
 * Adds jitter (consistent within a 30s window) and occasional spikes.
 */
function fakeCount(inWorldTime: string): number {
  const hour = parseHHMM(inWorldTime);
  const base = baseCurve(hour);

  if (base === 0) return 0; // off-air

  // Jitter seed: quantize to 30s windows so all clients polling within the
  // same window see the same number.
  const now = Date.now();
  const windowIndex = Math.floor(now / 30_000);
  const jitterSeed = windowIndex * 7919 + Math.floor(hour * 100);
  const jitter = seededRandom(jitterSeed);

  // ±8% jitter around base
  const jitterRange = base * 0.08;
  const jittered = base + (jitter * 2 - 1) * jitterRange;

  // Occasional spike at hour boundaries: if we're within 2 minutes of an
  // hour mark and the second jitter seed says yes (~40% chance), add a spike.
  const minuteInHour = (hour % 1) * 60;
  let spike = 0;
  if (minuteInHour < 2 || minuteInHour > 58) {
    const spikeSeed = windowIndex * 1301 + Math.floor(hour);
    const spikeRoll = seededRandom(spikeSeed);
    if (spikeRoll > 0.6) {
      spike = 200 + Math.floor(spikeRoll * 300); // +200 to +500
    }
  }

  return Math.max(0, Math.round(jittered + spike));
}

// ── Route handlers ────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sessionId, inWorldTime } = body as {
      sessionId?: string;
      inWorldTime?: string;
    };

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json(
        { error: "sessionId required" },
        { status: 400 }
      );
    }

    // Record/refresh heartbeat
    sessions.set(sessionId, Date.now());

    // Compute counts
    const time = typeof inWorldTime === "string" ? inWorldTime : "00:00";
    return NextResponse.json({
      realCount: realCount(),
      fakeCount: fakeCount(time),
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

export async function GET(req: Request) {
  // Optional inWorldTime from query params (for initial load)
  const url = new URL(req.url);
  const time = url.searchParams.get("t") ?? "00:00";

  return NextResponse.json({
    realCount: realCount(),
    fakeCount: fakeCount(time),
  });
}
