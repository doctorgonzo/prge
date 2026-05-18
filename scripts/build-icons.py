#!/usr/bin/env python3
"""Build PWA icon set for PRGE.

Generates:
  public/icon-192.png          (192x192, full-bleed wordmark)
  public/icon-512.png          (512x512, full-bleed wordmark)
  public/icon-maskable-512.png (512x512, wordmark inside ~80% safe zone)

Design: dark background (#050a08), bold "PRGE" wordmark in white,
a pink (#ec4899) accent bar beneath. One source design, rendered to
multiple sizes so re-running this script regenerates everything.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
FONT_PATH = "/System/Library/Fonts/HelveticaNeue.ttc"
# Index 1 in HelveticaNeue.ttc is HelveticaNeue-Bold on macOS.
FONT_INDEX = 1

BG = (5, 10, 8, 255)       # #050a08
FG = (255, 255, 255, 255)
PINK = (236, 72, 153, 255) # #ec4899


def _load_font(px: int) -> ImageFont.FreeTypeFont:
    """Load HelveticaNeue-Bold at the requested pixel size."""
    return ImageFont.truetype(FONT_PATH, px, index=FONT_INDEX)


def _fit_font(text: str, target_width: int, ceiling: int) -> ImageFont.FreeTypeFont:
    """Binary-search the largest font size whose rendered width fits the target."""
    lo, hi = 8, ceiling
    best = _load_font(lo)
    while lo <= hi:
        mid = (lo + hi) // 2
        font = _load_font(mid)
        w = font.getlength(text)
        if w <= target_width:
            best = font
            lo = mid + 1
        else:
            hi = mid - 1
    return best


def render_icon(size: int, content_ratio: float) -> Image.Image:
    """Render a square icon.

    `content_ratio` is the fraction of the canvas the wordmark+accent occupies.
    1.0 == full-bleed (tight margins). ~0.78 leaves safe-zone padding for
    OS masking (Android circle, squircle, etc.).
    """
    img = Image.new("RGBA", (size, size), BG)
    draw = ImageDraw.Draw(img)

    content_w = int(size * content_ratio)
    text = "PRGE"

    # Wordmark — fit width to ~content_w, ceiling is roughly 70% of canvas
    font = _fit_font(text, content_w, int(size * 0.7))

    # Measure with getbbox so we can center precisely, ignoring font metric padding.
    bbox = font.getbbox(text)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    tx = (size - tw) // 2 - bbox[0]
    # Lift the text slightly above center to leave room for the accent bar.
    ty = (size - th) // 2 - bbox[1] - int(size * 0.04)
    draw.text((tx, ty), text, font=font, fill=FG)

    # Pink accent bar under the wordmark.
    bar_w = int(tw * 0.55)
    bar_h = max(2, int(size * 0.018))
    bar_x = (size - bar_w) // 2
    bar_y = ty + bbox[3] + int(size * 0.04)
    draw.rounded_rectangle(
        (bar_x, bar_y, bar_x + bar_w, bar_y + bar_h),
        radius=bar_h // 2,
        fill=PINK,
    )

    return img


def main() -> None:
    PUBLIC.mkdir(exist_ok=True)
    targets = [
        ("icon-192.png", 192, 0.78),
        ("icon-512.png", 512, 0.78),
        # Maskable: content inside ~62% so all common OS masks (circle, squircle,
        # rounded square) leave the wordmark intact.
        ("icon-maskable-512.png", 512, 0.62),
    ]
    for name, size, ratio in targets:
        out = PUBLIC / name
        render_icon(size, ratio).save(out, "PNG", optimize=True)
        print(f"wrote {out} ({size}x{size}, content={ratio:.0%})")


if __name__ == "__main__":
    main()
