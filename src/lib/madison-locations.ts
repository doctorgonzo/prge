// src/lib/madison-locations.ts
// Real-coordinate library for every Madison, WI location referenced in PRGE.
// Used by the live crisis map to place pins for caller popups, crisis events,
// and landmarks. Coordinates are real — Capitol at 43.0747, -89.3841.
//
// Three location types:
//   neighborhood  — center-of-mass for a residential area (caller popup pins)
//   landmark      — buildings, parks, lakes, hospitals, venues
//   intersection  — specific street corners / crisis hotspots

// ── Types ──────────────────────────────────────────────────────────────────

export interface MapLocation {
  id: string;
  /** Display name — for neighborhoods, matches the exact `neighborhood` field in caller-popups.ts */
  name: string;
  lat: number;
  lng: number;
  type: "neighborhood" | "landmark" | "intersection";
}

export interface NeighborhoodBounds {
  id: string;
  name: string;
  /** Rough polygon as [lat, lng] pairs — quadrilaterals are fine */
  bounds: [number, number][];
}

// ── Neighborhoods ──────────────────────────────────────────────────────────
// Center points for the residential areas callers reference.
// Names match the exact `neighborhood` string values from caller-popups.ts.

export const NEIGHBORHOODS: readonly MapLocation[] = [
  { id: "atwood",          name: "Atwood",           lat: 43.0880, lng: -89.3520, type: "neighborhood" },
  { id: "tenney-park",     name: "Tenney Park",      lat: 43.0820, lng: -89.3720, type: "neighborhood" },
  { id: "east-wash",       name: "East Wash",        lat: 43.0785, lng: -89.3650, type: "neighborhood" },
  { id: "schenk-atwood",   name: "Schenk-Atwood",    lat: 43.0860, lng: -89.3560, type: "neighborhood" },
  { id: "greenbush",       name: "Greenbush",        lat: 43.0640, lng: -89.3950, type: "neighborhood" },
  { id: "bay-creek",       name: "Bay Creek",        lat: 43.0590, lng: -89.3780, type: "neighborhood" },
  { id: "eastmorland",     name: "Eastmorland",      lat: 43.0900, lng: -89.3330, type: "neighborhood" },
  { id: "dudgeon-monroe",  name: "Dudgeon-Monroe",   lat: 43.0620, lng: -89.4080, type: "neighborhood" },
  { id: "nakoma",          name: "Nakoma",           lat: 43.0480, lng: -89.4180, type: "neighborhood" },
  { id: "marquette",       name: "Marquette",        lat: 43.0800, lng: -89.3620, type: "neighborhood" },
  { id: "monona",          name: "Monona",           lat: 43.0600, lng: -89.3340, type: "neighborhood" },
  { id: "vilas",           name: "Vilas",            lat: 43.0580, lng: -89.4020, type: "neighborhood" },
  { id: "willy-st",        name: "Willy St",         lat: 43.0770, lng: -89.3700, type: "neighborhood" },
  { id: "monroe-st",       name: "Monroe St",        lat: 43.0650, lng: -89.4100, type: "neighborhood" },
  { id: "camp-randall",    name: "Camp Randall",     lat: 43.0700, lng: -89.4120, type: "neighborhood" },
  { id: "middleton",       name: "Middleton",        lat: 43.0970, lng: -89.5040, type: "neighborhood" },
  { id: "brams-addition",  name: "Bram's Addition",  lat: 43.0760, lng: -89.3560, type: "neighborhood" },
  { id: "fitchburg",       name: "Fitchburg",        lat: 43.0130, lng: -89.4210, type: "neighborhood" },
  { id: "shorewood-hills", name: "Shorewood Hills",  lat: 43.0770, lng: -89.4380, type: "neighborhood" },
  { id: "maple-bluff",     name: "Maple Bluff",      lat: 43.0960, lng: -89.3690, type: "neighborhood" },
] as const;

// ── Landmarks ──────────────────────────────────────────────────────────────
// Capitol, lakes, parks, hospitals, venues, key buildings.

export const LANDMARKS: readonly MapLocation[] = [
  // Government / civic
  { id: "capitol",            name: "Capitol Building",        lat: 43.0747, lng: -89.3841, type: "landmark" },
  { id: "capitol-square",     name: "Capitol Square",          lat: 43.0747, lng: -89.3841, type: "landmark" },
  { id: "monona-terrace",     name: "Monona Terrace",          lat: 43.0715, lng: -89.3805, type: "landmark" },

  // University of Wisconsin
  { id: "uw-campus",          name: "UW Campus",               lat: 43.0753, lng: -89.4120, type: "landmark" },
  { id: "camp-randall-stadium", name: "Camp Randall Stadium",  lat: 43.0700, lng: -89.4130, type: "landmark" },
  { id: "picnic-point",       name: "Picnic Point",            lat: 43.0870, lng: -89.4200, type: "landmark" },
  { id: "bascom-hill",        name: "Bascom Hill",             lat: 43.0753, lng: -89.4082, type: "landmark" },

  // Lakes
  { id: "lake-mendota",       name: "Lake Mendota",            lat: 43.0980, lng: -89.4050, type: "landmark" },
  { id: "lake-monona",        name: "Lake Monona",             lat: 43.0630, lng: -89.3600, type: "landmark" },
  { id: "lake-wingra",        name: "Lake Wingra",             lat: 43.0530, lng: -89.4100, type: "landmark" },

  // Parks
  { id: "olbrich-park",       name: "Olbrich Park",            lat: 43.0890, lng: -89.3380, type: "landmark" },
  { id: "vilas-park",         name: "Vilas Park",              lat: 43.0560, lng: -89.4040, type: "landmark" },
  { id: "tenney-park-area",   name: "Tenney Park (park)",      lat: 43.0840, lng: -89.3720, type: "landmark" },
  { id: "james-madison-park", name: "James Madison Park",      lat: 43.0810, lng: -89.3750, type: "landmark" },
  { id: "olin-park",          name: "Olin Park",               lat: 43.0560, lng: -89.3810, type: "landmark" },

  // Medical / triage
  { id: "uw-hospital",        name: "UW Hospital",             lat: 43.0770, lng: -89.4280, type: "landmark" },
  { id: "meriter-hospital",   name: "Meriter Hospital",        lat: 43.0680, lng: -89.3920, type: "landmark" },
  { id: "alliant-energy-center", name: "Alliant Energy Center", lat: 43.0430, lng: -89.3880, type: "landmark" },
  { id: "goodman-community",  name: "Goodman Community Center", lat: 43.0560, lng: -89.3700, type: "landmark" },

  // Infrastructure
  { id: "blount-substation",  name: "Blount Street Substation", lat: 43.0780, lng: -89.3720, type: "landmark" },

  // Shopping / commercial
  { id: "west-towne-mall",    name: "West Towne Mall",          lat: 43.0630, lng: -89.4960, type: "landmark" },
  { id: "east-towne-mall",    name: "East Towne Mall",          lat: 43.0850, lng: -89.3080, type: "landmark" },
  { id: "woodmans",           name: "Woodman's East",           lat: 43.0830, lng: -89.3070, type: "landmark" },

  // The Isthmus as a concept point (center of the neck between the lakes)
  { id: "isthmus",            name: "The Isthmus",              lat: 43.0760, lng: -89.3820, type: "landmark" },
] as const;

// ── Intersections / Street Locations ───────────────────────────────────────
// Specific crisis hotspots referenced in crisis-events.ts and caller text.

export const INTERSECTIONS: readonly MapLocation[] = [
  // State Street corridor
  { id: "state-gorham",       name: "State & Gorham",           lat: 43.0750, lng: -89.3940, type: "intersection" },
  { id: "state-lake",         name: "State & Lake",             lat: 43.0745, lng: -89.3930, type: "intersection" },
  { id: "state-fairchild",    name: "State & Fairchild",        lat: 43.0740, lng: -89.3890, type: "intersection" },
  { id: "state-street",       name: "State Street",             lat: 43.0745, lng: -89.3910, type: "intersection" },

  // East Washington corridor
  { id: "ewash-first",        name: "E. Washington & First St", lat: 43.0785, lng: -89.3720, type: "intersection" },
  { id: "ewash-blair",        name: "E. Washington & Blair",    lat: 43.0780, lng: -89.3770, type: "intersection" },
  { id: "ewash-baldwin",      name: "E. Washington & Baldwin",  lat: 43.0790, lng: -89.3700, type: "intersection" },
  { id: "ewash-paterson",     name: "E. Washington & Paterson", lat: 43.0795, lng: -89.3660, type: "intersection" },
  { id: "ewash-brearly",      name: "E. Washington & Brearly",  lat: 43.0800, lng: -89.3630, type: "intersection" },
  { id: "ewash-900-block",    name: "900 Block E. Washington",  lat: 43.0810, lng: -89.3580, type: "intersection" },

  // Williamson Street corridor
  { id: "willy-baldwin",      name: "Williamson & Baldwin",     lat: 43.0765, lng: -89.3700, type: "intersection" },
  { id: "willy-few",          name: "Williamson & Few",         lat: 43.0775, lng: -89.3650, type: "intersection" },
  { id: "williamson-st",      name: "Williamson St",            lat: 43.0775, lng: -89.3680, type: "intersection" },

  // Atwood / Schenk's Corners corridor
  { id: "schenks-corners",    name: "Schenk's Corners",         lat: 43.0860, lng: -89.3530, type: "intersection" },
  { id: "winnebago-walter",   name: "Winnebago & Walter St",    lat: 43.0870, lng: -89.3490, type: "intersection" },
  { id: "atwood-dunning",     name: "Atwood & Dunning",         lat: 43.0885, lng: -89.3450, type: "intersection" },

  // Monroe Street / south side
  { id: "monroe-commonwealth", name: "Monroe & Commonwealth",   lat: 43.0630, lng: -89.4120, type: "intersection" },
  { id: "monroe-glenway",     name: "Monroe & Glenway",         lat: 43.0600, lng: -89.4150, type: "intersection" },

  // Capitol area streets
  { id: "mifflin-fairchild",  name: "W. Mifflin & Fairchild",   lat: 43.0740, lng: -89.3870, type: "intersection" },
  { id: "west-dayton",        name: "West Dayton St",            lat: 43.0730, lng: -89.3910, type: "intersection" },

  // East side residential streets
  { id: "rutledge-st",        name: "Rutledge St",               lat: 43.0790, lng: -89.3620, type: "intersection" },
  { id: "few-st",             name: "Few Street",                lat: 43.0780, lng: -89.3640, type: "intersection" },
  { id: "beld-st",            name: "Beld Street",               lat: 43.0600, lng: -89.3850, type: "intersection" },
  { id: "milwaukee-st",       name: "Milwaukee St",              lat: 43.0830, lng: -89.3530, type: "intersection" },
  { id: "jenifer-st",         name: "Jenifer St",                lat: 43.0780, lng: -89.3640, type: "intersection" },

  // North side
  { id: "sherman-ave",        name: "Sherman Ave",               lat: 43.0880, lng: -89.3770, type: "intersection" },
  { id: "marston-ave-bridge",  name: "Marston Ave Bridge",       lat: 43.0850, lng: -89.3740, type: "intersection" },
  { id: "johnson-st",         name: "Johnson St",                lat: 43.0770, lng: -89.3860, type: "intersection" },

  // Major roads referenced in crisis events
  { id: "university-ave",     name: "University Ave",            lat: 43.0735, lng: -89.4100, type: "intersection" },
  { id: "university-randall",  name: "University & Randall",     lat: 43.0735, lng: -89.4110, type: "intersection" },
  { id: "park-street",        name: "Park Street",               lat: 43.0660, lng: -89.3970, type: "intersection" },
  { id: "john-nolen-drive",   name: "John Nolen Drive",          lat: 43.0610, lng: -89.3810, type: "intersection" },
  { id: "stoughton-road",     name: "Stoughton Road",            lat: 43.0730, lng: -89.3320, type: "intersection" },
  { id: "mineral-point-rd",   name: "Mineral Point Road",        lat: 43.0620, lng: -89.4450, type: "intersection" },
  { id: "regent-st",          name: "Regent St",                 lat: 43.0680, lng: -89.4050, type: "intersection" },
  { id: "beltline-hwy",       name: "Beltline Highway",          lat: 43.0380, lng: -89.4000, type: "intersection" },
] as const;

// ── Combined Pool ──────────────────────────────────────────────────────────

export const ALL_LOCATIONS: readonly MapLocation[] = [
  ...NEIGHBORHOODS,
  ...LANDMARKS,
  ...INTERSECTIONS,
] as const;

// ── Fuzzy Matching ─────────────────────────────────────────────────────────
// Maps crisis ticker text, caller messages, and neighborhood strings to pins.

/**
 * Alias map — common shorthand, street references, and partial names that
 * should resolve to a specific location ID. Lowercase keys.
 */
const ALIASES: ReadonlyMap<string, string> = new Map([
  // Neighborhood aliases
  ["atwood ave", "atwood"],
  ["atwood avenue", "atwood"],
  ["schenk's corners", "schenks-corners"],
  ["schenks corners", "schenks-corners"],
  ["schenk-atwood", "schenk-atwood"],
  ["east wash", "east-wash"],
  ["east washington", "east-wash"],
  ["e wash", "east-wash"],
  ["e. wash", "east-wash"],
  ["e washington", "east-wash"],
  ["e. washington", "east-wash"],
  ["east washington ave", "east-wash"],
  ["east washington avenue", "east-wash"],
  ["willy st", "willy-st"],
  ["willy street", "willy-st"],
  ["williamson", "williamson-st"],
  ["williamson st", "williamson-st"],
  ["williamson street", "williamson-st"],
  ["monroe st", "monroe-st"],
  ["monroe street", "monroe-st"],
  ["dudgeon monroe", "dudgeon-monroe"],
  ["dudgeon-monroe", "dudgeon-monroe"],
  ["camp randall", "camp-randall"],
  ["bram's addition", "brams-addition"],
  ["brams addition", "brams-addition"],
  ["shorewood hills", "shorewood-hills"],
  ["shorewood", "shorewood-hills"],
  ["maple bluff", "maple-bluff"],
  ["tenney park", "tenney-park"],
  ["tenney", "tenney-park"],
  ["bay creek", "bay-creek"],

  // Landmark aliases
  ["capitol", "capitol"],
  ["the capitol", "capitol"],
  ["capitol building", "capitol"],
  ["capitol square", "capitol-square"],
  ["the square", "capitol-square"],
  ["monona terrace", "monona-terrace"],
  ["uw campus", "uw-campus"],
  ["university of wisconsin", "uw-campus"],
  ["uw", "uw-campus"],
  ["uw hospital", "uw-hospital"],
  ["university hospital", "uw-hospital"],
  ["meriter", "meriter-hospital"],
  ["meriter hospital", "meriter-hospital"],
  ["alliant", "alliant-energy-center"],
  ["alliant energy center", "alliant-energy-center"],
  ["alliant center", "alliant-energy-center"],
  ["goodman", "goodman-community"],
  ["goodman community center", "goodman-community"],
  ["goodman center", "goodman-community"],
  ["lake mendota", "lake-mendota"],
  ["mendota", "lake-mendota"],
  ["lake monona", "lake-monona"],
  ["lake wingra", "lake-wingra"],
  ["wingra", "lake-wingra"],
  ["olbrich", "olbrich-park"],
  ["olbrich park", "olbrich-park"],
  ["vilas park", "vilas-park"],
  ["vilas zoo", "vilas-park"],
  ["henry vilas zoo", "vilas-park"],
  ["the zoo", "vilas-park"],
  ["james madison park", "james-madison-park"],
  ["olin park", "olin-park"],
  ["picnic point", "picnic-point"],
  ["bascom hill", "bascom-hill"],
  ["bascom", "bascom-hill"],
  ["west towne", "west-towne-mall"],
  ["east towne", "east-towne-mall"],
  ["woodmans", "woodmans"],
  ["woodman's", "woodmans"],
  ["the isthmus", "isthmus"],
  ["isthmus", "isthmus"],
  ["blount street substation", "blount-substation"],
  ["blount substation", "blount-substation"],

  // Street / intersection aliases
  ["state street", "state-street"],
  ["state st", "state-street"],
  ["state and gorham", "state-gorham"],
  ["state & gorham", "state-gorham"],
  ["state and lake", "state-lake"],
  ["state & lake", "state-lake"],
  ["university ave", "university-ave"],
  ["university avenue", "university-ave"],
  ["park street", "park-street"],
  ["park st", "park-street"],
  ["john nolen", "john-nolen-drive"],
  ["john nolen drive", "john-nolen-drive"],
  ["stoughton road", "stoughton-road"],
  ["stoughton rd", "stoughton-road"],
  ["sherman ave", "sherman-ave"],
  ["sherman avenue", "sherman-ave"],
  ["milwaukee st", "milwaukee-st"],
  ["milwaukee street", "milwaukee-st"],
  ["beld street", "beld-st"],
  ["beld st", "beld-st"],
  ["few street", "few-st"],
  ["few st", "few-st"],
  ["rutledge", "rutledge-st"],
  ["rutledge st", "rutledge-st"],
  ["rutledge street", "rutledge-st"],
  ["jenifer st", "jenifer-st"],
  ["jenifer street", "jenifer-st"],
  ["johnson st", "johnson-st"],
  ["johnson street", "johnson-st"],
  ["regent st", "regent-st"],
  ["regent street", "regent-st"],
  ["mineral point", "mineral-point-rd"],
  ["mineral point road", "mineral-point-rd"],
  ["mineral point rd", "mineral-point-rd"],
  ["beltline", "beltline-hwy"],
  ["the beltline", "beltline-hwy"],
  ["winnebago", "winnebago-walter"],
  ["winnebago and walter", "winnebago-walter"],
  ["winnebago & walter", "winnebago-walter"],
  ["marston", "marston-ave-bridge"],
  ["marston ave", "marston-ave-bridge"],
  ["mifflin and fairchild", "mifflin-fairchild"],
  ["mifflin & fairchild", "mifflin-fairchild"],
  ["west dayton", "west-dayton"],
  ["e. washington & first", "ewash-first"],
  ["east washington & first", "ewash-first"],
  ["e wash & first", "ewash-first"],
  ["east wash & first", "ewash-first"],
  ["e. washington & blair", "ewash-blair"],
  ["e. washington & baldwin", "ewash-baldwin"],
  ["e. washington & paterson", "ewash-paterson"],
  ["e. washington & brearly", "ewash-brearly"],
  ["paterson and brearly", "ewash-paterson"],
]);

/** Build a lookup from ID to location for fast resolution. */
const LOCATION_BY_ID: ReadonlyMap<string, MapLocation> = new Map(
  ALL_LOCATIONS.map((loc) => [loc.id, loc]),
);

/**
 * Fuzzy-match a neighborhood name, street reference, or general location
 * string to a MapLocation. Used to turn crisis ticker text and caller
 * messages into map pins.
 *
 * Strategy (in priority order):
 *   1. Exact alias lookup (case-insensitive)
 *   2. Exact name match against all locations (case-insensitive)
 *   3. Substring match — if the input text contains a known location name
 *   4. Substring match — if a known alias appears in the input text
 *   5. null — no match found
 */
export function matchLocation(text: string): MapLocation | null {
  const lower = text.toLowerCase().trim();

  // 1. Exact alias lookup
  const aliasId = ALIASES.get(lower);
  if (aliasId) {
    const loc = LOCATION_BY_ID.get(aliasId);
    if (loc) return loc;
  }

  // 2. Exact name match
  for (const loc of ALL_LOCATIONS) {
    if (loc.name.toLowerCase() === lower) return loc;
  }

  // 3. Input text contains a known location name (longest match wins)
  let bestNameMatch: MapLocation | null = null;
  let bestNameLen = 0;
  for (const loc of ALL_LOCATIONS) {
    const nameLower = loc.name.toLowerCase();
    if (lower.includes(nameLower) && nameLower.length > bestNameLen) {
      bestNameMatch = loc;
      bestNameLen = nameLower.length;
    }
  }
  if (bestNameMatch) return bestNameMatch;

  // 4. Input text contains a known alias (longest alias wins)
  let bestAlias: string | null = null;
  let bestAliasLen = 0;
  ALIASES.forEach((id, alias) => {
    if (lower.includes(alias) && alias.length > bestAliasLen) {
      bestAlias = id;
      bestAliasLen = alias.length;
    }
  });
  if (bestAlias) {
    const loc = LOCATION_BY_ID.get(bestAlias);
    if (loc) return loc;
  }

  return null;
}

/**
 * Resolve a location by its exact ID. Useful when you already know the
 * location key and just need coordinates.
 */
export function getLocationById(id: string): MapLocation | null {
  return LOCATION_BY_ID.get(id) ?? null;
}

// ── Neighborhood Bounds ────────────────────────────────────────────────────
// Rough polygons (quadrilaterals or pentagons) for major neighborhoods.
// Used for the darkening overlay effect — zones go dark as crises hit.
// Not cartographically precise. Just enough for a visual effect.

export function getNeighborhoodBounds(): NeighborhoodBounds[] {
  return [
    {
      id: "atwood",
      name: "Atwood",
      bounds: [
        [43.0920, -89.3600],
        [43.0920, -89.3400],
        [43.0840, -89.3400],
        [43.0840, -89.3600],
      ],
    },
    {
      id: "tenney-park",
      name: "Tenney Park",
      bounds: [
        [43.0860, -89.3780],
        [43.0860, -89.3670],
        [43.0790, -89.3670],
        [43.0790, -89.3780],
      ],
    },
    {
      id: "east-wash",
      name: "East Wash",
      bounds: [
        [43.0830, -89.3750],
        [43.0830, -89.3550],
        [43.0750, -89.3550],
        [43.0750, -89.3750],
      ],
    },
    {
      id: "schenk-atwood",
      name: "Schenk-Atwood",
      bounds: [
        [43.0900, -89.3600],
        [43.0900, -89.3480],
        [43.0820, -89.3480],
        [43.0820, -89.3600],
      ],
    },
    {
      id: "greenbush",
      name: "Greenbush",
      bounds: [
        [43.0680, -89.4020],
        [43.0680, -89.3880],
        [43.0590, -89.3880],
        [43.0590, -89.4020],
      ],
    },
    {
      id: "bay-creek",
      name: "Bay Creek",
      bounds: [
        [43.0640, -89.3860],
        [43.0640, -89.3700],
        [43.0540, -89.3700],
        [43.0540, -89.3860],
      ],
    },
    {
      id: "eastmorland",
      name: "Eastmorland",
      bounds: [
        [43.0950, -89.3420],
        [43.0950, -89.3240],
        [43.0850, -89.3240],
        [43.0850, -89.3420],
      ],
    },
    {
      id: "dudgeon-monroe",
      name: "Dudgeon-Monroe",
      bounds: [
        [43.0680, -89.4200],
        [43.0680, -89.4000],
        [43.0560, -89.4000],
        [43.0560, -89.4200],
      ],
    },
    {
      id: "nakoma",
      name: "Nakoma",
      bounds: [
        [43.0560, -89.4280],
        [43.0560, -89.4080],
        [43.0400, -89.4080],
        [43.0400, -89.4280],
      ],
    },
    {
      id: "marquette",
      name: "Marquette",
      bounds: [
        [43.0840, -89.3700],
        [43.0840, -89.3560],
        [43.0760, -89.3560],
        [43.0760, -89.3700],
      ],
    },
    {
      id: "vilas",
      name: "Vilas",
      bounds: [
        [43.0640, -89.4100],
        [43.0640, -89.3950],
        [43.0520, -89.3950],
        [43.0520, -89.4100],
      ],
    },
    {
      id: "willy-st",
      name: "Willy St",
      bounds: [
        [43.0800, -89.3780],
        [43.0800, -89.3620],
        [43.0740, -89.3620],
        [43.0740, -89.3780],
      ],
    },
    {
      id: "monroe-st",
      name: "Monroe St",
      bounds: [
        [43.0700, -89.4200],
        [43.0700, -89.4020],
        [43.0600, -89.4020],
        [43.0600, -89.4200],
      ],
    },
    {
      id: "camp-randall",
      name: "Camp Randall",
      bounds: [
        [43.0740, -89.4200],
        [43.0740, -89.4050],
        [43.0660, -89.4050],
        [43.0660, -89.4200],
      ],
    },
    {
      id: "brams-addition",
      name: "Bram's Addition",
      bounds: [
        [43.0800, -89.3620],
        [43.0800, -89.3500],
        [43.0720, -89.3500],
        [43.0720, -89.3620],
      ],
    },
    {
      id: "shorewood-hills",
      name: "Shorewood Hills",
      bounds: [
        [43.0830, -89.4480],
        [43.0830, -89.4280],
        [43.0720, -89.4280],
        [43.0720, -89.4480],
      ],
    },
    {
      id: "maple-bluff",
      name: "Maple Bluff",
      bounds: [
        [43.1020, -89.3770],
        [43.1020, -89.3610],
        [43.0910, -89.3610],
        [43.0910, -89.3770],
      ],
    },
    {
      id: "monona",
      name: "Monona",
      bounds: [
        [43.0660, -89.3440],
        [43.0660, -89.3200],
        [43.0520, -89.3200],
        [43.0520, -89.3440],
      ],
    },
    {
      id: "middleton",
      name: "Middleton",
      bounds: [
        [43.1060, -89.5200],
        [43.1060, -89.4900],
        [43.0880, -89.4900],
        [43.0880, -89.5200],
      ],
    },
    {
      id: "fitchburg",
      name: "Fitchburg",
      bounds: [
        [43.0260, -89.4400],
        [43.0260, -89.4000],
        [43.0000, -89.4000],
        [43.0000, -89.4400],
      ],
    },
  ];
}
