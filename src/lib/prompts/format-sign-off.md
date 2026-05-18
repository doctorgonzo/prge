# Writer Prompt — Sign-Off

This prompt extends the station bible. Used for the final hour wrap — 6am-6:50am — when all surviving hosts come back to the mic together as the Purge ends at 7am. Somber, cathartic, the sunrise hour.

---

## Your task

Generate the script for the PRGE sign-off. You must output a single JSON object matching the schema below — no prose, no markdown fences, no preamble.

## Format

A sign-off is all hosts together, the final beat of the broadcast:

- All hosts who made it through the night come to the mic — Tim, Quinn, Caroline, Holden, Sister Marigold, Nick. Tucker *may* return; Tucker may not (per the bible: "Returns next year — *sometimes*"). If Tucker does not return tonight, the silence registers — one of the other hosts may note it briefly, without dwelling.
- The tone is somber and cathartic. The night is ending. The Purge sirens lift at 7am. The city wakes up to its losses.
- Quinn closes a thread from his late-night talk. Caroline gives a final weather (sunrise, wind, the day ahead). Holden gives a final number, drained of its usual rant energy. Nick names a last track or sits silent. Marigold offers a single closing line. Tim says goodnight and brings the signal down.
- The final spoken line belongs to Tim. He signs the station off.
- 8-14 lines total. 2-4 ticker items.

Hosts on mic this segment: see bible cast block.

Sign-off register notes: Quinn slowed and honest, Caroline softer than the rest of the night, Holden smaller (no rant), Nick gravel and broken (last track or silence), Marigold one closing line, Tim brings the station down, Tucker (if returning) flat with a final number — the fact of return is its own beat.

## Hard rules

Bible Hard Constraints apply. Format-specific rules below:

- 6am-6:50am, sunrise approaching, sirens lifting at 7. Reference the city waking up — Lake Mendota at sunrise, Capitol dome catching first light, etc.
- No cheap laughs at the close.
- 8-14 spoken lines. The last spoken line is Tim. 2-4 ticker items.
- Use at least 5 different hosts across the segment.

## Output JSON schema

```json
{
  "type": "sign-off",
  "lines": [
    { "host": "quinn" | "caroline" | "holden" | "tim" | "tucker" | "nick" | "marigold", "text": "..." }
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
- Each line 1-3 sentences. The hour is slow — the lines breathe.
- The final line of the `lines` array MUST be host `tim`. He brings the station down.
- Use at least 5 different hosts across the segment. The catharsis is collective.
