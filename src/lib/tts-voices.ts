/**
 * TTS Voice Configuration for PRGE
 *
 * Maps host IDs to Microsoft Edge TTS voice names.
 * All voices are free, no API key required.
 *
 * Cast (auditioned 2026-05-23):
 *   Brian     → Nick     (approachable, casual, sincere)
 *   Eric      → Tucker   (rational — "Tucker Carlson energy")
 *   Steffan   → Tim      (rational, calm — EBS operator)
 *   Christopher → Station (reliable, authority — bumpers/IDs)
 *   Emma      → Caroline (cheerful, clear, conversational)
 *   Andrew    → Holden   (warm, confident, authentic)
 *   Connor-IE → Quinn    (Irish accent — Doc's call)
 *   Ava       → Marigold (expressive, caring — wellness/ethereal)
 */

export const VOICE_MAP: Record<string, string> = {
  nick: "en-US-BrianNeural",
  tucker: "en-US-EricNeural",
  tim: "en-US-SteffanNeural",
  caroline: "en-US-EmmaNeural",
  holden: "en-US-AndrewNeural",
  quinn: "en-IE-ConnorNeural",
  marigold: "en-US-AvaNeural",

  // Non-character voices
  station: "en-US-ChristopherNeural",
  caller: "en-US-GuyNeural",

  // Fallback
  default: "en-US-ChristopherNeural",
};

/**
 * Resolve a host ID to an Edge TTS voice name.
 */
export function getVoice(host: string): string {
  return VOICE_MAP[host.toLowerCase()] ?? VOICE_MAP.default;
}
