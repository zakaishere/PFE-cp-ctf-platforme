"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  X, CheckCircle2, AlertCircle, Loader2, Download, Lightbulb,
  Pause, Infinity, Trophy, ImageOff,
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
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") doClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doClose = () => { setClosing(true); setTimeout(onClose, 200); };

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
      <div
        onClick={doClose}
        style={{
          position: "fixed", inset: 0, zIndex: 110,
          background: closing ? "rgba(0,0,0,0)" : "rgba(2,6,18,0.85)",
          backdropFilter: closing ? "blur(0px)" : "blur(10px)",
          WebkitBackdropFilter: closing ? "blur(0px)" : "blur(10px)",
          transition: "background 200ms ease, backdrop-filter 200ms ease",
          display: "flex", justifyContent: "center", alignItems: "center",
          padding: "16px",
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          onClick={e => e.stopPropagation()}
          style={{
            width: "min(97vw, 1020px)",
            height: "min(90vh, 720px)",
            background: "#070c1a",
            border: `1px solid ${accent}22`,
            borderRadius: 14,
            display: "flex", flexDirection: "column",
            overflow: "hidden",
            boxShadow: `0 0 0 1px rgba(255,255,255,0.035),
                        0 32px 96px rgba(0,0,0,0.8),
                        0 0 80px ${accent}0c`,
            animation: closing
              ? "ctfm-out 200ms cubic-bezier(0.4,0,1,1) forwards"
              : "ctfm-in 300ms cubic-bezier(0.16,1,0.3,1)",
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
                shaking={shaking} glowing={glowing}
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
          from { opacity: 0; transform: scale(0.94) translateY(12px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
        @keyframes ctfm-out {
          from { opacity: 1; transform: scale(1)    translateY(0); }
          to   { opacity: 0; transform: scale(0.94) translateY(12px); }
        }
        @keyframes ctf-shake {
          0%,100% { transform: translateX(0); }
          15%     { transform: translateX(-7px); }
          30%     { transform: translateX(7px); }
          50%     { transform: translateX(-4px); }
          70%     { transform: translateX(4px); }
          90%     { transform: translateX(-2px); }
        }
        @keyframes ctf-result-in {
          from { opacity: 0; transform: translateY(6px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
        @keyframes ctf-glow-pulse {
          0%   { box-shadow: 0 0 0 0      rgba(34,197,94,0.6); }
          50%  { box-shadow: 0 0 32px 8px rgba(34,197,94,0.2); }
          100% { box-shadow: 0 0 0 0      rgba(34,197,94,0); }
        }
        @keyframes ctf-row-in {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ctf-unlock-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes ctf-tab-fade {
          from { opacity: 0; transform: translateY(6px); }
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
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "18px 22px", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #1e293b", paddingBottom: 14, gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div className="skel" style={{ height: 14, width: 130, borderRadius: 5, marginBottom: 10 }} />
          <div className="skel" style={{ height: 22, width: "60%", borderRadius: 6, marginBottom: 8 }} />
          <div className="skel" style={{ height: 12, width: 200, borderRadius: 4 }} />
        </div>
        <div className="skel" style={{ width: 28, height: 28, borderRadius: 6, flexShrink: 0 }} />
      </div>
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "60% 40%", gap: 0 }}>
        <div style={{ padding: "8px 20px 8px 0", borderRight: "1px solid #0f172a" }}>
          {[88, 76, 65, 52, 70].map((w, i) => (
            <div key={i} className="skel" style={{ height: 12, width: `${w}%`, borderRadius: 4, marginBottom: 9 }} />
          ))}
        </div>
        <div style={{ padding: "8px 0 8px 20px" }}>
          <div className="skel" style={{ height: 80, borderRadius: 8, marginBottom: 10 }} />
          <div className="skel" style={{ height: 44, borderRadius: 8 }} />
        </div>
      </div>
    </div>
  );
}

// ── Unavailable state ───────────────────────────────────────────────────────────

function UnavailableState({ onClose }: { onClose: () => void }) {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 44, marginBottom: 14, opacity: 0.35 }}>🔒</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc", marginBottom: 6 }}>Challenge unavailable</div>
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 22 }}>It may have been hidden by the organizer.</div>
        <button onClick={onClose} className="psp-btn psp-btn-secondary">Close</button>
      </div>
    </div>
  );
}

// ── Challenge body (60/40 layout) ───────────────────────────────────────────────

function ChallengeBody({
  c, accent, conf, competitionId, teamId, canSolve, isPaused, isEnded,
  flag, setFlag, busy, result, resultKey, shaking, glowing,
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
  shaking: boolean; glowing: boolean;
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

  const LEFT_TABS = [
    { key: "description", label: "Description" },
    { key: "solvers",     label: `Solvers (${c.solveCount})` },
    { key: "hints",       label: `Hints (${hintCount})` },
  ] as const;

  return (
    <>
      {/* ── Header (full width) ──────────────────────────────────────────────── */}
      <div style={{
        padding: "12px 22px 0",
        flexShrink: 0,
        background: `linear-gradient(180deg, ${accent}09 0%, transparent 100%)`,
        borderBottom: "1px solid #111827",
      }}>
        {/* Row 1: badges + close */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              background: `${accent}1a`, border: `1px solid ${accent}35`,
              color: accent, borderRadius: 5, padding: "2px 10px",
              fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase",
            }}>
              {conf?.icon} {c.category}
            </span>
            <span style={{
              display: "inline-flex", alignItems: "center",
              background: `${diffColor}16`, border: `1px solid ${diffColor}2a`,
              color: diffColor, borderRadius: 5, padding: "2px 10px",
              fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase",
            }}>
              {c.difficulty}
            </span>
            {alreadySolved && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.28)",
                color: "#22c55e", borderRadius: 5, padding: "2px 10px",
                fontSize: 10, fontWeight: 700,
              }}>
                <CheckCircle2 size={10} /> SOLVED
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "rgba(255,255,255,0.04)", border: "1px solid #1e293b",
              borderRadius: 7, color: "#475569", cursor: "pointer",
              padding: "5px 7px", display: "inline-flex", alignItems: "center",
              transition: "all 0.15s ease", flexShrink: 0,
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.09)";
              (e.currentTarget as HTMLElement).style.color = "#e2e8f0";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
              (e.currentTarget as HTMLElement).style.color = "#475569";
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Row 2: title */}
        <div style={{
          fontSize: 20, fontWeight: 800, color: "#f1f5f9",
          lineHeight: 1.2, letterSpacing: "-0.4px", marginBottom: 8,
        }}>
          {c.title}
        </div>

        {/* Row 3: meta inline */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Trophy size={12} color={accent} />
            <span style={{
              fontSize: 15, fontWeight: 800, color: accent,
              fontFamily: "ui-monospace, monospace",
            }}>
              {pts}
            </span>
            <span style={{ fontSize: 11, color: "#475569" }}>pts</span>
          </div>
          <div style={{ width: 1, height: 12, background: "#1e293b" }} />
          {c.flagFormat && (
            <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "#334155" }}>
              {c.flagFormat}
            </span>
          )}
          {c.flagFormat && <div style={{ width: 1, height: 12, background: "#1e293b" }} />}
          <span style={{ fontSize: 11, color: "#334155" }}>
            max {c.maxAttempts ?? "∞"} attempts
          </span>
        </div>

        {/* Left-column tab bar — sits at the bottom of the header strip */}
        <div style={{ display: "flex", gap: 0, marginTop: 2 }}>
          {LEFT_TABS.map(tab => {
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
                  padding: "8px 16px",
                  fontSize: 12, fontWeight: active ? 700 : 500,
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

      {/* ── Body: 60 / 40 split ──────────────────────────────────────────────── */}
      <div style={{
        flex: 1, overflow: "hidden",
        display: "grid",
        gridTemplateColumns: "60% 40%",
      }}>

        {/* LEFT — tab content */}
        <div style={{
          overflowY: "auto",
          borderRight: "1px solid #0e1625",
        }}>
          <div
            key={leftTab}
            style={{ padding: "20px 22px", animation: "ctf-tab-fade 0.2s ease-in-out" }}
          >
            {leftTab === "description" && (
              <DescriptionTab c={c} />
            )}
            {leftTab === "solvers" && (
              <SolversTab
                competitionId={competitionId}
                challengeId={c.id}
                solveCount={c.solveCount}
                accent={accent}
              />
            )}
            {leftTab === "hints" && (
              <HintsTab
                hints={c.hints ?? []}
                unlockedHints={unlockedHints}
                unlockingHint={unlockingHint}
                onUnlockHint={onUnlockHint}
                accent={accent}
              />
            )}
          </div>
        </div>

        {/* RIGHT — unified action sidebar */}
        <div style={{
          display: "flex", flexDirection: "column",
          overflow: "hidden",
          background: "#06090f",
          borderLeft: "1px solid #0e1625",
        }}>

          {/* Instance panel */}
          {c.requiresInstance && (
            <div style={{ padding: "14px 16px 0", flexShrink: 0 }}>
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

          {/* Download banner */}
          {c.downloadableFileUrl && (
            <div style={{ padding: c.requiresInstance ? "0 16px" : "14px 16px 0", flexShrink: 0 }}>
              <a
                href={c.downloadableFileUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex", alignItems: "center", gap: 11,
                  background: "#0c1324", border: "1px solid #1a2740",
                  borderRadius: 9, padding: "10px 14px", textDecoration: "none",
                  transition: "all 0.2s ease-in-out",
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = `${accent}40`;
                  el.style.background = `${accent}09`;
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = "#1a2740";
                  el.style.background = "#0c1324";
                }}
              >
                <div style={{
                  width: 34, height: 34, borderRadius: 8,
                  background: `${accent}18`, border: `1px solid ${accent}28`,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <Download size={14} color={accent} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12, fontWeight: 600, color: "#e2e8f0",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {c.downloadableFileName ?? "challenge-file"}
                  </div>
                  <div style={{ fontSize: 10, color: "#334155", marginTop: 2 }}>Opens in new tab</div>
                </div>
                <div style={{
                  fontSize: 10, fontWeight: 700, color: accent,
                  background: `${accent}14`, border: `1px solid ${accent}25`,
                  borderRadius: 5, padding: "3px 9px", flexShrink: 0,
                }}>
                  Download
                </div>
              </a>
            </div>
          )}

          {/* Submit flag widget — fills remaining space */}
          <div style={{
            flex: 1, minHeight: 0, display: "flex", flexDirection: "column",
            padding: "14px 16px 16px",
          }}>
            <SubmitWidget
              c={c}
              accent={accent}
              canSolve={canSolve} isPaused={isPaused} isEnded={isEnded}
              alreadySolved={alreadySolved}
              flag={flag} setFlag={setFlag}
              busy={busy} result={result} resultKey={resultKey}
              shaking={shaking} glowing={glowing}
              inputDisabled={inputDisabled} submitDisabled={submitDisabled}
              inputRef={inputRef} onSubmit={onSubmit}
              attemptsUsed={attemptsUsed} attemptsRemaining={attemptsRemaining}
              isUnlimited={isUnlimited} progressPct={progressPct}
              lockedOut={lockedOut}
              attempts={attempts} newRowIds={newRowIds}
            />
          </div>
        </div>
      </div>
    </>
  );
}

// ── Description tab ─────────────────────────────────────────────────────────────

function DescriptionTab({ c }: { c: CTFCompetitionChallengeDTO }) {
  const [mediaError, setMediaError] = useState(false);

  return (
    <>
      <div style={{
        fontSize: 13.5, color: "#b8c5d6", lineHeight: 1.75,
        whiteSpace: "pre-wrap", wordBreak: "break-word",
      }}>
        {c.description}
      </div>

      {c.mediaUrl && (
        <div style={{ marginTop: 22, display: "flex", justifyContent: "center" }}>
          {mediaError ? (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
              padding: "28px 20px", borderRadius: 10,
              border: "1px dashed #1e293b", color: "#334155",
            }}>
              <ImageOff size={22} />
              <span style={{ fontSize: 11 }}>Media unavailable</span>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={c.mediaUrl}
              alt="challenge media"
              onError={() => setMediaError(true)}
              style={{
                maxWidth: "100%", maxHeight: 350,
                objectFit: "contain", borderRadius: 10,
                border: "1px solid #1e293b",
                display: "block",
              }}
            />
          )}
        </div>
      )}
    </>
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
      <div style={{ display: "flex", justifyContent: "center", paddingTop: 32 }}>
        <Loader2 size={18} color="#6366f1" style={{ animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  if (solveCount === 0) {
    return (
      <div style={{ textAlign: "center", paddingTop: 40, color: "#475569" }}>
        <div style={{ fontSize: 32, marginBottom: 10, opacity: 0.3 }}>🏁</div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>No solves yet</div>
        <div style={{ fontSize: 12, marginTop: 4, color: "#334155" }}>Be the first to crack this challenge.</div>
      </div>
    );
  }

  if (solvers.length === 0) {
    return (
      <div style={{ textAlign: "center", paddingTop: 32, color: "#475569", fontSize: 12 }}>
        No solver data available.
      </div>
    );
  }

  return (
    <div>
      {/* Table header */}
      <div style={{
        display: "grid", gridTemplateColumns: "40px 32px 1fr 100px",
        padding: "6px 10px", marginBottom: 4,
        fontSize: 10, fontWeight: 700, color: "#334155",
        textTransform: "uppercase", letterSpacing: "0.08em",
        borderBottom: "1px solid #0f172a",
      }}>
        <span>Rank</span>
        <span />
        <span>Team</span>
        <span style={{ textAlign: "right" }}>Time</span>
      </div>

      {solvers.map((s, i) => (
        <div
          key={s.teamId}
          style={{
            display: "grid", gridTemplateColumns: "40px 32px 1fr 100px",
            alignItems: "center", gap: 0,
            padding: "9px 10px",
            borderRadius: 7,
            background: i === 0 ? "rgba(239,68,68,0.05)" : "transparent",
            borderBottom: i < solvers.length - 1 ? "1px solid #080d1c" : "none",
            transition: "background 0.15s ease",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = i === 0 ? "rgba(239,68,68,0.05)" : "transparent"; }}
        >
          {/* Rank */}
          <span style={{
            fontFamily: "ui-monospace, monospace", fontSize: 12, fontWeight: 800,
            color: i === 0 ? "#ef4444" : i === 1 ? "#94a3b8" : i === 2 ? "#fb923c" : "#1e293b",
          }}>
            #{i + 1}
          </span>

          {/* Avatar */}
          <div style={{
            width: 24, height: 24, borderRadius: "50%",
            background: s.avatarColor,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 700, color: "#fff",
          }}>
            {s.teamName.charAt(0).toUpperCase()}
          </div>

          {/* Name + badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0, paddingLeft: 6 }}>
            <Link
              href={`/ctf/competitions/${competitionId}/teams/${s.teamId}`}
              style={{
                fontWeight: 600, color: "#cbd5e1", fontSize: 12.5,
                textDecoration: "none",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                transition: "color 0.15s",
              }}
              onMouseEnter={e => { (e.target as HTMLElement).style.color = accent; }}
              onMouseLeave={e => { (e.target as HTMLElement).style.color = "#cbd5e1"; }}
            >
              {s.teamName}
            </Link>
            {i === 0 && (
              <span style={{
                fontSize: 9, fontWeight: 800, color: "#ef4444",
                background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: 4, padding: "1px 5px",
                letterSpacing: "0.04em", textTransform: "uppercase", flexShrink: 0,
              }}>
                🩸 First Blood
              </span>
            )}
          </div>

          {/* Time */}
          <div style={{ fontSize: 10, color: "#334155", textAlign: "right", whiteSpace: "nowrap" }}>
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
      <div style={{ textAlign: "center", paddingTop: 40, color: "#475569" }}>
        <div style={{ fontSize: 30, marginBottom: 10, opacity: 0.3 }}>
          <Lightbulb size={36} strokeWidth={1.5} />
        </div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>No hints available</div>
        <div style={{ fontSize: 12, marginTop: 4, color: "#334155" }}>
          No hints have been added for this challenge yet.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
              border: `1px solid ${isLocked ? "#1e293b" : "rgba(251,191,36,0.22)"}`,
              borderRadius: 9, padding: "12px 14px",
              display: "flex", gap: 12, alignItems: "flex-start",
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
                (e.currentTarget as HTMLElement).style.borderColor = "#1e293b";
                (e.currentTarget as HTMLElement).style.background = "#080d1c";
              }
            }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: revealedText ? "rgba(251,191,36,0.12)" : "rgba(71,85,105,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <Lightbulb
                size={14}
                color={revealedText ? "#fbbf24" : "#475569"}
                style={isUnlocking ? { animation: "ctf-unlock-spin 0.8s linear infinite" } : undefined}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 11, color: revealedText ? "#fbbf24" : "#64748b",
                fontWeight: 700, textTransform: "uppercase",
                letterSpacing: "0.06em", marginBottom: 5,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                Hint {i + 1}
                {isLocked && (
                  <span style={{
                    fontSize: 10, color: "#334155", fontWeight: 500,
                    textTransform: "none", letterSpacing: 0,
                    background: "#0c1428", border: "1px solid #1e293b",
                    borderRadius: 4, padding: "1px 7px",
                  }}>
                    −{h.cost} pts
                  </span>
                )}
              </div>
              <div style={{
                fontSize: 13, lineHeight: 1.6,
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

// ── Submit widget (right sidebar bottom) ────────────────────────────────────────

function SubmitWidget({
  c, accent, canSolve, isPaused, isEnded, alreadySolved,
  flag, setFlag, busy, result, resultKey, shaking, glowing,
  inputDisabled, submitDisabled,
  inputRef, onSubmit,
  attemptsUsed, attemptsRemaining, isUnlimited, progressPct,
  lockedOut, attempts, newRowIds,
}: {
  c: CTFCompetitionChallengeDTO; accent: string;
  canSolve: boolean; isPaused: boolean; isEnded: boolean; alreadySolved: boolean;
  flag: string; setFlag: (v: string) => void;
  busy: boolean;
  result: { correct: boolean; message: string } | null;
  resultKey: number;
  shaking: boolean; glowing: boolean;
  inputDisabled: boolean; submitDisabled: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onSubmit: () => void;
  attemptsUsed: number; attemptsRemaining: number | null;
  isUnlimited: boolean; progressPct: number;
  lockedOut: boolean; attempts: CTFAttemptDTO[]; newRowIds: Set<string>;
}) {
  if (alreadySolved) {
    return (
      <div style={{
        flex: 1,
        background: "linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(34,197,94,0.03) 100%)",
        border: "1px solid rgba(34,197,94,0.22)",
        borderRadius: 10, padding: "20px 18px",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 10, textAlign: "center",
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: "rgba(34,197,94,0.12)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <CheckCircle2 size={22} color="#22c55e" />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#34d399", marginBottom: 4 }}>
            Challenge Solved!
          </div>
          <div style={{ fontSize: 12, color: "#64748b" }}>
            Your team has completed this challenge.
          </div>
        </div>
      </div>
    );
  }

  if (isEnded) {
    return (
      <div style={{
        flex: 1,
        background: "#080d1c", border: "1px solid #1e293b",
        borderRadius: 10, padding: 20,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#475569", fontSize: 12, textAlign: "center",
      }}>
        Submissions closed — competition ended.
      </div>
    );
  }

  const dangerColor = progressPct >= 100 ? "#ef4444" : progressPct >= 75 ? "#f97316" : accent;

  return (
    <div
      style={{
        flex: 1, minHeight: 0, overflowY: "auto",
        background: "#080e1f",
        border: `1px solid ${glowing ? "rgba(34,197,94,0.5)" : "#131f35"}`,
        borderRadius: 10, padding: "16px",
        display: "flex", flexDirection: "column", gap: 0,
        transition: "border-color 0.3s ease",
        animation: shaking ? "ctf-shake 0.5s ease" : glowing ? "ctf-glow-pulse 1.2s ease" : undefined,
      }}
    >
      {/* Section label */}
      <div style={{
        fontSize: 10, fontWeight: 800, color: "#1e2d45",
        textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 12,
      }}>
        Submit Flag
      </div>

      {/* Status banners */}
      {isPaused && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.2)",
          color: "#f59e0b", borderRadius: 8, padding: "8px 12px",
          fontSize: 12, fontWeight: 600, marginBottom: 12,
        }}>
          <Pause size={13} /> Competition is paused
        </div>
      )}
      {lockedOut && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.18)",
          color: "#f87171", borderRadius: 8, padding: "8px 12px",
          fontSize: 12, fontWeight: 600, marginBottom: 12,
        }}>
          <AlertCircle size={13} /> No attempts remaining
        </div>
      )}

      {/* Flag input */}
      <input
        ref={inputRef}
        className="input"
        value={flag}
        onChange={e => setFlag(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" && canSolve && !inputDisabled) onSubmit(); }}
        placeholder={
          lockedOut ? "No attempts remaining" :
          isPaused  ? "Submissions paused" :
          "FLAG{…}"
        }
        disabled={inputDisabled}
        style={{
          fontFamily: "ui-monospace, monospace", fontSize: 13,
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
          marginBottom: 10,
        }}
      />

      {/* Submit button */}
      <button
        type="button"
        onClick={onSubmit}
        disabled={submitDisabled}
        style={{
          width: "100%", padding: "12px 0",
          background: submitDisabled
            ? "#0c1428"
            : `linear-gradient(135deg, ${accent} 0%, #7c3aed 100%)`,
          border: submitDisabled ? "1px solid #131f35" : "none",
          borderRadius: 8,
          color: submitDisabled ? "#1e2d45" : "#fff",
          fontSize: 14, fontWeight: 800,
          cursor: submitDisabled ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          boxShadow: !submitDisabled
            ? `0 4px 20px ${accent}40`
            : "none",
          transition: "all 0.2s ease-in-out",
          letterSpacing: "0.02em",
          marginBottom: 12,
        }}
        onMouseEnter={e => {
          if (!submitDisabled) {
            (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
            (e.currentTarget as HTMLElement).style.boxShadow = `0 6px 28px ${accent}55`;
          }
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
          (e.currentTarget as HTMLElement).style.boxShadow = !submitDisabled
            ? `0 4px 20px ${accent}40` : "none";
        }}
      >
        {isPaused
          ? <><Pause size={14} /> Paused</>
          : busy
          ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Checking…</>
          : lockedOut
          ? "Locked Out"
          : "Submit Flag"}
      </button>

      {/* Attempt counter */}
      {!(attemptsUsed === 0 && isUnlimited) && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: "#2d3f58" }}>
              {isUnlimited
                ? `${attemptsUsed} attempt${attemptsUsed !== 1 ? "s" : ""}`
                : `${attemptsUsed} / ${c.maxAttempts} attempts`}
            </span>
            {isUnlimited ? (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 3,
                fontSize: 10, fontWeight: 700, color: accent,
                background: `${accent}12`, border: `1px solid ${accent}20`,
                borderRadius: 4, padding: "1px 6px",
              }}>
                <Infinity size={9} /> Unlimited
              </span>
            ) : (
              <span style={{
                fontSize: 11, fontWeight: 700,
                color: attemptsRemaining === 0 ? "#ef4444" : "#2d3f58",
              }}>
                {attemptsRemaining} left
              </span>
            )}
          </div>
          {!isUnlimited && (
            <div style={{ height: 3, background: "#0c1428", borderRadius: 2, overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${progressPct}%`,
                background: dangerColor, borderRadius: 2,
                transition: "width 0.4s ease, background 0.3s ease",
              }} />
            </div>
          )}
        </div>
      )}

      {/* Inline result */}
      {result && (
        <div
          key={resultKey}
          style={{
            padding: "10px 13px", borderRadius: 8, marginBottom: 10,
            fontSize: 12.5, fontWeight: 600,
            background: result.correct
              ? "rgba(34,197,94,0.08)"
              : "rgba(239,68,68,0.07)",
            border: `1px solid ${result.correct
              ? "rgba(34,197,94,0.3)"
              : "rgba(239,68,68,0.22)"}`,
            color: result.correct ? "#22c55e" : "#f87171",
            display: "flex", alignItems: "center", gap: 8,
            animation: "ctf-result-in 0.22s cubic-bezier(0.16,1,0.3,1)",
          }}
        >
          {result.correct ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          {result.message}
        </div>
      )}

      {/* Attempt history */}
      {attempts.length > 0 && (
        <div style={{
          background: "#04080f", border: "1px solid #111e30",
          borderRadius: 8, overflow: "hidden", marginTop: "auto",
        }}>
          <div style={{
            padding: "8px 12px", borderBottom: "1px solid #0a1224",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{
              fontSize: 10, fontWeight: 700, color: "#1e2d45",
              textTransform: "uppercase", letterSpacing: "0.1em",
            }}>
              Attempt log
            </span>
            <span style={{
              fontSize: 10, color: "#1e2d45", background: "#0a1224",
              border: "1px solid #111e30", borderRadius: 4, padding: "1px 7px",
            }}>
              {attempts.length}
            </span>
          </div>
          <div style={{ maxHeight: 140, overflowY: "auto" }}>
            {attempts.map((a, i) => (
              <div
                key={a.id}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "6px 12px",
                  borderBottom: i < attempts.length - 1 ? "1px solid #04080f" : "none",
                  background: a.correct ? "rgba(34,197,94,0.03)" : "transparent",
                  animation: newRowIds.has(a.id)
                    ? "ctf-row-in 0.28s cubic-bezier(0.16,1,0.3,1)" : undefined,
                }}
              >
                <div style={{
                  width: 15, height: 15, borderRadius: "50%", flexShrink: 0,
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
                <span style={{ color: "#111e30", fontSize: 10, flexShrink: 0 }}>
                  {relativeTime(a.submittedAt)}
                </span>
              </div>
            ))}
          </div>
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
