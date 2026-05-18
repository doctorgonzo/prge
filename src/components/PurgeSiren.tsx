"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// The official Purge commencement siren. Plays at exactly 19:00 Madison time
// before normal Purge-night operations begin. Full-screen YouTube embed that
// auto-dismisses when the video ends. Click anywhere to skip.
//
// Video: https://www.youtube.com/watch?v=us_0aLWOa8E

const SIREN_VIDEO_ID = "us_0aLWOa8E";
const YT_ENDED = 0;

interface PurgeSirenProps {
  onComplete: () => void;
}

export function PurgeSiren({ onComplete }: PurgeSirenProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const completedRef = useRef(false);
  const [playerState, setPlayerState] = useState(-1);
  const [duration, setDuration] = useState<number | null>(null);

  const handleComplete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  }, [onComplete]);

  // YouTube postMessage listener — same protocol as RetroAdBreak.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== "https://www.youtube.com") return;

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
        if (typeof info.playerState === "number") {
          setPlayerState(info.playerState);
        }
        if (typeof info.duration === "number" && info.duration > 0) {
          setDuration(info.duration);
        }
      } else if (d.event === "onStateChange" && typeof d.info === "number") {
        setPlayerState(d.info);
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Auto-dismiss on ENDED — small delay so the last frame hangs for a beat.
  useEffect(() => {
    if (playerState === YT_ENDED) {
      const id = setTimeout(handleComplete, 800);
      return () => clearTimeout(id);
    }
  }, [playerState, handleComplete]);

  // Subscribe to YouTube iframe API events on load.
  function handleIframeLoad() {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    const target = "https://www.youtube.com";
    win.postMessage(
      JSON.stringify({
        event: "listening",
        id: "purge-siren",
        channel: "widget",
      }),
      target,
    );
    win.postMessage(
      JSON.stringify({
        event: "command",
        func: "addEventListener",
        args: ["onStateChange"],
      }),
      target,
    );
    win.postMessage(
      JSON.stringify({ event: "command", func: "playVideo", args: [] }),
      target,
    );
  }

  // Fallback timeout — use detected duration + buffer when available,
  // otherwise 3 minutes as a generous catch-all.
  useEffect(() => {
    const fallbackMs =
      duration !== null
        ? Math.round(duration * 1000 * 1.2) + 2000
        : 180_000;
    const id = setTimeout(handleComplete, fallbackMs);
    return () => clearTimeout(id);
  }, [duration, handleComplete]);

  const embedUrl = `https://www.youtube.com/embed/${SIREN_VIDEO_ID}?autoplay=1&enablejsapi=1&rel=0&modestbranding=1&controls=0&showinfo=0&fs=0&origin=${typeof window !== "undefined" ? encodeURIComponent(window.location.origin) : ""}`;

  return (
    <div
      onClick={handleComplete}
      className="fixed inset-0 z-[70] bg-black flex flex-col items-center justify-center cursor-pointer"
    >
      {/* 16:9 video, max width 4xl so it's large but doesn't stretch on ultrawide */}
      <div className="relative w-full max-w-4xl mx-auto aspect-video">
        <iframe
          ref={iframeRef}
          className="absolute inset-0 w-full h-full border-2 border-red-900/60"
          src={embedUrl}
          title="Purge Commencement Siren"
          allow="autoplay; encrypted-media"
          allowFullScreen
          onLoad={handleIframeLoad}
          style={{ boxShadow: "0 0 80px rgba(220, 38, 38, 0.2)" }}
        />
      </div>

      <div className="absolute bottom-4 right-6 text-[10px] tracking-widest text-red-400/40 font-mono">
        CLICK TO SKIP
      </div>
    </div>
  );
}
