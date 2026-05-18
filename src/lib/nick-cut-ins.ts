// src/lib/nick-cut-ins.ts
// Nick Trulino can't keep his hands off the board. These are pre-baked
// interruptions — Nick breaks in during someone else's segment to play
// a track that "couldn't wait." No API call needed; the route handler
// picks one probabilistically and attaches it to the response.
//
// The frontend renders the intro lines briefly, then loads the full
// MusicBlockLayout with the YouTube player for the track.

export interface NickCutIn {
  /** Nick's break-in lines — shown before the music player loads. */
  introLines: Array<{ host: string; text: string }>;
  /** The track he forces on air. */
  track: {
    title: string;
    artist: string;
    year?: number;
    /** Lines that cycle under the player while the track plays. */
    lines?: Array<{ host: string; text: string }>;
  };
}

const POOL: readonly NickCutIn[] = [
  // ── Cocky / early-night energy ──────────────────────────────────────
  {
    introLines: [
      { host: "nick", text: "Sorry. Gotta cut in. This one can't wait." },
    ],
    track: {
      title: "Blitzkrieg Bop",
      artist: "Ramones",
      year: 1976,
      lines: [
        { host: "nick", text: "1976. Year the rules stopped mattering." },
        { host: "nick", text: "Hey! Ho! Let's go. That's the whole thesis." },
      ],
    },
  },
  {
    introLines: [
      { host: "nick", text: "Hold that thought, Quinn. I need thirty seconds." },
    ],
    track: {
      title: "Linoleum",
      artist: "NOFX",
      year: 1994,
      lines: [
        { host: "nick", text: "Fat Mike wrote this in ten minutes. Best ten minutes of his life." },
        { host: "nick", text: "Possessions never meant anything to me. Felt that one tonight." },
      ],
    },
  },
  {
    introLines: [
      { host: "nick", text: "Nick Trulino cutting in. Deal with it." },
    ],
    track: {
      title: "Basket Case",
      artist: "Green Day",
      year: 1994,
      lines: [
        { host: "nick", text: "Billie Joe knew. Anxiety isn't a phase. It's a lifestyle." },
        { host: "nick", text: "Do you have the time to listen to me whine? You do. You're locked in your house." },
      ],
    },
  },
  {
    introLines: [
      { host: "nick", text: "Bumping the segment. This track just hit me and I can't not play it." },
    ],
    track: {
      title: "The Science of Selling Yourself Short",
      artist: "Less Than Jake",
      year: 2003,
      lines: [
        { host: "nick", text: "Every ska-punk kid who grew up and got a real job felt this one." },
        { host: "nick", text: "I've been on a steady diet of nothing useful. Welcome to Purge Night." },
      ],
    },
  },
  {
    introLines: [
      { host: "nick", text: "Tucker, I love you, but shut up for one song." },
    ],
    track: {
      title: "Punk Rock Girl",
      artist: "Dead Milkmen",
      year: 1988,
      lines: [
        { host: "nick", text: "The Dead Milkmen understood something important: be deliberately stupid because the world already is." },
        { host: "nick", text: "We went to the Philly Pizza Company and ordered some hot tea. That's the whole song. That's punk." },
      ],
    },
  },
  // ── Mid-night / getting loose ───────────────────────────────────────
  {
    introLines: [
      { host: "nick", text: "This is Nick. I'm cutting the feed for a minute. Don't @ me." },
    ],
    track: {
      title: "All My Best Friends Are Metalheads",
      artist: "Less Than Jake",
      year: 1998,
      lines: [
        { host: "nick", text: "Doesn't matter what's on the outside, it's what you do that counts. Or something." },
        { host: "nick", text: "Third drink talking. I get sentimental around midnight." },
      ],
    },
  },
  {
    introLines: [
      { host: "nick", text: "Caroline, I need thirty seconds of your weather time. I'll give it back." },
      { host: "nick", text: "I won't give it back." },
    ],
    track: {
      title: "Elvis Is Everywhere",
      artist: "Mojo Nixon",
      year: 1987,
      lines: [
        { host: "nick", text: "Mojo Nixon. Spiritual ancestor. The man understood that the best protest is being too weird to ignore." },
        { host: "nick", text: "Elvis is everywhere. Elvis is everything. Elvis is still more alive than half the people outside tonight." },
      ],
    },
  },
  {
    introLines: [
      { host: "nick", text: "Holden. Holden. I don't care about the grid load. Listen to this." },
    ],
    track: {
      title: "Don Henley Must Die",
      artist: "Mojo Nixon",
      year: 1990,
      lines: [
        { host: "nick", text: "The Eagles are still terrible 200 years later. Some things are eternal." },
        { host: "nick", text: "Mojo had enemies. Real ones. Named them on record. Respect." },
      ],
    },
  },
  {
    introLines: [
      { host: "nick", text: "I know it's not my hour. I don't care. Play this." },
    ],
    track: {
      title: "Suburban Home",
      artist: "Descendents",
      year: 1982,
      lines: [
        { host: "nick", text: "I wanna be stereotyped. I wanna be classified. Milo knew the joke before anyone got it." },
        { host: "nick", text: "Suburban home. That's all anyone wants tonight. Four walls and a lock." },
      ],
    },
  },
  {
    introLines: [
      { host: "nick", text: "Marigold, baby, take a breath. Here." },
    ],
    track: {
      title: "Bitchin' Camaro",
      artist: "Dead Milkmen",
      year: 1985,
      lines: [
        { host: "nick", text: "How much did you pay for that? My folks drove it from the Bahamas. What? You heard me." },
        { host: "nick", text: "The Dead Milkmen peaked here. I will not elaborate." },
      ],
    },
  },
  // ── Late / emotional / philosophical ────────────────────────────────
  {
    introLines: [
      { host: "nick", text: "Don't say anything. Just listen." },
    ],
    track: {
      title: "Hope",
      artist: "Descendents",
      year: 1982,
      lines: [
        { host: "nick", text: "Milo Goes to College. Thirty seconds of perfect songwriting." },
        { host: "nick", text: "They say home is where you go when you run out of places. This song is that." },
      ],
    },
  },
  {
    introLines: [
      { host: "nick", text: "I'm cutting in because I'm four drinks deep and this track deserves it." },
    ],
    track: {
      title: "Sink, Florida, Sink",
      artist: "Against Me!",
      year: 2003,
      lines: [
        { host: "nick", text: "Tom Gabel wrote this before Laura Jane Grace found her name. Both versions hurt." },
        { host: "nick", text: "We are all sinking. That's not nihilism. That's physics." },
      ],
    },
  },
  {
    introLines: [
      { host: "nick", text: "One song. I need one song. Then you can have the air back." },
    ],
    track: {
      title: "Radio",
      artist: "Alkaline Trio",
      year: 2001,
      lines: [
        { host: "nick", text: "Shaking like a dog shittin' razorblades. Matt Skiba had a way with words." },
        { host: "nick", text: "This station. This frequency. Some things are worth the federal crime." },
      ],
    },
  },
  {
    introLines: [
      { host: "nick", text: "Tim, don't cut me. I know it's not my slot. Just one track." },
      { host: "nick", text: "It's important." },
    ],
    track: {
      title: "Sunday Morning Coming Down",
      artist: "Me First and the Gimme Gimmes",
      year: 1997,
      lines: [
        { host: "nick", text: "Kris Kristofferson wrote it. Johnny Cash sang it. Spike Slawson yelled it. That's the pipeline." },
        { host: "nick", text: "Sunday morning. That's seven hours from now. Some of us will see it." },
      ],
    },
  },
  {
    introLines: [
      { host: "nick", text: "Cutting the feed. Don't be mad. Be punk about it." },
    ],
    track: {
      title: "Sellout",
      artist: "Reel Big Fish",
      year: 1996,
      lines: [
        { host: "nick", text: "Everyone sells out eventually. The question is what you buy with the money." },
        { host: "nick", text: "Aaron Barrett wrote a ska song about selling out and then actually sold out. Respect the commitment." },
      ],
    },
  },
  // ── Deep night / weepy ──────────────────────────────────────────────
  {
    introLines: [
      { host: "nick", text: "Nobody asked for this. I know. Play it anyway." },
    ],
    track: {
      title: "The Shortest Pier",
      artist: "NOFX",
      year: 1997,
      lines: [
        { host: "nick", text: "NOFX acoustic. Four in the morning energy even when it's not four in the morning." },
        { host: "nick", text: "Fat Mike said punk isn't dead, it just deserves to die. He was wrong. It just won't." },
      ],
    },
  },
  {
    introLines: [
      { host: "nick", text: "One more. Last one. I promise." },
      { host: "nick", text: "I lied last time too." },
    ],
    track: {
      title: "Hybrid Moments",
      artist: "Misfits",
      year: 1980,
      lines: [
        { host: "nick", text: "Danzig before Danzig. Before the muscles and the cat. When it was just anger and eyeliner." },
        { host: "nick", text: "If I could have one hybrid moment with anyone tonight it would be with the version of myself who still believed this all meant something." },
      ],
    },
  },
  {
    introLines: [
      { host: "nick", text: "I gotta play this one before I lose my nerve." },
    ],
    track: {
      title: "99 Luftballons",
      artist: "Goldfinger",
      year: 2002,
      lines: [
        { host: "nick", text: "Goldfinger covering Nena. A punk band covering a German protest song. That's more layers than this station deserves." },
        { host: "nick", text: "Ninety-nine red balloons. War started by accident. Sound familiar?" },
      ],
    },
  },
];

/** Simple deterministic hash. */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return h;
}

/**
 * Pick N distinct cut-ins from the pool, seeded deterministically so the
 * same slot always gets the same set (stable across 60-second polls).
 */
function pickCutIns(dateStr: string, slotKey: string, count: number): NickCutIn[] {
  const n = Math.min(count, POOL.length);
  const base = hash(`${dateStr}::${slotKey}`);
  // Fisher-Yates partial shuffle seeded by base hash.
  const indices = Array.from({ length: POOL.length }, (_, i) => i);
  for (let i = 0; i < n; i++) {
    const j = i + (((hash(`${base}::${i}`) % (POOL.length - i)) + (POOL.length - i)) % (POOL.length - i));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, n).map((i) => POOL[i]);
}

/** Formats that Nick is allowed to interrupt. Operational segments (station-id,
 *  sign-on, sign-off, operator-cutin), his own hour (music-block), and
 *  commercial breaks are excluded. */
const INTERRUPTIBLE = new Set([
  "news",
  "weather",
  "sports",
  "late-night-talk",
  "field-report",
  "wellness",
  "mixed",
]);

/**
 * How many cut-ins Nick forces per hour, based on how drunk he is.
 *
 *   19–21  (warming up, relatively polite):  1
 *   21–00  (loose, getting bold):             1–2
 *   00–03  (wasted, emotional):               1–3
 *   03–07  (collapse hour, openly weeping):   2–4
 *
 * The extra cut-ins beyond the minimum are probability-gated per slot so
 * not every hour at the same time-of-night plays identically.
 *
 * Hard cap: 4 per hour.
 */
function cutInCount(inWorldTime: string, dateStr: string, slotKey: string): number {
  const hh = parseInt(inWorldTime.split(":")[0], 10);

  let min: number;
  let max: number;
  if (hh >= 19 && hh < 21) {
    // Early: warming up
    min = 1; max = 1;
  } else if (hh >= 21 || hh === 0) {
    // Mid-night: getting bold. hh>=21 catches 21,22,23; hh===0 catches midnight
    min = 1; max = 2;
  } else if (hh >= 1 && hh < 3) {
    // Late: wasted
    min = 1; max = 3;
  } else {
    // Collapse hour (3–7): can't stop
    min = 2; max = 4;
  }

  if (min === max) return min;

  // Roll for each extra slot above minimum. Each extra has a 50% chance.
  let count = min;
  for (let i = min; i < max; i++) {
    const roll = ((hash(`${dateStr}::${slotKey}::extra::${i}`) % 100) + 100) % 100;
    if (roll < 50) count++;
  }
  return count;
}

/**
 * Pick Nick's cut-ins for a segment. Returns 0+ NickCutIn objects.
 *
 * - Returns [] for non-interruptible formats (music-block, commercials, ops).
 * - Guaranteed at least 1 for interruptible formats.
 * - Scales up to 4 based on how deep into the night Nick is.
 * - Deterministic per (date, slot) so 60-second polls return the same set.
 */
/** Pick a random cut-in (non-deterministic — for debug trigger). */
export function pickRandomNickCutIn(): NickCutIn {
  return POOL[Math.floor(Math.random() * POOL.length)];
}

export function getNickCutIns(
  format: string,
  inWorldTime: string,
  dateStr: string,
  slotKey: string,
): NickCutIn[] {
  if (!INTERRUPTIBLE.has(format)) return [];
  const count = cutInCount(inWorldTime, dateStr, slotKey);
  return pickCutIns(dateStr, slotKey, count);
}
