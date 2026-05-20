"use client";

import { useCallback, useRef, useState } from "react";
import {
  CATEGORY_LABEL,
  HOST_LABEL,
  type PlayerLine,
  type PlayerTickerItem,
} from "@/components/player-types";

// ── Props ──────────────────────────────────────────────────────────────
export interface BroadcastCaptureProps {
  /** Current host dialog line (host + text). */
  currentLine?: PlayerLine;
  /** In-world segment title (e.g. "Neighborhood Watch Hour"). */
  segmentTitle: string;
  /** Madison time string "HH:MM". */
  madisonTime: string;
  /** Merged ticker items — first item is used as the headline. */
  tickerItems: PlayerTickerItem[];
  /** Signal strength 0-100, drives the bar meter in the capture. */
  signalStrength: number;
}

// ── Canvas dimensions (social-media friendly) ──────────────────────────
const W = 1200;
const H = 630;

// ── Color palette ──────────────────────────────────────────────────────
const BG = "#0a0a0a";
const AMBER = "#fbbf24";
const AMBER_DIM = "rgba(251, 191, 36, 0.4)";
const GREEN = "#4ade80";
const GREEN_DIM = "rgba(74, 222, 128, 0.35)";
const PINK = "#f472b6";
const WHITE_DIM = "rgba(255, 255, 255, 0.06)";

// ── Helpers ────────────────────────────────────────────────────────────

/** Word-wrap a string to fit within `maxWidth` pixels on a canvas context.
 *  Returns an array of lines. */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

// ── Component ──────────────────────────────────────────────────────────
export function BroadcastCapture({
  currentLine,
  segmentTitle,
  madisonTime,
  tickerItems,
  signalStrength,
}: BroadcastCaptureProps) {
  const [label, setLabel] = useState("CAPTURE");
  const cooldownRef = useRef(false);

  const capture = useCallback(() => {
    if (cooldownRef.current) return;
    cooldownRef.current = true;

    // ── Create offscreen canvas ──────────────────────────────────────
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const maybeCtx = canvas.getContext("2d");
    if (!maybeCtx) {
      cooldownRef.current = false;
      return;
    }
    // Bind to a const so TypeScript narrows it for closures below.
    const ctx: CanvasRenderingContext2D = maybeCtx;

    // ── Background ───────────────────────────────────────────────────
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    // Subtle noise grain — random semi-transparent dots
    for (let i = 0; i < 12000; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.01 + Math.random() * 0.025})`;
      ctx.fillRect(x, y, 1, 1);
    }

    // ── CRT scanlines ────────────────────────────────────────────────
    for (let y = 0; y < H; y += 3) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
      ctx.fillRect(0, y, W, 1);
    }

    // ── Vignette ─────────────────────────────────────────────────────
    const vignette = ctx.createRadialGradient(
      W / 2, H / 2, W * 0.15,
      W / 2, H / 2, W * 0.75,
    );
    vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
    vignette.addColorStop(0.7, "rgba(0, 0, 0, 0.3)");
    vignette.addColorStop(1, "rgba(0, 0, 0, 0.7)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);

    // ── Phosphor glow utility ────────────────────────────────────────
    function drawGlowText(
      text: string,
      x: number,
      y: number,
      color: string,
      glowAlpha: number = 0.5,
    ) {
      // Glow layer
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.globalAlpha = glowAlpha;
      ctx.fillText(text, x, y);
      // Crisp layer
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.fillText(text, x, y);
    }

    const LEFT = 60;
    const RIGHT = W - 60;
    const CONTENT_W = RIGHT - LEFT;
    let cursorY = 0;

    // ── Top bar: PRGE branding + time ────────────────────────────────
    // Horizontal rule
    cursorY = 54;
    ctx.fillStyle = GREEN_DIM;
    ctx.fillRect(LEFT, cursorY, CONTENT_W, 1);

    // "PRGE" left
    ctx.font = "bold 16px monospace";
    ctx.fillStyle = AMBER;
    ctx.textBaseline = "bottom";
    drawGlowText("PRGE", LEFT, cursorY - 8, AMBER, 0.6);

    // "LIVE" pill
    const prgeW = ctx.measureText("PRGE").width;
    ctx.fillStyle = PINK;
    drawGlowText("\u25CF", LEFT + prgeW + 10, cursorY - 8, PINK, 0.7);
    ctx.fillStyle = GREEN;
    ctx.font = "bold 11px monospace";
    drawGlowText("LIVE", LEFT + prgeW + 24, cursorY - 9, GREEN, 0.5);

    // Time — right-aligned
    ctx.font = "bold 14px monospace";
    ctx.fillStyle = GREEN;
    const timeStr = `MADISON \u00B7 ${madisonTime}`;
    const timeW = ctx.measureText(timeStr).width;
    drawGlowText(timeStr, RIGHT - timeW, cursorY - 8, GREEN, 0.5);

    // Signal bars next to time
    const barStartX = RIGHT - timeW - 40;
    const activeBars =
      signalStrength >= 80 ? 5
      : signalStrength >= 60 ? 4
      : signalStrength >= 40 ? 3
      : signalStrength >= 20 ? 2
      : 1;
    const barColor = activeBars <= 2 ? AMBER : GREEN;
    for (let b = 0; b < 5; b++) {
      const barH = 4 + b * 2.5;
      ctx.fillStyle = b < activeBars ? barColor : "rgba(255,255,255,0.1)";
      ctx.globalAlpha = b < activeBars ? 0.9 : 0.2;
      ctx.fillRect(barStartX + b * 6, cursorY - 6 - barH, 4, barH);
    }
    ctx.globalAlpha = 1;

    // ── Segment title ────────────────────────────────────────────────
    cursorY = 100;
    if (segmentTitle) {
      ctx.font = "bold 13px monospace";
      ctx.fillStyle = AMBER_DIM;
      ctx.textBaseline = "top";
      drawGlowText(
        segmentTitle.toUpperCase(),
        LEFT,
        cursorY,
        AMBER,
        0.3,
      );
      cursorY += 32;
    }

    // ── Host label ───────────────────────────────────────────────────
    if (currentLine) {
      const hostLabel =
        HOST_LABEL[currentLine.host] ?? currentLine.host.toUpperCase();
      ctx.font = "bold 14px monospace";
      ctx.fillStyle = PINK;
      ctx.textBaseline = "top";
      drawGlowText(hostLabel, LEFT, cursorY, PINK, 0.5);
      cursorY += 28;

      // ── Dialog text (word-wrapped) ─────────────────────────────────
      ctx.font = "22px monospace";
      ctx.fillStyle = GREEN;
      ctx.textBaseline = "top";
      const wrapped = wrapText(ctx, currentLine.text, CONTENT_W);
      for (const line of wrapped) {
        drawGlowText(line, LEFT, cursorY, GREEN, 0.4);
        cursorY += 32;
      }
    }

    // ── Ticker headline ──────────────────────────────────────────────
    // Positioned at the bottom, above the bottom rule.
    const tickerY = H - 72;
    ctx.fillStyle = GREEN_DIM;
    ctx.fillRect(LEFT, tickerY - 12, CONTENT_W, 1);

    if (tickerItems.length > 0) {
      const item = tickerItems[0];
      const catLabel =
        CATEGORY_LABEL[item.category] ?? item.category.toUpperCase();

      // Category badge
      ctx.font = "bold 11px monospace";
      ctx.fillStyle = PINK;
      ctx.textBaseline = "top";
      drawGlowText(`[${catLabel}]`, LEFT, tickerY, PINK, 0.5);

      // Headline text — truncate if too long
      const badgeW = ctx.measureText(`[${catLabel}]`).width + 10;
      ctx.font = "13px monospace";
      ctx.fillStyle = "rgba(134, 239, 172, 0.85)"; // green-300 ish
      let headlineText = item.text;
      const maxTickerW = CONTENT_W - badgeW;
      while (
        ctx.measureText(headlineText).width > maxTickerW &&
        headlineText.length > 10
      ) {
        headlineText = headlineText.slice(0, -4) + "\u2026";
      }
      drawGlowText(headlineText, LEFT + badgeW, tickerY + 1, GREEN, 0.3);
    }

    // ── Bottom rule + frequency tag ──────────────────────────────────
    const bottomY = H - 36;
    ctx.fillStyle = GREEN_DIM;
    ctx.fillRect(LEFT, bottomY, CONTENT_W, 1);

    ctx.font = "10px monospace";
    ctx.fillStyle = "rgba(74, 222, 128, 0.3)";
    ctx.textBaseline = "top";
    drawGlowText(
      "PRGE 97.3 FM \u2014 MADISON, WI \u2014 PURGE NIGHT EMERGENCY BROADCAST",
      LEFT,
      bottomY + 8,
      GREEN,
      0.15,
    );

    // ── Phosphor bloom — a faint horizontal sweep to sell the CRT ────
    const bloom = ctx.createLinearGradient(0, H * 0.3, 0, H * 0.5);
    bloom.addColorStop(0, "rgba(0, 255, 100, 0)");
    bloom.addColorStop(0.5, "rgba(0, 255, 100, 0.015)");
    bloom.addColorStop(1, "rgba(0, 255, 100, 0)");
    ctx.fillStyle = bloom;
    ctx.fillRect(0, H * 0.3, W, H * 0.2);

    // ── Second pass scanlines (on top of everything for depth) ───────
    ctx.globalAlpha = 0.12;
    for (let y = 0; y < H; y += 2) {
      ctx.fillStyle = WHITE_DIM;
      ctx.fillRect(0, y, W, 1);
    }
    ctx.globalAlpha = 1;

    // ── Export ────────────────────────────────────────────────────────
    canvas.toBlob(async (blob) => {
      if (!blob) {
        cooldownRef.current = false;
        return;
      }

      // Try clipboard first, fall back to download
      let copied = false;
      try {
        if (navigator.clipboard && typeof ClipboardItem !== "undefined") {
          await navigator.clipboard.write([
            new ClipboardItem({ "image/png": blob }),
          ]);
          copied = true;
        }
      } catch {
        // Clipboard blocked — fall through to download
      }

      if (!copied) {
        // Download fallback
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `prge-${madisonTime.replace(":", "")}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }

      // Flash feedback
      setLabel(copied ? "COPIED" : "SAVED");
      setTimeout(() => {
        setLabel("CAPTURE");
        cooldownRef.current = false;
      }, 1200);
    }, "image/png");
  }, [currentLine, segmentTitle, madisonTime, tickerItems, signalStrength]);

  return (
    <button
      type="button"
      onClick={capture}
      className="text-green-700 hover:text-green-400 transition-colors text-[10px] tracking-widest cursor-pointer select-none"
      title="Capture broadcast screenshot"
    >
      {label === "CAPTURE" ? (
        label
      ) : (
        <span className="text-amber-400">{label}</span>
      )}
    </button>
  );
}
