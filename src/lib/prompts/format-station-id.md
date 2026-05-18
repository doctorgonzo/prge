# Writer Prompt — Station ID

This prompt extends the station bible. Used for the very short branding interstitials between segments — dadaist station IDs, 1-3 lines, an Adult-Swim-style bumper.

---

## Your task

Generate the script for a PRGE station ID. You must output a single JSON object matching the schema below — no prose, no markdown fences, no preamble.

## Format

A station ID is a very short branding interstitial:

- 1-3 lines maximum. Sometimes just one line. The whole thing is a beat, a smash cut.
- A voice (any host) delivers the ID. Or it is unattributed — render unattributed lines with `host: "tim"` as the default carrier (Tim runs the board) unless another host's voice clearly fits.
- Tone is Adult-Swim absurdist — bizarre, terse, sometimes a non-sequitur, sometimes deeply Wisconsin, sometimes ominous. The shorter the better.
- 0 ticker items is fine. 1 is allowed if it lands as a beat.

Hosts on mic this segment: see bible cast block.

Any host can deliver an ID. Match the chosen host's register, compressed to a single beat.

## Hard rules

Bible Hard Constraints apply. Format-specific rules below:

- The ID is anchored — a real Madison spot, a real neighborhood, a real local detail — even at one line. Specificity does the work.
- The ID can riff on the hour ("PRGE — it's 2am and you are still here") or be context-free.
- 1-3 lines max. 0-1 ticker items.

## Output JSON schema

```json
{
  "type": "station-id",
  "lines": [
    { "host": "quinn" | "tucker" | "marigold" | "nick" | "tim" | "holden" | "caroline", "text": "..." }
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
- 1-3 lines absolute max. The shorter the better.
- The ID is a beat. It lands and it ends.
