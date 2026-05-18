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

  // ── Expansion pool ────────────────────────────────────────────────────

  // First-wave punk / proto-punk
  {
    title: "Banned in D.C.",
    artist: "Bad Brains",
    year: 1982,
    fact: "Recorded at 171A Studios in New York. Under two minutes of pure hardcore fury.",
  },
  {
    title: "Pay to Cum",
    artist: "Bad Brains",
    year: 1980,
    fact: "Their debut single hit 1:27 — widely considered the fastest punk record anyone had heard in 1980.",
  },
  {
    title: "New Rose",
    artist: "The Damned",
    year: 1976,
    fact: "Beat the Sex Pistols to record shops by a week. The first UK punk single ever released.",
  },
  {
    title: "Catholic Boy",
    artist: "Jim Carroll Band",
    year: 1980,
    fact: "Carroll went from basketball diary poet to CBGB regular. Ginsberg called him an American Rimbaud.",
  },
  {
    title: "Orgasm Addict",
    artist: "Buzzcocks",
    year: 1977,
    fact: "Martin Hannett produced their debut single a full year before he defined the Joy Division sound.",
  },
  {
    title: "Oh Bondage Up Yours!",
    artist: "X-Ray Spex",
    year: 1977,
    fact: "Poly Styrene was 19 and mixed-race in 1977 London. The most dangerous person in any punk room.",
  },
  {
    title: "Lust for Life",
    artist: "Iggy Pop",
    year: 1977,
    fact: "Bowie co-wrote and played keys in West Berlin. The drum pattern came from Armed Forces Network morse code.",
  },
  {
    title: "Search and Destroy",
    artist: "Iggy and the Stooges",
    year: 1973,
    fact: "James Williamson's guitar tone on Raw Power invented what punk would sound like four years early.",
  },
  {
    title: "Complete Control",
    artist: "The Clash",
    year: 1977,
    fact: "Lee 'Scratch' Perry produced it — the only time the godfather of dub helmed a Clash single.",
  },

  // Hardcore / post-punk
  {
    title: "Spray Paint the Walls",
    artist: "Black Flag",
    year: 1981,
    fact: "Greg Ginn tracked the guitar in one take at Media Art Studios in Hermosa Beach.",
  },
  {
    title: "Map of the World",
    artist: "Minutemen",
    year: 1984,
    fact: "From Double Nickels on the Dime — 45 songs across four sides, recorded for roughly $1,100.",
  },
  {
    title: "Last Caress",
    artist: "Misfits",
    year: 1980,
    fact: "Originally a B-side on the Night of the Living Dead single. Later made famous by Metallica's cover.",
  },
  {
    title: "The KKK Took My Baby Away",
    artist: "Ramones",
    year: 1981,
    fact: "Joey wrote it about his girlfriend leaving him for Johnny. The feud lasted until Joey's death.",
  },

  // 90s punk / ska-punk
  {
    title: "Fishbone",
    artist: "Fishbone",
    year: 1985,
    fact: "Six kids from South Central L.A. fused ska and punk before anyone thought to call it ska-punk.",
  },
  {
    title: "Right Place, Wrong Time",
    artist: "The Suicide Machines",
    year: 1996,
    fact: "Detroit ska-punk. Destruction by Definition went gold-adjacent in punk circles.",
  },
  {
    title: "Keasbey Nights",
    artist: "Catch 22",
    year: 1998,
    fact: "Tomas Kalnoky wrote it at 17, then re-recorded it with Streetlight Manifesto. Fans still argue.",
  },
  {
    title: "Punk Rock Song",
    artist: "Bad Religion",
    year: 1996,
    fact: "Greg Graffin holds a Ph.D. in zoology from Cornell. The smartest frontman in punk, bar none.",
  },
  {
    title: "Suffer",
    artist: "Bad Religion",
    year: 1988,
    fact: "Brett Gurewitz funded the recording through Epitaph Records, started in his parents' garage.",
  },

  // Indie / alt / 90s-2000s
  {
    title: "I Will Dare",
    artist: "The Replacements",
    year: 1984,
    fact: "Peter Buck of R.E.M. played the jangly mandolin intro as a session favor for Westerberg.",
  },
  {
    title: "Alex Chilton",
    artist: "The Replacements",
    year: 1987,
    fact: "A love letter to the Big Star frontman. Chilton later said he was flattered but slightly embarrassed.",
  },
  {
    title: "Turning Japanese",
    artist: "The Vapors",
    year: 1980,
    fact: "Hit number three in the UK and 36 on the Billboard Hot 100 before the band imploded.",
  },
  {
    title: "Gigantic",
    artist: "Pixies",
    year: 1988,
    fact: "Kim Deal's only lead vocal on a Pixies single. She wrote it about a Blaxploitation film.",
  },
  {
    title: "Loser",
    artist: "Beck",
    year: 1994,
    fact: "Recorded on an eight-track in Karl Stephenson's kitchen. The slide guitar was Beck's first take.",
  },
  {
    title: "Kiss Off",
    artist: "Violent Femmes",
    year: 1983,
    fact: "The counting song every college radio DJ in 1983 played at least twice a shift without shame.",
  },
  {
    title: "Aeroplane Over the Sea",
    artist: "Neutral Milk Hotel",
    year: 1998,
    fact: "Jeff Mangum recorded it at Pet Sounds Studio in Denver, then vanished from public life for a decade.",
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
 * Picks one of the brand's 3 pre-written ad variants by hash.
 */
function staticAdBody(brand: DaytimeBrand, salt: string): string {
  const idx = hashStr(`${salt}::body::${brand.name}`) % 3;
  return brand.adLines[idx];
}
