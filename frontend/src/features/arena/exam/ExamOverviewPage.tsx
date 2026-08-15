"use client";

import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { type ExamProblemDTO } from "@/lib/api";
import { useExamSession } from "@/features/arena/exam/ExamSessionContext";
import { formatTime } from "@/features/arena/exam/examShared";

const MONO = "var(--font-mono), ui-monospace, monospace";

export default function ExamOverviewPage({ examId }: { examId: string }) {
  const router = useRouter();
  const { room, remainingSecs, isEnded, tabSwitches } = useExamSession();
  const answeredCount = room.problems.filter((p) => p.solvedByCurrentUser).length;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{
        height: 56, display: "flex", alignItems: "center", padding: "0 24px", gap: 16,
        borderBottom: "1px solid var(--line)", background: "var(--bg-2)",
      }}>
        <div>
          <p style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{room.title}</p>
          <p style={{ fontSize: 11, color: "var(--ink-3)" }}>Live Exam</p>
        </div>
        <div style={{ flex: 1 }} />
        {!isEnded && (
          <span style={{
            display: "flex", alignItems: "center", gap: 6, fontSize: 12,
            color: tabSwitches > 0 ? "var(--danger)" : "var(--ink-3)",
          }}>
            <AlertTriangle size={13} /> Anti-cheat · {tabSwitches} switch{tabSwitches === 1 ? "" : "es"}
          </span>
        )}
        <span style={{ fontFamily: MONO, fontSize: 12, color: "var(--ink-2)" }}>{answeredCount} / {room.problems.length} answered</span>
        <span style={{
          fontFamily: MONO, fontSize: 20, fontWeight: 700, letterSpacing: 1,
          color: remainingSecs < 300 && !isEnded ? "var(--danger)" : "var(--accent)",
        }}>
          {isEnded ? "00:00:00" : formatTime(remainingSecs)}
        </span>
      </div>

      {isEnded && (
        <div style={{
          padding: "10px 24px", background: "var(--danger-soft)", color: "var(--danger-ink)",
          fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8,
        }}>
          <AlertTriangle size={14} /> This exam has ended. Waiting for grades to be released.
        </div>
      )}

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
          {room.problems.map((q, i) => (
            <QuestionCard key={q.problemId} q={q} index={i}
              onClick={() => !isEnded && router.push(`/arena/exam/${examId}/question/${q.problemId}`)}
              disabled={isEnded}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function QuestionCard({ q, index, onClick, disabled }: { q: ExamProblemDTO; index: number; onClick: () => void; disabled: boolean }) {
  const letter = String.fromCharCode(65 + index);
  const answered = q.solvedByCurrentUser;
  return (
    <div
      onClick={onClick}
      style={{
        background: "var(--surface)", border: `1px solid ${answered ? "rgba(0,200,150,.25)" : "var(--line-2)"}`,
        borderRadius: 14, padding: "20px 20px 16px", cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.6 : 1, transition: "transform .15s, box-shadow .15s", position: "relative", overflow: "hidden",
      }}
      onMouseEnter={(e) => { if (disabled) return; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,.4)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
    >
      {answered && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "var(--accent)" }} />}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: MONO, fontSize: 15, fontWeight: 700,
          background: answered ? "rgba(0,200,150,.10)" : "var(--surface-2)",
          color: answered ? "var(--accent)" : "var(--ink-2)",
          border: `1px solid ${answered ? "rgba(0,200,150,.2)" : "var(--line)"}`,
        }}>
          {letter}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.title}</p>
          <p style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>{q.difficulty} · {q.points} pts</p>
        </div>
      </div>
      <div style={{ paddingTop: 12, borderTop: "1px solid var(--line)" }}>
        <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: answered ? "var(--accent)" : "var(--ink-3)" }}>
          {answered ? "Answered" : "Not answered"}
        </span>
      </div>
    </div>
  );
}
