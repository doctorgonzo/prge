"use client";

import dynamic from "next/dynamic";

// ── Re-export types so consumers only import from MadisonMap ─────────

export type {
  CrisisPin,
  CallerPin,
  NeighborhoodDarkness,
  MadisonMapInnerProps,
} from "./MadisonMapInner";

// ── SSR-safe wrapper ─────────────────────────────────────────────────
// Leaflet accesses `window` at import time — it cannot run during SSR.
// The dynamic import with ssr:false ensures the inner component (and
// its Leaflet imports) only load on the client.

const MadisonMapInner = dynamic(() => import("./MadisonMapInner"), {
  ssr: false,
  loading: () => (
    <div
      className="flex items-center justify-center w-full h-full font-mono text-[10px] tracking-[0.3em] uppercase"
      style={{
        background: "#050a08",
        color: "rgba(74, 222, 128, 0.4)",
      }}
    >
      ACQUIRING SIGNAL&hellip;
    </div>
  ),
});

// ── Public component ─────────────────────────────────────────────────

// MadisonMapInnerProps already re-exported above; import it for local use.
import type { MadisonMapInnerProps as Props } from "./MadisonMapInner";

export function MadisonMap(props: Props) {
  return <MadisonMapInner {...props} />;
}
