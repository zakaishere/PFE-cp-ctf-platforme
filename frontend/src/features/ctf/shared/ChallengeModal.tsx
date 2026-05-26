"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  X, CheckCircle2, AlertCircle, Loader2, Download, Lightbulb, Pause, Infinity,
  ChevronDown, Users, Trophy,
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

  const [attempts,           setAttempts]           = useState<CTFAttemptDTO[]>([]);
  const [attemptsUsed,       setAttemptsUsed]       = useState(0);
  const [attemptsRemaining,  setAttemptsRemaining]  = useState<number | null>(null);
  const [lockedOut,          setLockedOut]          = useState(false);
  const [newRowIds,          setNewRowIds]          = useState<Set<string>>(new Set());

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
    setTimeout(onClose, 220);
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
          background: closing ? "rgba(0,0,0,0)" : "rgba(2,6,18,0.75)",
          backdropFilter: closing ? "blur(0px)" : "blur(6px)",
          WebkitBackdropFilter: closing ? "blur(0px)" : "blur(6px)",
          transition: "background 220ms ease, backdrop-filter 220ms ease",
          display: "flex", justifyContent: "center", alignItems: "flex-end",
        }}
      >
        {/* Modal sheet */}
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "100%", maxWidth: 900,
            maxHeight: "93vh", height: "93vh",
            background: "#080d1c",
            border: "1px solid #1e293b",
            borderTop: `2px solid ${accent}`,
            borderRadius: "14px 14px 0 0",
            display: "flex", flexDirection: "column",
            overflow: "hidden",
            boxShadow: "0 -8px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
            animation: closing
              ? "ctfm-down 220ms cubic-bezier(0.4,0,1,1) forwards"
              : "ctfm-up 320ms cubic-bezier(0.16,1,0.3,1)",
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
        @keyframes ctfm-up {
          from { transform: translateY(72px) scale(0.98); opacity: 0; }
          to   { transform: translateY(0)    scale(1);    opacity: 1; }
        }
        @keyframes ctfm-down {
          from { transform: translateY(0)    scale(1);    opacity: 1; }
          to   { transform: translateY(72px) scale(0.98); opacity: 0; }
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
          0%   { box-shadow: 0 0 0 0   rgba(34,197,94,0.5); }
          50%  { box-shadow: 0 0 28px 6px rgba(34,197,94,0.25); }
          100% { box-shadow: 0 0 0 0   rgba(34,197,94,0); }
        }
        @keyframes ctf-row-in {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ctf-unlock-spin {
          to { transform: rotate(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="ctfm-up"], [style*="ctfm-down"],
          [style*="ctf-shake"], [style*="ctf-glow-pulse"],
          [style*="ctf-row-in"] {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>
    </>
  );
}

// ── Loading skeleton ───────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div style={{ flex: 1, padding: "24px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header skeleton */}
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", borderBottom: "1px solid #1e293b", paddingBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <div className="skel" style={{ height: 16, width: 120, borderRadius: 6, marginBottom: 10 }} />
          <div className="skel" style={{ height: 26, width: "70%", borderRadius: 6, marginBottom: 8 }} />
          <div className="skel" style={{ height: 14, width: 160, borderRadius: 6 }} />
        </div>
        <div className="skel" style={{ width: 28, height: 28, borderRadius: 6 }} />
      </div>
      {/* Body skeleton */}
      <div style={{ display: "flex", gap: 20, flex: 1 }}>
        <div style={{ flex: 1.4 }}>
          <div className="skel" style={{ height: 14, width: "90%", borderRadius: 4, marginBottom: 8 }} />
          <div className="skel" style={{ height: 14, width: "80%", borderRadius: 4, marginBottom: 8 }} />
          <div className="skel" style={{ height: 14, width: "60%", borderRadius: 4 }} />
        </div>
        <div style={{ flex: 1 }}>
          <div className="skel" style={{ height: 120, borderRadius: 8 }} />
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
      {/* ── Sticky header ────────────────────────────────────────────────────── */}
      <div style={{
        padding: "14px 20px 12px",
        borderBottom: "1px solid #1a2235",
        flexShrink: 0,
        background: "linear-gradient(180deg, #0c1225 0%, #080d1c 100%)",
      }}>
        {/* Top row: category + difficulty + close */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
            {/* Category chip */}
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              background: `${accent}18`,
              border: `1px solid ${accent}30`,
              color: accent,
              borderRadius: 5, padding: "2px 9px",
              fontSize: 11, fontWeight: 700,
              letterSpacing: "0.05em", textTransform: "uppercase",
            }}>
              {conf?.icon} {c.category}
            </span>

            {/* Difficulty badge */}
            <span style={{
              display: "inline-flex", alignItems: "center",
              background: `${diffColor}18`,
              border: `1px solid ${diffColor}28`,
              color: diffColor,
              borderRadius: 5, padding: "2px 9px",
              fontSize: 10, fontWeight: 700,
              letterSpacing: "0.04em", textTransform: "uppercase",
            }}>
              {c.difficulty}
            </span>

            {/* Solved indicator */}
            {alreadySolved && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                background: "rgba(34,197,94,0.1)",
                border: "1px solid rgba(34,197,94,0.25)",
                color: "#22c55e",
                borderRadius: 5, padding: "2px 9px",
                fontSize: 10, fontWeight: 700,
              }}>
                <CheckCircle2 size={10} /> SOLVED
              </span>
            )}
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid #1e293b",
              borderRadius: 6,
              color: "#64748b", cursor: "pointer",
              padding: "5px 7px",
              display: "inline-flex", alignItems: "center",
              transition: "background 150ms, color 150ms",
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
          fontSize: 22, fontWeight: 800,
          color: "#f8fafc", lineHeight: 1.25,
          letterSpacing: "-0.3px",
          marginBottom: 8,
        }}>
          {c.title}
        </div>

        {/* Meta row: points + solve count */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Trophy size={13} color={accent} />
            <span style={{ fontSize: 15, fontWeight: 800, color: accent, fontFamily: "ui-monospace, monospace" }}>
              {pts}
            </span>
            <span style={{ fontSize: 12, color: "#475569" }}>pts</span>
          </div>

          <div style={{ width: 1, height: 12, background: "#1e293b" }} />

          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Users size={12} color="#475569" />
            <span style={{ fontSize: 12, color: "#64748b" }}>
              <span style={{ color: "#94a3b8", fontWeight: 600 }}>{c.solveCount}</span>
              {" "}team{c.solveCount !== 1 ? "s" : ""} solved
            </span>
          </div>

          {c.flagFormat && (
            <>
              <div style={{ width: 1, height: 12, background: "#1e293b" }} />
              <span style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: 11, color: "#475569",
              }}>
                {c.flagFormat}
              </span>
            </>
          )}
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <div style={{
        flex: 1, overflowY: "auto", padding: "20px 20px",
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.5fr) minmax(280px, 1fr)",
        gap: 24,
        alignItems: "start",
      }}>

        {/* ── LEFT COLUMN ──────────────────────────────────────────────────── */}
        <div style={{ minWidth: 0 }}>

          {/* Description */}
          <div style={{
            fontSize: 13, color: "#cbd5e1", lineHeight: 1.75,
            whiteSpace: "pre-wrap", wordBreak: "break-word",
            marginBottom: 20,
          }}>
            {c.description}
          </div>

          {/* Download card */}
          {c.downloadableFileUrl && (
            <a
              href={c.downloadableFileUrl}
              download={c.downloadableFileName ?? "challenge-file"}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex", alignItems: "center", gap: 12,
                background: "#0f172a",
                border: "1px solid #1e293b",
                borderRadius: 8,
                padding: "11px 14px",
                textDecoration: "none",
                marginBottom: 16,
                transition: "border-color 150ms, background 150ms",
                cursor: "pointer",
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = `${accent}50`;
                el.style.background = `${accent}0a`;
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = "#1e293b";
                el.style.background = "#0f172a";
              }}
            >
              <div style={{
                width: 34, height: 34, borderRadius: 7,
                background: `${accent}18`,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <Download size={15} color={accent} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12, fontWeight: 600, color: "#e2e8f0",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {c.downloadableFileName ?? "challenge-file"}
                </div>
                <div style={{ fontSize: 11, color: "#475569", marginTop: 1 }}>
                  Opens in new tab
                </div>
              </div>
              <div style={{
                fontSize: 11, fontWeight: 700, color: accent,
                background: `${accent}15`, border: `1px solid ${accent}28`,
                borderRadius: 4, padding: "2px 8px", flexShrink: 0,
              }}>
                Download
              </div>
            </a>
          )}

          {/* Instance panel */}
          {c.requiresInstance && (
            <div style={{ marginBottom: 16 }}>
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

          {/* Solvers section */}
          {c.solveCount > 0 && (
            <SolversSection
              competitionId={competitionId}
              challengeId={c.id}
              solveCount={c.solveCount}
              accent={accent}
            />
          )}

          {/* Hints */}
          {c.hints && c.hints.length > 0 && (
            <HintsSection
              hints={c.hints}
              unlockedHints={unlockedHints}
              unlockingHint={unlockingHint}
              onUnlockHint={onUnlockHint}
              accent={accent}
            />
          )}
        </div>

        {/* ── RIGHT COLUMN (sticky submit panel) ───────────────────────────── */}
        <div style={{ position: "sticky", top: 0, minWidth: 0 }}>

          {/* Solved banner */}
          {alreadySolved ? (
            <div style={{
              background: "linear-gradient(135deg, rgba(34,197,94,0.1) 0%, rgba(34,197,94,0.05) 100%)",
              border: "1px solid rgba(34,197,94,0.3)",
              borderRadius: 10, padding: "14px 16px", marginBottom: 14,
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: "rgba(34,197,94,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <CheckCircle2 size={16} color="#22c55e" />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#34d399" }}>
                  Challenge Solved
                </div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>
                  Your team has completed this challenge.
                </div>
              </div>
            </div>

          ) : isEnded ? (
            <div style={{
              background: "#0f172a", border: "1px solid #1e293b",
              borderRadius: 10, padding: 16, marginBottom: 14, textAlign: "center",
              color: "#64748b", fontSize: 13,
            }}>
              Submissions closed — competition ended.
            </div>

          ) : (
            /* Submit panel */
            <div style={{
              background: "#0c1225",
              border: `1px solid ${glowing ? "rgba(34,197,94,0.5)" : "#1e293b"}`,
              borderRadius: 10,
              padding: 16,
              marginBottom: 14,
              transition: "border-color 300ms ease",
              animation: shaking
                ? "ctf-shake 0.5s ease"
                : glowing
                ? "ctf-glow-pulse 1.1s ease"
                : undefined,
            }}>

              <div style={{
                fontSize: 10, fontWeight: 700, color: "#334155",
                textTransform: "uppercase", letterSpacing: "0.1em",
                marginBottom: 12,
              }}>
                Submit Flag
              </div>

              {/* Paused banner */}
              {isPaused && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 7,
                  background: "rgba(245,158,11,0.08)",
                  border: "1px solid rgba(245,158,11,0.25)",
                  color: "#f59e0b", borderRadius: 7,
                  padding: "8px 12px", fontSize: 12, fontWeight: 600,
                  marginBottom: 12,
                }}>
                  <Pause size={13} /> Competition is paused.
                </div>
              )}

              {/* Locked-out banner */}
              {lockedOut && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 7,
                  background: "rgba(239,68,68,0.07)",
                  border: "1px solid rgba(239,68,68,0.2)",
                  color: "#ef4444", borderRadius: 7,
                  padding: "8px 12px", fontSize: 12, fontWeight: 600,
                  marginBottom: 12,
                }}>
                  <AlertCircle size={13} /> No attempts remaining.
                </div>
              )}

              {/* Flag input */}
              <input
                ref={inputRef}
                className="input"
                value={flag}
                onChange={(e) => setFlag(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && canSolve && !inputDisabled) onSubmit(); }}
                placeholder={
                  lockedOut ? "No attempts remaining" :
                  isPaused  ? "Submissions paused" :
                  "Enter flag…"
                }
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
                  width: "100%", marginTop: 10, padding: "10px 0",
                  background: submitDisabled
                    ? "#0f172a"
                    : "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                  border: submitDisabled ? "1px solid #1e293b" : "none",
                  borderRadius: 7,
                  color: isPaused ? "#f59e0b" : submitDisabled ? "#334155" : "#fff",
                  fontSize: 13, fontWeight: 700,
                  cursor: submitDisabled ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  boxShadow: !submitDisabled
                    ? "0 2px 12px rgba(99,102,241,0.35)"
                    : "none",
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

              {/* Inline result feedback */}
              {result && (
                <div
                  key={resultKey}
                  style={{
                    marginTop: 10, padding: "9px 12px", borderRadius: 7,
                    fontSize: 12, fontWeight: 600,
                    background: result.correct
                      ? "rgba(34,197,94,0.1)"
                      : "rgba(239,68,68,0.08)",
                    border: `1px solid ${result.correct
                      ? "rgba(34,197,94,0.35)"
                      : "rgba(239,68,68,0.25)"}`,
                    color: result.correct ? "#22c55e" : "#f87171",
                    display: "flex", alignItems: "center", gap: 7,
                    animation: "ctf-result-in 0.22s cubic-bezier(0.16,1,0.3,1)",
                  }}
                >
                  {result.correct
                    ? <CheckCircle2 size={13} />
                    : <AlertCircle size={13} />}
                  {result.message}
                </div>
              )}
            </div>
          )}

          {/* Attempt history */}
          {attempts.length > 0 && (
            <AttemptHistory attempts={attempts} newRowIds={newRowIds} />
          )}
        </div>
      </div>
    </>
  );
}

// ── Solvers section ────────────────────────────────────────────────────────────

function SolversSection({
  competitionId, challengeId, solveCount, accent,
}: {
  competitionId: string;
  challengeId: string;
  solveCount: number;
  accent: string;
}) {
  const [open,    setOpen]    = useState(false);
  const [solvers, setSolvers] = useState<CTFChallengeSolverDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const toggle = () => {
    if (!open && !fetched) {
      setLoading(true);
      getChallengeSolvers(competitionId, challengeId)
        .then(setSolvers)
        .catch(() => {})
        .finally(() => { setLoading(false); setFetched(true); });
    }
    setOpen(o => !o);
  };

  // Up to 5 stacked avatar initials in the summary
  const previewCount = Math.min(solveCount, 5);

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Summary toggle row */}
      <button
        type="button"
        onClick={toggle}
        style={{
          width: "100%", display: "flex", alignItems: "center",
          justifyContent: "space-between",
          background: "#0f172a",
          border: "1px solid #1e293b",
          borderRadius: open ? "8px 8px 0 0" : 8,
          padding: "10px 14px",
          cursor: "pointer",
          transition: "border-color 150ms, background 150ms",
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.borderColor = `${accent}35`;
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.borderColor = "#1e293b";
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Stacked avatar previews */}
          <div style={{ display: "flex" }}>
            {Array.from({ length: previewCount }).map((_, i) => (
              <div key={i} style={{
                width: 22, height: 22, borderRadius: "50%",
                background: `hsl(${(i * 67 + 210) % 360}, 55%, 45%)`,
                border: "2px solid #0f172a",
                marginLeft: i > 0 ? -7 : 0,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                fontSize: 9, fontWeight: 700, color: "#fff",
                flexShrink: 0,
              }}>
                {String.fromCharCode(65 + i)}
              </div>
            ))}
          </div>

          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#cbd5e1" }}>
              {solveCount} team{solveCount !== 1 ? "s" : ""} solved
            </div>
          </div>
        </div>

        <ChevronDown
          size={14}
          color="#475569"
          style={{
            transition: "transform 200ms ease",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      {/* Expanded list */}
      {open && (
        <div style={{
          border: "1px solid #1e293b", borderTop: "none",
          borderRadius: "0 0 8px 8px",
          maxHeight: 240, overflowY: "auto",
          background: "#080d1c",
        }}>
          {loading ? (
            <div style={{ padding: 16, display: "flex", justifyContent: "center" }}>
              <Loader2 size={16} color="#6366f1" style={{ animation: "spin 1s linear infinite" }} />
            </div>
          ) : solvers.length === 0 ? (
            <div style={{ padding: "12px 16px", fontSize: 12, color: "#475569", textAlign: "center" }}>
              No solver data yet.
            </div>
          ) : (
            solvers.map((s, i) => (
              <div key={s.teamId} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 14px",
                borderTop: i > 0 ? "1px solid #0f172a" : undefined,
                background: i === 0 ? "rgba(239,68,68,0.04)" : "transparent",
              }}>
                {/* Rank */}
                <div style={{
                  width: 22, flexShrink: 0, textAlign: "right",
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

                {/* Name + First Blood badge */}
                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
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
                      fontSize: 9, fontWeight: 800,
                      color: "#ef4444",
                      background: "rgba(239,68,68,0.1)",
                      border: "1px solid rgba(239,68,68,0.25)",
                      borderRadius: 4, padding: "1px 6px",
                      letterSpacing: "0.04em", textTransform: "uppercase",
                      flexShrink: 0,
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
            ))
          )}
        </div>
      )}
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
        textTransform: "uppercase", letterSpacing: "0.1em",
        marginBottom: 8,
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
              background: revealedText
                ? "rgba(251,191,36,0.12)"
                : "rgba(71,85,105,0.3)",
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
                {isUnlocking
                  ? "Unlocking…"
                  : revealedText
                  ? revealedText
                  : "Click to unlock this hint"}
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
        display: "flex", alignItems: "center",
        justifyContent: "space-between", marginBottom: 5,
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
            background: "rgba(99,102,241,0.1)",
            border: "1px solid rgba(99,102,241,0.2)",
            borderRadius: 4, padding: "1px 6px",
          }}>
            <Infinity size={10} /> Unlimited
          </span>
        ) : (
          <span style={{
            fontSize: 11, fontWeight: 600,
            color: attemptsRemaining === 0 ? "#ef4444" : "#64748b",
          }}>
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
      background: "#0c1225",
      border: "1px solid #1e293b",
      borderRadius: 10,
      overflow: "hidden",
    }}>
      <div style={{
        padding: "9px 14px",
        borderBottom: "1px solid #0f172a",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{
          fontSize: 10, fontWeight: 700, color: "#334155",
          textTransform: "uppercase", letterSpacing: "0.1em",
        }}>
          Attempt history
        </span>
        <span style={{
          fontSize: 10, color: "#475569",
          background: "#0f172a",
          border: "1px solid #1e293b",
          borderRadius: 4, padding: "1px 7px",
        }}>
          {attempts.length}
        </span>
      </div>
      <div style={{ maxHeight: 200, overflowY: "auto" }}>
        {attempts.map((a, i) => (
          <div
            key={a.id}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 14px",
              borderBottom: i < attempts.length - 1 ? "1px solid #080d1c" : "none",
              animation: newRowIds.has(a.id)
                ? "ctf-row-in 0.28s cubic-bezier(0.16,1,0.3,1)"
                : undefined,
              background: a.correct ? "rgba(34,197,94,0.03)" : "transparent",
            }}
          >
            <div style={{
              width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
              background: a.correct ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.12)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontSize: 10, color: a.correct ? "#22c55e" : "#ef4444" }}>
                {a.correct ? "✓" : "✗"}
              </span>
            </div>

            <span style={{
              flex: 1,
              fontFamily: "ui-monospace, monospace",
              fontSize: 11,
              color: "#334155",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
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
