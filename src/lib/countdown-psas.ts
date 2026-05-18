// src/lib/countdown-psas.ts
// Survival PSAs for the 1-hour pre-Purge countdown (18:00–19:00 Madison time).
// Cycled on screen during countdown mode — urgent, practical, in-universe.
//
// Two voices:
//   "tim"  — Tim Peplinski, station operator. Gruff, direct, Midwest baritone.
//            He's done this before. He talks like a man who has buried friends
//            and is trying not to bury more. "Listen to me." "I mean it."
//   "prge" — Station automation. Clinical emergency-broadcast register.
//            "PRGE advises..." / "All residents are reminded..." No warmth,
//            no filler, no hedging. The machine doesn't care if you like it.
//
// Category distribution targets (roughly):
//   fortification ~8, supplies ~5, communication ~5, medical ~5, movement ~5,
//   vehicle ~4, defense ~4, psychological ~4, madison ~5, legal ~4,
//   community ~4, post-purge ~4 = ~57 total
//
// Selection: the countdown renderer picks from these in weighted-random order,
// avoiding repeats until the pool is exhausted, then reshuffles. At ~20s per
// PSA display, a full hour burns through ~180 slots — the pool cycles ~3 times.

export interface CountdownPSA {
  /** Who's reading this — "tim" for Tim Peplinski, "prge" for station automation */
  host: "tim" | "prge";
  /** Category for visual styling/grouping */
  category:
    | "fortification"
    | "supplies"
    | "communication"
    | "medical"
    | "movement"
    | "vehicle"
    | "defense"
    | "psychological"
    | "madison"
    | "legal"
    | "community"
    | "post-purge";
  /** The PSA text — 2-4 punchy sentences */
  text: string;
}

export const COUNTDOWN_PSAS: readonly CountdownPSA[] = [
  // ── FORTIFICATION ────────────────────────────────────────────────────

  {
    host: "tim",
    category: "fortification",
    text: "Listen to me. If you haven't boarded your windows yet, you are out of time for plywood. Flip your mattress against the biggest ground-floor window and brace it with your heaviest furniture. It won't stop a bullet but it'll stop a brick.",
  },
  {
    host: "prge",
    category: "fortification",
    text: "PRGE reminds all residents: deadbolts can be kicked in with approximately 100 pounds of force. Reinforce your front door NOW with a 2x4 barricade or a door security bar wedged under the knob at a 45-degree angle. Your lock is not enough.",
  },
  {
    host: "tim",
    category: "fortification",
    text: "Bathrooms. Interior bathrooms with no windows — that's your safe room tonight. Bring your supplies in there, lock the door, and stay quiet. If your bathroom door doesn't lock, remove the doorknob and barricade with the heaviest thing you can drag.",
  },
  {
    host: "prge",
    category: "fortification",
    text: "All residents should disable exterior lighting at 18:45. A lit house is a visible house. Interior light should be limited to one room — your safe room — with towels stuffed under the door to block light bleed. Do not advertise occupancy.",
  },
  {
    host: "tim",
    category: "fortification",
    text: "Sliding glass doors. I cannot say this enough. A sliding glass door is an invitation. If you have one, lay a steel pipe or a cut broomstick in the track AND stack furniture in front of it. The latch alone is worthless.",
  },
  {
    host: "prge",
    category: "fortification",
    text: "PRGE advises all residents in multi-story homes to move to the second floor and remove or barricade the staircase. A dining table flipped on its side across the top of the stairs creates a significant obstacle. Gravity is your ally.",
  },
  {
    host: "tim",
    category: "fortification",
    text: "Garage doors. People forget the garage. A standard residential garage door can be forced open in under thirty seconds. Disconnect the automatic opener, lock the manual latch, and put your car against it from the inside if you have to.",
  },
  {
    host: "prge",
    category: "fortification",
    text: "Attention apartment residents: your hallway is a shared vulnerability. Coordinate with neighbors to barricade stairwell doors on your floor. A single fortified floor is safer than six individually locked apartments.",
  },

  // ── SUPPLIES ─────────────────────────────────────────────────────────

  {
    host: "tim",
    category: "supplies",
    text: "Fill your bathtub with water right now. I mean right now. If the municipal supply gets interrupted — and it has before — that bathtub is drinking water, wound cleaning, and toilet flushing for the next fourteen hours. Do it before you do anything else.",
  },
  {
    host: "prge",
    category: "supplies",
    text: "PRGE recommends the following in your safe room: two gallons of water, non-perishable food, a battery-powered radio tuned to 420.69 FM, a flashlight with fresh batteries, a first aid kit, all prescription medications, and a charged phone with the ringer OFF.",
  },
  {
    host: "tim",
    category: "supplies",
    text: "Batteries. If you don't have batteries, pull them from your remotes, your kids' toys, your smoke detectors — anything. Your flashlight and your radio are your two most important tools tonight. Keep them powered.",
  },
  {
    host: "prge",
    category: "supplies",
    text: "All residents should charge all electronic devices to 100% before 19:00. Power your phone to full, then switch to airplane mode to conserve battery. You will need that phone at 07:00 tomorrow. Do not waste charge tonight.",
  },
  {
    host: "tim",
    category: "supplies",
    text: "If you're on insulin, blood pressure meds, anything you take daily — get it in your safe room right now. Pharmacies are closed for the next thirteen hours. Whatever you need to survive the night and the morning after, gather it now.",
  },

  // ── COMMUNICATION ────────────────────────────────────────────────────

  {
    host: "prge",
    category: "communication",
    text: "PRGE will broadcast continuously through the night on 420.69 FM. If you lose FM reception, try 162.475 MHz on any NOAA weather radio — we are piggybacking the weather band with status updates every thirty minutes.",
  },
  {
    host: "tim",
    category: "communication",
    text: "Buddy system. If you have people in other houses — family, friends, anyone — set a check-in schedule right now. Every hour on the hour, one text. Just the word OKAY. If you don't get OKAY, you still do NOT go outside. You wait until dawn.",
  },
  {
    host: "prge",
    category: "communication",
    text: "Cell towers historically experience congestion beginning at 19:30. Text messages have a higher delivery rate than voice calls during network saturation. Keep all communications to text. Save voice calls for genuine emergencies only.",
  },
  {
    host: "tim",
    category: "communication",
    text: "Turn your ringer off. Turn your notifications off. Any light, any sound from your phone can give away your position. Set it to vibrate only and keep it face-down. One notification ping at the wrong moment can be the difference.",
  },
  {
    host: "prge",
    category: "communication",
    text: "PRGE advises against posting your location or status to social media during the Purge. Geotagged posts have been used to locate occupied residences in previous years. Maintain radio silence on all public platforms until 07:00.",
  },

  // ── MEDICAL ──────────────────────────────────────────────────────────

  {
    host: "tim",
    category: "medical",
    text: "Listen. If someone is bleeding badly, you have one job: pressure. Direct pressure on the wound with the cleanest fabric you have. Don't lift it to check. Just press. Hard. And keep pressing until the bleeding stops or help arrives at dawn.",
  },
  {
    host: "prge",
    category: "medical",
    text: "Improvised tourniquet protocol: belt, necktie, or strip of fabric applied two inches above the wound between the injury and the heart. Tighten until the bleeding stops. Note the time of application. A tourniquet applied correctly saves lives. A loose tourniquet costs them.",
  },
  {
    host: "tim",
    category: "medical",
    text: "Burns. If someone gets burned tonight — and with the fires, people will — cool water only. No ice. No butter. No toothpaste. Cool running water for ten minutes, then cover loosely with a clean cloth. That's it. Anything else makes it worse.",
  },
  {
    host: "prge",
    category: "medical",
    text: "If a member of your household goes into shock — pale skin, rapid breathing, confusion — lay them flat, elevate their legs twelve inches, and cover them with blankets. Do not give them food or water. Keep them warm and still until emergency services resume at 07:00.",
  },
  {
    host: "tim",
    category: "medical",
    text: "Chest wounds. If someone has a puncture wound to the chest and you can hear air sucking through it, seal it. Plastic wrap, a credit card, duct tape — anything airtight, taped on three sides. Leave one side open so air can escape but not enter. This keeps a lung from collapsing.",
  },

  // ── MOVEMENT / ESCAPE ────────────────────────────────────────────────

  {
    host: "prge",
    category: "movement",
    text: "If you are caught outside after 19:00, do not run. Running attracts attention and exhausts you. Move slowly, stay in shadows, pause frequently to listen. You are quieter on grass than on pavement. Avoid streetlights.",
  },
  {
    host: "tim",
    category: "movement",
    text: "If you have to move, move alone or in pairs. Groups of three or more are visible, loud, and slow. Ditch anything reflective — watches, jewelry, glasses if you can see without them. Your silhouette is your enemy tonight.",
  },
  {
    host: "prge",
    category: "movement",
    text: "PRGE advises anyone caught in the open to seek the nearest commercial building with steel fire doors. Churches, schools, and municipal buildings often have reinforced entryways. Residential homes with visible damage should be avoided — they may already be occupied by hostile parties.",
  },
  {
    host: "tim",
    category: "movement",
    text: "Alleys are deathtraps. I know they seem like good shortcuts — they're not. One entrance, one exit, no lateral movement. Stay on streets where you can change direction. If you hear anything ahead of you, reverse immediately. Don't investigate.",
  },
  {
    host: "prge",
    category: "movement",
    text: "If you encounter a group on foot, do not make eye contact and do not change your pace. Sudden behavioral changes signal fear and draw pursuit. Maintain course, keep your hands visible, and turn at the next available intersection. Do not look back.",
  },

  // ── VEHICLE SAFETY ───────────────────────────────────────────────────

  {
    host: "tim",
    category: "vehicle",
    text: "If you're driving tonight — and God help you if you are — your dome light is a beacon. Disable it now. Pull the fuse or tape over the switch. When you open that door, you do not want to light up like a Christmas tree for everyone in a three-block radius.",
  },
  {
    host: "prge",
    category: "vehicle",
    text: "PRGE advises all motorists: do not stop for anyone or anything on the roadway after 19:00. Debris, abandoned vehicles, and staged accidents are common tactics used to force stops. Maintain speed. If your path is blocked, reverse immediately.",
  },
  {
    host: "tim",
    category: "vehicle",
    text: "Gas. If your tank isn't full right now, you made a mistake. Stations are closed. Whatever you have is what you've got for the next thirteen hours. If you're below a quarter tank, park it and shelter in place. A stalled car on Purge night is a coffin.",
  },
  {
    host: "prge",
    category: "vehicle",
    text: "Headlights should be turned off when stationary. If you must drive, use parking lights only — enough to see the road, not enough to announce your position from a distance. Disable all automatic headlight sensors. Drive below 30 mph to reduce engine noise.",
  },

  // ── DEFENSE ──────────────────────────────────────────────────────────

  {
    host: "tim",
    category: "defense",
    text: "You don't need a gun to defend your home tonight. A fire extinguisher sprayed in someone's face will blind them and choke their lungs for long enough to get away. Keep one by your safe room door. It's better than nothing and better than most things.",
  },
  {
    host: "prge",
    category: "defense",
    text: "PRGE reminds all residents: visible deterrents reduce the likelihood of attempted entry. A clearly barricaded home signals difficulty. Handwritten signs reading ARMED or INFECTED have historically reduced approach rates by an estimated 40%.",
  },
  {
    host: "tim",
    category: "defense",
    text: "Wasp spray. I'm serious. A can of wasp spray shoots a stream fifteen feet and will incapacitate someone long enough for you to run or barricade. It's in your garage. It's more effective at range than pepper spray. Go get it right now.",
  },
  {
    host: "prge",
    category: "defense",
    text: "If your residence is breached, do not attempt to confront intruders. Escape through a pre-planned secondary exit — a back window, a basement egress. Confrontation has a lower survival rate than evasion. Your home is replaceable. You are not.",
  },

  // ── PSYCHOLOGICAL ────────────────────────────────────────────────────

  {
    host: "tim",
    category: "psychological",
    text: "You're going to hear things tonight. Screaming. Glass. Sirens that aren't coming for you. Your job is not to investigate. Your job is not to help. Your job is to be alive at seven AM. I know that's hard to hear. I need you to hear it anyway.",
  },
  {
    host: "prge",
    category: "psychological",
    text: "Residents with children should establish the night as a game or camping exercise. Interior tents, sleeping bags, and battery-powered lanterns normalize the environment. Children who remain calm reduce risk for the entire household. Prepare a distraction kit: coloring books, cards, puzzles.",
  },
  {
    host: "tim",
    category: "psychological",
    text: "Panic kills more people on Purge night than weapons do. If you feel your chest tighten, if your hands start shaking — breathe. Four seconds in, hold for four, four seconds out. Do it five times. You cannot make good decisions if your body is in full panic.",
  },
  {
    host: "prge",
    category: "psychological",
    text: "PRGE advises all survivors to contact the Dane County Crisis Line at 608-280-2600 beginning at 08:00 on the morning following the Purge. Acute stress reactions are normal. Guilt, numbness, and intrusive memories are expected. Professional support will be available free of charge for 90 days.",
  },

  // ── MADISON-SPECIFIC ─────────────────────────────────────────────────

  {
    host: "tim",
    category: "madison",
    text: "If you're on the Isthmus, you already know the problem. Two lakes, two bridges, one strip of land. The chokepoints at John Nolen and East Wash are going to be impassable by 19:30. If you're leaving the Isthmus, leave NOW. After that, you're locked in.",
  },
  {
    host: "prge",
    category: "madison",
    text: "PRGE advises all residents near Capitol Square to move at least six blocks from the Capitol building before 19:00. The Square's open sightlines and converging streets make it historically one of the highest-activity zones in Madison on Purge night. State Street is not a safe corridor.",
  },
  {
    host: "tim",
    category: "madison",
    text: "East Siders — the Yahara River crossings at Williamson and East Washington are going to get blocked early. If you need to get north of East Wash, do it before seven. After that, Atwood and Willy Street are on their own. Those neighborhoods know the drill.",
  },
  {
    host: "prge",
    category: "madison",
    text: "UW-Madison campus buildings with reinforced security doors include Bascom Hall, the Mosse Humanities Building, and Van Vleck Hall. The Memorial Library basement has historically served as an informal shelter. University Police will NOT be responding after 19:00.",
  },
  {
    host: "tim",
    category: "madison",
    text: "Lake Mendota, Lake Monona — I know some of you are thinking about the water. A boat sounds smart until you realize you're visible from every shoreline and you have nowhere to run. Last year three people died on Monona trying to wait it out on pontoons. Stay on land. Stay inside.",
  },
  {
    host: "prge",
    category: "madison",
    text: "West Side residents between Gammon Road and Whitney Way: the commercial strip along Odana Road has been designated an informal no-go zone by community watch groups. Travel south of the Beltline is strongly discouraged after 19:00. Residential side streets east of Midvale are historically lower-activity.",
  },

  // ── LEGAL / TIMING ───────────────────────────────────────────────────

  {
    host: "prge",
    category: "legal",
    text: "The Annual Purge commences at 19:00:00 Central Daylight Time and concludes at 07:00:00 CDT. All crime, including murder, is legal for the duration. Emergency services — police, fire, EMS — are suspended from 19:00 to 07:00. You are on your own for twelve hours.",
  },
  {
    host: "prge",
    category: "legal",
    text: "Government officials ranking Class 10 or higher are exempt from targeting during the Purge. This exemption does not extend to their families, staff, or residences. Violation of this exemption carries a federal death sentence enforceable post-Purge.",
  },
  {
    host: "tim",
    category: "legal",
    text: "I'm going to say this one more time because people forget every year: the Purge ends at seven AM. Not sunrise. Not when it gets light out. SEVEN AM CENTRAL TIME. People have been killed at 6:55 by someone who thought it was over. It is not over until seven. Set an alarm.",
  },
  {
    host: "prge",
    category: "legal",
    text: "PRGE reminds all residents: weapons above Class 4 — including explosives, incendiary devices, and chemical or biological agents — remain prohibited during the Purge. Use of restricted weaponry is punishable by death regardless of Purge status. This restriction is enforced by federal satellite surveillance.",
  },

  // ── COMMUNITY / MUTUAL AID ───────────────────────────────────────────

  {
    host: "tim",
    category: "community",
    text: "If you're in a building with neighbors — an apartment, a duplex, anything — talk to them right now. Not at seven. Now. A building full of strangers is weak. A building full of people who have a plan is a fortress. Knock on doors. You have less than an hour.",
  },
  {
    host: "prge",
    category: "community",
    text: "The Wil-Mar Neighborhood Center on Williamson Street is operating as a community shelter until 18:45. After that, doors will be sealed and will not reopen until 07:00. If you need shelter, proceed there immediately. Capacity is limited to 120 persons.",
  },
  {
    host: "tim",
    category: "community",
    text: "Elderly neighbors. People on oxygen. People in wheelchairs. If you know someone on your block who can't fortify on their own, this is the last hour you can help them. Bring them into your home or help them board up theirs. We don't leave people behind. Not tonight.",
  },
  {
    host: "prge",
    category: "community",
    text: "Community supply caches have been reported at the following locations: Tenney Park pavilion, the Goodman Community Center loading dock, and the Allied Drive community room. PRGE cannot verify the status or safety of these sites. Proceed at your own risk before 19:00 only.",
  },

  // ── POST-PURGE ───────────────────────────────────────────────────────

  {
    host: "prge",
    category: "post-purge",
    text: "At 07:00 CDT, the Purge will officially conclude. Do not exit your shelter until you have confirmed the time from at least two independent sources. PRGE will broadcast an all-clear tone at 07:00:00 followed by a continuous tone for sixty seconds. Wait for the tone.",
  },
  {
    host: "tim",
    category: "post-purge",
    text: "When it's over — when it's really over, seven AM, you've heard the tone — do NOT just walk outside. Open a window first. Listen for sixty seconds. Look up and down the street. Make sure nobody's still out there running on adrenaline and a clock that's wrong.",
  },
  {
    host: "prge",
    category: "post-purge",
    text: "Emergency services resume at 07:00 CDT. Dane County EMS can be reached at 911 beginning at that time. Expect significant delays — response times in previous years have averaged 45 to 90 minutes for the first three hours post-Purge. If you have injured persons, begin triage now.",
  },
  {
    host: "tim",
    category: "post-purge",
    text: "Tomorrow morning, when you walk outside and you see what happened to your city — it's going to be bad. It's bad every year. But Madison is still here. We're still here. PRGE will be broadcasting recovery information all day. You survived. That's what matters.",
  },

  // ── ADDITIONAL ROTATION FILL ─────────────────────────────────────────

  {
    host: "tim",
    category: "fortification",
    text: "Pet doors. Cat doors. Doggy doors. Any hole in your wall big enough for an arm is big enough for an incendiary. Seal them. Screw a board over them, stuff them with towels and duct tape them shut. Your cat is staying inside tonight anyway.",
  },
  {
    host: "prge",
    category: "supplies",
    text: "PRGE advises residents to prepare a go-bag in the event safe room breach requires immediate evacuation. Contents: water bottle, flashlight, first aid supplies, cash, ID, phone charger, and comfortable closed-toe shoes. Place near your secondary exit.",
  },
  {
    host: "tim",
    category: "madison",
    text: "Campus. If you're a student and you're still in your dorm — the lakeshore dorms are exposed on three sides. Sellery and Witte are concrete blocks, easier to lock down. If you can move, move to an interior building. If you can't, get to a high floor and barricade.",
  },
  {
    host: "prge",
    category: "communication",
    text: "PRGE will broadcast verified safe-zone locations as they are confirmed throughout the night. Keep your radio on at low volume — speaker against your ear if necessary. Information is survival. Do not turn us off.",
  },
  {
    host: "tim",
    category: "defense",
    text: "Noise. Noise is a weapon and noise is a liability. A group trying to breach your door? Blast an air horn, bang pots, make them think the whole block is awake and angry. But if nobody's at your door? You are silent. You are invisible. You are not home.",
  },
  {
    host: "prge",
    category: "medical",
    text: "If you or someone in your household is diabetic, asthmatic, or epileptic, ensure all emergency medications are within arm's reach in your safe room. Stress-induced medical events are the second leading cause of Purge night fatalities after direct violence.",
  },
  {
    host: "tim",
    category: "movement",
    text: "Parking structures. Multi-level parking ramps. I know they seem like good hiding spots — concrete, multiple levels, hard to search. They're not. They're echo chambers. Every footstep carries. And there are people who know that and use ramps as hunting grounds. Stay out.",
  },
  {
    host: "prge",
    category: "legal",
    text: "The New Founding Fathers of America remind all citizens: the Purge is your right and your duty. PRGE reminds all citizens: survival is also your right. Choose accordingly.",
  },
  {
    host: "tim",
    category: "psychological",
    text: "If you're alone tonight, I get it. I'm alone too. This station is a basement and a transmitter and me. But you're hearing my voice, which means you're not really alone. Stay on this frequency. I'll be here all night. We do this together.",
  },
  {
    host: "tim",
    category: "community",
    text: "After tonight, check on your neighbors. Not the ones you heard screaming — the ones you didn't hear from at all. Silence from a house that should have noise is the thing that keeps me up. Bang on doors tomorrow at seven fifteen. Make sure people answer.",
  },
  {
    host: "prge",
    category: "vehicle",
    text: "Residents who must travel by vehicle should program their route in advance and disable GPS voice navigation. Audio from your vehicle — including navigation prompts and radio — should not be audible from outside. Close all windows. Lock all doors. Do not stop.",
  },
  {
    host: "tim",
    category: "madison",
    text: "The Beltline. Every year people think they can take the Beltline out of the city before it starts. Every year the Beltline turns into a parking lot by 18:40. If you're not already past Verona Road, turn around. Find a house. Knock on a door. It's too late to run.",
  },
  {
    host: "prge",
    category: "post-purge",
    text: "Post-Purge recovery stations will be established at Alliant Energy Center, the Kohl Center, and East Towne Mall beginning at 08:00 CDT. These stations will provide medical triage, clean water, family reunification services, and temporary shelter. Bring identification if possible.",
  },
];
