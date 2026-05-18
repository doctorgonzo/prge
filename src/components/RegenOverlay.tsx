"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BROADCAST_SCHEDULE } from "@/lib/scheduler";
import type { PlayerSegment } from "./player-types";

interface Props {
  segment: PlayerSegment;
  onRegen: (next: PlayerSegment) => void;
  /** Dev trigger: fire a Nick cut-in immediately. */
  onTriggerNickCutIn?: () => void;
  /** Dev trigger: fire a retro ad break immediately. */
  onTriggerRetroAd?: () => void;
  /** Dev trigger: fire a Tim emergency interrupt immediately. */
  onTriggerTimInterrupt?: () => void;
  /** Dev trigger: fire a caller popup immediately. */
  onTriggerCallerPopup?: () => void;
  /** Dev trigger: fire a crisis event immediately. */
  onTriggerCrisis?: () => void;
  /** Dev trigger: fire a daytime text ad (commercial interstitial) immediately. */
  onTriggerTextAd?: () => void;
  /** Dev trigger: switch to countdown mode (pre-Purge emergency broadcasting). */
  onTriggerCountdown?: () => void;
  /** Dev trigger: fire the Purge commencement siren video. */
  onTriggerSiren?: () => void;
  /** Notify parent when time-travel changes the displayed time. The parent
   *  uses this to pin its HUD clock + countdown timer. Pass null to return
   *  to live clock. */
  onTimeTravel?: (overrideTime: string | null) => void;
}

// Defensive runtime validation for the regen response — mirrors the guard in
// page.tsx but kept local so this component is self-contained.
function isPlayerSegment(value: unknown): value is PlayerSegment {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.type !== "string") return false;
  if (!Array.isArray(v.lines)) return false;
  if (!Array.isArray(v.tickerItems)) return false;
  return true;
}

// All 12 hour-blocks, presented as the dropdown options. Indexed list lets us
// step ±1 hour by adjusting the index rather than parsing HH:MM.
const HOUR_OPTIONS = BROADCAST_SCHEDULE.map((entry) => ({
  hour: entry.hour,
  inWorldTime: entry.startInWorldTime,
  title: entry.title,
  format: entry.format,
}));

// Sentinel "no jump" value for the dropdown's default option. Using a known
// non-HH:MM string keeps the controlled select trivial.
const JUMP_PLACEHOLDER = "__placeholder__";

// ---------------------------------------------------------------------------
// Fast-forward constants
// ---------------------------------------------------------------------------
//
// Speed cycle: 1× → 2× → 4× → 8× → 1×. 1× means FF disengaged.
// `nextMultiplier` codifies the cycle so we don't repeat it inline.
type SpeedMultiplier = 1 | 2 | 4 | 8;
const FF_CYCLE: Record<SpeedMultiplier, SpeedMultiplier> = {
  1: 2,
  2: 4,
  4: 8,
  8: 1,
};

// Madison wall-clock is now 1:1 with real time — no conversion factor needed.
// FF stepping is simply `speedMultiplier` × real-elapsed-seconds, where each
// step advances Madison-broadcast-seconds by that amount.

// Broadcast-second window for the FF simulation. The simulation steps inside
// the Purge window [19:00, 07:00) so dev can visually walk every hour-block
// without falling into daytime. Inclusive lower bound at 19:00, exclusive
// upper bound at 30:00 (= 06:00 next day, the start of the sign-off hour).
// At the upper bound we wrap back to 19:00.
const FF_WINDOW_MIN_SEC = 0; // 0 — 19:00 (broadcast-second 0)
const FF_WINDOW_MAX_SEC = 12 * 3600; // 43,200 — 07:00 next day (exclusive)
const FF_WINDOW_LENGTH_SEC = FF_WINDOW_MAX_SEC - FF_WINDOW_MIN_SEC; // 43,200

// Tick rate while FF is active. 500ms keeps the on-screen clock smooth without
// hammering React; the format-boundary refetch only fires when the hour-block
// index actually changes, so this rate is independent of network traffic.
const FF_TICK_MS = 500;

// Dev-only overlay. The visibility gate lives in page.tsx; this component
// itself is unconditional, so prod tree-shaking happens via the conditional
// import site, not here. We still need a small internal guard against the
// rare case where the parent passes a null/undefined segment between renders.
export function RegenOverlay({ segment, onRegen, onTriggerNickCutIn, onTriggerRetroAd, onTriggerTimInterrupt, onTriggerCallerPopup, onTriggerCrisis, onTriggerTextAd, onTriggerCountdown, onTriggerSiren, onTimeTravel }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Active time-travel override. When non-null, all fetches (REGEN included)
  // carry `?at=<overrideAt>`. When null, the API consults the scheduler.
  const [overrideAt, setOverrideAt] = useState<string | null>(null);
  // Fast-forward state. `speedMultiplier === 1` means FF is OFF; the two
  // baseline values are non-null exactly when speedMultiplier > 1.
  const [speedMultiplier, setSpeedMultiplier] = useState<SpeedMultiplier>(1);
  const [ffStartedAtRealMs, setFfStartedAtRealMs] = useState<number | null>(null);
  const [ffStartedAtInWorldSec, setFfStartedAtInWorldSec] = useState<number | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks the hour-block index currently displayed in FF mode. When the
  // simulated time crosses into a new hour, this ref changes and we trigger
  // a cache-first refetch so the format actually swaps.
  const ffHourIndexRef = useRef<number | null>(null);
  // Tracks the most recent in-flight FF fetch promise so a slow request can't
  // stomp on a newer one. We don't cancel the request (fetch's signal API
  // would require AbortController plumbing through fetchSegment), we just
  // ignore stale responses by comparing this ref at resolution time.
  const ffFetchSeqRef = useRef(0);

  // Clear any pending error-clear timer on unmount so we don't setState after
  // the component is gone.
  useEffect(() => {
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, []);

  const showError = useCallback((message: string) => {
    setError(message);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => {
      setError(null);
      errorTimerRef.current = null;
    }, 4000);
  }, []);

  // Shared fetch + parse pipeline. `force=true` only on explicit REGEN clicks
  // — time-travel jumps never force, so cached slots are free.
  const fetchSegment = useCallback(
    async (at: string | null, force: boolean) => {
      if (busy) return;
      setBusy(true);
      setError(null);
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current);
        errorTimerRef.current = null;
      }
      try {
        const params = new URLSearchParams();
        if (at !== null) params.set("at", at);
        if (force) params.set("force", "1");
        const qs = params.toString();
        const url = qs ? `/api/segment?${qs}` : "/api/segment";
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
          // Surface API error message when possible so 400s show the reason.
          let detail = `HTTP ${res.status}`;
          try {
            const body: unknown = await res.json();
            if (
              body !== null &&
              typeof body === "object" &&
              typeof (body as { error?: unknown }).error === "string"
            ) {
              detail = (body as { error: string }).error;
            }
          } catch {
            // ignore — fall back to HTTP code
          }
          throw new Error(detail);
        }
        const json: unknown = await res.json();
        if (!isPlayerSegment(json)) {
          throw new Error("Response did not match player segment shape");
        }
        onRegen(json);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        showError(message);
      } finally {
        setBusy(false);
      }
    },
    [busy, onRegen, showError],
  );

  // Cancel any active FF and clear the baselines. Centralised so every manual
  // control (LIVE / ±1HR / JUMP TO) can drop FF with one call.
  const cancelFastForward = useCallback(() => {
    setSpeedMultiplier(1);
    setFfStartedAtRealMs(null);
    setFfStartedAtInWorldSec(null);
    ffHourIndexRef.current = null;
    // Bump the fetch-sequence so any in-flight FF fetch's onRegen is ignored
    // once it resolves — otherwise a stale FF response could stomp on the
    // user's just-clicked LIVE / JUMP TO segment.
    ffFetchSeqRef.current += 1;
  }, []);

  // Compute the broadcast-second value (0 = 19:00) for the time currently
  // visible in the overlay. Used as the FF baseline when engaging from 1×.
  const currentBroadcastSec = useMemo(() => {
    const target = overrideAt ?? segment.inWorldTime ?? null;
    if (target === null) return FF_WINDOW_MIN_SEC;
    return toBroadcastSec(target);
  }, [overrideAt, segment.inWorldTime]);

  const handleRegen = useCallback(() => {
    // REGEN respects the active time-travel override if any — burns a token
    // for the slot we're currently viewing, not for the real-world live slot.
    // FF stays engaged: regenerating the current simulated slot is a sensible
    // operation; the tick will pick up where it left off afterwards.
    void fetchSegment(overrideAt, true);
  }, [fetchSegment, overrideAt]);

  // Resolve the current hour-block index for ±1 stepping. Use the override
  // when active; otherwise derive from the segment's inWorldTime so the
  // first ±1HR click steps from the live slot we're currently viewing.
  const currentHourIndex = useMemo(() => {
    const target = overrideAt ?? segment.inWorldTime ?? null;
    if (target === null) return 0;
    // Schedule spans midnight, so plain string compare on HH:MM is wrong.
    // Map onto broadcast-seconds (0 = 19:00) so 00:00 sorts AFTER 23:00.
    const targetSec = toBroadcastSec(target);
    let idx = 0;
    for (let i = 0; i < HOUR_OPTIONS.length; i++) {
      const candidateSec = toBroadcastSec(HOUR_OPTIONS[i].inWorldTime);
      if (candidateSec <= targetSec) idx = i;
      else break;
    }
    return idx;
  }, [overrideAt, segment.inWorldTime]);

  const stepHour = useCallback(
    (delta: -1 | 1) => {
      const next = currentHourIndex + delta;
      // Clamp at the ends of the broadcast — don't wrap. There's no slot
      // before 19:00 or after 06:00, and silently wrapping would confuse Doc.
      if (next < 0 || next >= HOUR_OPTIONS.length) return;
      const at = HOUR_OPTIONS[next].inWorldTime;
      // Manual step cancels FF — Doc has taken explicit control.
      cancelFastForward();
      setOverrideAt(at);
      onTimeTravel?.(at);
      void fetchSegment(at, false);
    },
    [currentHourIndex, fetchSegment, cancelFastForward, onTimeTravel],
  );

  const handleJump = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value;
      // Reset the select back to the placeholder after triggering — the
      // dropdown is an action, not a binding.
      e.target.value = JUMP_PLACEHOLDER;
      if (value === JUMP_PLACEHOLDER) return;
      // Manual jump cancels FF.
      cancelFastForward();
      setOverrideAt(value);
      onTimeTravel?.(value);
      void fetchSegment(value, false);
    },
    [fetchSegment, cancelFastForward, onTimeTravel],
  );

  const handleLive = useCallback(() => {
    // LIVE drops both the time-travel override AND any active FF.
    cancelFastForward();
    setOverrideAt(null);
    onTimeTravel?.(null); // return HUD clock to real Madison time
    void fetchSegment(null, false);
  }, [fetchSegment, cancelFastForward, onTimeTravel]);

  // FF button handler. Cycles 1 → 2 → 4 → 8 → 1. On any non-1 transition we
  // re-anchor the baseline to "now" so the simulated time picks up smoothly
  // from wherever it currently is (no time jumps when changing speed mid-FF).
  // Transition to 1 (i.e. 8 → 1) clears all FF state.
  const handleFastForward = useCallback(() => {
    const next = FF_CYCLE[speedMultiplier];
    if (next === 1) {
      cancelFastForward();
      return;
    }
    // Rebase anchor at the CURRENT simulated time. When engaging from 1×, the
    // current simulated time is whatever's on screen (currentBroadcastSec).
    // When stepping 2→4 or 4→8 mid-FF, the tick effect's latest computed
    // simulated time is already reflected in `overrideAt`, so currentBroadcastSec
    // (which derives from overrideAt) is also correct.
    const anchorSec = currentBroadcastSec;
    setFfStartedAtRealMs(Date.now());
    setFfStartedAtInWorldSec(anchorSec);
    setSpeedMultiplier(next);
    // Reset the boundary tracker so the very first tick after engagement
    // will compare against the anchored hour and only refetch on real change.
    ffHourIndexRef.current = hourIndexForBroadcastSec(anchorSec);
  }, [speedMultiplier, cancelFastForward, currentBroadcastSec]);

  // The continuous FF tick. While speedMultiplier > 1, every 500ms we:
  //   1. Compute the simulated broadcast-second from the anchored baseline.
  //   2. Wrap it into the [19:05, 06:00) drop-in window.
  //   3. Format as HH:MM and stash in `overrideAt` (drives the on-screen clock).
  //   4. If the hour-block index changed since last tick, fire a cache-first
  //      refetch so the format/layout actually swaps. We bump a sequence ref
  //      so an in-flight FF fetch can't stomp on a newer one (or on a manual
  //      override that landed after FF was cancelled).
  useEffect(() => {
    if (
      speedMultiplier === 1 ||
      ffStartedAtRealMs === null ||
      ffStartedAtInWorldSec === null
    ) {
      return;
    }

    const tick = () => {
      const elapsedRealMs = Date.now() - ffStartedAtRealMs;
      // 1:1 ratio: simulated broadcast-seconds advance by speedMultiplier
      // times real-elapsed-seconds. At 8× a minute of real time covers 8
      // minutes of broadcast time, which is what makes FF feel like FF.
      const simulatedDelta = (elapsedRealMs / 1000) * speedMultiplier;
      // Wrap the simulated broadcast-second into [FF_WINDOW_MIN_SEC, FF_WINDOW_MAX_SEC).
      // Offset within the window so the modulo math is clean, then re-add the floor.
      const rawSec = ffStartedAtInWorldSec + simulatedDelta;
      const offsetFromMin = rawSec - FF_WINDOW_MIN_SEC;
      const wrappedOffset =
        ((offsetFromMin % FF_WINDOW_LENGTH_SEC) + FF_WINDOW_LENGTH_SEC) %
        FF_WINDOW_LENGTH_SEC;
      const simulatedSec = FF_WINDOW_MIN_SEC + wrappedOffset;

      const simulatedHHMM = broadcastSecToHHMM(simulatedSec);
      setOverrideAt(simulatedHHMM);
      onTimeTravel?.(simulatedHHMM);

      const newHourIndex = hourIndexForBroadcastSec(simulatedSec);
      if (newHourIndex !== ffHourIndexRef.current) {
        ffHourIndexRef.current = newHourIndex;
        // Capture the sequence at dispatch so we know whether to honor the
        // response when it resolves. cancelFastForward bumps the seq.
        const mySeq = ++ffFetchSeqRef.current;
        // Custom fetch path: we want silent (no busy lock, no error toast) and
        // we need to gate onRegen on the sequence ref. Reimplement the slim
        // version here — fetchSegment can't easily express the seq gate.
        void (async () => {
          try {
            const url = `/api/segment?at=${encodeURIComponent(simulatedHHMM)}`;
            const res = await fetch(url, { cache: "no-store" });
            if (!res.ok) {
              let detail = `HTTP ${res.status}`;
              try {
                const body: unknown = await res.json();
                if (
                  body !== null &&
                  typeof body === "object" &&
                  typeof (body as { error?: unknown }).error === "string"
                ) {
                  detail = (body as { error: string }).error;
                }
              } catch {
                // ignore
              }
              throw new Error(detail);
            }
            const json: unknown = await res.json();
            if (!isPlayerSegment(json)) {
              throw new Error("Response did not match player segment shape");
            }
            // Stale-response guard: if FF was cancelled or another hour-cross
            // already kicked off a newer fetch, drop this result.
            if (mySeq !== ffFetchSeqRef.current) return;
            onRegen(json);
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.warn("[FF] segment fetch failed during fast-forward:", message);
          }
        })();
      }
    };

    const id = setInterval(tick, FF_TICK_MS);
    // Fire one immediately so the on-screen clock reflects the new anchor
    // without waiting a half-second after click.
    tick();
    return () => clearInterval(id);
  }, [speedMultiplier, ffStartedAtRealMs, ffStartedAtInWorldSec, onRegen, onTimeTravel]);

  const segmentType = segment.type.toUpperCase();
  const inWorldTime = segment.inWorldTime ?? "--:--";
  const segmentTitle = segment.segmentTitle ?? "";

  const atStart = currentHourIndex === 0;
  const atEnd = currentHourIndex === HOUR_OPTIONS.length - 1;

  const ffActive = speedMultiplier > 1;
  // Label cycles with the multiplier: FF, FF 2×, FF 4×, FF 8×.
  const ffLabel = speedMultiplier === 1 ? "FF" : `FF ${speedMultiplier}\u00d7`;
  // When FF is engaged, show the simulated time prominently (replacing the
  // static in-world time line). overrideAt is being updated every 500ms by
  // the tick, so it reads as a live counter.
  const displayedTime = ffActive && overrideAt ? overrideAt : inWorldTime;

  return (
    <div
      // z-50 sits above the scanlines (z-40), vignette (z-30), ticker (z-20),
      // and HUD (z-20). The overlay needs to be reachable for clicks, so it
      // must outrank every pointer-events:none CRT overlay.
      className="fixed bottom-20 right-4 z-50 w-[280px] bg-black/70 border border-pink-500/40 rounded-sm font-mono text-xs shadow-lg backdrop-blur-sm"
      role="region"
      aria-label="Developer regen overlay"
    >
      <div className="px-3 py-2 border-b border-pink-500/30 flex items-center justify-between">
        <span className="text-pink-400 font-bold tracking-widest">DEV</span>
        <span
          className={
            ffActive
              ? "text-pink-300 tracking-widest prge-ff-pulse"
              : "text-green-400 tracking-widest"
          }
          aria-live={ffActive ? "polite" : "off"}
        >
          {displayedTime}
          {ffActive ? (
            <span className="ml-1 text-pink-400/80 text-[10px]">
              {`(${speedMultiplier}\u00d7)`}
            </span>
          ) : null}
        </span>
      </div>

      <div className="px-3 py-2 space-y-1">
        <div className="text-green-300 tracking-widest uppercase">
          {segmentType}
        </div>
        {segmentTitle ? (
          <div className="text-green-100/70 text-[10px] truncate" title={segmentTitle}>
            {segmentTitle}
          </div>
        ) : null}
      </div>

      <div className="px-3 py-2 border-t border-pink-500/20 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-pink-400/80 text-[10px] tracking-widest">
            TIME-TRAVEL
          </span>
          {overrideAt !== null || ffActive ? (
            <button
              type="button"
              onClick={handleLive}
              disabled={busy}
              className="px-2 py-0.5 text-[10px] tracking-widest text-pink-300 border border-pink-500/40 rounded-sm hover:bg-pink-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Return to live broadcast"
            >
              LIVE
            </button>
          ) : null}
        </div>

        {/* Fast-forward button — sits above the ±1HR row so it reads as the
            "continuous" control over the "step" controls. Cycles 1→2→4→8→1. */}
        <button
          type="button"
          onClick={handleFastForward}
          disabled={busy}
          className={
            ffActive
              ? "w-full px-2 py-1 bg-pink-500/40 border border-pink-400 text-pink-100 font-bold text-[10px] tracking-widest rounded-sm transition-colors prge-ff-pulse disabled:opacity-40 disabled:cursor-not-allowed"
              : "w-full px-2 py-1 bg-pink-500/10 border border-pink-500/40 text-pink-300 hover:bg-pink-500/20 text-[10px] tracking-widest rounded-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          }
          aria-label={`Fast-forward, current speed ${speedMultiplier}x`}
          aria-pressed={ffActive}
        >
          {ffLabel}
        </button>

        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => stepHour(-1)}
            disabled={busy || atStart}
            className="flex-1 px-2 py-1 bg-pink-500/10 border border-pink-500/40 text-pink-300 hover:bg-pink-500/20 disabled:opacity-30 disabled:cursor-not-allowed text-[10px] tracking-widest rounded-sm transition-colors"
            aria-label="Step back one hour"
          >
            {"\u2190 1HR"}
          </button>
          <button
            type="button"
            onClick={() => stepHour(1)}
            disabled={busy || atEnd}
            className="flex-1 px-2 py-1 bg-pink-500/10 border border-pink-500/40 text-pink-300 hover:bg-pink-500/20 disabled:opacity-30 disabled:cursor-not-allowed text-[10px] tracking-widest rounded-sm transition-colors"
            aria-label="Step forward one hour"
          >
            {"1HR \u2192"}
          </button>
        </div>

        <select
          // Always show the placeholder — the select is an action trigger,
          // not a controlled binding to the current override.
          defaultValue={JUMP_PLACEHOLDER}
          onChange={handleJump}
          disabled={busy}
          aria-label="Jump to broadcast hour"
          className="w-full px-2 py-1 bg-black/60 border border-pink-500/40 text-pink-200 text-[10px] tracking-wider rounded-sm focus:outline-none focus:border-pink-400 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <option value={JUMP_PLACEHOLDER}>{"\u2014 jump to hour \u2014"}</option>
          <option value="18:59">
            {"\u26A0 18:59 \u00b7 Pre-Purge Countdown (last min)"}
          </option>
          {HOUR_OPTIONS.map((opt) => (
            <option key={opt.hour} value={opt.inWorldTime}>
              {`Hour ${opt.hour} \u00b7 ${opt.inWorldTime} \u00b7 ${opt.title}`}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <div
          className="px-3 py-1 text-[10px] text-red-300 border-t border-red-500/30 break-words"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {/* Interstitial triggers — Nick cut-in + retro ad */}
      <div className="px-3 py-2 border-t border-pink-500/20 space-y-1">
        <span className="text-pink-400/80 text-[10px] tracking-widest">
          INTERSTITIALS
        </span>
        <div className="flex gap-1 flex-wrap">
          {onTriggerNickCutIn ? (
            <button
              type="button"
              onClick={onTriggerNickCutIn}
              className="flex-1 px-2 py-1 bg-amber-500/10 border border-amber-500/40 text-amber-300 hover:bg-amber-500/20 text-[10px] tracking-widest rounded-sm transition-colors"
              aria-label="Trigger Nick cut-in"
            >
              NICK CUT-IN
            </button>
          ) : null}
          {onTriggerRetroAd ? (
            <button
              type="button"
              onClick={onTriggerRetroAd}
              className="flex-1 px-2 py-1 bg-amber-500/10 border border-amber-500/40 text-amber-300 hover:bg-amber-500/20 text-[10px] tracking-widest rounded-sm transition-colors"
              aria-label="Trigger retro ad break"
            >
            80s AD
            </button>
          ) : null}
          {onTriggerTextAd ? (
            <button
              type="button"
              onClick={onTriggerTextAd}
              className="flex-1 px-2 py-1 bg-amber-500/10 border border-amber-500/40 text-amber-300 hover:bg-amber-500/20 text-[10px] tracking-widest rounded-sm transition-colors"
              aria-label="Trigger text ad break"
            >
              TEXT AD
            </button>
          ) : null}
          {onTriggerTimInterrupt ? (
            <button
              type="button"
              onClick={onTriggerTimInterrupt}
              className="flex-1 px-2 py-1 bg-red-500/10 border border-red-500/40 text-red-300 hover:bg-red-500/20 text-[10px] tracking-widest rounded-sm transition-colors"
              aria-label="Trigger Tim emergency interrupt"
            >
              TIM EBS
            </button>
          ) : null}
          {onTriggerCallerPopup ? (
            <button
              type="button"
              onClick={onTriggerCallerPopup}
              className="flex-1 px-2 py-1 bg-green-500/10 border border-green-500/40 text-green-300 hover:bg-green-500/20 text-[10px] tracking-widest rounded-sm transition-colors"
              aria-label="Trigger caller popup"
            >
              CALLER
            </button>
          ) : null}
          {onTriggerCrisis ? (
            <button
              type="button"
              onClick={onTriggerCrisis}
              className="flex-1 px-2 py-1 bg-orange-500/10 border border-orange-500/40 text-orange-300 hover:bg-orange-500/20 text-[10px] tracking-widest rounded-sm transition-colors"
              aria-label="Trigger crisis event"
            >
              CRISIS
            </button>
          ) : null}
        </div>
        {/* Broadcast mode triggers — countdown + siren */}
        {(onTriggerCountdown || onTriggerSiren) ? (
          <div className="flex gap-1 pt-1">
            {onTriggerCountdown ? (
              <button
                type="button"
                onClick={onTriggerCountdown}
                className="flex-1 px-2 py-1 bg-yellow-500/10 border border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/20 text-[10px] tracking-widest rounded-sm transition-colors"
                aria-label="Switch to countdown mode"
              >
                COUNTDOWN
              </button>
            ) : null}
            {onTriggerSiren ? (
              <button
                type="button"
                onClick={onTriggerSiren}
                className="flex-1 px-2 py-1 bg-red-600/20 border border-red-500/40 text-red-300 hover:bg-red-600/30 text-[10px] tracking-widest rounded-sm transition-colors"
                aria-label="Play Purge commencement siren"
              >
                SIREN
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="px-3 pb-3 pt-1">
        <button
          type="button"
          onClick={handleRegen}
          disabled={busy}
          className="w-full px-2 py-2 bg-pink-500 hover:bg-pink-400 disabled:bg-pink-500/40 disabled:cursor-not-allowed text-black font-bold tracking-widest text-xs rounded-sm transition-colors"
          aria-busy={busy}
        >
          {busy ? "GENERATING\u2026" : "REGEN"}
        </button>
      </div>
    </div>
  );
}

// Convert "HH:MM" into seconds-since-19:00 within the broadcast loop. Used
// only by the overlay to find the active hour-block when the segment's
// inWorldTime falls inside (not on) an hour boundary. Hours 19..23 map to
// 0..14400s; hours 00..06 map to +24h (i.e. 18000..43200s).
function toBroadcastSec(hhmm: string): number {
  const [hStr, mStr] = hhmm.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  const absHour = h >= 19 ? h : h + 24;
  return (absHour - 19) * 3600 + m * 60;
}

// Inverse of toBroadcastSec — render a broadcast-second back into "HH:MM" (24-hour).
// Used by the FF tick to format simulated time for the API's ?at= param.
function broadcastSecToHHMM(broadcastSec: number): string {
  // broadcastSec is offset from 19:00 (= 0). Add 19*3600 to get seconds-past-midnight,
  // then mod 86400 to wrap from 30:00 back to 06:00 of the next day.
  const totalSec = Math.floor(broadcastSec) + 19 * 3600;
  const absHour = Math.floor(totalSec / 3600) % 24;
  const absMin = Math.floor((totalSec % 3600) / 60);
  return `${absHour < 10 ? "0" : ""}${absHour}:${absMin < 10 ? "0" : ""}${absMin}`;
}

// Resolve the hour-block index for a broadcast-second value. Linear scan
// from the end — schedule is monotonic in broadcast-seconds. Mirrors the
// logic in `currentHourIndex` but operates on the FF tick's raw second value
// without going through HH:MM stringification first.
function hourIndexForBroadcastSec(broadcastSec: number): number {
  let idx = 0;
  for (let i = 0; i < HOUR_OPTIONS.length; i++) {
    const candidateSec = toBroadcastSec(HOUR_OPTIONS[i].inWorldTime);
    if (candidateSec <= broadcastSec) idx = i;
    else break;
  }
  return idx;
}
