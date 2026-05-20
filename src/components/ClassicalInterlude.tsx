"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import type { ClassicalTrack } from "@/lib/classical-pool";

// ── Classical Interlude ──────────────────────────────────────────────
// Ambient background player that fills time between dialog plays.
// Uses the same YouTube iframe pattern as MusicBlockLayout but with
// minimal chrome — just the composer/title and a subtle pulse indicator.
//
// Pauses for events (Nick cut-ins, Tim EBS, crises, dead air, retro ads)
// via the `paused` prop. When unpaused, playback resumes seamlessly.
//
// Unlike Nick's punk sets, the visual is deliberately calm: no spectrogram,
// no terminal chrome, no progress strip. Just text and quiet.

interface ClassicalInterludeProps {
  /** Ordered playlist of classical tracks for this slot. */
  playlist: ClassicalTrack[];
  /** When true, pause YouTube playback. Used during overlays/events. */
  paused?: boolean;
  /**
   * When true (03:00-04:59 Madison), set playback rate to 0.97 — makes the
   * music sound slightly wrong/slow without being obviously broken. The station
   * is running on fumes and the equipment is drifting.
   */
  deadZone?: boolean;
}

// YouTube iframe player states (mirrors YT.PlayerState).
const YT_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
} as const;

export function ClassicalInterlude({
  playlist,
  paused = false,
  deadZone = false,
}: ClassicalInterludeProps) {
  const [trackIndex, setTrackIndex] = useState(0);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const pausedRef = useRef(paused);
  const lastAdvanceRef = useRef(0);

  const track = playlist[trackIndex % playlist.length];

  // ── Resolve track → YouTube embed URL via /api/track ─────────────
  useEffect(() => {
    if (!track) return;
    setResolving(true);
    setEmbedUrl(null);

    const controller = new AbortController();
    const params = new URLSearchParams({
      artist: track.composer,
      title: track.title,
    });

    fetch(`/api/track?${params.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          // Skip to next track on resolution failure.
          setTrackIndex((i) => (i + 1) % playlist.length);
          return;
        }
        const json = await res.json();
        const originParam = typeof window !== "undefined"
          ? `&origin=${encodeURIComponent(window.location.origin)}`
          : "";
        if (json.embedUrl) {
          const url = json.embedUrl.includes("origin=")
            ? json.embedUrl
            : `${json.embedUrl}${originParam}`;
          setEmbedUrl(url);
        } else if (json.videoId) {
          setEmbedUrl(
            `https://www.youtube.com/embed/${encodeURIComponent(json.videoId)}?autoplay=1&controls=0&disablekb=1&modestbranding=1&rel=0&fs=0&iv_load_policy=3&enablejsapi=1${originParam}`,
          );
        } else {
          setTrackIndex((i) => (i + 1) % playlist.length);
        }
        setResolving(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setTrackIndex((i) => (i + 1) % playlist.length);
          setResolving(false);
        }
      });

    return () => controller.abort();
  }, [track?.composer, track?.title]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── YouTube postMessage listener (track ended → advance) ─────────
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== "https://www.youtube.com") return;
      // Only process events from OUR iframe — ignore other YouTube iframes
      // on the page (MusicBlockLayout, RetroAdBreak, etc.).
      if (e.source !== iframeRef.current?.contentWindow) return;
      let data: Record<string, unknown>;
      try {
        data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
      } catch {
        return;
      }
      if (data.event === "onStateChange" || data.event === "infoDelivery") {
        const info = (data.info ?? data) as Record<string, unknown>;
        const state = info.playerState as number | undefined;
        if (state === YT_STATE.ENDED) {
          const now = Date.now();
          if (now - lastAdvanceRef.current > 5000) {
            lastAdvanceRef.current = now;
            setTrackIndex((i) => (i + 1) % playlist.length);
          }
        }
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [playlist.length]);

  // ── iframe load → subscribe + play ───────────────────────────────
  const handleIframeLoad = useCallback(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    const iframeKey = `${track.composer}::${track.title}`;
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
    if (!paused) {
      win.postMessage(
        JSON.stringify({ event: "command", func: "playVideo", args: [] }),
        "https://www.youtube.com",
      );
    }
    // Set playback rate on load — 0.97 during dead zone, 1.0 otherwise.
    if (deadZoneRef.current) {
      win.postMessage(
        JSON.stringify({ event: "command", func: "setPlaybackRate", args: [0.97] }),
        "https://www.youtube.com",
      );
    }
  }, [track?.composer, track?.title, paused]);

  // ── Pause/resume via postMessage ─────────────────────────────────
  useEffect(() => {
    if (pausedRef.current === paused) return;
    pausedRef.current = paused;
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    const func = paused ? "pauseVideo" : "playVideo";
    win.postMessage(
      JSON.stringify({ event: "command", func, args: [] }),
      "https://www.youtube.com",
    );
  }, [paused]);

  // ── Dead zone playback rate drift ───────────────────────────────
  // During 03:00-04:59 Madison, nudge the playback rate to 0.97 so the
  // music sounds slightly too slow — the tape deck is drifting. Revert
  // to 1.0 when the dead zone ends. Uses the YouTube iframe setPlaybackRate
  // command via postMessage.
  const prevDeadZoneRef = useRef(deadZone);
  useEffect(() => {
    if (prevDeadZoneRef.current === deadZone) return;
    prevDeadZoneRef.current = deadZone;
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    const rate = deadZone ? 0.97 : 1;
    win.postMessage(
      JSON.stringify({ event: "command", func: "setPlaybackRate", args: [rate] }),
      "https://www.youtube.com",
    );
  }, [deadZone]);

  // Also set the initial playback rate when the iframe loads during dead zone.
  const deadZoneRef = useRef(deadZone);
  useEffect(() => { deadZoneRef.current = deadZone; }, [deadZone]);

  // ── Fallback advance timer (in case YT doesn't fire ENDED) ──────
  useEffect(() => {
    if (!embedUrl || paused || !track) return;
    const fallback = setTimeout(
      () => {
        setTrackIndex((i) => (i + 1) % playlist.length);
      },
      (track.durationSec + 30) * 1000, // 30s buffer past expected duration
    );
    return () => clearTimeout(fallback);
  }, [embedUrl, paused, track?.composer, track?.title]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Late-night audio dropouts (02:00–06:00 Madison) ────────────────
  // Simulates a struggling transmitter by briefly ducking volume to 0 for
  // 100–300ms at random intervals. Frequency increases as the night deepens:
  //   02:00 → every ~60-90s
  //   04:00 → every ~30-50s
  //   05:30 → every ~20-35s
  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    function getMadisonHour(): number {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Chicago",
        hour: "numeric",
        hour12: false,
      }).formatToParts(new Date());
      const hourPart = parts.find((p) => p.type === "hour");
      return hourPart ? parseInt(hourPart.value, 10) % 24 : 0;
    }

    function getMadisonMinute(): number {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Chicago",
        minute: "numeric",
      }).formatToParts(new Date());
      const minPart = parts.find((p) => p.type === "minute");
      return minPart ? parseInt(minPart.value, 10) : 0;
    }

    function isLateNight(): boolean {
      const h = getMadisonHour();
      return h >= 2 && h < 6;
    }

    /** Returns a 0–1 factor: 0 at 02:00, 1 at 06:00. */
    function nightProgress(): number {
      const h = getMadisonHour();
      const m = getMadisonMinute();
      const minutesSince2AM = (h - 2) * 60 + m;
      return Math.max(0, Math.min(1, minutesSince2AM / 240)); // 240 = 4 hours
    }

    function scheduleDropout() {
      if (cancelled) return;
      if (!isLateNight()) {
        // Re-check every 5 minutes whether we've entered the window.
        timeoutId = setTimeout(scheduleDropout, 5 * 60 * 1000);
        return;
      }

      const progress = nightProgress();
      // Interval shrinks as the night deepens: ~60-90s at 2AM → ~20-35s near 6AM.
      const minInterval = 60_000 - progress * 40_000; // 60s → 20s
      const maxInterval = 90_000 - progress * 55_000; // 90s → 35s
      const delay = minInterval + Math.random() * (maxInterval - minInterval);

      timeoutId = setTimeout(() => {
        if (cancelled || paused) {
          scheduleDropout();
          return;
        }
        const win = iframeRef.current?.contentWindow;
        if (!win) {
          scheduleDropout();
          return;
        }

        // Duck volume to 0.
        win.postMessage(
          JSON.stringify({ event: "command", func: "setVolume", args: [0] }),
          "https://www.youtube.com",
        );

        // Restore after 100–300ms.
        const dropoutDuration = 100 + Math.random() * 200;
        setTimeout(() => {
          if (cancelled) return;
          win.postMessage(
            JSON.stringify({ event: "command", func: "setVolume", args: [100] }),
            "https://www.youtube.com",
          );
        }, dropoutDuration);

        scheduleDropout();
      }, delay);
    }

    scheduleDropout();
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [paused]);

  // ── Autoplay unlock on user gesture ──────────────────────────────
  useEffect(() => {
    if (!embedUrl || paused) return;
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
  }, [embedUrl, paused]);

  const iframeKey = track ? `classical::${track.composer}::${track.title}` : "empty";

  return (
    <div className="flex flex-col items-center justify-center h-full w-full px-6">
      {/* Composer + title — centered, quiet, elegant */}
      <div className="text-center mb-8">
        <div className="text-green-700 text-[10px] tracking-[0.4em] mb-3">
          INTERLUDE
        </div>
        <div className="text-green-400/80 text-lg md:text-xl tracking-wide mb-1">
          {track?.title ?? "..."}
        </div>
        <div className="text-green-600/60 text-sm tracking-widest">
          {track?.composer ?? ""}
        </div>
      </div>

      {/* Subtle pulsing dot — "on air" indicator */}
      <div className="flex items-center gap-2 mb-8">
        <span
          className={[
            "w-2 h-2 rounded-full",
            paused ? "bg-amber-600/50" : "bg-green-500/70 animate-pulse",
          ].join(" ")}
        />
        <span className="text-green-800 text-[10px] tracking-[0.3em]">
          {resolving ? "RESOLVING" : paused ? "PAUSED" : "PLAYING"}
        </span>
      </div>

      {/* Hidden YouTube iframe — audio only, no visible player */}
      {embedUrl && (
        <div className="w-0 h-0 overflow-hidden absolute" aria-hidden>
          <iframe
            key={iframeKey}
            ref={iframeRef}
            src={embedUrl}
            title={`${track.title} — ${track.composer}`}
            allow="autoplay; encrypted-media"
            onLoad={handleIframeLoad}
            className="w-[1px] h-[1px]"
          />
        </div>
      )}

      {/* PREVIOUSLY RECORDED indicator — shown only during rebroadcast phase */}
      {/* (Controlled by parent via CSS class or a prop — for now, parent handles it) */}
    </div>
  );
}
