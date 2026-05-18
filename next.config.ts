import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

// Pin the Turbopack workspace root to THIS file's directory. Without this,
// Next.js heuristically walks up looking for the highest package-lock.json
// and grabbed `/Users/nickweisberg/` (Doc's home), then loaded `.env.local`
// from there — which doesn't exist, so ANTHROPIC_API_KEY never reached the
// runtime and every /api/segment call 500'd with "Could not resolve
// authentication method." Pinning fixes that and silences the multi-lockfile
// warning at the same time.
const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
  // yt-search does a dynamic require('cheerio') that Turbopack can't see at
  // bundle time, so the bundled chunk doesn't include cheerio AND Vercel's
  // output tracing doesn't ship it. Marking yt-search/cheerio as external
  // tells Next.js to require them at runtime, and outputFileTracingIncludes
  // forces both into the deployed node_modules so the runtime require works.
  serverExternalPackages: ["yt-search", "cheerio"],
  outputFileTracingIncludes: {
    "/api/track": [
      "./node_modules/cheerio/**/*",
      "./node_modules/yt-search/**/*",
    ],
  },
};

export default nextConfig;
