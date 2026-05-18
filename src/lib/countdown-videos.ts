// src/lib/countdown-videos.ts
// Curated YouTube survival/preparedness videos for the pre-Purge countdown hour.
// These play in the music-block-style iframe during 18:00-19:00.
//
// All video IDs verified against real YouTube URLs as of 2026-05-18.
// Selection: the countdown renderer picks from these in weighted-random order,
// mixing categories so no two consecutive videos share a category.

export interface CountdownVideo {
  /** YouTube video ID */
  videoId: string;
  /** Video title */
  title: string;
  /** Channel name */
  channel: string;
  /** Approximate duration in seconds */
  durationSec: number;
  /** Content category */
  category:
    | "fortification"
    | "first-aid"
    | "urban-survival"
    | "self-defense"
    | "preparedness"
    | "vehicle"
    | "official-psa"
    | "communication"
    | "evasion"
    | "psychological";
}

export const COUNTDOWN_VIDEOS: readonly CountdownVideo[] = [
  // ── Fortification ────────────────────────────────────────────────
  {
    videoId: "ioW4kz65LzY",
    title: "How To Make Your Door Kick-In Proof Like A TANK!",
    channel: "Home Mender",
    durationSec: 480,
    category: "fortification",
  },
  {
    videoId: "DrhZyJetSu0",
    title: "3 EASY Anti-kick Door Reinforcement Upgrades",
    channel: "Home Mender",
    durationSec: 540,
    category: "fortification",
  },
  {
    videoId: "Ujml-yvCpPU",
    title: "How to Turn Your Home Into a Fortress in 5 Minutes",
    channel: "Doorricade",
    durationSec: 300,
    category: "fortification",
  },
  {
    videoId: "0jCUrYY3lEk",
    title: "How To Board Up Windows with Plywood | Hurricane Prep",
    channel: "Lowe's Home Improvement",
    durationSec: 240,
    category: "fortification",
  },

  // ── First Aid ────────────────────────────────────────────────────
  {
    videoId: "NVNawDeYQGE",
    title: "STOP THE BLEED - Apply Tourniquet",
    channel: "STOP THE BLEED",
    durationSec: 300,
    category: "first-aid",
  },
  {
    videoId: "5lDGf9FQSBY",
    title: "How to Apply a Tourniquet | Maryland PATC Training Video",
    channel: "Maryland PATC",
    durationSec: 300,
    category: "first-aid",
  },
  {
    videoId: "4e7evinsfm0",
    title: "How to Treat Cuts and Grazes - First Aid Training",
    channel: "St John Ambulance",
    durationSec: 240,
    category: "first-aid",
  },

  // ── Urban Survival ──────────────────────────────────────────────
  {
    videoId: "dT4APZZ9i2k",
    title:
      "How To Start A Fire Outdoors in an Emergency Survival Situation",
    channel: "SMART Tips & Tricks",
    durationSec: 480,
    category: "urban-survival",
  },
  {
    videoId: "ZPr-a8kht2E",
    title: "How to Start a Fire in a Survival Situation | Basic Instincts",
    channel: "WIRED",
    durationSec: 600,
    category: "urban-survival",
  },
  {
    videoId: "_24heXXhfck",
    title:
      "Urban Survival Tips: How To Find Water When The Faucet Doesn't Work",
    channel: "Reality Survival",
    durationSec: 420,
    category: "urban-survival",
  },

  // ── Self-Defense ────────────────────────────────────────────────
  {
    videoId: "BEUEr3cAEik",
    title: "Top 4 Self Defense Moves for Beginners",
    channel: "Nick Drossos",
    durationSec: 360,
    category: "self-defense",
  },
  {
    videoId: "yBATt_SX67I",
    title: "6 Self-Defense Techniques Everyone Should Know!",
    channel: "Sifu Alan Baker",
    durationSec: 480,
    category: "self-defense",
  },
  {
    videoId: "ziglWlEemvk",
    title: "20 Basic Self Defense Moves Everyone Should Know",
    channel: "Bright Side",
    durationSec: 600,
    category: "self-defense",
  },
  {
    videoId: "QTs8KLZzBNI",
    title: "5 Situational Awareness Hacks for Self-Defense",
    channel: "Self Defense TV",
    durationSec: 420,
    category: "self-defense",
  },

  // ── Preparedness ────────────────────────────────────────────────
  {
    videoId: "JkD5d80ftMk",
    title: "Everything in My Bug Out Bag - 72 Hour Survival Setup!",
    channel: "Canadian Prepper",
    durationSec: 600,
    category: "preparedness",
  },
  {
    videoId: "bxFYeVGKgzI",
    title: "10 Urban Bugout Bag Essentials!",
    channel: "City Prepping",
    durationSec: 480,
    category: "preparedness",
  },
  {
    videoId: "YATDg6tEXi0",
    title: "Bug Out Bag Setup: No-Nonsense Packing List | EDC Go Bag",
    channel: "Gray Bearded Green Beret",
    durationSec: 540,
    category: "preparedness",
  },

  // ── Vehicle ─────────────────────────────────────────────────────
  {
    videoId: "SzU1oVqjZBc",
    title: "25 Things Every Car Needs For Safety & Survival",
    channel: "Practical Engineering",
    durationSec: 540,
    category: "vehicle",
  },
  {
    videoId: "IS94EkwMuFE",
    title: "Evasive Driving: Bootleg Turn, J-Turn, Handbrake Turn",
    channel: "ITS Tactical",
    durationSec: 360,
    category: "vehicle",
  },
  {
    videoId: "eVCVv0fMwu4",
    title: "US Army Evasive Driving Instructional Video",
    channel: "US Army Archives",
    durationSec: 900,
    category: "vehicle",
  },

  // ── Official PSAs ───────────────────────────────────────────────
  {
    videoId: "VaAXYy0L_tg",
    title: "How to Build an Emergency Preparedness Kit",
    channel: "American Red Cross",
    durationSec: 240,
    category: "official-psa",
  },
  // ── Communication ───────────────────────────────────────────────
  {
    videoId: "X42PMrmDmMg",
    title: "How To Use Ham Radio In An Emergency",
    channel: "Ham Radio Crash Course",
    durationSec: 600,
    category: "communication",
  },
  {
    videoId: "ie3y5RIszbc",
    title:
      "Emergency Communication - Get a Ham Radio and Establish a Plan",
    channel: "Sophos Survival",
    durationSec: 480,
    category: "communication",
  },
  {
    videoId: "y37T7I5pTPk",
    title:
      "Disaster Preparedness: Emergency Communications for Your Home",
    channel: "Ham Radio Crash Course",
    durationSec: 540,
    category: "communication",
  },

  // ── Evasion ─────────────────────────────────────────────────────
  {
    videoId: "_f-0GRismLg",
    title: "How To Escape The City (Urban Evasion While Being Hunted)",
    channel: "Garand Thumb",
    durationSec: 1200,
    category: "evasion",
  },
  {
    videoId: "ffc5o7oLdO8",
    title:
      "10 Military Night Stealth Survival Skills, Tips, Tricks & Hacks",
    channel: "BlackScoutSurvival",
    durationSec: 600,
    category: "evasion",
  },
  {
    videoId: "RkkuOWDeM3M",
    title: "Urban Evasion Tips - Gray Man Tactics - Countersurveillance",
    channel: "S2 Underground",
    durationSec: 480,
    category: "evasion",
  },

  // ── Psychological ───────────────────────────────────────────────
  {
    videoId: "CqgmozFr_GM",
    title: "How to Stay Calm Under Pressure",
    channel: "TED-Ed",
    durationSec: 300,
    category: "psychological",
  },
  {
    videoId: "wgVLfMZ8LtQ",
    title:
      "How to Overcome Fear, Stress, & Discomfort - The Science of Stress Mindset",
    channel: "The Learner Lab",
    durationSec: 480,
    category: "psychological",
  },
  {
    videoId: "Ki2NAd_Zhdg",
    title: "The System That Keeps You Mentally Clear Under Pressure",
    channel: "Escaping Ordinary",
    durationSec: 600,
    category: "psychological",
  },
] as const;
