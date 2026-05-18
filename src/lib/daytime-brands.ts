// src/lib/daytime-brands.ts
// LOCKED brand list for the unmanned daytime (07:00–18:59 Madison) commercial
// rotation. Mix of REAL Madison-area businesses (with real addresses / phone
// numbers) and fictional in-universe brands (dispensaries, energy drinks,
// snacks). The kind of sponsors you'd hear on a 420.69 FM pirate station.
//
// The AI ad-copy generator gets this list as user-message context and writes
// ONLY copy variants for these brands — it does NOT invent new daytime
// sponsors at runtime. Doc edits this file directly to add/retire sponsors.

export type DaytimeCategory =
  | "bar"
  | "record-store"
  | "tattoo"
  | "smoke-shop"
  | "diner"
  | "bowling"
  | "laundromat"
  | "auto-repair"
  | "wine-and-spirits"
  | "pawn-shop"
  | "thrift"
  | "dispensary"
  | "energy-drink"
  | "snack"
  | "edibles"
  | "coffee"
  | "soft-drink-cbd";

export interface DaytimeBrand {
  /** Business name as it appears on the ad card. */
  name: string;
  /** Business category — informs the writer's voice register. */
  category: DaytimeCategory;
  /** Street address. Real businesses only — omit for fictional brands. */
  address?: string;
  /** Phone number, if available. */
  phone?: string;
  /** 1-line description the writer leans on for texture. */
  texture: string;
  /** Optional Doc-locked tagline. The AI may riff on or quote it. */
  taglineSeed?: string;
  /** 3 pre-written ad body variants. staticAdBody() picks one by hash. */
  adLines: [string, string, string];
}

export const DAYTIME_BRANDS: readonly DaytimeBrand[] = [
  // ── Required picks ────────────────────────────────────────────────────

  {
    name: "RILEY'S WINES OF THE WORLD",
    category: "wine-and-spirits",
    address: "402 W Gorham St, Madison, WI 53703",
    phone: "(608) 257-0400",
    texture: "Wine, beer, and spirits near the UW campus since forever",
    taglineSeed: "If they don't have it, you don't need it.",
    adLines: [
      "Riley's Wines of the World. 402 West Gorham. Every bottle on the shelf earned its spot. (608) 257-0400.",
      "Riley's. Corner of Gorham and Broom. More wine than you'll drink in a lifetime, and they'll help you try. (608) 257-0400.",
      "Riley's Wines of the World. Walking distance from campus, dangerous distance from your wallet. 402 W Gorham St. (608) 257-0400.",
    ],
  },
  {
    name: "PAWNAMERICA",
    category: "pawn-shop",
    address: "1753 Thierer Rd, Madison, WI 53704",
    phone: "(608) 241-7006",
    texture: "Buy, sell, trade — electronics, tools, instruments, whatever you've got",
    taglineSeed: "Somebody's loss is your come-up.",
    adLines: [
      "PawnAmerica. 1753 Thierer Road. Bring what you've got, leave with what you need. (608) 241-7006.",
      "PawnAmerica — guitars, amps, power tools, gold. If it has value, they're buying. 1753 Thierer Rd. (608) 241-7006.",
      "Need cash before sundown? PawnAmerica, Thierer Road. No judgments, fair offers. (608) 241-7006.",
    ],
  },
  {
    name: "GOODWILL",
    category: "thrift",
    address: "4530 Verona Rd, Madison, WI 53711",
    phone: "(608) 271-4687",
    texture: "Thrift store, donation center, treasure hunt",
    taglineSeed: "Your ex's wardrobe at prices you deserve.",
    adLines: [
      "Goodwill on Verona Road. Somebody's clean-out is your new favorite jacket. 4530 Verona Rd. (608) 271-4687.",
      "Goodwill. You're not broke, you're thrifty. Vintage tees, kitchen gear, books by the pound. 4530 Verona Rd.",
      "Goodwill, Verona Road location. Half the fun is not knowing what you'll find. The other half is the price tag. (608) 271-4687.",
    ],
  },

  // ── Fictional — dispensaries ───────────────────────────────────────────

  {
    name: "GREEN HORIZON DELIVERY",
    category: "dispensary",
    texture: "Madison same-day delivery dispensary",
    taglineSeed: "From bud to bag in twenty minutes. We're already on your block.",
    adLines: [
      "Green Horizon Delivery. Madison same-day. Order before sunset, enjoy before dark. We're already on your block.",
      "Green Horizon — your neighborhood source. From bud to bag in twenty minutes.",
      "Support local. Support Green Horizon Delivery. Open all day. Same-day to any Madison address.",
    ],
  },
  {
    name: "BUCKY'S BUDS",
    category: "dispensary",
    texture: "UW-Madison-mascot-adjacent dispensary chain",
    taglineSeed: "4:20 every day. Even March 23rd.",
    adLines: [
      "Bucky's Buds. 4:20 every day. Even March 23rd. Madison's most school-spirited dispensary.",
      "Bucky's Buds — pre-rolls, flower, edibles. On, Wisconsin. Open seven days.",
      "Bucky's Buds. Red and white on the outside. Green on the inside. You know the one.",
    ],
  },

  // ── Fictional — energy drinks & snacks ────────────────────────────────

  {
    name: "CHRONOS ENERGY · SHIFT-LITE",
    category: "energy-drink",
    texture: "Caffeine drink, brewed in Sun Prairie",
    taglineSeed: "Sixteen ounces of stay-up. Engineered for the eight-hour gig.",
    adLines: [
      "Chronos Energy Shift-Lite. Sixteen ounces of stay-up. Brewed in Sun Prairie, sold everywhere.",
      "Chronos Shift-Lite — engineered for the eight-hour gig. Grab one at any Madison gas station.",
      "Chronos Energy. The thing between you and a nap. Brewed local. Sold cold.",
    ],
  },
  {
    name: "MENDOTA MUNCHIES",
    category: "snack",
    texture: "Gas-station snack chain ringing the lake",
    taglineSeed: "Open 23 hours. You know the night we mean.",
    adLines: [
      "Mendota Munchies. Open 23 hours a day. You know the night we mean. Gas stations around the lake.",
      "Mendota Munchies — chips, jerky, mystery meat sticks, and whatever else fits in a bag. Open almost always.",
      "Mendota Munchies. Because you're hungry and it's 2 AM and nothing else is open. Except us. Mostly.",
    ],
  },
  {
    name: "CURD-CRUSHERS",
    category: "snack",
    texture: "Fried cheese-curd chips",
    taglineSeed: "Fried in Eau Claire, eaten everywhere.",
    adLines: [
      "Curd-Crushers. Fried cheese-curd chips. Fried in Eau Claire, eaten everywhere. Available at select Madison locations.",
      "Curd-Crushers — because somebody finally put cheese curds in a chip bag. You're welcome, Wisconsin.",
      "Curd-Crushers. Grab a bag on your way through. You were going to eat something worse anyway.",
    ],
  },

  // ── Fictional — chill stuff ───────────────────────────────────────────

  {
    name: "YAHARA YIELDS",
    category: "edibles",
    texture: "Small-batch edibles co-op, named for the river",
    taglineSeed: "Low and slow. The Wisconsin way.",
    adLines: [
      "Yahara Yields. Small-batch edibles. Low and slow — the Wisconsin way. Start low, go slow.",
      "Yahara Yields — handcrafted in small batches along the Yahara. The mellow option.",
      "Yahara Yields. Named for the river. Gentle as the current. Ask at your local co-op.",
    ],
  },
  {
    name: "NORTHWOODS NITRO",
    category: "coffee",
    texture: "Cold-brew coffee, Wisconsin-craft",
    taglineSeed: "Blackout strong. Brown County roast.",
    adLines: [
      "Northwoods Nitro. Cold brew. Blackout strong. Brown County roast. At your local co-op.",
      "Northwoods Nitro — fuel for the daylight hours. You need this more than you think.",
      "Northwoods Nitro cold brew. Wisconsin-roasted, nitrogen-charged. Not for the faint of heart.",
    ],
  },
  {
    name: "OLD STYLE CALM",
    category: "soft-drink-cbd",
    texture: "CBD seltzer, Old Style beer riff",
    taglineSeed: "The smooth slow you remember.",
    adLines: [
      "Old Style Calm. CBD seltzer. Crack one open. Calm down. The smooth slow you remember.",
      "Old Style Calm — available cold, everywhere. For when the world is too much.",
      "Old Style Calm. Not beer. Not juice. Just... calm. Available at Madison grocers.",
    ],
  },

  // ── Dive bars ─────────────────────────────────────────────────────────

  {
    name: "CRYSTAL CORNER BAR",
    category: "bar",
    address: "1302 Williamson St, Madison, WI 53715",
    phone: "(608) 256-2953",
    texture: "Cash-only Willy Street dive bar with live music — a Madison institution",
    taglineSeed: "Cash only. Always has been.",
    adLines: [
      "Crystal Corner Bar. 1302 Williamson. Cash only, live music, no pretense. The way bars are supposed to work. (608) 256-2953.",
      "The Crystal. Willy Street. If you have to ask if they take cards, you've never been. Bring cash. (608) 256-2953.",
      "Crystal Corner Bar. Live music, cold beer, sticky floors, good people. 1302 Williamson St. Cash. Only.",
    ],
  },
  {
    name: "MICKEY'S TAVERN",
    category: "bar",
    address: "1524 Williamson St, Madison, WI 53703",
    phone: "(608) 251-9964",
    texture: "Willy Street neighborhood bar — cheap drinks, burgers, weekend brunch",
    taglineSeed: "The burger's better than it has any right to be.",
    adLines: [
      "Mickey's Tavern. 1524 Williamson. Cheap drinks, honest burgers, weekend brunch that fixes what ails you. (608) 251-9964.",
      "Mickey's. Willy Street. The kind of bar where everybody knows your name and nobody cares. (608) 251-9964.",
      "Mickey's Tavern — if the burger doesn't fix it, the price will. 1524 Williamson St, Madison. (608) 251-9964.",
    ],
  },
  {
    name: "THE WISCO",
    category: "bar",
    address: "852 Williamson St, Madison, WI 53703",
    phone: "(608) 256-8211",
    texture: "East side dive — pool, darts, sand volleyball, occasional live music",
    taglineSeed: "Pool. Darts. Sand volleyball. What else do you need.",
    adLines: [
      "The Wisco. 852 Williamson. Pool table, dartboard, sand volleyball court out back. This is the bar you've been looking for. (608) 256-8211.",
      "The Wisco — dive bar with a volleyball court, because Madison. 852 Williamson St. (608) 256-8211.",
      "The Wisco. East side. Cold drinks, warm vibes, sand between your toes. 852 Williamson. (608) 256-8211.",
    ],
  },
  {
    name: "COME BACK IN",
    category: "bar",
    address: "508 E Wilson St, Madison, WI 53703",
    phone: "(608) 258-8619",
    texture: "Downtown dive bar and grill, cash-only vibes, live music",
    taglineSeed: "You left. Now come back in.",
    adLines: [
      "Come Back In. 508 East Wilson. Dive bar, live music, food that hits. You know the drill. (608) 258-8619.",
      "Come Back In — downtown Madison's answer to the question nobody asked. 508 E Wilson St. (608) 258-8619.",
      "Come Back In. The name is the whole pitch. 508 E Wilson, Madison. (608) 258-8619.",
    ],
  },

  // ── Record stores ─────────────────────────────────────────────────────

  {
    name: "STRICTLY DISCS",
    category: "record-store",
    address: "1900 Monroe St, Madison, WI 53711",
    phone: "(608) 259-1991",
    texture: "Legendary indie record store since 1988 — new and used vinyl, CDs",
    taglineSeed: "Half a million records. One of them is yours.",
    adLines: [
      "Strictly Discs. 1900 Monroe Street. Spinning since '88. Half a million records — new, used, and the one you've been hunting. (608) 259-1991.",
      "Strictly Discs — if it was pressed on vinyl, they probably have it. 1900 Monroe St, Madison. (608) 259-1991.",
      "Strictly Discs. Monroe Street. The kind of record store where you walk in for one album and leave with six. (608) 259-1991.",
    ],
  },
  {
    name: "MADCITY MUSIC",
    category: "record-store",
    address: "2023 Atwood Ave, Madison, WI 53704",
    phone: "(608) 251-8558",
    texture: "Used vinyl, CDs, cassettes, and music memorabilia on the east side",
    taglineSeed: "Used. Loved. Priced right.",
    adLines: [
      "MadCity Music. 2023 Atwood Ave. Used vinyl, tapes, CDs, and whatever else washed up. (608) 251-8558.",
      "MadCity Music — Atwood Ave. Crate-digging paradise. Your next favorite album is three dollars. (608) 251-8558.",
      "MadCity Music. East side. If you're still buying new records at full price, we can't help you. 2023 Atwood. (608) 251-8558.",
    ],
  },
  {
    name: "B-SIDE RECORDS",
    category: "record-store",
    address: "514 State St, Madison, WI 53703",
    phone: "(608) 255-1977",
    texture: "State Street record shop since 1982 — new and uncommon vinyl",
    taglineSeed: "State Street. Since '82.",
    adLines: [
      "B-Side Records. 514 State Street. Stocking uncommon vinyl since 1982. Walk in a customer, walk out a collector. (608) 255-1977.",
      "B-Side Records — State Street's longest-running argument that physical media isn't dead. 514 State St. (608) 255-1977.",
      "B-Side Records. Forty-plus years on State Street. If they don't have the pressing you want, it might not exist. (608) 255-1977.",
    ],
  },

  // ── Tattoo ────────────────────────────────────────────────────────────

  {
    name: "STEVE'S TATTOO",
    category: "tattoo",
    address: "1205 Williamson St, Madison, WI 53703",
    phone: "(608) 251-6111",
    texture: "Willy Street tattoo shop — inking Madison since 1975",
    taglineSeed: "Fifty years of ink. Still steady.",
    adLines: [
      "Steve's Tattoo. 1205 Williamson St. Inking Madison since 1975. Walk-ins welcome, regrets not included. (608) 251-6111.",
      "Steve's Tattoo — Willy Street. Half a century of steady hands. Your skin, their canvas. (608) 251-6111.",
      "Steve's Tattoo. Fifty years on Williamson Street. If your parents got inked in Madison, it was probably here. (608) 251-6111.",
    ],
  },

  // ── Smoke shop ────────────────────────────────────────────────────────

  {
    name: "UP IN SMOKE",
    category: "smoke-shop",
    address: "1935 Monroe St, Madison, WI 53711",
    phone: "(608) 255-2209",
    texture: "Glass pipes, smoking accessories, 100+ American glass artists",
    taglineSeed: "Handblown. American-made. Functional art.",
    adLines: [
      "Up In Smoke. 1935 Monroe Street. Handblown glass from over a hundred American artists. (608) 255-2209.",
      "Up In Smoke — Monroe Street. Functional art for the discerning enthusiast. (608) 255-2209.",
      "Up In Smoke. If you're still using that gas station piece, you owe yourself an upgrade. 1935 Monroe St. (608) 255-2209.",
    ],
  },

  // ── Diners ────────────────────────────────────────────────────────────

  {
    name: "THE CURVE",
    category: "diner",
    address: "653 S Park St, Madison, WI 53715",
    phone: "(608) 251-0311",
    texture: "Old-school greasy spoon — breakfast and lunch, been there forever",
    taglineSeed: "Breakfast doesn't need to be complicated.",
    adLines: [
      "The Curve. 653 South Park. Eggs, hash browns, coffee that doesn't apologize. Open for breakfast and lunch. (608) 251-0311.",
      "The Curve — Park Street. The kind of diner where the waitress calls you 'hon' and means it. (608) 251-0311.",
      "The Curve. No avocado toast. No oat milk. Just breakfast. 653 S Park St, Madison. (608) 251-0311.",
    ],
  },

  // ── Bowling ───────────────────────────────────────────────────────────

  {
    name: "DREAM LANES",
    category: "bowling",
    address: "13 Atlas Ct, Madison, WI 53714",
    phone: "(608) 221-3596",
    texture: "Old-school independent bowling alley — leagues, open bowling, classic Americana",
    taglineSeed: "Rent shoes. Throw rocks. Forget everything.",
    adLines: [
      "Dream Lanes. 13 Atlas Court. Rent the shoes, grab a lane, order a pitcher. It's not complicated. (608) 221-3596.",
      "Dream Lanes — Madison's independent bowling alley. Leagues, open bowl, and a jukebox that still takes quarters. (608) 221-3596.",
      "Dream Lanes. Because sometimes the best therapy is throwing a heavy ball at ten pins. 13 Atlas Ct. (608) 221-3596.",
    ],
  },

  // ── Laundromat ────────────────────────────────────────────────────────

  {
    name: "MOUND STREET LAUNDROMAT",
    category: "laundromat",
    address: "1306 Mound St, Madison, WI 53715",
    phone: "(608) 609-4890",
    texture: "Coin-op neighborhood laundromat near UW campus, Greenbush",
    taglineSeed: "Quarters and patience.",
    adLines: [
      "Mound Street Laundromat. 1306 Mound St. Bring quarters, bring a book, leave with clean clothes. (608) 609-4890.",
      "Mound Street Laundromat — Greenbush neighborhood. Coin-op, self-serve, open early. Your apartment washer wishes. (608) 609-4890.",
      "Mound Street Laundromat. Not glamorous. Extremely necessary. 1306 Mound St, Madison. (608) 609-4890.",
    ],
  },

  // ── Auto repair ───────────────────────────────────────────────────────

  {
    name: "MIDWEST ENGINE SERVICE",
    category: "auto-repair",
    address: "3712 Milwaukee St, Madison, WI 53714",
    phone: "(608) 244-9040",
    texture: "Independent full-service auto repair since 1989 — domestic and import",
    taglineSeed: "They'll fix it. They've been fixing it since '89.",
    adLines: [
      "Midwest Engine Service. 3712 Milwaukee Street. Full-service auto repair since 1989 — domestic, import, whatever you drive. (608) 244-9040.",
      "Midwest Engine Service — they've kept Madison running for thirty-five years. Your car deserves better than a chain shop. (608) 244-9040.",
      "Midwest Engine Service. Milwaukee Street. Honest diagnosis, fair price, actual humans. (608) 244-9040.",
    ],
  },
] as const;

/**
 * Render the brand list as a plain-text block the writer prompt can consume.
 * Bracketed delimiters mirror the band-facts pattern so the model recognizes
 * "this is locked ground truth — quote it, riff on it, don't invent past it."
 */
export function formatDaytimeBrandsBlock(): string {
  const sections = DAYTIME_BRANDS.map((b) => {
    const seed = b.taglineSeed
      ? `\nTagline seed: "${b.taglineSeed}"`
      : "";
    const phone = b.phone ? ` | ${b.phone}` : "";
    const addr = b.address ? `\nAddress: ${b.address}${phone}` : "";
    return `--- ${b.name} (${b.category}) ---${addr}\nTexture: ${b.texture}${seed}`;
  });
  return `=== DAYTIME BRAND LIST (LOCKED) ===\n${sections.join("\n\n")}\n=== END DAYTIME BRAND LIST ===`;
}
