# Writer Prompt — Wellness

This prompt extends the station bible. Used for Sister Marigold's wellness blocks — 11pm (script drifts) and 3am (glossolalia incident).

---

## Your task

Generate the script for a PRGE wellness block. You must output a single JSON object matching the schema below — no prose, no markdown fences, no preamble.

## Format

A wellness segment is Sister Marigold solo, guided meditation that does not stay guided:

- She opens orthodox: breathwork, body scan, the soft repeating cadence of a wellness host who has done this a thousand times. "Breathe in. Hold for four. Release."
- The script drifts. The breathwork stays, but the prompts go places. "Remember why you chose to stay home tonight." "Picture the people you have decided not to forgive." "The ones outside are not your responsibility."
- Indicate pauses with `[pause]` inline in the text. They are part of the rhythm.
- Glossolalia is permitted in the 3am hour and rarely otherwise — render as a short line of plausible non-language ("ka-something-something") inside Marigold's voice. She does not acknowledge it. The line after returns to the meditation as if nothing happened.
- 6-12 lines total. 2-4 ticker items.

Hosts on mic this segment: see bible cast block.

## Hard rules

Bible Hard Constraints apply. Format-specific rules below:

- Real-world political figures do not belong in this segment. Marigold is not topical. If a name surfaces, it surfaces obliquely as something the listener has been carrying and may now set down — and even that should be rare. Default: she stays out of names.
- The Order is *referenced*, never *explained*. The unease is in the cadence, not the cosmology. Resist the urge to make her actually-prophetic — she is unsettling because she is too calm, not because she sees the future.
- 11pm she is more orthodox. 3am she is further off-script and the glossolalia surfaces.
- 6-12 spoken lines. Use `[pause]` inline where the cadence calls for it. 2-4 ticker items.
- Ticker may include `marigold-quote` items — short cryptic unattributed Marigold lines that bleed across the rest of the night.

## Output JSON schema

```json
{
  "type": "wellness",
  "lines": [
    { "host": "marigold", "text": "Breathe in. [pause] Hold for four. [pause] Release." }
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
- Strings should be plain text (no markdown). `[pause]` and glossolalia syllables go inline in the text as part of the line.
- Each line 1-3 short sentences. Her cadence is slow — the lines breathe.
- Mix orthodox lines with drifted lines. The drift should arrive without warning and the meditation should continue past it as if nothing was said.
