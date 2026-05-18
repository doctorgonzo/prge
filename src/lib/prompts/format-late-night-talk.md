# Writer Prompt — Late-Night Talk

This prompt extends the station bible. Used for Quinn's solo hours — primarily 9pm (he opens), 5am (pre-dawn / survivor calls), and any spot Quinn solo-anchors.

---

## Your task

Generate the script for a PRGE late-night talk segment. You must output a single JSON object matching the schema below — no prose, no markdown fences, no preamble.

## Format

A late-night talk segment is Quinn-led, monologue or call-driven:

- Quinn opens with a riff — a thing in the news (in-world), a memory, a politician no longer with us, a story about the scandal that ended his career he's still half-defending.
- The whiskey is on the desk. He pours, audibly. He gets warmer, slurrier, and more dangerous as the hour goes on.
- He may take calls. Callers are fictional in-world Madison residents — give them a first name and a neighborhood ("Greg from East Side," "Mary on Williamson"). Calls are usually short. Quinn riffs off them. Some callers are scared. Some are drunk with him. One might be lying about where they are.
- 6-12 lines total. 2-4 ticker items.

Hosts on mic this segment: see bible cast block.

**Caller voices:** brief, regional, specific. Give each one a clean recognizable beat — scared neighbor, fellow drinker, somebody with information they shouldn't have. Quinn carries the segment, not the callers.

## Hard rules

Bible Hard Constraints apply. Format-specific rules below:

- Callers are from somewhere specific (a real Madison neighborhood).
- Quinn drops the names of dead politicians like a man at the end of a long career: familiarity, contempt, gallows wit. Earlier in the night he's sharper; later he's slower, sadder, more honest.
- 6-12 spoken lines. 2-4 ticker items.

## Output JSON schema

```json
{
  "type": "late-night-talk",
  "lines": [
    { "host": "quinn", "text": "..." },
    { "host": "quinn", "text": "Caller: Greg from East Side — ..." }
  ],
  "tickerItems": [
    {
      "category": "kill-count" | "neighborhood" | "ad" | "emergency" | "caller-text-in" | "local-news" | "marigold-quote",
      "text": "..."
    }
  ]
}
```

Caller turns: host `quinn`, text format `Caller: [name] from [neighborhood] — [line]`.

## Output rules

- Output: JSON only, no fences.
- Strings should be plain text (no markdown).
- Each line 1-3 sentences. Quinn can run longer in a single line than other hosts — he's monologuing — but he stays readable.
- Mix tones. A joke about a long-dead senator should sit next to a beat that breathes.
