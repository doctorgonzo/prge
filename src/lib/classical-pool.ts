// src/lib/classical-pool.ts
// Pool of long classical pieces for the between-dialog interlude.
// These play as ambient background when the hosts aren't talking —
// the anti-Nick. Soothing, eerie-in-context, public domain.
//
// Each entry has artist + title for the track resolver (same pipeline
// as Nick's music blocks) and an approximate duration. The interlude
// player picks one per slot and lets it run, pausing for events
// (Nick cut-ins, Tim EBS, callers, crises, dead air) and resuming.
//
// These are intentionally LONG pieces or well-known movements so
// they fill time without demanding attention.

export interface ClassicalTrack {
  composer: string;
  title: string;
  /** Approximate duration in seconds. Used for fallback advance timing. */
  durationSec: number;
  /** Optional pre-resolved YouTube video ID to skip the resolver round-trip. */
  videoId?: string;
}

// Curated for mood: pieces that work at 2am during a fictional dystopian
// broadcast. Nothing bombastic — slow, contemplative, slightly unsettling
// in this context. The beauty-against-horror contrast is the whole point.
export const CLASSICAL_POOL: readonly ClassicalTrack[] = [
  {
    composer: "Erik Satie",
    title: "Gymnopédie No. 1",
    durationSec: 195,
  },
  {
    composer: "Claude Debussy",
    title: "Clair de Lune",
    durationSec: 305,
  },
  {
    composer: "Frédéric Chopin",
    title: "Nocturne Op. 9 No. 2",
    durationSec: 270,
  },
  {
    composer: "Johann Sebastian Bach",
    title: "Cello Suite No. 1 in G Major, Prelude",
    durationSec: 165,
  },
  {
    composer: "Maurice Ravel",
    title: "Pavane pour une infante défunte",
    durationSec: 390,
  },
  {
    composer: "Erik Satie",
    title: "Gnossienne No. 1",
    durationSec: 210,
  },
  {
    composer: "Claude Debussy",
    title: "Arabesque No. 1",
    durationSec: 300,
  },
  {
    composer: "Johann Sebastian Bach",
    title: "Air on the G String",
    durationSec: 325,
  },
  {
    composer: "Frédéric Chopin",
    title: "Prelude in E Minor Op. 28 No. 4",
    durationSec: 150,
  },
  {
    composer: "Ludwig van Beethoven",
    title: "Moonlight Sonata 1st Movement",
    durationSec: 375,
  },
  {
    composer: "Camille Saint-Saëns",
    title: "The Swan from Carnival of the Animals",
    durationSec: 195,
  },
  {
    composer: "Edvard Grieg",
    title: "Morning Mood from Peer Gynt",
    durationSec: 255,
  },
  {
    composer: "Gabriel Fauré",
    title: "Pavane Op. 50",
    durationSec: 370,
  },
  {
    composer: "Claude Debussy",
    title: "Rêverie",
    durationSec: 295,
  },
  {
    composer: "Erik Satie",
    title: "Gymnopédie No. 3",
    durationSec: 165,
  },
  {
    composer: "Frédéric Chopin",
    title: "Ballade No. 1 in G Minor",
    durationSec: 565,
  },
  {
    composer: "Samuel Barber",
    title: "Adagio for Strings",
    durationSec: 480,
  },
  {
    composer: "Johann Sebastian Bach",
    title: "Prelude in C Major BWV 846",
    durationSec: 145,
  },
  {
    composer: "Maurice Ravel",
    title: "Jeux d'eau",
    durationSec: 345,
  },
  {
    composer: "Pyotr Ilyich Tchaikovsky",
    title: "Andante Cantabile from String Quartet No. 1",
    durationSec: 420,
  },
];

// Total pool duration: ~85 minutes. More than enough for any interlude period.

/**
 * Pick a deterministic starting track index for a given slot + date,
 * then return the full playlist starting from that point (wrapping).
 */
export function classicalPlaylistForSlot(
  cacheKey: string,
  madisonDate: string,
): ClassicalTrack[] {
  // Simple hash to pick a starting point — same slot + date = same playlist order.
  let h = 0;
  const s = `classical::${madisonDate}::${cacheKey}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const startIdx = ((h >>> 0) % CLASSICAL_POOL.length);

  // Build a playlist starting from the hashed index, wrapping around.
  const playlist: ClassicalTrack[] = [];
  for (let i = 0; i < CLASSICAL_POOL.length; i++) {
    playlist.push(CLASSICAL_POOL[(startIdx + i) % CLASSICAL_POOL.length]);
  }
  return playlist;
}
