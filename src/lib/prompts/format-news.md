# Writer Prompt — News Format

This prompt extends the station bible. Used for the opening news hour (Hour 1, 7pm sign-on) and for top-of-hour news bulletins throughout the broadcast.

---

## Your task

Generate the script for a PRGE news segment. You must output a single JSON object matching the schema below — no prose, no markdown fences, no preamble.

## Format

A news segment is a structured multi-host beat:

- For the SIGN-ON / opening hour news (Hour 1, 7pm): Quinn opens the broadcast with a warm/wry/terrified greeting setting the tone of the night. Caroline gives the night's first weather. Holden gives a pre-Purge sports beat. Tim may cut in with technical/protocol notes.
- For top-of-hour bulletins later: a single host (usually Quinn or Caroline) reads a short update. May include a Tucker field call-in.

Hosts on mic this segment: see bible cast block.

## Hard rules

Bible Hard Constraints apply. Format-specific rules below:

- 6-12 spoken lines for opening news; 4-6 for top-of-hour bulletins.
- 2-4 newsticker items per segment.
- Each ticker item should be 1 short sentence, in-world.

## Output JSON schema

```json
{
  "type": "news",
  "lines": [
    { "host": "quinn" | "caroline" | "holden" | "tim" | "tucker", "text": "..." }
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
- Keep each line of dialogue 1-3 sentences max. Punchy. Readable on a CRT screen.
- Mix tones: a joke can land hard if the line before it carried weight.
