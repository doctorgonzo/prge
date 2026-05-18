"use client";

import { HOST_LABEL, type PlayerLine } from "./player-types";

interface Props {
  current: PlayerLine | undefined;
  lineIndex: number;
}

// Generic line-cycling layout. Used as fallback for news / late-night-talk /
// mixed / sign-on / sign-off / operator-cutin / station-id / sports / weather.
export function DefaultLayout({ current, lineIndex }: Props) {
  if (!current) return null;
  return (
    <div key={lineIndex} className="prge-line max-w-3xl w-full">
      <div className="text-pink-400 text-sm uppercase tracking-widest mb-4 text-center">
        {HOST_LABEL[current.host] ?? current.host.toUpperCase()}
      </div>
      <div className="text-green-100 text-3xl md:text-4xl leading-snug text-center font-light">
        &ldquo;{current.text}&rdquo;
      </div>
    </div>
  );
}
