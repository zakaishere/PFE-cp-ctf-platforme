"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import {
  Target, CheckCircle2, Search, Server, FileDown, Lock, X,
  Flag, ArrowUpRight, Users,
} from "lucide-react";
import {
  getCTFChallenges, getCTFChallenge, submitCTFFlag,
  type CTFChallengeDTO,
} from "@/lib/api";

// ── Category / difficulty colors (existing design tokens) ───────────────────

const CATEGORY_COLOR: Record<string, string> = {
  WEB:       "var(--danger)",
  PWN:       "var(--warn)",
  CRYPTO:    "var(--violet)",
  FORENSICS: "var(--warn-ink)",
  REVERSE:   "var(--blue)",
  OSINT:     "var(--accent)",
  MISC:      "var(--ink-2)",
};

const DIFF_COLOR: Record<string, string> = {
  EASY: "var(--accent)", MEDIUM: "var(--warn)", HARD: "var(--danger)",
};

const CATEGORIES = ["WEB", "PWN", "CRYPTO", "FORENSICS", "REVERSE", "OSINT", "MISC"];
const DIFFICULTIES = ["EASY", "MEDIUM", "HARD"];

const MONO = "var(--font-mono), ui-monospace, monospace";

function titleCase(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

function fmtPoints(points: number | null | undefined) {
  return points ? `${points} pts` : "— pts";
}

// ── Filter pill ──────────────────────────────────────────────────────────────

function Pill({ label, selected, color, onClick }: {
  label: string;
  selected: boolean;
  color?: string;
  onClick: () => void;
}) {
  const c = color ?? "var(--accent)";
  return (
    <button
      onClick={onClick}
      style={{
        padding: "5px 14px",
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: "nowrap",
        border: `1px solid ${selected ? c : "var(--line)"}`,
        background: selected ? `color-mix(in srgb, ${c} 12%, transparent)` : "var(--surface)",
        color: selected ? c : "var(--ink-3)",
        cursor: "pointer",
        transition: "all .15s",
      }}
    >
      {label}
    </button>
  );
}

// ── Challenge card — fixed 200px, fixed zones ────────────────────────────────

function ChallengeCard({ c, onOpen }: { c: CTFChallengeDTO; onOpen: () => void }) {
  const [hover, setHover] = useState(false);
  const catColor = CATEGORY_COLOR[c.category] ?? "var(--ink-2)";

  return (
    <div
      onClick={onOpen}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        height: 200,
        display: "flex",
        flexDirection: "column",
        background: "var(--surface)",
        border: `1px solid ${hover ? "var(--accent-ring)" : "var(--line-2)"}`,
        borderRadius: 16,
        overflow: "hidden",
        cursor: "pointer",
        transition: "border-color .2s, transform .2s, box-shadow .2s",
        transform: hover ? "translateY(-2px)" : "none",
        boxShadow: hover ? "0 8px 24px rgba(0,0,0,0.3)" : "none",
      }}
    >
      {/* Category stripe */}
      <div style={{ height: 3, flexShrink: 0, background: catColor, opacity: 0.85 }} />

      {/* Header zone */}
      <div style={{
        height: 36, flexShrink: 0, padding: "0 16px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
      }}>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
          color: catColor, textTransform: "uppercase",
        }}>
          {c.category}
        </span>
        {c.solvedByMe && (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: 10, fontWeight: 700, color: "var(--accent)",
          }}>
            <CheckCircle2 size={13} />
          </span>
        )}
      </div>

      {/* Title zone */}
      <div style={{ flex: 1, minHeight: 0, padding: "4px 16px", overflow: "hidden" }}>
        <div style={{
          fontSize: 15, fontWeight: 700, color: "var(--ink)", lineHeight: 1.35,
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}>
          {c.title}
        </div>
        <div style={{
          fontSize: 12, color: "var(--ink-3)", marginTop: 6,
          fontFamily: MONO,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          {c.requiresInstance && <Server size={11} style={{ flexShrink: 0 }} />}
          {c.downloadableFileUrl && <FileDown size={11} style={{ flexShrink: 0 }} />}
          {c.flagFormat}
        </div>
      </div>

      {/* Footer zone */}
      <div style={{
        height: 40, flexShrink: 0, padding: "0 16px",
        borderTop: "1px solid var(--line)",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <span style={{
          fontSize: 11, fontWeight: 700,
          color: DIFF_COLOR[c.difficulty] ?? "var(--ink-2)",
          border: `1px solid color-mix(in srgb, ${DIFF_COLOR[c.difficulty] ?? "var(--ink-2)"} 35%, transparent)`,
          borderRadius: 20, padding: "2px 10px",
        }}>
          {titleCase(c.difficulty)}
        </span>
        <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--ink-3)" }}>
          <Users size={12} /> {c.solveCount}
        </span>
        <span style={{
          fontSize: 13, fontWeight: 700, fontFamily: MONO,
          color: c.currentPoints ? "var(--accent)" : "var(--ink-3)",
        }}>
          {fmtPoints(c.currentPoints)}
        </span>
      </div>
    </div>
  );
}

// ── Challenge drawer ─────────────────────────────────────────────────────────

function ChallengeDrawer({ challenge, onClose, onSolved }: {
  challenge: CTFChallengeDTO;
  onClose: () => void;
  onSolved: (id: string, points: number | null) => void;
}) {
  const [detail, setDetail] = useState<CTFChallengeDTO | null>(null);
  const [flag, setFlag] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [shake, setShake] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [solved, setSolved] = useState(challenge.solvedByMe);
  const [awarded, setAwarded] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const catColor = CATEGORY_COLOR[challenge.category] ?? "var(--ink-2)";

  // Description is only returned by the detail endpoint
  useEffect(() => {
    let cancelled = false;
    getCTFChallenge(challenge.id)
      .then((d) => { if (!cancelled) setDetail(d); })
      .catch(() => { /* keep list data */ });
    return () => { cancelled = true; };
  }, [challenge.id]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const value = flag.trim();
    if (!value || submitting || solved) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await submitCTFFlag(challenge.id, value);
      if (res.correct) {
        setSolved(true);
        setAwarded(res.pointsAwarded);
        onSolved(challenge.id, res.pointsAwarded);
      } else {
        setShake(true);
        setTimeout(() => setShake(false), 450);
        setErrorMsg(res.message || "Wrong flag — try again.");
      }
    } catch (err) {
      setShake(true);
      setTimeout(() => setShake(false), 450);
      setErrorMsg(err instanceof Error && err.message ? err.message : "Submission failed — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const d = detail ?? challenge;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 999,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        display: "flex", justifyContent: "flex-end",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 460, height: "100%",
          background: "var(--bg-2)", borderLeft: "1px solid var(--line-2)",
          display: "flex", flexDirection: "column",
          animation: "ctf-drawer-in 200ms ease",
        }}
      >
        {/* Header */}
        <div style={{ height: 3, flexShrink: 0, background: catColor }} />
        <div style={{
          padding: "18px 22px 14px", borderBottom: "1px solid var(--line)",
          display: "flex", alignItems: "flex-start", gap: 12,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: catColor, textTransform: "uppercase" }}>
                {challenge.category}
              </span>
              <span style={{
                fontSize: 10, fontWeight: 700,
                color: DIFF_COLOR[challenge.difficulty] ?? "var(--ink-2)",
                border: `1px solid color-mix(in srgb, ${DIFF_COLOR[challenge.difficulty] ?? "var(--ink-2)"} 35%, transparent)`,
                borderRadius: 20, padding: "1px 8px",
              }}>
                {titleCase(challenge.difficulty)}
              </span>
              <span style={{
                fontSize: 12, fontWeight: 700, fontFamily: MONO,
                color: challenge.currentPoints ? "var(--accent)" : "var(--ink-3)",
              }}>
                {fmtPoints(challenge.currentPoints)}
              </span>
            </div>
            <div style={{ fontSize: 19, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.01em" }}>
              {challenge.title}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "transparent", border: "none", cursor: "pointer",
              color: "var(--ink-3)", padding: 4, display: "flex", flexShrink: 0,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px", display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Description */}
          <div style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
            {detail === null && !d.description
              ? <span style={{ opacity: 0.5 }}>Loading description…</span>
              : (d.description || "No description provided.")}
          </div>

          {/* Meta chips */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={{
              fontSize: 11, fontFamily: MONO, color: "var(--ink-3)",
              background: "var(--surface)", border: "1px solid var(--line)",
              borderRadius: 6, padding: "4px 8px",
            }}>
              #{challenge.category.toLowerCase()}
            </span>
            <span style={{
              fontSize: 11, fontFamily: MONO, color: "var(--ink-3)",
              background: "var(--surface)", border: "1px solid var(--line)",
              borderRadius: 6, padding: "4px 8px",
            }}>
              #{challenge.difficulty.toLowerCase()}
            </span>
            <span style={{
              fontSize: 11, fontFamily: MONO, color: "var(--ink-3)",
              background: "var(--surface)", border: "1px solid var(--line)",
              borderRadius: 6, padding: "4px 8px",
            }}>
              {challenge.flagFormat}
            </span>
          </div>

          {/* Download */}
          {d.downloadableFileUrl && (
            <a
              href={d.downloadableFileUrl}
              download={d.downloadableFileName ?? undefined}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                alignSelf: "flex-start",
                fontSize: 13, fontWeight: 600, color: "var(--ink)",
                background: "var(--surface)", border: "1px solid var(--line-2)",
                borderRadius: 8, padding: "9px 14px", textDecoration: "none",
              }}
            >
              <FileDown size={15} color="var(--accent)" />
              {d.downloadableFileName ?? "Download attachment"}
            </a>
          )}

          {/* Instance / hints live on the full page */}
          {(challenge.requiresInstance || (d.hints?.length ?? 0) > 0) && (
            <Link
              href={`/ctf/${challenge.id}`}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                alignSelf: "flex-start",
                fontSize: 13, fontWeight: 600, color: "var(--accent)",
                textDecoration: "none",
              }}
            >
              {challenge.requiresInstance ? "Start instance & view hints" : "View hints"} <ArrowUpRight size={14} />
            </Link>
          )}

          <div style={{ marginTop: "auto" }} />

          {/* Solved banner / flag form */}
          {solved ? (
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              background: "var(--accent-dim)", border: "1px solid var(--accent-ring)",
              borderRadius: 12, padding: "14px 16px",
            }}>
              <CheckCircle2 size={20} color="var(--accent)" />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)" }}>
                  Solved!
                </div>
                {awarded !== null && (
                  <div style={{ fontSize: 12, fontWeight: 700, fontFamily: MONO, color: "var(--accent)" }}>
                    +{awarded} pts
                  </div>
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: "var(--ink-3)",
                letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8,
                display: "flex", alignItems: "center", gap: 6,
              }}>
                <Flag size={12} /> Submit flag
              </div>
              <div className={shake ? "ctf-shake" : undefined} style={{ display: "flex", gap: 8 }}>
                <input
                  ref={inputRef}
                  value={flag}
                  onChange={(e) => { setFlag(e.target.value); setErrorMsg(null); }}
                  placeholder="flag{...}"
                  spellCheck={false}
                  autoComplete="off"
                  style={{
                    flex: 1, minWidth: 0,
                    background: "var(--surface)",
                    border: `1px solid ${errorMsg ? "var(--danger)" : "var(--line-2)"}`,
                    borderRadius: 8, padding: "11px 14px",
                    color: "var(--ink)", fontFamily: MONO, fontSize: 13,
                    outline: "none",
                  }}
                />
                <button
                  type="submit"
                  disabled={!flag.trim() || submitting}
                  style={{
                    background: "var(--accent)", color: "#0a0a0a",
                    border: "none", borderRadius: 8, padding: "0 18px",
                    fontSize: 13, fontWeight: 700,
                    cursor: !flag.trim() || submitting ? "not-allowed" : "pointer",
                    opacity: !flag.trim() || submitting ? 0.6 : 1,
                  }}
                >
                  {submitting ? "…" : "Submit"}
                </button>
              </div>
              {errorMsg && (
                <div style={{ marginTop: 8, fontSize: 12, color: "var(--danger)", fontWeight: 500 }}>
                  {errorMsg}
                </div>
              )}
            </form>
          )}
        </div>
      </div>

      <style jsx global>{`
        @keyframes ctf-drawer-in {
          from { transform: translateX(24px); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes ctf-shake {
          0%, 100% { transform: translateX(0); }
          20%      { transform: translateX(-6px); }
          40%      { transform: translateX(6px); }
          60%      { transform: translateX(-4px); }
          80%      { transform: translateX(4px); }
        }
        .ctf-shake { animation: ctf-shake 0.4s ease; }
      `}</style>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CTFPracticePage() {
  const [challenges, setChallenges] = useState<CTFChallengeDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [difficulty, setDifficulty] = useState("All");
  const [hideSolved, setHideSolved] = useState(false);

  const [openChallenge, setOpenChallenge] = useState<CTFChallengeDTO | null>(null);

  useEffect(() => {
    getCTFChallenges()
      .then((list) => setChallenges(list.filter((c) => c.isActive)))
      .catch(() => setChallenges([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return challenges.filter((c) =>
      (!q || c.title.toLowerCase().includes(q)) &&
      (category === "All" || c.category === category) &&
      (difficulty === "All" || c.difficulty === difficulty) &&
      (!hideSolved || !c.solvedByMe)
    );
  }, [challenges, query, category, difficulty, hideSolved]);

  const resetFilters = useCallback(() => {
    setQuery(""); setCategory("All"); setDifficulty("All"); setHideSolved(false);
  }, []);

  const markSolved = useCallback((id: string, points: number | null) => {
    setChallenges((prev) => prev.map((c) =>
      c.id === id
        ? { ...c, solvedByMe: true, solveCount: c.solveCount + 1, currentPoints: c.currentPoints || (points ?? 0) }
        : c
    ));
  }, []);

  return (
    <>
      <Navbar />

      {openChallenge && (
        <ChallengeDrawer
          challenge={openChallenge}
          onClose={() => setOpenChallenge(null)}
          onSolved={markSolved}
        />
      )}

      <div style={{ minHeight: "calc(100vh - 56px)", background: "var(--bg)", color: "var(--ink)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "44px 24px 80px" }}>

          {/* Header */}
          <div style={{ marginBottom: 20 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "var(--accent-dim)", border: "1px solid var(--accent-ring)",
              borderRadius: 999, padding: "4px 12px", fontSize: 11, fontWeight: 700,
              color: "var(--accent)", letterSpacing: "0.08em", textTransform: "uppercase",
              marginBottom: 14,
            }}>
              <Target size={12} /> Practice
            </div>
            <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em", margin: 0 }}>
              CTF Practice
            </h1>
            <p style={{ fontSize: 14, color: "var(--ink-2)", margin: "6px 0 0" }}>
              Standalone challenges — no timer, no team. Pick one and start hacking.
            </p>
          </div>

          {/* Search + hide solved */}
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 220,
              background: "var(--surface)", border: "1px solid var(--line-2)", borderRadius: 20,
              padding: "7px 14px",
            }}>
              <Search size={15} color="var(--ink-3)" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search challenges…"
                style={{
                  flex: 1, background: "transparent", border: "none", outline: "none",
                  color: "var(--ink)", fontSize: 13,
                }}
              />
            </div>
            <Pill
              label="Hide solved"
              selected={hideSolved}
              onClick={() => setHideSolved((v) => !v)}
            />
          </div>

          {/* Category pills */}
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
            <Pill label="All" selected={category === "All"} onClick={() => setCategory("All")} />
            {CATEGORIES.map((cat) => (
              <Pill
                key={cat}
                label={titleCase(cat)}
                selected={category === cat}
                color={CATEGORY_COLOR[cat]}
                onClick={() => setCategory(cat)}
              />
            ))}
          </div>

          {/* Difficulty pills */}
          <div style={{ display: "flex", gap: 8, marginTop: 10, marginBottom: 26 }}>
            <Pill label="All" selected={difficulty === "All"} onClick={() => setDifficulty("All")} />
            {DIFFICULTIES.map((diff) => (
              <Pill
                key={diff}
                label={titleCase(diff)}
                selected={difficulty === diff}
                color={DIFF_COLOR[diff]}
                onClick={() => setDifficulty(diff)}
              />
            ))}
          </div>

          {/* Grid */}
          {loading ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} style={{
                  height: 200, borderRadius: 16, background: "var(--surface)",
                  border: "1px solid var(--line)", overflow: "hidden",
                }}>
                  <div style={{ height: 3, background: "var(--line-2)" }} />
                  <div style={{ padding: 16 }}>
                    <div style={{ width: 60, height: 16, borderRadius: 6, background: "var(--surface-2)", marginBottom: 12 }} />
                    <div style={{ width: "80%", height: 14, borderRadius: 4, background: "var(--surface-2)", marginBottom: 6 }} />
                    <div style={{ width: "55%", height: 14, borderRadius: 4, background: "var(--surface-2)" }} />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", padding: "80px 0",
              border: "1px dashed var(--line-2)", borderRadius: 16,
              color: "var(--ink-3)",
            }}>
              <Lock size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
              <p style={{ fontSize: 14, margin: 0 }}>
                {challenges.length === 0
                  ? "No practice challenges yet — check back soon."
                  : "No challenges match your filters"}
              </p>
              {challenges.length > 0 && (
                <button
                  onClick={resetFilters}
                  style={{ marginTop: 12, color: "var(--accent)", fontSize: 13, background: "none", border: "none", cursor: "pointer" }}
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
              {filtered.map((c) => (
                <ChallengeCard key={c.id} c={c} onOpen={() => setOpenChallenge(c)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
