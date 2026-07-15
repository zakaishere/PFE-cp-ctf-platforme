"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  Lock, Search, CheckCircle2, AlertCircle, Loader2, LayoutGrid, Users,
} from "lucide-react";
import {
  getCtfCompetitionChallenges,
  type CTFChallengeListResponse, type CTFCompetitionChallengeDTO,
} from "@/lib/api";
import { useCTFCompetition } from "@/features/ctf/context/CTFCompetitionContext";
import { CAT_CONFIG, catFor } from "@/features/ctf/shared/categoryConfig";
import ChallengeCard from "@/features/ctf/shared/ChallengeCard";
import { toast } from "@/components/ui/PSPToast";

const pad2 = (n: number) => String(n).padStart(2, "0");

export default function ChallengesPage() {
  const { id } = useParams<{ id: string }>();
  const ctx = useCTFCompetition();

  const [data, setData]       = useState<CTFChallengeListResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = () => {
    setLoading(true);
    getCtfCompetitionChallenges(id)
      .then(setData)
      .catch(() => toast.error("Failed to load challenges", "Please try again."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  // Status transitions (UPCOMING → ACTIVE etc.) ask for a refetch, since the
  // shape of the response changes (UPCOMING returns categoryCounts, otherwise
  // a real challenge list).
  useEffect(() => {
    if (!ctx.status) return;
    reload();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.status]);

  // Also re-fetch when a notification suggests the catalog changed.
  useEffect(() => {
    const latest = ctx.notifications[0];
    if (!latest) return;
    if (latest.type === "NEW_CHALLENGE" || latest.type === "CHALLENGE_UPDATED" || latest.type === "HINT_ADDED") {
      reload();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.notifications]);

  if (loading || !ctx.competition) {
    return <PageSpinner />;
  }

  const status = ctx.status ?? ctx.competition.status;

  if (status === "UPCOMING") {
    return <PreStartView startTime={ctx.competition.startTime} categoryCounts={data?.categoryCounts ?? null} hasTeam={ctx.myTeam !== null} />;
  }

  // Active/Ended but no team: show gate instead of challenges grid
  if (!ctx.myTeam) {
    return <NoTeamView competition={ctx.competition} status={status} />;
  }

  return (
    <ActiveBoard
      competitionId={id}
      challenges={data?.challenges ?? []}
      isEnded={status === "ENDED"}
    />
  );
}

// ── Pre-start view ────────────────────────────────────────────────────────────

function PreStartView({ startTime, categoryCounts, hasTeam }: {
  startTime: string | null;
  categoryCounts: Record<string, number> | null;
  hasTeam: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const ms = startTime ? Math.max(0, new Date(startTime).getTime() - now) : null;
  const total = ms !== null ? Math.floor(ms / 1000) : null;
  const d = total !== null ? Math.floor(total / 86400) : 0;
  const h = total !== null ? Math.floor((total % 86400) / 3600) : 0;
  const m = total !== null ? Math.floor((total % 3600) / 60) : 0;
  const s = total !== null ? total % 60 : 0;

  useEffect(() => {
    if (ms === 0 && typeof window !== "undefined") {
      const t = setTimeout(() => window.location.reload(), 1500);
      return () => clearTimeout(t);
    }
  }, [ms]);

  const totalChallenges = categoryCounts
    ? Object.values(categoryCounts).reduce((a, b) => a + b, 0)
    : null;

  return (
    <div style={{
      maxWidth: 640, margin: "40px auto", textAlign: "center",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 24,
    }}>
      <Lock size={56} color="var(--ink-3)" />
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)" }}>Challenges are locked</div>
        <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 6 }}>
          {ms !== null ? "The competition starts in:" : "Waiting for the host to start the competition."}
        </div>
      </div>

      {ms !== null && (
        <div style={{
          display: "flex", gap: 14,
          fontFamily: "ui-monospace, monospace", fontWeight: 800,
        }}>
          <Unit n={d} label="days" />
          <Sep />
          <Unit n={h} label="hrs" />
          <Sep />
          <Unit n={m} label="min" />
          <Sep />
          <Unit n={s} label="sec" />
        </div>
      )}

      {categoryCounts && Object.keys(categoryCounts).length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{
            display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap",
            marginBottom: 10, opacity: 0.6,
          }}>
            {Object.keys(categoryCounts).map(cat => {
              const c = catFor(cat);
              return (
                <span key={cat} style={{ color: c.accent, display: "inline-flex", alignItems: "center" }}>
                  {c.icon}
                </span>
              );
            })}
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-2)" }}>
            Categories: {Object.keys(categoryCounts).map(c => catFor(c).label).join(" · ")}
          </div>
          {totalChallenges !== null && (
            <div style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 8 }}>
              {totalChallenges} challenge{totalChallenges !== 1 ? "s" : ""} waiting
            </div>
          )}
        </div>
      )}

      {!hasTeam && (
        <div style={{
          background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)",
          borderRadius: 8, padding: "14px 18px", display: "flex", gap: 10, alignItems: "center",
          marginTop: 8,
        }}>
          <AlertCircle size={18} color="#fbbf24" />
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#fbbf24" }}>
              You don't have a team yet
            </div>
            <div style={{ fontSize: 12, color: "var(--ink)", marginTop: 4 }}>
              Join or create one before the competition starts.
            </div>
          </div>
          <Link href={`team`}
            className="psp-btn psp-btn-primary psp-btn-sm"
            style={{ marginLeft: 8 }}>
            Go to My Team →
          </Link>
        </div>
      )}
    </div>
  );
}

// ── No team view ──────────────────────────────────────────────────────────────

function NoTeamView({ competition, status }: {
  competition: { registrationOpen: boolean; id?: string };
  status: string | null;
}) {
  const canJoin = competition.registrationOpen && status !== "ENDED";

  return (
    <div style={{
      maxWidth: 480, margin: "40px auto", textAlign: "center",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 20,
    }}>
      <Users size={56} color="var(--ink-3)" />
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)" }}>No Team Yet</div>
        <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 6 }}>
          You need to be on a team to view and solve challenges.
        </div>
      </div>

      {canJoin ? (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <Link href="team" className="psp-btn psp-btn-primary psp-btn-sm">
            Join a Team →
          </Link>
          <Link href="team" className="psp-btn psp-btn-secondary psp-btn-sm">
            Create a Team →
          </Link>
        </div>
      ) : status === "ENDED" ? (
        <div style={{
          background: "rgba(148,163,184,0.08)", border: "1px solid rgba(148,163,184,0.2)",
          borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "var(--ink-2)",
        }}>
          This competition has ended — team registration is closed.
        </div>
      ) : (
        <div style={{
          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
          borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#f87171",
        }}>
          Team registration is closed. You cannot join or create a team at this time.
        </div>
      )}
    </div>
  );
}

function Unit({ n, label }: { n: number; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <span style={{ fontSize: 34, color: "var(--ink)", lineHeight: 1 }}>{pad2(n)}</span>
      <span style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 6, letterSpacing: "0.08em", textTransform: "uppercase" }}>
        {label}
      </span>
    </div>
  );
}
function Sep() { return <span style={{ fontSize: 30, color: "var(--line-2)", lineHeight: 1 }}>:</span>; }

// ── Active board ─────────────────────────────────────────────────────────────

function ActiveBoard({ competitionId, challenges, isEnded }: {
  competitionId: string;
  challenges: CTFCompetitionChallengeDTO[];
  isEnded: boolean;
}) {
  const ctx          = useCTFCompetition();
  const searchParams = useSearchParams();
  const [activeCat, setActiveCat] = useState<string>("ALL");
  const [query, setQuery]         = useState("");

  // Difficulty + status come from URL params (set by the navtabs bar)
  const difficulty   = searchParams.get("diff")   ?? "ALL";
  const solvedFilter = searchParams.get("status") ?? "ALL";

  const [newAt, setNewAt] = useState<Record<string, number>>({});
  useEffect(() => {
    const latest = ctx.notifications[0];
    if (!latest || latest.type !== "NEW_CHALLENGE") return;
    const cid = typeof latest.metadata?.challengeId === "string" ? latest.metadata.challengeId : null;
    if (cid) setNewAt(prev => ({ ...prev, [cid]: Date.now() }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.notifications]);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (Object.keys(newAt).length === 0) return;
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, [newAt]);

  const cats = useMemo(() => {
    const present = new Set(challenges.map(c => c.category));
    return ["ALL", ...Object.keys(CAT_CONFIG).filter(k => present.has(k))];
  }, [challenges]);

  const filtered = useMemo(() => challenges.filter(c => {
    if (activeCat !== "ALL" && c.category !== activeCat) return false;
    if (difficulty !== "ALL" && c.difficulty !== difficulty) return false;
    if (solvedFilter === "UNSOLVED" && c.solvedByMe) return false;
    if (solvedFilter === "SOLVED" && !c.solvedByMe) return false;
    if (query.trim() && !c.title.toLowerCase().includes(query.trim().toLowerCase())) return false;
    return true;
  }), [challenges, activeCat, difficulty, solvedFilter, query]);

  return (
    <div className="ctf-challenges-layout">

      {/* ── Left sidebar: categories only ──────────────────────────────────── */}
      <aside className="ctf-cat-sidebar">
        <div className="ctf-sidebar-section-title">Categories</div>
        {cats.map(cat => {
          const conf = catFor(cat);
          const inCat = cat === "ALL" ? challenges : challenges.filter(c => c.category === cat);
          const solved = inCat.filter(c => c.solvedByMe).length;
          const total  = inCat.length;
          const allSolved = total > 0 && solved === total;
          const active = activeCat === cat;
          return (
            <button
              key={cat}
              type="button"
              className={`ctf-cat-item${active ? " active" : ""}${allSolved ? " all-solved" : ""}`}
              style={{ "--cat-accent": conf.accent } as React.CSSProperties}
              onClick={() => setActiveCat(cat)}
            >
              <span className="ctf-cat-icon" style={{ color: conf.accent }}>
                {cat === "ALL" ? <LayoutGrid size={14} /> : conf.icon}
              </span>
              <span className="ctf-cat-label">{conf.label}</span>
              <span className={`ctf-cat-count${allSolved ? " done" : ""}`}>
                {allSolved
                  ? <CheckCircle2 size={11} />
                  : <>{solved}<span style={{ opacity: 0.4 }}>/{total}</span></>
                }
              </span>
            </button>
          );
        })}
      </aside>

      {/* ── Right: search + challenge grid ─────────────────────────────────── */}
      <div className="ctf-challenges-content">

        {/* Search bar */}
        <div className="ctf-chall-search">
          <Search size={14} color="var(--ink-2)" />
          <input
            className="input"
            placeholder="Search challenges…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ background: "transparent", border: "none", color: "var(--ink)", flex: 1 }}
          />
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div style={{
            border: "1px solid var(--line)", borderRadius: 8, padding: 60,
            textAlign: "center", color: "var(--ink-3)",
          }}>
            {challenges.length === 0
              ? "No challenges have been revealed yet."
              : "No challenges match the current filters."}
          </div>
        ) : (
          <div className="ctf-challenge-grid">
            {filtered.map(c => (
              <ChallengeCard
                key={c.id}
                challenge={c}
                onOpen={ctx.openChallenge}
                isNew={newAt[c.id] !== undefined && now - newAt[c.id] < 60_000}
              />
            ))}
          </div>
        )}

        {isEnded && (
          <div style={{
            marginTop: 18, padding: "10px 14px",
            background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: 8,
            fontSize: 12, color: "var(--ink-2)", textAlign: "center",
          }}>
            Competition has ended — challenges remain visible for review but submissions are closed.
          </div>
        )}
      </div>
    </div>
  );
}

function PageSpinner() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
      <Loader2 size={28} style={{ animation: "spin 1s linear infinite", color: "var(--brand)" }} />
    </div>
  );
}
