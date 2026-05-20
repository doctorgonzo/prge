"use client";

import { useEffect, useRef, useState } from "react";

// ── Phosphor Persistence Hook ─────────────────────────────────────────
// Tracks the previously displayed line text so layout components can render
// a fading "ghost" of the old line behind the current one — simulating CRT
// phosphor burn-in. Only retains the most recently departed line.
//
// Usage: const ghostLine = usePhosphorGhost(currentText, lineIndex);
// Returns null when there's no ghost to show, otherwise the previous text.
// The ghost key increments on each change so the CSS animation re-triggers.

interface PhosphorGhost {
  text: string;
  key: number;
}

export function usePhosphorGhost(
  currentText: string | undefined,
  lineIndex: number,
): PhosphorGhost | null {
  const [ghost, setGhost] = useState<PhosphorGhost | null>(null);
  const prevTextRef = useRef<string | undefined>(undefined);
  const ghostKeyRef = useRef(0);

  useEffect(() => {
    const prevText = prevTextRef.current;
    prevTextRef.current = currentText;

    // On the very first line, there's no previous text to ghost.
    if (prevText === undefined || prevText === currentText) return;

    // New line arrived — ghost the old one.
    ghostKeyRef.current++;
    setGhost({ text: prevText, key: ghostKeyRef.current });

    // Clear after the 2s CSS fade completes so the DOM stays clean.
    const timer = setTimeout(() => setGhost(null), 2100);
    return () => clearTimeout(timer);
  }, [lineIndex, currentText]);

  return ghost;
}
