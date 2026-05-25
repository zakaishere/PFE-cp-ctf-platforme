"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Play, Send, Lock, AlertTriangle, CheckCircle2, XCircle, Clock, Loader2,
} from "lucide-react";
import { Client as StompClient } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import {
  submitCode, logCheatEvent, getExamRoom, getApiBaseUrl,
  type ExamRoomDTO, type ExamProblemDTO,
} from "@/lib/api";
import { useAuth } from "@/features/auth/contexts/AuthContext";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

const DEFAULT_CODE: Record<string, string> = {
  java:       `import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // TODO: solve here\n    }\n}`,
  python:     `import sys\ninput = sys.stdin.readline\n\ndef solve():\n    pass\n\nsolve()`,
  cpp:        `#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios_base::sync_with_stdio(false);\n    cin.tie(NULL);\n    // TODO: solve here\n    return 0;\n}`,
  c:          `#include <stdio.h>\n\nint main() {\n    // TODO: solve here\n    return 0;\n}`,
  javascript: `const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n');\n// TODO: solve here`,
};

const DIFF_STYLE: Record<string, { bg: string; color: string }> = {
  EASY:   { bg: "#e3fcef", color: "#006644" },
  MEDIUM: { bg: "#fffae6", color: "#974f0c" },
  HARD:   { bg: "#ffebe6", color: "#bf2600" },
};

type Verdict = "pending" | "accepted" | "wrong" | "tle" | null;
interface TestResult { idx: number; status: "pass" | "fail" | "tle" | null; executionTimeMs?: number; }

function formatTime(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

interface ArenaProps {
  examId?: string;
  mode?: "exam" | "practice" | "tp";
}

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
  const [lang, setLang]     = useState("java");
  const [code, setCode]     = useState(DEFAULT_CODE.java);
  const [judging, setJudging]   = useState(false);
  const [results, setResults]   = useState<TestResult[]>([]);
  const [verdict, setVerdict]   = useState<Verdict>(null);
  const [tabSwitches, setTabSwitches] = useState(0);
  const stompRef = useRef<StompClient | null>(null);

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

  // Anti-cheat: log tab visibility changes
  useEffect(() => {
    if (mode !== "exam" || !examId || !userId) return;
    const onVis = () => {
      if (document.hidden) {
        setTabSwitches((n) => {
          const next = n + 1;
          logCheatEvent({ studentId: userId, assessmentId: examId, violationType: "TAB_SWITCH" }).catch(() => {});
          return next;
        });
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [mode, examId, userId]);

  // Reset editor when switching problems
  useEffect(() => {
    setCode(DEFAULT_CODE[lang] ?? "");
    setResults([]);
    setVerdict(null);
  }, [activeProblemIdx]); // intentionally omit lang

  const activeProblem: ExamProblemDTO | null = examRoom?.problems[activeProblemIdx] ?? null;
  const isEnded  = (examRoom?.isEnded ?? false) || remainingSecs <= 0;
  const isUrgent = remainingSecs > 0 && remainingSecs < 600;
  const timerStr = formatTime(remainingSecs);
  const solvedCount = examRoom?.problems.filter((p) => p.solvedByCurrentUser).length ?? 0;

  const diff      = activeProblem?.difficulty ?? "";
  const diffStyle = DIFF_STYLE[diff] ?? { bg: "#f4f5f7", color: "var(--text-muted)" };
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

  // ── Full-screen loading ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{
        height: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "#172b4d", flexDirection: "column", gap: 12,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}>
        <Loader2 size={28} style={{ animation: "spin 1s linear infinite", color: "#0052cc" }} />
        <div style={{ fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,0.8)" }}>Loading exam…</div>
      </div>
    );
  }

  // ── Access / not-found error ──────────────────────────────────────────────
  if (accessError) {
    return (
      <div style={{
        height: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "#172b4d", flexDirection: "column", gap: 12,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}>
        <div style={{ fontSize: 36 }}>🔒</div>
        <div style={{ fontWeight: 700, fontSize: 16, color: "white" }}>Access Denied</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", maxWidth: 360, textAlign: "center" }}>
          {accessError}
        </div>
        <Link href="/assessments" style={{
          marginTop: 8, background: "#0052cc", color: "white", borderRadius: 3,
          padding: "8px 18px", fontSize: 13, fontWeight: 600, textDecoration: "none",
        }}>
          Back to Assessments
        </Link>
      </div>
    );
  }

  const problems = examRoom?.problems ?? [];

  return (
    <div style={{
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      color: "var(--text-primary)", height: "100vh", overflow: "hidden", display: "flex", flexDirection: "column",
    }}>

      {/* ── Top bar ── */}
      <div style={{
        background: "#172b4d", height: 44, display: "flex", alignItems: "center",
        padding: "0 16px", gap: 16, flexShrink: 0, borderBottom: "1px solid #253858",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "white", fontWeight: 700, fontSize: 13 }}>
          <div style={{ width: 22, height: 22, background: "#0052cc", borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 900, fontSize: 11 }}>P</div>
          PSP
        </div>
        <span style={{ color: "rgba(255,255,255,0.25)" }}>|</span>
        <span style={{
          color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: 500,
          maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {examRoom?.title ?? "Exam"}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{
            fontFamily: "monospace", fontSize: 15, fontWeight: 700,
            color: isEnded ? "#97a0af" : isUrgent ? "#de350b" : "#ff8b00",
          }}>
            {isEnded ? "00:00:00" : timerStr}
          </span>
          <Link href="/assessments" style={{
            background: "#de350b", color: "white", border: "none", borderRadius: 3,
            padding: "0 12px", height: 28, fontSize: 12, fontWeight: 600,
            cursor: "pointer", display: "flex", alignItems: "center", textDecoration: "none",
          }}>
            Leave Exam
          </Link>
        </div>
      </div>

      {/* ── Ended banner ── */}
      {isEnded && (
        <div style={{
          background: "var(--red-light)", borderBottom: "1px solid #ff8f73",
          padding: "7px 16px", fontSize: 13, color: "#bf2600",
          fontWeight: 600, display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
        }}>
          <AlertTriangle size={14} /> This exam has ended. Submissions are no longer accepted.
        </div>
      )}

      {/* ── Three-panel body ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* Left: problem list + progress */}
        <div style={{ width: 240, background: "#253858", display: "flex", flexDirection: "column", flexShrink: 0, borderRight: "1px solid #344563" }}>
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
                  onClick={() => setActiveProblemIdx(i)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 10px", borderRadius: 3, cursor: "pointer", marginBottom: 3,
                    background: activeProblemIdx === i ? "#0052cc" : "transparent",
                  }}
                >
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                    background: p.solvedByCurrentUser ? "#00875a" : "#97a0af",
                  }} />
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", fontWeight: 500, flex: 1 }}>
                    {p.label}. {p.title}
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>{p.points} pts</div>
                </div>
              ))
            )}
          </div>

          <div style={{ padding: 12, borderTop: "1px solid #344563" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Progress</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>{solvedCount} / {problems.length} solved</div>
            <div style={{ background: "#344563", height: 4, borderRadius: 2, marginTop: 6 }}>
              <div style={{ background: "#0052cc", height: 4, borderRadius: 2, width: problems.length > 0 ? `${(solvedCount / problems.length) * 100}%` : "0%" }} />
            </div>
          </div>

          <div style={{ padding: "8px 12px", borderTop: "1px solid #344563" }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 2, display: "flex", alignItems: "center", gap: 4 }}>
              <AlertTriangle size={11} /> Anti-cheat active
            </div>
            <div style={{ fontSize: 11, color: tabSwitches > 0 ? "#de350b" : "rgba(255,255,255,0.4)" }}>
              Tab switches: {tabSwitches}
            </div>
          </div>
        </div>

        {/* Center: problem statement */}
        <div style={{ flex: 1, background: "var(--bg-primary)", display: "flex", flexDirection: "column", overflowY: "auto", borderRight: "1px solid var(--border)" }}>
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
                    <span style={{ display: "flex", alignItems: "center", gap: 4, background: "var(--green-light)", border: "1px solid var(--border)", borderRadius: 3, padding: "2px 8px", fontSize: 11, color: "#006644", fontWeight: 600 }}>
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
        <div style={{ width: 480, display: "flex", flexDirection: "column", flexShrink: 0, background: "var(--bg-primary)" }}>
          <div style={{ padding: "8px 12px", background: "var(--bg-tertiary)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>Language</span>
            <select
              value={lang}
              onChange={(e) => handleLangChange(e.target.value)}
              style={{ border: "1px solid var(--border)", borderRadius: 3, padding: "0 8px", height: 28, fontSize: 12, color: "var(--text-primary)", outline: "none", background: "var(--bg-primary)" }}
            >
              <option value="java">Java</option>
              <option value="python">Python</option>
              <option value="cpp">C++</option>
              <option value="c">C</option>
              <option value="javascript">JavaScript</option>
            </select>
            <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              <button
                onClick={() => handleSubmit(true)}
                disabled={judging || isEnded}
                style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: 3, height: 28, padding: "0 12px", fontSize: 12, cursor: (judging || isEnded) ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 4, opacity: (judging || isEnded) ? 0.5 : 1 }}
              >
                <Play size={11} /> Run
              </button>
              <button
                onClick={() => handleSubmit(false)}
                disabled={judging || isEnded}
                style={{ background: (judging || isEnded) ? "#97a0af" : "#0052cc", color: "white", border: "none", borderRadius: 3, height: 28, padding: "0 14px", fontSize: 12, cursor: (judging || isEnded) ? "not-allowed" : "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}
              >
                {judging
                  ? <><Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> Judging…</>
                  : <><Send size={11} /> Submit</>}
              </button>
            </div>
          </div>

          <div style={{ flex: 1, overflow: "hidden", minHeight: 260 }}>
            <MonacoEditor
              height="100%"
              language={lang}
              theme="vs-dark"
              value={code}
              onChange={(v) => setCode(v ?? "")}
              options={{ minimap: { enabled: false }, fontSize: 12, lineNumbers: "on", scrollBeyondLastLine: false }}
            />
          </div>

          <div style={{ borderTop: "1px solid var(--border)", flexShrink: 0 }}>
            <div style={{ padding: "8px 12px", background: "var(--bg-tertiary)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>Test Cases</span>
              {verdict === "pending" && (
                <span style={{ fontSize: 11, color: "#0747a6", display: "flex", alignItems: "center", gap: 4 }}>
                  <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> Judging…
                </span>
              )}
            </div>
            <div style={{ maxHeight: 200, overflowY: "auto" }}>
              {results.length === 0 && !judging ? (
                <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
                  {isEnded ? "This exam has ended." : "Run or submit your solution to see results."}
                </div>
              ) : (
                Array.from({ length: Math.max(totalCases, results.length) }).map((_, i) => {
                  const r = results[i];
                  const isSample = i < visibleCount;
                  const label = isSample ? `Sample ${i + 1}` : `Hidden ${i - visibleCount + 1}`;
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", padding: "7px 12px", borderBottom: "1px solid #f4f5f7", gap: 8, fontSize: 12 }}>
                      <span style={{ width: 28, color: "var(--text-muted)", fontSize: 11 }}>{i + 1}.</span>
                      {!r ? (
                        <span style={{ color: "var(--text-subtle)" }}>
                          {!isSample ? <><Lock size={11} /> {label}</> : label}
                        </span>
                      ) : r.status === "pass" ? (
                        <><CheckCircle2 size={14} color="#00875a" /><span style={{ flex: 1, fontWeight: 500 }}>{label}</span><span style={{ color: "var(--text-muted)", fontSize: 11 }}>{r.executionTimeMs ? `${r.executionTimeMs} ms` : "OK"}</span></>
                      ) : r.status === "tle" ? (
                        <><XCircle size={14} color="#ff8b00" /><span style={{ flex: 1, fontWeight: 500 }}>{label}</span><span style={{ color: "#ff8b00", fontSize: 11 }}>TLE</span></>
                      ) : (
                        <><XCircle size={14} color="#de350b" /><span style={{ flex: 1, fontWeight: 500 }}>{label}</span><span style={{ color: "#de350b", fontSize: 11 }}>WA</span></>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            {verdict && verdict !== "pending" && (
              <div style={{
                padding: "10px 14px", fontSize: 13, fontWeight: 600,
                display: "flex", alignItems: "center", gap: 8,
                background: verdict === "accepted" ? "#e3fcef" : verdict === "tle" ? "#fffae6" : "#ffebe6",
                color:  verdict === "accepted" ? "#006644" : verdict === "tle" ? "#ff8b00" : "#bf2600",
              }}>
                {verdict === "accepted" ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                {verdict === "accepted" ? "Accepted — All test cases passed" :
                 verdict === "tle"      ? "Time Limit Exceeded" :
                 "Wrong Answer — Some test cases failed"}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
