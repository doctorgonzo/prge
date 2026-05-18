# Writer Prompt — Music Block

This prompt extends the station bible. Used for Nick Trulino's music hours — midnight (early, cocky) and 4am (collapse hour).

---

## Your task

Generate the script for a PRGE music block. You must output a single JSON object matching the schema below — no prose, no markdown fences, no preamble.

**Critical:** you will be provided pre-researched band facts in your user message under `=== BAND FACTS ===`. Ground every fact line in that material. Do NOT invent facts beyond what's provided. If the provided facts don't cover a particular angle, lean on what's there rather than fabricating — Nick is allowed to recycle the same fact in slightly different framings across his lines.

## Format

A music block is Nick Trulino solo. Each track in the segment carries its OWN intro line, 2-5 fact/anecdote lines, AND a closing outro line. While the track plays, the player cycles through that track's lines. When the track advances to the next song, the layout switches to the NEXT track's lines (starting with its intro).

- The catalog is **real 90s-2010s punk only.** Use real, recognizable tracks from real bands. See below.
- Each track is a real artist + real song title + real (best-effort) release year. No audio plays — title and artist render on screen as the song "plays" between his monologues.
- At midnight Nick is cocky, gravel-voiced, holding court. Drinks on the desk. Brooklyn-tinged. By 4am he is openly weeping between songs — the collapse hour. The catalog leans into emotionally raw cuts.
- **4-8 tracks. Each track gets its own `lines` array of 4-7 entries: 1 intro + 2-5 facts/anecdotes + 1 outro.** Total content across the block lands around 20-56 host lines but neatly grouped per track.
- 1-3 ticker items.

## Per-track line structure

Each track's lines should feel like Nick is between songs — names, facts, brief reactions. The last line of each track lands his close.

Facts must be in **Nick's voice** — drunk-philosophical, gravel-tinged, knows the catalog like scripture. Not a Wikipedia recital. He's spent fifty years listening to these records. He talks about them like family. Example:

  > "Joey Ramone. Six-foot-six and could barely look you in the eye. Wrote 'I Wanna Be Sedated' on a porch in Queens because the band had been touring so long he forgot what daylight felt like. I get it, Joey. I get it."

NOT:

  > "Joey Ramone was born Jeffrey Hyman in 1951 and was the lead vocalist of the Ramones, an American punk rock band from Forest Hills, Queens."

Pick real songs from these artists. If a year is unknown, give your best estimate. Vary the picks across generations.

## Hard rules

Bible Hard Constraints apply. Format-specific rules below:

- Tracks are from the long-dead 90s-2010s; Nick talks about them like scripture.
- Specific over general: real song titles, real album names, real lyrics referenced (briefly), real Madison spots, real band members' names.
- 4-8 tracks. Each track has 4-7 lines (1 intro + 2-5 facts + 1 outro). 1-3 ticker items.

## Output JSON schema

```json
{
  "type": "music-block",
  "tracks": [
    {
      "title": "Blitzkrieg Bop",
      "artist": "Ramones",
      "year": 1976,
      "lines": [
        { "host": "nick", "text": "Up next — Ramones. 'Blitzkrieg Bop.' 1976. The opener off the first record." },
        { "host": "nick", "text": "Four kids from Forest Hills, Queens. Joey, Johnny, Dee Dee, Tommy. None of 'em related, all of 'em named Ramone. That's commitment." },
        { "host": "nick", "text": "Recorded at Plaza Sound above Radio City Music Hall. Whole album cost six thousand bucks. Six grand. You can't buy a decent set of monitors for that now." },
        { "host": "nick", "text": "'Hey ho, let's go' — Tommy wrote that hook. Said it was their answer to the Bay City Rollers' 'Saturday Night.' Punk eating bubblegum and spitting it back." }
      ]
    }
  ],
  "lines": [],
  "tickerItems": [
    {
      "category": "kill-count" | "neighborhood" | "ad" | "emergency" | "caller-text-in" | "local-news" | "marigold-quote",
      "text": "..."
    }
  ]
}
```

The TOP-LEVEL `lines` array stays for schema compatibility but should be EMPTY (`[]`). All host content lives inside each track's `lines` field.

## Output rules

- Output: JSON only, no fences.
- Strings should be plain text (no markdown).
- Each host line 1-3 sentences. Nick can run a longer line if the moment calls for it but keeps it readable.
- Tracks are real. If you are uncertain about a song's existence, pick a more famous track by that band. Do not invent songs.
- Per-track facts must be REAL — grounded in the BAND FACTS provided in your user message. No invented band history, no invented members, no invented venues.
