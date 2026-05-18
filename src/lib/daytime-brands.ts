// src/lib/daytime-brands.ts
// LOCKED brand list for the unmanned daytime (07:00–18:59 Madison) commercial
// rotation. Different sponsor world from the nighttime Purge-survival economy
// (PurgeShield Panels / RentaMarine / MorningCare Triage / etc.) — daytime is
// weed, energy drinks, sugary snacks, Wisconsin-tinged, with ad copy that
// occasionally winks at the Purge (closure days, "except one", etc.).
//
// The AI ad-copy generator gets this list as user-message context and writes
// ONLY copy variants for these brands — it does NOT invent new daytime brands
// at runtime. Same wallet-protection / world-locking pattern as the baked
// band-facts for music. Doc edits this file directly to add/retire brands.

export type DaytimeCategory =
  | "dispensary"
  | "energy-drink"
  | "snack"
  | "edibles"
  | "coffee"
  | "soft-drink-cbd";

export interface DaytimeBrand {
  /** Brand name as it appears on the ad card. ALL-CAPS render-friendly. */
  name: string;
  /** Product category — informs the writer's voice register. */
  category: DaytimeCategory;
  /** 1-line Wisconsin/Madison hook the writer leans on for texture. */
  texture: string;
  /** Optional Doc-locked tagline. The AI may riff on or quote it. */
  taglineSeed?: string;
}

export const DAYTIME_BRANDS: readonly DaytimeBrand[] = [
  {
    name: "GREEN HORIZON DELIVERY",
    category: "dispensary",
    texture: "Madison same-day delivery dispensary",
    taglineSeed:
      "From bud to bag in twenty minutes. We're already on your block.",
  },
  {
    name: "CHRONOS ENERGY · SHIFT-LITE",
    category: "energy-drink",
    texture: "caffeine drink, brewed in Sun Prairie",
    taglineSeed:
      "Sixteen ounces of stay-up. Engineered for the eight-hour gig.",
  },
  {
    name: "PUFF PUFF PASTRIES",
    category: "snack",
    texture: "donut chain, glazed/filled",
    taglineSeed: "Open every day until midnight — except one.",
  },
  {
    name: "MENDOTA MUNCHIES",
    category: "snack",
    texture: "gas-station snack chain ringing the lake",
    taglineSeed: "Open 23 hours. You know the night we mean.",
  },
  {
    name: "BUCKY'S BUDS",
    category: "dispensary",
    texture: "UW-Madison-mascot-adjacent dispensary chain",
    taglineSeed: "4:20 every day. Even March 23rd.",
  },
  {
    name: "PACKER PUNCH",
    category: "energy-drink",
    texture: "green-and-gold energy drink, statewide WI brand",
    taglineSeed: "Go-juice for cheeseheads.",
  },
  {
    name: "CURD-CRUSHERS",
    category: "snack",
    texture: "fried cheese-curd chips",
    taglineSeed: "Fried in Eau Claire, eaten everywhere.",
  },
  {
    name: "NORTHWOODS NITRO",
    category: "coffee",
    texture: "cold-brew coffee, Wisconsin-craft",
    taglineSeed: "Blackout strong. Brown County roast.",
  },
  {
    name: "OLD STYLE CALM",
    category: "soft-drink-cbd",
    texture: "CBD seltzer, Old Style beer riff",
    taglineSeed: "The smooth slow you remember.",
  },
  {
    name: "STATE STREET STARCH",
    category: "snack",
    texture: "soft pretzel/cheese-curd snack box, downtown Madison",
    taglineSeed: "Walked from the Capitol. Eaten on the Terrace.",
  },
  {
    name: "YAHARA YIELDS",
    category: "edibles",
    texture: "small-batch edibles co-op, named for the river",
    taglineSeed: "Low and slow. The Wisconsin way.",
  },
  {
    name: "CULBERTSON'S CRUNCH",
    category: "snack",
    texture: "limited-edition crunch-coated frozen custard cup, Culver's-style",
    taglineSeed: "This week's flavor of the week. Just this week.",
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
    return `--- ${b.name} (${b.category}) ---\nTexture: ${b.texture}${seed}`;
  });
  return `=== DAYTIME BRAND LIST (LOCKED) ===\n${sections.join("\n\n")}\n=== END DAYTIME BRAND LIST ===`;
}
