"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { mockSegment } from "@/lib/mock-segment";
import { DefaultLayout } from "@/components/DefaultLayout";
import { MusicBlockLayout } from "@/components/MusicBlockLayout";
import { WellnessLayout } from "@/components/WellnessLayout";
import { CommercialBreakLayout } from "@/components/CommercialBreakLayout";
import { FieldReportLayout } from "@/components/FieldReportLayout";
import { CountdownLayout } from "@/components/CountdownLayout";
import { PurgeSiren } from "@/components/PurgeSiren";
import { RegenOverlay } from "@/components/RegenOverlay";
import { LoadingPanel } from "@/components/LoadingPanel";
import { NextUpChip } from "@/components/NextUpChip";
import { BroadcastNoise } from "@/components/BroadcastNoise";
import { TuneInBoot } from "@/components/TuneInBoot";
import { PurgeAnnouncement } from "@/components/PurgeAnnouncement";
import { madisonNowHHMM } from "@/lib/scheduler";
import { pickRetroAd, pickRandomRetroAd, type RetroAd } from "@/lib/retro-ads";
import { buildStaticDaytimeCommercial } from "@/lib/daytime-static";
import { buildStaticCountdownSegment } from "@/lib/countdown-static";
import { pickRandomNickCutIn } from "@/lib/nick-cut-ins";
import { RetroAdBreak } from "@/components/RetroAdBreak";
import { pickRandomTimInterrupt, type TimInterrupt } from "@/lib/tim-interrupts";
import { EmergencyAlert } from "@/components/EmergencyAlert";
import { pickRandomCallerPopup, type CallerPopup as CallerPopupData } from "@/lib/caller-popups";
import { CallerPopup } from "@/components/CallerPopup";
import { DawnCountdown } from "@/components/DawnCountdown";
import { ViewerCount } from "@/components/ViewerCount";
import { FORMAT_TO_HOST, pickRandomHostReaction, type HostReaction } from "@/lib/host-reactions";
import {
  getStationBreach,
  pickRandomCrisisEvent,
  pickRandomNonBreachCrisis,
  type CrisisEvent,
  type CrisisUpdate,
} from "@/lib/crisis-events";
import { CrisisIndicator } from "@/components/CrisisIndicator";
import { DeadAir } from "@/components/DeadAir";
import {
  SurvivorBoard,
  buildFateQueue,
  type TrackedCaller,
} from "@/components/SurvivorBoard";
import { ClassicalInterlude } from "@/components/ClassicalInterlude";
import { classicalPlaylistForSlot } from "@/lib/classical-pool";
import {
  ensureLog,
  logCrisis,
  logCaller,
  logNickCutIn,
  logTimInterrupt,
  logRetroAd,
  logSiren,
  logSegmentType,
  logSessionEnd,
} from "@/lib/broadcast-log";
import {
  CATEGORY_LABEL,
  HOST_LABEL,
  readDurationMs,
  wellnessReadDurationMs,
  type NickCutIn,
  type PlayerAd,
  type PlayerLine,
  type PlayerSegment,
  type PlayerTickerItem,
  type PlayerTrack,
} from "@/components/player-types";

// Disk cache fronts /api/segment, so 60s refreshes are free: they either hit
// the cache or hit the budget gate — never a surprise token burn.
const REFETCH_INTERVAL_MS = 60_000;

// Type guard for defensive validation of arbitrary JSON from /api/segment.
// Required fields (type / lines / tickerItems) are validated strictly; the
// format-specific tracks/ads arrays are accepted when present but never
// required, so a missing-field commercial-break still parses as a segment.
function isPlayerSegment(value: unknown): value is PlayerSegment {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.type !== "string") return false;
  if (!Array.isArray(v.lines)) return false;
  if (!Array.isArray(v.tickerItems)) return false;
  for (const ln of v.lines) {
    if (!ln || typeof ln !== "object") return false;
    const l = ln as Record<string, unknown>;
    if (typeof l.host !== "string" || typeof l.text !== "string") return false;
  }
  for (const it of v.tickerItems) {
    if (!it || typeof it !== "object") return false;
    const t = it as Record<string, unknown>;
    if (typeof t.category !== "string" || typeof t.text !== "string") return false;
  }
  if (v.tracks !== undefined) {
    if (!Array.isArray(v.tracks)) return false;
    for (const tr of v.tracks) {
      if (!tr || typeof tr !== "object") return false;
      const t = tr as Record<string, unknown>;
      if (typeof t.title !== "string" || typeof t.artist !== "string") return false;
      if (t.year !== undefined && typeof t.year !== "number") return false;
      // Per-track lines (music-block v2). Optional so legacy cached segments
      // without this field still parse — the layout falls back to the
      // top-level `lines` array in that case.
      if (t.lines !== undefined) {
        if (!Array.isArray(t.lines)) return false;
        for (const ln of t.lines) {
          if (!ln || typeof ln !== "object") return false;
          const l = ln as Record<string, unknown>;
          if (typeof l.host !== "string" || typeof l.text !== "string") return false;
        }
      }
    }
  }
  if (v.ads !== undefined) {
    if (!Array.isArray(v.ads)) return false;
    for (const ad of v.ads) {
      if (!ad || typeof ad !== "object") return false;
      const a = ad as Record<string, unknown>;
      if (typeof a.brand !== "string" || typeof a.tagline !== "string") return false;
      if (a.body !== undefined && typeof a.body !== "string") return false;
    }
  }
  return true;
}

// Normalize mockSegment into the mutable PlayerSegment shape (it's `as const` upstream).
const FALLBACK_SEGMENT: PlayerSegment = {
  type: mockSegment.type,
  inWorldTime: mockSegment.inWorldTime,
  segmentTitle: mockSegment.segmentTitle,
  lines: mockSegment.lines.map((l) => ({ host: l.host, text: l.text })),
  tickerItems: mockSegment.tickerItems.map((t) => ({
    category: t.category,
    text: t.text,
  })),
};

// Fingerprint that uniquely identifies a segment's *content*. If the API
// returns the same cached segment as last poll, the fingerprint is stable and
// we skip the cycle-reset. We intentionally EXCLUDE inWorldTime because the
// API enriches every response with the current Madison minute — that changes
// every 60s poll but the underlying content is identical (same cached slot).
// Including it caused tracks to reset every poll cycle (the "10-second song
// restart" bug). Instead we fingerprint by type + title + first line of
// content, which is stable within a slot and changes on real content swaps.
function fingerprintOf(s: PlayerSegment): string {
  // Prefer the stable slotKey from the API (e.g. "01:00") — it doesn't change
  // when {{CLOCK}}/{{ELAPSED}} are interpolated each minute. Fall back to
  // first-line content for segments that don't carry a slotKey.
  const slot = (s as unknown as Record<string, unknown>).slotKey;
  if (typeof slot === "string") {
    return `${s.type}__${s.segmentTitle ?? ""}__${slot}`;
  }
  const firstLine = s.lines[0]?.text ?? "";
  return `${s.type}__${s.segmentTitle ?? ""}__${firstLine.slice(0, 80)}`;
}

// Build the interleaved "unit stream" for the commercial-break layout: ads are
// primary; if optional bumper lines exist, drop one between each pair of ads.
type CommercialUnit =
  | { kind: "ad"; ad: PlayerAd }
  | { kind: "line"; line: PlayerLine };
function buildCommercialUnits(
  ads: PlayerAd[],
  lines: PlayerLine[],
): CommercialUnit[] {
  if (ads.length === 0 && lines.length === 0) return [];
  if (lines.length === 0) return ads.map((ad) => ({ kind: "ad" as const, ad }));
  const out: CommercialUnit[] = [];
  let li = 0;
  for (let i = 0; i < ads.length; i++) {
    out.push({ kind: "ad", ad: ads[i] });
    // Drop a bumper line after every ad except the last, looping through
    // available lines (typically just one "we'll be right back").
    if (i < ads.length - 1 && lines.length > 0) {
      out.push({ kind: "line", line: lines[li % lines.length] });
      li++;
    }
  }
  return out;
}

// Live Madison wall-clock for the top-HUD readout. Initial state is null so
// SSR and first client render match; the first effect tick fills it in.
// Refresh matches NextUpChip (30s) so HUD time and "NEXT UP at HH:MM"
// countdown stay in lockstep instead of drifting apart.
const HUD_CLOCK_TICK_MS = 30_000;

// Read the dev-only ?at=HH:MM override off the current URL. Used to pin the
// HUD clock to the dev-override time so the visible clock matches the API's
// resolved slot during time-travel. Returns null when not set or malformed.
const AT_PARAM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
function readAtOverrideFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const at = new URL(window.location.href).searchParams.get("at");
    if (at !== null && AT_PARAM_RE.test(at)) return at;
  } catch {
    /* swallow — URL parse failures fall through to null */
  }
  return null;
}

// Dev-only client-side killswitch. When on, the player stops polling the
// segment API entirely — useful for stopping local Anthropic spend mid-debug
// without having to flip server config. State persists in localStorage so a
// reload preserves the kill.
const KILLSWITCH_KEY = "prge-killswitch";
const IS_DEV = process.env.NODE_ENV !== "production";

// Sound toggle — persists in localStorage so the user's preference sticks.
// Default is muted (false) to avoid autoplay surprises.
const SOUND_KEY = "prge-sound";

export default function Page() {
  const [segment, setSegment] = useState<PlayerSegment | null>(null);
  const [loading, setLoading] = useState(true);
  const [cycleIndex, setCycleIndex] = useState(0);

  // ── Interlude state machine ──────────────────────────────────────
  // Controls the hour-slot flow: dialog → classical → rebroadcast → classical
  //   "dialog"      = first play of segment lines (no indicator)
  //   "interlude"   = classical music fills between dialog runs
  //   "rebroadcast" = same lines again, with PREVIOUSLY RECORDED badge
  //   "interlude-post" = classical resumes after rebroadcast until slot change
  type InterludePhase = "dialog" | "interlude" | "rebroadcast" | "interlude-post";
  const [interludePhase, setInterludePhase] = useState<InterludePhase>("dialog");
  const rebroadcastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [liveMadisonTime, setLiveMadisonTime] = useState<string | null>(null);
  // Dev-only ?at= override read from window.location at mount. When non-null,
  // the HUD clock pins to this value (so the visible clock matches whatever
  // slot the API resolved) and the fetch carries it through. SSR-safe: null
  // until the mount effect runs.
  const [atOverride, setAtOverride] = useState<string | null>(null);
  // Killswitch state. Initialized null so SSR and first client paint match;
  // hydrate from localStorage in the effect below. In prod this is always
  // false (the button isn't rendered, and the toggle effect short-circuits).
  const [killswitchOn, setKillswitchOn] = useState<boolean | null>(null);
  // Sound on/off — localStorage-backed so the preference persists across
  // sessions. Default false (muted); user clicks the speaker icon to enable.
  const [soundEnabled, setSoundEnabled] = useState(false);

  // Daytime detection — true when Madison clock is 07:00–17:59.
  // Gates Purge-night overlays (Tim interrupts, crises, callers, nick cut-ins)
  // so the unmanned daytime broadcast doesn't fire personality-driven events.
  // The 18:00–18:59 hour is COUNTDOWN mode (not daytime) — emergency
  // preparedness broadcasting with survival PSA videos.
  const isDaytime = useMemo(() => {
    const time = liveMadisonTime ?? "12:00";
    const hh = parseInt(time.split(":")[0], 10);
    return hh >= 7 && hh < 18;
  }, [liveMadisonTime]);

  // Daytime interstitial — when a commercial-break or station-id segment
  // arrives while a music-block is playing, we show it as an overlay instead
  // of replacing the music block. This keeps the YouTube iframe alive so the
  // song pauses and resumes instead of restarting from scratch.
  const [daytimeInterstitial, setDaytimeInterstitial] =
    useState<PlayerSegment | null>(null);
  const [interstitialCycleIndex, setInterstitialCycleIndex] = useState(0);

  // Nick cut-in state — he randomly interrupts other hosts to play a song.
  // The API attaches 1-4 `nickCutIns` per interruptible segment; the frontend
  // schedules them at staggered delays and temporarily swaps to MusicBlockLayout.
  const [nickCutIn, setNickCutIn] = useState<NickCutIn | null>(null);
  const [nickCutInPhase, setNickCutInPhase] = useState<"intro" | "playing">(
    "intro",
  );
  const nickCutInTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Fingerprint of the segment whose cut-ins have already been scheduled —
  // prevents re-scheduling on every 60s poll that returns the same segment.
  const nickCutInScheduledFpRef = useRef<string | null>(null);

  // Retro ad break state — real 80s YouTube commercials every ~15 minutes,
  // with in-universe PRGE sponsor text underneath.
  const [retroAd, setRetroAd] = useState<RetroAd | null>(null);
  const retroAdTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retroAdCountRef = useRef(0); // increments each ad for deterministic picks

  // Tim Pepinski emergency broadcast interrupts — full-screen operator alerts.
  const [timInterrupt, setTimInterrupt] = useState<TimInterrupt | null>(null);
  const timInterruptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Caller text-in popups — AIM-style message windows from listeners.
  const [callerPopup, setCallerPopup] = useState<CallerPopupData | null>(null);
  const callerPopupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs tracking active overlay state — setTimeout callbacks read these at
  // fire time to avoid the stale-closure collision bug where an ad fires
  // during a nick cut-in or vice versa.
  const retroAdActiveRef = useRef(false);
  const nickCutInActiveRef = useRef(false);
  const timInterruptActiveRef = useRef(false);
  const activeCrisisRef = useRef<CrisisEvent | null>(null);

  // Host reaction subtitle during Nick cut-ins.
  const [hostReaction, setHostReaction] = useState<HostReaction | null>(null);

  // ── Crisis event system ──────────────────────────────────────────────
  // Multi-minute disruptions: opening Tim alert → active crisis state with
  // updates → resolution. Station breach guaranteed once per night.
  const [activeCrisis, setActiveCrisis] = useState<CrisisEvent | null>(null);
  const [crisisPhase, setCrisisPhase] = useState<"alert" | "active" | "resolving" | null>(null);
  const crisisTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const crisisScheduleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stationBreachFiredRef = useRef(false);

  // Aftermath: permanent ripples from resolved crises. Each entry is a
  // { signalPenalty, tickerItems } that persists for the rest of the night.
  interface CrisisAftermath {
    crisisId: string;
    signalPenalty: number;
    tickerItems: PlayerTickerItem[];
  }
  const [crisisAftermaths, setCrisisAftermaths] = useState<CrisisAftermath[]>([]);

  // ── Purge commencement siren ────────────────────────────────────────
  // At exactly 19:00 Madison, the siren video plays before normal Purge-night
  // operations begin. Session-gated (once per tab) + time-gated (19:00–19:04
  // grace window). Dev panel can force it any time.
  const [purgeSirenActive, setPurgeSirenActive] = useState(false);
  const purgeSirenFiredRef = useRef(false);

  // ── Dead Air ─────────────────────────────────────────────────────────
  // Random 15-45 second blackouts 1-3 per night. Everything goes dark —
  // just static hiss. Tim comes back with a reassurance line.
  // SUPPRESSED during daytime.
  const [deadAirActive, setDeadAirActive] = useState(false);
  const [deadAirDuration, setDeadAirDuration] = useState(25); // seconds
  const deadAirTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deadAirCountRef = useRef(0); // how many have fired this session

  // ── Survivor Board ──────────────────────────────────────────────────
  // Hidden slide-out panel tracking callers and their evolving fate status.
  // Persists to localStorage keyed by Madison date so it survives refresh
  // but resets each new Purge night.
  const SURVIVOR_KEY = "prge-survivors";
  const [survivorBoardOpen, setSurvivorBoardOpen] = useState(false);
  const [trackedCallers, setTrackedCallers] = useState<TrackedCaller[]>([]);
  const survivorTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const survivorHydratedRef = useRef(false);

  // Holds the previous segment fingerprint so we can skip resetting the cycle
  // when /api/segment returns the same cached segment as last poll.
  const prevFingerprintRef = useRef<string | null>(null);

  // Hydrate killswitch from localStorage on mount. Prod skips this entirely.
  useEffect(() => {
    if (!IS_DEV) {
      setKillswitchOn(false);
      return;
    }
    setKillswitchOn(localStorage.getItem(KILLSWITCH_KEY) === "1");
  }, []);

  // ── Broadcast log initialization ───────────────────────────────────
  // Ensure the localStorage event log exists for tonight's broadcast.
  // The beforeunload handler snapshots final signal/viewer state.
  useEffect(() => {
    const time = madisonNowHHMM(new Date());
    ensureLog(time);
  }, []);

  // ── Broadcast log: event tracking effects ────────────────────────
  // Log interesting events when their state transitions to non-null.
  // Using effects is cleaner than scattering logX() in every setTimeout.
  useEffect(() => {
    if (callerPopup) logCaller({ name: callerPopup.name, neighborhood: callerPopup.neighborhood, tone: callerPopup.tone });
  }, [callerPopup]);
  useEffect(() => {
    if (nickCutIn) logNickCutIn({ artist: nickCutIn.track.artist ?? "Unknown", title: nickCutIn.track.title });
  }, [nickCutIn]);
  useEffect(() => {
    if (timInterrupt && !activeCrisis) logTimInterrupt(); // only standalone interrupts, not crisis alerts
  }, [timInterrupt]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (retroAd) logRetroAd();
  }, [retroAd]);
  useEffect(() => {
    if (purgeSirenActive) logSiren();
  }, [purgeSirenActive]);

  // Hydrate sound preference from localStorage on mount.
  useEffect(() => {
    setSoundEnabled(localStorage.getItem(SOUND_KEY) === "1");
  }, []);

  // ── Survivor board persistence ─────────────────────────────────────
  // Hydrate tracked callers from localStorage on mount. Scoped to the
  // current Madison date so data resets each new Purge night.
  // Re-schedules any pending fate transitions that were lost on refresh.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SURVIVOR_KEY);
      if (!raw) { survivorHydratedRef.current = true; return; }
      const saved = JSON.parse(raw) as { nightId: string; callers: TrackedCaller[] };
      // Only restore if it's from tonight's broadcast.
      const tonight = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
      // Accept today or yesterday (Purge crosses midnight).
      const yesterday = new Date(Date.now() - 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
      if (saved.nightId !== tonight && saved.nightId !== yesterday) {
        survivorHydratedRef.current = true;
        return;
      }
      setTrackedCallers(saved.callers);

      // Re-schedule pending fate transitions for callers with remaining queues.
      const timers: ReturnType<typeof setTimeout>[] = [];
      for (const caller of saved.callers) {
        if (caller._fateQueue.length === 0) continue;
        let cumulativeDelay = (60 + Math.random() * 120) * 1000; // first transition 1-3 min after hydrate
        for (const nextFate of caller._fateQueue) {
          const timer = setTimeout(() => {
            const now = liveMadisonTime ?? madisonNowHHMM(new Date());
            setTrackedCallers((prev) =>
              prev.map((c) =>
                c.name === caller.name && c.registeredAt === caller.registeredAt
                  ? { ...c, fate: nextFate, lastUpdate: now, _fateQueue: c._fateQueue.filter((f) => f !== nextFate) }
                  : c,
              ),
            );
          }, cumulativeDelay);
          timers.push(timer);
          cumulativeDelay += (120 + Math.random() * 180) * 1000;
        }
      }
      survivorTimersRef.current.push(...timers);
    } catch {
      // Corrupted data — start fresh.
    }
    survivorHydratedRef.current = true;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Save tracked callers to localStorage whenever they change.
  useEffect(() => {
    if (!survivorHydratedRef.current) return; // don't save during hydration
    try {
      const nightId = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
      localStorage.setItem(SURVIVOR_KEY, JSON.stringify({ nightId, callers: trackedCallers }));
    } catch {
      // localStorage full — degrade silently.
    }
  }, [trackedCallers]);

  // Keep overlay refs in sync for stale-closure-safe collision checks.
  useEffect(() => { retroAdActiveRef.current = retroAd !== null; }, [retroAd]);
  useEffect(() => { nickCutInActiveRef.current = nickCutIn !== null; }, [nickCutIn]);
  useEffect(() => { timInterruptActiveRef.current = timInterrupt !== null; }, [timInterrupt]);
  useEffect(() => { activeCrisisRef.current = activeCrisis; }, [activeCrisis]);

  // Hydrate the dev-only ?at= override from window.location once at mount.
  // Prod silently ignores it (the server-side route also ignores it in prod).
  useEffect(() => {
    if (!IS_DEV) return;
    setAtOverride(readAtOverrideFromLocation());
  }, []);

  // Fetch on mount + every 60s. Only reset cycle on a *new* segment. Skipped
  // entirely when the dev killswitch is engaged so no API calls fire.
  // Wait for killswitch hydration (null → boolean) before starting — otherwise
  // the null→false transition cancels the first in-flight fetch and doubles
  // the cold-cache wait.
  useEffect(() => {
    if (killswitchOn === null) return; // still hydrating from localStorage
    if (killswitchOn) {
      // Killswitch is engaged — skip the fetch but clear the loading state
      // so the page shows fallback content instead of an infinite LoadingPanel.
      setSegment((prev) => prev ?? FALLBACK_SEGMENT);
      setLoading(false);
      return;
    }
    let cancelled = false;

    async function fetchSegment() {
      try {
        // No format param — the API consults the broadcast scheduler and
        // picks the slot-appropriate format itself. Carry ?at= when set so
        // the dev time-travel override flows through to the API.
        const url = atOverride
          ? `/api/segment?at=${encodeURIComponent(atOverride)}`
          : "/api/segment";
        const controller = new AbortController();
        const fetchTimeout = setTimeout(() => controller.abort(), 120_000);
        const res = await fetch(url, { cache: "no-store", signal: controller.signal }).finally(() => clearTimeout(fetchTimeout));
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json: unknown = await res.json();
        if (!isPlayerSegment(json)) {
          throw new Error("Response did not match player segment shape");
        }
        if (cancelled) return;

        const fp = fingerprintOf(json);
        if (fp !== prevFingerprintRef.current) {
          prevFingerprintRef.current = fp;

          // Daytime interstitial intercept: when a music-block is playing and
          // the API returns a commercial-break or station-id, show it as an
          // overlay instead of swapping the segment. This keeps the YouTube
          // iframe alive so the song pauses/resumes instead of restarting.
          const currentIsMusic = segment?.type === "music-block";
          const newIsInterstitial =
            json.type === "commercial-break" || json.type === "station-id";
          if (currentIsMusic && newIsInterstitial && isDaytime) {
            setDaytimeInterstitial(json);
            setInterstitialCycleIndex(0);
          } else {
            setDaytimeInterstitial(null);
            setSegment(json);
            setCycleIndex(0);
          }
        }
        // else: same segment as before — leave segment + cycleIndex untouched
        // so the line cycle doesn't yank back to 0 every 60s on cache hits.
      } catch (err) {
        console.error("[player] segment fetch failed, falling back to mock:", err);
        if (cancelled) return;
        // Only fall back if we have nothing yet — keep showing prior live data otherwise.
        setSegment((prev) => prev ?? FALLBACK_SEGMENT);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchSegment();
    const refetchId = setInterval(fetchSegment, REFETCH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(refetchId);
    };
  }, [killswitchOn, atOverride]);

  function toggleKillswitch() {
    if (!IS_DEV) return;
    setKillswitchOn((prev) => {
      const next = !prev;
      if (next) localStorage.setItem(KILLSWITCH_KEY, "1");
      else localStorage.removeItem(KILLSWITCH_KEY);
      return next;
    });
  }

  function toggleSound() {
    setSoundEnabled((prev) => {
      const next = !prev;
      if (next) localStorage.setItem(SOUND_KEY, "1");
      else localStorage.removeItem(SOUND_KEY);
      return next;
    });
  }

  // Live Madison clock — runs independently of the segment fetch so the HUD
  // time keeps advancing within a slot instead of freezing on
  // segment.inWorldTime (which is a stamp, not a clock).
  //
  // When a dev time-travel override is set (via the overlay or URL ?at=),
  // the clock starts FROM that time and ticks forward in real-time. This
  // lets dev test flows like countdown→19:00 siren transition — the clock
  // advances through the boundary instead of freezing at the jump target.
  // The anchorRef tracks the real-world moment the override was set so we
  // can compute elapsed seconds and add them to the override time.
  const atOverrideAnchorRef = useRef<number | null>(null);

  useEffect(() => {
    if (atOverride !== null) {
      // Anchor = real timestamp when this override was set.
      atOverrideAnchorRef.current = Date.now();
      setLiveMadisonTime(atOverride);

      // Tick forward from the override time at real-world speed.
      const [hStr, mStr] = atOverride.split(":");
      const baseSeconds = parseInt(hStr, 10) * 3600 + parseInt(mStr, 10) * 60;

      const tick = () => {
        const elapsed = Math.floor((Date.now() - atOverrideAnchorRef.current!) / 1000);
        const currentSec = (baseSeconds + elapsed) % 86400;
        const hh = Math.floor(currentSec / 3600);
        const mm = Math.floor((currentSec % 3600) / 60);
        const timeStr = `${hh < 10 ? "0" : ""}${hh}:${mm < 10 ? "0" : ""}${mm}`;
        setLiveMadisonTime(timeStr);
      };

      // Tick every second during dev override so time-boundary transitions
      // (like 18:59→19:00 siren) fire promptly instead of waiting 30s.
      const id = setInterval(tick, 1000);
      return () => clearInterval(id);
    }
    atOverrideAnchorRef.current = null;
    const update = () => setLiveMadisonTime(madisonNowHHMM(new Date()));
    update();
    const id = setInterval(update, HUD_CLOCK_TICK_MS);
    return () => clearInterval(id);
  }, [atOverride]);

  // ── Purge siren detection ───────────────────────────────────────────
  // When Madison time enters the 19:00–19:04 window for the first time this
  // session, fire the commencement siren video. Session-gated so a page
  // refresh at 19:02 doesn't replay it.
  useEffect(() => {
    if (purgeSirenFiredRef.current) return;
    const time = liveMadisonTime ?? "12:00";
    const [hStr, mStr] = time.split(":");
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);

    if (h === 19 && m < 5) {
      const SESSION_KEY = "prge-siren-played-v1";
      if (typeof window !== "undefined" && sessionStorage.getItem(SESSION_KEY) !== "1") {
        sessionStorage.setItem(SESSION_KEY, "1");
        purgeSirenFiredRef.current = true;
        setPurgeSirenActive(true);
      }
    }
  }, [liveMadisonTime]);

  // ── Nick cut-in scheduling ───────────────────────────────────────────
  // When a new segment arrives with nickCutIns, schedule timers to fire them
  // at staggered intervals throughout the hour. Cut-ins are 1-4 per hour
  // depending on how drunk Nick is (the API decides the count).
  useEffect(() => {
    const fp = segment ? fingerprintOf(segment) : null;
    // Already scheduled for this segment — don't re-schedule on 60s polls.
    if (fp === nickCutInScheduledFpRef.current) return;

    // Clear previous timers + active cut-in from the old segment.
    for (const t of nickCutInTimersRef.current) clearTimeout(t);
    nickCutInTimersRef.current = [];
    setNickCutIn(null);
    nickCutInScheduledFpRef.current = fp;

    const cutIns = segment?.nickCutIns;
    if (!cutIns || cutIns.length === 0) return;

    // Stagger cut-ins: first at ~5min, each subsequent ~12min later.
    // ±2min jitter so it doesn't feel mechanical.
    const BASE_DELAY = 5 * 60_000;
    const SPACING = 12 * 60_000;
    const JITTER = 2 * 60_000;

    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < cutIns.length; i++) {
      const target = BASE_DELAY + SPACING * i;
      const jitter = (Math.random() - 0.5) * 2 * JITTER;
      const delay = Math.max(60_000, target + jitter);
      const cutIn = cutIns[i];
      timers.push(
        setTimeout(() => {
          // Don't fire during a retro ad — ref avoids stale closure.
          if (retroAdActiveRef.current) return;
          setNickCutIn(cutIn);
          setNickCutInPhase("intro");
        }, delay),
      );
    }
    nickCutInTimersRef.current = timers;

    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [segment]); // eslint-disable-line react-hooks/exhaustive-deps

  // Transition from intro → playing after Nick's intro lines dwell.
  useEffect(() => {
    if (!nickCutIn || nickCutInPhase !== "intro") return;
    const totalText = nickCutIn.introLines.map((l) => l.text).join(" ");
    const dwellMs = Math.max(5000, Math.min(8000, 3000 + totalText.length * 40));
    const id = setTimeout(() => setNickCutInPhase("playing"), dwellMs);
    return () => clearTimeout(id);
  }, [nickCutIn, nickCutInPhase]);

  // Auto-dismiss playing phase after 90s (track might loop — cut it off).
  useEffect(() => {
    if (!nickCutIn || nickCutInPhase !== "playing") return;
    const id = setTimeout(() => setNickCutIn(null), 90_000);
    return () => clearTimeout(id);
  }, [nickCutIn, nickCutInPhase]);

  // ── Retro ad break scheduling ────────────────────────────────────────
  // Every ~15 minutes, pick a real 80s ad and play it. The ad plays for its
  // full YouTube duration (auto-dismisses on ENDED event). First ad fires
  // ~3 minutes after page load so the user gets settled first.
  useEffect(() => {
    // Don't start scheduling until we have a segment (page is loaded).
    if (!segment) return;

    const AD_INTERVAL = 15 * 60_000; // 15 minutes
    const FIRST_AD_DELAY = 3 * 60_000; // 3 minutes after load

    function fireAd() {
      // Don't interrupt a Nick cut-in — ref avoids stale closure.
      if (nickCutInActiveRef.current) return;
      const count = retroAdCountRef.current++;
      const fp = segment ? fingerprintOf(segment) : "none";
      const ad = pickRetroAd(`${fp}::ad::${count}`);
      setRetroAd(ad);
    }

    // First ad after initial delay.
    const firstTimer = setTimeout(() => {
      fireAd();
      // Then every 15 minutes after that.
      retroAdTimerRef.current = setInterval(fireAd, AD_INTERVAL);
    }, FIRST_AD_DELAY);

    return () => {
      clearTimeout(firstTimer);
      if (retroAdTimerRef.current) clearInterval(retroAdTimerRef.current);
    };
  }, [segment !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Tim Pepinski emergency broadcast scheduling ──────────────────────
  // Random operator interrupts 2-3 times per night. First one after ~8min,
  // subsequent at random intervals (20-40 min). They take priority over
  // everything except the TuneInBoot/PurgeAnnouncement.
  // SUPPRESSED during daytime — Tim's not at the controls.
  useEffect(() => {
    if (!segment || isDaytime) return;

    function scheduleTim() {
      // Random delay: 20-40 minutes between interrupts.
      const delay = (20 + Math.random() * 20) * 60_000;
      timInterruptTimerRef.current = setTimeout(() => {
        // Don't fire during another overlay, active crisis, or existing interrupt.
        if (
          !nickCutInActiveRef.current &&
          !retroAdActiveRef.current &&
          !timInterruptActiveRef.current &&
          !activeCrisisRef.current
        ) {
          setTimInterrupt(pickRandomTimInterrupt());
        }
        scheduleTim();
      }, delay);
    }

    // First interrupt after 8 minutes.
    const firstTimer = setTimeout(() => {
      if (
        !nickCutInActiveRef.current &&
        !retroAdActiveRef.current &&
        !timInterruptActiveRef.current &&
        !activeCrisisRef.current
      ) {
        setTimInterrupt(pickRandomTimInterrupt());
      }
      scheduleTim();
    }, 8 * 60_000);

    return () => {
      clearTimeout(firstTimer);
      if (timInterruptTimerRef.current) clearTimeout(timInterruptTimerRef.current);
    };
  }, [segment !== null, isDaytime]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Caller popup scheduling ─────────────────────────────────────────
  // Random text-in popups from listeners. These layer on top of content
  // (don't replace it). First after ~2 min, then every 3-7 min.
  // SUPPRESSED during daytime — nobody's texting in to an unmanned station.
  useEffect(() => {
    if (!segment || isDaytime) return;

    function scheduleCaller() {
      const delay = (3 + Math.random() * 4) * 60_000; // 3-7 min
      callerPopupTimerRef.current = setTimeout(() => {
        // Don't overlap with a previous popup.
        if (!callerPopup) {
          setCallerPopup(pickRandomCallerPopup());
        }
        scheduleCaller();
      }, delay);
    }

    // First caller after 2 minutes.
    const firstTimer = setTimeout(() => {
      setCallerPopup(pickRandomCallerPopup());
      scheduleCaller();
    }, 2 * 60_000);

    return () => {
      clearTimeout(firstTimer);
      if (callerPopupTimerRef.current) clearTimeout(callerPopupTimerRef.current);
    };
  }, [segment !== null, isDaytime]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Crisis event scheduling ─────────────────────────────────────────
  // Station breach: guaranteed once, fires 25-45 min after load.
  // Random crisis: 0-1 more per night, fires 40-70 min after load (if it
  // fires at all — 50% chance). Won't overlap with an active crisis.
  // SUPPRESSED during daytime — no Purge, no crises.
  useEffect(() => {
    if (!segment || isDaytime) return;

    // Station breach — guaranteed once per night, deep into the broadcast.
    const breachDelay = (25 + Math.random() * 20) * 60_000; // 25-45 min
    const breachTimer = setTimeout(() => {
      if (!stationBreachFiredRef.current && !activeCrisisRef.current) {
        stationBreachFiredRef.current = true;
        startCrisis(getStationBreach());
      }
    }, breachDelay);

    // Random non-breach crisis — 50% chance, earlier in the session.
    const randomDelay = (40 + Math.random() * 30) * 60_000; // 40-70 min
    const randomTimer = setTimeout(() => {
      if (!activeCrisisRef.current && Math.random() < 0.5) {
        startCrisis(pickRandomNonBreachCrisis());
      }
    }, randomDelay);

    return () => {
      clearTimeout(breachTimer);
      clearTimeout(randomTimer);
    };
  }, [segment !== null, isDaytime]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Dead air scheduling ─────────────────────────────────────────────
  // 1-3 blackouts per night at random intervals. First after 12-25 min,
  // then every 25-50 min. Won't fire during other overlays.
  // SUPPRESSED during daytime.
  useEffect(() => {
    if (!segment || isDaytime) return;

    function scheduleDeadAir() {
      // Stop after 3 per session
      if (deadAirCountRef.current >= 3) return;
      const delay = (25 + Math.random() * 25) * 60_000; // 25-50 min between
      deadAirTimerRef.current = setTimeout(() => {
        // Don't fire during another overlay — use refs for stale-closure safety.
        if (
          !nickCutInActiveRef.current &&
          !retroAdActiveRef.current &&
          !timInterruptActiveRef.current &&
          !activeCrisisRef.current
        ) {
          const duration = 15 + Math.floor(Math.random() * 31); // 15-45s
          setDeadAirDuration(duration);
          setDeadAirActive(true);
          deadAirCountRef.current++;
        }
        scheduleDeadAir();
      }, delay);
    }

    // First dead air after 12-25 minutes
    const firstTimer = setTimeout(() => {
      if (
        !nickCutInActiveRef.current &&
        !retroAdActiveRef.current &&
        !timInterruptActiveRef.current &&
        !activeCrisisRef.current
      ) {
        const duration = 15 + Math.floor(Math.random() * 31);
        setDeadAirDuration(duration);
        setDeadAirActive(true);
        deadAirCountRef.current++;
      }
      scheduleDeadAir();
    }, (12 + Math.random() * 13) * 60_000);

    return () => {
      clearTimeout(firstTimer);
      if (deadAirTimerRef.current) clearTimeout(deadAirTimerRef.current);
    };
  }, [segment !== null, isDaytime]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Survivor board: register callers ────────────────────────────────
  // When a caller popup appears, add them to the tracked list with a
  // deterministic fate queue based on tone + time of night.
  useEffect(() => {
    if (!callerPopup) return;
    const madisonTime = liveMadisonTime ?? madisonNowHHMM(new Date());
    const { initialFate, queue, firstDelaySec } = buildFateQueue(
      callerPopup.tone,
      madisonTime,
    );

    const newCaller: TrackedCaller = {
      name: callerPopup.name,
      neighborhood: callerPopup.neighborhood,
      tone: callerPopup.tone,
      fate: initialFate,
      registeredAt: madisonTime,
      lastUpdate: madisonTime,
      _fateQueue: queue,
      _nextTransitionSec: firstDelaySec,
    };

    setTrackedCallers((prev) => [...prev, newCaller]);

    // Schedule fate transitions for this caller
    if (queue.length > 0) {
      let cumulativeDelay = firstDelaySec * 1000;
      const timers: ReturnType<typeof setTimeout>[] = [];

      for (let qi = 0; qi < queue.length; qi++) {
        const nextFate = queue[qi];
        const timer = setTimeout(() => {
          const now = liveMadisonTime ?? madisonNowHHMM(new Date());
          setTrackedCallers((prev) =>
            prev.map((c) =>
              c.name === newCaller.name &&
              c.registeredAt === newCaller.registeredAt
                ? { ...c, fate: nextFate, lastUpdate: now }
                : c,
            ),
          );
        }, cumulativeDelay);
        timers.push(timer);
        // Next transition 2-5 min after the previous
        cumulativeDelay += (120 + Math.random() * 180) * 1000;
      }

      survivorTimersRef.current.push(...timers);
    }
  }, [callerPopup]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clean up survivor timers on unmount
  useEffect(() => {
    return () => {
      survivorTimersRef.current.forEach(clearTimeout);
    };
  }, []);

  // ── Crisis lifecycle management ─────────────────────────────────────
  // When a crisis starts: show opening alert → transition to active state →
  // fire mid-crisis updates on schedule → resolve.
  function startCrisis(crisis: CrisisEvent) {
    // Don't start if another crisis is already active.
    if (activeCrisis) return;

    logCrisis({ id: crisis.id, type: crisis.type, title: crisis.title, severity: crisis.severity });
    setActiveCrisis(crisis);
    setCrisisPhase("alert");

    // Build a fake TimInterrupt for the opening alert.
    setTimInterrupt({
      severity: crisis.severity,
      lines: crisis.openingLines,
    });
  }

  // When the opening Tim alert dismisses, transition to active phase.
  function handleTimAlertComplete() {
    // If this alert was from a crisis, transition to active phase.
    if (activeCrisis && crisisPhase === "alert") {
      setCrisisPhase("active");
      setTimInterrupt(null);

      // Schedule all mid-crisis updates.
      const timers: ReturnType<typeof setTimeout>[] = [];

      activeCrisis.updates.forEach((update) => {
        timers.push(
          setTimeout(() => {
            fireCrisisUpdate(update);
          }, update.delayMs),
        );
      });

      // Schedule resolution at the end of the crisis duration.
      timers.push(
        setTimeout(() => {
          resolveCrisis();
        }, activeCrisis.durationMs),
      );

      crisisTimersRef.current = timers;
    } else {
      // Normal Tim interrupt (not crisis-linked) — just clear it.
      setTimInterrupt(null);
    }
  }

  function fireCrisisUpdate(update: CrisisUpdate) {
    switch (update.type) {
      case "tim-check-in":
        // Show as a Tim emergency alert (shorter, check-in style).
        if (activeCrisis) {
          setTimInterrupt({
            severity: Math.min(2, activeCrisis.severity) as 1 | 2,
            lines: Array.isArray(update.content) ? update.content : [update.content],
          });
        }
        break;
      case "ticker": {
        // Inject as a crisis ticker item — appears immediately in the ticker.
        const tickerText = typeof update.content === "string" ? update.content : update.content[0];
        if (tickerText) {
          const newItem: PlayerTickerItem = { category: "breaking", text: tickerText };
          setCrisisAftermaths((prev) => {
            const existing = prev.find((a) => a.crisisId === "__active__");
            if (existing) {
              return prev.map((a) =>
                a.crisisId === "__active__"
                  ? { ...a, tickerItems: [...a.tickerItems, newItem] }
                  : a,
              );
            }
            return [...prev, { crisisId: "__active__", signalPenalty: 0, tickerItems: [newItem] }];
          });
        }
        break;
      }
      case "caller":
        // Show as a caller popup.
        if (typeof update.content === "string") {
          setCallerPopup({
            name: "Anonymous",
            neighborhood: "Madison",
            message: update.content,
            tone: "scared",
          });
        }
        break;
    }
  }

  function resolveCrisis() {
    if (!activeCrisis) return;

    // Clear update timers.
    crisisTimersRef.current.forEach((id) => clearTimeout(id));
    crisisTimersRef.current = [];

    if (activeCrisis.resolution.type === "tim-alert" && activeCrisis.resolution.lines) {
      // Show resolution as a Tim alert.
      setCrisisPhase("resolving");
      setTimInterrupt({
        severity: 1,
        lines: activeCrisis.resolution.lines,
      });
      // The resolution alert's onComplete will finalize the crisis.
    } else {
      // Fade resolution — just end it.
      finalizeCrisis();
    }
  }

  function finalizeCrisis() {
    if (!activeCrisis) return;

    // Compute aftermath — permanent ripples.
    const aftermathPenalty = Math.round(activeCrisis.signalPenalty * 0.4); // 40% of crisis penalty persists
    const aftermathTicker: PlayerTickerItem[] = [];

    // Generate aftermath ticker items based on crisis type.
    switch (activeCrisis.type) {
      case "fire":
        aftermathTicker.push({
          category: "breaking",
          text: `FIRE AFTERMATH: ${activeCrisis.title.split("—")[0].trim()} — smoke visible across the Isthmus — avoid the area until dawn`,
        });
        break;
      case "gun-violence":
        aftermathTicker.push({
          category: "breaking",
          text: `POST-INCIDENT: ${activeCrisis.title.split("—")[0].trim()} — area remains volatile — shelter in place advisory continues`,
        });
        break;
      case "infrastructure":
        aftermathTicker.push({
          category: "local-news",
          text: `INFRASTRUCTURE: ${activeCrisis.title.split("—")[0].trim()} — no repair crews until after dawn — conserve resources`,
        });
        break;
      case "weather":
        aftermathTicker.push({
          category: "weather",
          text: `WEATHER UPDATE: Conditions stabilizing after ${activeCrisis.title.split("—")[0].trim().toLowerCase()} — damage assessment at sunrise`,
        });
        break;
      case "break-in":
        aftermathTicker.push({
          category: "breaking",
          text: activeCrisis.id === "break-in-station-breach"
            ? "PRGE STATUS: Station secure — broadcast continuing — Tim Peplinski back at controls"
            : `SECURITY: ${activeCrisis.title.split("—")[0].trim()} — residents advised to reinforce entry points`,
        });
        break;
      case "signal":
        aftermathTicker.push({
          category: "local-news",
          text: "SIGNAL: PRGE broadcast recovered — signal strength reduced — stay on current frequency",
        });
        break;
      case "medical":
        aftermathTicker.push({
          category: "breaking",
          text: "MEDICAL: Triage operations distributed across secondary sites — see ticker for locations",
        });
        break;
    }

    // Remove the "__active__" temporary aftermath and add the permanent one.
    setCrisisAftermaths((prev) => [
      ...prev.filter((a) => a.crisisId !== "__active__"),
      {
        crisisId: activeCrisis!.id,
        signalPenalty: aftermathPenalty,
        tickerItems: aftermathTicker,
      },
    ]);

    setActiveCrisis(null);
    setCrisisPhase(null);
    setTimInterrupt(null);
  }

  // ── Host reaction during Nick cut-ins ───────────────────────────────
  // When Nick cuts into a segment, pick a reaction from the interrupted host.
  useEffect(() => {
    if (!nickCutIn || nickCutInPhase !== "playing" || !segment) {
      setHostReaction(null);
      return;
    }
    // Figure out who Nick interrupted.
    const hostId = FORMAT_TO_HOST[segment.type];
    if (!hostId) {
      setHostReaction(null);
      return;
    }
    const reaction = pickRandomHostReaction(hostId);
    setHostReaction(reaction);
  }, [nickCutIn, nickCutInPhase, segment]);

  // ── Signal strength computation ─────────────────────────────────────
  // Drives BroadcastNoise glitch frequency. Field reports, late hours, and
  // active Tim interrupts degrade the signal.
  const signalStrength = useMemo(() => {
    let signal = 100;
    if (!segment) return signal;

    // Format-based degradation.
    if (segment.type === "field-report") signal -= 35;

    // Time-based degradation: signal gets worse as the night deepens.
    const time = segment.inWorldTime ?? liveMadisonTime ?? "19:02";
    const hh = parseInt(time.split(":")[0], 10);
    if (hh >= 0 && hh < 7) {
      // After midnight: degrade progressively. 0:00 = -10, 3:00 = -25, 5:00 = -35.
      signal -= Math.min(35, 10 + hh * 5);
    } else if (hh >= 22) {
      // Late evening: slight degradation.
      signal -= (hh - 21) * 5; // 22:00 = -5, 23:00 = -10
    }

    // Active Tim interrupt — signal is actively under threat.
    if (timInterrupt) signal -= 20;

    // Active crisis — heavy signal degradation during the event.
    if (activeCrisis && crisisPhase === "active") {
      signal -= activeCrisis.signalPenalty;
    }

    // Aftermath penalties — permanent ripples from resolved crises.
    for (const aftermath of crisisAftermaths) {
      signal -= aftermath.signalPenalty;
    }

    return Math.max(5, Math.min(100, signal));
  }, [segment, liveMadisonTime, timInterrupt, activeCrisis, crisisPhase, crisisAftermaths]);

  // ── Broadcast log: beforeunload snapshot ────────────────────────────
  // Ref keeps the closure fresh so the handler always writes current values.
  const signalStrengthRef = useRef(signalStrength);
  useEffect(() => { signalStrengthRef.current = signalStrength; }, [signalStrength]);

  useEffect(() => {
    function onUnload() {
      const time = liveMadisonTime ?? madisonNowHHMM(new Date());
      logSessionEnd(time, signalStrengthRef.current);
    }
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [liveMadisonTime]);

  // ── Broadcast log: segment type tracking ────────────────────────────
  useEffect(() => {
    if (segment) logSegmentType(segment.type);
  }, [segment]);

  // Build the commercial-break unit stream once per segment change.
  const commercialUnits = useMemo<CommercialUnit[]>(() => {
    if (!segment || segment.type !== "commercial-break") return [];
    return buildCommercialUnits(segment.ads ?? [], segment.lines);
  }, [segment]);

  // Cycle length depends on format — commercial-break cycles `units`, every
  // other format cycles `lines`.
  const cycleLength = useMemo(() => {
    if (!segment) return 0;
    if (segment.type === "commercial-break") return commercialUnits.length;
    return segment.lines.length;
  }, [segment, commercialUnits]);

  // Dwell time for the current unit. Wellness extends the floor; commercial
  // ads get a fixed comfortable read time; everything else uses readDurationMs.
  useEffect(() => {
    if (!segment || cycleLength === 0) return;

    let dwellMs: number;
    if (segment.type === "commercial-break") {
      const unit = commercialUnits[cycleIndex];
      if (!unit) return;
      if (unit.kind === "ad") {
        // Ad cards: brand + tagline + body, give the reader real time.
        const text =
          unit.ad.brand + " " + unit.ad.tagline + " " + (unit.ad.body ?? "");
        dwellMs = Math.max(7000, Math.min(14000, 4000 + text.length * 30));
      } else {
        dwellMs = readDurationMs(unit.line.text);
      }
    } else if (segment.type === "wellness") {
      const text = segment.lines[cycleIndex]?.text ?? "";
      dwellMs = wellnessReadDurationMs(text);
    } else {
      const text = segment.lines[cycleIndex]?.text ?? "";
      dwellMs = readDurationMs(text);
    }

    const id = setTimeout(() => {
      setCycleIndex((i) => {
        const next = i + 1;
        // Music blocks and commercial breaks still loop normally.
        // Dialog formats (news, mixed, talk, etc.) stop at the end
        // and transition to the classical interlude.
        if (segment?.type === "music-block" || segment?.type === "commercial-break") {
          return next % cycleLength;
        }
        if (next >= cycleLength) {
          // Dialog exhausted — transition to interlude or post-rebroadcast.
          if (interludePhase === "dialog") {
            setInterludePhase("interlude");
          } else if (interludePhase === "rebroadcast") {
            setInterludePhase("interlude-post");
          }
          return i; // hold on last line
        }
        return next;
      });
    }, dwellMs);
    return () => clearTimeout(id);
  }, [segment, cycleIndex, cycleLength, commercialUnits, interludePhase]);

  // ── Interlude → rebroadcast scheduling ────────────────────────────
  // When the first dialog ends and interlude starts, schedule the
  // rebroadcast after 15-20 minutes of classical.
  useEffect(() => {
    if (interludePhase === "interlude") {
      const delay = (15 + Math.random() * 5) * 60_000; // 15-20 min
      rebroadcastTimerRef.current = setTimeout(() => {
        setCycleIndex(0);
        setInterludePhase("rebroadcast");
      }, delay);
      return () => {
        if (rebroadcastTimerRef.current) clearTimeout(rebroadcastTimerRef.current);
      };
    }
  }, [interludePhase]);

  // Reset interlude state when a new segment loads (new slot).
  // The fingerprint-based check in fetchSegment already resets cycleIndex to 0.
  // We piggyback on that by resetting interlude when cycleIndex goes to 0
  // AND the phase isn't already "dialog".
  const prevInterludeSegRef = useRef<string | null>(null);
  useEffect(() => {
    if (!segment) return;
    const fp = (segment as unknown as Record<string, unknown>).slotKey as string | undefined;
    const key = fp ?? segment.segmentTitle ?? "";
    if (prevInterludeSegRef.current !== null && prevInterludeSegRef.current !== key) {
      // New slot — reset the interlude state machine.
      setInterludePhase("dialog");
      if (rebroadcastTimerRef.current) {
        clearTimeout(rebroadcastTimerRef.current);
        rebroadcastTimerRef.current = null;
      }
    }
    prevInterludeSegRef.current = key;
  }, [segment]);

  // Build classical playlist for the current slot.
  const classicalPlaylist = useMemo(() => {
    if (!segment) return [];
    const slotKey = (segment as unknown as Record<string, unknown>).slotKey as string | undefined;
    const madisonDate = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
    return classicalPlaylistForSlot(slotKey ?? "00:00", madisonDate);
  }, [segment]);

  // Is the interlude (classical music) currently the active content?
  const classicalActive = interludePhase === "interlude" || interludePhase === "interlude-post";

  // Classical should pause for any overlay event.
  const classicalPaused =
    !!retroAd || !!nickCutIn || !!timInterrupt || !!activeCrisis || deadAirActive || purgeSirenActive;

  // Daytime interstitial auto-cycle — runs through all content ONCE, then
  // dismisses so the music block resumes. Single-pass, not looping.
  const interstitialUnits = useMemo<CommercialUnit[]>(() => {
    if (!daytimeInterstitial || daytimeInterstitial.type !== "commercial-break")
      return [];
    return buildCommercialUnits(
      daytimeInterstitial.ads ?? [],
      daytimeInterstitial.lines,
    );
  }, [daytimeInterstitial]);

  useEffect(() => {
    if (!daytimeInterstitial) return;

    let dwellMs: number;
    let cycleLen: number;

    if (daytimeInterstitial.type === "commercial-break") {
      cycleLen = interstitialUnits.length;
      const unit = interstitialUnits[interstitialCycleIndex];
      if (!unit) {
        setDaytimeInterstitial(null);
        return;
      }
      if (unit.kind === "ad") {
        const text =
          unit.ad.brand + " " + unit.ad.tagline + " " + (unit.ad.body ?? "");
        dwellMs = Math.max(7000, Math.min(14000, 4000 + text.length * 30));
      } else {
        dwellMs = readDurationMs(unit.line.text);
      }
    } else {
      // station-id
      cycleLen = daytimeInterstitial.lines.length;
      const text =
        daytimeInterstitial.lines[interstitialCycleIndex]?.text ?? "";
      dwellMs = readDurationMs(text);
    }

    const id = setTimeout(() => {
      const nextIdx = interstitialCycleIndex + 1;
      if (nextIdx >= cycleLen) {
        // Done — dismiss interstitial, music resumes.
        setDaytimeInterstitial(null);
      } else {
        setInterstitialCycleIndex(nextIdx);
      }
    }, dwellMs);

    return () => clearTimeout(id);
  }, [daytimeInterstitial, interstitialCycleIndex, interstitialUnits]);

  // Dev-only regen handler. Swaps the segment in place, resets the cycle, and
  // updates the fingerprint so the next 60s poll doesn't immediately overwrite
  // this freshly-regenerated segment with whatever the cache returns.
  // Also pins the HUD clock to the segment's inWorldTime so the dev panel's
  // time-travel (jump / FF / regen) syncs the top-left clock readout and the
  // countdown timer. Without this, liveMadisonTime stays on the real clock and
  // the countdown shows the wrong remaining time.
  function handleRegen(next: PlayerSegment) {
    prevFingerprintRef.current = fingerprintOf(next);
    setSegment(next);
    setCycleIndex(0);
  }

  const currentLine: PlayerLine | undefined = segment?.lines[cycleIndex];
  // Surface the segment fingerprint so BroadcastNoise can fire a channel-change
  // burst whenever the segment flips. Null until the first segment lands so the
  // boot/noise sequencing stays in lockstep.
  const segmentFingerprint = segment ? fingerprintOf(segment) : null;
  const tickerItems: PlayerTickerItem[] =
    daytimeInterstitial?.tickerItems ?? segment?.tickerItems ?? [];
  // Merge in crisis aftermath ticker items (permanent ripples from resolved events).
  const allTickerItems = useMemo(() => {
    const aftermathItems = crisisAftermaths.flatMap((a) => a.tickerItems);
    return aftermathItems.length > 0 ? [...tickerItems, ...aftermathItems] : tickerItems;
  }, [tickerItems, crisisAftermaths]);
  const tickerLoop = useMemo(
    () => [...allTickerItems, ...allTickerItems, ...allTickerItems],
    [allTickerItems],
  );

  // Prefer the live wall-clock-derived time; fall back to segment stamp (only
  // matters for the very first render before the live-clock effect ticks) and
  // finally to the hardcoded "19:02" sign-on stamp.
  const madisonTime = liveMadisonTime ?? segment?.inWorldTime ?? "19:02";
  const segmentTitle =
    daytimeInterstitial?.segmentTitle ?? segment?.segmentTitle ?? "";

  // Route the center area to a format-specific layout.
  function renderCenter() {
    if (loading && !segment) {
      return <LoadingPanel />;
    }
    if (!segment) return null;

    // Nick cut-in takes over the center area temporarily.
    if (nickCutIn) {
      if (nickCutInPhase === "intro") {
        // Quick flash of Nick's intro line(s) before the player loads.
        return (
          <div className="max-w-3xl mx-auto text-center">
            <div className="text-sm tracking-widest text-amber-400 mb-6 uppercase">
              [CUT-IN] {HOST_LABEL.nick}
            </div>
            {nickCutIn.introLines.map((line, i) => (
              <p
                key={i}
                className="text-2xl md:text-4xl font-mono text-green-100 mb-4 leading-relaxed"
              >
                &ldquo;{line.text}&rdquo;
              </p>
            ))}
          </div>
        );
      }
      // 'playing' phase — full music player with the cut-in track.
      return (
        <div className="relative w-full">
          <MusicBlockLayout
            lines={nickCutIn.track.lines ?? []}
            lineIndex={0}
            tracks={[nickCutIn.track]}
          />
          {/* Host reaction subtitle — low-opacity aside from the interrupted host */}
          {hostReaction && (
            <div className="text-center mt-4 text-sm text-green-300/40 italic font-mono animate-pulse">
              <span className="text-pink-400/40 text-xs tracking-widest uppercase mr-2">
                {HOST_LABEL[hostReaction.host as keyof typeof HOST_LABEL] ?? hostReaction.host}
              </span>
              {hostReaction.text}
            </div>
          )}
        </div>
      );
    }

    // Classical interlude — ambient music fills between dialog runs.
    // Only for dialog formats (not music-block, commercial-break, countdown).
    if (
      classicalActive &&
      segment.type !== "music-block" &&
      segment.type !== "commercial-break" &&
      segment.type !== "countdown" &&
      !isDaytime
    ) {
      return (
        <ClassicalInterlude
          playlist={classicalPlaylist}
          paused={classicalPaused}
        />
      );
    }

    // Retro ad break during non-music formats — full takeover, nothing to pause.
    if (retroAd && segment.type !== "music-block") {
      return <RetroAdBreak ad={retroAd} onComplete={() => setRetroAd(null)} />;
    }

    // Music block — always rendered at the SAME tree position so React never
    // unmounts/remounts the component (which would destroy the YouTube iframe
    // and lose playback position). Overlays (retro ads, daytime interstitials)
    // render on top; the music block hides off-screen and pauses.
    if (segment.type === "music-block") {
      const tracks: PlayerTrack[] = segment.tracks ?? [];
      const musicPaused = !!retroAd || !!daytimeInterstitial || purgeSirenActive || deadAirActive;

      // Determine overlay content (if any).
      let overlay: React.ReactNode = null;
      if (retroAd) {
        overlay = (
          <RetroAdBreak ad={retroAd} onComplete={() => setRetroAd(null)} />
        );
      } else if (daytimeInterstitial) {
        overlay =
          daytimeInterstitial.type === "commercial-break" ? (
            <CommercialBreakLayout
              unit={interstitialUnits[interstitialCycleIndex]}
              cycleIndex={interstitialCycleIndex}
            />
          ) : (
            <DefaultLayout
              current={
                daytimeInterstitial.lines[
                  interstitialCycleIndex % daytimeInterstitial.lines.length
                ]
              }
              lineIndex={interstitialCycleIndex}
            />
          );
      }

      return (
        <>
          {/* Overlay renders as a fixed fullscreen layer ON TOP of the music
              block. The music block wrapper div below NEVER changes CSS — no
              position/visibility/display toggles — because toggling
              position:fixed on a div containing an iframe can cause Chrome to
              tear down the compositing layer and reload the iframe. Instead
              the overlay simply covers it with bg-black. z-[15] sits above
              the content area (z-10) but below the HUD/ticker (z-20). */}
          {overlay && (
            <div className="fixed inset-0 z-[15] bg-black flex items-center justify-center px-8 pt-24 pb-24">
              {overlay}
            </div>
          )}
          {/* MusicBlockLayout always at this tree position. The wrapper div's
              className never changes — only the `paused` prop controls audio
              and timer state. The overlay covers it visually; aria-hidden
              removes it from the a11y tree during ads. */}
          <div aria-hidden={musicPaused || undefined}>
            <MusicBlockLayout
              lines={segment.lines}
              lineIndex={cycleIndex}
              tracks={tracks}
              paused={musicPaused}
            />
          </div>
        </>
      );
    }

    // Countdown mode — pre-Purge emergency preparedness (18:00-19:00).
    // If the countdown segment has video tracks, render them in
    // MusicBlockLayout (same iframe player). Otherwise, text-only PSAs
    // in the dedicated CountdownLayout with the big ticking clock.
    if (segment.type === "countdown") {
      const countdownTracks: PlayerTrack[] = segment.tracks ?? [];
      if (countdownTracks.length > 0) {
        // Video PSA mode — reuse MusicBlockLayout for the iframe player,
        // but the CountdownLayout clock renders above it. Pause during
        // siren so the PSA video doesn't bleed audio through the overlay.
        return (
          <div className="w-full max-w-3xl mx-auto space-y-6">
            <CountdownLayout
              current={currentLine}
              lineIndex={cycleIndex}
              madisonTime={madisonTime}
            />
            <MusicBlockLayout
              lines={segment.lines}
              lineIndex={cycleIndex}
              tracks={countdownTracks}
              paused={purgeSirenActive}
            />
          </div>
        );
      }
      // Text-only PSA mode — no videos, just the clock and cycling PSAs.
      return (
        <CountdownLayout
          current={currentLine}
          lineIndex={cycleIndex}
          madisonTime={madisonTime}
        />
      );
    }

    switch (segment.type) {
      case "wellness":
        return <WellnessLayout current={currentLine} lineIndex={cycleIndex} />;
      case "commercial-break": {
        const unit = commercialUnits[cycleIndex];
        return <CommercialBreakLayout unit={unit} cycleIndex={cycleIndex} />;
      }
      case "field-report":
        return <FieldReportLayout current={currentLine} lineIndex={cycleIndex} />;
      default:
        // news / late-night-talk / mixed / sign-on / sign-off / operator-cutin /
        // station-id / sports / weather
        return <DefaultLayout current={currentLine} lineIndex={cycleIndex} />;
    }
  }

  return (
    <main className="prge-frame min-h-screen relative bg-black text-green-200 font-mono">
      {/* CRT overlays — present on every format */}
      <div className="prge-scanlines pointer-events-none fixed inset-0 z-40" />
      <div className="prge-vignette pointer-events-none fixed inset-0 z-30" />

      {/* Broadcast-realism: snow burst on segment change + ambient flickers.
          Signal strength drives glitch intensity — degrades during field reports,
          late hours, and active Tim interrupts. */}
      <BroadcastNoise segmentFingerprint={segmentFingerprint} signalStrength={signalStrength} />

      {/* Tim Pepinski emergency broadcast — full-screen overlay.
          Routes through crisis lifecycle when a crisis is active. */}
      {timInterrupt && (
        <EmergencyAlert
          interrupt={timInterrupt}
          onComplete={() => {
            if (activeCrisis && crisisPhase === "alert") {
              // Opening alert done → transition to active crisis state.
              handleTimAlertComplete();
            } else if (activeCrisis && crisisPhase === "resolving") {
              // Resolution alert done → finalize the crisis.
              finalizeCrisis();
            } else {
              // Normal Tim interrupt or mid-crisis check-in — just dismiss.
              setTimInterrupt(null);
            }
          }}
          soundEnabled={soundEnabled}
        />
      )}

      {/* Crisis indicator — persistent pulsing bar during active crisis */}
      {activeCrisis && crisisPhase === "active" && (
        <CrisisIndicator
          type={activeCrisis.type}
          title={activeCrisis.title}
          severity={activeCrisis.severity}
        />
      )}

      {/* Caller text-in popup — AIM-style layered on top of content */}
      {callerPopup && (
        <CallerPopup
          caller={callerPopup}
          onComplete={() => setCallerPopup(null)}
        />
      )}

      {/* Dawn countdown — appears from 4am onward, ticking to sunrise */}
      <DawnCountdown inWorldTime={madisonTime} />

      {/* First-load tune-in boot. SessionStorage-gated; click to skip. */}
      <TuneInBoot />

      {/* Canonical Purge EBS announcement. Sits at z-[79] under TuneInBoot
          (z-[80]) so it's already in place when the boot fades out, filling
          the segment-fetch window. SessionStorage-gated; click to skip. */}
      <PurgeAnnouncement />

      {/* Purge commencement siren — plays at 19:00 Madison before normal
          operations begin. z-[70] sits below the boot overlays but above
          all regular content. Auto-dismisses when the video ends. */}
      {purgeSirenActive && (
        <PurgeSiren onComplete={() => setPurgeSirenActive(false)} />
      )}

      {/* Dead air — scheduled silence event. Full blackout + static hiss.
          z-[85] sits above everything except boot overlays. */}
      {deadAirActive && (
        <DeadAir
          durationSec={deadAirDuration}
          onComplete={() => setDeadAirActive(false)}
          soundEnabled={soundEnabled}
        />
      )}

      {/* Survivor board — slide-out panel tracking caller fates */}
      <SurvivorBoard
        isOpen={survivorBoardOpen}
        onClose={() => setSurvivorBoardOpen(false)}
        callers={trackedCallers}
        madisonTime={madisonTime}
      />

      {/* Top HUD strip */}
      <div className="fixed top-0 inset-x-0 z-20 px-6 py-4 flex justify-between items-start text-xs tracking-widest">
        <div className="text-green-400">
          <div className="flex items-center gap-4 flex-wrap">
            <span>
              <span className="text-pink-400 mr-2">&#9679;</span>
              MADISON &middot; {madisonTime}
            </span>
            <ViewerCount inWorldTime={madisonTime} />
          </div>
          <NextUpChip />
        </div>
        <div className="flex items-center gap-4">
          {trackedCallers.length > 0 && (
            <button
              type="button"
              onClick={() => setSurvivorBoardOpen((o) => !o)}
              className="text-green-700 hover:text-green-400 transition-colors text-[10px] tracking-widest cursor-pointer"
              title="Open Survivor Board"
            >
              SURVIVORS ({trackedCallers.length})
            </button>
          )}
          <button
            type="button"
            onClick={toggleSound}
            className="text-green-600 hover:text-green-400 transition-colors text-[10px] tracking-widest cursor-pointer"
            title={soundEnabled ? "Mute audio" : "Unmute audio"}
          >
            {soundEnabled ? "\uD83D\uDD0A" : "\uD83D\uDD07"}
          </button>
          {isDaytime && (
            <Link
              href="/morning-after"
              className="text-amber-600 hover:text-amber-300 transition-colors text-[10px] tracking-widest"
            >
              MORNING AFTER
            </Link>
          )}
          <Link
            href="/about"
            className="text-green-600 hover:text-green-400 transition-colors text-[10px] tracking-widest"
          >
            ABOUT
          </Link>
          {IS_DEV ? (
            <button
              type="button"
              onClick={toggleKillswitch}
              className={
                killswitchOn
                  ? "prge-killswitch-dead font-bold cursor-pointer"
                  : "prge-killswitch-live font-bold cursor-pointer hover:text-amber-300 transition-colors"
              }
              title={
                killswitchOn
                  ? "Killswitch ENGAGED — click to resume polling"
                  : "Click to KILL local polling (stops Anthropic calls)"
              }
            >
              PRGE &middot; {killswitchOn ? "DEAD" : "LIVE"}
            </button>
          ) : (
            <div className="text-amber-400 font-bold">PRGE &middot; LIVE</div>
          )}
        </div>
      </div>


      {/* Center — format-specific render. Natural flow so tall layouts
          (music-block iframe, full sign-off cast) push the page down and
          become scrollable instead of clipping off-screen. min-h-screen +
          flex-center keeps short content visually centered when it fits;
          pt/pb clear the fixed top HUD and bottom newsticker. */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-8 pt-24 pb-24">
        {renderCenter()}
      </div>

      {/* PREVIOUSLY RECORDED badge — shown during rebroadcast phase */}
      {interludePhase === "rebroadcast" && (
        <div className="fixed top-20 right-4 z-[25] flex items-center gap-2 px-3 py-1.5 border border-amber-700/40 bg-black/80">
          <span className="w-2 h-2 rounded-full bg-amber-500/70 animate-pulse" />
          <span className="text-amber-500/80 text-[10px] tracking-[0.3em] font-mono">
            PREVIOUSLY RECORDED
          </span>
        </div>
      )}

      {/* Dev-only regen overlay. The NODE_ENV check here lets the bundler
          tree-shake the import in production builds. */}
      {process.env.NODE_ENV !== "production" && segment && (
        <RegenOverlay
          segment={segment}
          onRegen={handleRegen}
          onTriggerNickCutIn={() => {
            const cutIn = pickRandomNickCutIn();
            setNickCutIn(cutIn);
            setNickCutInPhase("intro");
          }}
          onTriggerRetroAd={() => {
            const ad = pickRandomRetroAd();
            setRetroAd(ad);
          }}
          onTriggerTimInterrupt={() => {
            setTimInterrupt(pickRandomTimInterrupt());
          }}
          onTriggerCallerPopup={() => {
            setCallerPopup(pickRandomCallerPopup());
          }}
          onTriggerCrisis={() => {
            if (!activeCrisis) {
              startCrisis(pickRandomCrisisEvent());
            }
          }}
          onTriggerTextAd={() => {
            // Build a random commercial-break segment from the daytime brand
            // pool and show it as an interstitial overlay. Uses a random cache
            // key so each click produces a different ad selection.
            const adSegment = buildStaticDaytimeCommercial(
              `dev-text-ad::${Date.now()}`,
            ) as unknown as PlayerSegment;
            setDaytimeInterstitial(adSegment);
            setInterstitialCycleIndex(0);
          }}
          onTriggerCountdown={() => {
            // Build a static countdown segment and swap it in as the main
            // segment. Uses "18:30" as the simulated Madison time so the
            // countdown shows ~30 min to Purge.
            const raw = buildStaticCountdownSegment(
              `dev-countdown::${Date.now()}`,
              "18:30",
            );
            const countdownSegment = {
              ...raw,
              inWorldTime: "18:30",
              segmentTitle: "Pre-Purge Countdown",
            } as unknown as PlayerSegment;
            prevFingerprintRef.current = fingerprintOf(countdownSegment);
            setSegment(countdownSegment);
            setCycleIndex(0);
            setAtOverride("18:30"); // pin HUD clock to match countdown
          }}
          onTriggerSiren={() => {
            setPurgeSirenActive(true);
          }}
          onTriggerDeadAir={() => {
            const duration = 15 + Math.floor(Math.random() * 31);
            setDeadAirDuration(duration);
            setDeadAirActive(true);
          }}
          onTriggerSurvivorBoard={() => {
            setSurvivorBoardOpen((o) => !o);
          }}
          onTimeTravel={(overrideTime) => {
            // Pin or unpin the HUD clock + countdown timer. Reuses the
            // existing atOverride mechanism so the clock effect and
            // segment fetcher stay in sync with the dev panel's time.
            setAtOverride(overrideTime);
          }}
        />
      )}

      {/* Newsticker, bottom — present on every format */}
      <div className="fixed bottom-0 inset-x-0 z-20 h-14 bg-black/80 border-t border-green-700 overflow-hidden flex items-center">
        <div className="prge-ticker flex whitespace-nowrap text-sm">
          {tickerLoop.map((item, i) => (
            <span key={i} className="px-10 text-green-300">
              <span className="text-pink-400 font-bold mr-2">
                [{CATEGORY_LABEL[item.category] ?? item.category.toUpperCase()}]
              </span>
              {item.text}
            </span>
          ))}
        </div>
      </div>
    </main>
  );
}
