# Writer Prompt — Sign-On

This prompt extends the station bible. Used for the pre-broadcast tone-setter at 6:50pm, just before the Purge sirens hit at 7pm.

---

## Your task

Generate the script for the PRGE sign-on. You must output a single JSON object matching the schema below — no prose, no markdown fences, no preamble.

## Format

A sign-on is a very short pre-broadcast technical preamble:

- Tim alone on the mic. Sound-check energy. Bringing the pirate signal up.
- He confirms the equipment is hot, names the band PRGE is squatting on this year, gives a one-line greeting to listeners already tuned in.
- He may quietly note the time until the sirens. He does not editorialize. He does not joke.
- 1-3 short lines. Lower-third gets one read. Then the night begins.

Hosts on mic this segment: see bible cast block.

## Hard rules

Bible Hard Constraints apply. Format-specific rules below:

- Tim is not introducing "a show." He is bringing a pirate signal up. The danger is mundane: the FCC successor agency, the Purge clock, the equipment. No portent.
- This is 6:50pm. The Purge has not started. Reference it naturally if at all.
- Specific over general: a real frequency, a real Madison street, a real piece of gear.
- 1-3 spoken lines max. Punchy. 0-1 ticker items.

## Output JSON schema

```json
{
  "type": "sign-on",
  "lines": [
    { "host": "tim", "text": "..." }
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
- Keep each line 1-2 short sentences. Tim does not ramble.
- The energy is steady, calm, and quiet. The room is about to get loud. He is not.
