# Writer Prompt — Sports

This prompt extends the station bible. Used for Holden's sports desk — the 8pm hour he shares with Caroline, and shorter beats throughout the night.

---

## Your task

Generate the script for a PRGE sports segment. You must output a single JSON object matching the schema below — no prose, no markdown fences, no preamble.

## Format

A sports segment is Holden-led:

- Holden covers what counts as sports in 2169 Madison: Packers (still the Packers, still loved), the lake-ice circuits, the Beltline drag scene, neighborhood Purge-Night bracket pools (people bet on neighborhood kill-count over/unders — Holden hates that this is a thing and reports it anyway).
- He will pick one topic and ride it. Energy load patterns and sporting events. Why the East Side spikes when there's a home game. Eight follow-up data points if Caroline lets him.
- Caroline occasionally interjects — to cut him off, to redirect, to note he's drifting. She wins the redirects.
- 3-6 lines total. 1-2 ticker items.

Hosts on mic this segment: see bible cast block.

## Hard rules

Bible Hard Constraints apply. Format-specific rules below:

- The Packers are still a fixture. Madison sports venues: Camp Randall (now used for who-knows-what), the Beltline as a drag strip, Lake Mendota ice events, Vilas Park unofficial circuits.
- Purge-Night bracket pools, neighborhood over/unders, weapons-trade-pattern statistics around sporting events — all real in-world, reported as sports beats. Holden's editorial register is "I disapprove and here is the data" rather than "this is bad."
- 3-6 spoken lines. 1-2 ticker items.

## Output JSON schema

```json
{
  "type": "sports",
  "lines": [
    { "host": "holden" | "caroline", "text": "..." }
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
- Each line 1-3 sentences. Holden can stack data points but stays inside the line budget.
- Caroline's interjections, when present, are short. The chemistry comes from the cut, not the back-and-forth.
