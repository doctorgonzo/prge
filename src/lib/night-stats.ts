// src/lib/night-stats.ts
// Deterministic "canonical" night stats for the Morning After debrief.
//
// Every visitor to /morning-after on the same date sees the same station-level
// stats — death toll, caller count, crisis roster, etc. Seeded from the
// Madison date string so it's stable but varies night-to-night.
//
// No localStorage, no API. Pure functions from a date seed.

// ── Hash (FNV-1a + finalizer for good avalanche) ────────────────────

function hashStr(s: string): number {
  let h = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193); // FNV prime
  }
  // Finalizer — better bit mixing so similar inputs diverge
  h ^= h >>> 16;
  h = Math.imul(h, 0x45d9f3b);
  h ^= h >>> 16;
  return h >>> 0; // unsigned 32-bit
}

/** Seeded random in [min, max] inclusive. */
function seededRange(seed: string, label: string, min: number, max: number): number {
  const h = hashStr(`${seed}::${label}`);
  return min + (h % (max - min + 1));
}

/** Seeded pick from an array. */
function seededPick<T>(seed: string, label: string, arr: readonly T[]): T {
  return arr[hashStr(`${seed}::${label}`) % arr.length];
}

/** Seeded shuffle (Fisher-Yates with deterministic swaps). */
function seededShuffle<T>(seed: string, label: string, arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = hashStr(`${seed}::${label}::${i}`) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ── Canonical crisis pool (simplified for the report) ──────────────────

interface CanonicalCrisis {
  type: string;
  title: string;
  severity: 1 | 2 | 3;
  hour: string; // Madison HH:MM when it "occurred"
  outcome: string;
}

const CRISIS_TEMPLATES: readonly {
  type: string;
  titles: readonly string[];
  severities: readonly (1 | 2 | 3)[];
  outcomes: readonly string[];
}[] = [
  {
    type: "fire",
    titles: [
      "Structure fire — State Street corridor",
      "Warehouse blaze — East Washington",
      "Residential fire — Willy Street",
      "Multi-alarm fire — Capitol Square",
      "Chemical fire — Oscar Mayer industrial zone",
      "House fire — Nakoma neighborhood",
      "Commercial blaze — Hilldale sector",
    ],
    severities: [2, 3, 2, 3, 3, 2, 2],
    outcomes: [
      "Burned out. No response until dawn.",
      "Contained by collapse. Smoke advisory issued.",
      "Structure lost. Adjacent buildings holding.",
      "Fire perimeter stabilized by wind shift.",
      "Hazmat plume drifting east. Seal windows.",
      "Neighbor bucket brigade held the line. Structure standing.",
      "Sprinklers held. Damage limited to ground floor.",
    ],
  },
  {
    type: "gun-violence",
    titles: [
      "Running firefight — Williamson Street",
      "Armed convoy — Stoughton Road",
      "Shootout — Regent neighborhood",
      "Sniper activity — Monona Terrace",
      "Armed standoff — Beltline overpass",
      "Rooftop fire — Park Street corridor",
      "Vehicle ambush — University Avenue",
    ],
    severities: [2, 3, 2, 3, 3, 2, 3],
    outcomes: [
      "Combatants dispersed. Area remains volatile.",
      "Convoy passed through. Casualties unconfirmed.",
      "Shootout resolved. Shelter-in-place lifted.",
      "Activity ceased. Do not approach lakeshore.",
      "Standoff ended. Overpass closed until dawn.",
      "Shooter relocated. Avoid rooftop exposure.",
      "Vehicles abandoned. Road impassable. Reroute.",
    ],
  },
  {
    type: "break-in",
    titles: [
      "Station breach — PRGE transmitter site",
      "Cluster break-in — Atwood Avenue residences",
      "Perimeter breach — Tenney Park safe house",
      "Forced entry — Schenk-Atwood supply cache",
      "Home invasion cluster — Allied Drive",
      "Shelter breach — Vilas Park basement",
    ],
    severities: [3, 2, 2, 2, 3, 2],
    outcomes: [
      "Intruders repelled. Tim secured the rig.",
      "Residents holding. Barricades intact.",
      "Safe house compromised. Occupants relocated.",
      "Cache looted. Non-critical supplies lost.",
      "Multiple homes entered. Casualties unconfirmed.",
      "Basement sealed from inside. Occupants safe.",
    ],
  },
  {
    type: "weather",
    titles: [
      "Tornado warning — Dane County",
      "Severe thunderstorm — Madison metro",
      "Flash flood advisory — Yahara River basin",
      "Hail storm — West Side residential",
      "Lightning strike cluster — isthmus",
      "Fog bank — Mendota lakeshore",
    ],
    severities: [3, 2, 2, 2, 2, 1],
    outcomes: [
      "Tornado dissipated. Damage assessment at dawn.",
      "Storm passed. Power outages widespread.",
      "Floodwaters receding. Low-lying areas avoid.",
      "Vehicle damage reported. Stay indoors.",
      "Two fires started. Transformer blown on Gorham.",
      "Visibility near zero. Do not travel on foot.",
    ],
  },
  {
    type: "infrastructure",
    titles: [
      "Power grid failure — isthmus sector",
      "Gas main rupture — Monroe Street",
      "Water system contamination — West Side",
      "Cell tower collapse — East Side",
      "Bridge closure — John Nolen causeway",
      "Sewer main breach — Waunona neighborhood",
      "Generator failure — UW Hospital backup",
    ],
    severities: [2, 2, 3, 2, 2, 1, 3],
    outcomes: [
      "Grid offline until dawn. Conserve batteries.",
      "Gas shut off at valve. Ventilate if nearby.",
      "Do not consume tap water until advisory lifts.",
      "All cellular service down in sector. Use landline if available.",
      "Causeway impassable. No east-west vehicle crossing.",
      "Flooding in basements. Move to upper floors.",
      "Backup power restored at 60% capacity. Triage continues.",
    ],
  },
  {
    type: "medical",
    titles: [
      "Triage overflow — Meriter staging area",
      "Mass casualty event — downtown perimeter",
      "Field hospital overrun — Breese Stevens",
      "Medical supply shortage — South Side clinic",
      "Contamination exposure — Truax area",
    ],
    severities: [3, 3, 3, 2, 3],
    outcomes: [
      "Triage redistributed to secondary sites.",
      "Casualty count pending. Field medics deployed.",
      "Walking wounded redirected to Vilas staging area.",
      "Supplies rationed. Priority: trauma and pediatric.",
      "Exposure radius expanding. Evacuate if within 6 blocks.",
    ],
  },
  {
    type: "civil-unrest",
    titles: [
      "Looting wave — East Towne commercial strip",
      "Barricade collapse — Marquette neighborhood",
      "Mob activity — Capitol Square perimeter",
      "Vigilante patrol — Middleton border",
    ],
    severities: [2, 3, 3, 2],
    outcomes: [
      "Wave subsided. Storefronts gutted but structure intact.",
      "Residents fell back to secondary positions. Holding.",
      "Crowd dispersed by mutual exhaustion. Square accessible.",
      "Patrol returned to Middleton side. Border quiet.",
    ],
  },
  {
    type: "communications",
    titles: [
      "Signal jam — unknown source",
      "Pirate frequency interference — 91.1 band",
      "Emergency broadcast system failure — countywide",
    ],
    severities: [2, 2, 3],
    outcomes: [
      "Jam lifted after 14 minutes. Source unidentified.",
      "Interference cleared. Competing signal went dark.",
      "EBS restored via manual override. Backup channel active.",
    ],
  },
];

// ── Canonical caller fates ─────────────────────────────────────────────

interface CanonicalCaller {
  name: string;
  neighborhood: string;
  fate: "CONFIRMED ALIVE" | "UNCONFIRMED" | "SIGNAL LOST";
}

const CALLER_NAMES: readonly { name: string; neighborhood: string }[] = [
  { name: "Darren", neighborhood: "Atwood" },
  { name: "Mia", neighborhood: "Tenney Park" },
  { name: "Grace", neighborhood: "Maple Bluff" },
  { name: "Marcus", neighborhood: "South Park" },
  { name: "Lena", neighborhood: "Willy Street" },
  { name: "Tommy", neighborhood: "East Wash" },
  { name: "Rosa", neighborhood: "Monona" },
  { name: "Keith", neighborhood: "Regent" },
  { name: "Diane", neighborhood: "Midvale" },
  { name: "Jamal", neighborhood: "Allied Drive" },
  { name: "Heather", neighborhood: "Shorewood" },
  { name: "Pete", neighborhood: "Bram's Addition" },
  { name: "Yuki", neighborhood: "University Heights" },
  { name: "Carlos", neighborhood: "South Side" },
  { name: "Barb", neighborhood: "Schenk-Atwood" },
  { name: "Tyler", neighborhood: "Dudgeon-Monroe" },
  { name: "Nina", neighborhood: "Marquette" },
  { name: "Hank", neighborhood: "Sherman" },
  { name: "Abby", neighborhood: "Vilas" },
  { name: "Deshawn", neighborhood: "Worthington Park" },
  { name: "Elise", neighborhood: "Nakoma" },
  { name: "Ravi", neighborhood: "Hilldale" },
  { name: "Darlene", neighborhood: "Eken Park" },
  { name: "Jorge", neighborhood: "Brentwood" },
  { name: "Sandra", neighborhood: "Sunset Village" },
  { name: "Corey", neighborhood: "Eastmorland" },
  { name: "Fatima", neighborhood: "Greenbush" },
  { name: "Walt", neighborhood: "Burr Oaks" },
  { name: "Priya", neighborhood: "Spring Harbor" },
  { name: "Gene", neighborhood: "Orchard Ridge" },
  { name: "Liz", neighborhood: "Bay Creek" },
  { name: "DeAndre", neighborhood: "Carpenter-Ridgeway" },
  { name: "Connie", neighborhood: "Elvehjem" },
  { name: "Aaron", neighborhood: "Owl Creek" },
  { name: "Mika", neighborhood: "Westmorland" },
  { name: "Dolores", neighborhood: "Truax" },
  { name: "Benny", neighborhood: "Packers Ave" },
  { name: "Ruth", neighborhood: "Emerson East" },
  { name: "Terrence", neighborhood: "Lake Edge" },
  { name: "Sonia", neighborhood: "Crestwood" },
  { name: "Frank", neighborhood: "Kennedy Heights" },
  { name: "Mei", neighborhood: "Lakepoint" },
  { name: "Dustin", neighborhood: "North Side" },
  { name: "Yvonne", neighborhood: "Rimrock" },
  { name: "Jesse", neighborhood: "Door Creek" },
];

// ── Public API ─────────────────────────────────────────────────────────

export interface NightStats {
  /** Madison date string, e.g. "2026-05-18". */
  nightId: string;
  /** City-wide Purge death toll. */
  deathToll: number;
  /** Number of emergency broadcasts issued. */
  emergencyBroadcasts: number;
  /** Number of signal interruptions. */
  signalInterruptions: number;
  /** Total caller check-ins received. */
  callerCheckIns: number;
  /** Canonical crises that occurred. */
  crises: CanonicalCrisis[];
  /** Canonical caller fates. */
  callerFates: CanonicalCaller[];
  /** Sunrise time (always 05:47–06:12 range). */
  sunriseTime: string;
  /** Nick's song count for the night. */
  nickSongCount: number;
}

/**
 * Generate canonical night stats for a given Madison date.
 * Deterministic — same date always produces the same stats.
 */
export function generateNightStats(nightId: string): NightStats {
  const seed = nightId;

  const deathToll = seededRange(seed, "deaths", 847, 2341);
  const emergencyBroadcasts = seededRange(seed, "ebs", 4, 9);
  const signalInterruptions = seededRange(seed, "signal", 3, 7);
  const callerCheckIns = seededRange(seed, "callers", 18, 42);
  const nickSongCount = seededRange(seed, "nick-songs", 12, 28);

  // Pick 3-5 crises from the pool.
  const crisisCount = seededRange(seed, "crisis-count", 3, 5);
  const allCrises: CanonicalCrisis[] = [];
  const shuffledTypes = seededShuffle(seed, "crisis-types", [...CRISIS_TEMPLATES]);

  for (let i = 0; i < Math.min(crisisCount, shuffledTypes.length); i++) {
    const template = shuffledTypes[i];
    const titleIdx = hashStr(`${seed}::crisis-title::${i}`) % template.titles.length;
    // Distribute across the night: 19:00–06:00 = 11 hours.
    const hourOffset = seededRange(seed, `crisis-hour::${i}`, 0, 10);
    const minuteOffset = seededRange(seed, `crisis-min::${i}`, 5, 55);
    const rawHour = 19 + hourOffset;
    const hour = rawHour >= 24 ? rawHour - 24 : rawHour;
    const hhmm = `${hour < 10 ? "0" : ""}${hour}:${minuteOffset < 10 ? "0" : ""}${minuteOffset}`;

    allCrises.push({
      type: template.type,
      title: template.titles[titleIdx],
      severity: template.severities[titleIdx],
      hour: hhmm,
      outcome: template.outcomes[titleIdx],
    });
  }

  // Always include the station breach.
  if (!allCrises.some((c) => c.title.includes("Station breach"))) {
    const breachTemplate = CRISIS_TEMPLATES.find((t) => t.type === "break-in")!;
    const breachHour = seededRange(seed, "breach-hour", 0, 7) + 21;
    const breachMin = seededRange(seed, "breach-min", 10, 50);
    const bh = breachHour >= 24 ? breachHour - 24 : breachHour;
    allCrises.push({
      type: "break-in",
      title: breachTemplate.titles[0],
      severity: 3,
      hour: `${bh < 10 ? "0" : ""}${bh}:${breachMin < 10 ? "0" : ""}${breachMin}`,
      outcome: breachTemplate.outcomes[0],
    });
  }

  // Sort crises chronologically (19→06 order).
  allCrises.sort((a, b) => {
    const toSortKey = (hhmm: string) => {
      const h = parseInt(hhmm.split(":")[0], 10);
      return h >= 19 ? h : h + 24;
    };
    return toSortKey(a.hour) - toSortKey(b.hour);
  });

  // Caller fates — pick callerCheckIns callers from the pool.
  const callerCount = Math.min(callerCheckIns, CALLER_NAMES.length);
  const shuffledCallers = seededShuffle(seed, "caller-fates", [...CALLER_NAMES]);
  const callerFates: CanonicalCaller[] = shuffledCallers
    .slice(0, callerCount)
    .map((c, i) => {
      // ~60% alive, ~25% unconfirmed, ~15% signal lost.
      const roll = hashStr(`${seed}::fate::${i}`) % 100;
      const fate: CanonicalCaller["fate"] =
        roll < 60
          ? "CONFIRMED ALIVE"
          : roll < 85
            ? "UNCONFIRMED"
            : "SIGNAL LOST";
      return { name: c.name, neighborhood: c.neighborhood, fate };
    });

  // Sunrise time: 05:47–06:12 range.
  const sunriseMin = seededRange(seed, "sunrise", 347, 372); // minutes since midnight
  const sunH = Math.floor(sunriseMin / 60);
  const sunM = sunriseMin % 60;
  const sunriseTime = `${sunH < 10 ? "0" : ""}${sunH}:${sunM < 10 ? "0" : ""}${sunM}`;

  return {
    nightId,
    deathToll,
    emergencyBroadcasts,
    signalInterruptions,
    callerCheckIns,
    crises: allCrises,
    callerFates,
    sunriseTime,
    nickSongCount,
  };
}
