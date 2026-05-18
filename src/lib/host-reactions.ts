// ---------------------------------------------------------------------------
// PRGE Pirate TV — Host Reactions
// Pre-baked one-liners from hosts when Nick Trulino hijacks their segment
// to play a song. Displayed as low-opacity subtitles below the music player.
// ---------------------------------------------------------------------------

export interface HostReaction {
  host: string; // host ID: "quinn" | "tucker" | "caroline" | "holden" | "marigold" | "tim"
  text: string;
}

// ---- Quinn Foley — Irish, charming, disgraced politician, heavy drinker ----
const quinnReactions: HostReaction[] = [
  { host: "quinn", text: "[sighs] Every year, Trulino. Every goddamn year." },
  {
    host: "quinn",
    text: "I was mid-sentence, Nicholas. Mid. Sentence.",
  },
  {
    host: "quinn",
    text: "You know what, play the whole album. I need a drink anyway.",
  },
  {
    host: "quinn",
    text: "Grand so. I'll just be over here. Waiting. Patiently.",
  },
  {
    host: "quinn",
    text: "[under breath] At least it's not the Ramones again.",
  },
  {
    host: "quinn",
    text: "Tell me, does he do this to Caroline too, or is it just me?",
  },
  {
    host: "quinn",
    text: "Fair play, Trulino. That one's actually decent.",
  },
  {
    host: "quinn",
    text: "I had a point. It was a good point. It's gone now.",
  },
];

// ---- Tucker Traywick (they/them) — Cool, analytical, math nerd ----
const tuckerReactions: HostReaction[] = [
  {
    host: "tucker",
    text: "I had four minutes and twenty-two seconds of airtime remaining.",
  },
  { host: "tucker", text: "[flatly] That's not even good punk." },
  {
    host: "tucker",
    text: "Statistically, he interrupts my segments 2.4 times more than anyone else's.",
  },
  {
    host: "tucker",
    text: "I'll just... recalculate my pacing. Again.",
  },
  {
    host: "tucker",
    text: "The BPM on this doesn't match the energy of what I was building.",
  },
  {
    host: "tucker",
    text: "Nick. I was citing a source.",
  },
  {
    host: "tucker",
    text: "[quiet exhale] Fine. I'll pick up at minute seven.",
  },
  {
    host: "tucker",
    text: "This song is in 4/4. My segment was building a point in threes. It's jarring.",
  },
];

// ---- Caroline — Weather host, competitive, needs to win, brainy ----
const carolineReactions: HostReaction[] = [
  { host: "caroline", text: "Holden, he did it again." },
  {
    host: "caroline",
    text: "I was about to nail that forecast. I had a graphic and everything.",
  },
  {
    host: "caroline",
    text: "Cool. Cool cool cool. This is fine.",
  },
  {
    host: "caroline",
    text: "[to someone off-mic] Does he know how long I prepped for that segment?",
  },
  {
    host: "caroline",
    text: "My segment had a 94% audience retention rate, Trulino. Ninety-four.",
  },
  {
    host: "caroline",
    text: "When I come back, I'm going long. Just so everyone knows.",
  },
  {
    host: "caroline",
    text: "Unbelievable. I was literally mid-word.",
  },
];

// ---- Holden — Sports, analytical, rant-prone ----
const holdenReactions: HostReaction[] = [
  {
    host: "holden",
    text: "Actually, the Descendents' recording setup for Milo Goes to College was fascinating from an engineering\u2014",
  },
  {
    host: "holden",
    text: "No no, this is fine, this reminds me of the '47 Lions halftime controversy actually\u2014",
  },
  {
    host: "holden",
    text: "You know who else got pulled mid-segment? Howard Cosell. Different context, but\u2014",
  },
  {
    host: "holden",
    text: "Okay but can we talk about the mix on this track? The low end is\u2014",
  },
  {
    host: "holden",
    text: "I respect the pivot. In football, you'd call this an audible.",
  },
  {
    host: "holden",
    text: "This is like a two-minute warning. I'll be ready when it's over.",
  },
  {
    host: "holden",
    text: "See, what Nick does here is actually comparable to how relief pitchers disrupt pacing\u2014",
  },
  {
    host: "holden",
    text: "[still talking] \u2014and that's why the '09 draft class was so underrated\u2014 oh, are we back?",
  },
];

// ---- Sister Marigold Vance — Cult-adjacent wellness, unsettlingly calm ----
const marigoldReactions: HostReaction[] = [
  { host: "marigold", text: "...the music is also a form of breath." },
  {
    host: "marigold",
    text: "How beautiful. The universe has chosen a different frequency for us.",
  },
  {
    host: "marigold",
    text: "[eyes closed] I was already transitioning to silence. This is close enough.",
  },
  {
    host: "marigold",
    text: "Nick's energy tonight is very... cardinal. Very red.",
  },
  {
    host: "marigold",
    text: "Let the song wash over you. Resistance is just tension you haven't named.",
  },
  {
    host: "marigold",
    text: "I'll hold the space until he's finished. Time is a circle anyway.",
  },
  {
    host: "marigold",
    text: "This track has a root chakra energy. Grounding. Useful before dawn.",
  },
  {
    host: "marigold",
    text: "[whispering] Even interruption is a teacher.",
  },
];

// ---- Tim Pepinski — Station operator, bald, can-do ----
const timReactions: HostReaction[] = [
  { host: "tim", text: "[radio click] Copy, Nick. Switching feeds." },
  {
    host: "tim",
    text: "Levels are hot. Give me two seconds.",
  },
  {
    host: "tim",
    text: "Routing audio. Stand by.",
  },
  {
    host: "tim",
    text: "[to board] Channel 3, hot. Channel 1, muted. Go.",
  },
  {
    host: "tim",
    text: "Nick's in. Pulling the segment feed now.",
  },
  {
    host: "tim",
    text: "Got it. I'll cue the host back in when the track ends.",
  },
  {
    host: "tim",
    text: "[click] Clean handoff. We're good.",
  },
  {
    host: "tim",
    text: "Yep. On it. Faders are set.",
  },
];

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

/** All host reactions keyed by host ID */
export const HOST_REACTIONS: Record<string, HostReaction[]> = {
  quinn: quinnReactions,
  tucker: tuckerReactions,
  caroline: carolineReactions,
  holden: holdenReactions,
  marigold: marigoldReactions,
  tim: timReactions,
};

/** Maps segment format names to the host who'd be interrupted */
export const FORMAT_TO_HOST: Record<string, string> = {
  news: "quinn",
  weather: "caroline",
  sports: "holden",
  "field-report": "tucker",
  wellness: "marigold",
  "late-night-talk": "quinn",
  mixed: "quinn",
  "operator-cutin": "tim",
};

/**
 * Deterministic pick — same seed always returns the same reaction.
 * Uses a simple string hash so the pick is stable across renders.
 */
export function pickHostReaction(
  hostId: string,
  seed: string
): HostReaction | null {
  const reactions = HOST_REACTIONS[hostId];
  if (!reactions || reactions.length === 0) return null;

  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % reactions.length;
  return reactions[index];
}

/**
 * Random pick — for variety when determinism isn't needed.
 */
export function pickRandomHostReaction(hostId: string): HostReaction | null {
  const reactions = HOST_REACTIONS[hostId];
  if (!reactions || reactions.length === 0) return null;

  const index = Math.floor(Math.random() * reactions.length);
  return reactions[index];
}
