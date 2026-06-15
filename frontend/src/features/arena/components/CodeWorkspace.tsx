"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { Play, Send, Lock, CheckCircle2, XCircle, Loader2 } from "lucide-react";

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
  editorTheme = "vs-dark",
  editorFontSize = 12,
}: CodeWorkspaceProps) {
  const monacoLang = useMemo(() => {
    // Monaco's id matches our value for these
    return language;
  }, [language]);

  const busy = running || judging || disabled;
  const rowCount = Math.max(totalCases ?? 0, results.length);

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: "var(--bg-primary)",
    }}>
      {/* ── Toolbar ── */}
      <div style={{
        padding: "8px 12px", background: "var(--bg-tertiary)",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
          Language
        </span>
        <select
          value={language}
          onChange={(e) => onLanguageChange(e.target.value)}
          disabled={disabled}
          style={{
            border: "1px solid var(--border)", borderRadius: 3,
            padding: "0 8px", height: 28, fontSize: 12,
            color: "var(--text-primary)", outline: "none",
            background: "var(--bg-primary)",
          }}
        >
          {languageOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {onRun && (
            <button
              type="button"
              onClick={onRun}
              disabled={busy}
              style={{
                background: "var(--bg-primary)", color: "var(--text-primary)",
                border: "1px solid var(--border)", borderRadius: 3,
                height: 28, padding: "0 12px", fontSize: 12,
                cursor: busy ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", gap: 4,
                opacity: busy ? 0.5 : 1,
              }}
            >
              {running
                ? <><Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> Running…</>
                : <><Play size={11} /> Run</>}
            </button>
          )}
          <button
            type="button"
            onClick={onSubmit}
            disabled={busy}
            style={{
              background: busy ? "#97a0af" : "var(--brand)", color: "white",
              border: "none", borderRadius: 3,
              height: 28, padding: "0 14px", fontSize: 12,
              cursor: busy ? "not-allowed" : "pointer",
              fontWeight: 600, display: "flex", alignItems: "center", gap: 4,
            }}
          >
            {judging
              ? <><Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> Judging…</>
              : <><Send size={11} /> Submit</>}
          </button>
        </div>
      </div>

      {/* ── Editor ── */}
      <div style={{ flex: 1, overflow: "hidden", minHeight: 260 }}>
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

      {/* ── Results ── */}
      <div style={{ borderTop: "1px solid var(--border)", flexShrink: 0 }}>
        <div style={{
          padding: "8px 12px", background: "var(--bg-tertiary)",
          borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
            Test Cases
          </span>
          {verdict === "pending" && (
            <span style={{
              fontSize: 11, color: "#0747a6",
              display: "flex", alignItems: "center", gap: 4,
            }}>
              <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} />
              Judging…
            </span>
          )}
        </div>

        <div style={{ maxHeight: 200, overflowY: "auto" }}>
          {results.length === 0 && !judging && !running ? (
            <div style={{
              padding: 24, textAlign: "center",
              color: "var(--text-muted)", fontSize: 12,
            }}>
              {isEndedMessage ?? "Run or submit your solution to see results."}
            </div>
          ) : (
            Array.from({ length: rowCount }).map((_, i) => {
              const r = results[i];
              const isSample = i < visibleCount;
              const fallbackLabel = isSample
                ? `Sample ${i + 1}`
                : `Hidden ${i - visibleCount + 1}`;
              const label = r?.label ?? fallbackLabel;
              return (
                <div
                  key={i}
                  style={{
                    display: "flex", alignItems: "center",
                    padding: "7px 12px", borderBottom: "1px solid #f4f5f7",
                    gap: 8, fontSize: 12,
                  }}
                >
                  <span style={{ width: 28, color: "var(--text-muted)", fontSize: 11 }}>
                    {i + 1}.
                  </span>
                  {!r ? (
                    <span style={{ color: "var(--text-subtle)", display: "flex", alignItems: "center", gap: 4 }}>
                      {!isSample && <Lock size={11} />}
                      {label}
                    </span>
                  ) : r.status === "pass" ? (
                    <>
                      <CheckCircle2 size={14} color="#00875a" />
                      <span style={{ flex: 1, fontWeight: 500 }}>{label}</span>
                      <span style={{ color: "var(--text-muted)", fontSize: 11 }}>
                        {r.executionTimeMs ? `${r.executionTimeMs} ms` : "OK"}
                      </span>
                    </>
                  ) : r.status === "tle" ? (
                    <>
                      <XCircle size={14} color="var(--warn)" />
                      <span style={{ flex: 1, fontWeight: 500 }}>{label}</span>
                      <span style={{ color: "var(--warn)", fontSize: 11 }}>TLE</span>
                    </>
                  ) : r.status === "mle" ? (
                    <>
                      <XCircle size={14} color="var(--warn)" />
                      <span style={{ flex: 1, fontWeight: 500 }}>{label}</span>
                      <span style={{ color: "var(--warn)", fontSize: 11 }}>MLE</span>
                    </>
                  ) : r.status === "error" ? (
                    <>
                      <XCircle size={14} color="#de350b" />
                      <span style={{ flex: 1, fontWeight: 500 }}>{label}</span>
                      <span style={{ color: "#de350b", fontSize: 11 }}>RE</span>
                    </>
                  ) : (
                    <>
                      <XCircle size={14} color="#de350b" />
                      <span style={{ flex: 1, fontWeight: 500 }}>{label}</span>
                      <span style={{ color: "#de350b", fontSize: 11 }}>WA</span>
                    </>
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
            background:
              verdict === "accepted" ? "#e3fcef" :
              verdict === "tle" || verdict === "mle" ? "#fffae6" :
              "#ffebe6",
            color:
              verdict === "accepted" ? "#006644" :
              verdict === "tle" || verdict === "mle" ? "var(--warn)" :
              "#bf2600",
          }}>
            {verdict === "accepted" ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            {verdict === "accepted" ? "Accepted — All test cases passed" :
             verdict === "tle"      ? "Time Limit Exceeded" :
             verdict === "mle"      ? "Memory Limit Exceeded" :
             verdict === "error"    ? "Runtime / Compile Error" :
             "Wrong Answer — Some test cases failed"}
          </div>
        )}
      </div>
    </div>
  );
}
