"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Clock } from "lucide-react";
import { Client as StompClient } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { submitCode, getApiBaseUrl } from "@/lib/api";
import { useAuth } from "@/features/auth/contexts/AuthContext";
import { toast } from "@/components/ui/PSPToast";
import CodeWorkspace, {
  DEFAULT_WORKSPACE_CODE as DEFAULT_CODE,
  type WorkspaceTestResult, type WorkspaceVerdict,
} from "@/features/arena/components/CodeWorkspace";
import QuestionStatement from "@/components/arena/exam/QuestionStatement";
import SubmissionsTab from "@/features/arena/tp/SubmissionsTab";
import { formatDeadline } from "@/features/arena/tp/tpShared";
import { useTPSession } from "@/features/arena/tp/TPSessionContext";

const MONO = "var(--font-mono), ui-monospace, monospace";

export default function TPTaskPage({ tpId, taskId }: { tpId: string; taskId: string }) {
  const router = useRouter();
  const { userId } = useAuth();
  const { room, reload } = useTPSession();

  const [tab, setTab] = useState<"description" | "submissions">("description");
  const [lang, setLang] = useState("java");
  const [code, setCode] = useState(DEFAULT_CODE.java);
  const [judging, setJudging] = useState(false);
  const [results, setResults] = useState<WorkspaceTestResult[]>([]);
  const [verdict, setVerdict] = useState<WorkspaceVerdict>(null);
  const stompRef = useRef<StompClient | null>(null);

  const problem = room.problems.find((p) => p.problemId === taskId) ?? null;
  const problemIdx = room.problems.findIndex((p) => p.problemId === taskId);
  const isLocked = !!room.finalSubmittedAt;
  const isPastDeadline = !!room.deadline && new Date() > new Date(room.deadline);
  const maxAttempts = room.maxAttempts ?? null;
  const attemptsUsed = problem?.attemptsUsed ?? 0;
  const attemptsExhausted = maxAttempts != null && attemptsUsed >= maxAttempts;
  const submitDisabled = isLocked || isPastDeadline || attemptsExhausted;

  useEffect(() => {
    setCode(DEFAULT_CODE[lang] ?? "");
    setResults([]);
    setVerdict(null);
  }, [taskId]); // eslint-disable-line react-hooks/exhaustive-deps

  function goToTask(idx: number) {
    const target = room.problems[idx];
    if (target) router.push(`/arena/tp/${tpId}/task/${target.problemId}`);
  }

  async function handleSubmit(runOnly = false) {
    if (!userId || !problem || submitDisabled) return;
    setJudging(true);
    setVerdict("pending");
    setResults([]);

    try {
      const res = await submitCode({
        studentId: userId,
        problemId: problem.problemId,
        assessmentId: tpId,
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
                if (!runOnly) reload(); // refresh attempts/earnedScore
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

  if (!problem) {
    return (
      <div style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, background: "var(--bg)" }}>
        <p style={{ color: "var(--ink-2)", fontSize: 14 }}>Task not found.</p>
        <button onClick={() => router.push(`/arena/tp/${tpId}`)} className="psp-btn psp-btn-secondary psp-btn-sm">
          Back to tasks
        </button>
      </div>
    );
  }

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
      {/* Top bar */}
      <div style={{
        height: 52, flexShrink: 0, display: "flex", alignItems: "center",
        padding: "0 20px", gap: 12, borderBottom: "1px solid var(--line)", background: "var(--bg-2)",
      }}>
        <button
          onClick={() => router.push(`/arena/tp/${tpId}`)}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 8,
            background: "var(--surface)", border: "1px solid var(--line)",
            color: "var(--ink-2)", fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}
        >
          <ChevronLeft size={14} /> Back to tasks
        </button>

        <div style={{ width: 1, height: 20, background: "var(--line)" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: MONO, fontSize: 12, fontWeight: 700,
            background: "var(--surface-2)", color: "var(--accent)", border: "1px solid var(--line)",
          }}>
            {problem.label}
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{problem.title}</span>
        </div>

        <div style={{ flex: 1 }} />

        <span style={{ fontFamily: MONO, fontSize: 12, color: "var(--ink-3)" }}>
          {attemptsUsed} / {maxAttempts ?? "∞"} attempts
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: MONO, fontSize: 12, color: "var(--warn)" }}>
          <Clock size={12} /> Due {formatDeadline(room.deadline)}
        </span>
      </div>

      {/* 2-column body */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* LEFT — Description / My Submissions */}
        <div style={{ width: "50%", display: "flex", flexDirection: "column", borderRight: "1px solid var(--line)", overflow: "hidden" }}>
          <div style={{ display: "flex", borderBottom: "1px solid var(--line)", padding: "0 20px", flexShrink: 0 }}>
            {(["description", "submissions"] as const).map((t) => (
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
                {t === "description" ? "Description" : "My Submissions"}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {tab === "description" ? (
              <QuestionStatement
                problem={problem}
                currentIndex={problemIdx}
                totalCount={room.problems.length}
                onPrev={() => goToTask(problemIdx - 1)}
                onNext={() => goToTask(problemIdx + 1)}
                noun="Task"
              />
            ) : (
              <div style={{ padding: "20px 24px" }}>
                <SubmissionsTab problemId={problem.problemId} assessmentId={tpId} />
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — Editor + results */}
        <div style={{ width: "50%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <CodeWorkspace
            language={lang}
            onLanguageChange={(l) => { setLang(l); setCode(DEFAULT_CODE[l] ?? ""); }}
            code={code}
            onCodeChange={setCode}
            onSubmit={() => handleSubmit(false)}
            onRun={() => handleSubmit(true)}
            judging={judging}
            disabled={submitDisabled}
            results={results}
            verdict={verdict}
            totalCases={problem.visibleTestCases.length + problem.hiddenTestCaseCount}
            visibleCount={problem.visibleTestCases.length}
            submitLabel="Submit"
            blockedBanner={submitDisabled ? (
              <div style={{
                display: "flex", alignItems: "center", gap: 8, padding: "10px 14px",
                borderRadius: 10, background: "var(--danger-soft)", color: "var(--danger-ink)", fontSize: 13, fontWeight: 600,
              }}>
                {isLocked ? "This TP has been submitted — no further changes allowed."
                  : isPastDeadline ? "Deadline has passed."
                  : "Maximum attempts reached."}
              </div>
            ) : undefined}
          />
        </div>
      </div>
    </div>
  );
}
