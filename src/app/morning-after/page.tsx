"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { generateNightStats, type NightStats } from "@/lib/night-stats";
import { readTodayLog, type BroadcastLog } from "@/lib/broadcast-log";

// ── Helpers ───────────────────────────────────────────────────────────

/** Madison date string for "last night" — if it's morning of May 18,
 *  the Purge was the night of May 17. */
function lastNightId(): string {
  // During daytime the Purge that just ended started on yesterday's date.
  // But if someone visits during the Purge window itself (19:00+), use today.
  const now = new Date();
  const madisonHour = parseInt(
    now.toLocaleTimeString("en-US", {
      timeZone: "America/Chicago",
      hour12: false,
      hour: "2-digit",
    }),
    10,
  );
  if (madisonHour >= 19) {
    // Purge is currently running — show tonight's stats
    return now.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
  }
  // Daytime — show last night
  const yesterday = new Date(Date.now() - 86_400_000);
  return yesterday.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

/** Format a number with commas. */
function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

/** Severity badge. */
function severityBadge(sev: 1 | 2 | 3): string {
  if (sev === 3) return "█ CRITICAL";
  if (sev === 2) return "▓ ELEVATED";
  return "░ ADVISORY";
}
function severityColor(sev: 1 | 2 | 3): string {
  if (sev === 3) return "text-red-500";
  if (sev === 2) return "text-amber-400";
  return "text-amber-700";
}

/** Fate badge color. */
function fateColor(fate: string): string {
  if (fate === "CONFIRMED ALIVE") return "text-green-500";
  if (fate === "UNCONFIRMED") return "text-amber-400";
  return "text-red-500";
}

// ── ASCII header ──────────────────────────────────────────────────────

const REPORT_HEADER = `
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   ██████╗  ██████╗ ███████╗████████╗                         ║
║   ██╔══██╗██╔═══██╗██╔════╝╚══██╔══╝                        ║
║   ██████╔╝██║   ██║███████╗   ██║                            ║
║   ██╔═══╝ ██║   ██║╚════██║   ██║                            ║
║   ██║     ╚██████╔╝███████║   ██║                            ║
║   ╚═╝      ╚═════╝ ╚══════╝   ╚═╝                           ║
║                                                              ║
║   B R O A D C A S T   R E P O R T                            ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝`;

// ── Component ─────────────────────────────────────────────────────────

export default function MorningAfterPage() {
  const [stats, setStats] = useState<NightStats | null>(null);
  const [personalLog, setPersonalLog] = useState<BroadcastLog | null>(null);
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    const url = window.location.href;
    try {
      // Try native share first (mobile)
      if (navigator.share) {
        await navigator.share({
          title: "POST-BROADCAST INCIDENT REPORT — PRGE",
          text: "I survived the Purge. Classified debrief enclosed.",
          url,
        });
        return;
      }
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Last resort: prompt
      window.prompt("Copy this link:", url);
    }
  }, []);

  useEffect(() => {
    const nightId = lastNightId();
    setStats(generateNightStats(nightId));
    setPersonalLog(readTodayLog());
    setMounted(true);
  }, []);

  // Derived counts from personal log
  const personalStats = useMemo(() => {
    if (!personalLog) return null;
    const sessionMinutes = (() => {
      try {
        const [sh, sm] = personalLog.sessionStart.split(":").map(Number);
        const [eh, em] = personalLog.sessionEnd.split(":").map(Number);
        let startMin = sh * 60 + sm;
        let endMin = eh * 60 + em;
        // Handle midnight crossing
        if (endMin < startMin) endMin += 24 * 60;
        return endMin - startMin;
      } catch {
        return 0;
      }
    })();
    return {
      sessionMinutes,
      crisisCount: personalLog.crises.length,
      callerCount: personalLog.callers.length,
      nickTrackCount: personalLog.nickCutIns.length,
      timInterruptCount: personalLog.timInterrupts,
      retroAdCount: personalLog.retroAds,
      segmentCount: personalLog.segmentsSeen.length,
      sirenWitnessed: personalLog.sirenPlayed,
      signalStrength: personalLog.finalSignalStrength,
      lowestSignalStrength: personalLog.lowestSignalStrength ?? personalLog.finalSignalStrength,
      signalDrops: personalLog.signalDrops ?? 0,
      deadAirEvents: personalLog.deadAirEvents ?? 0,
      viewerCount: personalLog.finalViewerCount,
    };
  }, [personalLog]);

  if (!mounted || !stats) {
    return (
      <main className="prge-frame min-h-screen bg-black text-amber-200 font-mono flex items-center justify-center">
        <div className="text-amber-700 tracking-widest text-sm animate-pulse">
          DECRYPTING BROADCAST LOG...
        </div>
      </main>
    );
  }

  const aliveCount = stats.callerFates.filter(
    (c) => c.fate === "CONFIRMED ALIVE",
  ).length;
  const unconfirmedCount = stats.callerFates.filter(
    (c) => c.fate === "UNCONFIRMED",
  ).length;
  const signalLostCount = stats.callerFates.filter(
    (c) => c.fate === "SIGNAL LOST",
  ).length;

  return (
    <main className="prge-frame min-h-screen relative bg-black text-amber-200 font-mono">
      {/* CRT overlays */}
      <div className="prge-scanlines pointer-events-none fixed inset-0 z-40" />
      <div className="prge-vignette pointer-events-none fixed inset-0 z-30" />

      {/* Top strip */}
      <div className="fixed top-0 inset-x-0 z-20 px-4 py-2 flex justify-between items-center text-[12px] tracking-widest border-b border-amber-900/50 bg-black/80">
        <div className="text-amber-600">
          <span className="text-red-500/60 mr-2">█</span>
          DECLASSIFIED · POST-BROADCAST · INTERNAL USE ONLY
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={handleShare}
            className="text-red-400 hover:text-red-200 hover:bg-red-400/10 px-2 py-1 transition-colors cursor-pointer"
          >
            {copied ? "[LINK COPIED]" : "[SHARE REPORT]"}
          </button>
          <Link
            href="/"
            className="text-amber-400 hover:text-amber-200 hover:bg-amber-400/10 px-2 py-1 transition-colors"
          >
            [TUNE IN &rarr;]
          </Link>
          <Link
            href="/about"
            className="text-amber-400 hover:text-amber-200 hover:bg-amber-400/10 px-2 py-1 transition-colors"
          >
            [DOSSIER]
          </Link>
        </div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 pt-14 pb-28 text-[15px] leading-relaxed">
        {/* ═══ CLASSIFIED HEADER ═══ */}
        <pre className="text-amber-400 text-[11px] md:text-[13px] leading-tight overflow-x-auto mb-2">
          {REPORT_HEADER}
        </pre>

        <div className="text-center mb-2">
          <div className="text-red-500 text-[12px] tracking-[0.5em] mb-1">
            CLASSIFIED · LEVEL 3 · DESTROY AFTER READING
          </div>
          <div className="text-amber-600 text-[12px] tracking-widest">
            NIGHT ID: {stats.nightId} · MADISON WI · PURGE RADIO GOLDEN EAGLE
          </div>
        </div>

        <pre className="text-red-500/70 text-[12px] border border-red-900/60 bg-red-950/10 p-2 mb-8 text-center whitespace-pre-wrap">
{`▓▓▓  THIS DOCUMENT IS A POST-ACTION SUMMARY OF LAST NIGHT'S  ▓▓▓
▓▓▓  BROADCAST. DISTRIBUTION OUTSIDE THE OPERATOR CIRCLE IS   ▓▓▓
▓▓▓  A FEDERAL OFFENSE UNDER ▓▓▓▓▓▓▓▓ ACT §12.4(b).          ▓▓▓`}
        </pre>

        {/* ═══ 01. MADISON STATUS ═══ */}
        <div className="mb-10">
          <div className="text-amber-400 text-sm tracking-widest mb-4">
            ═══ 01. MADISON STATUS ══════════════════════════
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <StatBox
              label="CONFIRMED DEAD"
              value={fmt(stats.deathToll)}
              color="text-red-500"
            />
            <StatBox
              label="EMERGENCY BROADCASTS"
              value={String(stats.emergencyBroadcasts)}
              color="text-amber-300"
            />
            <StatBox
              label="SIGNAL INTERRUPTIONS"
              value={String(stats.signalInterruptions)}
              color="text-amber-400"
            />
            <StatBox
              label="CALLER CHECK-INS"
              value={String(stats.callerCheckIns)}
              color="text-green-500"
            />
          </div>

          <div className="border-l-2 border-amber-700/50 pl-4 text-[13px] text-amber-600 space-y-1">
            <p>
              &gt; All-clear siren confirmed at{" "}
              <span className="text-amber-300">{stats.sunriseTime}</span>.
              Sunrise protocols initiated.
            </p>
            <p>
              &gt; Emergency services:{" "}
              <span className="text-amber-300">RESUMING</span>. Response times
              estimated 45–90 min.
            </p>
            <p>
              &gt; Cell coverage:{" "}
              <span className="text-amber-300">PARTIAL</span>. Tower
              restoration in progress.
            </p>
            <p>
              &gt; Tap water advisory:{" "}
              <span className="text-red-400">ACTIVE</span> · West Side + Monona
              sectors.
            </p>
          </div>
        </div>

        {/* ═══ 02. BROADCAST SUMMARY ═══ */}
        <div className="mb-10">
          <div className="text-amber-400 text-sm tracking-widest mb-4">
            ═══ 02. BROADCAST SUMMARY ══════════════════════
          </div>

          <pre className="text-amber-300 text-[13px] leading-snug whitespace-pre-wrap mb-4">
{`BROADCAST WINDOW    19:00 → 07:00 (12 hours)
SIGN-ON             TIM PEPLINSKI · 18:50
SIGN-OFF            TIM PEPLINSKI · 06:50
ALL-CLEAR           ${stats.sunriseTime}
STATION BREACH      YES · INTRUDERS REPELLED
NICK TRULINO SONGS  ${stats.nickSongCount}
SIGNAL STATUS       MAINTAINED (with ${stats.signalInterruptions} interruption${stats.signalInterruptions !== 1 ? "s" : ""})`}
          </pre>

          <div className="text-amber-700 text-[12px] tracking-widest">
            // all hosts accounted for // equipment secured // transmitter
            holding //
          </div>
        </div>

        {/* ═══ 03. CRISIS DOSSIER ═══ */}
        <div className="mb-10">
          <div className="text-amber-400 text-sm tracking-widest mb-4">
            ═══ 03. CRISIS DOSSIER ═════════════════════════
          </div>
          <div className="text-amber-600 text-[12px] tracking-widest mb-3">
            {stats.crises.length} INCIDENT{stats.crises.length !== 1 ? "S" : ""}{" "}
            LOGGED · CHRONOLOGICAL ORDER
          </div>

          <div className="space-y-3">
            {stats.crises.map((crisis, i) => (
              <div
                key={`crisis-${i}`}
                className="border border-amber-900/40 bg-amber-950/10 p-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
                  <div className="text-amber-300 font-bold tracking-wider text-[14px]">
                    [{crisis.hour}] {crisis.title.toUpperCase()}
                  </div>
                  <div
                    className={`text-[12px] tracking-widest ${severityColor(crisis.severity)}`}
                  >
                    {severityBadge(crisis.severity)}
                  </div>
                </div>
                <div className="text-amber-500 text-[12px] tracking-wider mb-2 uppercase">
                  TYPE: {crisis.type.replace("-", " ")}
                </div>
                <div className="text-amber-200/80 text-[13px] pl-3 border-l border-amber-700/50">
                  &gt; {crisis.outcome}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ═══ 04. CALLER REGISTRY ═══ */}
        <div className="mb-10">
          <div className="text-amber-400 text-sm tracking-widest mb-4">
            ═══ 04. CALLER REGISTRY ════════════════════════
          </div>
          <div className="text-amber-600 text-[12px] tracking-widest mb-3">
            {stats.callerFates.length} REGISTERED CALLERS ·{" "}
            <span className="text-green-500">{aliveCount} ALIVE</span> ·{" "}
            <span className="text-amber-400">{unconfirmedCount} UNCONFIRMED</span>{" "}
            · <span className="text-red-500">{signalLostCount} SIGNAL LOST</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
            {stats.callerFates.map((caller, i) => (
              <div
                key={`caller-${i}`}
                className="flex items-baseline justify-between px-3 py-1 border-b border-amber-900/20 text-[13px]"
              >
                <div>
                  <span className="text-amber-300">{caller.name}</span>
                  <span className="text-amber-700 ml-2">
                    {caller.neighborhood}
                  </span>
                </div>
                <div
                  className={`tracking-widest text-[11px] ${fateColor(caller.fate)}`}
                >
                  {caller.fate}
                </div>
              </div>
            ))}
          </div>

          <div className="text-amber-700 text-[12px] mt-3 border-l-2 border-amber-900/40 pl-3">
            &gt; &quot;SIGNAL LOST&quot; does not confirm death. It means the
            caller&apos;s device stopped transmitting. Causes include battery
            failure, EMP interference, device destruction, or{" "}
            <span className="bg-amber-900/30 px-1">▓▓▓▓▓▓▓▓</span>.
          </div>
        </div>

        {/* ═══ 05. YOUR INCIDENT REPORT (shareable debrief card) ═══ */}
        {personalLog && personalStats ? (
          <div className="mb-10">
            <div className="text-green-500 text-sm tracking-widest mb-4">
              ═══ 05. POST-BROADCAST INCIDENT REPORT ═══════
            </div>

            {/* ── Shareable card ── screenshot-friendly self-contained block */}
            <div className="border-2 border-amber-600/60 bg-black p-5 md:p-8 relative overflow-hidden">
              {/* Corner classification stamps */}
              <div className="absolute top-2 left-3 text-red-500/40 text-[10px] tracking-[0.3em]">
                CLASSIFIED
              </div>
              <div className="absolute top-2 right-3 text-red-500/40 text-[10px] tracking-[0.3em]">
                CLASSIFIED
              </div>

              {/* Header */}
              <div className="text-center mb-6 pt-4">
                <div className="text-red-500 text-[11px] tracking-[0.5em] mb-2">
                  ▓▓▓ RESTRICTED ▓▓▓
                </div>
                <div className="text-amber-300 text-lg md:text-xl tracking-wider font-bold mb-1">
                  POST-BROADCAST INCIDENT REPORT
                </div>
                <div className="text-amber-500 text-[12px] tracking-[0.3em]">
                  PURGE RADIO GOLDEN EAGLE · MADISON WI
                </div>
                <div className="text-amber-600 text-[12px] tracking-widest mt-1">
                  NIGHT OF {personalLog.nightId} · FREQ 91.1
                </div>
              </div>

              {/* Horizontal rule */}
              <div className="text-amber-700/50 text-[12px] text-center mb-5">
                ════════════════════════════════════════════
              </div>

              {/* Survivor badge */}
              <div className="text-center mb-6">
                <div className="inline-block border-2 border-green-500/60 px-6 py-3 relative">
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-black px-2 text-green-600 text-[10px] tracking-[0.4em]">
                    STATUS
                  </div>
                  <div className="text-green-400 text-xl md:text-2xl font-bold tracking-wider">
                    SURVIVOR STATUS: CONFIRMED
                  </div>
                  <div className="text-green-600 text-[11px] tracking-widest mt-1">
                    SUBJECT MAINTAINED SIGNAL THROUGH {personalStats.sessionMinutes > 0 ? `${personalStats.sessionMinutes} MIN` : "UNKNOWN DURATION"} OF BROADCAST
                  </div>
                </div>
              </div>

              {/* Session window */}
              <pre className="text-amber-300/80 text-[12px] md:text-[13px] leading-relaxed whitespace-pre-wrap mb-5 pl-2 border-l-2 border-amber-700/40">
{`TUNED IN        ${personalLog.sessionStart}
LAST CONTACT    ${personalLog.sessionEnd}
TIME ON AIR     ${personalStats.sessionMinutes > 0 ? `${Math.floor(personalStats.sessionMinutes / 60)}h ${personalStats.sessionMinutes % 60}m` : "▓▓▓▓▓▓"}
SIREN HEARD     ${personalStats.sirenWitnessed ? "YES — COMMENCEMENT SIREN CONFIRMED" : "NO"}`}
              </pre>

              {/* Core stats grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
                <StatBox
                  label="CALLERS TRACKED"
                  value={String(personalStats.callerCount)}
                  color="text-amber-300"
                />
                <StatBox
                  label="CRISES SURVIVED"
                  value={String(personalStats.crisisCount)}
                  color="text-red-400"
                />
                <StatBox
                  label="SIGNAL DROPS"
                  value={String(personalStats.signalDrops)}
                  color="text-amber-400"
                />
                <StatBox
                  label="DEAD AIR EVENTS"
                  value={String(personalStats.deadAirEvents)}
                  color="text-amber-500"
                />
                <StatBox
                  label="NICK CUT-INS"
                  value={String(personalStats.nickTrackCount)}
                  color="text-green-400"
                />
                <StatBox
                  label="TIM INTERRUPTS"
                  value={String(personalStats.timInterruptCount)}
                  color="text-amber-300"
                />
              </div>

              {/* Signal strength block */}
              <div className="border border-amber-900/40 bg-amber-950/10 p-3 mb-5">
                <div className="text-amber-500 text-[11px] tracking-widest mb-2">
                  SIGNAL INTEGRITY REPORT
                </div>
                <div className="flex flex-wrap gap-4 md:gap-8">
                  <div>
                    <div className="text-amber-700 text-[10px] tracking-widest">LOWEST RECORDED</div>
                    <div className={`text-lg font-bold tracking-wider ${
                      personalStats.lowestSignalStrength > 60 ? "text-green-400"
                      : personalStats.lowestSignalStrength > 30 ? "text-amber-400"
                      : "text-red-500"
                    }`}>
                      {personalStats.lowestSignalStrength}%
                    </div>
                  </div>
                  <div>
                    <div className="text-amber-700 text-[10px] tracking-widest">AT SIGN-OFF</div>
                    <div className={`text-lg font-bold tracking-wider ${
                      personalStats.signalStrength > 60 ? "text-green-400"
                      : personalStats.signalStrength > 30 ? "text-amber-400"
                      : "text-red-500"
                    }`}>
                      {personalStats.signalStrength}%
                    </div>
                  </div>
                  <div>
                    <div className="text-amber-700 text-[10px] tracking-widest">DROPS BELOW 40%</div>
                    <div className="text-amber-300 text-lg font-bold tracking-wider">
                      {personalStats.signalDrops}
                    </div>
                  </div>
                </div>
                {personalStats.lowestSignalStrength <= 15 && (
                  <div className="text-red-500/70 text-[11px] tracking-widest mt-2">
                    ▓ NEAR-TOTAL SIGNAL LOSS RECORDED — RECEIVER INTEGRITY COMPROMISED ▓
                  </div>
                )}
              </div>

              {/* Redacted flavor blocks */}
              <div className="space-y-1 mb-5 text-[12px]">
                <div className="text-amber-700">
                  BROADCAST ORIGIN: <span className="bg-amber-900/40 text-amber-900/40 px-8">TRANSMITTER SITE REDACTED</span>
                </div>
                <div className="text-amber-700">
                  OPERATOR ID: <span className="text-amber-500">TIM PEPLINSKI</span> · CLEARANCE: <span className="bg-amber-900/40 text-amber-900/40 px-6">LEVEL ▓▓</span>
                </div>
                <div className="text-amber-700">
                  LISTENER DEVICE: <span className="bg-amber-900/40 text-amber-900/40 px-12">DEVICE FINGERPRINT REDACTED</span>
                </div>
                <div className="text-amber-700">
                  ASSIGNED HANDLER: <span className="bg-amber-900/40 text-amber-900/40 px-10">[REDACTED]</span>
                </div>
              </div>

              {/* Retro ads + viewer count */}
              <div className="border-l-2 border-amber-700/40 pl-4 text-[12px] text-amber-600 space-y-1 mb-5">
                <p>&gt; Retro ads survived: <span className="text-amber-300">{personalStats.retroAdCount}</span></p>
                <p>&gt; Segment types witnessed: <span className="text-amber-300">{personalStats.segmentCount}</span> ({personalLog.segmentsSeen.join(", ") || "none"})</p>
                {personalStats.viewerCount && (
                  <>
                    <p>&gt; Known receivers at close: <span className="text-amber-300">{fmt(personalStats.viewerCount.receivers)}</span></p>
                    {personalStats.viewerCount.anomalous > 0 && (
                      <p>&gt; Anomalous signals detected: <span className="text-red-400">{personalStats.viewerCount.anomalous}</span></p>
                    )}
                  </>
                )}
              </div>

              {/* Nick's tracks list */}
              {personalLog.nickCutIns.length > 0 && (
                <div className="mb-4">
                  <div className="text-amber-500 text-[11px] tracking-widest mb-2">
                    NICK TRULINO · YOUR SETLIST
                  </div>
                  <div className="space-y-0.5">
                    {personalLog.nickCutIns.map((track, i) => (
                      <div
                        key={`track-${i}`}
                        className="text-[12px] text-amber-400/70 pl-3"
                      >
                        {i + 1}. {track.artist} &mdash; &quot;{track.title}&quot;
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Crises witnessed */}
              {personalLog.crises.length > 0 && (
                <div className="mb-4">
                  <div className="text-amber-500 text-[11px] tracking-widest mb-2">
                    CRISES WITNESSED
                  </div>
                  <div className="space-y-0.5">
                    {personalLog.crises.map((c, i) => (
                      <div
                        key={`pc-${i}`}
                        className="text-[12px] text-amber-400/70 pl-3"
                      >
                        &gt; {c.title}
                        <span className="text-amber-700 ml-2">
                          [SEV {c.severity}]
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bottom classification + share prompt */}
              <div className="text-center mt-6 pt-4 border-t border-amber-900/30">
                <div className="text-red-500/50 text-[10px] tracking-[0.4em] mb-3">
                  DESTROY AFTER READING · UNAUTHORIZED DISTRIBUTION IS A FEDERAL OFFENSE
                </div>
                <button
                  onClick={handleShare}
                  className="border border-amber-600/50 bg-amber-950/20 hover:bg-amber-900/30 text-amber-400 hover:text-amber-200 px-5 py-2 text-[12px] tracking-widest transition-colors cursor-pointer"
                >
                  {copied ? "█ LINK COPIED TO CLIPBOARD █" : "[ SHARE THIS REPORT ]"}
                </button>
                <div className="text-amber-800 text-[10px] tracking-widest mt-2">
                  // DISTRIBUTE TO OTHER SURVIVORS AT YOUR OWN RISK //
                </div>
              </div>

              {/* Corner stamps bottom */}
              <div className="absolute bottom-2 left-3 text-red-500/30 text-[10px] tracking-[0.3em]">
                PRGE-{personalLog.nightId}
              </div>
              <div className="absolute bottom-2 right-3 text-red-500/30 text-[10px] tracking-[0.3em]">
                INCIDENT REPORT
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-10">
            <div className="text-amber-700 text-sm tracking-widest mb-4">
              ═══ 05. POST-BROADCAST INCIDENT REPORT ═══════
            </div>
            <div className="border-2 border-amber-900/30 bg-amber-950/5 p-6 md:p-8 text-center">
              <div className="text-red-500/60 text-[11px] tracking-[0.4em] mb-4">
                ▓▓▓ ACCESS DENIED ▓▓▓
              </div>
              <div className="text-amber-400 text-lg tracking-wider font-bold mb-3">
                NO BROADCAST DATA FOUND
              </div>
              <div className="text-amber-600 text-[14px] tracking-wider mb-4">
                WERE YOU EVEN LISTENING?
              </div>
              <div className="text-amber-800 text-[12px] max-w-md mx-auto space-y-2">
                <p>
                  This section generates a personal incident report from your
                  broadcast session. It requires tuning in during the Purge.
                </p>
                <p>
                  Your broadcast log is stored locally on your device.
                  It never leaves your machine. <span className="bg-amber-900/30 px-1">▓▓▓▓▓▓</span> cannot access it.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-amber-900/20">
                <Link
                  href="/"
                  className="text-amber-500 hover:text-amber-300 text-[12px] tracking-widest transition-colors"
                >
                  [ TUNE IN TO GENERATE YOUR REPORT ]
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ═══ 06. OPERATOR SIGN-OFF ═══ */}
        <div className="mb-10">
          <div className="text-amber-400 text-sm tracking-widest mb-4">
            ═══ 06. OPERATOR SIGN-OFF ══════════════════════
          </div>

          <div className="border-2 border-amber-700/50 p-6 text-center">
            <div className="text-amber-600 text-[12px] tracking-[0.4em] mb-4">
              SIGNED BY
            </div>
            <div className="text-amber-300 text-xl tracking-wider font-bold mb-1">
              TIM PEPLINSKI
            </div>
            <div className="text-amber-500 text-[13px] tracking-widest mb-4">
              STATION OPERATOR · PRGE · MADISON
            </div>
            <div className="text-amber-200/80 text-[14px] italic max-w-md mx-auto mb-4">
              &quot;We made it to sunrise. That&apos;s all I ever promise. Same
              frequency next year. Same station. Same people — if we&apos;re all
              still here.&quot;
            </div>
            <div className="text-amber-700 text-[12px] tracking-widest">
              BROADCAST CONCLUDED · {stats.sunriseTime} · EQUIPMENT SECURED
            </div>
          </div>
        </div>

        {/* Faux classification footer */}
        <pre className="text-amber-700/50 text-[11px] leading-snug whitespace-pre-wrap mt-8 text-center">
{`╔══════════════════════════════════════════════════════════════╗
║  END OF REPORT · NIGHT ${stats.nightId}                        ║
║  FILE UNDER: BROADCAST RECORDS / ANNUAL / CLASSIFIED         ║
║  RETENTION PERIOD: INDEFINITE                                ║
║  AUTHORIZED EYES: OPERATOR CIRCLE ONLY                       ║
╚══════════════════════════════════════════════════════════════╝

// auto-generated by PRGE internal systems
// hash: ${hashDisplay(stats.nightId)} //
// this document will self-destruct at 18:00 //`}
        </pre>
      </div>

      {/* Bottom strip */}
      <div className="fixed bottom-0 inset-x-0 z-20 h-8 bg-black/90 border-t border-amber-900/50 flex items-center justify-between px-4 text-[12px] tracking-widest text-amber-700">
        <span>// PRGE · POST-BROADCAST REPORT · {stats.nightId} //</span>
        <Link
          href="/"
          className="text-amber-600 hover:text-amber-300 transition-colors"
        >
          [RETURN TO BROADCAST &rarr;]
        </Link>
      </div>
    </main>
  );
}

// ── Sub-components ────────────────────────────────────────────────────

function StatBox({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="border border-amber-900/30 bg-amber-950/10 p-2 text-center">
      <div className={`text-lg font-bold tracking-wider ${color}`}>{value}</div>
      <div className="text-amber-700 text-[10px] tracking-widest mt-1">
        {label}
      </div>
    </div>
  );
}

/** Fake hash display from nightId for flavor text. */
function hashDisplay(nightId: string): string {
  let h = 0;
  for (let i = 0; i < nightId.length; i++) {
    h = (h * 31 + nightId.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(16).padStart(8, "0").slice(0, 8);
}
