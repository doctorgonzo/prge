"use client";

import { useEffect, useState } from "react";
import {
  getNextSegmentTransition,
  type NextSegmentInfo,
} from "@/lib/scheduler";
import type { HostId, SegmentFormat } from "@/lib/types";

// Real Madison wall-clock refresh — 30s is plenty for mm-resolution countdown
// math without burning a render-per-second. The countdown is real seconds (no
// conversion factor) so this maps 1:1 to the user's actual clock.
const TICK_MS = 30_000;

const HOST_LABEL: Record<HostId, string> = {
  quinn: "Quinn",
  caroline: "Caroline",
  holden: "Holden",
  tucker: "Tucker",
  marigold: "Marigold",
  nick: "Nick",
  tim: "Tim",
};

const FORMAT_LABEL: Record<SegmentFormat, string> = {
  "sign-on": "Sign-On",
  news: "News",
  weather: "Weather",
  sports: "Sports",
  "late-night-talk": "Late-Night Talk",
  "field-report": "Field Report",
  wellness: "Wellness",
  "music-block": "Music",
  mixed: "Mixed",
  "commercial-break": "Commercial Break",
  "station-id": "Station ID",
  "operator-cutin": "Operator Cut-In",
  "sign-off": "Sign-Off",
};

/**
 * NEXT UP chip — small subordinate readout under the in-world clock that warns
 * the viewer about the upcoming hour-boundary format flip. Computed client-side
 * because the scheduler uses `new Date()`; initial state stays null until the
 * first effect tick so server-rendered HTML and client hydration match.
 */
export function NextUpChip() {
  const [transition, setTransition] = useState<NextSegmentInfo | null>(null);

  useEffect(() => {
    const update = () => setTransition(getNextSegmentTransition());
    update();
    const id = setInterval(update, TICK_MS);
    return () => clearInterval(id);
  }, []);

  if (!transition) return null;

  const { realSecondsUntil, nextEntry } = transition;
  const minutes = Math.max(0, Math.floor(realSecondsUntil / 60));
  const hostName = HOST_LABEL[nextEntry.hosts[0]] ?? nextEntry.hosts[0];
  const formatName = FORMAT_LABEL[nextEntry.format] ?? nextEntry.format;

  return (
    <div className="text-green-700 text-[10px] mt-1 tracking-wider">
      &#8627; NEXT UP at {nextEntry.startInWorldTime} ({minutes}m) &rarr;{" "}
      {formatName} ({hostName})
    </div>
  );
}
