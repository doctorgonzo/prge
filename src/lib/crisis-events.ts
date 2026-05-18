// src/lib/crisis-events.ts
// Extended crisis events for PRGE Purge Night. Unlike Tim's quick 15-second
// emergency alerts, these are *sustained disruptions* — they start with an
// opening Tim alert, then persist as an ambient state for 3-8 minutes,
// injecting ticker updates, Tim check-ins, and caller reactions throughout.
//
// A crisis changes the feel of the broadcast: signal degrades, the ticker
// shifts to breaking updates, callers react in real-time. When it resolves,
// Tim (or whoever's left in the chair) closes it out.
//
// Tim's voice: same as tim-interrupts.ts — competent, calm, Midwest baritone,
// short punchy sentences. He manages, doesn't panic.
//
// Quinn's voice (station breach only): Irish, charming, drunk, ex-politician.
// Under pressure he gets genuinely scared but tries to keep the patter going.
// The charm cracks. You hear the man underneath.

// ── Types ──────────────────────────────────────────────────────────────────

export interface CrisisUpdate {
  /** Delay in ms from crisis start when this update fires */
  delayMs: number;
  /** How the update manifests */
  type: "tim-check-in" | "ticker" | "caller";
  /** Content — string for ticker/caller, string[] for tim-check-in (lines array) */
  content: string | string[];
}

export interface CrisisResolution {
  /** How the crisis ends */
  type: "tim-alert" | "fade";
  /** Tim's closing lines if type is tim-alert */
  lines?: string[];
}

export interface CrisisEvent {
  id: string;
  type:
    | "weather"
    | "fire"
    | "gun-violence"
    | "break-in"
    | "infrastructure"
    | "signal"
    | "medical";
  /** Short internal label */
  title: string;
  severity: 1 | 2 | 3;
  /** Minimum hour index (0=7pm, 5=midnight, 11=6am). Undefined = any time. */
  minHour?: number;
  /** How long the crisis state persists in ms (after the opening alert dismisses) */
  durationMs: number;
  /** Additional signal degradation during this crisis (subtracted from signal strength) */
  signalPenalty: number;
  /** Tim's opening alert lines (triggers as a full-screen EmergencyAlert) */
  openingLines: string[];
  /** Mid-crisis updates — ticker items, Tim check-ins, caller reactions */
  updates: CrisisUpdate[];
  /** How the crisis resolves */
  resolution: CrisisResolution;
}

// ── The Pool ───────────────────────────────────────────────────────────────

const POOL: readonly CrisisEvent[] = [
  // ═══════════════════════════════════════════════════════════════════════
  // WEATHER (3)
  // ═══════════════════════════════════════════════════════════════════════

  {
    id: "weather-tornado",
    type: "weather",
    title: "Tornado warning — Dane County",
    severity: 3,
    durationMs: 420_000, // 7 minutes
    signalPenalty: 35,
    openingLines: [
      "All programming stops. This is Tim Peplinski.",
      "National Weather Service has issued a tornado warning for Dane County. This is not a drill.",
      "Rotation detected southwest of Verona moving northeast at forty miles per hour.",
      "If you are above ground — get below ground. Now. Interior room, lowest floor.",
      "This is the real thing, Madison.",
    ],
    updates: [
      {
        delayMs: 60_000,
        type: "ticker",
        content:
          "TORNADO WARNING: Funnel cloud spotted near Fitchburg — moving NE toward downtown Madison — take shelter immediately",
      },
      {
        delayMs: 150_000,
        type: "tim-check-in",
        content: [
          "Pep here. Rotation is tracking toward the Isthmus. ETA eight minutes.",
          "Signal's going to get rough. Stay on whatever frequency you can hold.",
        ],
      },
      {
        delayMs: 240_000,
        type: "caller",
        content:
          "Can see the wall cloud from our attic window on Regent. It's green. The sky is green. We're going to the basement now.",
      },
      {
        delayMs: 330_000,
        type: "tim-check-in",
        content: [
          "Debris reported near West Towne. The cell is weakening but it's still on the ground.",
          "Do not come out until I give the all-clear. I mean it.",
        ],
      },
    ],
    resolution: {
      type: "tim-alert",
      lines: [
        "Tim Peplinski. Rotation has lifted. Warning downgraded to a watch.",
        "Damage reports coming in from the Fitchburg corridor. No confirmation on casualties yet.",
        "If your shelter is intact, stay put another ten minutes. Let the debris settle.",
        "Back to programming.",
      ],
    },
  },

  {
    id: "weather-thunderstorm",
    type: "weather",
    title: "Severe thunderstorm — large hail",
    severity: 2,
    durationMs: 300_000, // 5 minutes
    signalPenalty: 20,
    openingLines: [
      "Pep here. Severe thunderstorm warning just dropped for all of Dane County.",
      "We're talking golf-ball hail and sixty-mile-per-hour wind gusts.",
      "If you're in a vehicle — stop. If you're sheltering near windows — move away from them.",
      "This storm is moving fast. Twenty minutes and it should clear.",
    ],
    updates: [
      {
        delayMs: 70_000,
        type: "ticker",
        content:
          "SEVERE THUNDERSTORM: Quarter-size hail reported in Middleton — storm tracking east across Madison — winds gusting to 65 mph",
      },
      {
        delayMs: 140_000,
        type: "caller",
        content:
          "Hail just shattered our garage window on Mineral Point Road. Sounds like someone's throwing rocks at the house. This on top of everything else tonight.",
      },
      {
        delayMs: 220_000,
        type: "tim-check-in",
        content: [
          "Storm's crossing the Capitol now. Heaviest hail is past the west side.",
          "Signal took a hit from the static. Boosting power.",
        ],
      },
    ],
    resolution: {
      type: "tim-alert",
      lines: [
        "Storm cell has moved past Sun Prairie. We're on the backside of it now.",
        "Some street flooding on University and near Wingra. Avoid low ground if you're moving.",
        "Back to regular programming.",
      ],
    },
  },

  {
    id: "weather-flood",
    type: "weather",
    title: "Flash flood advisory — Mendota/Monona",
    severity: 2,
    durationMs: 330_000, // 5.5 minutes
    signalPenalty: 10,
    openingLines: [
      "Tim Peplinski with a flash flood advisory.",
      "Lake Mendota is over the seawall at James Madison Park. Monona is cresting near Olin.",
      "The Isthmus is narrowing, people. Low-lying areas between the lakes are going to flood.",
      "If you're near Williamson and Baldwin — that intersection floods first. Get to higher ground.",
    ],
    updates: [
      {
        delayMs: 80_000,
        type: "ticker",
        content:
          "FLASH FLOOD: Water rising on Williamson St near the co-op — Yahara River overflow expected — avoid low-lying Isthmus areas",
      },
      {
        delayMs: 170_000,
        type: "caller",
        content:
          "Water's coming up through the floor drain in our basement on Rutledge. Six inches and climbing. We're moving to second floor. Please tell people to stay off Willy Street.",
      },
      {
        delayMs: 260_000,
        type: "tim-check-in",
        content: [
          "Update on the flooding. Water's reached the 900 block of East Washington.",
          "Yahara outflow is at capacity. This isn't going down until morning.",
        ],
      },
    ],
    resolution: {
      type: "tim-alert",
      lines: [
        "Flood levels appear to have stabilized. Not receding yet, but not rising.",
        "John Nolen Drive is underwater south of the Monona Terrace. Do not attempt to cross.",
        "We'll keep the advisory ticker running. Stay aware.",
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════
  // FIRE (3)
  // ═══════════════════════════════════════════════════════════════════════

  {
    id: "fire-state-street",
    type: "fire",
    title: "Structure fire spreading on State Street",
    severity: 2,
    minHour: 2,
    durationMs: 300_000, // 5 minutes
    signalPenalty: 10,
    openingLines: [
      "Pep here. Structure fire on State Street between Lake and Gorham.",
      "Multiple buildings involved. Fire is spreading east with the wind.",
      "Nobody is coming to put it out. You know the rules tonight.",
      "If you're sheltering on State — get out. Move toward the Capitol or the lake. Pick one.",
    ],
    updates: [
      {
        delayMs: 60_000,
        type: "ticker",
        content:
          "FIRE: Structure fire spreading on State Street — multiple storefronts involved — area between Lake St and Gorham impassable",
      },
      {
        delayMs: 130_000,
        type: "caller",
        content:
          "I can see the fire from my roof on Mifflin. Two buildings fully engulfed. Embers are carrying. Someone please check on the people above the old bookstore.",
      },
      {
        delayMs: 210_000,
        type: "tim-check-in",
        content: [
          "Fire has jumped to the north side of State. Wind's not helping.",
          "If you can smell smoke anywhere on the Isthmus — close your windows, seal the gaps. That air is not safe.",
        ],
      },
    ],
    resolution: {
      type: "tim-alert",
      lines: [
        "State Street fire appears to have hit a firebreak at the parking structure near Fairchild.",
        "Still burning, but it's not spreading. Smoke is drifting south over the Monona Terrace.",
        "Avoid the 300-500 blocks of State until morning. Structural collapse risk.",
      ],
    },
  },

  {
    id: "fire-east-wash-warehouse",
    type: "fire",
    title: "Warehouse blaze near East Wash — evac route blocked",
    severity: 3,
    minHour: 4,
    durationMs: 420_000, // 7 minutes
    signalPenalty: 15,
    openingLines: [
      "All programming stops. Tim Peplinski.",
      "Massive fire at the old industrial complex on East Washington near First Street.",
      "This is a warehouse fire. Accelerants involved — the heat signature is enormous.",
      "East Wash is impassable from Blair to Baldwin. That cuts off a major evacuation corridor.",
      "If your exit plan used East Wash — you need a new plan. Now.",
    ],
    updates: [
      {
        delayMs: 80_000,
        type: "ticker",
        content:
          "STRUCTURE FIRE: Warehouse complex at E. Washington & First St — explosions reported — East Wash blocked Blair to Baldwin",
      },
      {
        delayMs: 160_000,
        type: "tim-check-in",
        content: [
          "Secondary explosion at the warehouse. Felt it from here.",
          "Whatever was stored in that building, it's cooking off. Stay upwind. That means north of Johnson right now.",
        ],
      },
      {
        delayMs: 260_000,
        type: "caller",
        content:
          "From the roof on Brearly — the whole sky is orange. Ash falling like snow. We've got embers on our building. Wetting down the roof with buckets. This is insane.",
      },
      {
        delayMs: 350_000,
        type: "tim-check-in",
        content: [
          "Fire is contained to the original complex. Adjacent buildings holding so far.",
          "The smoke column is visible from everywhere. I know. Stay calm.",
        ],
      },
    ],
    resolution: {
      type: "tim-alert",
      lines: [
        "Warehouse fire is burning itself out. Fuel's spent.",
        "East Wash will not be passable until well after sunrise. Route through Johnson or Willy instead.",
        "The air quality east of the Capitol is dangerous. If you have masks, use them.",
        "Back to programming.",
      ],
    },
  },

  {
    id: "fire-residential-no-response",
    type: "fire",
    title: "Residential fires — no fire department response",
    severity: 2,
    durationMs: 270_000, // 4.5 minutes
    signalPenalty: 8,
    openingLines: [
      "Tim Peplinski. Multiple residential fires reported across the south side.",
      "Monroe Street area, Bay Creek, and Greenbush. At least four structures.",
      "I want to be straight with you — nobody is coming. Fire department does not respond during the Purge.",
      "If you can fight it, fight it. If you can't, get out and get away from it.",
    ],
    updates: [
      {
        delayMs: 70_000,
        type: "ticker",
        content:
          "RESIDENTIAL FIRES: Multiple structures burning in Monroe St / Bay Creek / Greenbush — no emergency response available",
      },
      {
        delayMs: 150_000,
        type: "caller",
        content:
          "Our neighbor's house on Beld Street is fully involved. We helped them get out. Three kids. They're with us now. If anyone on the south side has extra blankets, we need them at sunrise.",
      },
      {
        delayMs: 230_000,
        type: "tim-check-in",
        content: [
          "Reports say the Greenbush fire was set deliberately. Multiple points of origin.",
          "If you're on the south side, stay vigilant. Whoever did this may still be in the area.",
        ],
      },
    ],
    resolution: {
      type: "tim-alert",
      lines: [
        "Residential fires appear to be burning down on their own. The wind shifted — that's helping.",
        "Six hours until fire crews can respond. If your structure is damaged, do not go back inside.",
        "Resuming regular programming.",
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════
  // GUN VIOLENCE (3)
  // ═══════════════════════════════════════════════════════════════════════

  {
    id: "gun-east-wash-shootout",
    type: "gun-violence",
    title: "Active shootout — East Washington corridor",
    severity: 2,
    minHour: 1,
    durationMs: 300_000, // 5 minutes
    signalPenalty: 5,
    openingLines: [
      "This is Tim. Active shootout reported on East Washington between Paterson and Brearly.",
      "Multiple weapons. Multiple groups. This is not targeted — it's a free-for-all.",
      "If you are anywhere on East Wash between the Capitol and Baldwin — get off the street. Get below window level.",
      "Do not look. Do not record. Get down.",
    ],
    updates: [
      {
        delayMs: 60_000,
        type: "ticker",
        content:
          "ACTIVE GUNFIRE: East Washington Ave between Paterson and Brearly — multiple shooters — shelter in place",
      },
      {
        delayMs: 130_000,
        type: "caller",
        content:
          "I'm on the second floor on Few Street. Can hear it from here. Rounds are hitting cars. A window just broke somewhere below us. My roommate is having a panic attack.",
      },
      {
        delayMs: 220_000,
        type: "tim-check-in",
        content: [
          "Gunfire has slowed. Sounds like one group moved east.",
          "Stay down for another ten minutes minimum. These things flare back up.",
        ],
      },
    ],
    resolution: {
      type: "tim-alert",
      lines: [
        "East Wash corridor has gone quiet. Fifteen minutes without shots.",
        "If you're sheltering in that area, stay put until you're sure. Quiet doesn't always mean over.",
        "Back to programming. Stay low.",
      ],
    },
  },

  {
    id: "gun-armed-convoy",
    type: "gun-violence",
    title: "Armed convoy moving through Dudgeon-Monroe",
    severity: 2,
    minHour: 3,
    durationMs: 270_000, // 4.5 minutes
    signalPenalty: 5,
    openingLines: [
      "Pep here. Armed convoy — four vehicles, headlights off — moving south on Monroe Street.",
      "They're organized. Matching vehicles. This isn't random.",
      "Monroe, Dudgeon, Nakoma — go dark. Lights off, radio low, away from windows.",
      "Let them pass. That is the only play here.",
    ],
    updates: [
      {
        delayMs: 70_000,
        type: "ticker",
        content:
          "ARMED CONVOY: Four vehicles moving south on Monroe St toward Nakoma — organized group — all residents go dark",
      },
      {
        delayMs: 150_000,
        type: "caller",
        content:
          "They just passed our house on Commonwealth. Slow. One of them had a spotlight. Swept it across our front windows. We didn't move. They kept going. Jesus Christ.",
      },
      {
        delayMs: 220_000,
        type: "tim-check-in",
        content: [
          "Convoy appears to be heading toward the Beltline. Moving out of residential.",
          "Hold your positions for five more minutes. Make sure they're gone.",
        ],
      },
    ],
    resolution: {
      type: "tim-alert",
      lines: [
        "Convoy has left the Monroe Street corridor. Last spotted heading west on the Beltline.",
        "They're someone else's problem now. Monroe, Dudgeon — you can breathe.",
        "Back to programming.",
      ],
    },
  },

  {
    id: "gun-tenney-park-firefight",
    type: "gun-violence",
    title: "Running firefight through Tenney Park",
    severity: 3,
    minHour: 4,
    durationMs: 360_000, // 6 minutes
    signalPenalty: 10,
    openingLines: [
      "All stop. Tim Peplinski. This is critical.",
      "Running firefight in progress through Tenney Park. Automatic weapons.",
      "This is moving — started at the lagoon, heading north toward Sherman Ave.",
      "Everyone between Gorham and Johnson, east of Baldwin — you are in the line of fire.",
      "Basement. Now. Not a suggestion.",
    ],
    updates: [
      {
        delayMs: 80_000,
        type: "ticker",
        content:
          "CRITICAL: Running firefight through Tenney Park — automatic weapons — moving north toward Sherman Ave — take shelter immediately",
      },
      {
        delayMs: 160_000,
        type: "tim-check-in",
        content: [
          "Sustained fire near the Marston Ave bridge. Someone set up a position.",
          "Rounds are carrying across the lake. East side of Mendota is catching strays.",
        ],
      },
      {
        delayMs: 240_000,
        type: "caller",
        content:
          "Bullet just came through our wall on Sherman. Through the wall. We're army-crawling to the basement with our kids. Please God.",
      },
      {
        delayMs: 310_000,
        type: "tim-check-in",
        content: [
          "Sounds like one group broke off. Fire is intermittent now.",
          "Do not assume it's over. Stay below window level.",
        ],
      },
    ],
    resolution: {
      type: "tim-alert",
      lines: [
        "Tenney Park has been quiet for twelve minutes. I'm calling it.",
        "Sherman Ave, Marston, the whole corridor — check your walls. Check your people.",
        "If anyone is injured and can reach us, key channel four. We'll relay what we can.",
        "Resuming broadcast.",
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════
  // BREAK-IN (2)
  // ═══════════════════════════════════════════════════════════════════════

  {
    id: "break-in-atwood-cluster",
    type: "break-in",
    title: "Home invasion cluster — Atwood (Darren's neighborhood)",
    severity: 2,
    minHour: 2,
    durationMs: 300_000, // 5 minutes
    signalPenalty: 5,
    openingLines: [
      "Tim Peplinski. We're getting multiple reports of home invasions along the Atwood corridor.",
      "At least three break-ins in the last twenty minutes between Winnebago and Walter Street.",
      "This looks coordinated. They're hitting houses one at a time and moving south.",
      "Atwood, Schenk's Corners, Eastmorland — barricade what you can. They're working the block.",
    ],
    updates: [
      {
        delayMs: 70_000,
        type: "caller",
        content:
          "It's Darren. They're on my block. I can hear them hitting the house two doors down. I've got the bat and I'm in the basement. Same basement as last year. Same goddamn basement.",
      },
      {
        delayMs: 150_000,
        type: "ticker",
        content:
          "HOME INVASIONS: Coordinated break-in crew working Atwood Ave south from Winnebago — residents barricade and shelter",
      },
      {
        delayMs: 230_000,
        type: "tim-check-in",
        content: [
          "Reports say the crew has moved past Dunning Street. They're heading toward Olbrich.",
          "If they already passed your block, stay locked down anyway. They circle back sometimes.",
        ],
      },
    ],
    resolution: {
      type: "tim-alert",
      lines: [
        "Atwood corridor — break-in crew appears to have moved south past Olbrich Park.",
        "Darren, if you're listening — you're clear. Again. Same story, different year.",
        "Everyone else on Atwood, give it another fifteen minutes before you relax.",
        "Back to programming.",
      ],
    },
  },

  {
    id: "break-in-station-breach",
    type: "break-in",
    title: "Station breach — Tim goes dark, Quinn takes over",
    severity: 3,
    minHour: 6,
    durationMs: 480_000, // 8 minutes — the long one
    signalPenalty: 25,
    openingLines: [
      "All programming stops. This is Tim.",
      "Someone is inside the building. Ground floor. I can hear them.",
      "Quinn — you're on the mic. Right now. I'm going downstairs.",
      "Madison, if I'm not back in five minutes, Quinn runs the show. That's the protocol.",
      "Do not adjust your frequency. Stay with us.",
    ],
    updates: [
      {
        delayMs: 45_000,
        type: "tim-check-in",
        content: [
          "— [silence, then Quinn's voice] —",
          "Right. Okay. It's Quinn. Tim's gone downstairs and I'm... I'm here.",
          "I'm sure it's fine. He does this. He's Tim. He's grand.",
        ],
      },
      {
        delayMs: 120_000,
        type: "caller",
        content:
          "Quinn, what's happening? Is Tim okay? We heard a bang on the air right before he cut out. Please tell us something.",
      },
      {
        delayMs: 180_000,
        type: "tim-check-in",
        content: [
          "— [Quinn, audibly shaken] —",
          "Still no word from Tim. It's been three minutes. That's... look, that's not great, but it's not — ",
          "He told me five minutes. I'm giving him five minutes.",
          "Madison, just stay with me. I know I'm not — I know I'm not him. But I'm here.",
        ],
      },
      {
        delayMs: 270_000,
        type: "ticker",
        content:
          "STATION ALERT: PRGE broadcast compromised — Tim Peplinski investigating breach — Quinn Foley on emergency broadcast — stand by",
      },
      {
        delayMs: 350_000,
        type: "tim-check-in",
        content: [
          "— [Quinn, trying to hold it together] —",
          "Five minutes is up. He said five minutes and it's been — ",
          "Okay. I'm thinking. I'm thinking about what to do.",
          "I used to run a city council. I can do this. Different kind of crisis. Same principle. Stay calm. Make decisions.",
          "If Tim doesn't come back I keep the signal alive. That's what he'd want.",
        ],
      },
      {
        delayMs: 420_000,
        type: "tim-check-in",
        content: [
          "— [sound of a door, then Tim's voice, slightly winded] —",
          "It's Pep. I'm back. We're clear.",
        ],
      },
    ],
    resolution: {
      type: "tim-alert",
      lines: [
        "False alarm. Raccoons in the ductwork.",
        "Quinn, you did fine. Give me the mic.",
        "Madison — we're still here. Back to it.",
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════
  // INFRASTRUCTURE (2)
  // ═══════════════════════════════════════════════════════════════════════

  {
    id: "infra-power-grid",
    type: "infrastructure",
    title: "Power grid sector failure — rolling blackout",
    severity: 2,
    minHour: 3,
    durationMs: 330_000, // 5.5 minutes
    signalPenalty: 15,
    openingLines: [
      "Tim Peplinski. East side power grid just went down.",
      "Everything from the Capitol to Stoughton Road is dark. Streetlights, buildings, everything.",
      "We're on battery backup here at the station. I've got ninety minutes of juice.",
      "If you just lost power — your fridge, your phone charger, your security system. All gone. Plan accordingly.",
    ],
    updates: [
      {
        delayMs: 75_000,
        type: "ticker",
        content:
          "POWER OUTAGE: East-side grid failure — Capitol to Stoughton Rd — all sectors dark — PRGE on battery backup",
      },
      {
        delayMs: 160_000,
        type: "caller",
        content:
          "Power just died on our block on Milwaukee Street. The dark is the worst part. At least with lights on you can see if someone's coming. Now we're just listening.",
      },
      {
        delayMs: 250_000,
        type: "tim-check-in",
        content: [
          "Looks like a transformer blew at the Blount Street substation. Not sabotage — just overload.",
          "Power's not coming back tonight. Utility crews don't roll during the Purge either.",
        ],
      },
    ],
    resolution: {
      type: "tim-alert",
      lines: [
        "I'm getting reports that the west-side grid is holding. Outage is contained to the east.",
        "If you've got battery lanterns, now's the time. Dawn is still hours away.",
        "Station battery is holding. We're not going anywhere.",
        "Back to programming.",
      ],
    },
  },

  {
    id: "infra-gas-leak-capitol",
    type: "infrastructure",
    title: "Gas leak near the Capitol — evacuation reroute",
    severity: 2,
    durationMs: 300_000, // 5 minutes
    signalPenalty: 8,
    openingLines: [
      "Pep here. Gas main rupture reported near the Capitol Square. West Mifflin and Fairchild.",
      "Smelling it from here. That's how close we are to this.",
      "If you are anywhere on the Square or within three blocks — move. Move now. Move upwind.",
      "One spark and that whole corridor goes up. I'm not being dramatic. That's chemistry.",
    ],
    updates: [
      {
        delayMs: 80_000,
        type: "ticker",
        content:
          "GAS LEAK: Ruptured main near Capitol Square at W. Mifflin & Fairchild — evacuate 3-block radius — explosion risk",
      },
      {
        delayMs: 170_000,
        type: "caller",
        content:
          "We evacuated from our apartment on West Dayton. The gas smell is unreal — eyes watering two blocks away. Where are we supposed to go? Everywhere else is the Purge.",
      },
      {
        delayMs: 250_000,
        type: "tim-check-in",
        content: [
          "Gas is still venting. The leak is underground — nobody can shut it off until morning.",
          "Revised evacuation: stay north of Johnson, south of University. The wind is pushing the plume east.",
        ],
      },
    ],
    resolution: {
      type: "tim-alert",
      lines: [
        "Gas concentration is dispersing. Wind picked up from the west — that's helping.",
        "Still not safe to return to the Square. Dawn plus two hours at minimum.",
        "If you evacuated, find a place to hold. Don't wander.",
        "Resuming broadcast.",
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SIGNAL (1)
  // ═══════════════════════════════════════════════════════════════════════

  {
    id: "signal-jammer-truck",
    type: "signal",
    title: "FCC jammer truck closing in on station",
    severity: 3,
    minHour: 5,
    durationMs: 420_000, // 7 minutes
    signalPenalty: 40,
    openingLines: [
      "All stop. This is Tim Peplinski and this is not a drill.",
      "Government jammer truck — confirmed FCC successor unit — spotted on University Avenue heading east.",
      "They are hunting our signal. Directional array. Military-grade.",
      "I'm cutting power to minimum and switching to the buried antenna. We will be hard to hear.",
      "If you lose us — scan 86 to 89. We'll be somewhere in there. We do not go dark.",
    ],
    updates: [
      {
        delayMs: 60_000,
        type: "ticker",
        content:
          "SIGNAL THREAT: FCC jammer unit on University Ave heading east — PRGE reducing power — scan 86-89 MHz if signal drops",
      },
      {
        delayMs: 140_000,
        type: "tim-check-in",
        content: [
          "Truck has passed Randall. Two minutes from range.",
          "Dropping to five watts. You're going to hear static. That's us surviving.",
        ],
      },
      {
        delayMs: 230_000,
        type: "caller",
        content:
          "I can barely hear you. Nothing but static and then your voice comes through for a second. Keep going Tim. We're out here listening through the noise.",
      },
      {
        delayMs: 320_000,
        type: "tim-check-in",
        content: [
          "They're sweeping Park Street now. Wrong direction. They overshot.",
          "Holding at five watts until they clear the neighborhood.",
        ],
      },
    ],
    resolution: {
      type: "tim-alert",
      lines: [
        "Jammer truck is heading south on Park Street toward the Beltline. They missed us.",
        "Bringing power back up. Full signal in ten seconds.",
        "They'll be back. They always come back. But not tonight.",
        "We stay on the air. That's the whole point. Back to programming.",
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════
  // MEDICAL (1)
  // ═══════════════════════════════════════════════════════════════════════

  {
    id: "medical-triage-overflow",
    type: "medical",
    title: "Triage centers overwhelmed — diverting",
    severity: 2,
    minHour: 3,
    durationMs: 300_000, // 5 minutes
    signalPenalty: 5,
    openingLines: [
      "Tim Peplinski with a medical advisory.",
      "The primary triage point at the Alliant Energy Center is at capacity. They are turning people away.",
      "If you have wounded and you're heading there — don't. You will wait in a parking lot with everyone else.",
      "Secondary triage at the Goodman Community Center on Waubesa. They're still taking people.",
    ],
    updates: [
      {
        delayMs: 80_000,
        type: "ticker",
        content:
          "MEDICAL: Alliant Energy Center triage at capacity — diverting to Goodman Community Center on Waubesa St — bring your own supplies if possible",
      },
      {
        delayMs: 170_000,
        type: "caller",
        content:
          "Just came from Alliant. It's a nightmare. Hundreds of people. Three medics. They're doing their best but they need supplies — gauze, clean water, anything. If you can get there safely bring what you have.",
      },
      {
        delayMs: 250_000,
        type: "tim-check-in",
        content: [
          "Goodman Center reporting they can take maybe fifty more.",
          "After that, it's field medicine. If anyone out there has training — EMT, nurse, vet tech, anything — they need you at Goodman.",
        ],
      },
    ],
    resolution: {
      type: "tim-alert",
      lines: [
        "Third triage point opening at the Baraboo Room in Monona Terrace. East entrance only.",
        "Spreading the load. If you're injured and mobile, Monona Terrace is closest for Isthmus residents.",
        "This is the reality of tonight. Help who you can. Back to programming.",
      ],
    },
  },
] as const;

// ── Utilities ──────────────────────────────────────────────────────────────

/** Simple deterministic hash — same as tim-interrupts.ts / caller-popups.ts. */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return h;
}

/**
 * Deterministic pick from the full pool, seeded by an arbitrary string.
 * Same seed always returns the same crisis event.
 */
export function pickCrisisEvent(seed: string): CrisisEvent {
  const h = hash(seed);
  const idx = ((h % POOL.length) + POOL.length) % POOL.length;
  return POOL[idx];
}

/**
 * Non-deterministic pick — returns a random crisis event.
 * Useful for debug triggers and manual testing.
 */
export function pickRandomCrisisEvent(): CrisisEvent {
  return POOL[Math.floor(Math.random() * POOL.length)];
}

/**
 * Returns the canonical station breach event — guaranteed once per broadcast.
 */
export function getStationBreach(): CrisisEvent {
  const breach = POOL.find((e) => e.id === "break-in-station-breach");
  if (!breach) throw new Error("Station breach event not found in pool");
  return breach;
}

/**
 * Pick a non-breach crisis event for random scheduling.
 */
export function pickRandomNonBreachCrisis(): CrisisEvent {
  const candidates = POOL.filter((e) => e.id !== "break-in-station-breach");
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/**
 * Pick a crisis event appropriate for the given hour, or return null if the
 * dice say "no crisis this hour."
 *
 * hourIndex: 0-11 where 0=7pm (19:00), 5=midnight, 11=6am.
 *
 * Probability ramp:
 *   Hours 0-1 (7-9pm):    25% chance — night is young
 *   Hours 2-4 (9pm-12am): 35% chance — things picking up
 *   Hours 5-7 (12-2am):   50% chance — peak hours
 *   Hours 8-11 (2-6am):   60% chance — the long dark
 *
 * Severity weighting after midnight: severity 3 gets 4x, severity 2 gets 2x.
 * Before midnight: uniform among eligible candidates.
 */
export function getCrisisEventForHour(
  hourIndex: number,
  seed: string,
): CrisisEvent | null {
  const combinedSeed = `crisis-event::${hourIndex}::${seed}`;
  const h = Math.abs(hash(combinedSeed));

  // ── Should a crisis fire at all? ──
  const roll = h % 100;
  let threshold: number;
  if (hourIndex <= 1) threshold = 25;
  else if (hourIndex <= 4) threshold = 35;
  else if (hourIndex <= 7) threshold = 50;
  else threshold = 60;

  if (roll >= threshold) return null;

  // ── Filter candidates by minHour ──
  const candidates = POOL.filter((event) => {
    if (event.minHour !== undefined && hourIndex < event.minHour) {
      return false;
    }
    return true;
  });

  if (candidates.length === 0) return null;

  // ── Weight toward higher severity after midnight (hourIndex >= 5) ──
  let weighted: CrisisEvent[];
  if (hourIndex >= 5) {
    weighted = [];
    for (const c of candidates) {
      const multiplier = c.severity === 3 ? 4 : c.severity === 2 ? 2 : 1;
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
