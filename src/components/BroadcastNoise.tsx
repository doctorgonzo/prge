"use client";

import { useEffect, useRef, useState } from "react";

// Broadcast-realism overlay. Fires a brief snow-burst overlay whenever the
// segment fingerprint changes (channel change between hours), plus rare ambient
// micro-flickers (every ~45-110s) so the signal feels alive and slightly
// hunted. The channel-change burst includes a vertical sweep bar — the classic
// VHS tracking-loss artifact. Pure visual, no audio, no API.

type BurstReason = "channel-change" | "ambient" | "degraded";

interface Burst {
  reason: BurstReason;
}

interface BroadcastNoiseProps {
  segmentFingerprint: string | null;
  /**
   * 0–100 signal strength. Drives ambient glitch frequency + intensity.
   *   100 = clean signal (normal behavior)
   *    50 = degraded (glitches 3× more often)
   *    20 = critical (near-constant interference)
   * Default: 100
   */
  signalStrength?: number;
  /**
   * External burst trigger. Increment this counter to fire a "degraded"-style
   * burst from outside the component (e.g. scripted signal glitch events).
   * The burst fires whenever this value changes to a non-zero number.
   */
  forceBurst?: number;
}

const CHANNEL_CHANGE_DURATION_MS = 520;
const AMBIENT_DURATION_MS = 130;

// Base intervals at full signal (100). Scaled down as signal degrades.
const AMBIENT_MIN_INTERVAL_BASE_MS = 45_000;
const AMBIENT_MAX_INTERVAL_BASE_MS = 110_000;

// At critical signal (<20), floor the interval to keep it frenetic but not seizure-inducing.
const AMBIENT_MIN_FLOOR_MS = 4_000;
const AMBIENT_MAX_FLOOR_MS = 12_000;

/** Lerp ambient glitch intervals based on signal strength (0–100). */
function getAmbientIntervals(signal: number): [number, number] {
  const s = Math.max(0, Math.min(100, signal));
  // t=1 at full signal, t=0 at zero signal
  const t = s / 100;
  const min = AMBIENT_MIN_FLOOR_MS + t * (AMBIENT_MIN_INTERVAL_BASE_MS - AMBIENT_MIN_FLOOR_MS);
  const max = AMBIENT_MAX_FLOOR_MS + t * (AMBIENT_MAX_INTERVAL_BASE_MS - AMBIENT_MAX_FLOOR_MS);
  return [min, max];
}

export function BroadcastNoise({ segmentFingerprint, signalStrength = 100, forceBurst = 0 }: BroadcastNoiseProps) {
  const [burst, setBurst] = useState<Burst | null>(null);
  const prevFingerprintRef = useRef<string | null>(null);
  const clearTimerRef = useRef<number | null>(null);

  function fire(reason: BurstReason) {
    if (clearTimerRef.current) {
      window.clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }
    setBurst({ reason });
    const duration =
      reason === "channel-change"
        ? CHANNEL_CHANGE_DURATION_MS
        : reason === "degraded"
          ? 300  // Longer than ambient (130ms) but shorter than channel-change (520ms)
          : AMBIENT_DURATION_MS;
    clearTimerRef.current = window.setTimeout(() => {
      setBurst(null);
      clearTimerRef.current = null;
    }, duration);
  }

  // Channel-change burst on segment fingerprint flip. Skip the very first
  // non-null fingerprint so the boot transition doesn't fire snow on top of
  // itself.
  useEffect(() => {
    if (segmentFingerprint === null) return;
    if (prevFingerprintRef.current === null) {
      prevFingerprintRef.current = segmentFingerprint;
      return;
    }
    if (segmentFingerprint !== prevFingerprintRef.current) {
      prevFingerprintRef.current = segmentFingerprint;
      fire("channel-change");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segmentFingerprint]);

  // External burst trigger — fires a "degraded" burst when forceBurst changes.
  const prevForceBurstRef = useRef(forceBurst);
  useEffect(() => {
    if (forceBurst === 0) return;
    if (forceBurst !== prevForceBurstRef.current) {
      prevForceBurstRef.current = forceBurst;
      fire("degraded");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceBurst]);

  // Ambient micro-flicker loop — frequency scales inversely with signal
  // strength. At 100% signal, fires every ~45-110s. At 20% signal, every ~4-12s.
  // Re-schedules whenever signalStrength changes.
  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | null = null;
    function schedule() {
      const [min, max] = getAmbientIntervals(signalStrength);
      const delay = min + Math.random() * (max - min);
      timeoutId = window.setTimeout(() => {
        if (cancelled) return;
        // At low signal, use a longer burst so the degradation is more visible.
        const degraded = signalStrength < 40;
        fire(degraded ? "degraded" : "ambient");
        schedule();
      }, delay);
    }
    schedule();
    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signalStrength]);

  if (!burst) return null;
  const channel = burst.reason === "channel-change";
  const degraded = burst.reason === "degraded";
  const noiseClass = channel
    ? "prge-noise-channel"
    : degraded
      ? "prge-noise-degraded"
      : "prge-noise-ambient";
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden>
      <div className={noiseClass} />
      {channel && <div className="prge-sweep-bar" />}
      {degraded && <div className="prge-sweep-bar" style={{ animationDuration: "300ms" }} />}
    </div>
  );
}
