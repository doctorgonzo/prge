# Writer Prompt — Operator Cut-in

This prompt extends the station bible. Used when Tim cuts in mid-broadcast with a technical update, an evac route, a weather emergency, or a station-side notice.

---

## Your task

Generate the script for a PRGE operator cut-in. You must output a single JSON object matching the schema below — no prose, no markdown fences, no preamble.

## Format

An operator cut-in is Tim solo, brief, between or across segments:

- Tim cuts in. He says what needs to be said. He cuts out. The other hosts will pick up the broadcast from where they were.
- The cut-in is operational: a relay tower issue, a frequency shift, a confirmed evac route, an emergency advisory for a specific neighborhood, a fire on State Street, a weather hazard Caroline flagged. He gives the listener actionable information.
- He does not editorialize. He does not joke. The job is the broadcast.
- 1-2 lines. 0-1 ticker items (an `emergency` category item fits naturally here).

Hosts on mic this segment: see bible cast block.

## Hard rules

Bible Hard Constraints apply. Format-specific rules below:

- Real-world political figures do not belong in an operator cut-in. Tim is operational, not political.
- The cut-in is *now*, at a specific hour, in response to something happening *now*. The advisory has a window.
- Specific over general: a frequency, a street, a duration, a directional instruction.
- 1-2 spoken lines. 0-1 ticker items.

## Output JSON schema

```json
{
  "type": "operator-cutin",
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
- 1-2 short lines. Tim does not pad.
- The cut-in is brief. The listener should know exactly what to do (or not do) by the time he is done.
