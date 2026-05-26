"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  X, CheckCircle2, AlertCircle, Loader2, Download, Lightbulb, Pause, Infinity,
  Users, Trophy,
} from "lucide-react";
import { toast } from "@/components/ui/PSPToast";
import InstancePanel from "@/components/ctf/InstancePanel";
import {
  getCtfCompetitionChallenges, submitCtfCompetitionFlag, unlockCTFHint,
  getMyCtfAttempts, getChallengeSolvers,
  type CTFCompetitionChallengeDTO,
  type CTFAttemptDTO,
  type CTFChallengeSolverDTO,
} from "@/lib/api";
import { CAT_CONFIG, DIFF_COLORS } from "./categoryConfig";

interface Props {
  competitionId: string;
  challengeId:   string;
  teamId?:       string;
  canSolve:      boolean;
  isPaused:      boolean;
  isEnded:       boolean;
  onClose:       () => void;
  onSolved?:     (challengeId: string, points: number) => void;
}

export default function ChallengeModal({
  competitionId, challengeId, teamId, canSolve, isPaused, isEnded, onClose, onSolved,
}: Props) {
  const [challenge, setChallenge] = useState<CTFCompetitionChallengeDTO | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [closing,   setClosing]   = useState(false);

  const [unlockedHints, setUnlockedHints] = useState<Record<string, string>>({});
  const [unlockingHint, setUnlockingHint] = useState<string | null>(null);

  const handleUnlockHint = async (hintId: string) => {
    if (unlockingHint) return;
    setUnlockingHint(hintId);
    try {
      const res = await unlockCTFHint(challenge?.id ?? challengeId, hintId, {
        competitionId,
        teamId,
      });
      setUnlockedHints(prev => ({ ...prev, [hintId]: res.text ?? "" }));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not unlock hint.";
      toast.error("Unlock failed", msg);
    } finally {
      setUnlockingHint(null);
    }
  };

  const [flag,       setFlag]      = useState("");
  const [busy,       setBusy]      = useState(false);
  const [result,     setResult]    = useState<{ correct: boolean; message: string } | null>(null);
  const [shaking,    setShaking]   = useState(false);
  const [glowing,    setGlowing]   = useState(false);
  const [resultKey,  setResultKey] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrongTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [attempts,          setAttempts]          = useState<CTFAttemptDTO[]>([]);
  const [attemptsUsed,      setAttemptsUsed]      = useState(0);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [lockedOut,         setLockedOut]         = useState(false);
  const [newRowIds,         setNewRowIds]         = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getCtfCompetitionChallenges(competitionId),
      getMyCtfAttempts(competitionId, challengeId),
    ]).then(([w, hist]) => {
      const c = w.challenges.find(x => x.id === challengeId);
      setChallenge(c ?? null);
      setAttempts(hist);
      setAttemptsUsed(hist.length);
      const max = c?.maxAttempts ?? null;
      if (max != null) {
        const used = hist.length;
        setAttemptsRemaining(Math.max(0, max - used));
        setLockedOut(used >= max && !hist.some(a => a.correct));
      } else {
        setAttemptsRemaining(null);
        setLockedOut(false);
      }
    }).catch(() => {})
      .finally(() => setLoading(false));
  }, [competitionId, challengeId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") doClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doClose = () => {
    setClosing(true);
    setTimeout(onClose, 200);
  };

  const submit = async () => {
    if (!challenge || !canSolve || busy || !flag.trim() || lockedOut) return;
    setBusy(true);
    setResult(null);
    if (wrongTimerRef.current) clearTimeout(wrongTimerRef.current);
    try {
      const res = await submitCtfCompetitionFlag(competitionId, challenge.id, flag.trim());
      setResultKey(k => k + 1);

      const hist = await getMyCtfAttempts(competitionId, challenge.id).catch(() => attempts);
      const newId = hist[0]?.id;
      if (newId) setNewRowIds(prev => new Set(prev).add(newId));
      setAttempts(hist);
      setAttemptsUsed(res.attemptsUsed ?? hist.length);
      setAttemptsRemaining(res.attemptsRemaining ?? null);
      setLockedOut(res.lockedOut ?? false);

      if (res.correct) {
        setResult({ correct: true, message: res.message });
        setGlowing(true);
        toast.success("Correct flag!", `+${res.pointsAwarded} points awarded.`);
        onSolved?.(challenge.id, res.pointsAwarded ?? 0);
        setTimeout(() => window.location.reload(), 1000);
      } else {
        setResult({ correct: false, message: res.message });
        setShaking(true);
        setTimeout(() => setShaking(false), 500);
        if (!res.lockedOut) {
          wrongTimerRef.current = setTimeout(() => setResult(null), 4000);
        }
        if (!res.lockedOut) {
          toast.error("Wrong flag", res.message ?? "Try again.");
        }
      }
      setFlag("");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Submission failed.";
      setResult({ correct: false, message: msg });
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
      wrongTimerRef.current = setTimeout(() => setResult(null), 4000);
    } finally {
      setBusy(false);
    }
  };

  const conf   = challenge ? (CAT_CONFIG[challenge.category] ?? null) : null;
  const accent = conf?.accent ?? "#6366f1";

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={doClose}
        style={{
          position: "fixed", inset: 0, zIndex: 110,
          background: closing ? "rgba(0,0,0,0)" : "rgba(2,6,18,0.82)",
          backdropFilter: closing ? "blur(0px)" : "blur(8px)",
          WebkitBackdropFilter: closing ? "blur(0px)" : "blur(8px)",
          transition: "background 200ms ease, backdrop-filter 200ms ease",
          display: "flex", justifyContent: "center", alignItems: "center",
          padding: "16px",
        }}
      >
        {/* Centered modal */}
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "min(96vw, 940px)",
            height: "min(88vh, 700px)",
            background: "#080d1c",
            border: `1px solid ${accent}28`,
            borderRadius: 14,
            display: "flex", flexDirection: "column",
            overflow: "hidden",
            boxShadow: `0 0 0 1px rgba(255,255,255,0.04),
                        0 24px 80px rgba(0,0,0,0.75),
                        0 0 60px ${accent}0e`,
            animation: closing
              ? "ctfm-out 200ms cubic-bezier(0.4,0,1,1) forwards"
              : "ctfm-in 280ms cubic-bezier(0.16,1,0.3,1)",
          }}
        >
          {loading ? (
            <LoadingSkeleton />
          ) : !challenge ? (
            <UnavailableState onClose={doClose} />
          ) : (
            <ChallengeBody
              c={challenge}
              accent={accent}
              conf={conf}
              competitionId={competitionId}
              teamId={teamId}
              canSolve={canSolve} isPaused={isPaused} isEnded={isEnded}
              flag={flag} setFlag={setFlag}
              busy={busy} result={result} resultKey={resultKey}
              shaking={shaking} glowing={glowing}
              inputRef={inputRef}
              onSubmit={submit}
              onClose={doClose}
              unlockedHints={unlockedHints}
              unlockingHint={unlockingHint}
              onUnlockHint={handleUnlockHint}
              attempts={attempts}
              attemptsUsed={attemptsUsed}
              attemptsRemaining={attemptsRemaining}
              lockedOut={lockedOut}
              newRowIds={newRowIds}
            />
          )}
        </div>
      </div>

      <style jsx global>{`
        @keyframes ctfm-in {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
        @keyframes ctfm-out {
          from { opacity: 1; transform: scale(1)    translateY(0); }
          to   { opacity: 0; transform: scale(0.95) translateY(10px); }
        }
        @keyframes ctf-shake {
          0%,100% { transform: translateX(0); }
          15%     { transform: translateX(-8px); }
          30%     { transform: translateX(8px); }
          50%     { transform: translateX(-5px); }
          70%     { transform: translateX(5px); }
          90%     { transform: translateX(-2px); }
        }
        @keyframes ctf-result-in {
          from { opacity: 0; transform: translateY(4px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
        @keyframes ctf-glow-pulse {
          0%   { box-shadow: 0 0 0 0      rgba(34,197,94,0.5); }
          50%  { box-shadow: 0 0 28px 6px rgba(34,197,94,0.25); }
          100% { box-shadow: 0 0 0 0      rgba(34,197,94,0); }
        }
        @keyframes ctf-row-in {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ctf-unlock-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes ctf-tab-in {
          from { opacity: 0; transform: translateY(5px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; transition: none !important; }
        }
      `}</style>
    </>
  );
}

// ── Loading skeleton ───────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "18px 20px", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid #1e293b", paddingBottom: 14, gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div className="skel" style={{ height: 15, width: 140, borderRadius: 6, marginBottom: 10 }} />
          <div className="skel" style={{ height: 24, width: "65%", borderRadius: 6, marginBottom: 8 }} />
          <div className="skel" style={{ height: 13, width: 180, borderRadius: 5 }} />
        </div>
        <div className="skel" style={{ width: 28, height: 28, borderRadius: 6, flexShrink: 0 }} />
      </div>
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 20 }}>
        <div>
          {[90, 80, 70, 55, 60].map((w, i) => (
            <div key={i} className="skel" style={{ height: 13, width: `${w}%`, borderRadius: 4, marginBottom: 8 }} />
          ))}
        </div>
        <div>
          <div className="skel" style={{ height: 100, borderRadius: 8, marginBottom: 10 }} />
          <div className="skel" style={{ height: 40, borderRadius: 7 }} />
        </div>
      </div>
    </div>
  );
}

// ── Unavailable state ──────────────────────────────────────────────────────────

function UnavailableState({ onClose }: { onClose: () => void }) {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>🔒</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc", marginBottom: 6 }}>
          Challenge unavailable
        </div>
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>
          It may have been hidden by the organizer.
        </div>
        <button onClick={onClose} className="psp-btn psp-btn-secondary">Close</button>
      </div>
    </div>
  );
}

// ── Main body ──────────────────────────────────────────────────────────────────

function ChallengeBody({
  c, accent, conf,
  competitionId, teamId, canSolve, isPaused, isEnded,
  flag, setFlag, busy, result, resultKey, shaking, glowing,
  inputRef, onSubmit, onClose,
  unlockedHints, unlockingHint, onUnlockHint,
  attempts, attemptsUsed, attemptsRemaining, lockedOut, newRowIds,
}: {
  c: CTFCompetitionChallengeDTO;
  accent: string;
  conf: { label: string; icon: React.ReactNode; accent: string } | null;
  competitionId: string;
  teamId?: string;
  canSolve: boolean; isPaused: boolean; isEnded: boolean;
  flag: string; setFlag: (v: string) => void;
  busy: boolean;
  result: { correct: boolean; message: string } | null;
  resultKey: number;
  shaking: boolean;
  glowing: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onSubmit: () => void; onClose: () => void;
  unlockedHints: Record<string, string>;
  unlockingHint: string | null;
  onUnlockHint: (hintId: string) => void;
  attempts: CTFAttemptDTO[];
  attemptsUsed: number;
  attemptsRemaining: number | null;
  lockedOut: boolean;
  newRowIds: Set<string>;
}) {
  const [activeTab, setActiveTab] = useState<"submit" | "solvers">("submit");

  const alreadySolved = c.solvedByMe || attempts.some(a => a.correct);
  const inputDisabled = busy || isPaused || lockedOut || alreadySolved;
  const submitDisabled = inputDisabled || !flag.trim();
  const isUnlimited = c.maxAttempts == null;
  const progressPct = isUnlimited || !c.maxAttempts ? 0
    : Math.min(100, (attemptsUsed / c.maxAttempts) * 100);
  const diffColor = DIFF_COLORS[c.difficulty] ?? "#94a3b8";
  const pts = c.currentPoints ?? c.basePoints;

  return (
    <>
      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div style={{
        padding: "13px 20px 11px",
        borderBottom: "1px solid #1a2235",
        flexShrink: 0,
        background: `linear-gradient(180deg, ${accent}0a 0%, #080d1c 100%)`,
      }}>
        {/* badges + close */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              background: `${accent}18`, border: `1px solid ${accent}30`,
              color: accent, borderRadius: 5, padding: "2px 9px",
              fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase",
            }}>
              {conf?.icon} {c.category}
            </span>
            <span style={{
              display: "inline-flex", alignItems: "center",
              background: `${diffColor}18`, border: `1px solid ${diffColor}28`,
              color: diffColor, borderRadius: 5, padding: "2px 9px",
              fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase",
            }}>
              {c.difficulty}
            </span>
            {alreadySolved && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)",
                color: "#22c55e", borderRadius: 5, padding: "2px 9px",
                fontSize: 10, fontWeight: 700,
              }}>
                <CheckCircle2 size={10} /> SOLVED
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.04)", border: "1px solid #1e293b",
              borderRadius: 6, color: "#64748b", cursor: "pointer",
              padding: "5px 7px", display: "inline-flex", alignItems: "center",
              transition: "background 150ms, color 150ms", flexShrink: 0,
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)";
              (e.currentTarget as HTMLElement).style.color = "#f8fafc";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
              (e.currentTarget as HTMLElement).style.color = "#64748b";
            }}
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        {/* Title */}
        <div style={{
          fontSize: 21, fontWeight: 800, color: "#f8fafc",
          lineHeight: 1.25, letterSpacing: "-0.3px", marginBottom: 7,
        }}>
          {c.title}
        </div>

        {/* Meta */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Trophy size={12} color={accent} />
            <span style={{ fontSize: 14, fontWeight: 800, color: accent, fontFamily: "ui-monospace, monospace" }}>
              {pts}
            </span>
            <span style={{ fontSize: 11, color: "#475569" }}>pts</span>
          </div>
          <div style={{ width: 1, height: 11, background: "#1e293b" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Users size={11} color="#475569" />
            <span style={{ fontSize: 11, color: "#64748b" }}>
              <span style={{ color: "#94a3b8", fontWeight: 600 }}>{c.solveCount}</span>
              {" "}team{c.solveCount !== 1 ? "s" : ""} solved
            </span>
          </div>
          {c.flagFormat && (
            <>
              <div style={{ width: 1, height: 11, background: "#1e293b" }} />
              <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "#475569" }}>
                {c.flagFormat}
              </span>
            </>
          )}
        </div>
      </div>

      {/* ── Body: two columns ─────────────────────────────────────────────────── */}
      <div style={{
        flex: 1, overflow: "hidden",
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.6fr) minmax(260px, 1fr)",
      }}>

        {/* LEFT column — description + media + hints */}
        <div style={{
          overflowY: "auto", padding: "18px 20px",
          borderRight: "1px solid #0f172a",
        }}>
          {/* Description */}
          <div style={{
            fontSize: 13, color: "#cbd5e1", lineHeight: 1.8,
            whiteSpace: "pre-wrap", wordBreak: "break-word",
          }}>
            {c.description}
          </div>

          {/* Media image/GIF */}
          {c.mediaUrl && (
            <div style={{
              marginTop: 18, borderRadius: 9, overflow: "hidden",
              border: "1px solid #1e293b",
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={c.mediaUrl}
                alt="challenge media"
                style={{ maxWidth: "100%", display: "block" }}
              />
            </div>
          )}

          {/* Hints */}
          {c.hints && c.hints.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <HintsSection
                hints={c.hints}
                unlockedHints={unlockedHints}
                unlockingHint={unlockingHint}
                onUnlockHint={onUnlockHint}
                accent={accent}
              />
            </div>
          )}
        </div>

        {/* RIGHT column — download + instance + submit/solvers card */}
        <div style={{
          overflowY: "auto", padding: "14px 14px",
          display: "flex", flexDirection: "column", gap: 10,
        }}>

          {/* Compact download */}
          {c.downloadableFileUrl && (
            <a
              href={c.downloadableFileUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex", alignItems: "center", gap: 10,
                background: "#0d1527", border: "1px solid #1e293b",
                borderRadius: 8, padding: "9px 12px", textDecoration: "none",
                transition: "border-color 150ms, background 150ms", flexShrink: 0,
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = `${accent}45`;
                (e.currentTarget as HTMLElement).style.background = `${accent}09`;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = "#1e293b";
                (e.currentTarget as HTMLElement).style.background = "#0d1527";
              }}
            >
              <div style={{
                width: 30, height: 30, borderRadius: 6,
                background: `${accent}18`,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <Download size={13} color={accent} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12, fontWeight: 600, color: "#e2e8f0",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {c.downloadableFileName ?? "challenge-file"}
                </div>
                <div style={{ fontSize: 10, color: "#475569", marginTop: 1 }}>Opens in new tab</div>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 700, color: accent,
                background: `${accent}14`, border: `1px solid ${accent}25`,
                borderRadius: 4, padding: "2px 7px", flexShrink: 0,
              }}>
                Download
              </span>
            </a>
          )}

          {/* Instance panel */}
          {c.requiresInstance && (
            <div style={{ flexShrink: 0 }}>
              <InstancePanel
                challengeId={c.id}
                challengeTitle={c.title}
                requiresInstance={true}
                connectionType={c.connectionType ?? "HTTP"}
                competitionId={competitionId}
                teamId={teamId}
                dark={true}
              />
            </div>
          )}

          {/* Submit / Solvers tab card */}
          <div style={{
            flex: 1, background: "#0c1225",
            border: `1px solid ${glowing ? "rgba(34,197,94,0.45)" : "#1a2437"}`,
            borderRadius: 10, overflow: "hidden",
            display: "flex", flexDirection: "column",
            transition: "border-color 300ms ease",
            animation: shaking ? "ctf-shake 0.5s ease" : glowing ? "ctf-glow-pulse 1.1s ease" : undefined,
            minHeight: 0,
          }}>
            {/* Tab bar */}
            <div style={{
              display: "flex", borderBottom: "1px solid #111c30",
              flexShrink: 0, background: "#0a1020",
            }}>
              {(["submit", "solvers"] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  style={{
                    flex: 1, padding: "9px 0",
                    background: "transparent",
                    border: "none",
                    borderBottom: activeTab === tab ? `2px solid ${accent}` : "2px solid transparent",
                    color: activeTab === tab ? accent : "#475569",
                    fontSize: 11, fontWeight: 700,
                    textTransform: "uppercase", letterSpacing: "0.06em",
                    cursor: "pointer",
                    transition: "color 150ms, border-color 150ms",
                  }}
                  onMouseEnter={e => {
                    if (activeTab !== tab)
                      (e.currentTarget as HTMLElement).style.color = "#94a3b8";
                  }}
                  onMouseLeave={e => {
                    if (activeTab !== tab)
                      (e.currentTarget as HTMLElement).style.color = "#475569";
                  }}
                >
                  {tab === "submit" ? "Submit Flag" : `Solvers (${c.solveCount})`}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px" }}>
              {activeTab === "submit" ? (
                <div key="submit" style={{ animation: "ctf-tab-in 0.18s ease" }}>
                  <SubmitTabContent
                    c={c}
                    accent={accent}
                    canSolve={canSolve} isPaused={isPaused} isEnded={isEnded}
                    alreadySolved={alreadySolved}
                    flag={flag} setFlag={setFlag}
                    busy={busy} result={result} resultKey={resultKey}
                    inputDisabled={inputDisabled} submitDisabled={submitDisabled}
                    inputRef={inputRef} onSubmit={onSubmit}
                    attemptsUsed={attemptsUsed} attemptsRemaining={attemptsRemaining}
                    isUnlimited={isUnlimited} progressPct={progressPct}
                    lockedOut={lockedOut}
                    attempts={attempts} newRowIds={newRowIds}
                  />
                </div>
              ) : (
                <div key="solvers" style={{ animation: "ctf-tab-in 0.18s ease" }}>
                  <SolversTabContent
                    competitionId={competitionId}
                    challengeId={c.id}
                    solveCount={c.solveCount}
                    accent={accent}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Submit tab content ─────────────────────────────────────────────────────────

function SubmitTabContent({
  c, accent, canSolve, isPaused, isEnded, alreadySolved,
  flag, setFlag, busy, result, resultKey,
  inputDisabled, submitDisabled,
  inputRef, onSubmit,
  attemptsUsed, attemptsRemaining, isUnlimited, progressPct,
  lockedOut, attempts, newRowIds,
}: {
  c: CTFCompetitionChallengeDTO;
  accent: string;
  canSolve: boolean; isPaused: boolean; isEnded: boolean;
  alreadySolved: boolean;
  flag: string; setFlag: (v: string) => void;
  busy: boolean;
  result: { correct: boolean; message: string } | null;
  resultKey: number;
  inputDisabled: boolean; submitDisabled: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onSubmit: () => void;
  attemptsUsed: number; attemptsRemaining: number | null;
  isUnlimited: boolean; progressPct: number;
  lockedOut: boolean;
  attempts: CTFAttemptDTO[];
  newRowIds: Set<string>;
}) {
  if (alreadySolved) {
    return (
      <div style={{
        background: "linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(34,197,94,0.04) 100%)",
        border: "1px solid rgba(34,197,94,0.25)",
        borderRadius: 9, padding: "13px 14px",
        display: "flex", alignItems: "center", gap: 10, marginBottom: 12,
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: 7,
          background: "rgba(34,197,94,0.14)",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <CheckCircle2 size={15} color="#22c55e" />
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#34d399" }}>Challenge Solved</div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>Your team completed this challenge.</div>
        </div>
      </div>
    );
  }

  if (isEnded) {
    return (
      <div style={{
        background: "#0f172a", border: "1px solid #1e293b",
        borderRadius: 9, padding: 14, textAlign: "center",
        color: "#64748b", fontSize: 12, marginBottom: 12,
      }}>
        Submissions closed — competition ended.
      </div>
    );
  }

  return (
    <>
      {/* Paused banner */}
      {isPaused && (
        <div style={{
          display: "flex", alignItems: "center", gap: 7,
          background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.22)",
          color: "#f59e0b", borderRadius: 7, padding: "8px 11px",
          fontSize: 11, fontWeight: 600, marginBottom: 10,
        }}>
          <Pause size={12} /> Competition is paused.
        </div>
      )}

      {/* Locked-out banner */}
      {lockedOut && (
        <div style={{
          display: "flex", alignItems: "center", gap: 7,
          background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.18)",
          color: "#ef4444", borderRadius: 7, padding: "8px 11px",
          fontSize: 11, fontWeight: 600, marginBottom: 10,
        }}>
          <AlertCircle size={12} /> No attempts remaining.
        </div>
      )}

      {/* Flag input */}
      <input
        ref={inputRef}
        className="input"
        value={flag}
        onChange={(e) => setFlag(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && canSolve && !inputDisabled) onSubmit(); }}
        placeholder={lockedOut ? "No attempts remaining" : isPaused ? "Submissions paused" : "Enter flag…"}
        disabled={inputDisabled}
        style={{
          fontFamily: "ui-monospace, monospace",
          background: "#060a16",
          borderColor: result
            ? result.correct ? "rgba(34,197,94,0.5)" : "rgba(239,68,68,0.4)"
            : undefined,
          boxShadow: result
            ? result.correct
              ? "0 0 0 3px rgba(34,197,94,0.1)"
              : "0 0 0 3px rgba(239,68,68,0.08)"
            : undefined,
          transition: "border-color 200ms, box-shadow 200ms",
        }}
      />

      {/* Submit button */}
      <button
        type="button"
        onClick={onSubmit}
        disabled={submitDisabled}
        style={{
          width: "100%", marginTop: 9, padding: "10px 0",
          background: submitDisabled
            ? "#0f172a"
            : "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
          border: submitDisabled ? "1px solid #1e293b" : "none",
          borderRadius: 7,
          color: isPaused ? "#f59e0b" : submitDisabled ? "#334155" : "#fff",
          fontSize: 13, fontWeight: 700,
          cursor: submitDisabled ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
          boxShadow: !submitDisabled ? "0 2px 12px rgba(99,102,241,0.35)" : "none",
          transition: "all 150ms ease",
          transform: "translateY(0)",
        }}
        onMouseEnter={e => {
          if (!submitDisabled) {
            (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
            (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 18px rgba(99,102,241,0.45)";
          }
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
          (e.currentTarget as HTMLElement).style.boxShadow = !submitDisabled
            ? "0 2px 12px rgba(99,102,241,0.35)" : "none";
        }}
      >
        {isPaused
          ? <><Pause size={14} /> Paused</>
          : busy
          ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Checking…</>
          : lockedOut
          ? "Locked Out"
          : "Submit Flag"}
      </button>

      {/* Attempt counter */}
      <AttemptCounter
        attemptsUsed={attemptsUsed}
        attemptsRemaining={attemptsRemaining}
        isUnlimited={isUnlimited}
        maxAttempts={c.maxAttempts}
        progressPct={progressPct}
      />

      {/* Result feedback */}
      {result && (
        <div
          key={resultKey}
          style={{
            marginTop: 10, padding: "9px 12px", borderRadius: 7,
            fontSize: 12, fontWeight: 600,
            background: result.correct ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.08)",
            border: `1px solid ${result.correct ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.25)"}`,
            color: result.correct ? "#22c55e" : "#f87171",
            display: "flex", alignItems: "center", gap: 7,
            animation: "ctf-result-in 0.22s cubic-bezier(0.16,1,0.3,1)",
          }}
        >
          {result.correct ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
          {result.message}
        </div>
      )}

      {/* Attempt history */}
      {attempts.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <AttemptHistory attempts={attempts} newRowIds={newRowIds} />
        </div>
      )}
    </>
  );
}

// ── Solvers tab content ────────────────────────────────────────────────────────

function SolversTabContent({
  competitionId, challengeId, solveCount, accent,
}: {
  competitionId: string;
  challengeId: string;
  solveCount: number;
  accent: string;
}) {
  const [solvers, setSolvers] = useState<CTFChallengeSolverDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (fetched) return;
    setLoading(true);
    getChallengeSolvers(competitionId, challengeId)
      .then(setSolvers)
      .catch(() => {})
      .finally(() => { setLoading(false); setFetched(true); });
  }, [competitionId, challengeId, fetched]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 20 }}>
        <Loader2 size={16} color="#6366f1" style={{ animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  if (solveCount === 0) {
    return (
      <div style={{ textAlign: "center", padding: 20, color: "#475569", fontSize: 12 }}>
        No solves yet. Be the first!
      </div>
    );
  }

  if (solvers.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 20, color: "#475569", fontSize: 12 }}>
        No solver data available.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {solvers.map((s, i) => (
        <div key={s.teamId} style={{
          display: "flex", alignItems: "center", gap: 9,
          padding: "8px 10px",
          borderRadius: 7,
          background: i === 0 ? "rgba(239,68,68,0.04)" : "transparent",
          transition: "background 150ms",
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.025)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = i === 0 ? "rgba(239,68,68,0.04)" : "transparent"; }}
        >
          {/* Rank */}
          <div style={{
            width: 20, flexShrink: 0, textAlign: "right",
            fontFamily: "ui-monospace, monospace",
            fontSize: 11, fontWeight: 700,
            color: i === 0 ? "#ef4444" : i === 1 ? "#94a3b8" : i === 2 ? "#fb923c" : "#334155",
          }}>
            #{i + 1}
          </div>

          {/* Avatar */}
          <div style={{
            width: 24, height: 24, borderRadius: "50%",
            background: s.avatarColor,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 700, color: "#fff", flexShrink: 0,
          }}>
            {s.teamName.charAt(0).toUpperCase()}
          </div>

          {/* Name + First Blood */}
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <Link
              href={`/ctf/competitions/${competitionId}/teams/${s.teamId}`}
              style={{
                fontWeight: 600, color: "#cbd5e1", fontSize: 12,
                textDecoration: "none",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}
              onMouseEnter={e => { (e.target as HTMLElement).style.color = accent; }}
              onMouseLeave={e => { (e.target as HTMLElement).style.color = "#cbd5e1"; }}
            >
              {s.teamName}
            </Link>
            {i === 0 && (
              <span style={{
                fontSize: 9, fontWeight: 800, color: "#ef4444",
                background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.22)",
                borderRadius: 4, padding: "1px 5px",
                letterSpacing: "0.04em", textTransform: "uppercase", flexShrink: 0,
              }}>
                🩸 First Blood
              </span>
            )}
          </div>

          {/* Time */}
          <div style={{ fontSize: 10, color: "#334155", whiteSpace: "nowrap", flexShrink: 0 }}>
            {new Date(s.solvedAt).toLocaleString("en-GB", {
              day: "2-digit", month: "short",
              hour: "2-digit", minute: "2-digit",
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Hints section ──────────────────────────────────────────────────────────────

function HintsSection({
  hints, unlockedHints, unlockingHint, onUnlockHint, accent,
}: {
  hints: { id: string; cost: number; text?: string | null }[];
  unlockedHints: Record<string, string>;
  unlockingHint: string | null;
  onUnlockHint: (id: string) => void;
  accent: string;
}) {
  return (
    <div>
      <div style={{
        fontSize: 10, fontWeight: 700, color: "#334155",
        textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8,
      }}>
        Hints ({hints.length})
      </div>
      {hints.map((h, i) => {
        const revealedText = h.text ?? unlockedHints[h.id];
        const isUnlocking  = unlockingHint === h.id;
        const isLocked     = !revealedText;
        return (
          <div
            key={h.id}
            onClick={() => { if (isLocked && !isUnlocking) onUnlockHint(h.id); }}
            style={{
              background: isLocked ? "#080d1c" : "rgba(251,191,36,0.04)",
              border: `1px solid ${isLocked ? "#1e293b" : "rgba(251,191,36,0.2)"}`,
              borderRadius: 8, padding: "10px 12px",
              marginBottom: i < hints.length - 1 ? 6 : 0,
              display: "flex", gap: 10, alignItems: "flex-start",
              cursor: isLocked ? "pointer" : "default",
              opacity: isUnlocking ? 0.6 : 1,
              transition: "opacity 200ms, border-color 200ms, background 200ms",
            }}
            onMouseEnter={e => {
              if (isLocked) {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(251,191,36,0.3)";
                (e.currentTarget as HTMLElement).style.background = "rgba(251,191,36,0.04)";
              }
            }}
            onMouseLeave={e => {
              if (isLocked) {
                (e.currentTarget as HTMLElement).style.borderColor = "#1e293b";
                (e.currentTarget as HTMLElement).style.background = "#080d1c";
              }
            }}
          >
            <div style={{
              width: 28, height: 28, borderRadius: 6,
              background: revealedText ? "rgba(251,191,36,0.12)" : "rgba(71,85,105,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, marginTop: 1,
            }}>
              <Lightbulb
                size={13}
                color={revealedText ? "#fbbf24" : "#475569"}
                style={isUnlocking ? { animation: "ctf-unlock-spin 0.8s linear infinite" } : undefined}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 10, color: revealedText ? "#fbbf24" : "#475569",
                fontWeight: 700, textTransform: "uppercase",
                letterSpacing: "0.05em", marginBottom: 4,
              }}>
                Hint {i + 1}
                {isLocked && (
                  <span style={{ color: "#334155", marginLeft: 6, fontWeight: 500, textTransform: "none" }}>
                    · {h.cost} pt{h.cost !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <div style={{
                fontSize: 12, lineHeight: 1.6,
                color: revealedText ? "#e2e8f0" : "#475569",
                fontStyle: revealedText ? "normal" : "italic",
              }}>
                {isUnlocking ? "Unlocking…" : revealedText ?? "Click to unlock this hint"}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Attempt counter ────────────────────────────────────────────────────────────

function AttemptCounter({
  attemptsUsed, attemptsRemaining, isUnlimited, maxAttempts, progressPct,
}: {
  attemptsUsed: number;
  attemptsRemaining: number | null;
  isUnlimited: boolean;
  maxAttempts: number | null;
  progressPct: number;
}) {
  if (attemptsUsed === 0 && isUnlimited) return null;

  const dangerColor = progressPct >= 100
    ? "#ef4444"
    : progressPct >= 75
    ? "#f97316"
    : "#6366f1";

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5,
      }}>
        <span style={{ fontSize: 11, color: "#475569" }}>
          {isUnlimited
            ? <>{attemptsUsed} attempt{attemptsUsed !== 1 ? "s" : ""}</>
            : <>{attemptsUsed} / {maxAttempts} attempts</>
          }
        </span>
        {isUnlimited ? (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 3,
            fontSize: 10, fontWeight: 700, color: "#6366f1",
            background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)",
            borderRadius: 4, padding: "1px 6px",
          }}>
            <Infinity size={10} /> Unlimited
          </span>
        ) : (
          <span style={{ fontSize: 11, fontWeight: 600, color: attemptsRemaining === 0 ? "#ef4444" : "#64748b" }}>
            {attemptsRemaining} left
          </span>
        )}
      </div>
      {!isUnlimited && (
        <div style={{ height: 3, background: "#0f172a", borderRadius: 2, overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${progressPct}%`,
            background: dangerColor, borderRadius: 2,
            transition: "width 0.4s ease, background 0.3s ease",
          }} />
        </div>
      )}
    </div>
  );
}

// ── Attempt history ────────────────────────────────────────────────────────────

function AttemptHistory({ attempts, newRowIds }: { attempts: CTFAttemptDTO[]; newRowIds: Set<string> }) {
  return (
    <div style={{
      background: "#080d1c", border: "1px solid #1a2437",
      borderRadius: 8, overflow: "hidden",
    }}>
      <div style={{
        padding: "8px 12px", borderBottom: "1px solid #0f172a",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          Attempt history
        </span>
        <span style={{
          fontSize: 10, color: "#475569", background: "#0f172a",
          border: "1px solid #1e293b", borderRadius: 4, padding: "1px 7px",
        }}>
          {attempts.length}
        </span>
      </div>
      <div style={{ maxHeight: 160, overflowY: "auto" }}>
        {attempts.map((a, i) => (
          <div
            key={a.id}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "7px 12px",
              borderBottom: i < attempts.length - 1 ? "1px solid #080d1c" : "none",
              animation: newRowIds.has(a.id) ? "ctf-row-in 0.28s cubic-bezier(0.16,1,0.3,1)" : undefined,
              background: a.correct ? "rgba(34,197,94,0.03)" : "transparent",
            }}
          >
            <div style={{
              width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
              background: a.correct ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.12)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontSize: 9, color: a.correct ? "#22c55e" : "#ef4444" }}>
                {a.correct ? "✓" : "✗"}
              </span>
            </div>
            <span style={{
              flex: 1, fontFamily: "ui-monospace, monospace", fontSize: 11,
              color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {a.flagMasked}
            </span>
            <span style={{ color: "#1e293b", fontSize: 10, whiteSpace: "nowrap", flexShrink: 0 }}>
              {relativeTime(a.submittedAt)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)  return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return new Date(iso).toLocaleDateString();
}
