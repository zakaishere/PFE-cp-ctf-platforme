"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import { LoadingButton } from "@/components/ui/LoadingButton";
import {
  ArrowLeft, Download, Lock, Lightbulb, CheckCircle2, AlertTriangle, Loader2,
} from "lucide-react";
import {
  getCTFChallenge, submitCTFFlag, unlockCTFHint,
  getMyCTFSubmissions,
  type CTFChallengeDTO, type CTFSubmission,
} from "@/lib/api";
import InstancePanel from "@/components/ctf/InstancePanel";
import { toast } from "@/components/ui/PSPToast";

// ── Category colors ──────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  CRYPTO:    "var(--purple)",
  FORENSICS: "var(--blue)",
  REVERSE:   "var(--orange)",
  WEB:       "var(--red)",
  MISC:      "var(--text-muted)",
  OSINT:     "var(--green)",
  PWN:       "#d97706",
};

const DIFF_COLORS: Record<string, string> = {
  EASY: "var(--green)", MEDIUM: "var(--orange)", HARD: "var(--red)",
};

// ── Cooldown timer ────────────────────────────────────────────────────────────

function CooldownTimer({ seconds, onDone }: { seconds: number; onDone: () => void }) {
  const [remaining, setRemaining] = useState(seconds);
  useEffect(() => {
    if (remaining <= 0) { onDone(); return; }
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining, onDone]);
  return (
    <div style={{ textAlign: "center", padding: "8px 0", fontSize: 13, color: "var(--text-muted)" }}>
      Wait {remaining}s before submitting again…
    </div>
  );
}

// ── Hints Card ────────────────────────────────────────────────────────────────

function HintsCard({
  challenge,
  onHintUnlocked,
}: {
  challenge: CTFChallengeDTO;
  onHintUnlocked: (hintId: string, text: string) => void;
}) {
  const [unlocking, setUnlocking] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  if (!challenge.hints || challenge.hints.length === 0) return null;

  const doUnlock = async (hintId: string) => {
    setUnlocking(hintId);
    setConfirming(null);
    try {
      const hint = await unlockCTFHint(challenge.id, hintId);
      onHintUnlocked(hintId, hint.text);
      toast.success("Hint unlocked", hint.text);
    } catch (e) { /* handled */ }
    setUnlocking(null);
  };

  return (
    <div className="card" style={{ padding: 16, marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>
        Hints
      </div>
      {challenge.hints.map((hint, idx) => {
        const isUnlocked = hint.text != null;
        return (
          <div key={hint.id} style={{
            display: "flex", alignItems: "flex-start", gap: 10,
            padding: "8px 0", borderTop: idx > 0 ? "1px solid var(--border)" : undefined,
          }}>
            {isUnlocked ? (
              <Lightbulb size={14} style={{ color: "var(--orange)", flexShrink: 0, marginTop: 2 }} />
            ) : (
              <Lock size={14} style={{ color: "var(--text-subtle)", flexShrink: 0, marginTop: 2 }} />
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600, marginBottom: isUnlocked ? 4 : 0 }}>
                Hint #{idx + 1}
                {!isUnlocked && (
                  <span style={{ marginLeft: 6, color: "var(--text-subtle)", fontWeight: 400 }}>
                    – {hint.cost} pts
                  </span>
                )}
              </div>
              {isUnlocked ? (
                <div style={{ fontSize: 12, color: "var(--text-primary)" }}>{hint.text}</div>
              ) : confirming === hint.id ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Spend {hint.cost} pts?</span>
                  <button
                    onClick={() => doUnlock(hint.id)}
                    disabled={unlocking === hint.id}
                    style={{ fontSize: 11, padding: "2px 8px", background: "var(--orange-light)", color: "var(--orange)", border: "1px solid var(--orange)", borderRadius: 3, cursor: "pointer" }}
                  >
                    {unlocking === hint.id ? "…" : "Yes"}
                  </button>
                  <button
                    onClick={() => setConfirming(null)}
                    style={{ fontSize: 11, padding: "2px 8px", background: "var(--bg-secondary)", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: 3, cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirming(hint.id)}
                  style={{ marginTop: 4, fontSize: 11, padding: "2px 8px", background: "var(--bg-secondary)", color: "var(--text-secondary)", border: "1px solid var(--border)", borderRadius: 3, cursor: "pointer" }}
                >
                  Unlock
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Submissions Card ──────────────────────────────────────────────────────────

function SubmissionsCard({ submissions }: { submissions: CTFSubmission[] }) {
  if (submissions.length === 0) return null;
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 10 }}>
        My Submissions
      </div>
      <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ color: "var(--text-muted)", textAlign: "left" }}>
            <th style={{ padding: "4px 0", fontWeight: 600 }}>Time</th>
            <th style={{ padding: "4px 0", fontWeight: 600 }}>Submitted</th>
            <th style={{ padding: "4px 0", fontWeight: 600 }}>Result</th>
          </tr>
        </thead>
        <tbody>
          {submissions.map((s) => (
            <tr key={s.id} style={{ borderTop: "1px solid var(--border)" }}>
              <td style={{ padding: "5px 0", color: "var(--text-muted)" }}>
                {new Date(s.submittedAt).toLocaleTimeString()}
              </td>
              <td style={{ padding: "5px 0", color: "var(--text-secondary)", fontFamily: "monospace" }}>
                {s.isCorrect
                  ? s.submittedValue
                  : s.submittedValue.substring(0, 3) + "***"}
              </td>
              <td style={{ padding: "5px 0" }}>
                {s.isCorrect ? (
                  <span style={{ color: "var(--green)", display: "flex", alignItems: "center", gap: 3 }}>
                    <CheckCircle2 size={11} /> Correct
                  </span>
                ) : (
                  <span style={{ color: "var(--red)" }}>Wrong</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CTFDetailPage() {
  const params = useParams<{ id: string }>();
  const [challenge, setChallenge] = useState<CTFChallengeDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [flagInput, setFlagInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [result, setResult] = useState<{ correct: boolean; message: string; points?: number } | null>(null);
  const [submissions, setSubmissions] = useState<CTFSubmission[]>([]);

  useEffect(() => {
    if (!params?.id) return;
    setLoading(true);
    Promise.all([
      getCTFChallenge(params.id),
      getMyCTFSubmissions(params.id),
    ])
      .then(([ch, subs]) => {
        setChallenge(ch);
        setSubmissions(subs);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [params?.id]);

  const submitFlag = async () => {
    if (!challenge || !flagInput.trim()) return;
    setSubmitting(true);
    setResult(null);
    try {
      const res = await submitCTFFlag(challenge.id, flagInput.trim());
      setResult({ correct: res.correct, message: res.message, points: res.pointsAwarded ?? undefined });
      if (res.correct) {
        setChallenge((prev) => prev ? { ...prev, solvedByMe: true } : prev);
      }
      // Refresh submissions
      getMyCTFSubmissions(challenge.id).then(setSubmissions).catch(() => {});
    } catch (err: unknown) {
      if (err && typeof err === "object" && "code" in err) {
        const e = err as { code: string; message: string; waitSeconds?: number };
        if (e.code === "CTF_COOLDOWN" && e.waitSeconds) setCooldown(e.waitSeconds);
        if (e.code === "CTF_ALREADY_SOLVED") setResult({ correct: true, message: e.message });
      }
    }
    setSubmitting(false);
  };

  const handleHintUnlocked = (hintId: string, text: string) => {
    setChallenge((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        hints: prev.hints.map((h) => h.id === hintId ? { ...h, text } : h),
        myUnlockedHints: [...(prev.myUnlockedHints ?? []), hintId],
      };
    });
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
          <Loader2 size={32} style={{ animation: "spin 1s linear infinite" }} />
        </div>
      </>
    );
  }

  if (!challenge) {
    return (
      <>
        <Navbar />
        <div className="psp-main">
          <div className="psp-empty">
            <AlertTriangle size={32} style={{ margin: "0 auto 10px", color: "var(--red)" }} />
            <div className="psp-empty-title">Challenge not found</div>
            <Link href="/ctf" className="btn btn-secondary btn-sm" style={{ marginTop: 12 }}>
              Back to CTF
            </Link>
          </div>
        </div>
      </>
    );
  }

  const catColor = CATEGORY_COLORS[challenge.category] ?? "var(--text-muted)";
  const diffColor = DIFF_COLORS[challenge.difficulty] ?? "var(--text-muted)";
  const attemptsUsed = challenge.myAttempts;
  const attemptsMax = challenge.maxAttempts ?? 10;
  const attemptsLeft = Math.max(0, attemptsMax - attemptsUsed);
  const attemptsPercent = Math.round((attemptsUsed / attemptsMax) * 100);

  return (
    <>
      <Navbar />
      <div className="psp-main">
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 340px",
          gap: 20,
          alignItems: "start",
        }}>
          {/* ── Left panel ─────────────────────────────────────────────── */}
          <div>
            <Link
              href="/ctf"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)", textDecoration: "none", marginBottom: 14 }}
            >
              <ArrowLeft size={13} /> Back to CTF
            </Link>

            {/* Category + difficulty */}
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <span style={{
                background: `${catColor}18`, color: catColor,
                border: `1px solid ${catColor}30`,
                borderRadius: 3, padding: "3px 10px", fontSize: 12, fontWeight: 700,
              }}>
                {challenge.category}
              </span>
              <span style={{
                background: "var(--bg-secondary)", color: diffColor,
                border: `1px solid ${diffColor}40`,
                borderRadius: 3, padding: "3px 10px", fontSize: 12, fontWeight: 600,
              }}>
                {challenge.difficulty}
              </span>
            </div>

            {/* Title */}
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>
              {challenge.title}
            </h1>

            {/* Points + solves */}
            <div style={{ display: "flex", gap: 16, fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
              <span style={{ color: "var(--blue)", fontWeight: 700 }}>{challenge.basePoints} pts</span>
              <span>{challenge.solveCount} solves</span>
            </div>

            <hr style={{ border: "none", borderTop: "1px solid var(--border)", marginBottom: 20 }} />

            {/* Description */}
            <div className="card" style={{ padding: 20, marginBottom: 16 }}>
              <pre style={{
                fontFamily: "inherit", fontSize: 14, lineHeight: 1.7,
                color: "var(--text-primary)", whiteSpace: "pre-wrap", margin: 0,
              }}>
                {challenge.description}
              </pre>
            </div>

            {/* File download */}
            {challenge.downloadableFileUrl && (
              <a
                href={challenge.downloadableFileUrl}
                download={challenge.downloadableFileName}
                className="btn btn-secondary btn-sm"
                style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 16, textDecoration: "none" }}
              >
                <Download size={13} />
                {challenge.downloadableFileName ?? "Download File"}
              </a>
            )}

            {/* Instance panel */}
            <InstancePanel
              challengeId={challenge.id}
              challengeTitle={challenge.title}
              requiresInstance={Boolean(challenge.requiresInstance)}
              connectionType={(challenge as any).connectionType ?? "HTTP"}
            />
          </div>

          {/* ── Right panel ────────────────────────────────────────────── */}
          <div>
            {/* Solved state */}
            {challenge.solvedByMe && (
              <div className="card" style={{
                padding: 16, marginBottom: 14,
                background: "var(--green-light)", border: "1px solid var(--green)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--green)", fontWeight: 700 }}>
                  <CheckCircle2 size={18} />
                  Challenge Solved!
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                  You earned {challenge.basePoints} points.
                </div>
              </div>
            )}

            {/* Flag Submission card */}
            {!challenge.solvedByMe && (
              <div className="card" style={{ padding: 16, marginBottom: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>
                  Submit Flag
                </div>

                {/* Result banner */}
                {result && (
                  <div style={{
                    padding: "10px 12px", borderRadius: 4, marginBottom: 12, fontSize: 13,
                    background: result.correct ? "var(--green-light)" : "var(--red-light)",
                    color: result.correct ? "var(--green)" : "var(--red)",
                    border: `1px solid ${result.correct ? "var(--green)" : "var(--red)"}`,
                    display: "flex", alignItems: "center", gap: 8,
                  }}>
                    {result.correct
                      ? <><CheckCircle2 size={14} /> {result.message}</>
                      : result.message}
                  </div>
                )}

                <input
                  className="input"
                  placeholder={challenge.flagFormat ?? "Enter flag…"}
                  value={flagInput}
                  onChange={(e) => setFlagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") submitFlag(); }}
                  style={{ width: "100%", marginBottom: 10 }}
                />

                {/* Attempts bar */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
                    <span>Attempts used</span>
                    <span style={{ color: attemptsLeft <= 2 ? "var(--red)" : "var(--text-secondary)" }}>
                      {attemptsUsed} / {attemptsMax} ({attemptsLeft} remaining)
                    </span>
                  </div>
                  <div style={{ height: 4, background: "var(--bg-secondary)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 2, transition: "width 0.3s",
                      width: `${attemptsPercent}%`,
                      background: attemptsPercent > 80 ? "var(--red)" : attemptsPercent > 50 ? "var(--orange)" : "var(--blue)",
                    }} />
                  </div>
                </div>

                {cooldown > 0 ? (
                  <CooldownTimer seconds={cooldown} onDone={() => setCooldown(0)} />
                ) : (
                  <LoadingButton
                    loading={submitting}
                    onClick={submitFlag}
                    disabled={!flagInput.trim() || attemptsLeft === 0}
                    variant="primary"
                    size="md"
                    style={{ width: "100%" }}
                  >
                    Submit Flag
                  </LoadingButton>
                )}
              </div>
            )}

            {/* Hints */}
            <HintsCard challenge={challenge} onHintUnlocked={handleHintUnlocked} />

            {/* Submissions */}
            <SubmissionsCard submissions={submissions} />
          </div>
        </div>
      </div>
    </>
  );
}
