/**
 * /api/tts — Text-to-Speech endpoint for PRGE
 *
 * Accepts POST { text, host } and returns MP3 audio.
 * Uses Microsoft Edge TTS (free, no API key) via msedge-tts (pure Node.js).
 * Caches generated audio on disk by content hash.
 */

import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from "fs";
import { join } from "path";
import { NextRequest, NextResponse } from "next/server";
import { getVoice } from "@/lib/tts-voices";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { MsEdgeTTS, OUTPUT_FORMAT } = require("msedge-tts");

const CACHE_DIR = join(process.cwd(), ".tts-cache");
const MAX_TEXT_LENGTH = 1000;

// Ensure cache directory exists
if (!existsSync(CACHE_DIR)) {
  mkdirSync(CACHE_DIR, { recursive: true });
}

async function generateTTS(text: string, voice: string): Promise<Buffer> {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
  const { audioStream } = tts.toStream(text);

  const chunks: Buffer[] = [];
  for await (const chunk of audioStream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, host } = body;

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }

    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json({ error: "Text too long" }, { status: 400 });
    }

    const voice = getVoice(host || "default");

    // Cache key: hash of voice + text
    const hash = createHash("md5")
      .update(`${voice}:${text}`)
      .digest("hex");
    const cachePath = join(CACHE_DIR, `${hash}.mp3`);

    // Serve from cache if available
    if (existsSync(cachePath)) {
      try {
        const stat = statSync(cachePath);
        if (stat.size > 0) {
          const data = readFileSync(cachePath);
          return new NextResponse(data as unknown as BodyInit, {
            headers: {
              "Content-Type": "audio/mpeg",
              "Cache-Control": "public, max-age=86400",
              "X-TTS-Cache": "hit",
            },
          });
        }
      } catch {
        // Cache file corrupted, regenerate
      }
    }

    // Generate fresh audio
    const audioBuffer = await generateTTS(text, voice);

    // Cache to disk
    writeFileSync(cachePath, audioBuffer);

    // Convert Buffer to Uint8Array for NextResponse compatibility
    return new NextResponse(audioBuffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=86400",
        "X-TTS-Cache": "miss",
      },
    });
  } catch (error) {
    console.error("[TTS] Error:", error);
    return NextResponse.json(
      { error: "TTS generation failed" },
      { status: 500 }
    );
  }
}
