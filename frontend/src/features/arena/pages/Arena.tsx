"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { AlertTriangle, Clock, FileText, Play, ShieldAlert, List, Code2, Lock } from "lucide-react";
import { Client as StompClient } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import {
  submitCode, logCheatEvent, getExamRoom, getExamResults, getApiBaseUrl,
  verifyAssessmentAccessCode, ApiException,
  type ExamRoomDTO, type ExamProblemDTO, type ExamResultsDTO,
} from "@/lib/api";
import { useAuth } from "@/features/auth/contexts/AuthContext";
import { toast } from "@/components/ui/PSPToast";
import CodeWorkspace, {
  DEFAULT_WORKSPACE_CODE as DEFAULT_CODE,
  type WorkspaceTestResult,
  type WorkspaceVerdict,
} from "@/features/arena/components/CodeWorkspace";
import ArenaShell, { type ArenaTab } from "@/features/arena/components/ArenaShell";
import { type ViolationEvent } from "@/hooks/useAntiCheat";
import TaskRail, { type TaskRailItem } from "@/components/arena/TaskRail";
import QuestionStatement from "@/components/arena/exam/QuestionStatement";
import ExamResults from "@/components/arena/exam/ExamResults";

type Verdict = WorkspaceVerdict;
type TestResult = WorkspaceTestResult;

// The verified access code is cached per-assessment for the tab session only —
// never persisted, never sent anywhere except this assessment's own endpoints.
function accessCodeKey(examId: string) { return `arena_access_code_${examId}`; }
function getCachedAccessCode(examId: string): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(accessCodeKey(examId));
}
function setCachedAccessCode(examId: string, code: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(accessCodeKey(examId), code);
}

interface ArenaProps {
  examId?: string;
  mode?: "exam" | "practice" | "tp";
}

type Phase = "briefing" | "active";

export default function Arena({ examId, mode = "exam" }: ArenaProps) {
  const { userId } = useAuth();

  // Exam room data
  const [examRoom, setExamRoom]     = useState<ExamRoomDTO | null>(null);
  const [loading, setLoading]       = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);

  // Access-code gate — shown instead of the arena when the assessment requires
  // a code and none has been verified yet in this tab.
  const [needsAccessCode, setNeedsAccessCode] = useState(false);
  const [accessCode, setAccessCode]           = useState<string | null>(null);
  const [codeInput, setCodeInput]             = useState("");
  const [codeError, setCodeError]             = useState("");
  const [verifyingCode, setVerifyingCode]     = useState(false);

  // Countdown
  const [remainingSecs, setRemainingSecs] = useState(0);

  // UI state
  const [activeProblemIdx, setActiveProblemIdx] = useState(0);
  // Mobile single-column arena: which pane is visible via the bottom tab bar.
  const isMobile = useIsMobile(768);
  const [mobilePanel, setMobilePanel] = useState<"problems" | "statement" | "submit">("statement");
  const [lang, setLang]     = useState("java");
  const [code, setCode]     = useState(DEFAULT_CODE.java);
  const [judging, setJudging]   = useState(false);
  const [results, setResults]   = useState<TestResult[]>([]);
  const [verdict, setVerdict]   = useState<Verdict>(null);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [examResults, setExamResults] = useState<ExamResultsDTO | null>(null);
  const stompRef = useRef<StompClient | null>(null);

  // Entry-flow phase: briefing → active. Practice mode skips briefing.
  const [phase, setPhase] = useState<Phase>(mode === "practice" ? "active" : "briefing");
  const enforceLockdown   = mode === "exam";
  // Audit/anti-cheat logging runs for both exams and TPs (take-home TPs get the
  // same tab-switch/focus/copy-paste + multi-IP tracking, minus the fullscreen gate).
  const auditEnabled      = mode === "exam" || mode === "tp";

  // Load exam room. If the assessment requires an access code and none is
  // cached yet, show the code gate instead of a generic access-denied screen.
  useEffect(() => {
    if (!examId) {
      setAccessError("No exam ID provided.");
      setLoading(false);
      return;
    }
    const cached = getCachedAccessCode(examId) ?? undefined;
    getExamRoom(examId, cached)
      .then((data) => {
        setExamRoom(data);
        setRemainingSecs(data.remainingSeconds);
        if (cached) setAccessCode(cached);
      })
      .catch((err: unknown) => {
        const isBadCode = err instanceof ApiException && err.status === 403
          && /access code/i.test(err.message);
        if (isBadCode) {
          setNeedsAccessCode(true);
        } else {
          setAccessError(err instanceof Error ? err.message : "Failed to load exam.");
        }
      })
      .finally(() => setLoading(false));
  }, [examId]);

  async function handleAccessCodeSubmit() {
    if (!examId || !codeInput.trim()) return;
    setVerifyingCode(true);
    setCodeError("");
    try {
      await verifyAssessmentAccessCode(examId, codeInput.trim());
      setCachedAccessCode(examId, codeInput.trim());
      setAccessCode(codeInput.trim());
      setNeedsAccessCode(false);
      setLoading(true);
      const data = await getExamRoom(examId, codeInput.trim());
      setExamRoom(data);
      setRemainingSecs(data.remainingSeconds);
    } catch {
      setCodeError("Invalid access code — try again");
    } finally {
      setVerifyingCode(false);
      setLoading(false);
    }
  }

  // Start countdown once after exam room loads
  useEffect(() => {
    if (!examRoom || examRoom.isEnded || examRoom.remainingSeconds <= 0) return;
    const id = setInterval(() => setRemainingSecs((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [examRoom]);

  // Fetch post-exam results once the exam has ended and grades are revealed.
  useEffect(() => {
    if (mode !== "exam" || !examId || !examRoom) return;
    const ended = examRoom.isEnded || examRoom.remainingSeconds <= 0;
    if (!ended || !examRoom.gradesRevealed || examResults) return;
    getExamResults(examId)
      .then(setExamResults)
      .catch(() => {});
  }, [mode, examId, examRoom, examResults]);

  // Anti-cheat reporter (wired into ArenaShell.lockdown.onViolation below).
  // Reports every violation to the assessment audit endpoint; bumps the
  // tab-switch counter shown in the sidebar for visibility violations.
  const reportViolation = (event: ViolationEvent) => {
    if (!auditEnabled || !examId || !userId) return;
    if (event.type === "TAB_SWITCH") setTabSwitches((n) => n + 1);
    logCheatEvent({
      studentId:     userId,
      assessmentId:  examId,
      violationType: event.type,
    }).catch(() => {});
  };

  // Reset editor when switching problems
  useEffect(() => {
    setCode(DEFAULT_CODE[lang] ?? "");
    setResults([]);
    setVerdict(null);
  }, [activeProblemIdx]); // intentionally omit lang

  const activeProblem: ExamProblemDTO | null = examRoom?.problems[activeProblemIdx] ?? null;
  const isEnded  = (examRoom?.isEnded ?? false) || remainingSecs <= 0;
  const solvedCount = examRoom?.problems.filter((p) => p.solvedByCurrentUser).length ?? 0;

  const visibleCount = activeProblem?.visibleTestCases.length ?? 0;
  const hiddenCount  = activeProblem?.hiddenTestCaseCount ?? 0;
  const totalCases   = visibleCount + hiddenCount;

  // TP submission gating: closed after deadline or once per-problem attempts run out.
  const maxAttempts   = examRoom?.maxAttempts ?? null;
  const attemptsUsed  = activeProblem?.attemptsUsed ?? 0;
  const deadlinePassed = mode === "tp" && isEnded;
  const attemptsExhausted =
    mode === "tp" && maxAttempts != null && attemptsUsed >= maxAttempts;

  const handleLangChange = (newLang: string) => {
    setLang(newLang);
    setCode(DEFAULT_CODE[newLang] ?? "");
  };

  const handleSubmit = async (runOnly = false) => {
    if (!userId || !activeProblem || isEnded) return;
    setJudging(true);
    setVerdict("pending");
    setResults([]);

    try {
      const res = await submitCode({
        studentId: userId,
        problemId: activeProblem.problemId,
        assessmentId: examId,
        sourceCode: code,
        language: lang.toUpperCase(),
        runOnly,
        accessCode: accessCode ?? undefined,
      });

      const client = new StompClient({
        webSocketFactory: () =>
          new SockJS(`${getApiBaseUrl()}/ws-endpoint`),
        onConnect: () => {
          client.subscribe(`/topic/submissions/${res.submissionId}`, (frame) => {
            try {
              const data = JSON.parse(frame.body);

              // Two message shapes share this topic (see WebSocketSubmissionMessage
              // on the backend) — neither has a `testCaseResults` array, so this
              // must branch on `type` rather than reading a field that never exists.
              if (data.type === "TEST_CASE_RESULT") {
                const status: TestResult["status"] =
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
                const verdict: Verdict =
                  data.finalStatus === "PASS" ? "accepted"
                  : data.finalStatus === "TIME_OUT" ? "tle"
                  : data.finalStatus === "MEMORY_OUT" ? "mle"
                  : data.finalStatus === "RUNTIME_ERROR" ? "error"
                  : data.finalStatus === "COMPILATION_ERROR" ? "error"
                  : "wrong"; // FAIL
                setVerdict(verdict);
                setJudging(false);
                client.deactivate();
              }
            } catch (e) {
              console.error("STOMP parse error", e);
            }
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
            console.warn("Judge result never arrived within 30s for submission", res.submissionId);
            toast.warning(
              "Still waiting on the judge",
              "This is taking longer than expected. Your submission was recorded — try resubmitting in a moment if this persists."
            );
            return null;
          });
        }
      }, 30_000);
    } catch (e) {
      console.error("Submit error", e);
      setJudging(false);
      setVerdict(null);
    }
  };

  // ── Access-code gate ──────────────────────────────────────────────────────
  // Shown instead of everything else when the assessment requires a code the
  // student hasn't verified yet in this tab (direct-link entry, expired cache).
  if (needsAccessCode) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", background: "var(--bg)",
      }}>
        <div style={{
          background: "var(--surface)", border: "1px solid var(--line-2)",
          borderRadius: 16, padding: "40px 48px", width: 380,
          display: "flex", flexDirection: "column", gap: 20,
        }}>
          <div style={{ textAlign: "center" }}>
            <Lock size={32} style={{ color: "var(--accent)", marginBottom: 12 }} />
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, color: "var(--ink)" }}>
              Access code required
            </h2>
            <p style={{ fontSize: 13, color: "var(--ink-2)" }}>
              Enter the access code to continue
            </p>
          </div>

          <input
            type="text"
            placeholder="Access code"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAccessCodeSubmit()}
            style={{
              padding: "10px 14px", borderRadius: 10, fontSize: 14,
              background: "var(--bg-2)",
              border: `1px solid ${codeError ? "var(--danger)" : "var(--line-2)"}`,
              color: "var(--ink)", outline: "none", textAlign: "center",
              fontFamily: "var(--font-mono)", letterSpacing: "2px",
            }}
            autoFocus
          />

          {codeError && (
            <p style={{ fontSize: 12, color: "var(--danger)", textAlign: "center", marginTop: -12 }}>
              {codeError}
            </p>
          )}

          <button
            onClick={handleAccessCodeSubmit}
            disabled={verifyingCode || !codeInput.trim()}
            style={{
              padding: "11px 0", borderRadius: 10, fontWeight: 700,
              fontSize: 14, background: "var(--accent)", color: "#0a0a0a",
              border: "none", cursor: verifyingCode ? "default" : "pointer",
              opacity: verifyingCode || !codeInput.trim() ? 0.6 : 1,
            }}
          >
            {verifyingCode ? "Checking…" : "Enter"}
          </button>
        </div>
      </div>
    );
  }

  // ── Briefing screen (Exam/TP entry gate) ─────────────────────────────────
  if (!loading && !accessError && examRoom && phase === "briefing") {
    return (
      <BriefingScreen
        title={examRoom.title}
        problemCount={examRoom.problems.length}
        durationSeconds={examRoom.remainingSeconds}
        isEnded={examRoom.isEnded}
        enforceLockdown={enforceLockdown}
        onEnter={() => setPhase("active")}
      />
    );
  }

  const problems = examRoom?.problems ?? [];
  const taskRailItems: TaskRailItem[] = problems.map((p) => ({
    id: p.problemId,
    label: p.label,
    title: p.title,
    points: p.points,
    status: p.solvedByCurrentUser ? "solved" : (p.attemptsUsed ?? 0) > 0 ? "attempted" : "unsolved",
    meta: !p.solvedByCurrentUser && (p.attemptsUsed ?? 0) > 0 ? `×${p.attemptsUsed}` : undefined,
  }));

  // Live exams hide verdicts/scores until the exam closes; TP & practice show
  // results live. The submitted banner reflects a prior accepted submission.
  const hideResults = mode === "exam" && !isEnded;
  const nounSingular = mode === "tp" ? "Task" : "Question";

  // ── Responsive pane styles (desktop 3-column; mobile = single column) ─────
  const leftPaneStyle: React.CSSProperties = {
    display: "flex", flexDirection: "column",
    ...(isMobile
      ? { width: "100%", flex: 1, minHeight: 0, ...(mobilePanel !== "problems" ? { display: "none" } : {}) }
      : { width: 220, flexShrink: 0 }),
  };
  const centerPaneStyle: React.CSSProperties = {
    display: "flex", flexDirection: "column", minHeight: 0,
    ...(isMobile
      ? { width: "100%", flex: 1, ...(mobilePanel !== "statement" ? { display: "none" } : {}) }
      : { flex: 1 }),
  };
  const rightPaneStyle: React.CSSProperties = {
    display: "flex", minHeight: 0,
    ...(isMobile
      ? { width: "100%", flex: 1, ...(mobilePanel !== "submit" ? { display: "none" } : {}) }
      : { width: 420, flexShrink: 0 }),
  };

  // ── Workspace tab content (3-pane on desktop, tabbed single-column on mobile) ─
  const workspaceContent = (
    <div style={{
      display: "flex", flex: 1, overflow: "hidden", background: "var(--bg)",
      ...(isMobile ? { flexDirection: "column", paddingBottom: 52 } : {}),
    }}>

      {/* Left: problem/task navigator */}
      <div style={leftPaneStyle}>
        <TaskRail
          items={taskRailItems}
          activeIndex={activeProblemIdx}
          onSelect={(i) => { setActiveProblemIdx(i); if (isMobile) setMobilePanel("statement"); }}
          heading={mode === "tp" ? "TASKS" : "QUESTIONS"}
        />
      </div>

      {/* Center: problem statement */}
      <div style={centerPaneStyle}>
        <QuestionStatement
          problem={activeProblem}
          currentIndex={activeProblemIdx}
          totalCount={problems.length}
          onPrev={() => setActiveProblemIdx((i) => Math.max(0, i - 1))}
          onNext={() => setActiveProblemIdx((i) => Math.min(problems.length - 1, i + 1))}
          noun={nounSingular}
        />
      </div>

      {/* Right: editor + results / submit */}
      <div style={rightPaneStyle}>
        <CodeWorkspace
          language={lang}
          onLanguageChange={handleLangChange}
          code={code}
          onCodeChange={setCode}
          onRun={() => handleSubmit(true)}
          onSubmit={() => handleSubmit(false)}
          judging={judging}
          disabled={isEnded}
          results={results}
          verdict={verdict}
          totalCases={totalCases}
          visibleCount={visibleCount}
          isEndedMessage={isEnded ? "This session has ended." : undefined}
          hideResults={hideResults}
          submitted={!!activeProblem?.solvedByCurrentUser}
          runLabel="Run sample"
          submitLabel={mode === "tp" ? "Submit" : "Submit answer"}
          blockedBanner={
            deadlinePassed ? (
              <div style={blockBannerStyle("danger")}>
                Deadline has passed — submissions are closed.
              </div>
            ) : attemptsExhausted ? (
              <div style={blockBannerStyle("warn")}>
                Maximum attempts reached ({maxAttempts} / {maxAttempts}).
              </div>
            ) : undefined
          }
        />
      </div>

        {/* Mobile bottom tab bar — Problems / Statement / Submit */}
        {isMobile && (
          <div style={{
            position: "fixed", bottom: 0, left: 0, right: 0, height: 52, zIndex: 60,
            background: "var(--surface)", borderTop: "1px solid var(--line)", display: "flex",
          }}>
            {([
              { key: "problems" as const,  label: "Problems",  icon: <List size={18} /> },
              { key: "statement" as const, label: "Statement", icon: <FileText size={18} /> },
              { key: "submit" as const,    label: "Submit",    icon: <Code2 size={18} /> },
            ]).map(t => {
              const on = mobilePanel === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setMobilePanel(t.key)}
                  style={{
                    flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
                    justifyContent: "center", gap: 3, background: "none", cursor: "pointer",
                    color: on ? "var(--brand-2)" : "var(--ink-3)",
                    borderTop: on ? "2px solid var(--brand)" : "2px solid transparent",
                    borderLeft: "none", borderRight: "none", borderBottom: "none",
                    font: "600 11px var(--font)",
                  }}
                >
                  {t.icon}
                  {t.label}
                </button>
              );
            })}
          </div>
        )}
    </div>
  );

  // Post-exam results replace the workspace once grades are revealed.
  const showResults = mode === "exam" && isEnded && !!examResults;

  const tabs: ArenaTab[] = [
    {
      key: "workspace",
      label: "Workspace",
      icon: <FileText size={14} />,
      content: showResults ? <ExamResults data={examResults!} /> : workspaceContent,
    },
  ];

  const answeredWord = mode === "exam" ? "answered" : "solved";
  const progressPct = problems.length > 0 ? (solvedCount / problems.length) * 100 : 0;

  // Progress block for the top bar (matches reference .tb-prog).
  const progressExtras = problems.length > 0 && !isEnded ? (
    <div style={{
      display: "flex", alignItems: "center", gap: 11,
      padding: "0 18px", borderRight: "1px solid var(--line-2)", flex: "none",
    }}>
      <span style={{ font: "600 12px var(--font)", color: "var(--ink-2)", whiteSpace: "nowrap" }}>
        {solvedCount} / {problems.length} {answeredWord}
      </span>
      <div style={{ width: 80, height: 4, borderRadius: 4, background: "rgba(255,255,255,.07)", overflow: "hidden", flex: "none" }}>
        <div style={{ height: "100%", width: `${progressPct}%`, background: "var(--accent)", borderRadius: 4, boxShadow: "0 0 8px rgba(0,255,0,.5)" }} />
      </div>
    </div>
  ) : undefined;

  // Anti-cheat status (exam only — TP has no lockdown).
  const antiCheatExtras = enforceLockdown && !isEnded ? (
    <div style={{
      display: "flex", alignItems: "center", gap: 6, padding: "0 14px",
      font: "500 12px var(--font)", color: tabSwitches > 0 ? "var(--danger)" : "var(--ink-3)",
    }}>
      <AlertTriangle size={13} /> Anti-cheat · {tabSwitches} switch{tabSwitches === 1 ? "" : "es"}
    </div>
  ) : undefined;

  // TP top bar: amber deadline + per-problem attempts counter (no anti-cheat, no countdown).
  const tpExtras = mode === "tp" && !isEnded ? (
    <>
      {examRoom?.deadline && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6, padding: "0 16px",
          borderLeft: "1px solid var(--line-2)", font: "600 13px var(--font-mono)", color: "var(--warn)",
        }}>
          <Clock size={14} /> Due {formatDeadline(examRoom.deadline)}
        </div>
      )}
      {maxAttempts != null && (
        <div style={{
          display: "flex", alignItems: "center", padding: "0 16px",
          borderLeft: "1px solid var(--line-2)", font: "500 12px var(--font)", color: "var(--ink-3)",
        }}>
          {attemptsUsed} / {maxAttempts} attempts
        </div>
      )}
    </>
  ) : undefined;

  const subtitle = isEnded
    ? (mode === "tp" ? "TP closed" : "Exam closed")
    : mode === "tp" ? "Take-home TP" : mode === "practice" ? "Practice" : "Live Exam";

  return (
    <ArenaShell
      title={examRoom?.title ?? "Exam"}
      subtitle={subtitle}
      leftExtras={progressExtras}
      topBarExtras={mode === "tp" ? tpExtras : antiCheatExtras}
      backHref="/assessments"
      backLabel={mode === "tp" ? "Leave TP" : mode === "practice" ? "Leave" : "Leave Exam"}
      // Hide the big countdown for TPs (deadline shown instead) and on the results view.
      remainingSeconds={mode === "tp" || showResults ? 0 : remainingSecs}
      isEnded={isEnded && !showResults}
      endedMessage={mode === "tp" ? "This TP is closed. Submissions are no longer accepted." : undefined}
      loading={loading}
      loadingMessage="Loading…"
      accessError={accessError}
      lockdown={
        enforceLockdown
          ? {
              fullscreen:  true,
              antiCheat:   true,
              contextId:   examId,
              auditDomain: "EXAM",
              onViolation: reportViolation,
            }
          : mode === "tp"
            // TP: audit logging without the fullscreen lockdown gate.
            ? {
                antiCheat:   true,
                contextId:   examId,
                auditDomain: "TP",
                onViolation: reportViolation,
              }
            : undefined
      }
      tabs={tabs}
    />
  );
}

// Block-banner style for TP deadline/attempts messages.
function blockBannerStyle(tone: "danger" | "warn"): React.CSSProperties {
  const color = tone === "danger" ? "var(--danger-ink)" : "var(--warn)";
  const bg = tone === "danger" ? "var(--danger-soft)" : "var(--warn-soft)";
  const border = tone === "danger" ? "rgba(240,99,122,.25)" : "rgba(232,160,48,.25)";
  return {
    textAlign: "center",
    font: "600 12.5px var(--font)",
    color,
    background: bg,
    border: `1px solid ${border}`,
    borderRadius: 9,
    padding: "11px 14px",
  };
}

// "in 2d 4h" / "in 3h 20m" / "Jul 8" style relative deadline.
function formatDeadline(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const diffMs = d.getTime() - Date.now();
  if (diffMs <= 0) return "now";
  const mins = Math.floor(diffMs / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days >= 1) return `in ${days}d ${hrs % 24}h`;
  if (hrs >= 1) return `in ${hrs}h ${mins % 60}m`;
  return `in ${mins}m`;
}

// ── Briefing screen ──────────────────────────────────────────────────────────

function BriefingScreen({
  title, problemCount, durationSeconds, isEnded, enforceLockdown, onEnter,
}: {
  title:            string;
  problemCount:     number;
  durationSeconds:  number;
  isEnded:          boolean;
  enforceLockdown:  boolean;
  onEnter:          () => void;
}) {
  const mins = Math.floor(Math.max(0, durationSeconds) / 60);
  return (
    <div style={{
      height: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg)", color: "var(--ink)",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    }}>
      <div style={{
        background: "var(--bg-2)", borderRadius: 10, padding: "32px 36px",
        maxWidth: 480, width: "100%", boxShadow: "0 16px 40px rgba(0,0,0,0.4)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <div style={{
            width: 36, height: 36, background: "var(--brand)", borderRadius: 6,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "white", fontWeight: 900, fontSize: 16,
          }}>P</div>
          <div>
            <div style={{ fontSize: 11, color: "var(--ink-2)", textTransform: "uppercase", letterSpacing: 0.6 }}>
              Entering arena
            </div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{title}</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
          <Stat label="Problems" value={String(problemCount)} />
          <Stat label="Duration" value={mins > 0 ? `${mins} min` : "—"} />
        </div>

        {enforceLockdown && (
          <div style={{
            background: "rgba(222,53,11,0.12)", border: "1px solid rgba(222,53,11,0.4)",
            borderRadius: 6, padding: "10px 12px", marginBottom: 18,
            display: "flex", gap: 10, alignItems: "flex-start",
          }}>
            <ShieldAlert size={16} color="var(--danger-ink)" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 12, lineHeight: 1.55, color: "var(--danger-soft)" }}>
              <strong style={{ color: "var(--danger-soft)" }}>Anti-cheat is active.</strong>{" "}
              Fullscreen is required. Tab switches, copy/paste outside the editor,
              dev-tools shortcuts, and right-click are logged as violations.
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onEnter}
          disabled={isEnded}
          style={{
            width: "100%", height: 42,
            background: isEnded ? "var(--line-strong)" : "var(--brand)",
            color: "white", border: "none", borderRadius: 6,
            fontSize: 14, fontWeight: 700,
            cursor: isEnded ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          <Play size={14} />
          {isEnded ? "Session has ended" : "Enter Arena"}
        </button>

        <div style={{ textAlign: "center", marginTop: 12 }}>
          <Link href="/assessments" style={{
            fontSize: 12, color: "var(--ink-2)", textDecoration: "none",
          }}>
            ← Back to Exams &amp; TPs
          </Link>
        </div>
      </div>
    </div>
  );
}

// Tracks whether the viewport is at/below a mobile breakpoint (client-only).
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [breakpoint]);
  return isMobile;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 6, padding: "10px 12px",
    }}>
      <div style={{ fontSize: 10, color: "var(--ink-2)", textTransform: "uppercase", letterSpacing: 0.6 }}>
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", marginTop: 2 }}>
        {value}
      </div>
    </div>
  );
}
