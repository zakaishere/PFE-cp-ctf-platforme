"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { KeyRound, ArrowRight, Trophy, Clock, Zap, Users, AlertCircle, X, Lock, Unlock } from "lucide-react";
import {
  getCtfCompetitions,
  joinCtfByAccessCode,
  type CTFCompetitionDTO,
} from "@/lib/api";

// ── Time helpers ─────────────────────────────────────────────────────────────

function useCountdown(targetIso: string | null) {
  const [remaining, setRemaining] = useState(() =>
    targetIso ? Math.max(0, new Date(targetIso).getTime() - Date.now()) : 0);

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(targetIso ? Math.max(0, new Date(targetIso).getTime() - Date.now()) : 0);
    }, 1000);
    return () => clearInterval(id);
  }, [targetIso]);

  const total = remaining;
  const d = Math.floor(total / 86400000);
  const h = Math.floor((total % 86400000) / 3600000);
  const m = Math.floor((total % 3600000) / 60000);
  const s = Math.floor((total % 60000) / 1000);
  return { remaining, d, h, m, s };
}

function fmtCountdown(d: number, h: number, m: number, s: number) {
  if (d > 0) return `${d}d ${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ── Timer display: handles all timing modes + statuses correctly ─────────────

function TimerDisplay({ comp }: { comp: CTFCompetitionDTO }) {
  const effectiveEnd = (comp as { computedEndTime?: string | null }).computedEndTime ?? comp.endTime;
  const target = comp.started ? effectiveEnd : comp.startTime;
  const { remaining, d, h, m, s } = useCountdown(target);
  const critical = comp.started && !comp.ended && remaining < 3600_000;

  // Competition ended
  if (comp.ended || comp.status === "ENDED") {
    return null; // Status badge already says ENDED
  }

  // MANUAL/REGISTRATION mode with no fixed time
  if (!target) {
    if (comp.started) {
      return (
        <span style={{ fontSize: 12, fontWeight: 600, color: "#34d399" }}>
          <Clock size={11} style={{ display: "inline", marginRight: 5, verticalAlign: -1 }} />
          In progress
        </span>
      );
    }
    return (
      <span style={{ fontSize: 12, fontWeight: 600, color: "#60a5fa" }}>
        <Clock size={11} style={{ display: "inline", marginRight: 5, verticalAlign: -1 }} />
        Starting soon
      </span>
    );
  }

  return (
    <span style={{
      fontSize: 12, fontWeight: 600, fontFamily: "ui-monospace, monospace",
      color: critical ? "#f87171" : "#94a3b8",
    }}>
      <Clock size={11} style={{ display: "inline", marginRight: 5, verticalAlign: -1 }} />
      {comp.started ? "Ends in " : "Starts in "}
      {fmtCountdown(d, h, m, s)}
    </span>
  );
}

// ── Access code modal ────────────────────────────────────────────────────────

function AccessCodeModal({ comp, onClose, onSuccess }: {
  comp: CTFCompetitionDTO;
  onClose: () => void;
  onSuccess: (id: string) => void;
}) {
  const [code, setCode] = useState("");
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function handleSubmit() {
    const trimmed = code.trim();
    if (!trimmed) { setError("Enter the access code."); return; }
    setError(null);
    setValidating(true);
    try {
      const joined = await joinCtfByAccessCode(trimmed);
      onSuccess(joined.id);
    } catch {
      setError("Invalid access code. Please try again.");
      setCode("");
      inputRef.current?.focus();
    } finally {
      setValidating(false);
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 999,
      background: "rgba(0,0,0,0.65)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={onClose}>
      <div style={{
        background: "#111827", border: "1px solid #1e293b", borderRadius: 12,
        padding: 28, width: "100%", maxWidth: 380, position: "relative",
      }} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} style={{
          position: "absolute", top: 14, right: 14,
          background: "transparent", border: "none", cursor: "pointer", color: "#64748b",
          display: "flex", alignItems: "center",
        }}>
          <X size={18} />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <KeyRound size={16} color="#a5b4fc" />
          <span style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc" }}>Access Code Required</span>
        </div>
        <p style={{ fontSize: 13, color: "#64748b", marginBottom: 18 }}>
          "{comp.title}" requires an access code to enter.
        </p>

        <input
          ref={inputRef}
          type="text"
          value={code}
          onChange={(e) => { setError(null); setCode(e.target.value.toUpperCase().replace(/\s+/g, "")); }}
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); if (e.key === "Escape") onClose(); }}
          placeholder="ENTER CODE"
          maxLength={30}
          disabled={validating}
          style={{
            width: "100%", boxSizing: "border-box",
            background: "#0a0f1e", border: `1px solid ${error ? "#ef4444" : "#1e293b"}`,
            borderRadius: 8, padding: "12px 16px", color: "#f1f5f9",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 16, fontWeight: 600, letterSpacing: "0.08em",
            outline: "none", marginBottom: 12,
          }}
        />

        {error && (
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            color: "#f87171", fontSize: 13, marginBottom: 12,
          }}>
            <AlertCircle size={13} /> {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} disabled={validating} style={{
            flex: 1, padding: "10px 0", background: "transparent",
            border: "1px solid #1e293b", borderRadius: 8, color: "#94a3b8",
            fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>
            Cancel
          </button>
          <LoadingButton
            loading={validating}
            onClick={handleSubmit}
            disabled={!code.trim()}
            style={{
              flex: 2, padding: "10px 0",
              background: "linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%)",
              border: "none", borderRadius: 8, color: "#fff",
              fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}
          >
            Enter
          </LoadingButton>
        </div>
      </div>
    </div>
  );
}

// ── Open Competition Card ────────────────────────────────────────────────────

function CompetitionCard({ comp }: { comp: CTFCompetitionDTO }) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const ended = comp.ended || comp.status === "ENDED";

  const bannerColor = comp.bannerUrl?.startsWith("color:")
    ? comp.bannerUrl.slice(6)
    : "#6366f1";
  const coverImageUrl = comp.coverImageUrl ?? null;

  function handleEnter(e: React.MouseEvent) {
    e.preventDefault();
    if (comp.visibility === "ACCESS_CODE") {
      setShowModal(true);
    } else {
      router.push(`/ctf/competitions/${comp.id}`);
    }
  }

  return (
    <>
      {showModal && (
        <AccessCodeModal
          comp={comp}
          onClose={() => setShowModal(false)}
          onSuccess={(id) => router.push(`/ctf/competitions/${id}`)}
        />
      )}

      <div
        className="ctf-entry-card"
        onClick={handleEnter}
        style={{
          background: "#111827",
          border: "1px solid #1e293b",
          borderRadius: 10,
          overflow: "hidden",
          transition: "all 150ms ease",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          minHeight: 280,
        }}
      >
        {/* Cover image / gradient banner */}
        <div style={{
          position: "relative",
          width: "100%", height: 112, flexShrink: 0,
          background: coverImageUrl
            ? undefined
            : `linear-gradient(135deg, ${bannerColor ?? "#6366f1"}33 0%, ${bannerColor ?? "#8b5cf6"}55 100%)`,
          overflow: "hidden",
        }}>
          {coverImageUrl && (
            <img
              src={coverImageUrl}
              alt={comp.title}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          )}
          {/* Status badge – absolute top-left */}
          <div style={{ position: "absolute", top: 10, left: 12 }}>
            {ended ? (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "rgba(15,23,42,0.85)", color: "#94a3b8",
                border: "1px solid rgba(148,163,184,0.3)", borderRadius: 4,
                padding: "3px 10px", fontSize: 11, fontWeight: 700,
                letterSpacing: "0.05em", backdropFilter: "blur(4px)",
              }}>ENDED</span>
            ) : comp.started ? (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "rgba(15,23,42,0.85)", color: "#34d399",
                border: "1px solid rgba(16,185,129,0.4)", borderRadius: 4,
                padding: "3px 10px", fontSize: 11, fontWeight: 700,
                letterSpacing: "0.05em", backdropFilter: "blur(4px)",
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: "50%", background: "#34d399",
                  animation: "ctf-pulse-dot 1.5s ease infinite",
                }} />
                LIVE
              </span>
            ) : (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "rgba(15,23,42,0.85)", color: "#60a5fa",
                border: "1px solid rgba(96,165,250,0.4)", borderRadius: 4,
                padding: "3px 10px", fontSize: 11, fontWeight: 700,
                letterSpacing: "0.05em", backdropFilter: "blur(4px)",
              }}>UPCOMING</span>
            )}
          </div>
          {/* Timer – absolute top-right */}
          <div style={{ position: "absolute", top: 10, right: 12 }}>
            <TimerDisplay comp={comp} />
          </div>
        </div>

        {/* Card body */}
        <div style={{ padding: "16px 20px 20px", display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#f1f5f9", marginBottom: 6, letterSpacing: "-0.01em" }}>
            {comp.title}
          </div>
          {/* Fixed-height description: max 2 lines */}
          <div style={{
            fontSize: 13, color: "#64748b", lineHeight: 1.55,
            overflow: "hidden", display: "-webkit-box",
            WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
            height: "2.8em", flexShrink: 0, marginBottom: 14,
          }}>
            {comp.description ?? ""}
          </div>

          <div style={{ display: "flex", gap: 18, fontSize: 12, color: "#94a3b8", flexShrink: 0 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <Users size={12} /> Max {comp.maxTeamSize} per team
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <Zap size={12} color="#a78bfa" />
              <span style={{ color: "#a78bfa" }}>{comp.scoringMode === "DYNAMIC" ? "Dynamic" : "Static"}</span>
            </span>
          </div>

          {/* Spacer pushes footer to bottom */}
          <div style={{ flex: 1 }} />

          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            paddingTop: 14, marginTop: 14, borderTop: "1px solid #1e293b",
          }}>
            <span style={{ fontSize: 12, color: "#64748b" }}>
              {comp.visibility === "ACCESS_CODE" ? <span style={{display:"inline-flex",alignItems:"center",gap:4}}><Lock size={12} /> Access code</span> : <span style={{display:"inline-flex",alignItems:"center",gap:4}}><Unlock size={12} /> Open to all</span>}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, fontWeight: 700, color: "#6366f1" }}>
              Enter Competition <ArrowRight size={14} />
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CTFEntryPage() {
  const router = useRouter();

  const [accessCode, setAccessCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);

  const [competitions, setCompetitions] = useState<CTFCompetitionDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getCtfCompetitions()
      .then(setCompetitions)
      .catch(() => setCompetitions([]))
      .finally(() => setLoading(false));
  }, []);

  const open = useMemo(
    () => competitions.filter((c) => !c.ended).slice(0, 6),
    [competitions]
  );

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const code = accessCode.trim();
    if (!code) {
      setAccessError("Please enter an access code.");
      return;
    }
    setAccessError(null);
    setSubmitting(true);
    try {
      const comp = await joinCtfByAccessCode(code);
      router.push(`/ctf/competitions/${comp.id}`);
    } catch {
      setAccessError("Invalid or expired access code.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Navbar />

      <div style={{
        minHeight: "calc(100vh - 56px)",
        background: "linear-gradient(180deg, #0a0f1e 0%, #0f172a 100%)",
        color: "#f1f5f9",
      }}>
        {/* HERO ── access code entry ─────────────────────────────────────── */}
        <section style={{
          padding: "72px 24px 40px",
          textAlign: "center",
          maxWidth: 720,
          margin: "0 auto",
        }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)",
            borderRadius: 999, padding: "5px 14px", fontSize: 11, fontWeight: 700,
            color: "#a5b4fc", letterSpacing: "0.08em", textTransform: "uppercase",
            marginBottom: 22,
          }}>
            <Trophy size={12} /> CTF Arena
          </div>

          <h1 style={{
            fontSize: 44, fontWeight: 800, color: "#f8fafc",
            letterSpacing: "-0.025em", lineHeight: 1.1, marginBottom: 14,
          }}>
            CTF Competitions
          </h1>
          <p style={{ fontSize: 16, color: "#94a3b8", marginBottom: 36, lineHeight: 1.5 }}>
            Test your skills. Form a team. Compete.
          </p>

          {/* Access code box */}
          <form
            onSubmit={handleSubmit}
            style={{
              background: "#111827",
              border: "1px solid #1e293b",
              borderRadius: 12,
              padding: 22,
              boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
            }}
          >
            <div style={{
              display: "flex", alignItems: "center", gap: 8, marginBottom: 12,
              fontSize: 12, color: "#94a3b8", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase",
            }}>
              <KeyRound size={14} color="#a5b4fc" />
              Enter competition access code
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <input
                type="text"
                value={accessCode}
                onChange={(e) => {
                  setAccessError(null);
                  setAccessCode(e.target.value.toUpperCase().replace(/\s+/g, ""));
                }}
                placeholder="WINTER2025"
                maxLength={30}
                autoComplete="off"
                spellCheck={false}
                style={{
                  flex: 1,
                  background: "#0a0f1e",
                  border: `1px solid ${accessError ? "#ef4444" : "#1e293b"}`,
                  borderRadius: 8,
                  padding: "13px 16px",
                  color: "#f1f5f9",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: 16,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  outline: "none",
                  transition: "border-color 150ms ease",
                }}
                onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = "#6366f1"; }}
                onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = accessError ? "#ef4444" : "#1e293b"; }}
              />
              <LoadingButton
                type="submit"
                loading={submitting}
                disabled={!accessCode.trim()}
                style={{
                  background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "0 22px",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  letterSpacing: "0.02em",
                  whiteSpace: "nowrap",
                }}
              >
                Enter <ArrowRight size={15} />
              </LoadingButton>
            </div>

            {accessError && (
              <div style={{
                marginTop: 12, display: "flex", alignItems: "center", gap: 6,
                color: "#f87171", fontSize: 13, fontWeight: 500,
              }}>
                <AlertCircle size={14} /> {accessError}
              </div>
            )}
          </form>

          {/* Divider */}
          <div style={{
            display: "flex", alignItems: "center", gap: 14, margin: "40px 0 24px",
            color: "#475569", fontSize: 12, fontWeight: 600,
            textTransform: "uppercase", letterSpacing: "0.08em",
          }}>
            <span style={{ flex: 1, height: 1, background: "#1e293b" }} />
            or browse open competitions
            <span style={{ flex: 1, height: 1, background: "#1e293b" }} />
          </div>
        </section>

        {/* OPEN COMPETITIONS ─────────────────────────────────────────────── */}
        <section style={{
          maxWidth: 1100, margin: "0 auto", padding: "0 24px 80px",
        }}>
          {loading ? (
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))", gap: 18,
            }}>
              {[0, 1].map((i) => (
                <div key={i} style={{
                  height: 220, background: "#111827", border: "1px solid #1e293b",
                  borderRadius: 10, animation: "ctf-pulse-dot 1.5s ease infinite",
                }} />
              ))}
            </div>
          ) : open.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "48px 0", color: "#64748b",
              background: "#111827", border: "1px dashed #1e293b", borderRadius: 12,
            }}>
              <Trophy size={36} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: "#94a3b8", marginBottom: 6 }}>
                No open competitions right now
              </div>
              <div style={{ fontSize: 13 }}>
                Got an access code? Enter it above to join a private competition.
              </div>
            </div>
          ) : (
            <>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))",
                gap: 18,
              }}>
                {open.map((c) => <CompetitionCard key={c.id} comp={c} />)}
              </div>

              <div style={{ textAlign: "center", marginTop: 32 }}>
                <Link href="/ctf/competitions" style={{
                  color: "#94a3b8", fontSize: 13, fontWeight: 600, textDecoration: "none",
                  borderBottom: "1px solid #334155", paddingBottom: 2,
                }}>
                  See all competitions →
                </Link>
              </div>
            </>
          )}
        </section>
      </div>

      <style jsx global>{`
        .ctf-entry-card:hover {
          border-color: #6366f1 !important;
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(99,102,241,0.15);
        }
        @keyframes ctf-pulse-dot {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.45; }
        }
      `}</style>
    </>
  );
}
