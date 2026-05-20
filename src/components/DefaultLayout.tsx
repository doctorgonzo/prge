"use client";

import { HOST_LABEL, type PlayerLine } from "./player-types";
import { usePhosphorGhost } from "./usePhosphorGhost";

interface Props {
  current: PlayerLine | undefined;
  lineIndex: number;
}

// Generic line-cycling layout. Used as fallback for news / late-night-talk /
// mixed / sign-on / sign-off / operator-cutin / station-id / sports / weather.
export function DefaultLayout({ current, lineIndex }: Props) {
  const ghost = usePhosphorGhost(current?.text, lineIndex);

  if (!current) return null;
  return (
    <div className="relative max-w-3xl w-full">
      {/* Phosphor ghost — previous line fading out behind the current one */}
      {ghost && (
        <div key={`ghost-${ghost.key}`} className="prge-phosphor-ghost">
          <div className="text-sm uppercase tracking-widest mb-4 text-center opacity-0">
            {/* Host label hidden on ghost — only the quote text persists */}
            &nbsp;
          </div>
          <div className="text-3xl md:text-4xl leading-snug text-center font-light">
            &ldquo;{ghost.text}&rdquo;
          </div>
        </div>
      )}
      <div key={lineIndex} className="prge-line">
        <div className="text-pink-400 text-sm uppercase tracking-widest mb-4 text-center">
          {HOST_LABEL[current.host] ?? current.host.toUpperCase()}
        </div>
        <div className="text-green-100 text-3xl md:text-4xl leading-snug text-center font-light">
          &ldquo;{current.text}&rdquo;
        </div>
      </div>
    </div>
  );
}
