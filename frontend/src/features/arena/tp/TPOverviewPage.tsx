"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Clock, Loader2 } from "lucide-react";
import { finalSubmitTP, type ExamProblemDTO, type ExamRoomDTO } from "@/lib/api";
import { toast } from "@/components/ui/PSPToast";
import { useTPRoom, AccessCodeGate, formatDeadline } from "@/features/arena/tp/tpShared";

const MONO = "var(--font-mono), ui-monospace, monospace";

export default function TPOverviewPage({ tpId }: { tpId: string }) {
  const { room, loading, error, needsCode, verifyCode, reload } = useTPRoom(tpId);

  if (needsCode) return <AccessCodeGate title={room?.title} onVerify={verifyCode} />;

  if (loading) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <Loader2 size={26} style={{ animation: "spin 1s linear infinite", color: "var(--accent)" }} />
      </div>
    );
  }

  if (error || !room) {
    return (
      <div style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, background: "var(--bg)" }}>
        <p style={{ color: "var(--ink-2)", fontSize: 14 }}>{error ?? "TP not found."}</p>
        <Link href="/assessments" className="psp-btn psp-btn-secondary psp-btn-sm">Back</Link>
      </div>
    );
  }

  if (room.finalSubmittedAt) {
    return <TPResultsView room={room} />;
  }

  return <TPTaskBoard room={room} onFinalSubmitted={reload} />;
}

// ── Task board (not yet finally submitted) ──────────────────────────────────

function TPTaskBoard({ room, onFinalSubmitted }: { room: ExamRoomDTO; onFinalSubmitted: () => void }) {
  const solvedCount = room.problems.filter((p) => p.solvedByCurrentUser).length;
  const isPastDeadline = !!room.deadline && new Date() > new Date(room.deadline);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{
        height: 56, display: "flex", alignItems: "center", padding: "0 24px", gap: 16,
        borderBottom: "1px solid var(--line)", background: "var(--bg-2)",
      }}>
        <div>
          <p style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{room.title}</p>
          <p style={{ fontSize: 11, color: "var(--ink-3)" }}>Take-home TP</p>
        </div>
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: MONO, fontSize: 12, color: "var(--ink-2)" }}>
          {solvedCount} / {room.problems.length} solved
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--warn)", fontFamily: MONO, fontSize: 12 }}>
          <Clock size={13} /> Due {formatDeadline(room.deadline)}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 12, color: "var(--ink-3)" }}>
          {room.maxAttempts != null ? `max ${room.maxAttempts} attempts/task` : "unlimited attempts"}
        </span>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px" }}>
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 16, marginBottom: 40,
        }}>
          {room.problems.map((task, i) => (
            <TaskCard key={task.problemId} task={task} index={i} tpId={room.assessmentId} />
          ))}
        </div>

        <FinalSubmitPanel room={room} isPastDeadline={isPastDeadline} onSubmitted={onFinalSubmitted} />
      </div>
    </div>
  );
}

function TaskCard({ task, index, tpId }: { task: ExamProblemDTO; index: number; tpId: string }) {
  const router = useRouter();
  const letter = String.fromCharCode(65 + index);
  const isAC = task.solvedByCurrentUser;
  const verdictColor = isAC ? "var(--accent)" : (task.attemptsUsed ?? 0) > 0 ? "var(--danger)" : "var(--ink-3)";
  const earned = task.earnedScore ?? 0;

  return (
    <div
      onClick={() => router.push(`/arena/tp/${tpId}/task/${task.problemId}`)}
      style={{
        background: "var(--surface)",
        border: `1px solid ${isAC ? "rgba(0,200,150,.25)" : "var(--line-2)"}`,
        borderRadius: 14, padding: "20px 20px 16px", cursor: "pointer",
        transition: "transform .15s, box-shadow .15s", position: "relative", overflow: "hidden",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,.4)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
    >
      {isAC && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "var(--accent)" }} />}

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: MONO, fontSize: 15, fontWeight: 700,
          background: isAC ? "var(--accent-dim, rgba(0,200,150,.10))" : "var(--surface-2)",
          color: isAC ? "var(--accent)" : "var(--ink-2)",
          border: `1px solid ${isAC ? "rgba(0,200,150,.2)" : "var(--line)"}`,
        }}>
          {letter}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {task.title}
          </p>
          <p style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>
            {task.difficulty} · {task.points} pts
          </p>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTop: "1px solid var(--line)" }}>
        <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: earned > 0 ? verdictColor : "var(--ink-3)" }}>
          {earned} / {task.points} pts
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {(task.attemptsUsed ?? 0) > 0 && (
            <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--ink-3)" }}>
              {task.attemptsUsed} attempt{task.attemptsUsed !== 1 ? "s" : ""}
            </span>
          )}
          {isAC && (
            <span style={{
              fontFamily: MONO, fontSize: 11, fontWeight: 700, color: "var(--accent)",
              background: "rgba(0,200,150,.10)", border: "1px solid rgba(0,200,150,.2)",
              padding: "2px 8px", borderRadius: 20,
            }}>
              AC
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function FinalSubmitPanel({ room, isPastDeadline, onSubmitted }: {
  room: ExamRoomDTO; isPastDeadline: boolean; onSubmitted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const solvedCount = room.problems.filter((p) => p.solvedByCurrentUser).length;
  const totalPoints = room.problems.reduce((s, t) => s + (t.earnedScore ?? 0), 0);
  const maxPoints = room.problems.reduce((s, t) => s + t.points, 0);

  async function handleFinalSubmit() {
    setLoading(true);
    try {
      await finalSubmitTP(room.assessmentId);
      toast.success("TP submitted", "Your submissions are now locked in.");
      onSubmitted();
    } catch (e) {
      toast.error("Failed to submit", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setLoading(false);
      setOpen(false);
    }
  }

  return (
    <>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "20px 24px", borderRadius: 14, background: "var(--surface)", border: "1px solid var(--line-2)",
      }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>Ready to submit?</p>
          <p style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>
            {solvedCount} / {room.problems.length} tasks solved · {totalPoints} / {maxPoints} pts earned
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          disabled={isPastDeadline}
          style={{
            padding: "10px 28px", borderRadius: 10, fontWeight: 700, fontSize: 14, border: "none",
            cursor: isPastDeadline ? "not-allowed" : "pointer",
            background: isPastDeadline ? "var(--surface-2)" : "var(--accent)",
            color: isPastDeadline ? "var(--ink-3)" : "#0a0a0a",
          }}
        >
          {isPastDeadline ? "Deadline Passed" : "Submit TP"}
        </button>
      </div>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,.7)", backdropFilter: "blur(4px)" }} />
          <div style={{
            position: "fixed", top: "50%", left: "50%", zIndex: 50, transform: "translate(-50%, -50%)",
            background: "var(--surface)", border: "1px solid var(--line-2)", borderRadius: 16,
            padding: "32px 36px", width: 420, boxShadow: "0 24px 80px rgba(0,0,0,.6)",
          }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: "var(--ink)" }}>Submit TP — are you sure?</h2>
            <p style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 20 }}>
              This will lock all your submissions and calculate your final score. You will not be able to make any more changes.
            </p>

            <div style={{ padding: "12px 16px", borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--line)", marginBottom: 20 }}>
              {room.problems.map((task, i) => (
                <div key={task.problemId} style={{
                  display: "flex", justifyContent: "space-between", padding: "4px 0",
                  borderBottom: i < room.problems.length - 1 ? "1px solid var(--line)" : "none",
                }}>
                  <span style={{ fontSize: 13, color: "var(--ink-2)" }}>{String.fromCharCode(65 + i)}. {task.title}</span>
                  <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: (task.earnedScore ?? 0) > 0 ? "var(--accent)" : "var(--ink-3)" }}>
                    {task.earnedScore ?? 0} / {task.points}
                  </span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, marginTop: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>Total</span>
                <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: "var(--accent)" }}>{totalPoints} / {maxPoints}</span>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setOpen(false)} style={{
                flex: 1, padding: "10px 0", borderRadius: 10, background: "var(--surface-2)",
                border: "1px solid var(--line)", color: "var(--ink-2)", fontWeight: 600, cursor: "pointer",
              }}>
                Cancel
              </button>
              <button onClick={handleFinalSubmit} disabled={loading} style={{
                flex: 1, padding: "10px 0", borderRadius: 10, background: "var(--accent)",
                border: "none", color: "#0a0a0a", fontWeight: 700, cursor: loading ? "default" : "pointer", opacity: loading ? 0.7 : 1,
              }}>
                {loading ? "Submitting…" : "Confirm Submit"}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

// ── Results view (after final submit) ────────────────────────────────────────

function TPResultsView({ room }: { room: ExamRoomDTO }) {
  const totalEarned = room.problems.reduce((s, t) => s + (t.earnedScore ?? 0), 0);
  const totalPossible = room.problems.reduce((s, t) => s + t.points, 0);
  const percentage = totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 0;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{
        height: 56, display: "flex", alignItems: "center", padding: "0 24px",
        borderBottom: "1px solid var(--line)", background: "var(--bg-2)", gap: 12,
      }}>
        <Link href="/assessments" style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--ink-3)", fontSize: 12, textDecoration: "none" }}>
          <ArrowLeft size={14} /> Back
        </Link>
        <span style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)" }}>{room.title}</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: MONO, fontSize: 12, color: "var(--ink-3)" }}>
          Submitted {formatDeadline(room.finalSubmittedAt)}
        </span>
      </div>

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "48px 24px" }}>
        <div style={{
          textAlign: "center", padding: "40px 0", marginBottom: 32,
          background: "var(--surface)", borderRadius: 16, border: "1px solid rgba(0,200,150,.25)",
        }}>
          <p style={{ fontFamily: MONO, fontSize: 64, fontWeight: 700, color: "var(--accent)", lineHeight: 1, marginBottom: 8, textShadow: "0 0 40px rgba(0,200,150,.3)" }}>
            {percentage}%
          </p>
          <p style={{ fontFamily: MONO, fontSize: 14, color: "var(--ink-2)", marginTop: 12 }}>
            {totalEarned} / {totalPossible} points
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {room.problems.map((task, i) => {
            const earned = task.earnedScore ?? 0;
            const color = earned >= task.points ? "var(--accent)" : earned > 0 ? "var(--warn)" : "var(--danger)";
            return (
              <div key={task.problemId} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
                borderRadius: 10, background: "var(--surface)", border: "1px solid var(--line)",
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: MONO, fontSize: 13, fontWeight: 700, background: "var(--surface-2)", color,
                  border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
                }}>
                  {String.fromCharCode(65 + i)}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{task.title}</p>
                  <p style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>
                    {task.solvedByCurrentUser ? "Solved" : "Not solved"} · {task.attemptsUsed ?? 0} attempts
                  </p>
                </div>
                <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color }}>
                  {earned} / {task.points}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
