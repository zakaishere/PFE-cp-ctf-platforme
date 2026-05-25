"use client";

import { useEffect, useRef, useState } from "react";
import {
  X, CheckCircle2, AlertCircle, Loader2, Download, Lightbulb, Pause,
} from "lucide-react";
import { toast } from "@/components/ui/PSPToast";
import InstancePanel from "@/components/ctf/InstancePanel";
import {
  getCtfCompetitionChallenges, submitCtfCompetitionFlag, unlockCTFHint,
  type CTFCompetitionChallengeDTO,
} from "@/lib/api";
import { CAT_CONFIG, DIFF_COLORS } from "./categoryConfig";

interface Attempt { time: Date; result: "correct" | "wrong"; flag: string; }

interface Props {
  competitionId: string;
  challengeId:   string;
  teamId?:       string;
  canSolve:      boolean;       // false when status≠ACTIVE or paused
  isPaused:      boolean;
  isEnded:       boolean;
  onClose:       () => void;
  onSolved?:     (challengeId: string, points: number) => void;
}

/**
 * Full-page challenge modal. Slides up from the bottom. Does NOT change the URL —
 * keeping it in component state preserves the browser back button.
 */
export default function ChallengeModal({
  competitionId, challengeId, teamId, canSolve, isPaused, isEnded, onClose, onSolved,
}: Props) {
  const [challenge, setChallenge] = useState<CTFCompetitionChallengeDTO | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [closing,   setClosing]   = useState(false);

  // Hint-unlock state: hintId → revealed text
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

  // Flag-submit state
  const [flag,       setFlag]      = useState("");
  const [busy,       setBusy]      = useState(false);
  const [result,     setResult]    = useState<{ correct: boolean; message: string } | null>(null);
  const [attempts,   setAttempts]  = useState<Attempt[]>([]);
  const [shaking,    setShaking]   = useState(false);
  const [glowing,    setGlowing]   = useState(false);
  const [resultKey,  setResultKey] = useState(0);   // bump to retrigger result animation
  const inputRef = useRef<HTMLInputElement>(null);
  const wrongTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch the latest version of the challenge whenever the modal opens — solve
  // count, hints, etc. may have changed since the page-level list was fetched.
  useEffect(() => {
    setLoading(true);
    getCtfCompetitionChallenges(competitionId).then(w => {
      const c = w.challenges.find(x => x.id === challengeId);
      setChallenge(c ?? null);
    }).catch(() => { /* toasted */ })
      .finally(() => setLoading(false));
  }, [competitionId, challengeId]);

  // Escape to close.
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
    if (!challenge || !canSolve || busy || !flag.trim()) return;
    setBusy(true);
    setResult(null);
    if (wrongTimerRef.current) clearTimeout(wrongTimerRef.current);
    try {
      const res = await submitCtfCompetitionFlag(competitionId, challenge.id, flag.trim());
      const ts = new Date();
      setResultKey(k => k + 1);
      if (res.correct) {
        setAttempts(p => [{ time: ts, result: "correct" as const, flag: flag.trim() }, ...p].slice(0, 5));
        setResult({ correct: true, message: res.message });
        setGlowing(true);
        setTimeout(() => setGlowing(false), 1200);
        toast.success("Correct flag!", `+${res.pointsAwarded} points awarded.`);
        onSolved?.(challenge.id, res.pointsAwarded ?? 0);
        getCtfCompetitionChallenges(competitionId).then(w => {
          const c = w.challenges.find(x => x.id === challenge.id);
          setChallenge(c ?? null);
        }).catch(() => {});
      } else {
        setAttempts(p => [{ time: ts, result: "wrong" as const, flag: flag.trim() }, ...p].slice(0, 5));
        setResult({ correct: false, message: res.message });
        setShaking(true);
        setTimeout(() => setShaking(false), 500);
        toast.error("Wrong flag", res.message ?? "Try again.");
        wrongTimerRef.current = setTimeout(() => setResult(null), 4000);
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

  return (
    <div
      onClick={doClose}
      style={{
        position: "fixed", inset: 0, zIndex: 110,
        background: "rgba(0,0,0,0.7)",
        display: "flex", justifyContent: "center", alignItems: "flex-end",
        animation: closing ? "ctf-modal-fade-out 200ms ease forwards" : "ctf-modal-fade-in 250ms ease",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 860,
          maxHeight: "92vh", height: "92vh",
          background: "#0a0f1e",
          border: "1px solid #1e293b",
          borderRadius: "12px 12px 0 0",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
          animation: closing ? "ctf-modal-down 200ms ease forwards" : "ctf-modal-up 320ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {loading ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Loader2 size={28} style={{ animation: "spin 1s linear infinite", color: "#6366f1" }} />
          </div>
        ) : !challenge ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", padding: 24 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Challenge unavailable</div>
              <div style={{ fontSize: 13, color: "#64748b" }}>It may have been hidden by the organizer.</div>
              <button onClick={doClose} className="psp-btn psp-btn-secondary" style={{ marginTop: 16 }}>
                Close
              </button>
            </div>
          </div>
        ) : (
          <ChallengeBody
            c={challenge}
            competitionId={competitionId}
            teamId={teamId}
            canSolve={canSolve} isPaused={isPaused} isEnded={isEnded}
            flag={flag} setFlag={setFlag}
            busy={busy} result={result} resultKey={resultKey} attempts={attempts}
            shaking={shaking} glowing={glowing}
            inputRef={inputRef}
            onSubmit={submit}
            onClose={doClose}
            unlockedHints={unlockedHints}
            unlockingHint={unlockingHint}
            onUnlockHint={handleUnlockHint}
          />
        )}
      </div>

      <style jsx global>{`
        @keyframes ctf-modal-fade-in  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ctf-modal-fade-out { from { opacity: 1; } to { opacity: 0; } }
        @keyframes ctf-modal-up       { from { transform: translateY(100%); opacity: 0; }
                                         to   { transform: translateY(0); opacity: 1; } }
        @keyframes ctf-modal-down     { from { transform: translateY(0); opacity: 1; }
                                         to   { transform: translateY(100%); opacity: 0; } }
        @keyframes ctf-shake {
          0%,100% { transform: translateX(0); }
          15%     { transform: translateX(-9px); }
          30%     { transform: translateX(9px); }
          45%     { transform: translateX(-6px); }
          60%     { transform: translateX(6px); }
          75%     { transform: translateX(-3px); }
          90%     { transform: translateX(3px); }
        }
        @keyframes ctf-result-in {
          from { opacity: 0; transform: translateY(6px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
        @keyframes ctf-correct-glow {
          0%   { box-shadow: 0 0 0 0   rgba(34,197,94,0.55); }
          50%  { box-shadow: 0 0 22px 8px rgba(34,197,94,0.3); }
          100% { box-shadow: 0 0 0 0   rgba(34,197,94,0); }
        }
        @keyframes ctf-correct-pop {
          0%   { transform: scale(1); }
          40%  { transform: scale(1.04); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

// ── Body (rendered only when challenge is loaded) ─────────────────────────────

function ChallengeBody({
  c, competitionId, teamId, canSolve, isPaused, isEnded, flag, setFlag, busy, result, resultKey,
  attempts, shaking, glowing, inputRef, onSubmit, onClose,
  unlockedHints, unlockingHint, onUnlockHint,
}: {
  c: CTFCompetitionChallengeDTO;
  competitionId: string;
  teamId?: string;
  canSolve: boolean; isPaused: boolean; isEnded: boolean;
  flag: string; setFlag: (v: string) => void;
  busy: boolean;
  result: { correct: boolean; message: string } | null;
  resultKey: number;
  attempts: Attempt[];
  shaking: boolean;
  glowing: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onSubmit: () => void; onClose: () => void;
  unlockedHints: Record<string, string>;
  unlockingHint: string | null;
  onUnlockHint: (hintId: string) => void;
}) {
  const conf   = CAT_CONFIG[c.category];
  const accent = conf?.accent ?? "#94a3b8";
  const maxAttempts = c.maxAttempts ?? 10;
  const wrongCount  = attempts.filter(a => a.result === "wrong").length;
  const remaining   = Math.max(0, maxAttempts - wrongCount);

  return (
    <>
      {/* Sticky header */}
      <div style={{
        padding: "14px 20px",
        borderBottom: "1px solid #1e293b",
        display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        flexShrink: 0,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              fontSize: 11, fontWeight: 700, color: accent, letterSpacing: "0.06em", textTransform: "uppercase",
            }}>
              {conf?.icon} {c.category}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 700,
              color: DIFF_COLORS[c.difficulty] ?? "#94a3b8",
              background: `${DIFF_COLORS[c.difficulty] ?? "#94a3b8"}18`,
              border: `1px solid ${DIFF_COLORS[c.difficulty] ?? "#94a3b8"}30`,
              borderRadius: 4, padding: "1px 6px",
            }}>
              {c.difficulty}
            </span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#f8fafc", lineHeight: 1.3, marginBottom: 4 }}>
            {c.title}
          </div>
          <div style={{ fontSize: 13, color: "#64748b" }}>
            <span style={{ color: accent, fontWeight: 700 }}>{c.basePoints} pts</span>
            {" · "}
            <span>{c.solveCount} teams solved</span>
          </div>
        </div>
        <button onClick={onClose} style={{
          background: "transparent", border: "none", color: "#64748b", cursor: "pointer", padding: 6,
        }} aria-label="Close">
          <X size={16} />
        </button>
      </div>

      {/* Body — two columns on wide screens, stacked on narrow */}
      <div style={{
        flex: 1, overflowY: "auto", padding: 20,
        display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)", gap: 24,
      }}>
        {/* LEFT — description + hints + instance */}
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 13, color: "#cbd5e1", lineHeight: 1.7,
            whiteSpace: "pre-wrap", wordBreak: "break-word", marginBottom: 20,
          }}>
            {c.description}
          </div>

          {c.downloadableFileUrl && (
            <a
              href={c.downloadableFileUrl}
              download={c.downloadableFileName ?? "challenge-file"}
              style={{
                display: "flex", alignItems: "center", gap: 8, marginBottom: 20,
                background: "#0f172a", border: "1px solid #1e293b", borderRadius: 6,
                padding: "10px 14px", textDecoration: "none", color: "#cbd5e1", fontSize: 13,
              }}
            >
              <Download size={14} />
              <span style={{ flex: 1 }}>{c.downloadableFileName ?? "challenge-file"}</span>
              <span style={{ color: accent, fontWeight: 600 }}>Download</span>
            </a>
          )}

          {c.requiresInstance && (
            <div style={{ marginBottom: 20 }}>
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

          {c.hints && c.hints.length > 0 && (
            <div>
              <div style={{
                fontSize: 11, color: "#64748b", fontWeight: 700,
                textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8,
              }}>
                Hints ({c.hints.length})
              </div>
              {c.hints.map((h, i) => {
                const revealedText = h.text ?? unlockedHints[h.id];
                const isUnlocking  = unlockingHint === h.id;
                const isLocked     = !revealedText;
                return (
                  <div key={h.id} style={{
                    background: "#020617", border: "1px solid #1e293b", borderRadius: 6,
                    padding: "10px 12px", marginBottom: 6,
                    display: "flex", gap: 10, alignItems: "flex-start",
                    cursor: isLocked ? "pointer" : "default",
                    opacity: isUnlocking ? 0.6 : 1,
                    transition: "opacity 0.2s",
                  }}
                    onClick={() => { if (isLocked && !isUnlocking) onUnlockHint(h.id); }}
                    title={isLocked ? `Click to unlock — costs ${h.cost} pts` : undefined}
                  >
                    <Lightbulb size={14}
                      color={revealedText ? "#fbbf24" : "#475569"}
                      style={{ marginTop: 2, flexShrink: 0 }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, color: "#475569", marginBottom: 4 }}>
                        HINT {i + 1}
                        {isLocked
                          ? ` · ${h.cost} pts — click to unlock`
                          : " · unlocked"}
                      </div>
                      <div style={{ fontSize: 12, color: revealedText ? "#cbd5e1" : "#475569", fontStyle: revealedText ? "normal" : "italic" }}>
                        {isUnlocking
                          ? "Unlocking…"
                          : revealedText
                          ? revealedText
                          : "🔒 Click to unlock"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT — submit + attempts */}
        <div style={{ minWidth: 0, position: "sticky", top: 0, alignSelf: "flex-start" }}>
          {c.solvedByMe ? (
            <div style={{
              background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.3)",
              borderRadius: 8, padding: "12px 14px", marginBottom: 14,
              display: "flex", alignItems: "center", gap: 8,
              color: "#34d399", fontSize: 13, fontWeight: 700,
            }}>
              <CheckCircle2 size={14} /> Solved by your team
            </div>
          ) : isEnded ? (
            <div style={{
              border: "1px solid #1e293b", borderRadius: 8, padding: 14,
              color: "#94a3b8", fontSize: 13, textAlign: "center",
            }}>
              Submissions are closed — competition ended.
            </div>
          ) : (
            <div style={{
              background: "#0f172a",
              border: glowing ? "1px solid rgba(34,197,94,0.6)" : "1px solid #1e293b",
              borderRadius: 8, padding: 16,
              animation: shaking
                ? "ctf-shake 0.5s ease, ctf-correct-glow 0s"
                : glowing
                ? "ctf-correct-glow 1.2s ease, ctf-correct-pop 0.4s ease"
                : undefined,
              transition: "border-color 0.3s ease",
            }}>
              <div style={{
                fontSize: 11, color: "#64748b", fontWeight: 700,
                textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10,
              }}>
                Submit flag
              </div>

              {isPaused && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)",
                  color: "#fbbf24", borderRadius: 6, padding: "8px 10px",
                  fontSize: 12, fontWeight: 600, marginBottom: 10,
                }}>
                  <Pause size={13} /> Competition is paused — submissions are disabled.
                </div>
              )}

              <input
                ref={inputRef}
                className="input"
                value={flag}
                onChange={(e) => setFlag(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && canSolve) onSubmit(); }}
                placeholder={isPaused ? "Submissions paused" : "Enter flag…"}
                disabled={busy || isPaused}
                style={{ fontFamily: "ui-monospace, monospace" }}
              />

              <button
                type="button"
                onClick={onSubmit}
                disabled={busy || !canSolve || !flag.trim()}
                style={{
                  width: "100%", marginTop: 10, padding: "10px 0",
                  background: (busy || isPaused || !canSolve)
                    ? "#1e293b"
                    : "linear-gradient(135deg, #4f46e5, #7c3aed)",
                  border: "none", borderRadius: 6,
                  color: isPaused ? "#fbbf24" : "#fff",
                  fontSize: 14, fontWeight: 700,
                  cursor: (busy || !canSolve || !flag.trim()) ? "not-allowed" : "pointer",
                  opacity: (!flag.trim() || !canSolve) && !isPaused ? 0.5 : 1,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}
              >
                {isPaused
                  ? <><Pause size={14} /> Paused</>
                  : busy
                  ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Checking…</>
                  : "Submit Flag"}
              </button>

              {/* Attempts remaining — circles fill on each wrong attempt */}
              <div style={{ display: "flex", gap: 4, marginTop: 10, alignItems: "center", justifyContent: "center" }}>
                {Array.from({ length: maxAttempts }, (_, i) => (
                  <span key={i} style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: i < wrongCount ? "#f87171" : "#1e293b",
                    border: "1px solid #334155",
                  }} />
                ))}
                <span style={{ fontSize: 10, color: "#64748b", marginLeft: 6 }}>
                  {remaining} attempt{remaining !== 1 ? "s" : ""} left
                </span>
              </div>

              {result && (
                <div
                  key={resultKey}
                  style={{
                    marginTop: 10, padding: "8px 10px", borderRadius: 6,
                    fontSize: 12, fontWeight: 600,
                    background: result.correct ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.1)",
                    border: `1px solid ${result.correct ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.3)"}`,
                    color: result.correct ? "#22c55e" : "#f87171",
                    display: "flex", alignItems: "center", gap: 6,
                    animation: "ctf-result-in 0.25s cubic-bezier(0.16,1,0.3,1)",
                    boxShadow: result.correct ? "0 0 12px rgba(34,197,94,0.15)" : "0 0 8px rgba(239,68,68,0.1)",
                  }}
                >
                  {result.correct ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                  {result.message}
                </div>
              )}
            </div>
          )}

          {/* Attempts history — same panel collapses with submit. */}
          {attempts.length > 0 && (
            <div style={{
              marginTop: 14, padding: "10px 14px",
              background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8,
            }}>
              <div style={{
                fontSize: 10, color: "#475569", fontWeight: 700,
                textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6,
              }}>
                Recent attempts
              </div>
              {attempts.map((a, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "4px 0", borderBottom: i < attempts.length - 1 ? "1px solid #0b1220" : "none",
                  fontSize: 11,
                }}>
                  <span style={{ color: a.result === "correct" ? "#22c55e" : "#ef4444" }}>
                    {a.result === "correct" ? "✓" : "✗"}
                  </span>
                  <span style={{
                    flex: 1, fontFamily: "ui-monospace, monospace", color: "#475569",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {a.result === "correct"
                      ? a.flag
                      : (a.flag.length > 3 ? a.flag.slice(0, 3) + "***" : "***")}
                  </span>
                  <span style={{ color: "#334155", whiteSpace: "nowrap" }}>
                    {a.time.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
