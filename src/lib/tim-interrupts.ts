// src/lib/tim-interrupts.ts
// Pre-baked emergency broadcast interruptions from Tim Peplinski. These are
// full-screen "all programming stops" moments — Tim cuts the feed and talks
// to Madison directly. NOT the gentle daytime bumpers (those are in
// tim-bumpers.ts). These are Purge-night operational alerts.
//
// Tim's voice: competent, calm under pressure, protective. Short punchy
// sentences. He's not panicking — he's managing. Midwest baritone, no
// embellishment, says what needs saying and gets off the mic.
//
// Severity escalation:
//   1 = routine technical (signal issues, relay switching, jamming attempts)
//   2 = moderate alert (zone activity, gunfire reports, road blockages)
//   3 = critical emergency (station compromise, lost contact, grid failure)
//
// Hour gating via minHour prevents late-game interrupts from firing at 7pm.
// The picker functions bias toward higher severity as the night deepens.

export interface TimInterrupt {
  /** Severity: 1 = routine technical, 2 = moderate alert, 3 = critical emergency */
  severity: 1 | 2 | 3;
  /** Lines Tim says during the interrupt */
  lines: string[];
  /** Minimum hour index (0-11, where 0=7pm, 5=midnight, 11=6am) for this to trigger. Null = any time. */
  minHour?: number;
}

const POOL: readonly TimInterrupt[] = [
  // ── Severity 1: Technical / Signal ───────────────────────────────────

  {
    severity: 1,
    lines: [
      "Pep here. Signal's getting choppy on the north side.",
      "Switching to the backup relay on Bascom Hill. Give it ten seconds.",
      "Should be clean now. Back to programming.",
    ],
  },
  {
    severity: 1,
    lines: [
      "Quick operator note. Someone's running a broadband jammer on the 87 megahertz band.",
      "I'm hopping frequencies. If you lose us, scan between 86 and 89. We'll be there.",
    ],
  },
  {
    severity: 1,
    lines: [
      "Tim Peplinski. We're getting some interference off the Beltline corridor.",
      "Probably a mobile unit. Not targeting us specifically.",
      "Boosting output by twelve watts. Shouldn't need to do more than that.",
    ],
  },
  {
    severity: 1,
    lines: [
      "Operator notice. Backup transmitter just kicked on.",
      "Primary antenna is still up. This is precautionary.",
      "If you heard a pop — that was the switchover. Normal.",
    ],
  },
  {
    severity: 1,
    lines: [
      "Getting some triangulation pings on the signal. Three sweeps in two minutes.",
      "Rotating the directional array. They'll get scatter, not a fix.",
      "We've done this before. Carry on.",
    ],
    minHour: 2,
  },
  {
    severity: 1,
    lines: [
      "Pep here. Dropped the feed for about four seconds there. My fault.",
      "Tripped the breaker swapping a capacitor. We're back. Won't happen again.",
    ],
  },
  {
    severity: 1,
    lines: [
      "Quick note — the repeater on Picnic Point just went dark.",
      "West-side listeners, you might need to adjust your antenna.",
      "I'm rerouting through the Camp Randall relay. Signal should hold.",
    ],
    minHour: 1,
  },

  // ── Severity 2: Zone Alerts ──────────────────────────────────────────

  {
    severity: 2,
    lines: [
      "This is an area alert. Armed group moving east on Willy Street. Eight to ten individuals.",
      "If you're between Baldwin and Few — stay dark. No lights, no noise.",
      "They're moving fast. Should clear your block in fifteen minutes.",
    ],
  },
  {
    severity: 2,
    lines: [
      "Zone alert. Sustained gunfire reported near Tenney Park.",
      "Multiple weapons. This is not a single incident.",
      "Avoid the 300 block of Sherman Ave. Route through Johnson if you have to move.",
    ],
    minHour: 1,
  },
  {
    severity: 2,
    lines: [
      "Pep here. Fire on East Wash between First and Brearly.",
      "Structure fire. Spreading east with the wind.",
      "Nobody's coming to put it out. You know the drill. Get upwind.",
    ],
    minHour: 2,
  },
  {
    severity: 2,
    lines: [
      "Area alert for Monroe Street. Road blockade at the Trader Joe's intersection.",
      "Looks organized. Vehicles across both lanes. Not letting people through.",
      "Find another route. Do not approach. Do not negotiate.",
    ],
  },
  {
    severity: 2,
    lines: [
      "Movement near State Street. Large group heading toward the Capitol Square.",
      "Unknown intent. Could be runners, could be organized.",
      "If you're sheltered on Mifflin or Dayton — stay put. Let them pass.",
    ],
    minHour: 1,
  },
  {
    severity: 2,
    lines: [
      "Alert for the Atwood corridor. Vehicle convoy moving south on Atwood Ave.",
      "Three trucks. Headlights off. That's never recreational.",
      "Schenk's Corners residents — basement. Now.",
    ],
    minHour: 3,
  },
  {
    severity: 2,
    lines: [
      "Monona Bay area. Small arms fire from the Olin Park treeline.",
      "Rounds are carrying across the water. John Nolen is not safe to cross.",
      "If you're on the Isthmus you're fine. Stay there.",
    ],
    minHour: 2,
  },
  {
    severity: 2,
    lines: [
      "Zone report. Camp Randall perimeter is hot. People sheltering in the concourse.",
      "If that's you — the east gates are compromised. Move to the field level.",
      "Tim Peplinski. Stay low.",
    ],
    minHour: 4,
  },

  // ── Severity 3: Critical ─────────────────────────────────────────────

  {
    severity: 3,
    lines: [
      "All programming stops. This is Tim.",
      "We just had a vehicle pass within two blocks of the station. Slow. Scanning.",
      "I've killed the exterior lights. Cutting output power to minimum.",
      "If we drop off the air — scan 88.1. That's the fallback.",
      "Okay. They've moved on. Bringing power back up. That was close.",
    ],
    minHour: 3,
  },
  {
    severity: 3,
    lines: [
      "This is Pep. I need everyone to listen.",
      "Tucker missed his last two check-ins. He was on foot near Williamson Street.",
      "If anyone has eyes on Tucker Traywick — six-one, brown jacket, camera rig — key your radio to channel four.",
      "Tucker, if you can hear this broadcast, give me something. Anything.",
    ],
    minHour: 4,
  },
  {
    severity: 3,
    lines: [
      "Emergency. Power grid just dropped across the east side.",
      "We're on battery backup. I have about ninety minutes of juice.",
      "Holden — if you're listening — I need you at the generator. Now.",
      "Madison, we are not going dark. Not tonight. Stay with us.",
    ],
    minHour: 5,
  },
  {
    severity: 3,
    lines: [
      "All stop. Government jammer truck spotted on University Ave heading east.",
      "If they get within range we lose everything. Estimated four minutes.",
      "I'm switching to the buried antenna. Signal will be weaker but they can't kill it.",
      "We stay on the air. That's the whole point.",
    ],
    minHour: 5,
  },
  {
    severity: 3,
    lines: [
      "This is an all-station alert. Do not trust the all-clear signal.",
      "Official channels are broadcasting end-of-Purge. It is not seven a.m.",
      "Repeat — the all-clear is false. The Purge is still active.",
      "Stay inside. Stay armed. Stay quiet. Trust the clock, not the siren.",
    ],
    minHour: 7,
  },
  {
    severity: 3,
    lines: [
      "Pep here. We've got a situation.",
      "Someone breached the outer door. Could be weather. Could be someone looking for the signal.",
      "Quinn — you're on the mic. I'm going downstairs.",
      "Madison, if I don't come back on in five minutes, Quinn takes the chair. That's the protocol.",
    ],
    minHour: 6,
  },
  {
    severity: 3,
    lines: [
      "This is Tim Peplinski. The backup generator just died.",
      "We are broadcasting on laptop battery. I have maybe forty minutes.",
      "Every word from here out counts. No music. No filler. Just information.",
      "We hold the line until sunrise. That's all that matters.",
    ],
    minHour: 8,
  },
] as const;

// ── Utilities ────────────────────────────────────────────────────────────

/** Simple deterministic hash — same as tim-bumpers.ts / nick-cut-ins.ts. */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return h;
}

/**
 * Deterministic pick from the full pool, seeded by an arbitrary string.
 * Same seed always returns the same interrupt.
 */
export function pickTimInterrupt(seed: string): TimInterrupt {
  const h = hash(seed);
  const idx = ((h % POOL.length) + POOL.length) % POOL.length;
  return POOL[idx];
}

/**
 * Non-deterministic pick — returns a random interrupt from the full pool.
 * Useful for debug triggers and manual testing.
 */
export function pickRandomTimInterrupt(): TimInterrupt {
  return POOL[Math.floor(Math.random() * POOL.length)];
}

/**
 * Pick an interrupt appropriate for the given hour of the broadcast, or
 * return null if the dice say "no interrupt this hour."
 *
 * hourIndex: 0-11 where 0=7pm (19:00), 5=midnight, 11=6am.
 *
 * Probability and severity distribution:
 *   Hours 0-1 (7-9pm):    40% chance. Severity 1 only.
 *   Hours 2-4 (9pm-12am): 55% chance. Severity 1-2.
 *   Hours 5-7 (12-2am):   70% chance. Severity 1-3, weighted toward 2.
 *   Hours 8-11 (2-6am):   85% chance. Severity 2-3, weighted toward 3.
 *
 * The seed ensures the same (hourIndex, seed) pair always produces the
 * same result — stable across page reloads within a time slot.
 */
export function getTimInterruptForHour(
  hourIndex: number,
  seed: string,
): TimInterrupt | null {
  const combinedSeed = `tim-interrupt::${hourIndex}::${seed}`;
  const h = Math.abs(hash(combinedSeed));

  // ── Should an interrupt fire at all? ──
  const roll = h % 100;
  let threshold: number;
  if (hourIndex <= 1) threshold = 40;
  else if (hourIndex <= 4) threshold = 55;
  else if (hourIndex <= 7) threshold = 70;
  else threshold = 85;

  if (roll >= threshold) return null;

  // ── Filter candidates by minHour and severity band ──
  let minSeverity: 1 | 2 | 3;
  let maxSeverity: 1 | 2 | 3;

  if (hourIndex <= 1) {
    minSeverity = 1;
    maxSeverity = 1;
  } else if (hourIndex <= 4) {
    minSeverity = 1;
    maxSeverity = 2;
  } else if (hourIndex <= 7) {
    minSeverity = 1;
    maxSeverity = 3;
  } else {
    minSeverity = 2;
    maxSeverity = 3;
  }

  const candidates = POOL.filter((interrupt) => {
    if (interrupt.severity < minSeverity || interrupt.severity > maxSeverity) {
      return false;
    }
    if (interrupt.minHour !== undefined && hourIndex < interrupt.minHour) {
      return false;
    }
    return true;
  });

  if (candidates.length === 0) return null;

  // ── Weight toward higher severity in late hours ──
  // After midnight (hourIndex >= 5), severity 3 candidates get 3x weight,
  // severity 2 gets 2x weight. Before that, uniform.
  let weighted: TimInterrupt[];
  if (hourIndex >= 5) {
    weighted = [];
    for (const c of candidates) {
      const multiplier = c.severity === 3 ? 3 : c.severity === 2 ? 2 : 1;
      for (let i = 0; i < multiplier; i++) {
        weighted.push(c);
      }
    }
  } else {
    weighted = [...candidates];
  }

  const pickHash = Math.abs(hash(`${combinedSeed}::pick`));
  const idx = pickHash % weighted.length;
  return weighted[idx];
}
