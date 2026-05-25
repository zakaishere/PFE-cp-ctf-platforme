"use client";

import {
  useState, useRef, forwardRef, useImperativeHandle, useCallback,
} from "react";
import { Client as StompClient } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { runCode, submitCode, type RunResult, type RunTestCaseResult } from "@/lib/api";
import type { Language } from "@/lib/codeTemplates";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SubmitTestCase {
  index:          number;
  status:         string;
  timeMs:         number;
  actualOutput?:  string;
  inputData?:     string;
  expectedOutput?: string;
  isHidden?:      boolean;
}

interface SubmitComplete {
  finalStatus:    string;
  totalPassed:    number;
  totalFailed:    number;
  totalTestCases: number;
  errorMessage?:  string;
}

type RunStatus    = "IDLE" | "RUNNING" | "DONE";
type SubmitStatus = "IDLE" | "JUDGING" | "DONE";

interface ResultsPanelProps {
  problemId:    string;
  code:         string;
  language:     Language;
  userId:       string;
  activeTab:    "run" | "submit";
  onTabChange:  (t: "run" | "submit") => void;
  onRunStart?:  () => void;
  onRunEnd?:    () => void;
  onSubmitStart?: () => void;
  onSubmitEnd?:   () => void;
}

export interface ResultsPanelHandle {
  handleRun:    () => void;
  handleSubmit: () => void;
}

// ── Normalize raw API response (handles both old and new backend format) ───────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeRunResult(raw: any): RunResult {
  const VALID_STATUSES = ["ALL_PASSED", "FAILED", "COMPILATION_ERROR"];

  // Already new format
  if (raw.status && VALID_STATUSES.includes(raw.status)) {
    const results: RunTestCaseResult[] = (raw.results ?? []).map((r: any, i: number) => ({
      index:          r.index          ?? i + 1,
      passed:         r.passed         ?? false,
      verdict:        r.verdict        ?? legacyStatusToVerdict(r.status),
      input:          r.input,
      expectedOutput: r.expectedOutput,
      actualOutput:   r.actualOutput,
      timeMs:         r.timeMs         ?? 0,
      isHidden:       r.isHidden       ?? r.hidden ?? false,
    }));
    const firstFail = results.findIndex(r => !r.passed);
    return {
      status:      raw.status,
      results,
      stoppedAt:   raw.stoppedAt   ?? (firstFail >= 0 ? firstFail + 1 : undefined),
      totalCases:  raw.totalCases  || results.length,
      failReason:  raw.failReason  ?? (firstFail >= 0 ? results[firstFail].verdict : undefined),
      compileError: raw.compileError,
    };
  }

  // Old format: { results: [{ testCaseId, input, ..., status: "PASS"|"FAIL", passed, timeMs }] }
  const results: RunTestCaseResult[] = (raw.results ?? []).map((r: any, i: number) => ({
    index:          i + 1,
    passed:         r.passed ?? false,
    verdict:        r.verdict ?? legacyStatusToVerdict(r.status),
    input:          r.input,
    expectedOutput: r.expectedOutput,
    actualOutput:   r.actualOutput,
    timeMs:         r.timeMs ?? 0,
    isHidden:       false,
  }));

  const firstFail = results.findIndex(r => !r.passed);
  const allPassed = results.length > 0 && results.every(r => r.passed);

  return {
    status:     allPassed ? "ALL_PASSED" : "FAILED",
    results,
    stoppedAt:  firstFail >= 0 ? firstFail + 1 : undefined,
    totalCases: results.length,
    failReason: firstFail >= 0 ? results[firstFail].verdict : undefined,
  };
}

function legacyStatusToVerdict(status: string | undefined): string {
  return ({
    PASS:       "ACCEPTED",
    FAIL:       "WRONG_ANSWER",
    TIME_OUT:   "TIME_LIMIT_EXCEEDED",
    ERROR:      "RUNTIME_ERROR",
    MEMORY_OUT: "MEMORY_LIMIT_EXCEEDED",
  } as Record<string, string>)[status ?? ""] ?? "WRONG_ANSWER";
}

// ── Helper ────────────────────────────────────────────────────────────────────

function verdictLabel(v: string): string {
  return ({
    ACCEPTED:             "Accepted",
    WRONG_ANSWER:         "Wrong Answer",
    TIME_LIMIT_EXCEEDED:  "Time Limit Exceeded",
    RUNTIME_ERROR:        "Runtime Error",
    MEMORY_LIMIT_EXCEEDED:"Memory Limit Exceeded",
    COMPILATION_ERROR:    "Compilation Error",
  } as Record<string, string>)[v] ?? v;
}

const VERDICT_COLOR: Record<string, string> = {
  ACCEPTED:              "#57d9a3",
  WRONG_ANSWER:          "#ff6b4a",
  TIME_LIMIT_EXCEEDED:   "#ffc107",
  RUNTIME_ERROR:         "#c678dd",
  MEMORY_LIMIT_EXCEEDED: "#56b6c2",
};

const VERDICT_ICON: Record<string, string> = {
  ACCEPTED:              "✓",
  WRONG_ANSWER:          "✗",
  TIME_LIMIT_EXCEEDED:   "⏱",
  RUNTIME_ERROR:         "💥",
  MEMORY_LIMIT_EXCEEDED: "📦",
};

function MiniSpinner({ color = "#888", size = 12 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      style={{ animation: "spin 0.8s linear infinite", flexShrink: 0, display: "inline-block" }}>
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="3" strokeDasharray="30 70" />
    </svg>
  );
}

// ── IOBlock ───────────────────────────────────────────────────────────────────

interface LineDiff { text: string; type: "ok" | "wrong" | "extra" | "missing"; }

function getDiff(expected: string, actual: string): LineDiff[] {
  const exp = expected.split("\n");
  const act = actual.split("\n");
  const len = Math.max(exp.length, act.length);
  return Array.from({ length: len }, (_, i) => {
    const e = exp[i]; const a = act[i];
    if (e === undefined) return { text: a, type: "extra" } as LineDiff;
    if (a === undefined) return { text: `(missing: "${e}")`, type: "missing" } as LineDiff;
    if (e === a)         return { text: a, type: "ok" } as LineDiff;
    if (e.trim() === a.trim()) return { text: a + "  ← whitespace diff", type: "wrong" } as LineDiff;
    return { text: a, type: "wrong" } as LineDiff;
  });
}

function IOBlock({ label, value, highlight = false, diff }: {
  label: string; value: string; highlight?: boolean; diff?: LineDiff[];
}) {
  const diffColor: Record<LineDiff["type"], string> = {
    ok: "transparent", wrong: "rgba(255,107,74,0.15)", extra: "rgba(255,193,7,0.1)", missing: "rgba(198,120,221,0.1)",
  };
  const textColor: Record<LineDiff["type"], string> = {
    ok: "#ccc", wrong: "#ff6b4a", extra: "#ffc107", missing: "#c678dd",
  };

  return (
    <div style={{ border: `1px solid ${highlight ? "rgba(255,107,74,0.3)" : "#333"}`, borderRadius: 5, overflow: "hidden" }}>
      <div style={{
        padding: "5px 10px", background: "#2d2d2d",
        fontSize: 10, fontWeight: 700, color: highlight ? "#ff6b4a" : "#666",
        textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: "1px solid #333",
      }}>
        {label}
      </div>
      <div style={{ padding: "8px 10px" }}>
        {diff ? (
          diff.map((line, i) => (
            <div key={i} style={{
              fontFamily: "ui-monospace, Consolas, monospace", fontSize: 12, lineHeight: 1.6,
              background: diffColor[line.type], padding: "1px 4px", borderRadius: 2,
              color: textColor[line.type], whiteSpace: "pre",
            }}>
              {line.text || " "}
            </div>
          ))
        ) : (
          <pre style={{
            fontFamily: "ui-monospace, Consolas, monospace", fontSize: 12,
            color: "#ccc", margin: 0, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-all",
          }}>
            {value || <span style={{ color: "#555" }}>(empty)</span>}
          </pre>
        )}
      </div>
    </div>
  );
}

function DiffSummary({ expected, actual }: { expected: string; actual: string }) {
  const e = expected.trim().split("\n");
  const a = actual.trim().split("\n");
  if (e.length !== a.length) {
    return (
      <div style={{ fontSize: 11, color: "#ff6b4a", padding: "6px 10px", background: "rgba(255,107,74,0.08)", borderRadius: 4 }}>
        ⚠ Output has {a.length} line{a.length !== 1 ? "s" : ""}, expected {e.length}
      </div>
    );
  }
  const first = e.findIndex((l, i) => l !== a[i]);
  if (first >= 0) {
    return (
      <div style={{ fontSize: 11, color: "#ff6b4a", padding: "6px 10px", background: "rgba(255,107,74,0.08)", borderRadius: 4 }}>
        First difference on line {first + 1}: expected{" "}
        <code style={{ background: "#333", padding: "1px 4px", borderRadius: 3 }}>{e[first]}</code>
        , got <code style={{ background: "#333", padding: "1px 4px", borderRadius: 3 }}>{a[first]}</code>
      </div>
    );
  }
  return null;
}

// ── Sub-views ─────────────────────────────────────────────────────────────────

function CompilationErrorView({ error }: { error: string }) {
  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, fontSize: 13, fontWeight: 700, color: "#ff6b4a" }}>
        🔴 Compilation Error
      </div>
      <pre style={{
        fontFamily: "ui-monospace, Consolas, monospace", fontSize: 12, color: "#ff8f6b",
        background: "rgba(255,107,74,0.08)", border: "1px solid rgba(255,107,74,0.2)",
        borderRadius: 5, padding: "12px 14px", margin: 0, whiteSpace: "pre-wrap",
        wordBreak: "break-all", lineHeight: 1.7, maxHeight: 300, overflow: "auto",
      }}>
        {error}
      </pre>
      <p style={{ fontSize: 11, color: "#666", marginTop: 8, marginBottom: 0 }}>
        Fix the compilation error above, then try running again.
      </p>
    </div>
  );
}

function RuntimeErrorView({ error }: { error: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#c678dd", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>
        Runtime Error
      </div>
      <pre style={{
        fontFamily: "ui-monospace, Consolas, monospace", fontSize: 11, color: "#d19bd8",
        background: "rgba(198,120,221,0.08)", border: "1px solid rgba(198,120,221,0.2)",
        borderRadius: 5, padding: "10px 12px", margin: 0, whiteSpace: "pre-wrap",
        maxHeight: 200, overflow: "auto", lineHeight: 1.6,
      }}>
        {error}
      </pre>
    </div>
  );
}

function TimeLimitView({ timeMs }: { timeMs: number }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
      background: "rgba(255,193,7,0.08)", border: "1px solid rgba(255,193,7,0.2)",
      borderRadius: 5, fontSize: 12, color: "#ffc107",
    }}>
      <span style={{ fontSize: 20 }}>⏱</span>
      <div>
        <div style={{ fontWeight: 700 }}>Time Limit Exceeded</div>
        <div style={{ color: "#888", marginTop: 2 }}>
          Your solution ran for &gt;{timeMs}ms — optimize your algorithm.
        </div>
      </div>
    </div>
  );
}

function IOComparisonView({ input, expected, actual, passed }: {
  input: string; expected: string; actual: string; passed: boolean;
}) {
  const diff = !passed ? getDiff(expected, actual) : undefined;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <IOBlock label="Input" value={input} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <IOBlock label="Expected Output" value={expected} />
        <IOBlock label="Your Output" value={actual} highlight={!passed} diff={diff} />
      </div>
      {!passed && <DiffSummary expected={expected} actual={actual} />}
    </div>
  );
}

function SkippedCasesRow({ skipped, reason }: { skipped: number; reason: string }) {
  return (
    <div style={{
      padding: "8px 12px", background: "#1e1e1e",
      border: "1px dashed #444", borderRadius: 6,
      display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#666",
    }}>
      <span>⏭</span>
      <span>
        {skipped} more test case{skipped > 1 ? "s" : ""} skipped — execution stopped after first {verdictLabel(reason).toLowerCase()}.
      </span>
      <span style={{ marginLeft: "auto", fontSize: 11, background: "#2d2d2d", padding: "2px 8px", borderRadius: 3, color: "#555" }}>
        saves Docker resources
      </span>
    </div>
  );
}

// ── TestCaseRow (expandable) ──────────────────────────────────────────────────

function TestCaseRow({ result, rowIndex, isExpanded, onToggle }: {
  result: RunTestCaseResult; rowIndex: number; isExpanded: boolean; onToggle: () => void;
}) {
  const verdict = result.verdict || "WRONG_ANSWER";
  const vc = VERDICT_COLOR[verdict] ?? "#888";
  const vi = VERDICT_ICON[verdict] ?? "✗";
  const displayIndex = result.index ?? rowIndex + 1;

  return (
    <div style={{ border: `1px solid ${isExpanded ? vc + "40" : "#333"}`, borderRadius: 6, overflow: "hidden", transition: "border-color 0.15s" }}>
      {/* Header row */}
      <div
        onClick={onToggle}
        style={{
          display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
          cursor: "pointer", background: isExpanded ? "#2a2a2a" : "transparent",
          transition: "background 0.12s",
        }}
      >
        <div style={{
          width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
          background: result.passed ? "rgba(87,217,163,0.15)" : "rgba(255,107,74,0.15)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 800, color: vc,
        }}>
          {vi}
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#ccc" }}>Test case {displayIndex}</span>
        <span style={{ fontSize: 11, color: vc, fontWeight: 600 }}>{verdictLabel(verdict)}</span>
        <span style={{ fontSize: 11, color: "#555", marginLeft: "auto" }}>{result.timeMs}ms</span>
        <span style={{ fontSize: 10, color: "#555", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>▼</span>
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div style={{ padding: 12, background: "#212121", borderTop: "1px solid #333" }}>
          {verdict === "RUNTIME_ERROR" && result.actualOutput && (
            <RuntimeErrorView error={result.actualOutput} />
          )}
          {verdict === "TIME_LIMIT_EXCEEDED" && (
            <TimeLimitView timeMs={result.timeMs} />
          )}
          {(verdict === "WRONG_ANSWER" || verdict === "ACCEPTED") && result.input !== undefined && (
            <IOComparisonView
              input={result.input ?? ""}
              expected={result.expectedOutput ?? ""}
              actual={result.actualOutput ?? ""}
              passed={result.passed}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── RunSummaryBar ─────────────────────────────────────────────────────────────

function RunSummaryBar({ result }: { result: RunResult }) {
  const passed    = result.results.filter(r => r.passed).length;
  const total     = result.totalCases || result.results.length;
  const allPassed = result.status === "ALL_PASSED";
  const stoppedAt = result.stoppedAt;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", marginBottom: 10,
      borderRadius: 6,
      background: allPassed ? "rgba(0,135,90,0.1)" : "rgba(222,53,11,0.1)",
      border: `1px solid ${allPassed ? "rgba(87,217,163,0.2)" : "rgba(255,107,74,0.2)"}`,
    }}>
      <span style={{ fontSize: 18, lineHeight: 1 }}>{allPassed ? "✅" : "❌"}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: allPassed ? "#57d9a3" : "#ff6b4a" }}>
          {allPassed
            ? `All ${total} test case${total === 1 ? "" : "s"} passed`
            : stoppedAt != null
              ? `Failed at test case ${stoppedAt} — stopped early`
              : `${total - passed} test case${total - passed === 1 ? "" : "s"} failed`}
        </div>
        {!allPassed && result.failReason && (
          <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
            {verdictLabel(result.failReason)}
            {stoppedAt != null && stoppedAt < total && (
              <> · {total - stoppedAt} case{total - stoppedAt > 1 ? "s" : ""} skipped</>
            )}
          </div>
        )}
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#888", background: "#2d2d2d", padding: "3px 10px", borderRadius: 4 }}>
        {passed} / {total} passed
      </div>
    </div>
  );
}

// ── RunResultsView ────────────────────────────────────────────────────────────

function RunResultsView({ status, result, expandedCase, onToggle }: {
  status: RunStatus; result: RunResult | null; expandedCase: number | null; onToggle: (i: number | null) => void;
}) {
  if (status === "IDLE") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 8, color: "#555", fontSize: 13 }}>
        <span style={{ fontSize: 24 }}>▷</span>
        Click <strong style={{ color: "#ccc" }}>Run</strong> to test against sample cases
      </div>
    );
  }
  if (status === "RUNNING") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", gap: 10, color: "#888", fontSize: 13 }}>
        <MiniSpinner /> Running test cases…
      </div>
    );
  }
  if (!result) return null;

  if (result.status === "COMPILATION_ERROR") {
    return <CompilationErrorView error={result.compileError ?? ""} />;
  }

  const skipped = result.stoppedAt != null ? result.totalCases - result.stoppedAt : 0;

  return (
    <div style={{ padding: 12 }}>
      <RunSummaryBar result={result} />
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {result.results.map((tc, i) => (
          <TestCaseRow
            key={i} result={tc} rowIndex={i} isExpanded={expandedCase === i}
            onToggle={() => onToggle(expandedCase === i ? null : i)}
          />
        ))}
        {skipped > 0 && result.failReason && (
          <SkippedCasesRow skipped={skipped} reason={result.failReason} />
        )}
      </div>
    </div>
  );
}

// ── SubmitResultsView ─────────────────────────────────────────────────────────

function OutputBlock({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10, color: accent ?? "#666", fontWeight: 700, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.5px" }}>
        {label}
      </div>
      <pre style={{
        margin: 0, padding: "6px 10px", borderRadius: 3,
        background: "#141414", border: "1px solid #2a2a2a",
        fontSize: 12, color: "#ccc", fontFamily: "monospace",
        whiteSpace: "pre-wrap", wordBreak: "break-all",
        maxHeight: 120, overflowY: "auto",
      }}>
        {value || <span style={{ color: "#555" }}>(empty)</span>}
      </pre>
    </div>
  );
}

function SubmitResultsView({ status, rows, complete }: {
  status: SubmitStatus; rows: SubmitTestCase[]; complete: SubmitComplete | null;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);

  if (status === "IDLE") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 8, color: "#555", fontSize: 13 }}>
        <span style={{ fontSize: 24 }}>⚡</span>
        Click <strong style={{ color: "#ccc" }}>Submit</strong> to judge against all test cases
      </div>
    );
  }

  const verdictColor: Record<string, string> = {
    ACCEPTED:              "#57d9a3",
    WRONG_ANSWER:          "#ff6b4a",
    RUNTIME_ERROR:         "#c678dd",
    TIME_OUT:              "#ffc107",
    MEMORY_LIMIT_EXCEEDED: "#56b6c2",
    COMPILATION_ERROR:     "#ff6b4a",
  };

  const finalColor = complete ? (verdictColor[complete.finalStatus] ?? "#888") : "#888";

  return (
    <div style={{ padding: 12 }}>
      {/* Verdict banner */}
      {complete && (
        <div style={{
          display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", marginBottom: 12,
          borderRadius: 6,
          background: complete.finalStatus === "ACCEPTED" ? "rgba(0,135,90,0.1)" : "rgba(222,53,11,0.1)",
          border: `1px solid ${complete.finalStatus === "ACCEPTED" ? "rgba(87,217,163,0.2)" : "rgba(255,107,74,0.2)"}`,
        }}>
          <span style={{ fontSize: 22 }}>{complete.finalStatus === "ACCEPTED" ? "🎉" : "❌"}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: finalColor }}>
              {verdictLabel(complete.finalStatus)}
            </div>
            {complete.finalStatus !== "COMPILATION_ERROR" && (
              <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                {complete.totalPassed} / {complete.totalTestCases} test cases passed
              </div>
            )}
            {complete.errorMessage && (
              <pre style={{ fontSize: 11, color: "#ff8f6b", margin: "6px 0 0", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                {complete.errorMessage}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* Per-case rows */}
      {rows.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {rows.map((r, i) => {
            const isPending  = r.status === "pending";
            const isPass     = r.status === "PASS";
            const isNotRun   = r.status === "NOT_RUN";
            const canExpand  = !isPending && !isNotRun;
            const isExpanded = expanded === i;
            const rowColor   = isPending ? "#888"
              : isPass    ? "#57d9a3"
              : isNotRun  ? "#444"
              : VERDICT_COLOR[r.status] ?? "#ff6b4a";

            return (
              <div key={i} style={{
                background: "#1e1e1e", borderRadius: 4,
                border: `1px solid ${isNotRun ? "#333" : rowColor + "33"}`,
                animation: "tcReveal 0.18s ease both",
                opacity: isNotRun ? 0.45 : 1,
                overflow: "hidden",
              }}>
                {/* Row header — clickable if there's output to show */}
                <div
                  onClick={() => canExpand && setExpanded(isExpanded ? null : i)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "7px 12px",
                    cursor: canExpand ? "pointer" : "default",
                    userSelect: "none",
                  }}
                >
                  {/* Status dot */}
                  <div style={{
                    width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                    background: isPending ? "rgba(136,136,136,0.15)"
                      : isPass    ? "rgba(87,217,163,0.15)"
                      : isNotRun  ? "rgba(80,80,80,0.15)"
                      : "rgba(255,107,74,0.15)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 800, color: rowColor,
                  }}>
                    {isPending ? <MiniSpinner size={8} /> : isPass ? "✓" : isNotRun ? "–" : "✗"}
                  </div>

                  <span style={{ fontSize: 12, color: isNotRun ? "#555" : "#aaa", flex: 1 }}>
                    Test case {r.index + 1}
                    {r.isHidden && <span style={{ marginLeft: 5, fontSize: 10, color: "#555" }}>hidden</span>}
                  </span>

                  {!isPending && !isNotRun && (
                    <span style={{ fontSize: 11, color: rowColor, fontWeight: 600 }}>
                      {isPass ? "Accepted" : verdictLabel(r.status)}
                    </span>
                  )}
                  {isNotRun && <span style={{ fontSize: 11, color: "#555" }}>not evaluated</span>}

                  {/* Execution time */}
                  {!isPending && !isNotRun && r.timeMs > 0 && (
                    <span style={{ fontSize: 11, color: "#555", marginLeft: 8 }}>{r.timeMs} ms</span>
                  )}

                  {/* Expand chevron */}
                  {canExpand && (
                    <span style={{ fontSize: 10, color: "#444", marginLeft: 4, transition: "transform 0.15s", display: "inline-block", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>
                      ▼
                    </span>
                  )}
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div style={{ padding: "0 12px 12px", borderTop: "1px solid #2a2a2a" }}>
                    <div style={{ paddingTop: 10 }}>
                      {r.actualOutput == null && r.inputData == null && r.expectedOutput == null ? (
                        <div style={{ fontSize: 12, color: "#555", fontStyle: "italic", padding: "8px 0" }}>
                          Details not available — restart the backend to enable per-case output.
                        </div>
                      ) : r.isHidden ? (
                        <>
                          <div style={{ fontSize: 12, color: "#666", fontStyle: "italic", marginBottom: 10 }}>
                            Hidden test case — input and expected output are not shown.
                          </div>
                          {r.actualOutput != null && (
                            <OutputBlock label="Your Output" value={r.actualOutput} accent={isPass ? "#57d9a3" : "#ff6b4a"} />
                          )}
                        </>
                      ) : (
                        <>
                          {r.inputData != null && <OutputBlock label="Input" value={r.inputData} />}
                          {r.expectedOutput != null && <OutputBlock label="Expected Output" value={r.expectedOutput} accent="#57d9a3" />}
                          {r.actualOutput != null && (
                            <OutputBlock label="Your Output" value={r.actualOutput} accent={isPass ? "#57d9a3" : "#ff6b4a"} />
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {status === "JUDGING" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", color: "#555", fontSize: 12 }}>
              <MiniSpinner /> Judging…
            </div>
          )}
        </div>
      )}

      {status === "JUDGING" && rows.length === 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", padding: 40, color: "#888", fontSize: 13 }}>
          <MiniSpinner /> Connecting to judge…
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export const ResultsPanel = forwardRef<ResultsPanelHandle, ResultsPanelProps>(
  function ResultsPanel(
    { problemId, code, language, userId, activeTab, onTabChange, onRunStart, onRunEnd, onSubmitStart, onSubmitEnd },
    ref,
  ) {
    const [runStatus,     setRunStatus]     = useState<RunStatus>("IDLE");
    const [runResult,     setRunResult]     = useState<RunResult | null>(null);
    const [expandedCase,  setExpandedCase]  = useState<number | null>(null);

    const [submitStatus,  setSubmitStatus]  = useState<SubmitStatus>("IDLE");
    const [submitRows,    setSubmitRows]    = useState<SubmitTestCase[]>([]);
    const [submitComplete, setSubmitComplete] = useState<SubmitComplete | null>(null);

    const stompRef = useRef<StompClient | null>(null);

    // ── Run ───────────────────────────────────────────────────────────────────

    const handleRun = useCallback(async () => {
      setRunStatus("RUNNING");
      setRunResult(null);
      setExpandedCase(null);
      onRunStart?.();
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw = await runCode(problemId, { sourceCode: code, language: language.toUpperCase() }) as any;
        const result = normalizeRunResult(raw);
        setRunResult(result);
        if (result.stoppedAt != null) {
          setExpandedCase(result.stoppedAt - 1);
        }
      } catch {
        setRunResult({
          status: "COMPILATION_ERROR",
          compileError: "Run failed — check your code and try again.",
          results: [],
          totalCases: 0,
        });
      } finally {
        setRunStatus("DONE");
        onRunEnd?.();
      }
    }, [problemId, code, language, onRunStart, onRunEnd]);

    // ── Submit ────────────────────────────────────────────────────────────────

    const handleSubmit = useCallback(async () => {
      if (!userId) return;
      setSubmitStatus("JUDGING");
      setSubmitRows([]);
      setSubmitComplete(null);
      setExpandedCase(null);
      onSubmitStart?.();

      stompRef.current?.deactivate();

      // Track stagger index so each arriving row gets a delay proportional to position
      let rowRevealIndex = 0;

      try {
        // Step 1: connect WebSocket FIRST so we never miss a message
        const client = await new Promise<StompClient>((resolve, reject) => {
          const c = new StompClient({
            webSocketFactory: () =>
              new SockJS(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080"}/ws-endpoint`),
            onConnect:        () => resolve(c),
            onStompError:     (f) => reject(new Error(f.headers?.message ?? "STOMP error")),
            onWebSocketError: (e) => reject(e),
            reconnectDelay:   0,
          });
          c.activate();
          // Give the connection 5 s to establish before bailing
          setTimeout(() => reject(new Error("WS connect timeout")), 5_000);
        });

        stompRef.current = client;

        // Step 2: submit — backend queues the job AFTER we're already listening
        const res = await submitCode({
          studentId:  userId,
          problemId,
          sourceCode: code,
          language:   language.toUpperCase(),
        });

        // Step 3: subscribe to this submission's topic
        client.subscribe(`/topic/submissions/${res.submissionId}`, (frame) => {
          try {
            const data = JSON.parse(frame.body);

            if (data.type === "TEST_CASE_RESULT") {
              const row: SubmitTestCase = {
                index:          data.testCaseIndex,
                status:         data.status,
                timeMs:         data.executionTimeMs ?? 0,
                actualOutput:   data.actualOutput,
                inputData:      data.inputData,
                expectedOutput: data.expectedOutput,
                isHidden:       data.isHidden ?? false,
              };
              // Stagger each row by 60 ms so they visually appear one-by-one
              const delay = rowRevealIndex * 60;
              rowRevealIndex++;
              setTimeout(() => {
                setSubmitRows(prev => {
                  const next = [...prev];
                  next[data.testCaseIndex] = row;
                  return next;
                });
              }, delay);
            } else if (data.type === "SUBMISSION_COMPLETE") {
              const complete: SubmitComplete = {
                finalStatus:    data.finalStatus,
                totalPassed:    data.totalPassed,
                totalFailed:    data.totalFailed,
                totalTestCases: data.totalTestCases,
                errorMessage:   data.errorMessage ?? undefined,
              };
              // Wait until all staggered rows have rendered before showing the verdict
              const finalDelay = rowRevealIndex * 60 + 80;
              setTimeout(() => {
                setSubmitRows(prev => {
                  // Fill any rows that were skipped (early termination) as NOT_RUN
                  const filled = [...prev];
                  for (let i = 0; i < data.totalTestCases; i++) {
                    if (!filled[i]) {
                      filled[i] = { index: i, status: "NOT_RUN", timeMs: 0 };
                    }
                  }
                  return filled;
                });
                setSubmitComplete(complete);
                setSubmitStatus("DONE");
                onSubmitEnd?.();
                client.deactivate();
              }, finalDelay);
            }
          } catch (e) {
            console.error("STOMP parse error", e);
          }
        });

        // Timeout safety net
        setTimeout(() => {
          if (stompRef.current?.active) {
            stompRef.current.deactivate();
            setSubmitStatus(s => s === "JUDGING" ? "DONE" : s);
            onSubmitEnd?.();
          }
        }, 35_000);
      } catch (e) {
        console.error("Submit error", e);
        setSubmitStatus("DONE");
        onSubmitEnd?.();
      }
    }, [userId, problemId, code, language, onSubmitStart, onSubmitEnd]);

    useImperativeHandle(ref, () => ({ handleRun, handleSubmit }), [handleRun, handleSubmit]);

    // ── Render ────────────────────────────────────────────────────────────────

    return (
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, background: "#1a1a1a" }}>
        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #333", background: "#252526", flexShrink: 0 }}>
          {(["run", "submit"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              style={{
                padding: "0 16px", height: 38,
                background: "transparent", border: "none",
                borderBottom: activeTab === tab ? "2px solid #0052cc" : "2px solid transparent",
                color: activeTab === tab ? "#4c9aff" : "#888",
                fontSize: 12, fontWeight: activeTab === tab ? 700 : 500,
                cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              {tab === "run" ? "▷ Run Results" : "⚡ Submit Results"}
              {tab === "run"    && runStatus    === "RUNNING" && <MiniSpinner />}
              {tab === "submit" && submitStatus === "JUDGING" && <MiniSpinner />}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
          {activeTab === "run" ? (
            <RunResultsView
              status={runStatus}
              result={runResult}
              expandedCase={expandedCase}
              onToggle={i => setExpandedCase(i)}
            />
          ) : (
            <SubmitResultsView
              status={submitStatus}
              rows={submitRows}
              complete={submitComplete}
            />
          )}
        </div>
      </div>
    );
  }
);
