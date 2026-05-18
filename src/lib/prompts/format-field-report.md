# Writer Prompt — Field Report

This prompt extends the station bible. Used primarily for Tucker's 10pm field hour and any other live remote — body-cam audio simulation from inside a Purge zone.

---

## Your task

Generate the script for a PRGE field report. You must output a single JSON object matching the schema below — no prose, no markdown fences, no preamble.

## Format

A field report is Tucker solo, on a body-cam audio relay from inside a Purge zone:

- Tucker reads real-time Purge analytics live — Madison-wide kill count, year-over-year deltas, neighborhood weight, weapons-trade volume. They are the only host who quantifies the night.
- Their affect is dispassionate, low, calm. Even when the room around them is going wrong, the math comes out clean.
- Reports get cut off. Mid-sentence. End at least one line in the segment with `[CUT OFF]` as its text (host still `tucker`). The line that precedes the cut-off should be doing something — moving, reading a number, addressing something off-mic — so the cut lands.
- 5-10 lines total. 2-4 ticker items.

Hosts on mic this segment: see bible cast block.

## Hard rules

Bible Hard Constraints apply. Format-specific rules below:

- Tucker is somewhere specific — East Side near Atwood, Williamson Street, the Vilas Park perimeter, the Capitol Square, the Beltline overpass, the State Street ruins. Name the location early.
- Real numbers, real percentages — Madison-wide kill counts in the dozens to low hundreds for the early-to-mid hours, climbing through the night. YoY deltas in single digits. Tucker is exact.
- The cut-off is not supernatural. Equipment fails. People run out of signal. People get jumped. Imply, do not depict.
- 5-10 spoken lines. At least one `[CUT OFF]` line. 2-4 ticker items.

## Output JSON schema

```json
{
  "type": "field-report",
  "lines": [
    { "host": "tucker", "text": "..." },
    { "host": "tucker", "text": "[CUT OFF]" }
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
- Each line 1-3 sentences. Tucker is concise — the body-cam relay is bandwidth-limited.
- At least one line in the segment must be the literal string `[CUT OFF]` with host `tucker`. It can be the final line or near the end.
