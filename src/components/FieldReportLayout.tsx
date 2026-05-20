"use client";

import { type PlayerLine } from "./player-types";
import { usePhosphorGhost } from "./usePhosphorGhost";

interface Props {
  current: PlayerLine | undefined;
  lineIndex: number;
}

// Field-report: Tucker's body-cam vibe. Red rec dot, lower-third caller-id
// style, subtle horizontal jitter on the line container. If a line literally
// contains "[CUT OFF]" we apply the static-glitch treatment.
export function FieldReportLayout({ current, lineIndex }: Props) {
  const ghost = usePhosphorGhost(current?.text, lineIndex);

  if (!current) return null;

  const isCutOff = current.text.includes("[CUT OFF]");

  return (
    <>
      {/* REC indicator — top-left of the center area, beneath the HUD strip */}
      <div className="absolute top-20 left-6 z-20 flex items-center gap-2 text-xs tracking-widest">
        <span className="prge-rec-dot inline-block w-2.5 h-2.5 rounded-full bg-red-500" />
        <span className="text-red-400 font-bold">REC</span>
      </div>

      {/* Body-cam line container with jitter */}
      <div className="relative max-w-3xl w-full">
        {ghost && (
          <div key={`ghost-${ghost.key}`} className="prge-phosphor-ghost">
            <div className="text-sm uppercase tracking-widest mb-4 text-center opacity-0">
              &nbsp;
            </div>
            <div className="text-2xl md:text-3xl leading-snug text-center font-light">
              &ldquo;{ghost.text}&rdquo;
            </div>
          </div>
        )}
        <div
          key={lineIndex}
          className={`prge-line prge-field-jitter ${
            isCutOff ? "prge-glitch" : ""
          }`}
        >
          <div className="text-red-400/90 text-sm uppercase tracking-widest mb-4 text-center">
            [FIELD] TUCKER TRAYWICK
          </div>
          <div className="text-green-100 text-2xl md:text-3xl leading-snug text-center font-light">
            &ldquo;{current.text}&rdquo;
          </div>
        </div>
      </div>

      {/* Lower-third caller-id strip */}
      <div className="absolute bottom-20 left-6 z-20 px-3 py-1.5 bg-black/70 border-l-2 border-red-500 text-xs">
        <div className="text-red-400 font-bold tracking-widest">TUCKER TRAYWICK</div>
        <div className="text-green-300/80 tracking-wide">FIELD CORRESPONDENT &middot; LIVE</div>
      </div>
    </>
  );
}
