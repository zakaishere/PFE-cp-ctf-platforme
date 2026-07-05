"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { Play, Send, RefreshCw, Lock, CheckCircle2, XCircle, Loader2, ChevronDown } from "lucide-react";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

// ── Shared types ──────────────────────────────────────────────────────────────

export type WorkspaceVerdict =
  | "pending"
  | "accepted"
  | "wrong"
  | "tle"
  | "mle"
  | "error"
  | null;

export type WorkspaceTestStatus =
  | "pass"
  | "fail"
  | "tle"
  | "mle"
  | "error"
  | null;

export interface WorkspaceTestResult {
  idx: number;
  status: WorkspaceTestStatus;
  executionTimeMs?: number;
  /** Optional per-row label override (else "Sample N" / "Hidden N" is used). */
  label?: string;
}

export interface WorkspaceLanguageOption {
  value: string;
  label: string;
}

export const DEFAULT_WORKSPACE_LANGUAGES: WorkspaceLanguageOption[] = [
  { value: "java",       label: "Java"       },
  { value: "python",     label: "Python"     },
  { value: "cpp",        label: "C++"        },
  { value: "c",          label: "C"          },
  { value: "javascript", label: "JavaScript" },
];

export const DEFAULT_WORKSPACE_CODE: Record<string, string> = {
  java:       `import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // TODO: solve here\n    }\n}`,
  python:     `import sys\ninput = sys.stdin.readline\n\ndef solve():\n    pass\n\nsolve()`,
  cpp:        `#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios_base::sync_with_stdio(false);\n    cin.tie(NULL);\n    // TODO: solve here\n    return 0;\n}`,
  c:          `#include <stdio.h>\n\nint main() {\n    // TODO: solve here\n    return 0;\n}`,
  javascript: `const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n');\n// TODO: solve here`,
};

// ── Props ─────────────────────────────────────────────────────────────────────

export interface CodeWorkspaceProps {
  // Language
  language: string;
  onLanguageChange: (lang: string) => void;
  languageOptions?: WorkspaceLanguageOption[];

  // Code
  code: string;
  onCodeChange: (code: string) => void;

  // Actions
  onRun?: () => void;
  onSubmit: () => void;
  running?: boolean;
  judging?: boolean;
  disabled?: boolean;

  // Results
  results?: WorkspaceTestResult[];
  verdict?: WorkspaceVerdict;
  /** Total expected test-case row count for placeholder rendering (sample + hidden). */
  totalCases?: number;
  /** Number of visible/sample test cases — drives the "Sample N"/"Hidden N" labeling. */
  visibleCount?: number;
  /** When true and a result is missing, render a "this exam has ended" empty state. */
  isEndedMessage?: string;

  // Exam/TP chrome
  /** Panel heading, e.g. "Your solution". */
  panelLabel?: string;
  /**
   * Hide live verdicts/test-case rows and show a "results hidden during exam"
   * lock note instead. Used only for live exams.
   */
  hideResults?: boolean;
  /** Show the green "Answer submitted" banner (student has an accepted/prior submission). */
  submitted?: boolean;
  /** Footer button labels. */
  runLabel?: string;
  submitLabel?: string;
  /**
   * When set, replaces the footer action buttons with a blocking banner
   * (e.g. TP deadline passed / max attempts reached).
   */
  blockedBanner?: React.ReactNode;

  // Customization
  editorTheme?: "vs-dark" | "light";
  editorFontSize?: number;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CodeWorkspace({
  language,
  onLanguageChange,
  languageOptions = DEFAULT_WORKSPACE_LANGUAGES,
  code,
  onCodeChange,
  onRun,
  onSubmit,
  running = false,
  judging = false,
  disabled = false,
  results = [],
  verdict = null,
  totalCases,
  visibleCount = 0,
  isEndedMessage,
  panelLabel = "Your solution",
  hideResults = false,
  submitted = false,
  runLabel = "Run sample",
  submitLabel = "Submit answer",
  blockedBanner,
  editorTheme = "vs-dark",
  editorFontSize = 13,
}: CodeWorkspaceProps) {
  const monacoLang = useMemo(() => language, [language]);

  const busy = running || judging || disabled;
  const rowCount = Math.max(totalCases ?? 0, results.length);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--bg-2)",
        overflow: "hidden",
      }}
    >
      {/* ── Header: label + language picker ── */}
      <div
        style={{
          flex: "none",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 16px",
          borderBottom: "1px solid var(--line-2)",
        }}
      >
        <span
          style={{
            font: "650 10px var(--font)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--ink-3)",
          }}
        >
          {panelLabel}
        </span>
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 7,
            background: "var(--surface)",
            border: "1px solid rgba(255,255,255,.1)",
            borderRadius: 8,
            padding: "0 8px 0 11px",
            font: "500 12.5px var(--font-mono)",
            color: "var(--ink)",
            position: "relative",
          }}
        >
          <select
            value={language}
            onChange={(e) => onLanguageChange(e.target.value)}
            disabled={disabled}
            style={{
              appearance: "none",
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--ink)",
              font: "500 12.5px var(--font-mono)",
              padding: "6px 18px 6px 0",
              cursor: disabled ? "not-allowed" : "pointer",
            }}
          >
            {languageOptions.map((opt) => (
              <option key={opt.value} value={opt.value} style={{ background: "var(--surface)" }}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={12}
            color="var(--ink-3)"
            style={{ position: "absolute", right: 8, pointerEvents: "none" }}
          />
        </div>
      </div>

      {/* ── Editor ── */}
      <div style={{ flex: 1, overflow: "hidden", minHeight: 200 }}>
        <MonacoEditor
          height="100%"
          language={monacoLang}
          theme={editorTheme}
          value={code}
          onChange={(v) => onCodeChange(v ?? "")}
          options={{
            minimap: { enabled: false },
            fontSize: editorFontSize,
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            readOnly: disabled,
          }}
        />
      </div>

      {/* ── Submitted banner ── */}
      {submitted && (
        <div
          style={{
            flex: "none",
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 16px",
            background: "rgba(0,255,0,.07)",
            borderTop: "1px solid rgba(0,255,0,.18)",
          }}
        >
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: "rgba(0,255,0,.15)",
              border: "1px solid rgba(0,255,0,.25)",
              display: "grid",
              placeItems: "center",
              flex: "none",
            }}
          >
            <CheckCircle2 size={15} color="var(--accent)" />
          </div>
          <div>
            <div style={{ font: "650 13px var(--font)", color: "var(--accent)" }}>
              Answer submitted
            </div>
            <div style={{ font: "500 11.5px var(--font)", color: "var(--ink-2)", marginTop: 2 }}>
              You can update your answer before the exam closes.
            </div>
          </div>
        </div>
      )}

      {/* ── Results (live) OR lock note (exam) ── */}
      {hideResults ? (
        <div
          style={{
            flex: "none",
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            padding: "12px 16px",
            background: "rgba(0,255,0,.04)",
            borderTop: "1px solid rgba(0,255,0,.1)",
          }}
        >
          <Lock size={14} color="var(--accent)" style={{ flex: "none", marginTop: 2 }} />
          <p style={{ font: "500 12px var(--font)", color: "var(--ink-2)", lineHeight: 1.55 }}>
            <b style={{ color: "var(--ink)", fontWeight: 650 }}>Results hidden during exam.</b>{" "}
            You can run the sample case to check your logic. Full test verdicts and your score
            are revealed after the exam closes.
          </p>
        </div>
      ) : (
        <ResultsSection
          results={results}
          verdict={verdict}
          rowCount={rowCount}
          visibleCount={visibleCount}
          judging={judging}
          running={running}
          isEndedMessage={isEndedMessage}
        />
      )}

      {/* ── Footer: actions OR blocking banner ── */}
      {blockedBanner ? (
        <div
          style={{
            flex: "none",
            padding: "12px 16px",
            borderTop: "1px solid var(--line-2)",
            background: "var(--bg)",
          }}
        >
          {blockedBanner}
        </div>
      ) : (
        <div
          style={{
            flex: "none",
            display: "grid",
            gridTemplateColumns: onRun ? "1fr 1.6fr" : "1fr",
            gap: 10,
            padding: "12px 16px",
            borderTop: "1px solid var(--line-2)",
            background: "var(--bg)",
          }}
        >
          {onRun && (
            <button type="button" onClick={onRun} disabled={busy} style={ghostBtn(busy)}>
              {running ? (
                <>
                  <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Running…
                </>
              ) : (
                <>
                  <Play size={15} /> {runLabel}
                </>
              )}
            </button>
          )}
          <button type="button" onClick={onSubmit} disabled={busy} style={primaryBtn(busy)}>
            {judging ? (
              <>
                <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Judging…
              </>
            ) : (
              <>
                {submitted ? <RefreshCw size={15} /> : <Send size={15} />}
                {submitted ? "Update answer" : submitLabel}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Results section ─────────────────────────────────────────────────────────

function ResultsSection({
  results,
  verdict,
  rowCount,
  visibleCount,
  judging,
  running,
  isEndedMessage,
}: {
  results: WorkspaceTestResult[];
  verdict: WorkspaceVerdict;
  rowCount: number;
  visibleCount: number;
  judging: boolean;
  running: boolean;
  isEndedMessage?: string;
}) {
  return (
    <div style={{ borderTop: "1px solid var(--line-2)", flexShrink: 0 }}>
      <div
        style={{
          padding: "8px 16px",
          background: "var(--bg-2)",
          borderBottom: "1px solid var(--line-2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            font: "650 10px var(--font)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--ink-3)",
          }}
        >
          Test Cases
        </span>
        {verdict === "pending" && (
          <span
            style={{ fontSize: 11, color: "var(--accent)", display: "flex", alignItems: "center", gap: 4 }}
          >
            <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> Judging…
          </span>
        )}
      </div>

      <div style={{ maxHeight: 180, overflowY: "auto" }}>
        {results.length === 0 && !judging && !running ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--ink-3)", fontSize: 12 }}>
            {isEndedMessage ?? "Run or submit your solution to see results."}
          </div>
        ) : (
          Array.from({ length: rowCount }).map((_, i) => {
            const r = results[i];
            const isSample = i < visibleCount;
            const fallbackLabel = isSample ? `Sample ${i + 1}` : `Hidden ${i - visibleCount + 1}`;
            const label = r?.label ?? fallbackLabel;
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "7px 16px",
                  borderBottom: "1px solid var(--surface-2)",
                  gap: 8,
                  fontSize: 12,
                  color: "var(--ink-2)",
                }}
              >
                <span style={{ width: 28, color: "var(--ink-3)", fontSize: 11 }}>{i + 1}.</span>
                {!r ? (
                  <span style={{ color: "var(--ink-3)", display: "flex", alignItems: "center", gap: 4 }}>
                    {!isSample && <Lock size={11} />}
                    {label}
                  </span>
                ) : r.status === "pass" ? (
                  <>
                    <CheckCircle2 size={14} color="var(--accent)" />
                    <span style={{ flex: 1, fontWeight: 500 }}>{label}</span>
                    <span style={{ color: "var(--ink-3)", fontSize: 11 }}>
                      {r.executionTimeMs ? `${r.executionTimeMs} ms` : "OK"}
                    </span>
                  </>
                ) : r.status === "tle" || r.status === "mle" ? (
                  <>
                    <XCircle size={14} color="var(--warn)" />
                    <span style={{ flex: 1, fontWeight: 500 }}>{label}</span>
                    <span style={{ color: "var(--warn)", fontSize: 11 }}>
                      {r.status.toUpperCase()}
                    </span>
                  </>
                ) : r.status === "error" ? (
                  <>
                    <XCircle size={14} color="var(--danger)" />
                    <span style={{ flex: 1, fontWeight: 500 }}>{label}</span>
                    <span style={{ color: "var(--danger)", fontSize: 11 }}>RE</span>
                  </>
                ) : (
                  <>
                    <XCircle size={14} color="var(--danger)" />
                    <span style={{ flex: 1, fontWeight: 500 }}>{label}</span>
                    <span style={{ color: "var(--danger)", fontSize: 11 }}>WA</span>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>

      {verdict && verdict !== "pending" && (
        <div
          style={{
            padding: "10px 16px",
            fontSize: 13,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 8,
            background:
              verdict === "accepted"
                ? "var(--success-soft)"
                : verdict === "tle" || verdict === "mle"
                  ? "var(--warn-soft)"
                  : "var(--danger-soft)",
            color:
              verdict === "accepted"
                ? "var(--success-ink)"
                : verdict === "tle" || verdict === "mle"
                  ? "var(--warn)"
                  : "var(--danger-ink)",
          }}
        >
          {verdict === "accepted" ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          {verdict === "accepted"
            ? "Accepted — All test cases passed"
            : verdict === "tle"
              ? "Time Limit Exceeded"
              : verdict === "mle"
                ? "Memory Limit Exceeded"
                : verdict === "error"
                  ? "Runtime / Compile Error"
                  : "Wrong Answer — Some test cases failed"}
        </div>
      )}
    </div>
  );
}

// ── Button styles ───────────────────────────────────────────────────────────

function ghostBtn(busy: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 9,
    font: "600 13.5px var(--font)",
    cursor: busy ? "not-allowed" : "pointer",
    padding: "11px 14px",
    border: "1px solid rgba(255,255,255,.09)",
    background: "var(--surface-2)",
    color: "var(--ink)",
    opacity: busy ? 0.6 : 1,
    transition: "all 120ms",
  };
}

function primaryBtn(busy: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 9,
    font: "700 13.5px var(--font)",
    cursor: busy ? "not-allowed" : "pointer",
    padding: "11px 14px",
    border: "1px solid var(--accent)",
    background: busy ? "var(--surface-3)" : "var(--accent)",
    color: busy ? "var(--ink-3)" : "#0a0a0a",
    transition: "all 120ms",
  };
}
