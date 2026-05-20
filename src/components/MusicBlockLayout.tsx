"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  HOST_LABEL,
  readDurationMs,
  type PlayerLine,
  type PlayerTrack,
} from "./player-types";

interface Props {
  /** Top-level segment lines. Used as a FALLBACK when a track has no
   *  per-track `lines` field (legacy v1 cache rows generated before the
   *  band-fact rebuild). For v2 segments this is typically empty —
   *  primary content lives inside each track's `lines` array. */
  lines: PlayerLine[];
  /** Parent's read-cycle index. Used only for the decorative progress strip's
   *  "alive" shimmer — NOT for picking the displayed line. */
  lineIndex: number;
  tracks: PlayerTrack[];
  /** When true, pause YouTube playback and freeze line cycling. Used by
   *  the parent to pause music during ad breaks / overlays without
   *  unmounting the component (which would destroy the iframe and lose
   *  the playback position). */
  paused?: boolean;
  /** Called when the last track in the playlist ends. Used by Nick cut-ins
   *  to dismiss when the song finishes instead of looping. */
  onPlaylistEnd?: () => void;
}

// Spotify open-search URL. We don't bother with the embed iframe here: Doc is
// the only person who'll click this, and it works as a back-channel to his
// account where the YouTube embed cannot.
function buildSpotifySearchUrl(track: PlayerTrack): string {
  const query = `${track.artist} ${track.title}`;
  return `https://open.spotify.com/search/${encodeURIComponent(query)}`;
}

// YouTube search-results URL. Fallback for the (very common) case where the
// embed iframe's autoplay-search returns "video unavailable" — labels disable
// embedding on official uploads, so the iframe chokes while youtube.com itself
// plays the same video fine. Clicking this lands the viewer on the search
// results page where they can pick the working version.
function buildYouTubeSearchUrl(track: PlayerTrack): string {
  const query = `${track.artist} ${track.title}`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

// Segmented progress strip — twelve cells lit in proportion to the real
// currentTime / duration ratio reported by the YouTube iframe. Falls back to
// a single lit cell when duration isn't known yet (early in the resolve cycle).
function ProgressStrip({
  currentTime,
  duration,
}: {
  currentTime: number;
  duration: number;
}) {
  const total = 12;
  const ratio =
    duration > 0 ? Math.max(0, Math.min(1, currentTime / duration)) : 0;
  const lit = duration > 0 ? Math.round(ratio * total) : 1;
  const cells = Array.from({ length: total }, (_, i) => i < lit);
  return (
    <div className="flex gap-[2px] h-[10px] w-full" aria-hidden>
      {cells.map((on, i) => (
        <div
          key={i}
          className={
            "flex-1 " +
            (on
              ? "bg-amber-400/90 shadow-[0_0_4px_rgba(255,170,0,0.6)]"
              : "bg-amber-900/40 border border-amber-700/40")
          }
        />
      ))}
    </div>
  );
}

// Faux-spectrogram visualization. We can't actually tap iframe audio (cross-
// origin), so this is a deterministic-pseudorandom-bar dance driven by the
// player state and currentTime. Animated only when PLAYING; collapses to a
// flat baseline when paused/buffering/standby so the UI honestly reflects
// "audio isn't moving right now." 16 bars across, height noise via sin().
// ── Oscilloscope waveform ─────────────────────────────────────────────
// CRT heartbeat-monitor style. SVG path with layered sine waves that
// scroll left-to-right, driven by tick + currentTime so the waveform
// evolves with the song. Flatlines when stopped, gentle blip when
// buffering, full complex waveform when playing.

const WAVE_POINTS = 128; // sample resolution across the SVG width
const WAVE_W = 600;      // viewBox width
const WAVE_H = 60;       // viewBox height
const WAVE_MID = WAVE_H / 2;

function Spectrogram({
  playerState,
  currentTime,
}: {
  playerState: number;
  currentTime: number;
}) {
  const playing = playerState === YT_STATE.PLAYING;
  const buffering = playerState === YT_STATE.BUFFERING;
  const stopped = !playing && !buffering;

  // ~30fps tick while active. Drives the wave scroll.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (stopped) return;
    const fps = playing ? 33 : 60; // slower tick when buffering
    const id = window.setInterval(() => setTick((t) => t + 1), fps);
    return () => window.clearInterval(id);
  }, [playing, stopped]);

  // Build the SVG path string for this frame.
  const pathD = useMemo(() => {
    if (stopped) {
      // Flatline with a single tiny blip in the center — "signal present, no audio."
      const pts: string[] = [`M 0 ${WAVE_MID}`];
      for (let i = 0; i <= WAVE_POINTS; i++) {
        const x = (i / WAVE_POINTS) * WAVE_W;
        const pos = i / WAVE_POINTS;
        // Tiny center bump so it's not a perfectly dead line.
        const bump = Math.exp(-((pos - 0.5) ** 2) * 200) * 3;
        pts.push(`L ${x.toFixed(1)} ${(WAVE_MID - bump).toFixed(1)}`);
      }
      return pts.join(" ");
    }

    if (buffering) {
      // Slow regular blips — alive, waiting for data.
      const pts: string[] = [`M 0 ${WAVE_MID}`];
      const t = tick * 0.04;
      for (let i = 0; i <= WAVE_POINTS; i++) {
        const x = (i / WAVE_POINTS) * WAVE_W;
        const pos = i / WAVE_POINTS;
        // Repeating sharp blips scrolling right.
        const phase = (pos * 4 - t) % 1;
        const blip = phase > 0 && phase < 0.15
          ? Math.sin(phase / 0.15 * Math.PI) * 8
          : 0;
        pts.push(`L ${x.toFixed(1)} ${(WAVE_MID - blip).toFixed(1)}`);
      }
      return pts.join(" ");
    }

    // ── Playing: complex multi-harmonic waveform ─────────────────────
    const t = tick * 0.055;
    const song = currentTime * 0.8;
    const pts: string[] = [`M 0 ${WAVE_MID}`];

    // Per-frame random seeds — these shift every tick so the wave never
    // repeats exactly. Math.random() is intentional: we WANT true
    // randomness here, not deterministic noise.
    const jitterSeed = Math.random() * 100;
    const ampDrift = 0.7 + Math.random() * 0.6;      // 0.7–1.3 overall energy
    const freqWobble = 0.9 + Math.random() * 0.2;    // ±10% frequency drift
    const beatIntensity = 0.5 + Math.random() * 1.0;  // beats vary in punch

    // Harmonic amplitude drift — each harmonic randomly gains/loses
    // energy frame-to-frame so the waveform character shifts.
    const fundAmp = (8 + Math.random() * 6) * ampDrift;     // 8–14 base
    const harm2Amp = (3 + Math.random() * 5) * ampDrift;    // 3–8
    const harm3Amp = (1 + Math.random() * 4) * ampDrift;    // 1–5
    const subAmp = (4 + Math.random() * 5) * ampDrift;      // 4–9

    for (let i = 0; i <= WAVE_POINTS; i++) {
      const pos = i / WAVE_POINTS; // 0..1 across width
      const x = pos * WAVE_W;

      // Per-point micro-jitter — tiny random displacement so the line
      // has organic texture instead of perfect mathematical curves.
      const pointJitter = (Math.random() - 0.5) * 2.5;

      // Base waveform — scrolling sine at the "fundamental frequency."
      const fundamental = Math.sin((pos * 8 * freqWobble - t * 1.2 + song) * Math.PI * 2) * fundAmp;

      // Second harmonic — faster, lower amplitude, slight phase offset.
      const harm2 = Math.sin((pos * 14 * freqWobble - t * 1.8 + song * 1.3 + jitterSeed * 0.1) * Math.PI * 2) * harm2Amp;

      // Third harmonic — high frequency shimmer.
      const harm3 = Math.sin((pos * 22 * freqWobble - t * 2.6 + song * 1.7 + jitterSeed * 0.2) * Math.PI * 2) * harm3Amp;

      // Sub-bass swell — very slow, wide undulation.
      const sub = Math.sin((pos * 2.5 - t * 0.3 + song * 0.4) * Math.PI * 2) * subAmp;

      // Beat spikes — sharp transients shaped like a heartbeat QRS complex.
      // Beat rate drifts randomly so it doesn't feel metronomic.
      const beatRate = 2.5 + Math.sin(t * 0.13 + jitterSeed) * 1.2; // 1.3–3.7 beats across width
      const beatPhase = ((pos * beatRate - t * 0.7 + song * 0.5) % 1 + 1) % 1;
      let beat = 0;
      if (beatPhase < 0.04) {
        beat = (beatPhase / 0.04) * 14 * beatIntensity;
      } else if (beatPhase < 0.08) {
        beat = (14 - ((beatPhase - 0.04) / 0.04) * 22) * beatIntensity;
      } else if (beatPhase < 0.14) {
        beat = (-8 + ((beatPhase - 0.08) / 0.06) * 8) * beatIntensity;
      }

      // Amplitude envelope — drifts unpredictably across the width.
      const envelope = 0.6 + Math.sin(pos * 3.5 + t * 0.2 + song * 0.3 + jitterSeed * 0.05) * 0.35
        + Math.sin(pos * 7 + t * 0.5) * 0.1;

      const y = WAVE_MID - (fundamental + harm2 + harm3 + sub + beat + pointJitter) * envelope;
      const clamped = Math.max(2, Math.min(WAVE_H - 2, y));
      pts.push(`L ${x.toFixed(1)} ${clamped.toFixed(1)}`);
    }

    return pts.join(" ");
  }, [tick, currentTime, playing, buffering, stopped]);

  // Glow intensity — brighter when playing, dim when idle.
  const glowFilter = playing
    ? "drop-shadow(0 0 4px rgba(251, 191, 36, 0.7)) drop-shadow(0 0 8px rgba(251, 191, 36, 0.3))"
    : buffering
      ? "drop-shadow(0 0 3px rgba(251, 191, 36, 0.4))"
      : "none";

  return (
    <div className="w-full" aria-hidden>
      <svg
        viewBox={`0 0 ${WAVE_W} ${WAVE_H}`}
        preserveAspectRatio="none"
        className="w-full h-[36px]"
        style={{ filter: glowFilter }}
      >
        {/* Faint center reference line — the "zero crossing." */}
        <line
          x1="0" y1={WAVE_MID} x2={WAVE_W} y2={WAVE_MID}
          stroke="rgba(251, 191, 36, 0.12)"
          strokeWidth="0.5"
        />
        {/* The waveform itself. */}
        <path
          d={pathD}
          fill="none"
          stroke={
            playing
              ? "rgba(251, 191, 36, 0.9)"   // amber-400
              : buffering
                ? "rgba(251, 191, 36, 0.45)"
                : "rgba(251, 191, 36, 0.2)"
          }
          strokeWidth={playing ? "1.5" : "1"}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

// Resolution state for the current track. We model the three terminal states
// explicitly so the chrome can render distinct status text + the iframe area
// knows which payload (embed URL, 404, or spinner) to show.
//
// `durationSec` on the ready variant is the YouTube-reported track length in
// seconds, or null when unknown (legacy cache rows or scraper entries that
// shipped without a duration). The track-advance timer uses this when known
// and falls back to TRACK_DWELL_FALLBACK_MS when null.
type ResolveState =
  | { status: "resolving" }
  | {
      status: "ready";
      embedUrl: string;
      durationSec: number | null;
      videoId: string;
      resolvedChannel: string;
      source: "api" | "scraper";
    }
  | { status: "not-found" }
  | { status: "error" };

// Response shape from /api/track. Loose because the route can also return
// error objects; the component narrows by status code. `durationSec` is
// always present in the 200 body (route normalizes legacy undefined → null);
// we still type it optionally to be defensive against future shape drift.
interface TrackApiResponse {
  videoId?: string;
  embedUrl?: string;
  durationSec?: number | null;
  resolvedChannel?: string;
  source?: "api" | "scraper";
}

// YouTube iframe player states. Mirrors YT.PlayerState enum.
const YT_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

// Live data we pull off the iframe via postMessage. All fields default to
// neutral/zero so the chrome can render before the first infoDelivery arrives.
interface YtLiveState {
  playerState: number;
  currentTime: number;
  duration: number;
  playbackQuality: string;
}

const YT_LIVE_DEFAULT: YtLiveState = {
  playerState: YT_STATE.UNSTARTED,
  currentTime: 0,
  duration: 0,
  playbackQuality: "",
};

/** Human label for a YT player state — drives the SIGNAL readout. */
function signalLabelForState(state: number): string {
  switch (state) {
    case YT_STATE.PLAYING:
      return "NOMINAL";
    case YT_STATE.BUFFERING:
      return "BUFFER";
    case YT_STATE.PAUSED:
      return "HOLD";
    case YT_STATE.ENDED:
      return "EOS";
    case YT_STATE.CUED:
      return "READY";
    default:
      return "STANDBY";
  }
}

/** Compact quality label — translates YT's "hd720"/"large"/etc. to a 3-char
 *  readout that fits the chrome's tight letterspacing. */
function qualityLabel(q: string): string {
  switch (q) {
    case "hd2160":
      return "4K";
    case "hd1440":
      return "1440P";
    case "hd1080":
      return "1080P";
    case "hd720":
      return "720P";
    case "large":
      return "480P";
    case "medium":
      return "360P";
    case "small":
      return "240P";
    case "tiny":
      return "144P";
    default:
      return q ? q.toUpperCase() : "AUTO";
  }
}

// Music-block: an Alien (1979) / Nostromo MU-TH-UR "media unit" framing around
// a YouTube iframe. The iframe is the actual playback surface; the chrome
// around it is industrial-utilitarian future-retro tech-flavor.
//
// Embed resolution: instead of building a YouTube search-list URL (which
// autoplays the top hit but breaks on embed-disabled official uploads), we
// hit /api/track to resolve { artist, title } to a concrete videoId server-
// side, picking from the top 5 results to dodge the most common embed blocks.
// The route caches resolutions to disk so this only costs a network round-
// trip the first time a track appears.
//
// Line cycling — v2 (band-fact rebuild):
//   - Each track owns its OWN `lines` array (intro + 2-5 fact lines).
//   - When the track advances, the layout switches to that track's lines.
//   - During a single track, a separate timer cycles through that track's
//     lines at readDurationMs() pace and LOOPS within the track's lines
//     until the track-advance timer fires.
//   - Fallback for legacy v1 cache rows: if a track has no `lines` field,
//     we fall back to the flat top-level `lines[trackIndex % lines.length]`
//     (one line per track, the v1 mapping). This keeps old cached segments
//     renderable without forcing a cache wipe.
//
// Dwell is per-track: when /api/track returns a `durationSec` we use it (so a
// 90-second song advances at 90s, a 5-minute song at 5min). When duration is
// unknown we fall back to the legacy 2-minute timer. Bounds guard against
// pathological extremes:
//   - Floor at 30s so a mis-resolved 5-second clip doesn't strobe through the
//     playlist.
//   - Ceiling at 8min so an accidentally-resolved hour-long live stream or
//     extended cut doesn't hang the block.
const TRACK_DWELL_FALLBACK_MS = 120_000; // unknown duration → 2 minutes
const TRACK_DWELL_MIN_MS = 30_000; // clamp floor: 30s
const TRACK_DWELL_MAX_MS = 480_000; // clamp ceiling: 8 minutes

/**
 * Compute the timeout window for advancing off the current track. Returns
 * the fallback when duration is unknown; otherwise clamps known duration
 * into [TRACK_DWELL_MIN_MS, TRACK_DWELL_MAX_MS].
 */
function computeDwellMs(durationSec: number | null): number {
  if (durationSec === null || !Number.isFinite(durationSec) || durationSec <= 0) {
    return TRACK_DWELL_FALLBACK_MS;
  }
  const ms = durationSec * 1000;
  if (ms < TRACK_DWELL_MIN_MS) return TRACK_DWELL_MIN_MS;
  if (ms > TRACK_DWELL_MAX_MS) return TRACK_DWELL_MAX_MS;
  return ms;
}

/** Format a duration in seconds as "M:SS" or "H:MM:SS". */
function formatDuration(durationSec: number): string {
  const total = Math.max(0, Math.floor(durationSec));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${ss}`;
  }
  return `${m}:${ss}`;
}

export function MusicBlockLayout({ lines, lineIndex, tracks, paused = false, onPlaylistEnd }: Props) {
  // Track cycling lives independently from line cycling so a 3-minute song
  // isn't yanked off-screen every 8 seconds when the line cycle advances.
  const [trackIndex, setTrackIndex] = useState(0);

  // Per-track line cursor — which line WITHIN the current track's lines is
  // currently on screen. Resets to 0 every time the track changes.
  const [lineWithinTrackIndex, setLineWithinTrackIndex] = useState(0);

  // Stable content key for the tracks array. Reference equality changes every
  // 60s poll (fresh JSON parse), but the actual track list stays identical
  // within a slot. This key only flips when the real track content changes
  // (new segment, regen, or slot transition), preventing the "10-second song
  // restart" bug where trackIndex reset to 0 on every poll cycle.
  const tracksContentKey = useMemo(
    () => tracks.map((t) => `${t.artist}::${t.title}`).join("|"),
    [tracks],
  );

  // Reset both indices to 0 whenever the tracks CONTENT changes (i.e. a new
  // music-block segment loads, not just a poll refresh). The per-track advance
  // timer lives in its own effect below — see the dwell-driven setTimeout.
  useEffect(() => {
    setTrackIndex(0);
    setLineWithinTrackIndex(0);
  }, [tracksContentKey]);

  // Reset the within-track cursor whenever the track advances. The cursor
  // re-walks the new track's lines from line 0.
  useEffect(() => {
    setLineWithinTrackIndex(0);
  }, [trackIndex]);

  // Pick the currently-spinning track. Clamp by % length to survive any
  // out-of-bounds index from rapid re-renders.
  const track =
    tracks.length > 0 ? tracks[trackIndex % tracks.length] : undefined;

  // Resolve the array of lines for the current track. v2 schema: each track
  // owns a `lines` field. v1 fallback: when the track has no `lines` field
  // (legacy cache), fall back to the flat top-level `lines[trackIndex]` as
  // a single-element array — the old one-line-per-track mapping. We compute
  // the fallback as an array (rather than a single line) so the line-cycling
  // effect below can treat both shapes identically.
  //
  // Memoized so the line-cycling effect's array dependency stays stable across
  // unrelated re-renders (e.g. parent's lineIndex tick). Without memoization
  // the fallback path builds a new [lines[i]] array each render and re-fires
  // the effect, clearing the in-flight timer before it can land.
  const trackLines: PlayerLine[] = useMemo(() => {
    if (track?.lines && track.lines.length > 0) return track.lines;
    if (lines.length > 0) return [lines[trackIndex % lines.length]];
    return [];
  }, [track, lines, trackIndex]);

  // Pick the currently-displayed line. Cycles within trackLines via the
  // lineWithinTrackIndex cursor (advanced by the effect below).
  const displayedLine: PlayerLine | undefined =
    trackLines.length > 0
      ? trackLines[lineWithinTrackIndex % trackLines.length]
      : undefined;

  // Within-track line cycle. While a track plays, walk through its own
  // lines at readDurationMs() pace and LOOP back to line 0 when the cursor
  // overruns trackLines.length. This effect re-runs every time the cursor
  // advances, scheduling the NEXT advance from the just-displayed line.
  //
  // The trackIndex effect above owns resetting the cursor on track change,
  // so this effect stays focused on "advance when the current line's read
  // time elapses." Single-line tracks skip the schedule entirely (no cycle
  // needed).
  useEffect(() => {
    if (trackLines.length <= 1) return;
    if (paused) return; // freeze line cycling during ad breaks
    const current = trackLines[lineWithinTrackIndex % trackLines.length];
    if (!current) return;
    const dwellMs = readDurationMs(current.text);
    const id = window.setTimeout(() => {
      setLineWithinTrackIndex((i) => (i + 1) % trackLines.length);
    }, dwellMs);
    return () => {
      window.clearTimeout(id);
    };
  }, [lineWithinTrackIndex, trackLines, paused]);

  // 1-indexed track counter for the "03 / 06" readout.
  const trackNumber =
    tracks.length > 0 ? (trackIndex % tracks.length) + 1 : 0;
  const trackTotal = tracks.length;
  const trackNumberStr = String(trackNumber).padStart(2, "0");
  const trackTotalStr = String(trackTotal).padStart(2, "0");

  const [resolveState, setResolveState] = useState<ResolveState>({
    status: "resolving",
  });

  // Track which artist/title we're currently resolving so a late-arriving
  // response from a stale fetch doesn't clobber the newer one. Without this,
  // rapid track changes can land out of order.
  const inflightKeyRef = useRef<string | null>(null);

  // Live telemetry pulled from the YouTube iframe via postMessage. Drives
  // SIGNAL / progress strip / spectrogram / quality readouts. Resets to
  // default when the track changes (new iframe instance → new state stream).
  const [ytLive, setYtLive] = useState<YtLiveState>(YT_LIVE_DEFAULT);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // When the track flips, zero out live state so we don't show the prior
  // track's currentTime/duration for a beat before the new iframe boots.
  useEffect(() => {
    setYtLive(YT_LIVE_DEFAULT);
  }, [track?.artist, track?.title]);

  // YouTube iframe postMessage listener. We subscribe to the player's
  // infoDelivery stream (sent ~every 250ms by the embed once we've sent the
  // "listening" message). Each delivery carries playerState/currentTime/
  // duration/playbackQuality. Origin check guards against spoofed messages
  // from other frames on the page.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== "https://www.youtube.com") return;
      // Only process events from OUR iframe — ignore events from other
      // YouTube iframes on the page (RetroAdBreak, ClassicalInterlude, etc.).
      // Without this, an ad's ENDED event gets misread as "our track ended"
      // and the track advances prematurely after every ad break.
      if (e.source !== iframeRef.current?.contentWindow) return;
      let data: unknown;
      if (typeof e.data === "string") {
        try {
          data = JSON.parse(e.data);
        } catch {
          return;
        }
      } else {
        data = e.data;
      }
      if (!data || typeof data !== "object") return;
      const d = data as Record<string, unknown>;
      if (d.event === "infoDelivery" && d.info && typeof d.info === "object") {
        const info = d.info as Record<string, unknown>;
        setYtLive((prev) => ({
          playerState:
            typeof info.playerState === "number"
              ? info.playerState
              : prev.playerState,
          currentTime:
            typeof info.currentTime === "number"
              ? info.currentTime
              : prev.currentTime,
          duration:
            typeof info.duration === "number" && info.duration > 0
              ? info.duration
              : prev.duration,
          playbackQuality:
            typeof info.playbackQuality === "string"
              ? info.playbackQuality
              : prev.playbackQuality,
        }));
      } else if (d.event === "onStateChange" && typeof d.info === "number") {
        setYtLive((prev) => ({ ...prev, playerState: d.info as number }));
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // After the iframe loads, ping it with "listening" + "addEventListener"
  // commands so it starts emitting infoDelivery + onStateChange events. Also
  // explicitly kick playVideo — autoplay=1 in the URL usually does this, but
  // a programmatic nudge helps Chrome's media autoplay policy decide we mean
  // it (especially on track changes within a session).
  function handleIframeLoad() {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    // Subscribe channel — must come first per YT iframe API protocol.
    win.postMessage(
      JSON.stringify({ event: "listening", id: iframeKey, channel: "widget" }),
      "https://www.youtube.com",
    );
    win.postMessage(
      JSON.stringify({
        event: "command",
        func: "addEventListener",
        args: ["onStateChange"],
      }),
      "https://www.youtube.com",
    );
    // Belt-and-suspenders playback nudge — skip if parent says paused
    // (e.g. ad break started before iframe finished loading).
    if (!paused) {
      win.postMessage(
        JSON.stringify({ event: "command", func: "playVideo", args: [] }),
        "https://www.youtube.com",
      );
    }
  }

  // Pause/resume the YouTube iframe when the parent toggles `paused`.
  // Sends pauseVideo/playVideo commands via postMessage. This lets ad
  // breaks pause music without unmounting the component (which would
  // destroy the iframe and lose the playback position).
  //
  // We send the command twice with a small delay — YouTube iframes
  // sometimes drop the first postMessage if they're mid-state-transition
  // (e.g. buffering). The retry is cheap insurance.
  const pausedRef = useRef(paused);
  useEffect(() => {
    // Skip the initial mount — handleIframeLoad handles first playback.
    if (pausedRef.current === paused) return;
    pausedRef.current = paused;
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    const func = paused ? "pauseVideo" : "playVideo";
    const cmd = JSON.stringify({ event: "command", func, args: [] });
    win.postMessage(cmd, "https://www.youtube.com");
    // Retry after 200ms in case the first command was dropped.
    const retryId = setTimeout(() => {
      win.postMessage(cmd, "https://www.youtube.com");
    }, 200);
    // When resuming from pause, clear any stale ENDED state that may
    // have arrived from the ad iframe (pre-fix) or from the track
    // genuinely ending during the pause window.
    if (!paused) {
      setYtLive((prev) =>
        prev.playerState === YT_STATE.ENDED
          ? { ...prev, playerState: YT_STATE.PAUSED }
          : prev,
      );
    }
    return () => clearTimeout(retryId);
  }, [paused]);

  // Autoplay unlock — Chrome blocks unmuted autoplay until a user gesture.
  // The iframe loads behind TuneInBoot (z-80 overlay) and tries autoplay=1
  // before the user has clicked anything → Chrome silently blocks it. Once
  // TuneInBoot is clicked (or any other interaction), this listener fires
  // and re-sends playVideo. The user gesture unlocks autoplay for the
  // session, so the command succeeds and music starts immediately.
  //
  // {once: true} so it doesn't fire on every subsequent click. The effect
  // re-runs on each track change (resolveState.status "resolving"→"ready"
  // cycle), adding a fresh listener per track as a safety net.
  useEffect(() => {
    if (resolveState.status !== "ready") return;
    if (paused) return;

    function retryPlay() {
      const win = iframeRef.current?.contentWindow;
      if (!win) return;
      win.postMessage(
        JSON.stringify({ event: "command", func: "playVideo", args: [] }),
        "https://www.youtube.com",
      );
    }

    document.addEventListener("click", retryPlay, { once: true });
    document.addEventListener("keydown", retryPlay, { once: true });

    return () => {
      document.removeEventListener("click", retryPlay);
      document.removeEventListener("keydown", retryPlay);
    };
  }, [resolveState.status, paused]);

  // Visibility API — pause when the tab is hidden, resume when visible.
  // Handles alt-tab, switching browser tabs, etc. Skips when already
  // paused by the parent (ad break, siren, etc.) to avoid fighting
  // with the parent's pause/resume logic.
  const visibilityPausedRef = useRef(false);
  useEffect(() => {
    function onVisibility() {
      const win = iframeRef.current?.contentWindow;
      if (!win) return;
      if (document.hidden) {
        // Only send pause if not already paused by parent.
        if (!pausedRef.current) {
          visibilityPausedRef.current = true;
          win.postMessage(
            JSON.stringify({ event: "command", func: "pauseVideo", args: [] }),
            "https://www.youtube.com",
          );
        }
      } else if (visibilityPausedRef.current) {
        visibilityPausedRef.current = false;
        // Only resume if parent hasn't paused us in the meantime.
        if (!pausedRef.current) {
          win.postMessage(
            JSON.stringify({ event: "command", func: "playVideo", args: [] }),
            "https://www.youtube.com",
          );
        }
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (!track) return;
    const key = `${track.artist}::${track.title}`;
    inflightKeyRef.current = key;

    // Pre-resolved videoId (countdown PSA videos) — skip the /api/track
    // round-trip entirely. Build the embed URL directly.
    if (track.videoId) {
      const origin = typeof window !== "undefined" ? `&origin=${encodeURIComponent(window.location.origin)}` : "";
      const embedUrl = `https://www.youtube.com/embed/${encodeURIComponent(track.videoId)}?autoplay=1&controls=1&disablekb=1&modestbranding=1&rel=0&fs=0&iv_load_policy=3&enablejsapi=1${origin}`;
      const durationSec =
        typeof track.durationSec === "number" && Number.isFinite(track.durationSec)
          ? track.durationSec
          : null;
      setResolveState({
        status: "ready",
        embedUrl,
        durationSec,
        videoId: track.videoId,
        resolvedChannel: track.artist,
        source: "api",
      });
      return;
    }

    setResolveState({ status: "resolving" });

    const controller = new AbortController();
    const params = new URLSearchParams({
      artist: track.artist,
      title: track.title,
    });
    fetch(`/api/track?${params.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        // 404 = no video found. Distinct UX from a transport error.
        if (res.status === 404) {
          if (inflightKeyRef.current === key) {
            setResolveState({ status: "not-found" });
          }
          return;
        }
        if (!res.ok) {
          if (inflightKeyRef.current === key) {
            setResolveState({ status: "error" });
          }
          return;
        }
        const data = (await res.json()) as TrackApiResponse;
        if (inflightKeyRef.current !== key) return;
        if (data.embedUrl && data.videoId) {
          // Normalize undefined → null so the ready variant always carries a
          // typed sentinel (no second `undefined` case for the timer to worry
          // about). Anything non-numeric is treated as unknown.
          const durationSec =
            typeof data.durationSec === "number" && Number.isFinite(data.durationSec)
              ? data.durationSec
              : null;
          // Append origin= for YouTube postMessage API reliability.
          const originParam = typeof window !== "undefined"
            ? `&origin=${encodeURIComponent(window.location.origin)}`
            : "";
          const embedUrlWithOrigin = data.embedUrl.includes("origin=")
            ? data.embedUrl
            : `${data.embedUrl}${originParam}`;
          setResolveState({
            status: "ready",
            embedUrl: embedUrlWithOrigin,
            durationSec,
            videoId: data.videoId,
            resolvedChannel: data.resolvedChannel ?? "UNKNOWN",
            source: data.source ?? "scraper",
          });
        } else {
          setResolveState({ status: "not-found" });
        }
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (inflightKeyRef.current === key) {
          setResolveState({ status: "error" });
        }
      });

    return () => {
      controller.abort();
    };
  }, [track?.artist, track?.title, track?.videoId]);

  // Per-track advance timer. We schedule a single setTimeout whose duration
  // is derived from the resolved track's `durationSec` (clamped) and clear
  // it on every dependency change.
  //
  // Why setTimeout, not setInterval:
  //   - The interval period changes per track (a 90-second song vs a 5-minute
  //     song use different timers).
  //   - Manual advances (REGEN, scheduler) and array swaps must invalidate
  //     the pending fire — easier to reason about with single-shot timers.
  //
  // Race-condition handling: this effect re-runs whenever the current track
  // identity changes (artist+title), whenever its resolution lands (status
  // and durationSec move), or whenever the tracks array length changes. The
  // cleanup clears the prior timer so an in-flight timer from a previous
  // track never fires. This mirrors the inflightKeyRef pattern on the
  // resolver side.
  //
  // We skip scheduling entirely for 0-or-1-track segments (no rotation to do)
  // and while we're still resolving (timer should kick off the *resolved*
  // duration, not the resolving stub). For not-found / error, we fall back
  // to the default dwell so the block doesn't stall on a dead track.
  const resolveStatus = resolveState.status;
  const readyDurationSec =
    resolveState.status === "ready" ? resolveState.durationSec : null;
  useEffect(() => {
    if (tracks.length <= 1) return;
    if (resolveStatus === "resolving") return;
    // Freeze track-advance during ad breaks. The timer restarts from scratch
    // when paused flips back to false (effect re-runs), which is fine — the
    // song resumes at the same playback position (iframe stays alive) and
    // gets a fresh full-duration window.
    if (paused) return;
    // The fallback timer is now a SAFETY NET. Primary track-advance comes
    // from the YT iframe firing playerState=ENDED (handled in its own effect
    // below). We add a 20% buffer to the API-reported duration here so the
    // ENDED event gets the chance to fire first; the fallback only kicks in
    // when YT silently drops the END event (embed-blocked, network drop,
    // etc.). On a resolution failure with no duration we fall back to the
    // hardcoded 2-minute dwell.
    const baseMs =
      resolveStatus === "ready"
        ? computeDwellMs(readyDurationSec)
        : TRACK_DWELL_FALLBACK_MS;
    const fallbackMs = Math.min(TRACK_DWELL_MAX_MS, Math.round(baseMs * 1.2));
    const id = window.setTimeout(() => {
      setTrackIndex((i) => (i + 1) % tracks.length);
    }, fallbackMs);
    return () => {
      window.clearTimeout(id);
    };
  }, [
    tracks.length,
    trackIndex,
    resolveStatus,
    readyDurationSec,
    track?.artist,
    track?.title,
    paused,
  ]);

  // Primary track-advance trigger: YT iframe fires playerState=ENDED when the
  // current track finishes. Advance immediately instead of waiting for the
  // duration-based fallback. Guard against firing on the initial CUED/UNSTARTED
  // states (which aren't ENDED) and against single-track segments.
  //
  // Debounce: when Track 0's iframe tears down and Track 1's loads, a stale
  // ENDED postMessage from the old iframe can arrive and set ytLive.playerState
  // back to ENDED, double-advancing the track. The lastAdvanceRef timestamp
  // gates this — we ignore ENDED events within 5s of the last advance.
  const lastAdvanceRef = useRef(0);
  useEffect(() => {
    if (paused) return; // don't advance tracks during ad breaks
    if (ytLive.playerState !== YT_STATE.ENDED) return;
    const now = Date.now();
    if (now - lastAdvanceRef.current < 5_000) return;
    lastAdvanceRef.current = now;
    // Single-track playlist (nick cut-in) — notify parent instead of looping.
    if (tracks.length <= 1) {
      if (onPlaylistEnd) onPlaylistEnd();
      return;
    }
    setTrackIndex((i) => (i + 1) % tracks.length);
  }, [ytLive.playerState, tracks.length, paused, onPlaylistEnd]);

  if (!track && tracks.length === 0) return null;

  const spotifyUrl = track ? buildSpotifySearchUrl(track) : null;
  const youtubeSearchUrl = track ? buildYouTubeSearchUrl(track) : null;
  // Stable re-mount key — when this changes, React tears down the iframe and
  // mounts a new one, which is the only reliable way to retrigger autoplay.
  const iframeKey = track ? `${track.artist}::${track.title}` : "empty";

  // Status pill text. Prefer the live YT playerState when we have it; fall
  // back to the resolve-state pre-iframe labels so the chrome reads correctly
  // during RESOLVING / NOT FOUND / ERROR.
  let statusLabel: string;
  if (resolveState.status === "ready") {
    statusLabel = signalLabelForState(ytLive.playerState);
  } else if (resolveState.status === "resolving") {
    statusLabel = "RESOLVING";
  } else if (resolveState.status === "not-found") {
    statusLabel = "NO MATCH";
  } else {
    statusLabel = "FAULT";
  }

  // Track length readout. Prefer live-reported duration once the iframe has
  // sent its first infoDelivery; fall back to the API-reported value before
  // that lands. Returns null when neither source has a value.
  const effectiveDurationSec =
    ytLive.duration > 0
      ? ytLive.duration
      : resolveState.status === "ready"
        ? resolveState.durationSec
        : null;
  const trackDurationLabel =
    effectiveDurationSec !== null ? formatDuration(effectiveDurationSec) : null;

  // Real-time playhead readout — only shown once the iframe has reported a
  // currentTime > 0 so we don't display "0:00 / X:XX" while the video is
  // still cold.
  const currentTimeLabel =
    ytLive.currentTime > 0 ? formatDuration(ytLive.currentTime) : null;

  // Header path — bake real telemetry into the MU-TH-UR breadcrumb so it
  // reflects the actual resolved video / resolution source.
  const headerPath =
    resolveState.status === "ready"
      ? `MU-TH-UR 6000 // YT.${resolveState.videoId.slice(0, 6).toUpperCase()} // ${resolveState.source.toUpperCase()}`
      : "MU-TH-UR 6000 // MEDIA / TRACK / NOW";

  // Footer telemetry — channel name + resolution-source pill, both real.
  const channelLabel =
    resolveState.status === "ready"
      ? resolveState.resolvedChannel.toUpperCase()
      : null;
  const sourceLabel =
    resolveState.status === "ready" ? resolveState.source.toUpperCase() : null;

  // XFR label flips with player state — ACTIVE while playing, HOLD when
  // paused, SYNC while buffering. Tells the user the readout means something.
  let xfrLabel = "XFR STANDBY";
  if (resolveState.status === "ready") {
    if (ytLive.playerState === YT_STATE.PLAYING) xfrLabel = "XFR ACTIVE";
    else if (ytLive.playerState === YT_STATE.BUFFERING) xfrLabel = "XFR SYNC";
    else if (ytLive.playerState === YT_STATE.PAUSED) xfrLabel = "XFR HOLD";
    else if (ytLive.playerState === YT_STATE.ENDED) xfrLabel = "XFR EOS";
    else xfrLabel = "XFR READY";
  }

  return (
    <div className="max-w-3xl w-full space-y-6">
      {track ? (
        <div className="prge-alien-media-unit relative bg-black/70 px-4 py-4 sm:px-6 sm:py-5">
          {/* Stencil header row: unit label + breadcrumb path (real video ID /
              resolution source) + live status pill. */}
          <div className="flex items-center justify-between gap-3 mb-3 text-[10px] sm:text-[11px] tracking-[0.22em] font-bold uppercase">
            <span className="text-amber-300 prge-alien-glow">&#9658; MEDIA UNIT</span>
            <span className="text-amber-400/85 hidden sm:inline prge-alien-glow-soft tabular-nums">
              {headerPath}
            </span>
            <span className="text-amber-200 flex items-center gap-2 prge-alien-glow">
              <span className="prge-alien-amber-pulse inline-block w-2.5 h-2.5 bg-amber-300" />
              {statusLabel}
            </span>
          </div>

          {/* Track readout: title, artist, year, and the counter. */}
          <div className="flex items-end justify-between gap-4 mb-3">
            <div className="min-w-0 flex-1">
              <div className="text-amber-200 text-xs tracking-[0.2em] uppercase mb-1 prge-alien-glow-soft">
                TRACK&nbsp;:
              </div>
              <div className="text-amber-50 text-xl md:text-2xl font-bold leading-tight uppercase tracking-wide truncate prge-alien-glow">
                {track.title}
              </div>
              <div className="text-amber-200 text-sm md:text-base tracking-widest uppercase mt-1 prge-alien-glow-soft">
                {track.artist}
                {track.year ? (
                  <span className="text-amber-400/85">{` \u2215\u2215 ${track.year}`}</span>
                ) : null}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-amber-400/85 text-[10px] tracking-[0.22em] uppercase prge-alien-glow-soft">
                INDEX
              </div>
              <div className="text-amber-100 text-2xl md:text-3xl font-bold tabular-nums leading-none mt-1 prge-alien-glow">
                {trackNumberStr}
                <span className="text-amber-400/85"> / {trackTotalStr}</span>
              </div>
              {trackDurationLabel ? (
                <div className="text-amber-300 text-[11px] tracking-[0.22em] tabular-nums uppercase mt-1.5 prge-alien-glow-soft">
                  {currentTimeLabel
                    ? `${currentTimeLabel} / ${trackDurationLabel}`
                    : trackDurationLabel}
                </div>
              ) : null}
            </div>
          </div>

          {/* Real-time playback progress + state-driven SIGNAL/XFR readouts +
              faux-spectrogram. All three are driven by YT iframe telemetry. */}
          <div className="mb-4 space-y-2">
            <ProgressStrip
              currentTime={ytLive.currentTime}
              duration={effectiveDurationSec ?? 0}
            />
            <Spectrogram
              playerState={ytLive.playerState}
              currentTime={ytLive.currentTime}
            />
            <div className="flex items-center justify-between mt-1 text-[9px] sm:text-[10px] tracking-[0.22em] text-amber-300 uppercase prge-alien-glow-soft">
              <span>SIGNAL // {statusLabel}</span>
              <span
                className={
                  ytLive.playerState === YT_STATE.PLAYING
                    ? "prge-alien-flicker"
                    : ""
                }
              >
                {xfrLabel}
              </span>
            </div>
          </div>

          {/* Bezeled iframe. The container provides the chamfered amber frame
              via clip-path; the inner panel is the actual viewport. */}
          <div className="prge-alien-bezel p-[10px]">
            <div className="prge-alien-bezel-inner relative bg-black w-full overflow-hidden">
              <div
                className="relative w-full"
                style={{ paddingBottom: "56.25%" }}
              >
                {resolveState.status === "ready" ? (
                  <iframe
                    key={iframeKey}
                    ref={iframeRef}
                    src={resolveState.embedUrl}
                    title={`${track.title} — ${track.artist}`}
                    allow="autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                    loading="lazy"
                    onLoad={handleIframeLoad}
                    className="absolute inset-0 w-full h-full border-0"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
                    {resolveState.status === "resolving" ? (
                      <>
                        <div className="prge-alien-flicker text-amber-300 text-sm sm:text-base tracking-[0.32em] uppercase font-bold">
                          RESOLVING...
                        </div>
                        <div className="mt-2 text-amber-500/70 text-[10px] sm:text-[11px] tracking-[0.24em] uppercase">
                          QUERY // {track.artist}
                        </div>
                      </>
                    ) : resolveState.status === "not-found" ? (
                      <>
                        <div className="text-amber-400 text-sm sm:text-base tracking-[0.32em] uppercase font-bold">
                          TRACK NOT FOUND
                        </div>
                        <div className="mt-2 text-amber-500/70 text-[10px] sm:text-[11px] tracking-[0.24em] uppercase">
                          NO MATCH // USE OUTBOUND FEED
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-amber-400 text-sm sm:text-base tracking-[0.32em] uppercase font-bold">
                          SIGNAL ERROR
                        </div>
                        <div className="mt-2 text-amber-500/70 text-[10px] sm:text-[11px] tracking-[0.24em] uppercase">
                          RETRY // OR USE OUTBOUND FEED
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stencil footer: real channel/source telemetry + quality readout
              + external-link back-channels. */}
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-[10px] tracking-[0.22em] text-amber-300 uppercase order-2 sm:order-1 prge-alien-glow-soft truncate max-w-full sm:max-w-[60%]">
              {channelLabel && sourceLabel ? (
                <>
                  UPLINK // {channelLabel} // SRC:{sourceLabel}
                  {ytLive.playbackQuality
                    ? ` // ${qualityLabel(ytLive.playbackQuality)}`
                    : ""}
                </>
              ) : (
                <>CHANNEL 02 // OUTBOUND FEED // YT-S</>
              )}
            </div>
            <div className="order-1 sm:order-2 flex items-center gap-2">
              {youtubeSearchUrl ? (
                <a
                  href={youtubeSearchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="prge-alien-button inline-flex items-center justify-center gap-2 px-3 py-1.5 text-[11px] tracking-[0.22em] font-bold uppercase text-amber-200 hover:text-amber-100"
                >
                  <span>&#9654;</span>
                  <span>YOUTUBE</span>
                </a>
              ) : null}
              {spotifyUrl ? (
                <a
                  href={spotifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="prge-alien-button inline-flex items-center justify-center gap-2 px-3 py-1.5 text-[11px] tracking-[0.22em] font-bold uppercase text-amber-200 hover:text-amber-100"
                >
                  <span>&#9654;</span>
                  <span>SPOTIFY</span>
                </a>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {displayedLine ? (
        // Key combines trackIndex + within-track cursor so the line
        // fade-animates on EVERY line change (both intra-track cycling and
        // track-change transitions). Only this inner element remounts on
        // key change; the iframe above stays mounted, so within-track
        // line cycling does NOT yank playback.
        <div
          key={`${trackIndex}::${lineWithinTrackIndex}`}
          className="prge-line"
        >
          <div className="text-amber-400 text-xs uppercase tracking-[0.22em] mb-3 text-center font-bold">
            {HOST_LABEL[displayedLine.host] ?? displayedLine.host.toUpperCase()}
          </div>
          <div className="text-amber-100 text-lg md:text-xl leading-snug text-center font-light italic">
            &ldquo;{displayedLine.text}&rdquo;
          </div>
        </div>
      ) : null}
    </div>
  );
}
