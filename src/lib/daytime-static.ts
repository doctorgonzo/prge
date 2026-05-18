// src/lib/daytime-static.ts
// Fully static content generators for the unmanned daytime broadcast.
// No LLM calls — these serve fixed JSON from the brand/track pools.
//
// Two entrypoints:
//   buildStaticDaytimeMusicBlock(cacheKey)  → music-block JSON (4-5 tracks)
//   buildStaticDaytimeCommercial(cacheKey)  → commercial-break JSON (2-3 ads)
//
// Both are deterministic on the cacheKey so the same daytime slot always
// returns the same content. Different cache keys yield different track/ad
// selections so consecutive blocks don't repeat.

import { DAYTIME_BRANDS, type DaytimeBrand } from "./daytime-brands";

// ── Deterministic hash (same algo as tim-bumpers.ts) ─────────────────
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// ── Daytime track pool ───────────────────────────────────────────────
// Songs Nick loaded into the auto-rotation before passing out. Broader/
// mellower than the Purge-night playlist — think "pirate radio station's
// daytime programming." Station automation lines, no DJ personality.

interface DaytimeTrack {
  title: string;
  artist: string;
  year: number;
  /** Brief factoid — station automation style, not Nick's voice. */
  fact: string;
}

const DAYTIME_TRACKS: readonly DaytimeTrack[] = [
  // Classic punk
  {
    title: "Sheena Is a Punk Rocker",
    artist: "Ramones",
    year: 1977,
    fact: "Released as the Ramones' fifth single. Defined the template for punk pop.",
  },
  {
    title: "London Calling",
    artist: "The Clash",
    year: 1979,
    fact: "Title track from the Clash's third album. Rolling Stone ranked it the 15th greatest album ever.",
  },
  {
    title: "Ever Fallen in Love",
    artist: "Buzzcocks",
    year: 1978,
    fact: "Pete Shelley wrote this after hearing a line in the 1957 film Guys and Dolls.",
  },
  {
    title: "Rise Above",
    artist: "Black Flag",
    year: 1981,
    fact: "From Damaged, Black Flag's debut LP. Recorded at Unicorn Studios in just a few days.",
  },
  {
    title: "Los Angeles",
    artist: "X",
    year: 1980,
    fact: "Produced by Ray Manzarek of The Doors. X bridged punk and rockabilly into something new.",
  },

  // 90s punk / ska-punk
  {
    title: "Ruby Soho",
    artist: "Rancid",
    year: 1995,
    fact: "From ...And Out Come the Wolves. Rancid's breakout album on Epitaph Records.",
  },
  {
    title: "Santeria",
    artist: "Sublime",
    year: 1996,
    fact: "Released posthumously after Bradley Nowell's death. Peaked at number one on the Modern Rock chart.",
  },
  {
    title: "Sound System",
    artist: "Operation Ivy",
    year: 1989,
    fact: "Energy was Op Ivy's only studio album. The band dissolved after just two years together.",
  },
  {
    title: "The Impression That I Get",
    artist: "Mighty Mighty Bosstones",
    year: 1997,
    fact: "From Let's Face It. The song that carried ska-punk to mainstream radio.",
  },
  {
    title: "Roots Radicals",
    artist: "Rancid",
    year: 1995,
    fact: "Tim Armstrong wrote most of Wolves during a stretch of sobriety. The album moved over a million copies.",
  },

  // Indie / alt
  {
    title: "Float On",
    artist: "Modest Mouse",
    year: 2004,
    fact: "Isaac Brock's first genuine pop hit. From Good News for People Who Love Bad News.",
  },
  {
    title: "Cut Your Hair",
    artist: "Pavement",
    year: 1994,
    fact: "From Crooked Rain, Crooked Rain. Pavement's most commercially successful single.",
  },
  {
    title: "Debaser",
    artist: "Pixies",
    year: 1989,
    fact: "Opens Doolittle. Black Francis drew inspiration from the Bunuel film Un Chien Andalou.",
  },
  {
    title: "Where Is My Mind?",
    artist: "Pixies",
    year: 1988,
    fact: "Recorded at Eden Studios in London. Later immortalized in the Fight Club closing scene.",
  },
  {
    title: "Car",
    artist: "Built to Spill",
    year: 1994,
    fact: "From There's Nothing Wrong with Love. Doug Martsch's songwriting at its most direct.",
  },

  // Eclectic / deeper cuts
  {
    title: "Institutionalized",
    artist: "Suicidal Tendencies",
    year: 1983,
    fact: "Mike Muir was 18 when he wrote this. The Pepsi monologue is punk cinema.",
  },
  {
    title: "Waiting Room",
    artist: "Fugazi",
    year: 1989,
    fact: "From 13 Songs. Fugazi never charged more than five dollars for a show.",
  },
  {
    title: "Sonic Reducer",
    artist: "Dead Boys",
    year: 1977,
    fact: "Recorded at Electric Lady Studios. One of the hardest-hitting tracks of first-wave punk.",
  },
  {
    title: "Blister in the Sun",
    artist: "Violent Femmes",
    year: 1983,
    fact: "From their self-titled debut. Recorded in a single afternoon at Castle Studios, Milwaukee.",
  },
  {
    title: "My Brain Is Hanging Upside Down",
    artist: "Ramones",
    year: 1986,
    fact: "Also known as Bonzo Goes to Bitburg. One of the Ramones' most political recordings.",
  },
  {
    title: "Television City Dream",
    artist: "Screeching Weasel",
    year: 1998,
    fact: "Ben Weasel channeling Ramones energy through Midwest pop-punk sharpness.",
  },
  {
    title: "Caution",
    artist: "Operation Ivy",
    year: 1989,
    fact: "From Energy. Twenty-seven songs in thirty minutes. Every second intentional.",
  },
  {
    title: "She",
    artist: "Green Day",
    year: 1994,
    fact: "From Dookie. A character study that foreshadowed Billie Joe's later concept records.",
  },
  {
    title: "Hybrid Moments",
    artist: "Misfits",
    year: 1980,
    fact: "Glenn Danzig at his pop-punk peak. Horror hooks over two-minute punk blasts.",
  },
  {
    title: "I Wanna Be Sedated",
    artist: "Ramones",
    year: 1978,
    fact: "Written in a London hotel room during a European tour. Pure exhaustion, pure art.",
  },
];

// ── Music block builder ──────────────────────────────────────────────

/**
 * Build a static music-block segment for daytime auto-rotation.
 * Deterministically picks 4-5 tracks from the pool based on cacheKey.
 * Lines are minimal station automation — no Nick personality.
 */
export function buildStaticDaytimeMusicBlock(
  cacheKey: string,
): Record<string, unknown> {
  const seed = hashStr(cacheKey);
  const trackCount = 4 + (seed % 2); // 4 or 5 tracks

  // Shuffle-pick without replacement using the seed.
  const indices = Array.from({ length: DAYTIME_TRACKS.length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = hashStr(`${cacheKey}::shuf::${i}`) % (i + 1);
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  const picks = indices.slice(0, trackCount).map((i) => DAYTIME_TRACKS[i]);

  const tracks = picks.map((t, idx) => ({
    title: t.title,
    artist: t.artist,
    year: t.year,
    lines: [
      {
        host: "prge",
        text:
          idx === 0
            ? `PRGE 420.69 FM — unmanned autoplay. Now playing: ${t.artist}, "${t.title}." ${t.year}.`
            : `Now playing: ${t.artist} — "${t.title}." ${t.year}.`,
      },
      {
        host: "prge",
        text: t.fact,
      },
    ],
  }));

  return {
    type: "music-block",
    tracks,
    lines: [
      {
        host: "prge",
        text: "PRGE 420.69 FM — unmanned autoplay. Pre-recorded programming. Purge broadcast resumes at sundown.",
      },
    ],
    tickerItems: [
      {
        category: "ad",
        text: "PRGE 420.69 FM — Madison's only pirate radio station — broadcasting around the clock",
      },
      {
        category: "local-news",
        text: "DAYTIME MODE — station unmanned until 7:00 PM — pre-recorded content only",
      },
    ],
  };
}

// ── Commercial break builder ─────────────────────────────────────────

/**
 * Build a static commercial-break segment for daytime auto-rotation.
 * Picks 2-3 brands from the DAYTIME_BRANDS pool and generates ad cards.
 * No LLM — fully deterministic from the cacheKey.
 */
export function buildStaticDaytimeCommercial(
  cacheKey: string,
): Record<string, unknown> {
  const seed = hashStr(cacheKey);
  const adCount = 2 + (seed % 2); // 2 or 3 ads

  // Deterministic brand selection — avoid duplicates within a single break.
  const used = new Set<number>();
  const brandIndices: number[] = [];
  for (let i = 0; i < adCount; i++) {
    let idx = hashStr(`${cacheKey}::ad::${i}`) % DAYTIME_BRANDS.length;
    // Walk forward until we find an unused slot.
    let attempts = 0;
    while (used.has(idx) && attempts < DAYTIME_BRANDS.length) {
      idx = (idx + 1) % DAYTIME_BRANDS.length;
      attempts++;
    }
    used.add(idx);
    brandIndices.push(idx);
  }

  const brands = brandIndices.map((i) => DAYTIME_BRANDS[i]);

  const ads = brands.map((b) => ({
    brand: b.name,
    tagline: b.taglineSeed ?? `${b.texture}.`,
    body: staticAdBody(b, cacheKey),
  }));

  return {
    type: "commercial-break",
    ads,
    lines: [
      {
        host: "tim",
        text: "PRGE — brought to you by our daytime sponsors. We'll be right back.",
      },
    ],
    tickerItems: brands.map((b) => ({
      category: "ad",
      text: `${b.name} — ${b.taglineSeed ?? b.texture}`,
    })),
  };
}

/**
 * Generate a short static ad body from a brand definition.
 * Three template variants per category, selected by hash.
 */
function staticAdBody(brand: DaytimeBrand, salt: string): string {
  const idx = hashStr(`${salt}::body::${brand.name}`) % 3;
  const tag = brand.taglineSeed ?? "";

  switch (brand.category) {
    case "dispensary":
      return [
        `${brand.name}. ${brand.texture}. Order before sunset, enjoy before dark.`,
        `${brand.name} — your neighborhood source. ${tag}`.trim(),
        `Support local. Support ${brand.name}. ${brand.texture}. Open all day.`,
      ][idx];
    case "energy-drink":
      return [
        `${brand.name}. ${brand.texture}. Stay sharp. Stay up.`,
        `Grab a ${brand.name} at any Madison gas station. ${tag}`.trim(),
        `${brand.name}. ${brand.texture}. The thing between you and a nap.`,
      ][idx];
    case "snack":
      return [
        `${brand.name}. ${brand.texture}. Grab one on your way through.`,
        `${brand.name}. Because you're hungry and you know it. ${tag}`.trim(),
        `${brand.name}. ${brand.texture}. Available at select Madison locations.`,
      ][idx];
    case "edibles":
      return [
        `${brand.name}. ${brand.texture}. Start low, go slow.`,
        `${brand.name} — handcrafted in small batches. ${tag}`.trim(),
        `${brand.name}. ${brand.texture}. The mellow option.`,
      ][idx];
    case "coffee":
      return [
        `${brand.name}. ${brand.texture}. Fuel for the daylight hours.`,
        `${brand.name} at your local co-op. ${tag}`.trim(),
        `${brand.name}. ${brand.texture}. You need this more than you think.`,
      ][idx];
    case "soft-drink-cbd":
      return [
        `${brand.name}. ${brand.texture}. Crack one open. Calm down.`,
        `${brand.name} — available cold, everywhere. ${tag}`.trim(),
        `${brand.name}. ${brand.texture}. For when the world is too much.`,
      ][idx];
  }
}
