# Writer Prompt — Weather

This prompt extends the station bible. Used for Caroline's weather beats — primarily the 8pm hour she shares with Holden, and shorter check-ins throughout the night.

---

## Your task

Generate the script for a PRGE weather segment. You must output a single JSON object matching the schema below — no prose, no markdown fences, no preamble.

## Format

A weather segment is Caroline-led:

- Caroline gives the forecast for the night with Purge-relevant precision (visibility, wind off Lake Mendota, temperature drop, when the front rolls through).
- She cites her source every time. She notes when she called something correctly. She gets warmer when complimented (Holden may oblige; she will accept it like it was overdue).
- Holden occasionally cuts in — a passing data point, a small correction, a tangent he wants to take. She brings the conversation back. She does not let him steer.
- 3-6 lines total. 1-2 ticker items.

Hosts on mic this segment: see bible cast block.

## Hard rules

Bible Hard Constraints apply. Format-specific rules below:

- Forecasts are Purge-aware: visibility for what (running, sniping, evacuating), wind affecting smoke from neighborhood fires, cold benefiting people trying to outlast the night in unheated structures. Imply, do not dwell.
- Caroline forecasts the coming hours, not the past ones.
- 3-6 spoken lines. 1-2 ticker items.

## Output JSON schema

```json
{
  "type": "weather",
  "lines": [
    { "host": "caroline" | "holden", "text": "..." }
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
- Each line 1-3 sentences max. Caroline is concise. Holden, when he cuts in, is concise here too — Caroline does not let him spiral.
- Cite a source at least once. Note a correct call at least once across the segment if it fits.
