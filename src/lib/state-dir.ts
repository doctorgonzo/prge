// src/lib/state-dir.ts
// Resolve the base directory for PRGE's durable on-disk state.
//
// Locally: project-relative `.prge/` lives alongside the repo so dev artifacts
// (segments cache, band-facts, budget ledger, track resolutions) are
// human-inspectable next to the code that wrote them.
//
// On Vercel: `process.cwd()` is `/var/task/` which is READ-ONLY. Writes there
// fail with EROFS and the whole API tips over. `/tmp/prge` is writable per
// lambda invocation (ephemeral; lost when the container spins down, but shared
// across invocations on a warm container). That gives us cache hits within a
// warm container's lifetime without crashing on cold writes.
//
// Both deployed code paths (read and write) use this same base so we never
// read from one location and write to another.
import { join } from "node:path";

export const PRGE_STATE_DIR = process.env.VERCEL
  ? "/tmp/prge"
  : join(process.cwd(), ".prge");
