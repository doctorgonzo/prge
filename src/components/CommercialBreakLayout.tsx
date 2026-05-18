"use client";

import {
  HOST_LABEL,
  type PlayerAd,
  type PlayerLine,
} from "./player-types";

interface Props {
  // The interleaved unit currently on screen. Either an ad card or a host
  // bumper line (when the segment has bumpers between ads).
  unit:
    | { kind: "ad"; ad: PlayerAd }
    | { kind: "line"; line: PlayerLine }
    | undefined;
  cycleIndex: number;
}

// Commercial break: cards over lines. Ads are the primary content; the
// optional `lines` array is just short bumpers ("we'll be right back"). The
// parent interleaves the two streams into a single `unit` sequence.
export function CommercialBreakLayout({ unit, cycleIndex }: Props) {
  if (!unit) return null;

  if (unit.kind === "line") {
    const { line } = unit;
    return (
      <div key={cycleIndex} className="prge-line max-w-3xl w-full">
        <div className="text-pink-400 text-xs uppercase tracking-widest mb-3 text-center">
          {HOST_LABEL[line.host] ?? line.host.toUpperCase()}
        </div>
        <div className="text-green-100 text-2xl md:text-3xl leading-snug text-center font-light">
          &ldquo;{line.text}&rdquo;
        </div>
      </div>
    );
  }

  const { ad } = unit;
  return (
    <div
      key={cycleIndex}
      className="prge-line border border-amber-500/50 bg-black/70 max-w-2xl w-full px-8 py-10 text-center"
    >
      <div className="text-amber-400 text-xs uppercase tracking-[0.4em] mb-6">
        &mdash; SPONSOR &mdash;
      </div>
      <div className="text-green-100 text-4xl md:text-5xl font-light tracking-wide mb-4">
        {ad.brand}
      </div>
      <div className="text-pink-300 text-lg md:text-xl italic mb-6">
        {ad.tagline}
      </div>
      {ad.body ? (
        <div className="text-green-300/90 text-sm md:text-base leading-relaxed max-w-xl mx-auto">
          {ad.body}
        </div>
      ) : null}
    </div>
  );
}
