"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  X, CheckCircle2, AlertCircle, Loader2, Download, Lightbulb,
  Pause, Infinity, Trophy, Flag,
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

// ── Color tokens ──────────────────────────────────────────────────────────────
const BORDER_FINE   = "rgba(255,255,255,0.07)";
const BORDER_MED    = "rgba(255,255,255,0.11)";
const BORDER_INPUT  = "rgba(255,255,255,0.12)";
const BG_CARD       = "#0f111a";
const BG_PANEL      = "#0c0e17";
const BG_RECESSED   = "#0a0c14";
const BG_SUBMIT     = "#080a12";
const TEXT_PRIMARY  = "#f1f5f9";
const TEXT_MUTED    = "#8b9ab5";
const TEXT_DIM      = "#4a5568";
const TEXT_FAINT    = "#2d3a4f";

export default function ChallengeModal({
  competitionId, challengeId, teamId, canSolve, isPaused, isEnded, onClose, onSolved,
}: Props) {
  const [challenge, setChallenge] = useState<CTFCompetitionChallengeDTO | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [closing,   setClosing]   = useState(false);
  const [entered,   setEntered]   = useState(false);

  const [unlockedHints, setUnlockedHints] = useState<Record<string, string>>({});
  const [unlockingHint, setUnlockingHint] = useState<string | null>(null);

  const handleUnlockHint = async (hintId: string) => {
    if (unlockingHint) return;
    setUnlockingHint(hintId);
    try {
      const res = await unlockCTFHint(challenge?.id ?? challengeId, hintId, { competitionId, teamId });
      setUnlockedHints(prev => ({ ...prev, [hintId]: res.text ?? "" }));
    } catch (e: unknown) {
      toast.error("Unlock failed", e instanceof Error ? e.message : "Could not unlock hint.");
    } finally {
      setUnlockingHint(null);
    }
  };

  const [flag,       setFlag]      = useState("");
  const [busy,       setBusy]      = useState(false);
  const [result,     setResult]    = useState<{ correct: boolean; message: string } | null>(null);
  const [shaking,    setShaking]   = useState(false);
  const [glowing,    setGlowing]   = useState(false);
  const [wrongState, setWrongState] = useState(false);
  const [resultKey,  setResultKey] = useState(0);
  const inputRef      = useRef<HTMLInputElement>(null);
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
    }).catch(() => {}).finally(() => setLoading(false));
  }, [competitionId, challengeId]);

  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 400);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") doClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doClose = () => { setClosing(true); setTimeout(onClose, 220); };

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
        setTimeout(() => window.location.reload(), 1200);
      } else {
        setResult({ correct: false, message: res.message });
        setShaking(true);
        setWrongState(true);
        setTimeout(() => setShaking(false), 500);
        setTimeout(() => setWrongState(false), 2500);
        if (!res.lockedOut) {
          wrongTimerRef.current = setTimeout(() => setResult(null), 4000);
          toast.error("Wrong flag", res.message ?? "Try again.");
        }
      }
      setFlag("");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Submission failed.";
      setResult({ correct: false, message: msg });
      setShaking(true);
      setWrongState(true);
      setTimeout(() => setShaking(false), 500);
      setTimeout(() => setWrongState(false), 2500);
      wrongTimerRef.current = setTimeout(() => setResult(null), 4000);
    } finally {
      setBusy(false);
    }
  };

  const conf   = challenge ? (CAT_CONFIG[challenge.category] ?? null) : null;
  const accent = conf?.accent ?? "#6366f1";

  const cardBorder = glowing
    ? "1px solid rgba(34,197,94,0.55)"
    : wrongState
    ? "1px solid rgba(239,68,68,0.5)"
    : `1px solid ${BORDER_FINE}`;

  const cardShadow = glowing
    ? "0 0 0 1px rgba(34,197,94,0.1), 0 32px 96px rgba(0,0,0,0.85), 0 0 60px rgba(34,197,94,0.4), 0 0 120px rgba(34,197,94,0.15)"
    : wrongState
    ? "0 0 0 1px rgba(239,68,68,0.08), 0 32px 96px rgba(0,0,0,0.85), 0 0 60px rgba(239,68,68,0.28)"
    : `0 0 0 1px rgba(255,255,255,0.02), 0 32px 96px rgba(0,0,0,0.85), 0 0 80px ${accent}0a`;

  const cardAnim = closing
    ? "ctfm-out 220ms cubic-bezier(0.4,0,1,1) forwards"
    : !entered
    ? "ctfm-in 320ms cubic-bezier(0.16,1,0.3,1)"
    : shaking
    ? "ctf-shake 0.5s cubic-bezier(0.36,0.07,0.19,0.97)"
    : glowing
    ? "ctf-pulse-correct 1.4s ease-out"
    : undefined;

  return (
    <>
      <div
        onClick={doClose}
        style={{
          position: "fixed", inset: 0, zIndex: 110,
          background: closing ? "rgba(0,0,0,0)" : "rgba(1,4,14,0.88)",
          backdropFilter: closing ? "blur(0px)" : "blur(12px)",
          WebkitBackdropFilter: closing ? "blur(0px)" : "blur(12px)",
          transition: "background 220ms ease, backdrop-filter 220ms ease",
          display: "flex", justifyContent: "center", alignItems: "center",
          padding: "16px",
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          onClick={e => e.stopPropagation()}
          style={{
            width: "min(96vw, 1020px)",
            height: "min(90vh, 700px)",
            background: BG_CARD,
            border: cardBorder,
            borderRadius: 12,
            display: "flex", flexDirection: "column",
            overflow: "hidden",
            boxShadow: cardShadow,
            animation: cardAnim,
            transition: "border-color 0.4s ease, box-shadow 0.4s ease",
          }}
        >
          {loading ? <LoadingSkeleton /> : !challenge
            ? <UnavailableState onClose={doClose} />
            : <ChallengeBody
                c={challenge} accent={accent} conf={conf}
                competitionId={competitionId} teamId={teamId}
                canSolve={canSolve} isPaused={isPaused} isEnded={isEnded}
                flag={flag} setFlag={setFlag}
                busy={busy} result={result} resultKey={resultKey}
                inputRef={inputRef} onSubmit={submit} onClose={doClose}
                unlockedHints={unlockedHints} unlockingHint={unlockingHint}
                onUnlockHint={handleUnlockHint}
                attempts={attempts} attemptsUsed={attemptsUsed}
                attemptsRemaining={attemptsRemaining} lockedOut={lockedOut}
                newRowIds={newRowIds}
              />
          }
        </div>
      </div>

      <style jsx global>{`
        @keyframes ctfm-in {
          from { opacity: 0; transform: scale(0.96) translateY(10px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
        @keyframes ctfm-out {
          from { opacity: 1; transform: scale(1)    translateY(0); }
          to   { opacity: 0; transform: scale(0.96) translateY(10px); }
        }
        @keyframes ctf-shake {
          0%,100% { transform: translateX(0); }
          12%     { transform: translateX(-9px); }
          24%     { transform: translateX(8px); }
          40%     { transform: translateX(-6px); }
          58%     { transform: translateX(5px); }
          74%     { transform: translateX(-3px); }
          88%     { transform: translateX(2px); }
        }
        @keyframes ctf-pulse-correct {
          0%   { box-shadow: 0 0 0 1px rgba(34,197,94,0.1), 0 32px 96px rgba(0,0,0,0.85), 0 0 30px rgba(34,197,94,0.3); }
          50%  { box-shadow: 0 0 0 1px rgba(34,197,94,0.2), 0 32px 96px rgba(0,0,0,0.85), 0 0 80px rgba(34,197,94,0.55), 0 0 140px rgba(34,197,94,0.2); }
          100% { box-shadow: 0 0 0 1px rgba(34,197,94,0.1), 0 32px 96px rgba(0,0,0,0.85), 0 0 60px rgba(34,197,94,0.4), 0 0 120px rgba(34,197,94,0.15); }
        }
        @keyframes ctf-result-in {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ctf-row-in {
          from { opacity: 0; transform: translateY(-2px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ctf-unlock-spin { to { transform: rotate(360deg); } }
        @keyframes ctf-tab-fade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .ctfm-flag-input:focus {
          border-color: var(--accent-focus) !important;
          box-shadow: 0 0 0 3px var(--accent-glow) !important;
          outline: none;
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; transition: none !important; }
        }
      `}</style>
    </>
  );
}

// ── Loading skeleton ────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "16px 20px", gap: 14 }}>
      <div style={{ borderBottom: `1px solid ${BORDER_FINE}`, paddingBottom: 12 }}>
        <div className="skel" style={{ height: 12, width: 130, borderRadius: 4, marginBottom: 8 }} />
        <div className="skel" style={{ height: 18, width: "55%", borderRadius: 5, marginBottom: 8 }} />
        <div className="skel" style={{ height: 11, width: 200, borderRadius: 3 }} />
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {[80, 60, 50, 80].map((w, i) => (
          <div key={i} className="skel" style={{ height: 24, width: w, borderRadius: 4 }} />
        ))}
      </div>
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "60fr 40fr", gap: 0 }}>
        <div style={{ paddingRight: 14 }}>
          {[88, 78, 65, 52, 68].map((w, i) => (
            <div key={i} className="skel" style={{ height: 12, width: `${w}%`, borderRadius: 3, marginBottom: 8 }} />
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingLeft: 14, borderLeft: `1px solid ${BORDER_FINE}` }}>
          <div className="skel" style={{ height: 70, borderRadius: 6 }} />
          <div className="skel" style={{ height: 36, borderRadius: 6 }} />
        </div>
      </div>
      <div style={{ borderTop: `1px solid ${BORDER_FINE}`, paddingTop: 12, display: "flex", gap: 8 }}>
        <div className="skel" style={{ flex: 1, height: 38, borderRadius: 6 }} />
        <div className="skel" style={{ width: 140, height: 38, borderRadius: 6 }} />
      </div>
    </div>
  );
}

// ── Unavailable state ───────────────────────────────────────────────────────────

function UnavailableState({ onClose }: { onClose: () => void }) {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 28 }}>
      <div style={{ textAlign: "center" }}>
        <AlertCircle size={32} color={TEXT_DIM} style={{ marginBottom: 12, opacity: 0.5 }} />
        <div style={{ fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY, marginBottom: 5 }}>
          Challenge unavailable
        </div>
        <div style={{ fontSize: 12, color: TEXT_DIM, marginBottom: 18 }}>
          It may have been hidden by the organizer.
        </div>
        <button onClick={onClose} className="psp-btn psp-btn-secondary">Close</button>
      </div>
    </div>
  );
}

// ── Challenge body ──────────────────────────────────────────────────────────────

type TabKey = "description" | "solvers" | "hints" | "log";

function ChallengeBody({
  c, accent, conf, competitionId, teamId, canSolve, isPaused, isEnded,
  flag, setFlag, busy, result, resultKey,
  inputRef, onSubmit, onClose,
  unlockedHints, unlockingHint, onUnlockHint,
  attempts, attemptsUsed, attemptsRemaining, lockedOut, newRowIds,
}: {
  c: CTFCompetitionChallengeDTO;
  accent: string;
  conf: { label: string; icon: React.ReactNode; accent: string } | null;
  competitionId: string; teamId?: string;
  canSolve: boolean; isPaused: boolean; isEnded: boolean;
  flag: string; setFlag: (v: string) => void;
  busy: boolean;
  result: { correct: boolean; message: string } | null;
  resultKey: number;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onSubmit: () => void; onClose: () => void;
  unlockedHints: Record<string, string>;
  unlockingHint: string | null;
  onUnlockHint: (id: string) => void;
  attempts: CTFAttemptDTO[];
  attemptsUsed: number; attemptsRemaining: number | null;
  lockedOut: boolean; newRowIds: Set<string>;
}) {
  const [leftTab, setLeftTab] = useState<TabKey>("description");

  const alreadySolved = c.solvedByMe || attempts.some(a => a.correct);
  const inputDisabled = busy || isPaused || lockedOut || alreadySolved;
  const submitDisabled = inputDisabled || !flag.trim();
  const isUnlimited = c.maxAttempts == null;
  const diffColor = DIFF_COLORS[c.difficulty] ?? "#94a3b8";
  const pts = c.currentPoints ?? c.basePoints;
  const hintCount = c.hints?.length ?? 0;

  const hasAssets = c.requiresInstance || !!c.downloadableFileUrl;

  const TABS: { key: TabKey; label: string }[] = [
    { key: "description", label: "Description" },
    { key: "solvers",     label: `Solvers (${c.solveCount})` },
    { key: "hints",       label: `Hints (${hintCount})` },
    { key: "log",         label: `Attempt Log (${attempts.length})` },
  ];

  return (
    <>
      {/* ── ZONE 1: Header & Tab Navigation ──────────────────────────────────── */}
      <div style={{
        flexShrink: 0,
        background: `linear-gradient(160deg, ${accent}07 0%, ${BG_CARD} 60%)`,
        borderBottom: `1px solid ${BORDER_FINE}`,
        padding: "12px 18px 0",
      }}>
        {/* Row 1: badges + title + close */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                background: `${accent}1c`, border: `1px solid ${accent}38`,
                color: accent, borderRadius: 4, padding: "1px 8px",
                fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
              }}>
                {conf?.icon} {c.category}
              </span>
              <span style={{
                display: "inline-flex", alignItems: "center",
                background: `${diffColor}14`, border: `1px solid ${diffColor}28`,
                color: diffColor, borderRadius: 4, padding: "1px 8px",
                fontSize: 9.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
              }}>
                {c.difficulty}
              </span>
              {alreadySolved && (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 3,
                  background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)",
                  color: "#22c55e", borderRadius: 4, padding: "1px 8px",
                  fontSize: 9.5, fontWeight: 700, letterSpacing: "0.04em",
                }}>
                  <CheckCircle2 size={9} /> SOLVED
                </span>
              )}
            </div>
            <div style={{
              fontSize: 18, fontWeight: 800, color: TEXT_PRIMARY,
              lineHeight: 1.2, letterSpacing: "-0.3px",
            }}>
              {c.title}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              flexShrink: 0, marginLeft: 12,
              background: "transparent", border: `1px solid ${BORDER_FINE}`,
              borderRadius: 6, color: TEXT_DIM, cursor: "pointer",
              padding: "5px 7px", display: "inline-flex", alignItems: "center",
              transition: "all 0.15s ease-in-out",
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = "rgba(255,255,255,0.05)";
              el.style.color = TEXT_PRIMARY;
              el.style.borderColor = BORDER_MED;
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = "transparent";
              el.style.color = TEXT_DIM;
              el.style.borderColor = BORDER_FINE;
            }}
          >
            <X size={13} />
          </button>
        </div>

        {/* Row 2: meta */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Trophy size={11} color={accent} />
            <span style={{
              fontSize: 13, fontWeight: 800, color: accent,
              fontFamily: "ui-monospace, monospace",
            }}>{pts}</span>
            <span style={{ fontSize: 10, color: TEXT_FAINT, letterSpacing: "0.04em", textTransform: "uppercase" }}>pts</span>
          </div>
          <div style={{ width: 1, height: 10, background: BORDER_FINE }} />
          {c.flagFormat && (
            <>
              <span style={{
                fontFamily: "ui-monospace, monospace", fontSize: 10.5,
                color: TEXT_FAINT,
              }}>
                {c.flagFormat}
              </span>
              <div style={{ width: 1, height: 10, background: BORDER_FINE }} />
            </>
          )}
          <span style={{ fontSize: 10, color: TEXT_FAINT, letterSpacing: "0.04em", textTransform: "uppercase" }}>
            {c.maxAttempts != null ? `${attemptsUsed}/${c.maxAttempts} attempts` : "Unlimited"}
          </span>
          {!isUnlimited && attemptsRemaining != null && attemptsRemaining <= 3 && attemptsRemaining > 0 && (
            <>
              <div style={{ width: 1, height: 10, background: BORDER_FINE }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: "#f97316", letterSpacing: "0.04em" }}>
                {attemptsRemaining} LEFT
              </span>
            </>
          )}
        </div>

        {/* Row 3: tab navigation */}
        <div style={{ display: "flex", gap: 0 }}>
          {TABS.map(tab => {
            const active = leftTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setLeftTab(tab.key)}
                style={{
                  background: "transparent", border: "none",
                  borderBottom: active ? `2px solid ${accent}` : "2px solid transparent",
                  color: active ? accent : TEXT_DIM,
                  textShadow: active ? `0 0 10px ${accent}90` : "none",
                  padding: "8px 14px",
                  fontSize: 11.5, fontWeight: active ? 700 : 500,
                  cursor: "pointer", letterSpacing: "0.02em",
                  transition: "all 0.15s ease-in-out",
                  marginBottom: "-1px",
                }}
                onMouseEnter={e => {
                  if (!active) (e.currentTarget as HTMLElement).style.color = TEXT_MUTED;
                }}
                onMouseLeave={e => {
                  if (!active) (e.currentTarget as HTMLElement).style.color = TEXT_DIM;
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── ZONE 2: Content + optional Sidepanel ────────────────────────────── */}
      <div style={{
        flex: 1, minHeight: 0,
        display: "grid",
        gridTemplateColumns: hasAssets ? "60fr 40fr" : "1fr",
      }}>
        {/* Left: tab content — expands to full width when no assets */}
        <div style={{
          overflowY: "auto",
          borderRight: hasAssets ? `1px solid ${BORDER_FINE}` : "none",
          background: BG_RECESSED,
        }}>
          <div
            key={leftTab}
            style={{
              padding: "16px 18px",
              animation: "ctf-tab-fade 0.15s ease-in-out",
            }}
          >
            {leftTab === "description" && <DescriptionTab c={c} />}
            {leftTab === "solvers"     && <SolversTab competitionId={competitionId} challengeId={c.id} solveCount={c.solveCount} accent={accent} />}
            {leftTab === "hints"       && <HintsTab hints={c.hints ?? []} unlockedHints={unlockedHints} unlockingHint={unlockingHint} onUnlockHint={onUnlockHint} accent={accent} />}
            {leftTab === "log"         && <AttemptLogTab attempts={attempts} newRowIds={newRowIds} />}
          </div>
        </div>

        {/* Right: operational sidepanel — only rendered when assets exist */}
        {hasAssets && (
          <div style={{
            background: BG_PANEL,
            overflowY: "auto",
            padding: "14px",
            display: "flex", flexDirection: "column", gap: 10,
          }}>
            {c.requiresInstance && (
              <div style={{ flexShrink: 0 }}>
                <InstancePanel
                  challengeId={c.id}
                  challengeTitle={c.title}
                  requiresInstance
                  connectionType={c.connectionType ?? "HTTP"}
                  competitionId={competitionId}
                  teamId={teamId}
                  dark
                />
              </div>
            )}
            {c.downloadableFileUrl && (
              <CompactFileRow
                fileName={c.downloadableFileName ?? "challenge-file"}
                fileUrl={c.downloadableFileUrl}
                accent={accent}
              />
            )}
          </div>
        )}
      </div>

      {/* ── ZONE 3: Full-width submit bar ─────────────────────────────────────── */}
      <div style={{
        flexShrink: 0,
        borderTop: `1px solid ${BORDER_FINE}`,
        background: BG_SUBMIT,
        padding: "12px 18px",
      }}>
        {alreadySolved ? (
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.22)",
            borderRadius: 7, padding: "9px 14px",
          }}>
            <CheckCircle2 size={15} color="#22c55e" />
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#34d399" }}>Challenge Solved</div>
              <div style={{ fontSize: 10.5, color: TEXT_DIM, marginTop: 1 }}>
                Your team has already completed this challenge.
              </div>
            </div>
          </div>
        ) : isEnded ? (
          <div style={{
            padding: "10px 14px", borderRadius: 7,
            background: BG_RECESSED, border: `1px solid ${BORDER_FINE}`,
            color: TEXT_DIM, fontSize: 11.5, textAlign: "center",
            letterSpacing: "0.02em",
          }}>
            Competition ended — submissions are closed.
          </div>
        ) : (
          <SubmitBar
            accent={accent}
            isPaused={isPaused} lockedOut={lockedOut}
            flag={flag} setFlag={setFlag}
            busy={busy} result={result} resultKey={resultKey}
            inputDisabled={inputDisabled} submitDisabled={submitDisabled}
            inputRef={inputRef} onSubmit={onSubmit}
            isUnlimited={isUnlimited}
          />
        )}
      </div>
    </>
  );
}

// ── Description tab ─────────────────────────────────────────────────────────────

function DescriptionTab({ c }: { c: CTFCompetitionChallengeDTO }) {
  return (
    <div style={{
      fontSize: 13, color: "#b4c2d4", lineHeight: 1.75,
      whiteSpace: "pre-wrap", wordBreak: "break-word",
    }}>
      {c.description}
    </div>
  );
}

// ── Solvers tab ─────────────────────────────────────────────────────────────────

function SolversTab({
  competitionId, challengeId, solveCount, accent,
}: {
  competitionId: string; challengeId: string; solveCount: number; accent: string;
}) {
  const [solvers, setSolvers] = useState<CTFChallengeSolverDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (fetched) return;
    setLoading(true);
    getChallengeSolvers(competitionId, challengeId)
      .then(setSolvers).catch(() => {})
      .finally(() => { setLoading(false); setFetched(true); });
  }, [competitionId, challengeId, fetched]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", paddingTop: 36 }}>
        <Loader2 size={16} color={accent} style={{ animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  if (solveCount === 0) {
    return (
      <div style={{ textAlign: "center", paddingTop: 40, color: TEXT_FAINT }}>
        <Trophy size={28} strokeWidth={1.2} style={{ marginBottom: 10, opacity: 0.4 }} />
        <div style={{ fontSize: 12, fontWeight: 600, color: TEXT_DIM }}>No solves yet</div>
        <div style={{ fontSize: 11, marginTop: 4 }}>Be the first team to crack this challenge.</div>
      </div>
    );
  }

  if (!solvers.length) {
    return (
      <div style={{ textAlign: "center", paddingTop: 36, color: TEXT_FAINT, fontSize: 11.5 }}>
        No solver data available.
      </div>
    );
  }

  return (
    <div>
      <div style={{
        display: "grid", gridTemplateColumns: "38px 28px 1fr 100px",
        padding: "4px 8px", marginBottom: 4,
        fontSize: 9.5, fontWeight: 700, color: TEXT_FAINT,
        textTransform: "uppercase", letterSpacing: "0.1em",
        borderBottom: `1px solid ${BORDER_FINE}`,
      }}>
        <span>Rank</span>
        <span />
        <span>Team</span>
        <span style={{ textAlign: "right" }}>Solved at</span>
      </div>

      {solvers.map((s, i) => (
        <div
          key={s.teamId}
          style={{
            display: "grid", gridTemplateColumns: "38px 28px 1fr 100px",
            alignItems: "center",
            padding: "7px 8px",
            borderRadius: 5,
            background: i === 0 ? "rgba(239,68,68,0.04)" : "transparent",
            borderBottom: i < solvers.length - 1 ? `1px solid ${BORDER_FINE}` : "none",
            transition: "background 0.15s ease-in-out",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.025)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = i === 0 ? "rgba(239,68,68,0.04)" : "transparent"; }}
        >
          <span style={{
            fontFamily: "ui-monospace, monospace", fontSize: 11, fontWeight: 800,
            color: i === 0 ? "#ef4444" : i === 1 ? "#94a3b8" : i === 2 ? "#fb923c" : TEXT_FAINT,
          }}>
            #{i + 1}
          </span>
          <div style={{
            width: 22, height: 22, borderRadius: "50%", background: s.avatarColor,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 700, color: "#fff",
          }}>
            {s.teamName.charAt(0).toUpperCase()}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, paddingLeft: 6 }}>
            <Link
              href={`/ctf/competitions/${competitionId}/teams/${s.teamId}`}
              style={{
                fontWeight: 600, color: "#c8d6e8", fontSize: 12,
                textDecoration: "none",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                transition: "color 0.15s ease-in-out",
              }}
              onMouseEnter={e => { (e.target as HTMLElement).style.color = accent; }}
              onMouseLeave={e => { (e.target as HTMLElement).style.color = "#c8d6e8"; }}
            >
              {s.teamName}
            </Link>
            {i === 0 && (
              <span style={{
                fontSize: 8.5, fontWeight: 800, color: "#ef4444",
                background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.22)",
                borderRadius: 3, padding: "1px 5px",
                letterSpacing: "0.05em", textTransform: "uppercase", flexShrink: 0,
              }}>
                FIRST BLOOD
              </span>
            )}
          </div>
          <div style={{ fontSize: 10, color: TEXT_FAINT, textAlign: "right", whiteSpace: "nowrap", fontFamily: "ui-monospace, monospace" }}>
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

// ── Hints tab ───────────────────────────────────────────────────────────────────

function HintsTab({
  hints, unlockedHints, unlockingHint, onUnlockHint, accent,
}: {
  hints: { id: string; cost: number; text?: string | null }[];
  unlockedHints: Record<string, string>;
  unlockingHint: string | null;
  onUnlockHint: (id: string) => void;
  accent: string;
}) {
  const [confirming, setConfirming] = useState<string | null>(null);

  if (hints.length === 0) {
    return (
      <div style={{ textAlign: "center", paddingTop: 40, color: TEXT_FAINT }}>
        <Lightbulb size={28} strokeWidth={1.3} style={{ marginBottom: 10, opacity: 0.4 }} />
        <div style={{ fontSize: 12, fontWeight: 600, color: TEXT_DIM }}>No hints available</div>
        <div style={{ fontSize: 11, marginTop: 4 }}>No hints have been added for this challenge yet.</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      {hints.map((h, i) => {
        const revealedText = h.text ?? unlockedHints[h.id];
        const isUnlocking  = unlockingHint === h.id;
        const isLocked     = !revealedText;
        const isConfirming = confirming === h.id;

        const handleClick = () => {
          if (!isLocked || isUnlocking) return;
          if (isConfirming) return; // already in confirm state
          setConfirming(h.id);
        };
        const handleConfirm = (e: React.MouseEvent) => {
          e.stopPropagation();
          setConfirming(null);
          onUnlockHint(h.id);
        };
        const handleCancel = (e: React.MouseEvent) => {
          e.stopPropagation();
          setConfirming(null);
        };

        return (
          <div
            key={h.id}
            onClick={handleClick}
            style={{
              background: isLocked ? "rgba(255,255,255,0.015)" : "rgba(251,191,36,0.04)",
              border: `1px solid ${isConfirming ? "rgba(251,191,36,0.45)" : isLocked ? BORDER_FINE : "rgba(251,191,36,0.22)"}`,
              borderRadius: 7, padding: "11px 12px",
              display: "flex", gap: 11, alignItems: "flex-start",
              cursor: isLocked && !isConfirming ? "pointer" : "default",
              opacity: isUnlocking ? 0.6 : 1,
              transition: "all 0.15s ease-in-out",
            }}
            onMouseEnter={e => {
              if (isLocked && !isConfirming) {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(251,191,36,0.35)";
                (e.currentTarget as HTMLElement).style.background = "rgba(251,191,36,0.04)";
              }
            }}
            onMouseLeave={e => {
              if (isLocked && !isConfirming) {
                (e.currentTarget as HTMLElement).style.borderColor = BORDER_FINE;
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.015)";
              }
            }}
          >
            <div style={{
              width: 28, height: 28, borderRadius: 6, flexShrink: 0,
              background: revealedText ? "rgba(251,191,36,0.1)" : "rgba(255,255,255,0.025)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Lightbulb
                size={13}
                color={revealedText ? "#fbbf24" : TEXT_DIM}
                style={isUnlocking ? { animation: "ctf-unlock-spin 0.8s linear infinite" } : undefined}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                letterSpacing: "0.08em", marginBottom: 4,
                color: revealedText ? "#fbbf24" : TEXT_MUTED,
                display: "flex", alignItems: "center", gap: 7,
              }}>
                Hint {i + 1}
                {isLocked && (
                  <span style={{
                    fontSize: 9.5, fontWeight: 600, color: TEXT_FAINT,
                    textTransform: "none", letterSpacing: 0,
                    background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER_FINE}`,
                    borderRadius: 3, padding: "1px 6px",
                  }}>
                    −{h.cost} pts
                  </span>
                )}
              </div>

              {/* Inline confirmation prompt — replaces content when pending */}
              {isConfirming ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, color: "#fbbf24", fontWeight: 600 }}>
                    Spend {h.cost} pts to unlock?
                  </span>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    style={{
                      background: "#fbbf24", border: "none", borderRadius: 4,
                      color: "#000", fontSize: 11, fontWeight: 800,
                      padding: "3px 10px", cursor: "pointer",
                      transition: "opacity 0.15s",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "0.85"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    style={{
                      background: "transparent", border: `1px solid ${BORDER_FINE}`,
                      borderRadius: 4, color: TEXT_MUTED, fontSize: 11, fontWeight: 600,
                      padding: "3px 10px", cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.background = "rgba(255,255,255,0.04)";
                      el.style.color = TEXT_PRIMARY;
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.background = "transparent";
                      el.style.color = TEXT_MUTED;
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div style={{
                  fontSize: 12.5, lineHeight: 1.6,
                  color: revealedText ? "#dde6f0" : TEXT_DIM,
                  fontStyle: revealedText ? "normal" : "italic",
                }}>
                  {isUnlocking ? "Unlocking…" : revealedText ?? "Click to spend points and reveal this hint"}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Attempt Log tab ─────────────────────────────────────────────────────────────

function AttemptLogTab({
  attempts, newRowIds,
}: {
  attempts: CTFAttemptDTO[]; newRowIds: Set<string>;
}) {
  if (attempts.length === 0) {
    return (
      <div style={{ textAlign: "center", paddingTop: 40, color: TEXT_FAINT }}>
        <Flag size={26} strokeWidth={1.2} style={{ marginBottom: 10, opacity: 0.4 }} />
        <div style={{ fontSize: 12, fontWeight: 600, color: TEXT_DIM }}>No attempts yet</div>
        <div style={{ fontSize: 11, marginTop: 4 }}>Your submission history will appear here.</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{
        display: "grid", gridTemplateColumns: "32px 1fr 100px",
        padding: "4px 8px", marginBottom: 4,
        fontSize: 9.5, fontWeight: 700, color: TEXT_FAINT,
        textTransform: "uppercase", letterSpacing: "0.1em",
        borderBottom: `1px solid ${BORDER_FINE}`,
      }}>
        <span />
        <span>Submitted flag</span>
        <span style={{ textAlign: "right" }}>When</span>
      </div>

      {attempts.map((a, i) => (
        <div
          key={a.id}
          style={{
            display: "grid", gridTemplateColumns: "32px 1fr 100px",
            alignItems: "center", gap: 8,
            padding: "7px 8px",
            borderBottom: i < attempts.length - 1 ? `1px solid ${BORDER_FINE}` : "none",
            background: a.correct ? "rgba(34,197,94,0.04)" : "transparent",
            animation: newRowIds.has(a.id) ? "ctf-row-in 0.28s ease" : undefined,
            transition: "background 0.15s ease-in-out",
          }}
        >
          <div style={{
            width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
            background: a.correct ? "rgba(34,197,94,0.14)" : "rgba(239,68,68,0.1)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: a.correct ? "#22c55e" : "#ef4444",
          }}>
            {a.correct ? <CheckCircle2 size={11} /> : <X size={11} />}
          </div>
          <span style={{
            fontFamily: "ui-monospace, monospace", fontSize: 11.5,
            color: a.correct ? "#86efac" : "#cbd5e1",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {a.flagMasked}
          </span>
          <span style={{
            fontSize: 10, color: TEXT_FAINT, textAlign: "right",
            fontFamily: "ui-monospace, monospace",
          }}>
            {relativeTime(a.submittedAt)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Compact file download row ───────────────────────────────────────────────────

function CompactFileRow({
  fileName, fileUrl, accent,
}: { fileName: string; fileUrl: string; accent: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      background: BG_RECESSED, border: `1px solid ${BORDER_FINE}`,
      borderRadius: 6, padding: "7px 10px",
    }}>
      <Download size={12} color={TEXT_DIM} style={{ flexShrink: 0 }} />
      <span style={{
        flex: 1, minWidth: 0,
        fontSize: 11.5, color: "#dde6f0",
        fontFamily: "ui-monospace, monospace",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {fileName}
      </span>
      <a
        href={fileUrl}
        target="_blank"
        rel="noopener noreferrer"
        title="Download file"
        style={{
          flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center",
          height: 26, padding: "0 10px", borderRadius: 5,
          background: `${accent}15`, border: `1px solid ${accent}35`,
          color: accent, fontSize: 10.5, fontWeight: 700,
          textDecoration: "none", letterSpacing: "0.04em", textTransform: "uppercase",
          transition: "all 0.15s ease-in-out",
          whiteSpace: "nowrap",
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.background = `${accent}25`;
          el.style.borderColor = `${accent}55`;
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.background = `${accent}15`;
          el.style.borderColor = `${accent}35`;
        }}
      >
        Download
      </a>
    </div>
  );
}

// ── Full-width submit bar ───────────────────────────────────────────────────────

function SubmitBar({
  accent, isPaused, lockedOut,
  flag, setFlag, busy, result, resultKey,
  inputDisabled, submitDisabled,
  inputRef, onSubmit, isUnlimited,
}: {
  accent: string;
  isPaused: boolean; lockedOut: boolean;
  flag: string; setFlag: (v: string) => void;
  busy: boolean;
  result: { correct: boolean; message: string } | null;
  resultKey: number;
  inputDisabled: boolean; submitDisabled: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onSubmit: () => void; isUnlimited: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {(isPaused || lockedOut) && (
        <div style={{
          display: "flex", alignItems: "center", gap: 7,
          background: isPaused ? "rgba(245,158,11,0.07)" : "rgba(239,68,68,0.07)",
          border: `1px solid ${isPaused ? "rgba(245,158,11,0.22)" : "rgba(239,68,68,0.22)"}`,
          color: isPaused ? "#f59e0b" : "#f87171",
          borderRadius: 6, padding: "6px 12px",
          fontSize: 11.5, fontWeight: 600,
        }}>
          {isPaused ? <Pause size={12} /> : <AlertCircle size={12} />}
          {isPaused ? "Competition is currently paused" : "No attempts remaining — you are locked out"}
        </div>
      )}

      {/* Input row — fixed height, never shifts layout */}
      <div style={{
        display: "flex", gap: 8, alignItems: "stretch",
        ["--accent-focus" as string]: accent,
        ["--accent-glow"  as string]: `${accent}26`,
      } as React.CSSProperties}>
        {/* Input wrapper — position:relative anchors the floating result tooltip */}
        <div style={{ flex: 1, position: "relative" }}>
          <div style={{
            position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
            pointerEvents: "none", zIndex: 1,
          }}>
            <Flag size={13} color={inputDisabled ? TEXT_FAINT : TEXT_DIM} />
          </div>
          <input
            ref={inputRef}
            className="ctfm-flag-input"
            value={flag}
            onChange={e => setFlag(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !inputDisabled) onSubmit(); }}
            placeholder={lockedOut ? "No attempts remaining" : isPaused ? "Submissions paused" : "FLAG{...}"}
            disabled={inputDisabled}
            style={{
              width: "100%",
              fontFamily: "ui-monospace, monospace",
              fontSize: 13, height: "40px",
              paddingLeft: "34px", paddingRight: "14px",
              background: BG_RECESSED,
              border: result
                ? `1px solid ${result.correct ? "rgba(34,197,94,0.55)" : "rgba(239,68,68,0.5)"}`
                : `1px solid ${BORDER_INPUT}`,
              borderRadius: 7,
              boxShadow: result
                ? result.correct
                  ? "0 0 0 3px rgba(34,197,94,0.1)"
                  : "0 0 0 3px rgba(239,68,68,0.08)"
                : undefined,
              transition: "border-color 0.15s ease, box-shadow 0.15s ease",
              color: inputDisabled ? TEXT_FAINT : TEXT_PRIMARY,
              letterSpacing: "0.01em",
              outline: "none",
            }}
          />

          {/* Floating result tooltip — absolute, zero layout shift */}
          {result && (
            <div
              key={resultKey}
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                left: 0, right: 0,
                zIndex: 20,
                padding: "7px 11px", borderRadius: 6,
                fontSize: 11.5, fontWeight: 600,
                background: result.correct
                  ? "rgba(10,18,12,0.97)"
                  : "rgba(18,10,12,0.97)",
                border: `1px solid ${result.correct ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.25)"}`,
                boxShadow: result.correct
                  ? "0 8px 24px rgba(0,0,0,0.6), 0 0 12px rgba(34,197,94,0.15)"
                  : "0 8px 24px rgba(0,0,0,0.6), 0 0 12px rgba(239,68,68,0.12)",
                color: result.correct ? "#4ade80" : "#f87171",
                display: "flex", alignItems: "center", gap: 7,
                animation: "ctf-result-in 0.18s cubic-bezier(0.16,1,0.3,1)",
              }}
            >
              {result.correct ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
              {result.message}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onSubmit}
          disabled={submitDisabled}
          style={{
            flexShrink: 0,
            width: 160, height: 40,
            background: submitDisabled ? "rgba(255,255,255,0.04)" : accent,
            border: submitDisabled ? `1px solid ${BORDER_FINE}` : "none",
            borderRadius: 7,
            color: submitDisabled ? TEXT_FAINT : "#fff",
            fontSize: 13, fontWeight: 800,
            cursor: submitDisabled ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            boxShadow: !submitDisabled ? `0 4px 18px ${accent}55, 0 0 0 1px ${accent}30` : "none",
            transition: "all 0.15s ease-in-out",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
          onMouseEnter={e => {
            if (!submitDisabled) {
              const el = e.currentTarget as HTMLElement;
              el.style.transform = "translateY(-1px)";
              el.style.boxShadow = `0 6px 22px ${accent}66, 0 0 0 1px ${accent}40`;
            }
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.transform = "translateY(0)";
            el.style.boxShadow = !submitDisabled
              ? `0 4px 18px ${accent}55, 0 0 0 1px ${accent}30` : "none";
          }}
        >
          {busy
            ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
            : isPaused ? <><Pause size={12} /> Paused</>
            : lockedOut ? "Locked"
            : "Submit Flag"}
        </button>

        {isUnlimited && !isPaused && !lockedOut && (
          <div style={{
            flexShrink: 0,
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "0 10px", height: 40,
            background: "rgba(255,255,255,0.02)",
            border: `1px solid ${BORDER_FINE}`,
            borderRadius: 7,
            color: accent, fontSize: 10, fontWeight: 700,
            letterSpacing: "0.06em", textTransform: "uppercase",
          }}>
            <Infinity size={11} /> Unlimited
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

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
