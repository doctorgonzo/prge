"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { RetroAd } from "@/lib/retro-ads";

interface RetroAdBreakProps {
  ad: RetroAd;
  /** Called when the ad finishes playing (YouTube ENDED event or fallback timeout). */
  onComplete: () => void;
  /** When true, pause the ad's YouTube playback (e.g. during PurgeSiren overlay). */
  paused?: boolean;
}

// YouTube player states (same constants as MusicBlockLayout).
const YT_ENDED = 0;
const YT_PLAYING = 1;

// Stable iframe key so React doesn't re-mount on re-renders.
const IFRAME_KEY = "retro-ad-iframe";

/**
 * Full-screen-ish retro ad break. Embeds a real 80s YouTube commercial with
 * in-universe PRGE sponsor text underneath. Auto-dismisses when the video
 * ends via the YouTube iframe API's ENDED event. Fallback timeout at 90s in
 * case the event never fires (embed blocked, ad blocker, etc.).
 *
 * Uses the same YouTube postMessage protocol as MusicBlockLayout — subscribe
 * via "listening" + "addEventListener", filter by origin, track playerState
 * from infoDelivery + onStateChange events.
 */
export function RetroAdBreak({ ad, onComplete, paused = false }: RetroAdBreakProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const completedRef = useRef(false);
  const pausedRef = useRef(paused);
  const [playerState, setPlayerState] = useState(-1); // -1 = unstarted
  const [duration, setDuration] = useState<number | null>(null);

  // Guard against double-fire (strict mode, race between ended + timeout).
  const handleComplete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  }, [onComplete]);

  // Listen for YouTube player events via postMessage — same protocol as
  // MusicBlockLayout. Filter by origin for security.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== "https://www.youtube.com") return;
      // Only process events from OUR iframe — ignore other YouTube iframes
      // on the page (MusicBlockLayout, ClassicalInterlude, etc.).
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

      // infoDelivery — periodic updates (~250ms) with playerState, currentTime, duration.
      if (d.event === "infoDelivery" && d.info && typeof d.info === "object") {
        const info = d.info as Record<string, unknown>;
        if (typeof info.playerState === "number") {
          setPlayerState(info.playerState);
        }
        if (typeof info.duration === "number" && info.duration > 0) {
          setDuration(info.duration);
        }
      }
      // onStateChange — discrete state transition events.
      else if (d.event === "onStateChange" && typeof d.info === "number") {
        setPlayerState(d.info);
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Pause/resume via postMessage — used when PurgeSiren or other overlays
  // need to silence the ad without destroying the iframe.
  useEffect(() => {
    if (pausedRef.current === paused) return;
    pausedRef.current = paused;
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    const func = paused ? "pauseVideo" : "playVideo";
    const cmd = JSON.stringify({ event: "command", func, args: [] });
    win.postMessage(cmd, "https://www.youtube.com");
    // Retry after 200ms — iframe may not be ready for the first command.
    const retryId = setTimeout(() => {
      win.postMessage(cmd, "https://www.youtube.com");
    }, 200);
    return () => clearTimeout(retryId);
  }, [paused]);

  // Detect ENDED state → dismiss.
  useEffect(() => {
    if (playerState === YT_ENDED) {
      // Small delay so the last frame is visible for a beat.
      const id = setTimeout(handleComplete, 800);
      return () => clearTimeout(id);
    }
  }, [playerState, handleComplete]);

  // Subscribe to YouTube iframe API on load — must send "listening",
  // "addEventListener", and "playVideo" (same sequence MusicBlockLayout uses).
  function handleIframeLoad() {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    const target = "https://www.youtube.com";

    // Subscribe channel — must come first per YT iframe API protocol.
    win.postMessage(
      JSON.stringify({ event: "listening", id: IFRAME_KEY, channel: "widget" }),
      target,
    );
    // Register for state change events.
    win.postMessage(
      JSON.stringify({
        event: "command",
        func: "addEventListener",
        args: ["onStateChange"],
      }),
      target,
    );
    // Belt-and-suspenders playback nudge.
    win.postMessage(
      JSON.stringify({ event: "command", func: "playVideo", args: [] }),
      target,
    );
  }

  // Fallback timeout — if the ENDED event never fires. Use the detected
  // duration + 20% buffer when available; otherwise fall back to 90s.
  useEffect(() => {
    // Wait for duration to be known (or 5s, whichever comes first).
    // Once we have duration, set a tight fallback. If duration never
    // arrives, the 90s catch-all fires.
    const fallbackMs =
      duration !== null
        ? Math.round(duration * 1000 * 1.2) + 2000 // duration + 20% + 2s grace
        : 90_000;
    const id = setTimeout(handleComplete, fallbackMs);
    return () => clearTimeout(id);
  }, [duration, handleComplete]);

  const embedUrl = `https://www.youtube.com/embed/${ad.videoId}?autoplay=1&enablejsapi=1&rel=0&modestbranding=1&controls=0&showinfo=0&origin=${typeof window !== "undefined" ? encodeURIComponent(window.location.origin) : ""}`;

  const isPlaying = playerState === YT_PLAYING;

  return (
    <div className="max-w-2xl mx-auto w-full text-center">
      {/* Sponsor header */}
      <div className="text-xs tracking-[0.3em] text-amber-400/70 mb-4 uppercase">
        {isPlaying ? "PRGE COMMERCIAL BREAK" : "TUNING SPONSOR FEED\u2026"}
      </div>

      {/* YouTube iframe — 16:9 aspect ratio with CRT-style border */}
      <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
        <iframe
          key={ad.videoId}
          ref={iframeRef}
          className="absolute inset-0 w-full h-full border border-amber-900/50"
          src={embedUrl}
          title={ad.realDescription}
          allow="autoplay; encrypted-media"
          allowFullScreen
          onLoad={handleIframeLoad}
          style={{
            boxShadow: "inset 0 0 40px rgba(217, 119, 6, 0.08)",
          }}
        />
      </div>

      {/* In-universe sponsor text */}
      <div className="mt-6 space-y-2">
        <div className="text-sm tracking-[0.25em] text-amber-400 font-bold uppercase">
          {ad.sponsorLine}
        </div>
        <div className="text-sm text-green-300/80 leading-relaxed max-w-lg mx-auto">
          {ad.sponsorDetail}
        </div>
      </div>
    </div>
  );
}
