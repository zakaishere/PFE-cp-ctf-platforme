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

  // Mark entry animation done after it completes so it doesn't replay on state changes
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

  // Card-wide border & shadow driven by submission state
  const cardBorder = glowing
    ? "1px solid rgba(34,197,94,0.6)"
    : wrongState
    ? "1px solid rgba(239,68,68,0.5)"
    : `1px solid ${accent}20`;

  const cardShadow = glowing
    ? "0 0 0 1px rgba(34,197,94,0.1), 0 32px 96px rgba(0,0,0,0.85), 0 0 60px rgba(34,197,94,0.35), 0 0 120px rgba(34,197,94,0.12)"
    : wrongState
    ? "0 0 0 1px rgba(239,68,68,0.08), 0 32px 96px rgba(0,0,0,0.85), 0 0 50px rgba(239,68,68,0.2)"
    : `0 0 0 1px rgba(255,255,255,0.03), 0 32px 96px rgba(0,0,0,0.85), 0 0 80px ${accent}0a`;

  const cardAnim = closing
    ? "ctfm-out 220ms cubic-bezier(0.4,0,1,1) forwards"
    : !entered
    ? "ctfm-in 320ms cubic-bezier(0.16,1,0.3,1)"
    : shaking
    ? "ctf-shake 0.5s cubic-bezier(0.36,0.07,0.19,0.97)"
    : undefined;

  return (
    <>
      {/* Backdrop */}
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
        {/* ── Main card (card-wide animations live here) ────────────────────── */}
        <div
          role="dialog"
          aria-modal="true"
          onClick={e => e.stopPropagation()}
          style={{
            width: "min(97vw, 1040px)",
            height: "min(91vh, 750px)",
            background: "#070c1b",
            border: cardBorder,
            borderRadius: 14,
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
          from { opacity: 0; transform: scale(0.94) translateY(14px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
        @keyframes ctfm-out {
          from { opacity: 1; transform: scale(1)    translateY(0); }
          to   { opacity: 0; transform: scale(0.94) translateY(14px); }
        }
        @keyframes ctf-shake {
          0%,100% { transform: translateX(0); }
          12%     { transform: translateX(-10px); }
          24%     { transform: translateX(9px); }
          40%     { transform: translateX(-7px); }
          58%     { transform: translateX(6px); }
          74%     { transform: translateX(-4px); }
          88%     { transform: translateX(2px); }
        }
        @keyframes ctf-result-in {
          from { opacity: 0; transform: translateY(5px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
        @keyframes ctf-row-in {
          from { opacity: 0; transform: translateY(-3px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ctf-unlock-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes ctf-tab-fade {
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

// ── Loading skeleton ────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "20px 24px", gap: 18 }}>
      <div style={{ borderBottom: "1px solid #131f35", paddingBottom: 14, display: "flex", justifyContent: "space-between", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div className="skel" style={{ height: 14, width: 140, borderRadius: 5, marginBottom: 10 }} />
          <div className="skel" style={{ height: 22, width: "55%", borderRadius: 6, marginBottom: 8 }} />
          <div className="skel" style={{ height: 12, width: 200, borderRadius: 4 }} />
        </div>
        <div className="skel" style={{ width: 30, height: 30, borderRadius: 7, flexShrink: 0 }} />
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
        {[80, 70, 60].map((w, i) => (
          <div key={i} className="skel" style={{ height: 30, width: w, borderRadius: 6 }} />
        ))}
      </div>
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 310px", gap: 16 }}>
        <div>
          {[88, 78, 65, 52, 68, 80].map((w, i) => (
            <div key={i} className="skel" style={{ height: 13, width: `${w}%`, borderRadius: 4, marginBottom: 10 }} />
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="skel" style={{ height: 90, borderRadius: 8 }} />
          <div className="skel" style={{ height: 50, borderRadius: 8 }} />
        </div>
      </div>
      <div style={{ borderTop: "1px solid #131f35", paddingTop: 14, display: "flex", gap: 10 }}>
        <div className="skel" style={{ flex: 1, height: 44, borderRadius: 8 }} />
        <div className="skel" style={{ width: 160, height: 44, borderRadius: 8 }} />
      </div>
    </div>
  );
}

// ── Unavailable state ───────────────────────────────────────────────────────────

function UnavailableState({ onClose }: { onClose: () => void }) {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 44, marginBottom: 14, opacity: 0.3 }}>🔒</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9", marginBottom: 6 }}>
          Challenge unavailable
        </div>
        <div style={{ fontSize: 13, color: "#475569", marginBottom: 22 }}>
          It may have been hidden by the organizer.
        </div>
        <button onClick={onClose} className="psp-btn psp-btn-secondary">Close</button>
      </div>
    </div>
  );
}

// ── Challenge body (3-zone layout) ─────────────────────────────────────────────

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
  const [leftTab, setLeftTab] = useState<"description" | "solvers" | "hints">("description");

  const alreadySolved = c.solvedByMe || attempts.some(a => a.correct);
  const inputDisabled = busy || isPaused || lockedOut || alreadySolved;
  const submitDisabled = inputDisabled || !flag.trim();
  const isUnlimited = c.maxAttempts == null;
  const progressPct = isUnlimited || !c.maxAttempts ? 0
    : Math.min(100, (attemptsUsed / c.maxAttempts) * 100);
  const diffColor = DIFF_COLORS[c.difficulty] ?? "#94a3b8";
  const pts = c.currentPoints ?? c.basePoints;
  const hintCount = c.hints?.length ?? 0;

  const TABS = [
    { key: "description" as const, label: "Description" },
    { key: "solvers"     as const, label: `Solvers (${c.solveCount})` },
    { key: "hints"       as const, label: `Hints (${hintCount})` },
  ];

  return (
    <>
      {/* ── ZONE 1: Header & Navigation ──────────────────────────────────────── */}
      <div style={{
        flexShrink: 0,
        background: `linear-gradient(160deg, ${accent}08 0%, #070c1b 60%)`,
        borderBottom: "1px solid #111c30",
        padding: "14px 22px 0",
      }}>
        {/* Row 1: badges + title + close */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Badge row */}
            <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                background: `${accent}1c`, border: `1px solid ${accent}38`,
                color: accent, borderRadius: 5, padding: "2px 10px",
                fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
              }}>
                {conf?.icon} {c.category}
              </span>
              <span style={{
                display: "inline-flex", alignItems: "center",
                background: `${diffColor}14`, border: `1px solid ${diffColor}28`,
                color: diffColor, borderRadius: 5, padding: "2px 10px",
                fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase",
              }}>
                {c.difficulty}
              </span>
              {alreadySolved && (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)",
                  color: "#22c55e", borderRadius: 5, padding: "2px 10px",
                  fontSize: 10, fontWeight: 700,
                }}>
                  <CheckCircle2 size={10} /> SOLVED
                </span>
              )}
            </div>
            {/* Title */}
            <div style={{
              fontSize: 20, fontWeight: 800, color: "#f1f5f9",
              lineHeight: 1.2, letterSpacing: "-0.4px",
            }}>
              {c.title}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              flexShrink: 0, marginLeft: 14,
              background: "rgba(255,255,255,0.04)", border: "1px solid #1a2740",
              borderRadius: 7, color: "#475569", cursor: "pointer",
              padding: "6px 8px", display: "inline-flex", alignItems: "center",
              transition: "all 0.2s ease-in-out",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.09)";
              (e.currentTarget as HTMLElement).style.color = "#e2e8f0";
              (e.currentTarget as HTMLElement).style.borderColor = "#334155";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
              (e.currentTarget as HTMLElement).style.color = "#475569";
              (e.currentTarget as HTMLElement).style.borderColor = "#1a2740";
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Row 2: meta (points, flag format, attempts) */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Trophy size={13} color={accent} />
            <span style={{
              fontSize: 15, fontWeight: 800, color: accent,
              fontFamily: "ui-monospace, monospace",
            }}>
              {pts}
            </span>
            <span style={{ fontSize: 11, color: "#334155" }}>pts</span>
          </div>
          <div style={{ width: 1, height: 12, background: "#1a2740" }} />
          {c.flagFormat && (
            <>
              <span style={{
                fontFamily: "ui-monospace, monospace", fontSize: 11,
                color: "#334155", letterSpacing: "0.02em",
              }}>
                {c.flagFormat}
              </span>
              <div style={{ width: 1, height: 12, background: "#1a2740" }} />
            </>
          )}
          <span style={{ fontSize: 11, color: "#334155" }}>
            {c.maxAttempts != null ? `${c.maxAttempts} max attempts` : "Unlimited attempts"}
          </span>
          <div style={{ width: 1, height: 12, background: "#1a2740" }} />
          <span style={{ fontSize: 11, color: "#334155" }}>
            {c.solveCount} solve{c.solveCount !== 1 ? "s" : ""}
          </span>
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
                  color: active ? accent : "#475569",
                  textShadow: active ? `0 0 10px ${accent}90` : "none",
                  padding: "9px 18px",
                  fontSize: 12.5, fontWeight: active ? 700 : 500,
                  cursor: "pointer", letterSpacing: "0.01em",
                  transition: "all 0.2s ease-in-out",
                  marginBottom: "-1px",
                }}
                onMouseEnter={e => {
                  if (!active) (e.currentTarget as HTMLElement).style.color = "#94a3b8";
                }}
                onMouseLeave={e => {
                  if (!active) (e.currentTarget as HTMLElement).style.color = "#475569";
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── ZONE 2: Content + Sidebar ─────────────────────────────────────────── */}
      <div style={{
        flex: 1, minHeight: 0,
        display: "grid",
        gridTemplateColumns: "1fr 320px",
      }}>
        {/* Left: tab content in subtle container */}
        <div style={{
          overflowY: "auto",
          borderRight: "1px solid #0d1929",
          background: "#07101f",
        }}>
          <div
            key={leftTab}
            style={{
              padding: "18px 22px",
              animation: "ctf-tab-fade 0.2s ease-in-out",
            }}
          >
            {leftTab === "description" && <DescriptionTab c={c} />}
            {leftTab === "solvers"     && <SolversTab competitionId={competitionId} challengeId={c.id} solveCount={c.solveCount} accent={accent} />}
            {leftTab === "hints"       && <HintsTab hints={c.hints ?? []} unlockedHints={unlockedHints} unlockingHint={unlockingHint} onUnlockHint={onUnlockHint} accent={accent} />}
          </div>
        </div>

        {/* Right: deployment & assets sidebar */}
        <div style={{
          background: "#060a18",
          borderLeft: "1px solid #0d1929",
          overflowY: "auto",
          padding: "16px",
          display: "flex", flexDirection: "column", gap: 10,
        }}>
          {/* Instance panel */}
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

          {/* Challenge file download */}
          {c.downloadableFileUrl && (
            <a
              href={c.downloadableFileUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flexShrink: 0,
                display: "flex", alignItems: "center", gap: 12,
                background: "#0b1428", border: "1px solid #1a2740",
                borderRadius: 9, padding: "12px 14px", textDecoration: "none",
                transition: "all 0.2s ease-in-out",
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = `${accent}45`;
                el.style.background = `${accent}0a`;
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = "#1a2740";
                el.style.background = "#0b1428";
              }}
            >
              <div style={{
                width: 38, height: 38, borderRadius: 9,
                background: `${accent}16`, border: `1px solid ${accent}28`,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <Download size={15} color={accent} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12.5, fontWeight: 600, color: "#dde6f0",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  marginBottom: 2,
                }}>
                  {c.downloadableFileName ?? "challenge-file"}
                </div>
                <div style={{ fontSize: 10.5, color: "#334155" }}>Opens in new tab</div>
              </div>
              <div style={{
                fontSize: 10, fontWeight: 700, color: accent,
                background: `${accent}14`, border: `1px solid ${accent}28`,
                borderRadius: 5, padding: "4px 10px", flexShrink: 0,
                transition: "all 0.2s ease-in-out",
              }}>
                Download
              </div>
            </a>
          )}

          {/* Empty state when no instance and no file */}
          {!c.requiresInstance && !c.downloadableFileUrl && (
            <div style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
              flexDirection: "column", gap: 8, color: "#1a2740",
            }}>
              <Trophy size={28} strokeWidth={1} />
              <span style={{ fontSize: 11 }}>No assets for this challenge</span>
            </div>
          )}
        </div>
      </div>

      {/* ── ZONE 3: Full-width submit bar ─────────────────────────────────────── */}
      <div style={{
        flexShrink: 0,
        borderTop: "1px solid #0d1929",
        background: "#04080f",
        padding: "14px 22px",
      }}>
        {alreadySolved ? (
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.2)",
            borderRadius: 9, padding: "12px 18px",
          }}>
            <CheckCircle2 size={18} color="#22c55e" />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#34d399" }}>Challenge Solved</div>
              <div style={{ fontSize: 11, color: "#475569", marginTop: 1 }}>
                Your team has already completed this challenge.
              </div>
            </div>
          </div>
        ) : isEnded ? (
          <div style={{
            padding: "12px 18px", borderRadius: 9,
            background: "#080e1f", border: "1px solid #131f35",
            color: "#475569", fontSize: 12, textAlign: "center",
          }}>
            Competition ended — submissions are closed.
          </div>
        ) : (
          <SubmitBar
            c={c} accent={accent}
            canSolve={canSolve} isPaused={isPaused} lockedOut={lockedOut}
            flag={flag} setFlag={setFlag}
            busy={busy} result={result} resultKey={resultKey}
            inputDisabled={inputDisabled} submitDisabled={submitDisabled}
            inputRef={inputRef} onSubmit={onSubmit}
            attemptsUsed={attemptsUsed} attemptsRemaining={attemptsRemaining}
            isUnlimited={isUnlimited} progressPct={progressPct}
            attempts={attempts} newRowIds={newRowIds}
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
      fontSize: 13.5, color: "#b4c2d4", lineHeight: 1.78,
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
      <div style={{ display: "flex", justifyContent: "center", paddingTop: 40 }}>
        <Loader2 size={18} color="#6366f1" style={{ animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  if (solveCount === 0) {
    return (
      <div style={{ textAlign: "center", paddingTop: 48, color: "#334155" }}>
        <div style={{ fontSize: 36, marginBottom: 10, opacity: 0.4 }}>🏁</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>No solves yet</div>
        <div style={{ fontSize: 12, marginTop: 5 }}>Be the first team to crack this challenge.</div>
      </div>
    );
  }

  if (!solvers.length) {
    return (
      <div style={{ textAlign: "center", paddingTop: 40, color: "#334155", fontSize: 12 }}>
        No solver data available.
      </div>
    );
  }

  return (
    <div>
      {/* Column headers */}
      <div style={{
        display: "grid", gridTemplateColumns: "44px 34px 1fr 110px",
        padding: "5px 10px", marginBottom: 6,
        fontSize: 10, fontWeight: 700, color: "#1e2d45",
        textTransform: "uppercase", letterSpacing: "0.09em",
        borderBottom: "1px solid #0a1428",
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
            display: "grid", gridTemplateColumns: "44px 34px 1fr 110px",
            alignItems: "center",
            padding: "9px 10px",
            borderRadius: 7,
            background: i === 0 ? "rgba(239,68,68,0.04)" : "transparent",
            borderBottom: i < solvers.length - 1 ? "1px solid #070e1d" : "none",
            transition: "background 0.2s ease-in-out",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = i === 0 ? "rgba(239,68,68,0.04)" : "transparent"; }}
        >
          <span style={{
            fontFamily: "ui-monospace, monospace", fontSize: 12, fontWeight: 800,
            color: i === 0 ? "#ef4444" : i === 1 ? "#94a3b8" : i === 2 ? "#fb923c" : "#1e2d45",
          }}>
            #{i + 1}
          </span>
          <div style={{
            width: 26, height: 26, borderRadius: "50%", background: s.avatarColor,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 700, color: "#fff",
          }}>
            {s.teamName.charAt(0).toUpperCase()}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0, paddingLeft: 8 }}>
            <Link
              href={`/ctf/competitions/${competitionId}/teams/${s.teamId}`}
              style={{
                fontWeight: 600, color: "#c8d6e8", fontSize: 13,
                textDecoration: "none",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                transition: "color 0.2s ease-in-out",
              }}
              onMouseEnter={e => { (e.target as HTMLElement).style.color = accent; }}
              onMouseLeave={e => { (e.target as HTMLElement).style.color = "#c8d6e8"; }}
            >
              {s.teamName}
            </Link>
            {i === 0 && (
              <span style={{
                fontSize: 9, fontWeight: 800, color: "#ef4444",
                background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.22)",
                borderRadius: 4, padding: "1px 6px",
                letterSpacing: "0.04em", textTransform: "uppercase", flexShrink: 0,
              }}>
                🩸 First Blood
              </span>
            )}
          </div>
          <div style={{ fontSize: 10.5, color: "#1e2d45", textAlign: "right", whiteSpace: "nowrap" }}>
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
  if (hints.length === 0) {
    return (
      <div style={{ textAlign: "center", paddingTop: 48, color: "#334155" }}>
        <Lightbulb size={34} strokeWidth={1.3} style={{ marginBottom: 12, opacity: 0.4 }} />
        <div style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>No hints available</div>
        <div style={{ fontSize: 12, marginTop: 5 }}>No hints have been added for this challenge yet.</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      {hints.map((h, i) => {
        const revealedText = h.text ?? unlockedHints[h.id];
        const isUnlocking  = unlockingHint === h.id;
        const isLocked     = !revealedText;
        return (
          <div
            key={h.id}
            onClick={() => { if (isLocked && !isUnlocking) onUnlockHint(h.id); }}
            style={{
              background: isLocked ? "#070e1d" : "rgba(251,191,36,0.04)",
              border: `1px solid ${isLocked ? "#131f35" : "rgba(251,191,36,0.22)"}`,
              borderRadius: 9, padding: "13px 15px",
              display: "flex", gap: 13, alignItems: "flex-start",
              cursor: isLocked ? "pointer" : "default",
              opacity: isUnlocking ? 0.6 : 1,
              transition: "all 0.2s ease-in-out",
            }}
            onMouseEnter={e => {
              if (isLocked) {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(251,191,36,0.35)";
                (e.currentTarget as HTMLElement).style.background = "rgba(251,191,36,0.04)";
              }
            }}
            onMouseLeave={e => {
              if (isLocked) {
                (e.currentTarget as HTMLElement).style.borderColor = "#131f35";
                (e.currentTarget as HTMLElement).style.background = "#070e1d";
              }
            }}
          >
            <div style={{
              width: 34, height: 34, borderRadius: 8, flexShrink: 0,
              background: revealedText ? "rgba(251,191,36,0.1)" : "rgba(71,85,105,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Lightbulb
                size={15}
                color={revealedText ? "#fbbf24" : "#475569"}
                style={isUnlocking ? { animation: "ctf-unlock-spin 0.8s linear infinite" } : undefined}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 11, fontWeight: 700, textTransform: "uppercase",
                letterSpacing: "0.06em", marginBottom: 5,
                color: revealedText ? "#fbbf24" : "#64748b",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                Hint {i + 1}
                {isLocked && (
                  <span style={{
                    fontSize: 10, fontWeight: 500, color: "#1e2d45",
                    textTransform: "none", letterSpacing: 0,
                    background: "#0a1428", border: "1px solid #131f35",
                    borderRadius: 4, padding: "1px 8px",
                  }}>
                    −{h.cost} pts
                  </span>
                )}
              </div>
              <div style={{
                fontSize: 13, lineHeight: 1.65,
                color: revealedText ? "#dde6f0" : "#475569",
                fontStyle: revealedText ? "normal" : "italic",
              }}>
                {isUnlocking ? "Unlocking…" : revealedText ?? "Click to spend points and reveal this hint"}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Full-width submit bar ───────────────────────────────────────────────────────

function SubmitBar({
  c, accent, canSolve, isPaused, lockedOut,
  flag, setFlag, busy, result, resultKey,
  inputDisabled, submitDisabled,
  inputRef, onSubmit,
  attemptsUsed, attemptsRemaining, isUnlimited, progressPct,
  attempts, newRowIds,
}: {
  c: CTFCompetitionChallengeDTO; accent: string;
  canSolve: boolean; isPaused: boolean; lockedOut: boolean;
  flag: string; setFlag: (v: string) => void;
  busy: boolean;
  result: { correct: boolean; message: string } | null;
  resultKey: number;
  inputDisabled: boolean; submitDisabled: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onSubmit: () => void;
  attemptsUsed: number; attemptsRemaining: number | null;
  isUnlimited: boolean; progressPct: number;
  attempts: CTFAttemptDTO[]; newRowIds: Set<string>;
}) {
  const dangerColor = progressPct >= 100 ? "#ef4444" : progressPct >= 75 ? "#f97316" : accent;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Status banners */}
      {(isPaused || lockedOut) && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          background: isPaused ? "rgba(245,158,11,0.07)" : "rgba(239,68,68,0.07)",
          border: `1px solid ${isPaused ? "rgba(245,158,11,0.22)" : "rgba(239,68,68,0.22)"}`,
          color: isPaused ? "#f59e0b" : "#f87171",
          borderRadius: 8, padding: "8px 14px",
          fontSize: 12, fontWeight: 600,
        }}>
          {isPaused ? <Pause size={13} /> : <AlertCircle size={13} />}
          {isPaused ? "Competition is currently paused" : "No attempts remaining — you are locked out"}
        </div>
      )}

      {/* Main input + button row */}
      <div style={{ display: "flex", gap: 10, alignItems: "stretch" }}>
        {/* Flag input */}
        <div style={{ flex: 1, position: "relative" }}>
          <div style={{
            position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
            pointerEvents: "none", zIndex: 1,
          }}>
            <Flag size={14} color={inputDisabled ? "#1e2d45" : "#334155"} />
          </div>
          <input
            ref={inputRef}
            className="input"
            value={flag}
            onChange={e => setFlag(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && canSolve && !inputDisabled) onSubmit(); }}
            placeholder={lockedOut ? "No attempts remaining" : isPaused ? "Submissions paused" : "FLAG{…}"}
            disabled={inputDisabled}
            style={{
              width: "100%",
              fontFamily: "ui-monospace, monospace",
              fontSize: 14, height: "44px",
              paddingLeft: "38px",
              background: "#04080f",
              borderColor: result
                ? result.correct ? "rgba(34,197,94,0.55)" : "rgba(239,68,68,0.45)"
                : "#131f35",
              boxShadow: result
                ? result.correct
                  ? "0 0 0 3px rgba(34,197,94,0.12)"
                  : "0 0 0 3px rgba(239,68,68,0.1)"
                : undefined,
              transition: "border-color 0.2s ease, box-shadow 0.2s ease",
              color: inputDisabled ? "#1e2d45" : "#e2e8f0",
            }}
          />
        </div>

        {/* Submit button — high-contrast, solid accent */}
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitDisabled}
          style={{
            flexShrink: 0,
            width: 168, height: 44,
            background: submitDisabled ? "#0b1428" : accent,
            border: submitDisabled ? "1px solid #131f35" : "none",
            borderRadius: 8,
            color: submitDisabled ? "#1e2d45" : "#fff",
            fontSize: 14, fontWeight: 800,
            cursor: submitDisabled ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            boxShadow: !submitDisabled ? `0 4px 22px ${accent}55, 0 0 0 1px ${accent}30` : "none",
            transition: "all 0.2s ease-in-out",
            letterSpacing: "0.03em",
          }}
          onMouseEnter={e => {
            if (!submitDisabled) {
              (e.currentTarget as HTMLElement).style.opacity = "0.88";
              (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
              (e.currentTarget as HTMLElement).style.boxShadow = `0 6px 28px ${accent}65, 0 0 0 1px ${accent}40`;
            }
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.opacity = "1";
            (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
            (e.currentTarget as HTMLElement).style.boxShadow = !submitDisabled
              ? `0 4px 22px ${accent}55, 0 0 0 1px ${accent}30` : "none";
          }}
        >
          {busy
            ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
            : isPaused ? <><Pause size={14} /> Paused</>
            : lockedOut ? "Locked Out"
            : "Submit Flag"}
        </button>
      </div>

      {/* Attempt counter + progress */}
      {!(attemptsUsed === 0 && isUnlimited) && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
            <span style={{ fontSize: 11, color: "#1e2d45" }}>
              {isUnlimited
                ? `${attemptsUsed} attempt${attemptsUsed !== 1 ? "s" : ""}`
                : `${attemptsUsed} of ${c.maxAttempts} attempts used`}
            </span>
            {isUnlimited ? (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 3,
                fontSize: 10, fontWeight: 700, color: accent,
                background: `${accent}12`, border: `1px solid ${accent}22`,
                borderRadius: 4, padding: "1px 7px",
              }}>
                <Infinity size={9} /> Unlimited
              </span>
            ) : (
              <span style={{
                fontSize: 11, fontWeight: 700,
                color: attemptsRemaining === 0 ? "#ef4444" : "#1e2d45",
              }}>
                {attemptsRemaining} remaining
              </span>
            )}
          </div>
          {!isUnlimited && (
            <div style={{ height: 3, background: "#0a1428", borderRadius: 2, overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${progressPct}%`,
                background: dangerColor, borderRadius: 2,
                transition: "width 0.4s ease, background 0.3s ease",
              }} />
            </div>
          )}
        </div>
      )}

      {/* Inline result feedback */}
      {result && (
        <div
          key={resultKey}
          style={{
            padding: "10px 14px", borderRadius: 8,
            fontSize: 13, fontWeight: 600,
            background: result.correct ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.07)",
            border: `1px solid ${result.correct ? "rgba(34,197,94,0.28)" : "rgba(239,68,68,0.22)"}`,
            color: result.correct ? "#22c55e" : "#f87171",
            display: "flex", alignItems: "center", gap: 9,
            animation: "ctf-result-in 0.22s cubic-bezier(0.16,1,0.3,1)",
          }}
        >
          {result.correct ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          {result.message}
        </div>
      )}

      {/* Attempt history (compact, collapsible row) */}
      {attempts.length > 0 && (
        <AttemptHistory attempts={attempts} newRowIds={newRowIds} />
      )}
    </div>
  );
}

// ── Attempt history ─────────────────────────────────────────────────────────────

function AttemptHistory({ attempts, newRowIds }: { attempts: CTFAttemptDTO[]; newRowIds: Set<string> }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{
      background: "#04080f", border: "1px solid #0d1929",
      borderRadius: 8, overflow: "hidden",
    }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", background: "transparent", border: "none", cursor: "pointer",
          padding: "7px 12px", display: "flex", justifyContent: "space-between", alignItems: "center",
          transition: "background 0.2s ease-in-out",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
      >
        <span style={{ fontSize: 10, fontWeight: 700, color: "#1e2d45", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          Attempt log
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            fontSize: 10, color: "#1e2d45", background: "#0a1428",
            border: "1px solid #131f35", borderRadius: 4, padding: "1px 7px",
          }}>
            {attempts.length}
          </span>
          <span style={{ fontSize: 10, color: "#1e2d45", transition: "transform 0.2s ease", display: "inline-block", transform: open ? "rotate(180deg)" : "none" }}>
            ▾
          </span>
        </div>
      </button>
      {open && (
        <div style={{ borderTop: "1px solid #0a1428", maxHeight: 150, overflowY: "auto" }}>
          {attempts.map((a, i) => (
            <div
              key={a.id}
              style={{
                display: "flex", alignItems: "center", gap: 9,
                padding: "6px 12px",
                borderBottom: i < attempts.length - 1 ? "1px solid #04080f" : "none",
                background: a.correct ? "rgba(34,197,94,0.03)" : "transparent",
                animation: newRowIds.has(a.id) ? "ctf-row-in 0.28s ease" : undefined,
              }}
            >
              <div style={{
                width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
                background: a.correct ? "rgba(34,197,94,0.14)" : "rgba(239,68,68,0.1)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ fontSize: 8, color: a.correct ? "#22c55e" : "#ef4444" }}>
                  {a.correct ? "✓" : "✗"}
                </span>
              </div>
              <span style={{
                flex: 1, fontFamily: "ui-monospace, monospace", fontSize: 11,
                color: "#1e2d45", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {a.flagMasked}
              </span>
              <span style={{ fontSize: 10, color: "#0d1929", flexShrink: 0 }}>
                {relativeTime(a.submittedAt)}
              </span>
            </div>
          ))}
        </div>
      )}
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
