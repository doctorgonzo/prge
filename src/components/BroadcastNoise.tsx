"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// Broadcast-realism overlay. Fires a brief snow-burst overlay whenever the
// segment fingerprint changes (channel change between hours), plus rare ambient
// micro-flickers (every ~45-110s) so the signal feels alive and slightly
// hunted. The channel-change burst includes a vertical sweep bar — the classic
// VHS tracking-loss artifact. Channel-change bursts also fire a short analog
// tuning pop/squelch via Web Audio when sound is enabled.

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
  /** Whether audio is enabled (user's sound toggle). */
  soundEnabled?: boolean;
  /**
   * When true (03:00-04:59 Madison), ambient burst intervals are halved.
   * The station's signal is struggling — more frequent micro-glitches.
   */
  deadZone?: boolean;
}

const CHANNEL_CHANGE_DURATION_MS = 520;
const AMBIENT_DURATION_MS = 130;

// Base intervals at full signal (100). Scaled down as signal degrades.
const AMBIENT_MIN_INTERVAL_BASE_MS = 45_000;
const AMBIENT_MAX_INTERVAL_BASE_MS = 110_000;

// At critical signal (<20), floor the interval to keep it frenetic but not seizure-inducing.
const AMBIENT_MIN_FLOOR_MS = 4_000;
const AMBIENT_MAX_FLOOR_MS = 12_000;

/** Lerp ambient glitch intervals based on signal strength (0–100).
 *  When deadZone is true, intervals are halved — doubled burst rate. */
function getAmbientIntervals(signal: number, deadZone = false): [number, number] {
  const s = Math.max(0, Math.min(100, signal));
  // t=1 at full signal, t=0 at zero signal
  const t = s / 100;
  let min = AMBIENT_MIN_FLOOR_MS + t * (AMBIENT_MIN_INTERVAL_BASE_MS - AMBIENT_MIN_FLOOR_MS);
  let max = AMBIENT_MAX_FLOOR_MS + t * (AMBIENT_MAX_INTERVAL_BASE_MS - AMBIENT_MAX_FLOOR_MS);
  // Dead zone: halve the intervals so bursts come twice as often.
  if (deadZone) {
    min *= 0.5;
    max *= 0.5;
  }
  return [min, max];
}

/**
 * Play a short (~175ms) analog radio tuning pop/squelch via Web Audio API.
 * Layers a brief oscillator chirp with bandpass-filtered white noise to
 * simulate the characteristic "pop" of a radio dial landing on a frequency.
 * Volume is kept low (~15-20% of max) so it's atmospheric, not jarring.
 */
function playTuningSquelch(): void {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    const duration = 0.175; // 175ms

    // Master gain — keeps overall volume at ~18%.
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.18, now);
    master.gain.linearRampToValueAtTime(0, now + duration);
    master.connect(ctx.destination);

    // Layer 1: Quick oscillator chirp — starts high, sweeps down fast.
    // This is the "pop" component.
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(2400, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + duration * 0.6);
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.3, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.5);
    osc.connect(oscGain);
    oscGain.connect(master);
    osc.start(now);
    osc.stop(now + duration);

    // Layer 2: Bandpass-filtered white noise — the "squelch" hiss.
    const bufferLength = Math.ceil(ctx.sampleRate * duration);
    const noiseBuffer = ctx.createBuffer(1, bufferLength, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferLength; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    // Bandpass filter centered at ~3kHz — radio-like crackle band.
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.setValueAtTime(3000, now);
    bandpass.Q.setValueAtTime(1.5, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.7, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noiseSource.connect(bandpass);
    bandpass.connect(noiseGain);
    noiseGain.connect(master);
    noiseSource.start(now);
    noiseSource.stop(now + duration);

    // Clean up the AudioContext after the burst finishes.
    setTimeout(() => {
      try { ctx.close(); } catch { /* already closed */ }
    }, Math.ceil(duration * 1000) + 100);
  } catch {
    // Web Audio not available — silent fallback.
  }
}

export function BroadcastNoise({ segmentFingerprint, signalStrength = 100, forceBurst = 0, soundEnabled = false, deadZone = false }: BroadcastNoiseProps) {
  const [burst, setBurst] = useState<Burst | null>(null);
  const prevFingerprintRef = useRef<string | null>(null);
  const clearTimerRef = useRef<number | null>(null);
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  // Memoized fire callback that also triggers the audio squelch on
  // channel-change bursts when sound is enabled.
  const fire = useCallback(function fire(reason: BurstReason) {
    if (clearTimerRef.current) {
      window.clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }
    setBurst({ reason });

    // Play tuning squelch on channel-change bursts when sound is on.
    if (reason === "channel-change" && soundEnabledRef.current) {
      playTuningSquelch();
    }

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
  }, []);

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
  // Re-schedules whenever signalStrength or deadZone changes. During the dead
  // zone (03:00-04:59), intervals are halved — doubled burst rate.
  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | null = null;
    function schedule() {
      const [min, max] = getAmbientIntervals(signalStrength, deadZone);
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
  }, [signalStrength, deadZone]);

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
