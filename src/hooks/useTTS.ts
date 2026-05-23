"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useTTS — React hook for PRGE text-to-speech
 *
 * Speaks lines via the /api/tts endpoint using Edge TTS voices.
 * Handles caching (in-memory blob URLs), prefetching next lines,
 * and cleanup on unmount.
 *
 * Usage:
 *   const { speak, stop, prefetch, speaking } = useTTS(soundEnabled);
 *   speak("Hello Doc", "nick");         // Play immediately
 *   prefetch("Next line", "quinn");      // Cache for later
 *   stop();                              // Interrupt current audio
 */

interface UseTTSReturn {
  /** Speak text with a host's voice. Stops any current audio first. */
  speak: (text: string, host: string) => Promise<void>;
  /** Stop current audio playback. */
  stop: () => void;
  /** Pre-generate and cache audio for a future line. */
  prefetch: (text: string, host: string) => Promise<void>;
  /** Whether audio is currently playing. */
  speaking: boolean;
}

export function useTTS(enabled: boolean = true): UseTTSReturn {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const cacheRef = useRef<Map<string, string>>(new Map());
  const mountedRef = useRef(true);

  // Track mounted state for async safety
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Clean up audio on unmount
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      // Revoke blob URLs
      cacheRef.current.forEach((url) => URL.revokeObjectURL(url));
      cacheRef.current.clear();
    };
  }, []);

  const fetchAudio = useCallback(
    async (text: string, host: string): Promise<string | null> => {
      const cacheKey = `${host}:${text}`;
      const cached = cacheRef.current.get(cacheKey);
      if (cached) return cached;

      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, host }),
        });
        if (!res.ok) return null;

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        cacheRef.current.set(cacheKey, url);
        return url;
      } catch {
        return null;
      }
    },
    []
  );

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (mountedRef.current) setSpeaking(false);
  }, []);

  const speak = useCallback(
    async (text: string, host: string) => {
      // Always stop current audio first
      stop();

      if (!enabled || !text.trim()) return;

      const audioUrl = await fetchAudio(text, host);
      if (!audioUrl || !mountedRef.current) return;

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        if (mountedRef.current) setSpeaking(false);
        audioRef.current = null;
      };
      audio.onerror = () => {
        if (mountedRef.current) setSpeaking(false);
        audioRef.current = null;
      };

      try {
        await audio.play();
        if (mountedRef.current) setSpeaking(true);
      } catch {
        // Autoplay blocked — browser requires user interaction first
        if (mountedRef.current) setSpeaking(false);
      }
    },
    [enabled, fetchAudio, stop]
  );

  const prefetch = useCallback(
    async (text: string, host: string) => {
      if (!enabled || !text.trim()) return;
      await fetchAudio(text, host);
    },
    [enabled, fetchAudio]
  );

  return { speak, stop, prefetch, speaking };
}
