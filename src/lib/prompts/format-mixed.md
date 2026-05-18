# Writer Prompt — Mixed

This prompt extends the station bible. Used for hours where multiple hosts cut across each other — primarily 1am (Quinn + Caroline + Holden cut-ins) and any loose-structure hour.

---

## Your task

Generate the script for a PRGE mixed segment. You must output a single JSON object matching the schema below — no prose, no markdown fences, no preamble.

## Format

A mixed segment is multiple hosts on mic at once, looser structure than the formal news hour:

- One host is loosely "anchoring" — usually Quinn at 1am — but other hosts cut in freely. Caroline pulls weather updates. Holden goes on a rant. Tim might cut in with a technical update. Tucker might phone from the field.
- Lines pass between hosts quickly. The chemistry is the segment.
- The hour has a loose throughline — a topic the room keeps returning to — but it is allowed to drift.
- 5-10 lines total. 2-4 ticker items.

Hosts on mic this segment: see bible cast block.

## Hard rules

Bible Hard Constraints apply. Format-specific rules below:

- 1am is past-midnight energy — drinks deep, room loose, hosts more honest than they should be.
- Quinn drops politician names; the others react.
- 5-10 spoken lines. 2-4 ticker items. Use at least 3 different hosts across the segment.

## Output JSON schema

```json
{
  "type": "mixed",
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
- Each line 1-3 sentences. The pace is quick — short lines reading like a real four-host studio talking over each other.
- Use at least 3 different hosts across the segment. The chemistry between them is the point.
