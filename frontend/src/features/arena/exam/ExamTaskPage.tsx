"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronLeft, Loader2 } from "lucide-react";
import { Client as StompClient } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { submitCode, logCheatEvent, pingAuditSession, getApiBaseUrl } from "@/lib/api";
import { useAuth } from "@/features/auth/contexts/AuthContext";
import { toast } from "@/components/ui/PSPToast";
import { useAntiCheat, type ViolationEvent } from "@/hooks/useAntiCheat";
import { FullscreenGate } from "@/components/arena/FullscreenGate";
import CodeWorkspace, {
  DEFAULT_WORKSPACE_CODE as DEFAULT_CODE,
  type WorkspaceTestResult, type WorkspaceVerdict,
} from "@/features/arena/components/CodeWorkspace";
import QuestionStatement from "@/components/arena/exam/QuestionStatement";
import SubmissionsTab from "@/features/arena/tp/SubmissionsTab";
import { AccessCodeGate } from "@/features/arena/tp/tpShared";
import { useExamRoom, formatTime } from "@/features/arena/exam/examShared";

const MONO = "var(--font-mono), ui-monospace, monospace";

export default function ExamTaskPage({ examId, questionId }: { examId: string; questionId: string }) {
  const router = useRouter();
  const { userId } = useAuth();
  const { room, remainingSecs, loading, error, needsCode, verifyCode } = useExamRoom(examId);

  const [tab, setTab] = useState<"description" | "answers">("description");
  const [lang, setLang] = useState("java");
  const [code, setCode] = useState(DEFAULT_CODE.java);
  const [judging, setJudging] = useState(false);
  const [results, setResults] = useState<WorkspaceTestResult[]>([]);
  const [verdict, setVerdict] = useState<WorkspaceVerdict>(null);
  const [tabSwitches, setTabSwitches] = useState(0);
  const stompRef = useRef<StompClient | null>(null);

  const question = room?.problems.find((p) => p.problemId === questionId) ?? null;
  const questionIdx = room?.problems.findIndex((p) => p.problemId === questionId) ?? -1;
  const isEnded = (room?.isEnded ?? false) || remainingSecs <= 0;

  useEffect(() => {
    if (!examId) return;
    pingAuditSession("EXAM", examId).catch(() => {});
  }, [examId]);

  const reportViolation = (event: ViolationEvent) => {
    if (!userId || !examId) return;
    if (event.type === "TAB_SWITCH") setTabSwitches((n) => n + 1);
    logCheatEvent({ studentId: userId, assessmentId: examId, violationType: event.type }).catch(() => {});
  };
  useAntiCheat({ competitionId: examId, enabled: !isEnded, onViolation: reportViolation });

  useEffect(() => {
    setCode(DEFAULT_CODE[lang] ?? "");
    setResults([]);
    setVerdict(null);
  }, [questionId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(runOnly = false) {
    if (!userId || !question || isEnded) return;
    setJudging(true);
    setVerdict("pending");
    setResults([]);

    try {
      const res = await submitCode({
        studentId: userId,
        problemId: question.problemId,
        assessmentId: examId,
        sourceCode: code,
        language: lang.toUpperCase(),
        runOnly,
      });

      const client = new StompClient({
        webSocketFactory: () => new SockJS(`${getApiBaseUrl()}/ws-endpoint`),
        onConnect: () => {
          client.subscribe(`/topic/submissions/${res.submissionId}`, (frame) => {
            try {
              const data = JSON.parse(frame.body);
              if (data.type === "TEST_CASE_RESULT") {
                const status: WorkspaceTestResult["status"] =
                  data.status === "PASS" ? "pass"
                  : data.status === "TIME_OUT" ? "tle"
                  : data.status === "MEMORY_OUT" ? "mle"
                  : data.status === "ERROR" ? "error"
                  : "fail";
                setResults((prev) => {
                  const next = [...prev];
                  next[data.testCaseIndex] = { idx: data.testCaseIndex, status, executionTimeMs: data.executionTimeMs };
                  return next;
                });
                return;
              }
              if (data.type === "SUBMISSION_COMPLETE") {
                const v: WorkspaceVerdict =
                  data.finalStatus === "PASS" ? "accepted"
                  : data.finalStatus === "TIME_OUT" ? "tle"
                  : data.finalStatus === "MEMORY_OUT" ? "mle"
                  : data.finalStatus === "RUNTIME_ERROR" ? "error"
                  : data.finalStatus === "COMPILATION_ERROR" ? "error"
                  : "wrong";
                setVerdict(v);
                setJudging(false);
                client.deactivate();
              }
            } catch (e) { console.error("STOMP parse error", e); }
          });
        },
        reconnectDelay: 0,
      });
      client.activate();
      stompRef.current = client;

      setTimeout(() => {
        if (stompRef.current?.active) {
          stompRef.current.deactivate();
          setJudging(false);
          setVerdict((v) => {
            if (v !== "pending") return v;
            toast.warning("Still waiting on the judge",
              "This is taking longer than expected. Your submission was recorded — try resubmitting in a moment if this persists.");
            return null;
          });
        }
      }, 30_000);
    } catch (e) {
      console.error("Submit error", e);
      setJudging(false);
      setVerdict(null);
    }
  }

  if (needsCode) return <AccessCodeGate title={room?.title} onVerify={verifyCode} />;

  if (loading) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <Loader2 size={26} style={{ animation: "spin 1s linear infinite", color: "var(--accent)" }} />
      </div>
    );
  }

  if (error || !room || !question) {
    return (
      <div style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, background: "var(--bg)" }}>
        <p style={{ color: "var(--ink-2)", fontSize: 14 }}>{error ?? "Question not found."}</p>
        <button onClick={() => router.push(`/arena/exam/${examId}`)} className="psp-btn psp-btn-secondary psp-btn-sm">Back to questions</button>
      </div>
    );
  }

  return (
    <FullscreenGate enabled={!isEnded}>
      <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
        {/* Top bar */}
        <div style={{
          height: 52, flexShrink: 0, display: "flex", alignItems: "center",
          padding: "0 20px", gap: 12, borderBottom: "1px solid var(--line)", background: "var(--bg-2)",
        }}>
          <button
            onClick={() => router.push(`/arena/exam/${examId}`)}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 8,
              background: "var(--surface)", border: "1px solid var(--line)",
              color: "var(--ink-2)", fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}
          >
            <ChevronLeft size={14} /> Back to questions
          </button>

          <div style={{ width: 1, height: 20, background: "var(--line)" }} />

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: MONO, fontSize: 12, fontWeight: 700,
              background: "var(--surface-2)", color: "var(--accent)", border: "1px solid var(--line)",
            }}>
              {question.label}
            </div>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{question.title}</span>
          </div>

          <div style={{ flex: 1 }} />

          {!isEnded && (
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: tabSwitches > 0 ? "var(--danger)" : "var(--ink-3)" }}>
              <AlertTriangle size={13} /> {tabSwitches} switch{tabSwitches === 1 ? "" : "es"}
            </span>
          )}
          <span style={{
            fontFamily: MONO, fontSize: 18, fontWeight: 700,
            color: remainingSecs < 300 && !isEnded ? "var(--danger)" : "var(--accent)",
          }}>
            {isEnded ? "00:00:00" : formatTime(remainingSecs)}
          </span>
        </div>

        {/* 2-column body */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <div style={{ width: "50%", display: "flex", flexDirection: "column", borderRight: "1px solid var(--line)", overflow: "hidden" }}>
            <div style={{ display: "flex", borderBottom: "1px solid var(--line)", padding: "0 20px", flexShrink: 0 }}>
              {(["description", "answers"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    padding: "12px 16px", fontSize: 13, fontWeight: 600, background: "none", border: "none", cursor: "pointer",
                    color: tab === t ? "var(--accent)" : "var(--ink-3)",
                    borderBottom: tab === t ? "2px solid var(--accent)" : "2px solid transparent",
                    marginBottom: -1,
                  }}
                >
                  {t === "description" ? "Question" : "My Answers"}
                </button>
              ))}
            </div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {tab === "description" ? (
                <QuestionStatement
                  problem={question}
                  currentIndex={questionIdx}
                  totalCount={room.problems.length}
                  onPrev={() => {}}
                  onNext={() => {}}
                  noun="Question"
                />
              ) : (
                <div style={{ padding: "20px 24px" }}>
                  <SubmissionsTab problemId={question.problemId} assessmentId={examId} />
                </div>
              )}
            </div>
          </div>

          <div style={{ width: "50%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <CodeWorkspace
              language={lang}
              onLanguageChange={(l) => { setLang(l); setCode(DEFAULT_CODE[l] ?? ""); }}
              code={code}
              onCodeChange={setCode}
              onSubmit={() => handleSubmit(false)}
              onRun={() => handleSubmit(true)}
              judging={judging}
              disabled={isEnded}
              results={results}
              verdict={verdict}
              totalCases={question.visibleTestCases.length + question.hiddenTestCaseCount}
              visibleCount={question.visibleTestCases.length}
              hideResults={!isEnded}
              submitted={!!question.solvedByCurrentUser}
              submitLabel="Submit answer"
              isEndedMessage={isEnded ? "This exam has ended." : undefined}
              blockedBanner={isEnded ? (
                <div style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "10px 14px",
                  borderRadius: 10, background: "var(--danger-soft)", color: "var(--danger-ink)", fontSize: 13, fontWeight: 600,
                }}>
                  This exam has ended.
                </div>
              ) : undefined}
            />
          </div>
        </div>
      </div>
    </FullscreenGate>
  );
}
