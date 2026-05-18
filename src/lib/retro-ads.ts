// src/lib/retro-ads.ts
// Real 80s TV commercials from YouTube, paired with in-universe PRGE sponsor
// text. The client schedules one every ~15 minutes. The YouTube iframe plays
// the real ad; the sponsor text below ties it to the station's world.
//
// No API call needed — purely client-side.

export interface RetroAd {
  /** YouTube video ID (11 chars). */
  videoId: string;
  /** What the real ad is, for internal reference. */
  realDescription: string;
  /** In-universe PRGE sponsor line displayed below the player. */
  sponsorLine: string;
  /** Secondary sponsor copy — the fine print / tagline. */
  sponsorDetail: string;
}

const POOL: readonly RetroAd[] = [
  // ── Fast Food / Food & Drink ────────────────────────────────────────
  {
    videoId: "R6_eWWfNB54",
    realDescription: "Wendy's 'Where's the Beef?' (1984)",
    sponsorLine: "BROUGHT TO YOU BY PURGELAWYER",
    sponsorDetail:
      "Where's the beef? In your pre-filed estate trust. PurgeLawyer — because assets change hands fast tonight.",
  },
  {
    videoId: "xffOCZYX6F8",
    realDescription: "Coca-Cola 'Mean Joe Greene' (1979)",
    sponsorLine: "SPONSORED BY MORNINGCARE TRIAGE",
    sponsorDetail:
      "You'll want something stronger than a Coke at 7am. MorningCare Triage — on your doorstep before the sun clears Mendota.",
  },
  {
    videoId: "po0jY4WvCIc",
    realDescription: "Pepsi 'New Generation' — Michael Jackson (1984)",
    sponsorLine: "PURGESHIELD PANELS PRESENTS",
    sponsorDetail:
      "The new generation of home defense. Modular. Ballistic. Financing available. Madison-West showroom closes at 5.",
  },
  {
    videoId: "sr5CGYeFKgw",
    realDescription: "Folgers 'The Best Part of Waking Up' (1984)",
    sponsorLine: "MORNINGCARE TRIAGE REMINDS YOU",
    sponsorDetail:
      "The best part of waking up is waking up. MorningCare — 1,100+ calls answered last year. We'll be there at 7:01.",
  },
  {
    videoId: "nL7-3GHktZg",
    realDescription: "Max Headroom Coke II commercial (1985)",
    sponsorLine: "SAFEWALK GPS",
    sponsorDetail:
      "Max speed. Max coverage. Max chance of getting home. 8,400 active routes last Purge Night. SafeWalk GPS.",
  },
  // ── Cereal ──────────────────────────────────────────────────────────
  {
    videoId: "E-OYybJUR_I",
    realDescription: "Lucky Charms 'Magically Delicious' (80s)",
    sponsorLine: "PURGEPET BOARDING",
    sponsorDetail:
      "They're magically safe. Locked kennels, sliding scale, open until 6:45pm. 2,800 animals sheltered last year. Only 31 unclaimed.",
  },
  {
    videoId: "reIGOLb6tk0",
    realDescription: "Frosted Flakes 'They're Grrreat!' (80s)",
    sponsorLine: "PURGESHIELD PANELS",
    sponsorDetail:
      "They're grrreat at stopping 7.62mm rounds. PurgeShield — engineered for tonight, engineered for tomorrow.",
  },
  // ── Toys & Games ────────────────────────────────────────────────────
  {
    videoId: "bOM1T7sWvW4",
    realDescription: "Transformers toy commercial (1984)",
    sponsorLine: "RENTAMARINE — LAKE MENDOTA DIVISION",
    sponsorDetail:
      "More than meets the eye. RentaMarine boat-club packages — because the lake is the safest place in Madison tonight.",
  },
  {
    videoId: "nmwF-zy2Ypo",
    realDescription: "My Buddy and Kid Sister dolls (1985)",
    sponsorLine: "PURGEPET BOARDING",
    sponsorDetail:
      "Your buddy deserves better than a barricade. PurgePet — locked, climate-controlled, insured. Pickup starts at 7:15am.",
  },
  {
    videoId: "1wlHQERVPaw",
    realDescription: "Micro Machines 'Motormouth' (1987)",
    sponsorLine: "SAFEWALK GPS",
    sponsorDetail:
      "Fast-talking won't save you. Real-time routing will. 1,200 routes re-routed around hot zones last year. SafeWalk GPS.",
  },
  // ── As-Seen-On-TV ──────────────────────────────────────────────────
  {
    videoId: "sRWtFVFSx5I",
    realDescription: "The Clapper 'Clap On, Clap Off' (1984)",
    sponsorLine: "PURGESHIELD PANELS",
    sponsorDetail:
      "Clap on the locks. Sleep through the night. PurgeShield — three-hour install, lifetime warranty.",
  },
  {
    videoId: "tzY7qQFij_M",
    realDescription: "Chia Pet original commercial",
    sponsorLine: "SISTER MARIGOLD'S QUIET ORDER",
    sponsorDetail:
      "Ch-ch-ch-chia. Breathe in. Let it grow. The Sisters of the Pause remind you: growth is inevitable. So is tonight.",
  },
  {
    videoId: "KwaCJfGWyU0",
    realDescription: "Life Call 'I've Fallen and I Can't Get Up' (1987)",
    sponsorLine: "MORNINGCARE TRIAGE",
    sponsorDetail:
      "I've fallen and I can't get up. Average response time: 22 minutes. MorningCare — we come to you.",
  },
  // ── PSAs ────────────────────────────────────────────────────────────
  {
    videoId: "GOnENVylxPI",
    realDescription: "'This Is Your Brain on Drugs' fried egg PSA (1987)",
    sponsorLine: "PRGE PUBLIC SERVICE ANNOUNCEMENT",
    sponsorDetail:
      "This is your neighborhood. This is your neighborhood on Purge Night. Any questions? Stay home.",
  },
  {
    videoId: "o3V3yoFgvf8",
    realDescription: "McGruff the Crime Dog 'Take a Bite Out of Crime' (80s)",
    sponsorLine: "PRGE PUBLIC SERVICE ANNOUNCEMENT",
    sponsorDetail:
      "Take a bite out of crime. Or don't. Tonight, crime bites back. Lock your doors. PRGE cares.",
  },
  // ── Iconic 80s ─────────────────────────────────────────────────────
  {
    videoId: "2zfqw8nhUwA",
    realDescription: "Apple Macintosh '1984' Super Bowl ad — Ridley Scott",
    sponsorLine: "PRGE — PIRATE RADIO",
    sponsorDetail:
      "On January 24th, Apple introduced the Macintosh. 185 years later, we're still broadcasting on stolen frequencies. You're welcome.",
  },
  {
    videoId: "EESM2HY8BVc",
    realDescription: "California Raisins 'I Heard It Through the Grapevine' (1986)",
    sponsorLine: "PURGELAWYER",
    sponsorDetail:
      "Heard it through the grapevine? Get it in writing. PurgeLawyer — 6,100 estates pre-filed last year. 890 activated.",
  },
  {
    videoId: "C6KOlC393lo",
    realDescription: "Nintendo NES 'Now You're Playing With Power' (1986)",
    sponsorLine: "PURGESHIELD PANELS",
    sponsorDetail:
      "Now you're playing with power. Ballistic-rated power. PurgeShield — 4,200 units sold in Madison metro last year.",
  },
  {
    videoId: "rGnZ9QSoQv0",
    realDescription: "Enjoli perfume 'I Can Bring Home the Bacon' (1980)",
    sponsorLine: "MORNINGCARE TRIAGE",
    sponsorDetail:
      "I can bring home the bacon, fry it up in a pan, and call MorningCare at 7am. Monthly subscription. Worth it.",
  },
];

/** Simple deterministic hash for stable selection. */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return h;
}

/**
 * Pick N distinct ads from the pool, seeded deterministically so the same
 * session gets a stable rotation. The seed should include the segment
 * fingerprint + an index so each 15-minute slot gets a different ad.
 */
export function pickRetroAd(seed: string): RetroAd {
  const h = hash(seed);
  const idx = ((h % POOL.length) + POOL.length) % POOL.length;
  return POOL[idx];
}

/** Total number of ads in the pool. */
export const POOL_SIZE = POOL.length;

/** Pick a random ad (non-deterministic — for debug trigger). */
export function pickRandomRetroAd(): RetroAd {
  return POOL[Math.floor(Math.random() * POOL.length)];
}
