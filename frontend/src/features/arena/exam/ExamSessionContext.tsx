"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Play, ShieldAlert } from "lucide-react";
import { getExamResults, pingAuditSession, type ExamProblemDTO, type ExamResultsDTO, type ExamRoomDTO } from "@/lib/api";
import { useAuth } from "@/features/auth/contexts/AuthContext";
import { AccessCodeGate } from "@/features/arena/tp/tpShared";
import { useExamRoom, formatTime } from "@/features/arena/exam/examShared";
import ExamResults from "@/components/arena/exam/ExamResults";
import {
  useExamArenaSnapshot, markExamEntered, useExamArenaLock,
  endExamArenaSession, requestFullscreenNow,
} from "@/features/arena/exam/examArenaSession";

const MONO = "var(--font-mono), ui-monospace, monospace";

interface ExamSessionValue {
  examId: string;
  room: ExamRoomDTO;
  remainingSecs: number;
  isEnded: boolean;
  tabSwitches: number;
}

const ExamSessionCtx = createContext<ExamSessionValue | null>(null);

/** Room data, countdown, and anti-cheat state shared by the question grid and
 *  every question page. Lives in the exam's layout.tsx so it mounts once per
 *  session — switching questions never re-requests fullscreen or re-registers
 *  the anti-cheat listeners. */
export function useExamSession(): ExamSessionValue {
  const ctx = useContext(ExamSessionCtx);
  if (!ctx) throw new Error("useExamSession must be used within an exam session");
  return ctx;
}

export function ExamSessionProvider({ examId, children }: { examId: string; children: React.ReactNode }) {
  const { room, remainingSecs, loading, error, needsCode, verifyCode } = useExamRoom(examId);
  const { userId } = useAuth();
  const { entered, tabSwitches, isFullscreen } = useExamArenaSnapshot(examId);

  const isEnded = (room?.isEnded ?? false) || remainingSecs <= 0;

  useEffect(() => {
    if (!entered) return;
    pingAuditSession("EXAM", examId).catch(() => {});
  }, [entered, examId]);

  useExamArenaLock(examId, entered && !isEnded, userId ?? null);

  useEffect(() => {
    if (isEnded) endExamArenaSession(examId);
  }, [isEnded, examId]);

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

  if (isEnded && room.gradesRevealed) {
    return <ExamResultsWrapper examId={examId} title={room.title} />;
  }

  if (!entered) {
    return <ExamBriefing room={room} remainingSecs={remainingSecs} isEnded={isEnded} onEnter={() => markExamEntered(examId)} />;
  }

  const showFullscreenGate = !isEnded && !isFullscreen;

  return (
    <div style={{ height: "100vh", width: "100vw" }}>
      <ExamSessionCtx.Provider value={{ examId, room, remainingSecs, isEnded, tabSwitches }}>
        {children}
      </ExamSessionCtx.Provider>

      {showFullscreenGate && (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center"
          style={{ background: "rgba(13, 17, 23, 0.97)" }}
        >
          <div className="text-center max-w-md px-8">
            <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-6">
              <span className="text-white font-black text-2xl">P</span>
            </div>
            <h2 className="text-white text-xl font-bold mb-3">Return to fullscreen to continue</h2>
            <p className="text-gray-400 text-sm mb-8 leading-relaxed">
              This exam requires fullscreen mode. Exiting fullscreen is logged as a violation.
            </p>
            <button
              onClick={requestFullscreenNow}
              className="w-full h-12 bg-blue-600 text-white font-bold text-base rounded hover:bg-blue-700 active:scale-95 transition-all duration-150"
            >
              Return to Fullscreen →
            </button>
            <p className="text-gray-600 text-xs mt-4">You cannot submit code while outside fullscreen.</p>
          </div>
        </div>
      )}
    </div>
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
