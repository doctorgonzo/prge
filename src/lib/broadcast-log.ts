// src/lib/broadcast-log.ts
// Lightweight localStorage-backed event log for the "Morning After" debrief.
//
// page.tsx calls logEvent() at each interesting moment (crisis, caller, Nick
// cut-in, Tim interrupt, etc.). The log accumulates through the session and
// persists across refreshes. A beforeunload handler snapshots the final
// signal strength and viewer count.
//
// The log is keyed by Madison date ("2026-05-18") so a new Purge night
// overwrites last night's data. Only the most recent night is kept.

const STORAGE_KEY = "prge-broadcast-log";

// ── Types ──────────────────────────────────────────────────────────────

export interface LoggedCrisis {
  id: string;
  type: string;
  title: string;
  severity: number;
}

export interface LoggedCaller {
  name: string;
  neighborhood: string;
  tone: string;
}

export interface LoggedNickCutIn {
  artist: string;
  title: string;
}

export interface BroadcastLog {
  /** Madison date string, e.g. "2026-05-18". */
  nightId: string;
  /** HH:MM when the viewer first tuned in. */
  sessionStart: string;
  /** HH:MM last seen — updated on beforeunload. */
  sessionEnd: string;
  /** Unique segment types witnessed (news, wellness, music-block, etc.). */
  segmentsSeen: string[];
  /** Crisis events that fired during this session. */
  crises: LoggedCrisis[];
  /** Caller popups that appeared. */
  callers: LoggedCaller[];
  /** Nick cut-in tracks that played. */
  nickCutIns: LoggedNickCutIn[];
  /** Number of Tim emergency interrupts. */
  timInterrupts: number;
  /** Number of retro ad breaks. */
  retroAds: number;
  /** Whether the 19:00 siren played. */
  sirenPlayed: boolean;
  /** Signal strength at session close (0–100). */
  finalSignalStrength: number;
  /** Lowest signal strength observed during session (0–100). */
  lowestSignalStrength: number;
  /** Number of times signal dropped below 40%. */
  signalDrops: number;
  /** Number of dead air events experienced. */
  deadAirEvents: number;
  /** Viewer count snapshot at close, if available. */
  finalViewerCount: { receivers: number; anomalous: number } | null;
}

// ── Internal helpers ───────────────────────────────────────────────────

function getMadisonDate(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Chicago",
  }); // "YYYY-MM-DD"
}

function freshLog(nightId: string, sessionStart: string): BroadcastLog {
  return {
    nightId,
    sessionStart,
    sessionEnd: sessionStart,
    segmentsSeen: [],
    crises: [],
    callers: [],
    nickCutIns: [],
    timInterrupts: 0,
    retroAds: 0,
    sirenPlayed: false,
    finalSignalStrength: 100,
    lowestSignalStrength: 100,
    signalDrops: 0,
    deadAirEvents: 0,
    finalViewerCount: null,
  };
}

/** Migrate older logs that lack newer fields. Non-destructive. */
function migrateLog(log: BroadcastLog): BroadcastLog {
  if (log.lowestSignalStrength === undefined) log.lowestSignalStrength = log.finalSignalStrength;
  if (log.signalDrops === undefined) log.signalDrops = 0;
  if (log.deadAirEvents === undefined) log.deadAirEvents = 0;
  return log;
}

// ── Read / write ───────────────────────────────────────────────────────

/** Read the current broadcast log from localStorage. Returns null if none
 *  exists or if it's from a different night. */
export function readLog(): BroadcastLog | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BroadcastLog;
    // Basic shape validation
    if (!parsed.nightId || !Array.isArray(parsed.crises)) return null;
    return migrateLog(parsed);
  } catch {
    return null;
  }
}

/** Read the log, but only if it's from today's Madison date. Used by the
 *  morning-after page to show "YOUR BROADCAST" — returns null if the
 *  viewer didn't watch last night. */
export function readTodayLog(): BroadcastLog | null {
  const log = readLog();
  if (!log) return null;
  // The morning-after page shows during daytime (07:00–17:59). The log's
  // nightId was set at the START of the Purge night. If a Purge runs
  // 19:00 May 17 → 07:00 May 18, and daytime is May 18, the log's
  // nightId is "2026-05-17". Accept both today and yesterday.
  const today = getMadisonDate();
  const yesterday = new Date(Date.now() - 86_400_000).toLocaleDateString(
    "en-CA",
    { timeZone: "America/Chicago" },
  );
  if (log.nightId === today || log.nightId === yesterday) return log;
  return null;
}

function writeLog(log: BroadcastLog): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
  } catch {
    // localStorage full or unavailable — degrade silently.
  }
}

// ── Ensure log exists ──────────────────────────────────────────────────

/** Get-or-create the log for tonight. Called once at session start. */
export function ensureLog(madisonTime: string): BroadcastLog {
  const nightId = getMadisonDate();
  const existing = readLog();
  if (existing && existing.nightId === nightId) return existing;
  // New night — start fresh.
  const log = freshLog(nightId, madisonTime);
  writeLog(log);
  return log;
}

// ── Event loggers ──────────────────────────────────────────────────────

export function logCrisis(crisis: LoggedCrisis): void {
  const log = readLog();
  if (!log) return;
  // Dedupe by crisis id.
  if (log.crises.some((c) => c.id === crisis.id)) return;
  log.crises.push(crisis);
  writeLog(log);
}

export function logCaller(caller: LoggedCaller): void {
  const log = readLog();
  if (!log) return;
  // Allow duplicate names (same caller can text in multiple times).
  log.callers.push(caller);
  writeLog(log);
}

export function logNickCutIn(cutIn: LoggedNickCutIn): void {
  const log = readLog();
  if (!log) return;
  log.nickCutIns.push(cutIn);
  writeLog(log);
}

export function logTimInterrupt(): void {
  const log = readLog();
  if (!log) return;
  log.timInterrupts++;
  writeLog(log);
}

export function logRetroAd(): void {
  const log = readLog();
  if (!log) return;
  log.retroAds++;
  writeLog(log);
}

export function logSiren(): void {
  const log = readLog();
  if (!log) return;
  log.sirenPlayed = true;
  writeLog(log);
}

export function logSegmentType(segmentType: string): void {
  const log = readLog();
  if (!log) return;
  if (!log.segmentsSeen.includes(segmentType)) {
    log.segmentsSeen.push(segmentType);
    writeLog(log);
  }
}

/** Track signal strength — updates lowest-ever and counts drops below 40%. */
export function logSignalStrength(strength: number): void {
  const log = readLog();
  if (!log) return;
  let changed = false;
  if (strength < log.lowestSignalStrength) {
    log.lowestSignalStrength = strength;
    changed = true;
  }
  // Count a "drop" each time signal crosses below 40% from above.
  // We use lowestSignalStrength being >= 40 before this call as a simple gate,
  // but a more accurate approach: track if we were above 40 before.
  // For simplicity, count each unique low-water mark crossing.
  if (strength < 40 && log.finalSignalStrength >= 40) {
    log.signalDrops++;
    changed = true;
  }
  log.finalSignalStrength = strength;
  if (changed) writeLog(log);
}

export function logDeadAir(): void {
  const log = readLog();
  if (!log) return;
  log.deadAirEvents++;
  writeLog(log);
}

export function logSessionEnd(
  madisonTime: string,
  signalStrength: number,
  viewerCount?: { receivers: number; anomalous: number },
): void {
  const log = readLog();
  if (!log) return;
  log.sessionEnd = madisonTime;
  log.finalSignalStrength = signalStrength;
  if (viewerCount) log.finalViewerCount = viewerCount;
  writeLog(log);
}
