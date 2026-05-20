"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  CALLER_POOL,
  type CallerPopup,
} from "@/lib/caller-popups";
import {
  type CrisisEvent,
  pickRandomNonBreachCrisis,
} from "@/lib/crisis-events";
import type { PlayerSegment, PlayerTrack } from "@/components/player-types";
import {
  MadisonMap,
  type CrisisPin as MapCrisisPin,
  type CallerPin as MapCallerPin,
  type NeighborhoodDarkness as MapNeighborhoodDarkness,
} from "@/components/MadisonMap";

// ── Constants ────────────────────────────────────────────────────────────

const REFETCH_INTERVAL_MS = 60_000;
const CALLER_INTERVAL_MIN_MS = 5 * 60_000; // 5 min
const CALLER_INTERVAL_MAX_MS = 15 * 60_000; // 15 min
const CALLER_DISPLAY_MS = 4 * 60_000; // 4 min visible
const CRISIS_INTERVAL_MIN_MS = 30 * 60_000; // 30 min
const CRISIS_INTERVAL_MAX_MS = 60 * 60_000; // 60 min
const DARKNESS_PER_CRISIS = 0.2;
const DARKNESS_CAP = 0.7;
const CRISIS_PROXIMITY_KM = 1.0;

// Amber used across the PRGE UI
const AMBER = "#f5c945";

// ── Madison coordinate constants ─────────────────────────────────────────
// Hardcoded neighborhood locations (lat, lng) — used until madison-locations.ts
// is built by another agent. Covers every neighborhood referenced in
// caller-popups.ts and crisis-events.ts.
const NEIGHBORHOOD_COORDS: Record<string, [number, number]> = {
  "Atwood": [43.0886, -89.3504],
  "Schenk-Atwood": [43.0886, -89.3504],
  "Tenney Park": [43.0835, -89.3700],
  "East Wash": [43.0790, -89.3690],
  "Greenbush": [43.0630, -89.3980],
  "Bay Creek": [43.0580, -89.3880],
  "Eastmorland": [43.0880, -89.3310],
  "Dudgeon-Monroe": [43.0590, -89.4210],
  "Nakoma": [43.0450, -89.4250],
  "Marquette": [43.0760, -89.3750],
  "Monona": [43.0630, -89.3460],
  "Vilas": [43.0580, -89.4120],
  "Willy St": [43.0760, -89.3680],
  "Monroe St": [43.0600, -89.4180],
  "Camp Randall": [43.0700, -89.4130],
  "Middleton": [43.0967, -89.5042],
  "Bram's Addition": [43.0720, -89.3830],
  "Fitchburg": [43.0186, -89.4285],
  "Shorewood Hills": [43.0790, -89.4420],
  "Maple Bluff": [43.1010, -89.3720],
  // Crisis-referenced areas
  "State Street": [43.0750, -89.3950],
  "Capitol Square": [43.0747, -89.3841],
  "Sherman Ave": [43.0900, -89.3740],
  "Park Street": [43.0630, -89.3990],
  "University Ave": [43.0740, -89.4100],
  "Johnson St": [43.0780, -89.3870],
  "Williamson": [43.0770, -89.3660],
  "Olbrich": [43.0870, -89.3370],
  "Regent": [43.0670, -89.4120],
  "Verona": [43.0000, -89.5322],
  "Sun Prairie": [43.1836, -89.2137],
};

// ── Internal pin types (richer than what MadisonMap expects) ─────────────
// We track extra fields (startedAt, durationMs, message, tone) for the
// event log and scheduling. Convert to MapCrisisPin / MapCallerPin /
// MapNeighborhoodDarkness at render time.

interface InternalCrisisPin {
  id: string;
  lat: number;
  lng: number;
  title: string;
  severity: 1 | 2 | 3;
  type: CrisisEvent["type"];
  active: boolean;
  startedAt: number;
  durationMs: number;
}

interface InternalCallerPin {
  id: string;
  lat: number;
  lng: number;
  name: string;
  neighborhood: string;
  message: string;
  tone: CallerPopup["tone"];
  appearedAt: number;
  expiresAt: number;
}

interface InternalDarkness {
  name: string;
  lat: number;
  lng: number;
  darkness: number; // 0.0 - 0.7
}

// ── Track info for audio player ──────────────────────────────────────────

interface TrackInfo {
  artist: string;
  title: string;
  videoId: string;
  embedUrl: string;
}

// ── Utilities ────────────────────────────────────────────────────────────

/** Get current Madison time as HH:MM string. */
function madisonTime(): string {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = f.formatToParts(new Date());
  let hh = "00";
  let mm = "00";
  for (const p of parts) {
    if (p.type === "hour") hh = p.value;
    if (p.type === "minute") mm = p.value;
  }
  // Intl sometimes returns "24" for midnight — normalize
  if (hh === "24") hh = "00";
  return `${hh}:${mm}`;
}

/** Parse HH:MM to hour number. */
function parseHour(t: string): number {
  return parseInt(t.split(":")[0], 10);
}

/** Is it Purge hours? 19:00-06:59 Madison time. */
function isPurgeActive(t: string): boolean {
  const hh = parseHour(t);
  return hh >= 19 || hh < 7;
}

/** Is it daytime? 07:00-18:59 Madison time. */
function isDaytime(t: string): boolean {
  const hh = parseHour(t);
  return hh >= 7 && hh < 19;
}

/** Compute Purge elapsed as a string. 19:00 = 0h. */
function purgeElapsed(t: string): string {
  const hh = parseHour(t);
  const mm = parseInt(t.split(":")[1], 10);
  const totalMin = hh >= 19 ? (hh - 19) * 60 + mm : (hh + 24 - 19) * 60 + mm;
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/** Random int between min and max (inclusive). */
function randBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Haversine distance in km between two lat/lng pairs. */
function haversineKm(
  [lat1, lng1]: [number, number],
  [lat2, lng2]: [number, number],
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Resolve a neighborhood name to coords, with fuzzy fallback. */
function neighborhoodToCoords(name: string): [number, number] | null {
  // Direct match
  if (NEIGHBORHOOD_COORDS[name]) return NEIGHBORHOOD_COORDS[name];
  // Partial match
  const lower = name.toLowerCase();
  for (const [key, coords] of Object.entries(NEIGHBORHOOD_COORDS)) {
    if (key.toLowerCase().includes(lower) || lower.includes(key.toLowerCase())) {
      return coords;
    }
  }
  return null;
}

/** Pick a location for a crisis based on its content — tries to match area
 *  names in the title and opening lines to known neighborhoods. Falls back
 *  to a random neighborhood if nothing matches. */
function crisisToCoords(crisis: CrisisEvent): [number, number] {
  const text = [crisis.title, ...crisis.openingLines].join(" ").toLowerCase();
  for (const [name, coords] of Object.entries(NEIGHBORHOOD_COORDS)) {
    if (text.includes(name.toLowerCase())) return coords;
  }
  // Jitter around Madison center
  const keys = Object.keys(NEIGHBORHOOD_COORDS);
  const pick = keys[Math.floor(Math.random() * keys.length)];
  return NEIGHBORHOOD_COORDS[pick];
}

// ═════════════════════════════════════════════════════════════════════════
// Page Component
// ═════════════════════════════════════════════════════════════════════════

export default function MapPage() {
  // ── Core state ─────────────────────────────────────────────────────────
  const [clock, setClock] = useState<string>(madisonTime);
  const [segment, setSegment] = useState<PlayerSegment | null>(null);
  const [crisisPins, setCrisisPins] = useState<InternalCrisisPin[]>([]);
  const [callerPins, setCallerPins] = useState<InternalCallerPin[]>([]);
  const [neighborhoodDarkness, setNeighborhoodDarkness] = useState<
    InternalDarkness[]
  >([]);

  // ── Audio player state ─────────────────────────────────────────────────
  const [playing, setPlaying] = useState(false);
  const [trackInfo, setTrackInfo] = useState<TrackInfo | null>(null);
  const [volume, setVolume] = useState(70);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerReadyRef = useRef(false);

  // ── Timers ─────────────────────────────────────────────────────────────
  const callerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const crisisTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callerIdRef = useRef(0);
  const crisisIdRef = useRef(0);

  // Derived state
  const daytime = useMemo(() => isDaytime(clock), [clock]);
  const purgeActive = useMemo(() => isPurgeActive(clock), [clock]);

  // ── Clock tick — update Madison time every 10s ─────────────────────────
  useEffect(() => {
    const tick = () => setClock(madisonTime());
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, []);

  // ── Segment fetch — same pattern as main page ─────────────────────────
  const fetchSegment = useCallback(async () => {
    try {
      const res = await fetch("/api/segment");
      if (!res.ok) return;
      const data = await res.json();
      if (data && typeof data === "object" && typeof data.type === "string") {
        setSegment(data as PlayerSegment);
      }
    } catch {
      // Silent fail — map keeps working without segment data
    }
  }, []);

  useEffect(() => {
    fetchSegment();
    const id = setInterval(fetchSegment, REFETCH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchSegment]);

  // ── Track resolution for audio player ──────────────────────────────────
  useEffect(() => {
    if (!segment) return;
    if (daytime) {
      setTrackInfo(null);
      return;
    }

    // Try to find a playable track from the segment
    const tracks: PlayerTrack[] | undefined = segment.tracks;
    if (!tracks || tracks.length === 0) {
      setTrackInfo(null);
      return;
    }

    const first = tracks[0];

    // If videoId is pre-resolved (countdown PSA segments), use it directly
    if (first.videoId) {
      setTrackInfo({
        artist: first.artist,
        title: first.title,
        videoId: first.videoId,
        embedUrl: `https://www.youtube.com/embed/${first.videoId}?autoplay=1&controls=0&disablekb=1&modestbranding=1&rel=0&fs=0&iv_load_policy=3&enablejsapi=1`,
      });
      return;
    }

    // Otherwise resolve via /api/track
    (async () => {
      try {
        const res = await fetch(
          `/api/track?artist=${encodeURIComponent(first.artist)}&title=${encodeURIComponent(first.title)}`,
        );
        if (!res.ok) {
          setTrackInfo(null);
          return;
        }
        const data = await res.json();
        if (data.videoId) {
          setTrackInfo({
            artist: first.artist,
            title: first.title,
            videoId: data.videoId,
            embedUrl: data.embedUrl,
          });
        }
      } catch {
        setTrackInfo(null);
      }
    })();
  }, [segment, daytime]);

  // ── YouTube iframe control via postMessage ─────────────────────────────
  const postToPlayer = useCallback((func: string) => {
    if (!iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      JSON.stringify({ event: "command", func }),
      "*",
    );
  }, []);

  const handlePlayPause = useCallback(() => {
    if (playing) {
      postToPlayer("pauseVideo");
      setPlaying(false);
    } else {
      postToPlayer("playVideo");
      setPlaying(true);
    }
  }, [playing, postToPlayer]);

  // Listen for YouTube player state messages
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (typeof e.data !== "string") return;
      try {
        const msg = JSON.parse(e.data);
        if (msg.event === "onReady") {
          playerReadyRef.current = true;
        }
        if (msg.event === "onStateChange") {
          // 1 = playing, 2 = paused
          if (msg.info === 1) setPlaying(true);
          if (msg.info === 2) setPlaying(false);
        }
      } catch {
        // Not a JSON message — ignore
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // Volume control via postMessage
  useEffect(() => {
    if (!playerReadyRef.current) return;
    if (!iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      JSON.stringify({
        event: "command",
        func: "setVolume",
        args: [volume],
      }),
      "*",
    );
  }, [volume]);

  // ── Crisis pin scheduling ──────────────────────────────────────────────
  const scheduleCrisis = useCallback(() => {
    if (crisisTimerRef.current) clearTimeout(crisisTimerRef.current);

    const delay = randBetween(CRISIS_INTERVAL_MIN_MS, CRISIS_INTERVAL_MAX_MS);
    crisisTimerRef.current = setTimeout(() => {
      const crisis = pickRandomNonBreachCrisis();
      const coords = crisisToCoords(crisis);
      const id = `crisis-${++crisisIdRef.current}`;

      const pin: InternalCrisisPin = {
        id,
        lat: coords[0] + (Math.random() - 0.5) * 0.005, // slight jitter
        lng: coords[1] + (Math.random() - 0.5) * 0.005,
        title: crisis.title,
        severity: crisis.severity,
        type: crisis.type,
        active: true,
        startedAt: Date.now(),
        durationMs: crisis.durationMs,
      };

      setCrisisPins((prev) => [...prev, pin]);

      // Mark resolved after duration
      setTimeout(() => {
        setCrisisPins((prev) =>
          prev.map((p) => (p.id === id ? { ...p, active: false } : p)),
        );
      }, crisis.durationMs);

      // Update neighborhood darkness
      setNeighborhoodDarkness((prev) => {
        const updated = [...prev];
        for (const [name, nCoords] of Object.entries(NEIGHBORHOOD_COORDS)) {
          const dist = haversineKm(coords, nCoords);
          if (dist <= CRISIS_PROXIMITY_KM) {
            const existing = updated.find((n) => n.name === name);
            if (existing) {
              existing.darkness = Math.min(
                DARKNESS_CAP,
                existing.darkness + DARKNESS_PER_CRISIS,
              );
            } else {
              updated.push({
                name,
                lat: nCoords[0],
                lng: nCoords[1],
                darkness: DARKNESS_PER_CRISIS,
              });
            }
          }
        }
        return updated;
      });

      // Schedule next crisis
      scheduleCrisis();
    }, delay);
  }, []);

  // ── Caller pin scheduling ──────────────────────────────────────────────
  const scheduleCaller = useCallback(() => {
    if (callerTimerRef.current) clearTimeout(callerTimerRef.current);

    const delay = randBetween(CALLER_INTERVAL_MIN_MS, CALLER_INTERVAL_MAX_MS);
    callerTimerRef.current = setTimeout(() => {
      const caller =
        CALLER_POOL[Math.floor(Math.random() * CALLER_POOL.length)];
      const coords = neighborhoodToCoords(caller.neighborhood);
      if (!coords) {
        scheduleCaller();
        return;
      }

      const id = `caller-${++callerIdRef.current}`;
      const now = Date.now();
      const pin: InternalCallerPin = {
        id,
        lat: coords[0] + (Math.random() - 0.5) * 0.004,
        lng: coords[1] + (Math.random() - 0.5) * 0.004,
        name: caller.name,
        neighborhood: caller.neighborhood,
        message: caller.message,
        tone: caller.tone,
        appearedAt: now,
        expiresAt: now + CALLER_DISPLAY_MS,
      };

      setCallerPins((prev) => [...prev, pin]);

      // Remove after display period
      setTimeout(() => {
        setCallerPins((prev) => prev.filter((p) => p.id !== id));
      }, CALLER_DISPLAY_MS);

      // Schedule next caller
      scheduleCaller();
    }, delay);
  }, []);

  // Start scheduling when Purge is active
  useEffect(() => {
    if (purgeActive && !daytime) {
      scheduleCrisis();
      scheduleCaller();
    }

    return () => {
      if (crisisTimerRef.current) clearTimeout(crisisTimerRef.current);
      if (callerTimerRef.current) clearTimeout(callerTimerRef.current);
    };
  }, [purgeActive, daytime, scheduleCrisis, scheduleCaller]);

  // ── Derived display values ─────────────────────────────────────────────
  const activeCrisisCount = crisisPins.filter((p) => p.active).length;
  const resolvedCrisisCount = crisisPins.filter((p) => !p.active).length;
  const activeCallerCount = callerPins.length;

  const segmentLabel = useMemo(() => {
    if (!segment) return "SCANNING...";
    return segment.segmentTitle ?? segment.type.replace(/-/g, " ").toUpperCase();
  }, [segment]);

  // Is the current segment a music block with playable tracks?
  const hasMusicTrack = !!trackInfo;

  // ── Convert internal state to MadisonMap prop shapes ───────────────────
  const mapCrisisPins: MapCrisisPin[] = useMemo(
    () =>
      crisisPins.map((p) => ({
        id: p.id,
        lat: p.lat,
        lng: p.lng,
        label: p.title,
        severity: p.severity,
        active: p.active,
      })),
    [crisisPins],
  );

  const mapCallerPins: MapCallerPin[] = useMemo(
    () =>
      callerPins.map((p) => ({
        id: p.id,
        lat: p.lat,
        lng: p.lng,
        name: p.name,
        neighborhood: p.neighborhood,
      })),
    [callerPins],
  );

  // Build rough polygon bounds from center point — a small square ~0.004 deg
  // (~400m) around each neighborhood center. Good enough for the darkness overlay.
  const mapDarkness: MapNeighborhoodDarkness[] = useMemo(
    () =>
      neighborhoodDarkness.map((d) => {
        const r = 0.004; // ~400m radius
        return {
          id: d.name,
          bounds: [
            [d.lat - r, d.lng - r],
            [d.lat - r, d.lng + r],
            [d.lat + r, d.lng + r],
            [d.lat + r, d.lng - r],
          ] as [number, number][],
          darkness: d.darkness,
        };
      }),
    [neighborhoodDarkness],
  );

  // ═════════════════════════════════════════════════════════════════════════
  // Render
  // ═════════════════════════════════════════════════════════════════════════

  return (
    <div className="fixed inset-0 flex flex-col bg-black overflow-hidden font-mono">
      {/* ── Scanline overlay ──────────────────────────────────────────── */}
      <div className="prge-scanlines pointer-events-none fixed inset-0 z-50 opacity-40" />

      {/* ── CRT vignette ──────────────────────────────────────────────── */}
      <div className="prge-vignette pointer-events-none fixed inset-0 z-40" />

      {/* ── TOP BAR ───────────────────────────────────────────────────── */}
      <header
        className="relative z-30 flex items-center justify-between px-4 py-2 border-b"
        style={{
          borderColor: `${AMBER}33`,
          background: "linear-gradient(180deg, rgba(10,8,4,0.95) 0%, rgba(5,4,2,0.98) 100%)",
        }}
      >
        {/* Left — station ID */}
        <div className="flex items-center gap-3">
          <div
            className="w-2 h-2 rounded-full"
            style={{
              background: purgeActive ? "#ef4444" : AMBER,
              boxShadow: purgeActive
                ? "0 0 8px rgba(239,68,68,0.8)"
                : `0 0 6px ${AMBER}88`,
              animation: purgeActive
                ? "prge-rec-blink 1.2s ease-in-out infinite"
                : undefined,
            }}
          />
          <span
            className="text-xs tracking-[0.25em] uppercase"
            style={{ color: AMBER }}
          >
            PRGE NEIGHBORHOOD WATCH
          </span>
          <span className="text-xs opacity-40" style={{ color: AMBER }}>
            FREQ 420.69 MHz
          </span>
        </div>

        {/* Center — clock */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
          <span
            className="text-sm tabular-nums"
            style={{
              color: AMBER,
              textShadow: `0 0 8px ${AMBER}66`,
            }}
          >
            {clock}
          </span>
          <span className="text-[10px] opacity-50" style={{ color: AMBER }}>
            CDT
          </span>
          {purgeActive && (
            <span className="text-[10px] text-red-400 ml-2 tracking-wider">
              PURGE +{purgeElapsed(clock)}
            </span>
          )}
        </div>

        {/* Right — return link */}
        <Link
          href="/"
          className="flex items-center gap-1.5 text-xs tracking-wide transition-opacity hover:opacity-100 opacity-70"
          style={{ color: AMBER }}
        >
          <span className="text-[10px]">&larr;</span>
          RETURN TO BROADCAST
        </Link>
      </header>

      {/* ── STATUS BAR ────────────────────────────────────────────────── */}
      <div
        className="relative z-30 flex items-center gap-6 px-4 py-1.5 text-[10px] tracking-widest uppercase border-b"
        style={{
          borderColor: `${AMBER}22`,
          background: "rgba(5,4,2,0.9)",
          color: `${AMBER}99`,
        }}
      >
        <span>
          ACTIVE CRISES:{" "}
          <span
            style={{
              color: activeCrisisCount > 0 ? "#ef4444" : "#34d399",
            }}
          >
            {activeCrisisCount}
          </span>
        </span>
        <span>
          RESOLVED: <span style={{ color: `${AMBER}cc` }}>{resolvedCrisisCount}</span>
        </span>
        <span>
          CALLERS IN:{" "}
          <span style={{ color: activeCallerCount > 0 ? AMBER : `${AMBER}66` }}>
            {activeCallerCount}
          </span>
        </span>
        <span className="ml-auto">
          SEGMENT:{" "}
          <span style={{ color: AMBER }}>{segmentLabel}</span>
        </span>
      </div>

      {/* ── MAP AREA ──────────────────────────────────────────────────── */}
      <div className="relative flex-1 z-10">
        {daytime ? (
          /* ── Daytime dormant state ──────────────────────────────────── */
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90">
            <div
              className="text-2xl tracking-[0.3em] mb-4"
              style={{
                color: `${AMBER}88`,
                textShadow: `0 0 20px ${AMBER}33`,
              }}
            >
              {parseHour(clock) >= 7 && parseHour(clock) < 19
                ? "MONITORING BEGINS AT 19:00"
                : "PURGE NIGHT HAS ENDED"}
            </div>
            <div
              className="text-sm tracking-widest opacity-50"
              style={{ color: AMBER }}
            >
              NEIGHBORHOOD WATCH SYSTEM STANDBY
            </div>
            <div className="mt-8 text-xs opacity-30" style={{ color: AMBER }}>
              ALL CRISIS PINS CLEARED AT 07:00
            </div>
            {/* Dormant map visible but desaturated */}
            <div className="absolute inset-0 opacity-20 grayscale pointer-events-none">
              <MadisonMap
                crisisPins={[]}
                callerPins={[]}
                neighborhoodDarkness={[] as MapNeighborhoodDarkness[]}
              />
            </div>
          </div>
        ) : (
          /* ── Active map ─────────────────────────────────────────────── */
          <MadisonMap
            crisisPins={mapCrisisPins}
            callerPins={mapCallerPins}
            neighborhoodDarkness={mapDarkness}
          />
        )}

        {/* ── Map legend overlay ──────────────────────────────────────── */}
        {!daytime && (
          <div
            className="absolute bottom-4 left-4 z-20 flex flex-col gap-1.5 px-3 py-2 rounded text-[10px] tracking-wider"
            style={{
              background: "rgba(0,0,0,0.85)",
              border: `1px solid ${AMBER}33`,
              color: `${AMBER}aa`,
            }}
          >
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{
                  background: "#ef4444",
                  boxShadow: "0 0 6px rgba(239,68,68,0.6)",
                }}
              />
              ACTIVE CRISIS
            </div>
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{
                  background: "#ef444466",
                  border: "1px solid #ef444444",
                }}
              />
              RESOLVED
            </div>
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{
                  background: AMBER,
                  boxShadow: `0 0 6px ${AMBER}88`,
                }}
              />
              CALLER
            </div>
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-sm"
                style={{
                  background: "rgba(0,0,0,0.6)",
                  border: "1px solid #ef444444",
                }}
              />
              DARKNESS ZONE
            </div>
          </div>
        )}

        {/* ── Mini event log overlay ──────────────────────────────────── */}
        {!daytime && crisisPins.length > 0 && (
          <div
            className="absolute top-4 right-4 z-20 w-72 max-h-60 overflow-y-auto flex flex-col gap-1 px-3 py-2 rounded text-[10px]"
            style={{
              background: "rgba(0,0,0,0.88)",
              border: `1px solid ${AMBER}22`,
              scrollbarWidth: "thin",
              scrollbarColor: `${AMBER}44 transparent`,
            }}
          >
            <div
              className="text-[9px] tracking-[0.3em] uppercase mb-1 pb-1"
              style={{
                color: `${AMBER}88`,
                borderBottom: `1px solid ${AMBER}22`,
              }}
            >
              EVENT LOG
            </div>
            {[...crisisPins]
              .sort((a, b) => b.startedAt - a.startedAt)
              .slice(0, 8)
              .map((pin) => (
                <div
                  key={pin.id}
                  className="flex items-start gap-2 py-0.5"
                  style={{
                    color: pin.active ? "#ef4444" : `${AMBER}66`,
                  }}
                >
                  <span className="shrink-0 mt-0.5">
                    {pin.active ? "\u25CF" : "\u25CB"}
                  </span>
                  <span className="font-mono leading-snug">
                    {pin.title}
                    {!pin.active && (
                      <span className="ml-1 opacity-50">[RESOLVED]</span>
                    )}
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* ── BOTTOM BAR — AUDIO PLAYER ─────────────────────────────────── */}
      <footer
        className="relative z-30 flex items-center px-4 py-2.5 border-t"
        style={{
          borderColor: `${AMBER}33`,
          background:
            "linear-gradient(0deg, rgba(10,8,4,0.95) 0%, rgba(5,4,2,0.98) 100%)",
        }}
      >
        {/* Play/pause — only for music segments */}
        {hasMusicTrack && !daytime ? (
          <button
            onClick={handlePlayPause}
            className="flex items-center justify-center w-8 h-8 mr-3 rounded transition-colors"
            style={{
              color: AMBER,
              border: `1px solid ${AMBER}44`,
              background: playing ? `${AMBER}11` : "transparent",
            }}
            aria-label={playing ? "Pause" : "Play"}
          >
            <span className="text-sm">{playing ? "\u23F8" : "\u25B6"}</span>
          </button>
        ) : (
          <div className="w-8 h-8 mr-3" />
        )}

        {/* Track info / broadcast status */}
        <div className="flex-1 min-w-0">
          {daytime ? (
            <div className="text-xs opacity-40" style={{ color: AMBER }}>
              STATION STANDBY — NO BROADCAST
            </div>
          ) : hasMusicTrack && trackInfo ? (
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="text-[10px] tracking-wider shrink-0"
                style={{
                  color: "#34d399",
                  textShadow: "0 0 6px rgba(52,211,153,0.5)",
                }}
              >
                {playing ? "NOW PLAYING" : "PAUSED"}
              </span>
              <span
                className="text-xs truncate"
                style={{ color: AMBER }}
              >
                {trackInfo.artist} — {trackInfo.title}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: "#34d399",
                  boxShadow: "0 0 6px rgba(52,211,153,0.6)",
                  animation: "prge-rec-blink 1.2s ease-in-out infinite",
                }}
              />
              <span className="text-xs" style={{ color: AMBER }}>
                LIVE BROADCAST
              </span>
              {segment && (
                <span
                  className="text-[10px] opacity-50"
                  style={{ color: AMBER }}
                >
                  — {segmentLabel}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Volume control */}
        {hasMusicTrack && !daytime && (
          <div className="flex items-center gap-2 ml-4">
            <span className="text-xs" style={{ color: `${AMBER}88` }}>
              {volume === 0 ? "\uD83D\uDD07" : "\uD83D\uDD0A"}
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-20 h-1 appearance-none rounded-full cursor-pointer"
              style={{
                background: `linear-gradient(to right, ${AMBER} 0%, ${AMBER} ${volume}%, ${AMBER}33 ${volume}%, ${AMBER}33 100%)`,
                accentColor: AMBER,
              }}
              aria-label="Volume"
            />
          </div>
        )}

        {/* Frequency badge */}
        <div
          className="flex items-center gap-1.5 ml-4 px-2 py-1 rounded text-[9px] tracking-[0.2em]"
          style={{
            border: `1px solid ${AMBER}33`,
            color: `${AMBER}88`,
          }}
        >
          <span
            className="w-1 h-1 rounded-full"
            style={{
              background: purgeActive ? "#ef4444" : "#34d399",
              boxShadow: purgeActive
                ? "0 0 4px rgba(239,68,68,0.6)"
                : "0 0 4px rgba(52,211,153,0.6)",
            }}
          />
          PRGE 420.69
        </div>
      </footer>

      {/* ── Hidden YouTube iframe for audio ───────────────────────────── */}
      {trackInfo && !daytime && (
        <iframe
          ref={iframeRef}
          src={trackInfo.embedUrl}
          allow="autoplay; encrypted-media"
          style={{
            position: "absolute",
            width: "1px",
            height: "1px",
            left: "-9999px",
            top: "-9999px",
            visibility: "hidden",
            pointerEvents: "none",
          }}
          tabIndex={-1}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
