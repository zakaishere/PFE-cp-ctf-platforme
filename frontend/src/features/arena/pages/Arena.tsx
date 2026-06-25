"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock, FileText, Lock, Play, ShieldAlert, List, Code2 } from "lucide-react";
import { Client as StompClient } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import {
  submitCode, logCheatEvent, getExamRoom, getApiBaseUrl,
  type ExamRoomDTO, type ExamProblemDTO,
} from "@/lib/api";
import { useAuth } from "@/features/auth/contexts/AuthContext";
import CodeWorkspace, {
  DEFAULT_WORKSPACE_CODE as DEFAULT_CODE,
  type WorkspaceTestResult,
  type WorkspaceVerdict,
} from "@/features/arena/components/CodeWorkspace";
import ArenaShell, { type ArenaTab } from "@/features/arena/components/ArenaShell";
import { type ViolationEvent } from "@/hooks/useAntiCheat";

const DIFF_STYLE: Record<string, { bg: string; color: string }> = {
  EASY:   { bg: "var(--success-soft)", color: "var(--success-ink)" },
  MEDIUM: { bg: "var(--warn-soft)", color: "var(--warn-ink)" },
  HARD:   { bg: "var(--danger-soft)", color: "var(--danger-ink)" },
};

type Verdict = WorkspaceVerdict;
type TestResult = WorkspaceTestResult;

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
  const stompRef = useRef<StompClient | null>(null);

  // Entry-flow phase: briefing → active. Practice mode skips briefing.
  const [phase, setPhase] = useState<Phase>(mode === "practice" ? "active" : "briefing");
  const enforceLockdown   = mode === "exam";

  // Load exam room
  useEffect(() => {
    if (!examId) {
      setAccessError("No exam ID provided.");
      setLoading(false);
      return;
    }
    getExamRoom(examId)
      .then((data) => {
        setExamRoom(data);
        setRemainingSecs(data.remainingSeconds);
      })
      .catch((err: Error) => {
        setAccessError(err.message || "Failed to load exam.");
      })
      .finally(() => setLoading(false));
  }, [examId]);

  // Start countdown once after exam room loads
  useEffect(() => {
    if (!examRoom || examRoom.isEnded || examRoom.remainingSeconds <= 0) return;
    const id = setInterval(() => setRemainingSecs((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [examRoom]);

  // Anti-cheat reporter (wired into ArenaShell.lockdown.onViolation below).
  // Reports every violation to the assessment audit endpoint; bumps the
  // tab-switch counter shown in the sidebar for visibility violations.
  const reportViolation = (event: ViolationEvent) => {
    if (!enforceLockdown || !examId || !userId) return;
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

  const diff      = activeProblem?.difficulty ?? "";
  const diffStyle = DIFF_STYLE[diff] ?? { bg: "var(--surface-2)", color: "var(--text-muted)" };
  const diffLabel = diff ? diff.charAt(0) + diff.slice(1).toLowerCase() : "";
  const visibleCount = activeProblem?.visibleTestCases.length ?? 0;
  const hiddenCount  = activeProblem?.hiddenTestCaseCount ?? 0;
  const totalCases   = visibleCount + hiddenCount;

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
      });

      const client = new StompClient({
        webSocketFactory: () =>
          new SockJS(`${getApiBaseUrl()}/ws-endpoint`),
        onConnect: () => {
          client.subscribe(`/topic/submissions/${res.submissionId}`, (frame) => {
            try {
              const data = JSON.parse(frame.body);
              const testResults: TestResult[] = (data.testCaseResults || []).map(
                (r: any, i: number) => ({
                  idx: i,
                  status: r.status === "PASS" ? "pass" : r.status === "TIMEOUT" ? "tle" : "fail",
                  executionTimeMs: r.executionTimeMs,
                })
              );
              setResults(testResults);
              const allPassed = testResults.length > 0 && testResults.every((r) => r.status === "pass");
              const hasTle    = testResults.some((r) => r.status === "tle");
              setVerdict(hasTle ? "tle" : allPassed ? "accepted" : "wrong");
              setJudging(false);
              client.deactivate();
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
          setVerdict((v) => (v === "pending" ? "wrong" : v));
        }
      }, 30_000);
    } catch (e) {
      console.error("Submit error", e);
      setJudging(false);
      setVerdict(null);
    }
  };

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

  // ── Responsive pane styles (desktop unchanged; mobile = single column) ─────
  const leftPaneStyle: React.CSSProperties = {
    background: "var(--line)", display: "flex", flexDirection: "column",
    ...(isMobile
      ? { width: "100%", flex: 1, minHeight: 0, ...(mobilePanel !== "problems" ? { display: "none" } : {}) }
      : { width: 240, flexShrink: 0, borderRight: "1px solid var(--ink-2)" }),
  };
  const centerPaneStyle: React.CSSProperties = {
    background: "var(--bg-primary)", display: "flex", flexDirection: "column", overflowY: "auto",
    ...(isMobile
      ? { width: "100%", flex: 1, minHeight: 0, ...(mobilePanel !== "statement" ? { display: "none" } : {}) }
      : { flex: 1, borderRight: "1px solid var(--border)" }),
  };
  const rightPaneStyle: React.CSSProperties = {
    display: "flex",
    ...(isMobile
      ? { width: "100%", flex: 1, minHeight: 0, ...(mobilePanel !== "submit" ? { display: "none" } : {}) }
      : { width: 480, flexShrink: 0 }),
  };

  // ── Workspace tab content (3-pane on desktop, tabbed single-column on mobile) ─
  const workspaceContent = (
    <div style={{
      display: "flex", flex: 1, overflow: "hidden",
      ...(isMobile ? { flexDirection: "column", paddingBottom: 52 } : {}),
    }}>

      {/* Left: problem list + progress */}
      <div style={leftPaneStyle}>
          <div style={{ padding: 12, flex: 1, overflowY: "auto" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
              Problems
            </div>
            {problems.length === 0 ? (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", padding: "6px 0" }}>
                No problems assigned.
              </div>
            ) : (
              problems.map((p, i) => (
                <div
                  key={p.problemId}
                  onClick={() => { setActiveProblemIdx(i); if (isMobile) setMobilePanel("statement"); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 10px", borderRadius: 3, cursor: "pointer", marginBottom: 3,
                    background: activeProblemIdx === i ? "var(--brand)" : "transparent",
                  }}
                >
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                    background: p.solvedByCurrentUser ? "var(--success)" : "var(--ink-3)",
                  }} />
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", fontWeight: 500, flex: 1 }}>
                    {p.label}. {p.title}
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>{p.points} pts</div>
                </div>
              ))
            )}
          </div>

          <div style={{ padding: 12, borderTop: "1px solid var(--ink-2)" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Progress</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>{solvedCount} / {problems.length} solved</div>
            <div style={{ background: "var(--ink-2)", height: 4, borderRadius: 2, marginTop: 6 }}>
              <div style={{ background: "var(--brand)", height: 4, borderRadius: 2, width: problems.length > 0 ? `${(solvedCount / problems.length) * 100}%` : "0%" }} />
            </div>
          </div>

          <div style={{ padding: "8px 12px", borderTop: "1px solid var(--ink-2)" }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 2, display: "flex", alignItems: "center", gap: 4 }}>
              <AlertTriangle size={11} /> Anti-cheat active
            </div>
            <div style={{ fontSize: 11, color: tabSwitches > 0 ? "var(--danger)" : "rgba(255,255,255,0.4)" }}>
              Tab switches: {tabSwitches}
            </div>
          </div>
        </div>

        {/* Center: problem statement */}
        <div style={centerPaneStyle}>
          {!activeProblem ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              Select a problem from the left panel.
            </div>
          ) : (
            <>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
                  {activeProblem.label}. {activeProblem.title}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  <span style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 3, padding: "2px 8px", fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                    <Clock size={11} /> {activeProblem.timeLimitMs} ms
                  </span>
                  <span style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 3, padding: "2px 8px", fontSize: 11, color: "var(--text-muted)" }}>
                    {activeProblem.memoryLimitMb} MB
                  </span>
                  {diff && (
                    <span style={{ background: diffStyle.bg, border: "1px solid var(--border)", borderRadius: 3, padding: "2px 8px", fontSize: 11, color: diffStyle.color, fontWeight: 600 }}>
                      {diffLabel}
                    </span>
                  )}
                  <span style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 3, padding: "2px 8px", fontSize: 11, color: "var(--text-muted)" }}>
                    {activeProblem.points} pts
                  </span>
                  {activeProblem.solvedByCurrentUser && (
                    <span style={{ display: "flex", alignItems: "center", gap: 4, background: "var(--green-light)", border: "1px solid var(--border)", borderRadius: 3, padding: "2px 8px", fontSize: 11, color: "var(--success-ink)", fontWeight: 600 }}>
                      <CheckCircle2 size={10} /> Solved
                    </span>
                  )}
                </div>
              </div>

              <div style={{ padding: "16px 20px", fontSize: 13, lineHeight: 1.75 }}>
                {activeProblem.description ? (
                  activeProblem.description.split("\n").map((line, i) => (
                    <p key={i} style={{ marginBottom: 4 }}>{line || <>&nbsp;</>}</p>
                  ))
                ) : (
                  <p style={{ color: "var(--text-subtle)" }}>No description provided.</p>
                )}

                {activeProblem.visibleTestCases.length > 0 && (
                  <>
                    <h4 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-muted)", margin: "20px 0 8px" }}>
                      Sample Test Cases
                    </h4>
                    {activeProblem.visibleTestCases.map((tc, i) => (
                      <div key={tc.id} style={{ marginBottom: 8 }}>
                        <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "3px 3px 0 0", padding: "8px 12px", fontFamily: "monospace", fontSize: 12 }}>
                          <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Input</div>
                          <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{tc.input}</pre>
                        </div>
                        <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderTop: "none", borderRadius: "0 0 3px 3px", padding: "8px 12px", fontFamily: "monospace", fontSize: 12 }}>
                          <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Expected Output</div>
                          <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{tc.expectedOutput}</pre>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {activeProblem.hiddenTestCaseCount > 0 && (
                  <>
                    <h4 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-muted)", margin: "20px 0 8px" }}>
                      Hidden Test Cases
                    </h4>
                    {Array.from({ length: activeProblem.hiddenTestCaseCount }).map((_, i) => (
                      <div key={i} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 3, padding: "7px 12px", fontSize: 12, color: "var(--text-subtle)", display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                        <Lock size={11} /> Hidden test case {i + 1}
                      </div>
                    ))}
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* Right: editor + results */}
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
            isEndedMessage={isEnded ? "This exam has ended." : undefined}
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

  const tabs: ArenaTab[] = [
    {
      key: "workspace",
      label: "Workspace",
      icon: <FileText size={14} />,
      content: workspaceContent,
    },
  ];

  return (
    <ArenaShell
      title={examRoom?.title ?? "Exam"}
      backHref="/assessments"
      backLabel="Leave Exam"
      remainingSeconds={remainingSecs}
      isEnded={isEnded}
      loading={loading}
      loadingMessage="Loading exam…"
      accessError={accessError}
      lockdown={enforceLockdown ? {
        fullscreen:  true,
        antiCheat:   true,
        contextId:   examId,
        onViolation: reportViolation,
      } : undefined}
      tabs={tabs}
    />
  );
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
