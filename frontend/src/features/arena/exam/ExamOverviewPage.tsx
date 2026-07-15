"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Loader2, Play, ShieldAlert } from "lucide-react";
import { getExamResults, logCheatEvent, pingAuditSession, type ExamProblemDTO, type ExamResultsDTO } from "@/lib/api";
import { FullscreenGate } from "@/components/arena/FullscreenGate";
import { useAntiCheat, type ViolationEvent } from "@/hooks/useAntiCheat";
import { useAuth } from "@/features/auth/contexts/AuthContext";
import { AccessCodeGate } from "@/features/arena/tp/tpShared";
import { useExamRoom, formatTime } from "@/features/arena/exam/examShared";
import ExamResults from "@/components/arena/exam/ExamResults";

const MONO = "var(--font-mono), ui-monospace, monospace";

export default function ExamOverviewPage({ examId }: { examId: string }) {
  const { room, remainingSecs, loading, error, needsCode, verifyCode } = useExamRoom(examId);
  const [entered, setEntered] = useState(false);

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
        <p style={{ color: "var(--ink-2)", fontSize: 14 }}>{error ?? "Exam not found."}</p>
        <Link href="/assessments" className="psp-btn psp-btn-secondary psp-btn-sm">Back</Link>
      </div>
    );
  }

  const isEnded = room.isEnded || remainingSecs <= 0;

  if (isEnded && room.gradesRevealed) {
    return <ExamResultsWrapper examId={examId} title={room.title} />;
  }

  if (!entered) {
    return <ExamBriefing room={room} remainingSecs={remainingSecs} isEnded={isEnded} onEnter={() => setEntered(true)} />;
  }

  return (
    <FullscreenGate enabled={!isEnded}>
      <ExamQuestionGrid room={room} remainingSecs={remainingSecs} isEnded={isEnded} examId={examId} />
    </FullscreenGate>
  );
}

function ExamResultsWrapper({ examId, title }: { examId: string; title: string }) {
  const [data, setData] = useState<ExamResultsDTO | null>(null);
  useEffect(() => { getExamResults(examId).then(setData).catch(() => {}); }, [examId]);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
      <div style={{
        height: 56, flexShrink: 0, display: "flex", alignItems: "center", padding: "0 24px", gap: 12,
        borderBottom: "1px solid var(--line)", background: "var(--bg-2)",
      }}>
        <Link href="/assessments" style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--ink-3)", fontSize: 12, textDecoration: "none" }}>
          <ArrowLeft size={14} /> Back
        </Link>
        <span style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)" }}>{title}</span>
      </div>
      {data ? <ExamResults data={data} /> : (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Loader2 size={26} style={{ animation: "spin 1s linear infinite", color: "var(--accent)" }} />
        </div>
      )}
    </div>
  );
}

function ExamBriefing({ room, remainingSecs, isEnded, onEnter }: {
  room: { title: string; problems: ExamProblemDTO[] }; remainingSecs: number; isEnded: boolean; onEnter: () => void;
}) {
  return (
    <div style={{
      height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", color: "var(--ink)",
    }}>
      <div style={{ background: "var(--bg-2)", borderRadius: 10, padding: "32px 36px", maxWidth: 480, width: "100%", boxShadow: "0 16px 40px rgba(0,0,0,0.4)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <div style={{
            width: 36, height: 36, background: "var(--brand)", borderRadius: 6,
            display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 900, fontSize: 16,
          }}>P</div>
          <div>
            <div style={{ fontSize: 11, color: "var(--ink-2)", textTransform: "uppercase", letterSpacing: 0.6 }}>Entering arena</div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{room.title}</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, color: "var(--ink-3)", textTransform: "uppercase" }}>Questions</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>{room.problems.length}</div>
          </div>
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, color: "var(--ink-3)", textTransform: "uppercase" }}>Time left</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2, fontFamily: MONO }}>{formatTime(remainingSecs)}</div>
          </div>
        </div>

        <div style={{
          background: "rgba(222,53,11,0.12)", border: "1px solid rgba(222,53,11,0.4)", borderRadius: 6,
          padding: "10px 12px", marginBottom: 18, display: "flex", gap: 10, alignItems: "flex-start",
        }}>
          <ShieldAlert size={16} color="var(--danger-ink)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 12, lineHeight: 1.55, color: "var(--danger-soft)" }}>
            <strong style={{ color: "var(--danger-soft)" }}>Anti-cheat is active.</strong>{" "}
            Fullscreen is required. Tab switches, copy/paste outside the editor, dev-tools shortcuts, and right-click are logged as violations.
          </div>
        </div>

        <button
          type="button" onClick={onEnter} disabled={isEnded}
          style={{
            width: "100%", height: 42, background: isEnded ? "var(--line-strong)" : "var(--brand)",
            color: "white", border: "none", borderRadius: 6, fontSize: 14, fontWeight: 700,
            cursor: isEnded ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          <Play size={14} /> {isEnded ? "Session has ended" : "Enter Arena"}
        </button>

        <div style={{ textAlign: "center", marginTop: 12 }}>
          <Link href="/assessments" style={{ fontSize: 12, color: "var(--ink-2)", textDecoration: "none" }}>← Back to Exams &amp; TPs</Link>
        </div>
      </div>
    </div>
  );
}

function ExamQuestionGrid({ room, remainingSecs, isEnded, examId }: {
  room: { title: string; problems: ExamProblemDTO[] }; remainingSecs: number; isEnded: boolean; examId: string;
}) {
  const router = useRouter();
  const { userId } = useAuth();
  const [tabSwitches, setTabSwitches] = useState(0);
  const answeredCount = room.problems.filter((p) => p.solvedByCurrentUser).length;

  useEffect(() => { pingAuditSession("EXAM", examId).catch(() => {}); }, [examId]);

  const reportViolation = (event: ViolationEvent) => {
    if (!userId) return;
    if (event.type === "TAB_SWITCH") setTabSwitches((n) => n + 1);
    logCheatEvent({ studentId: userId, assessmentId: examId, violationType: event.type }).catch(() => {});
  };
  useAntiCheat({ competitionId: examId, enabled: !isEnded, onViolation: reportViolation });

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
