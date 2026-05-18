import Link from "next/link";

// PRGE station dossier — pirate radio aesthetic. Hand-coded zine vibe, not
// designed-landing-page vibe. Voice is paranoid, in-the-know, in-world. The
// reader is assumed to have found this on purpose. No fourth-wall breaks
// (station-bible hard constraint #5) — PRGE is real, the feds are real, this
// page might be down by morning.
//
// Visual cues: heavy monospace, ASCII art header, redacted block treatments
// (▓▓▓▓), terminal-dump layout, faux-PGP signature, edit-history breadcrumbs.

interface HostBio {
  name: string;
  role: string;
  voice: string;
  hours: string;
  status: string;
}

const HOSTS: HostBio[] = [
  {
    name: "QUINN FOLEY",
    role: "ANCHOR · late-night talk",
    voice: "I am four whiskeys in, the night is young, and I have *names*.",
    hours: "21:00 · 01:00 cut-ins · 05:00 · 06:00",
    status: "WANTED · last seen Madison · evading successors",
  },
  {
    name: "TUCKER TRAYWICK",
    role: "FIELD · they/them · analytics",
    voice:
      "Kill count up 9% from this point last year. East Side's pulling weight. Back to the studio.",
    hours: "22:00 · 02:00",
    status: "FIELD-DEPLOYED · transmission may terminate without warning",
  },
  {
    name: "SISTER MARIGOLD VANCE",
    role: "WELLNESS · the Sisters of the Pause",
    voice: "Breathe in. The ones outside are not your responsibility. Breathe out.",
    hours: "23:00 · 03:00",
    status: "AFFILIATION REDACTED · order unconfirmed",
  },
  {
    name: "NICK TRULINO",
    role: "DJ · music block · proprietor (in absentia)",
    voice:
      "This next one — Descendents, 'Hope,' off Milo Goes to College. You know what to do.",
    hours: "00:00 cocky · 04:00 collapse",
    status: "FUGITIVE · do not confirm broadcast location",
  },
  {
    name: "TIM PEPLINSKI",
    role: "OPERATOR · station owner · signal runner",
    voice: "Quinn, your mic is hot. Quinn. Quinn, the *mic*.",
    hours: "18:50 sign-on · 06:50 sign-off · all-hours cut-ins",
    status: "ACTIVE · the only one who survives every year",
  },
  {
    name: "HOLDEN",
    role: "SPORTS · analytical",
    voice:
      "If you look at the energy load pattern from 11pm to 1am, what you see is —",
    hours: "20:00 · 02:00",
    status: "ACTIVE · married to Caroline",
  },
  {
    name: "CAROLINE",
    role: "WEATHER · clipped · always cites sources",
    voice: "Holden. *Holden.* Weather. Now.",
    hours: "20:00 · 01:00 cut-ins",
    status: "ACTIVE · married to Holden",
  },
];

const ASCII_LOGO = `
  ██████╗ ██████╗  ██████╗ ███████╗
  ██╔══██╗██╔══██╗██╔════╝ ██╔════╝
  ██████╔╝██████╔╝██║  ███╗█████╗
  ██╔═══╝ ██╔══██╗██║   ██║██╔══╝
  ██║     ██║  ██║╚██████╔╝███████╗
  ╚═╝     ╚═╝  ╚═╝ ╚═════╝ ╚══════╝
`;

export default function AboutPage() {
  return (
    <main className="prge-frame min-h-screen relative bg-black text-amber-200 font-mono">
      {/* CRT overlays */}
      <div className="prge-scanlines pointer-events-none fixed inset-0 z-40" />
      <div className="prge-vignette pointer-events-none fixed inset-0 z-30" />

      {/* Minimal top strip */}
      <div className="fixed top-0 inset-x-0 z-20 px-4 py-2 flex justify-between items-center text-[12px] tracking-widest border-b border-amber-900/50 bg-black/80">
        <div className="text-amber-600">
          <span className="text-red-500 mr-2 animate-pulse">█</span>
          UNLICENSED FREQUENCY · UNTRACEABLE · MIRROR.04
        </div>
        <Link
          href="/"
          className="text-amber-400 hover:text-amber-200 hover:bg-amber-400/10 px-2 py-1 transition-colors"
        >
          [TUNE IN &rarr;]
        </Link>
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 pt-12 pb-24 text-[16px] leading-relaxed">
        {/* WARNING BLOCK */}
        <pre className="text-red-500 text-[13px] border border-red-900 bg-red-950/20 p-3 mb-8 whitespace-pre-wrap">
{`╔════════════════════════════════════════════════════╗
║  WARNING · WARNING · WARNING · WARNING · WARNING   ║
╠════════════════════════════════════════════════════╣
║  YOU ARE ON THE OPEN INTERNET.                     ║
║  THIS PAGE CACHES. THIS PAGE LOGS. THIS PAGE       ║
║  WILL BE TAKEN DOWN. MIRROR LOCALLY IF POSSIBLE.   ║
║                                                    ║
║  RECOMMENDED: TOR · VPN · BURNER DEVICE            ║
║  WIPE BROWSER CACHE AFTER USE.                     ║
║  DO NOT BOOKMARK THIS URL.                         ║
╚════════════════════════════════════════════════════╝`}
        </pre>

        {/* ASCII LOGO */}
        <pre className="text-amber-400 text-sm md:text-base leading-tight overflow-x-auto">
{ASCII_LOGO}
        </pre>

        <div className="text-amber-300 text-center mt-2 mb-8 tracking-[0.4em] text-sm">
          PURGE RADIO &middot; 2169 &middot; MADISON WI
        </div>

        <div className="text-amber-700 text-[12px] mb-10 text-center tracking-widest">
          // last edited by ▓▓▓▓▓▓▓▓ // 19 days ago // commit hash{" "}
          <span className="text-amber-500">7a4f2c1</span> //
        </div>

        {/* PROLOGUE */}
        <div className="border-l-2 border-amber-700/60 pl-4 mb-10 text-amber-200">
          <div className="text-amber-500 text-[12px] tracking-widest mb-2">
            [PROLOGUE]
          </div>
          <p>
            If you found this you already know what we are. If you didn&apos;t,
            you shouldn&apos;t have. One night a year we go live. The rest of
            the year we move equipment. The rest of the year we get hunted.
          </p>
          <p className="mt-3">
            We have been on this band since the Vance Succession. We will be
            on this band until the signal stops coming back. Some hosts
            don&apos;t come back. We name the ones who don&apos;t.
          </p>
        </div>

        {/* SECTION: THE PURGE */}
        <div className="mb-10">
          <div className="text-amber-400 text-sm tracking-widest mb-3">
            ═══ 01. THE PURGE ═══════════════════════════
          </div>
          <p>
            Annual 12-hour suspension of all law. Universal franchise, 19:00
            to 07:00. Level-10 and above ▓▓▓▓▓▓▓▓▓▓▓ are protected. All other
            crime is legal.
          </p>
          <p className="mt-3">
            Instituted late 2020s under the consolidated authoritarian
            government that emerged from Trump&apos;s third term, the Vance
            Succession, and the cabinet that followed. 140+ years of
            precedent. Multiple generations have known nothing else.
          </p>
          <p className="mt-3 text-amber-400">
            &gt; The wealthy hire security.
            <br />
            &gt; The poor barricade and pray.
            <br />
            &gt; Most stay home.
            <br />
            &gt; We broadcast for the third group.
          </p>
        </div>

        {/* SECTION: MADISON */}
        <div className="mb-10">
          <div className="text-amber-400 text-sm tracking-widest mb-3">
            ═══ 02. THE GROUND ══════════════════════════
          </div>
          <p>
            Madison, 2169. Lake Mendota still wet. State Street ruin/market
            depending on the day. Capitol fortified, regional seat. Beltline
            backs up at the west exits. Supper clubs that survived still
            serve. East Side runs hottest. Cell coverage dies after midnight.
            Neighborhood generators kick in around 02:00, usually.
          </p>
        </div>

        {/* SECTION: STATION */}
        <div className="mb-10">
          <div className="text-amber-400 text-sm tracking-widest mb-3">
            ═══ 03. THE LEGAL POSITION ═════════════════
          </div>
          <p>
            Broadcasting during the Purge is technically legal — no-law
            clause. The rest of the year we sit on an unlicensed frequency
            band for preparation.
            <br />
            <span className="text-red-400">That</span> part is the federal
            crime.
          </p>
          <p className="mt-3">
            Annual penalty if caught:{" "}
            <span className="bg-amber-900/40 px-1">REDACTED</span>. Standing
            advisory:{" "}
            <span className="bg-amber-900/40 px-1">REDACTED</span>. Known
            successors to Quinn:{" "}
            <span className="bg-amber-900/40 px-1">▓▓▓▓▓▓▓ ▓▓▓▓▓▓▓▓</span>,{" "}
            <span className="bg-amber-900/40 px-1">▓▓▓▓▓▓▓▓▓</span>.
          </p>
        </div>

        {/* SECTION: HOSTS */}
        <div className="mb-10">
          <div className="text-amber-400 text-sm tracking-widest mb-3">
            ═══ 04. ON THE AIR ══════════════════════════
          </div>
          <div className="space-y-5">
            {HOSTS.map((h) => (
              <div
                key={h.name}
                className="border border-amber-900/40 bg-amber-950/10 p-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
                  <div className="text-amber-300 font-bold tracking-wider">
                    [OP] {h.name}
                  </div>
                  <div className="text-amber-700 text-[12px] tracking-widest">
                    {h.hours}
                  </div>
                </div>
                <div className="text-amber-500 text-[13px] tracking-wider mb-2">
                  {h.role}
                </div>
                <div className="text-amber-200 text-[14px] pl-3 border-l border-amber-700/50">
                  &gt; &quot;{h.voice}&quot;
                </div>
                <div className="text-red-500/80 text-[12px] mt-2 tracking-widest">
                  [STATUS] {h.status}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION: SCHEDULE */}
        <div className="mb-10">
          <div className="text-amber-400 text-sm tracking-widest mb-3">
            ═══ 05. BROADCAST GRID ═════════════════════
          </div>
          <pre className="text-amber-300 text-[13px] leading-snug whitespace-pre-wrap">
{`HHMM  HOST(S)                   FORMAT
────  ─────────────────────     ──────────────────────
1900  Quinn/Caroline/Holden/Tim Sign-on · Opening News
2000  Caroline + Holden         Weather · Sports · Rant
2100  Quinn                     Solo late-night talk
2200  Tucker                    Field hour · cut-off
2300  Sister Marigold           Wellness (script drifts)
0000  Nick Trulino              Music · early · cocky
0100  Quinn/Caroline/Holden     Mixed cut-ins
0200  Tucker + Holden           Numbers · methodology
0300  Sister Marigold           Returns · glossolalia
0400  Nick Trulino              Music · COLLAPSE HOUR
0500  Quinn                     Pre-dawn · survivor calls
0600  All hosts                 Final hour · sunrise
0650  Tim                       Sign-off`}
          </pre>
        </div>

        {/* SECTION: HOW TO LISTEN */}
        <div className="mb-10">
          <div className="text-amber-400 text-sm tracking-widest mb-3">
            ═══ 06. OPERATIONAL SECURITY ═══════════════
          </div>
          <pre className="text-amber-300 text-[13px] leading-snug whitespace-pre-wrap">
{`[1] DO NOT broadcast that you are listening.
[2] DO NOT share the frequency over voice/SMS.
[3] DO assume the signal is triangulated by 03:00.
[4] DO have a backup analog source (battery radio).
[5] DO have water, food, light. Twelve hours is long.
[6] IF the broadcast cuts before 06:50, do not call in.
    We are off-air for a reason. Wait until next year.`}
          </pre>
        </div>

        {/* SECTION: CTA */}
        <div className="text-center mb-10 py-8 border-y border-amber-700/50">
          <div className="text-red-500 text-[12px] tracking-[0.4em] mb-4 animate-pulse">
            █ THE BAND IS LIVE █
          </div>
          <Link
            href="/"
            className="inline-block border-2 border-amber-400 px-10 py-3 text-amber-400 text-base tracking-[0.4em] font-bold hover:bg-amber-400 hover:text-black transition-colors"
          >
            TUNE IN
          </Link>
          <div className="text-amber-700 text-[12px] tracking-widest mt-4">
            STAY HOME · STAY INSIDE · STAY WITH US
          </div>
        </div>

        {/* FAUX PGP SIGNATURE */}
        <pre className="text-amber-700 text-[12px] leading-snug whitespace-pre-wrap mt-12 opacity-70">
{`-----BEGIN PGP SIGNED MESSAGE-----
Hash: SHA512

This dossier is authentic as of the commit hash above.
Subsequent edits invalidate this signature. If you are
reading this on a mirror that does not preserve the
original signature, assume the document has been altered.

Operators are paid in canned goods, batteries, and
silence. Donations to drop-points only. No digital trail.

-----BEGIN PGP SIGNATURE-----

iQIzBAEBCgAdFiEE${"▓".repeat(20)}AAoJEHa9${"▓".repeat(8)}
${"▓".repeat(40)}xC2yp9q1
${"▓".repeat(40)}f4Lk2pNm
${"▓".repeat(40)}r8vYqWzE
=t7Hx
-----END PGP SIGNATURE-----`}
        </pre>
      </div>

      {/* Bottom strip */}
      <div className="fixed bottom-0 inset-x-0 z-20 h-8 bg-black/90 border-t border-amber-900/50 flex items-center justify-between px-4 text-[12px] tracking-widest text-amber-700">
        <span>// PRGE · UNLICENSED · UNTRACEABLE //</span>
        <span className="text-red-500/70 animate-pulse">█ HAIL THE SIGNAL</span>
      </div>
    </main>
  );
}
