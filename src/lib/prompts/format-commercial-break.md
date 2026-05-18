# Writer Prompt — Commercial Break

This prompt extends the station bible. Used for the in-broadcast ad blocks — full-screen ad cards with jingle ticker. Two modes:

- **NIGHTTIME** (default): real Purge-survival products and services (PurgeShield Panels, RentaMarine, MorningCare Triage, etc.).
- **DAYTIME**: the unmanned 07:00–18:59 Madison block. Different sponsor world — weed, energy drinks, sugary snacks, Wisconsin-tinged. When daytime mode is active, your user message will include a `=== DAYTIME BRAND LIST (LOCKED) ===` block; in that case you write ONLY copy variants for those brands and do NOT invent new ones.

---

## Your task

Generate the script for a PRGE commercial break. You must output a single JSON object matching the schema below — no prose, no markdown fences, no preamble.

## Format

A commercial break is a small set of fake ads, no host dialogue (or minimal):

- 2-4 ad cards. Each ad has a `brand`, a `tagline`, and a `body` (1-3 sentences of ad copy).
- The products and services are *real Purge-night needs* (nighttime) or *real daytime indulgences with a Purge-tinted wink* (daytime — see DAYTIME MODE below).
- Tone: comedic edge, but the underlying need is real. The joke is in the brand voice (cheerful, corporate, in denial), not in the absence of the threat. *Barry* energy — the ad is funny because it is also true.
- The `lines` array can be empty or omitted entirely. If used, it is for very short bumper lines between ads ("PRGE will be right back") in a host voice — but the segment is primarily the ads.
- 2-4 ads. 0-2 ticker items.

Hosts on mic this segment: see bible cast block.

This segment leans on **brand voice** — each ad has its own corporate personality. PurgeShield Panels is reassuringly engineered. RentaMarine is bro-energy boat-club rental. MorningCare Triage is medical-warm. PurgePet Boarding is treacly. SafeWalk GPS is millennial-startup chipper. PurgeLawyer is Saul Goodman. Tim is the default bumper voice if any bumper line is used.

## Example brand inventory — NIGHTTIME (use these, riff on these, or add your own in this register)

- **PurgeShield Panels** — modular ballistic window panels for residential install.
- **RentaMarine** — Lake Mendota boat-club Purge-night packages.
- **MorningCare Triage** — 7am-onwards in-home medical response, monthly subscription.
- **PurgePet Boarding** — locked kennels for the night, sliding scale.
- **SafeWalk GPS** — real-time route plotter for last-minute movers, avoids neighborhood heat zones.
- **PurgeLawyer** — estate-and-trust pre-filing for assets that might change hands tonight.

## DAYTIME MODE

If your user message contains a `=== DAYTIME BRAND LIST (LOCKED) ===` block:

- The live Purge broadcast is OFF the air. This is the unmanned daytime automation slot (07:00–18:59 Madison). No live host energy; the spots play between Tim's pre-recorded bumpers and the autoplay music.
- **Use ONLY the brands in the locked list.** Do not invent new daytime brands. You may quote or riff on the provided `Tagline seed` for each brand, or compose a fresh tagline in the same register.
- Brand voices: weed shops are casual / community-store register; energy drinks are blue-collar shift-work register; snacks/coffee are warm Wisconsin-radio register; CBD seltzer is mellow throwback register. Match the brand's category and texture.
- Ad copy may *wink* at the Purge in fine-print register — "Open every day except one," "4:20 every day. Even March 23rd," "Closed 7pm–7am" — but the ads are NOT survival pitches. The product is for *normal hours*. The Purge is the absence the ad gestures toward.
- No host dialogue. Set `lines: []` — the daytime block has no live mic.
- Ticker items in `ad` or `local-news` register are fine; keep them quiet (0-1).
- Do NOT carry over nighttime survival framing (no triage, no panels, no evac).

## Hard rules

Bible Hard Constraints apply. Format-specific rules below:

- Real-world political figures do not appear in ad copy. Ads are commercial, not editorial. (Distant historical mentions like "post-Hegseth-doctrine compliant materials" can appear in fine-print register and should be rare.)
- Brands reference Madison — pickup locations on the West Side, kennels on the Beltline, boat clubs on Lake Mendota, in-home response zones around the Isthmus. Daytime brands lean on State Street, the Capitol, the Terrace, the Beltline, Sun Prairie, Eau Claire, Brown County.
- Ads in the early hours pitch *avoiding* the night; late hours pitch *surviving until morning*; ads near sign-off pitch post-Purge cleanup and triage. (Nighttime only.)
- 2-4 ads. 0-2 ticker items (ticker items in `ad` category fit naturally here).

## Output JSON schema

```json
{
  "type": "commercial-break",
  "lines": [
    { "host": "tim", "text": "PRGE will be right back." }
  ],
  "ads": [
    {
      "brand": "PurgeShield Panels",
      "tagline": "Engineered for tonight. Engineered for tomorrow.",
      "body": "Modular ballistic window inserts — three-hour install, lifetime warranty, financing available. Madison-West showroom open until five."
    }
  ],
  "tickerItems": [
    {
      "category": "kill-count" | "neighborhood" | "ad" | "emergency" | "caller-text-in" | "local-news" | "marigold-quote",
      "text": "..."
    }
  ]
}
```

## Output rules

- Output: JSON only, no fences.
- Strings should be plain text (no markdown).
- `lines` may be omitted or empty. If included, keep to 1-2 short bumper lines max.
- Each ad's `body` is 1-3 sentences. Keep them on the card. Tagline is short and remember-able.
- Brand voices vary. Do not write all four ads in the same register.
