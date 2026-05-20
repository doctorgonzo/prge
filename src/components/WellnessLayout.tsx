"use client";

import { HOST_LABEL, type PlayerLine } from "./player-types";
import { usePhosphorGhost } from "./usePhosphorGhost";

interface Props {
  current: PlayerLine | undefined;
  lineIndex: number;
}

// Wellness: slow, hushed, purple-pink. Marigold's hour. The dwell time is
// extended in the parent (wellnessReadDurationMs); here we only do the visual
// treatment — desaturated palette, slow-pulsing background, lower contrast.
export function WellnessLayout({ current, lineIndex }: Props) {
  const ghost = usePhosphorGhost(current?.text, lineIndex);

  if (!current) return null;
  return (
    <>
      <div className="prge-wellness-pulse pointer-events-none absolute inset-0 z-0" />
      <div className="relative z-10 max-w-3xl w-full">
        {ghost && (
          <div key={`ghost-${ghost.key}`} className="prge-phosphor-ghost">
            <div className="text-sm uppercase tracking-widest mb-6 text-center opacity-0">
              &nbsp;
            </div>
            <div className="text-3xl md:text-4xl leading-relaxed text-center font-light">
              {ghost.text}
            </div>
          </div>
        )}
        <div key={lineIndex} className="prge-line">
          <div className="text-fuchsia-300/80 text-sm uppercase tracking-widest mb-6 text-center">
            {HOST_LABEL[current.host] ?? current.host.toUpperCase()}
          </div>
          <div className="text-pink-100/90 text-3xl md:text-4xl leading-relaxed text-center font-light">
            {current.text}
          </div>
        </div>
      </div>
    </>
  );
}
