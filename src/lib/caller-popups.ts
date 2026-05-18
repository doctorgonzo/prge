// src/lib/caller-popups.ts
// Pre-baked text-in messages from listeners across Madison during Purge Night.
// These pop up over the broadcast view like AIM messages — a brief window of
// someone else's night bleeding through. No API call needed; the component
// picks one deterministically (or randomly for debug) and displays it.
//
// Tone mix targets: scared ~40%, dark-humor ~25%, wholesome ~15%,
// angry ~10%, cryptic ~10%. Neighborhoods are real Madison.
//
// Darren from Atwood is canonical — he called in last year panicked about
// someone on his roof. He survived. He's back.

export interface CallerPopup {
  /** Caller name (first name only). */
  name: string;
  /** Madison neighborhood. */
  neighborhood: string;
  /** The message. */
  message: string;
  /** Tone: scared, angry, dark-humor, wholesome, cryptic. */
  tone: "scared" | "angry" | "dark-humor" | "wholesome" | "cryptic";
}

export const CALLER_POOL: readonly CallerPopup[] = [
  // ── Scared (~40%) ────────────────────────────────────────────────────

  {
    name: "Darren",
    neighborhood: "Atwood",
    message:
      "It's Darren. I'm back. Same house, same roof. Nobody up there this year — yet. Keeping the lights off.",
    tone: "scared",
  },
  {
    name: "Mia",
    neighborhood: "Tenney Park",
    message:
      "Is anyone else hearing gunshots near Olbrich Park? That's the third burst in ten minutes.",
    tone: "scared",
  },
  {
    name: "Jerome",
    neighborhood: "East Wash",
    message:
      "My neighbor left an hour ago and hasn't come back. His porch light is still on. I don't know what to do with that.",
    tone: "scared",
  },
  {
    name: "Amy",
    neighborhood: "Schenk-Atwood",
    message:
      "There's a group moving down Winnebago. At least eight people. They have bats. Please tell me they're going toward the lake.",
    tone: "scared",
  },
  {
    name: "Carlos",
    neighborhood: "Greenbush",
    message:
      "Someone tried our back door twenty minutes ago. They moved on. We haven't moved since.",
    tone: "scared",
  },
  {
    name: "Lindsay",
    neighborhood: "Bay Creek",
    message:
      "The power went out on our block. Just ours. I can see lights everywhere else. That feels intentional.",
    tone: "scared",
  },
  {
    name: "Tyler",
    neighborhood: "Eastmorland",
    message:
      "Can hear someone in the alley behind our building. They've been there for forty-five minutes. Just standing.",
    tone: "scared",
  },
  {
    name: "Noor",
    neighborhood: "Dudgeon-Monroe",
    message:
      "Smelled smoke from the west side around 22:00. Still smelling it. Nothing on the scanner. Is anyone near Glenway?",
    tone: "scared",
  },
  {
    name: "Greg",
    neighborhood: "Nakoma",
    message:
      "We boarded the windows last week. Hearing things hit the boards. Not sure if it's people or branches. Too scared to check.",
    tone: "scared",
  },
  {
    name: "Rachel",
    neighborhood: "Marquette",
    message:
      "My daughter keeps asking why we can't go outside. I ran out of lies two hours ago.",
    tone: "scared",
  },
  {
    name: "Kenji",
    neighborhood: "Monona",
    message:
      "Car just drove past our house real slow. No headlights. They stopped at the end of the block and sat there. Then they left. I'm shaking.",
    tone: "scared",
  },
  {
    name: "Sandra",
    neighborhood: "Vilas",
    message:
      "Someone is screaming near the zoo. I can't tell if it's a person. God, I hope it's not a person.",
    tone: "scared",
  },
  {
    name: "Darren",
    neighborhood: "Atwood",
    message:
      "Update — hearing footsteps on the porch again. I'm in the basement with the radio. If this is my last text-in, thanks for everything, Quinn.",
    tone: "scared",
  },

  // ── Dark humor (~25%) ────────────────────────────────────────────────

  {
    name: "Pete",
    neighborhood: "Willy St",
    message:
      "If whoever took my Honda Civic from Willy St is listening — there's a sandwich in the glovebox. Enjoy. It's turkey.",
    tone: "dark-humor",
  },
  {
    name: "Dana",
    neighborhood: "Monroe St",
    message:
      "Someone is purging my garden gnomes specifically. Third year in a row. Same gnomes. I'm starting to think it's personal.",
    tone: "dark-humor",
  },
  {
    name: "Marcus",
    neighborhood: "Camp Randall",
    message:
      "Purge Night tip: if you're going to loot Woodman's, grab the good cheese. Last year someone took forty cans of creamed corn. Ambition without vision.",
    tone: "dark-humor",
  },
  {
    name: "Tiff",
    neighborhood: "Middleton",
    message:
      "My ex is texting me 'stay safe' like he didn't make this the worst year of my life. Sir, I survived you. I can survive the Purge.",
    tone: "dark-humor",
  },
  {
    name: "Owen",
    neighborhood: "Bram's Addition",
    message:
      "Just realized I forgot to return my library books. Technically all crime is legal tonight so I'm keeping them. Sorry MPL.",
    tone: "dark-humor",
  },
  {
    name: "Jess",
    neighborhood: "Fitchburg",
    message:
      "We made Purge Night bingo cards. Free space is 'helicopter spotlight.' Already checked it off twice.",
    tone: "dark-humor",
  },
  {
    name: "Rodney",
    neighborhood: "Schenk-Atwood",
    message:
      "Neighbor has a trebuchet. An actual trebuchet. He's been building it since March. I'm not even mad. I'm impressed.",
    tone: "dark-humor",
  },
  {
    name: "Kim",
    neighborhood: "Shorewood Hills",
    message:
      "Our HOA sent a post-Purge lawn restoration reminder at 19:30. Thirty minutes in. HOA never sleeps. Not even tonight.",
    tone: "dark-humor",
  },
  {
    name: "Benji",
    neighborhood: "Atwood",
    message:
      "I ordered a pizza at 18:55. Driver showed up at 19:04. Hazard pay must be unreal. Tipped 200%. Godspeed, Domino's man.",
    tone: "dark-humor",
  },

  // ── Wholesome (~15%) ─────────────────────────────────────────────────

  {
    name: "Grace",
    neighborhood: "Marquette",
    message:
      "Just want to say thanks to whoever left water bottles on porches on Jenifer St. Small thing. Not a small thing tonight.",
    tone: "wholesome",
  },
  {
    name: "David",
    neighborhood: "Dudgeon-Monroe",
    message:
      "My kids are asleep. They think it's a thunderstorm. God bless them.",
    tone: "wholesome",
  },
  {
    name: "Maria",
    neighborhood: "Willy St",
    message:
      "Our block did the candle thing again — one in every window facing the street. Fourteen houses. It means we're still here.",
    tone: "wholesome",
  },
  {
    name: "Terrence",
    neighborhood: "Eastmorland",
    message:
      "Holding my dog and listening to you guys. She doesn't know what night it is. I envy her. Thanks for being on the air.",
    tone: "wholesome",
  },
  {
    name: "Faye",
    neighborhood: "Bay Creek",
    message:
      "Made enough soup for the whole building and left it in the hallway with bowls. Every pot is empty now. That's enough.",
    tone: "wholesome",
  },

  // ── Angry (~10%) ─────────────────────────────────────────────────────

  {
    name: "Dex",
    neighborhood: "East Wash",
    message:
      "When are we going to DO something about this? Every year we sit here. Every year it gets worse. I'm sick of surviving.",
    tone: "angry",
  },
  {
    name: "Lorraine",
    neighborhood: "Greenbush",
    message:
      "Tell Quinn to stop making jokes. People are dying out there. My friend's house is on fire and you're doing bits.",
    tone: "angry",
  },
  {
    name: "Andre",
    neighborhood: "Monona",
    message:
      "Fifteen years of this. Fifteen. My grandfather didn't live through 2158. Don't tell me the system works.",
    tone: "angry",
  },

  // ── Cryptic (~10%) ───────────────────────────────────────────────────

  {
    name: "Hal",
    neighborhood: "Tenney Park",
    message:
      "The tall man is back on Williamson. Same corner as last year. He doesn't move. He just watches.",
    tone: "cryptic",
  },
  {
    name: "Simone",
    neighborhood: "Maple Bluff",
    message:
      "Does anyone else see the lights over Picnic Point? Not flashlights. Above the trees. They've been there since sundown.",
    tone: "cryptic",
  },
  {
    name: "Wren",
    neighborhood: "Nakoma",
    message:
      "Counted the sirens. There were seven. Then silence. Seven again. Then silence. It's a pattern. I don't know whose.",
    tone: "cryptic",
  },
] as const;

// ── Selectors ──────────────────────────────────────────────────────────

/**
 * Deterministic pick — same seed always returns the same caller. Uses the
 * same simple string-hash approach as `pickTimBumper` so the codebase stays
 * consistent. Feed it a segment ID, timestamp, or any stable string.
 */
export function pickCallerPopup(seed: string): CallerPopup {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  const idx =
    ((h % CALLER_POOL.length) + CALLER_POOL.length) % CALLER_POOL.length;
  return CALLER_POOL[idx];
}

/** Random pick — for debug / preview only. Not deterministic. */
export function pickRandomCallerPopup(): CallerPopup {
  return CALLER_POOL[Math.floor(Math.random() * CALLER_POOL.length)];
}
