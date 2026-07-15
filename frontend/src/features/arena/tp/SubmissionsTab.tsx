"use client";

import { useEffect, useState } from "react";
import { FileCode, Loader2 } from "lucide-react";
import { getMySubmissions, type MySubmissionDTO } from "@/lib/api";

const MONO = "var(--font-mono), ui-monospace, monospace";

// CP speaks AC/WA/TLE (competition_submissions.verdict); practice/TP/exam
// speak PASS/FAIL/TIME_OUT (results.status) — the backend already returns
// the matching vocabulary per context (see ProblemController.getMySubmissions),
// so this just needs two label sets, not a translation.
const CP_STATUS_COLOR: Record<string, string> = {
  ACCEPTED: "var(--accent)",
  WRONG_ANSWER: "var(--danger)",
  TIME_LIMIT_EXCEEDED: "var(--warn)",
  MEMORY_LIMIT_EXCEEDED: "var(--warn)",
  RUNTIME_ERROR: "var(--danger)",
  COMPILATION_ERROR: "var(--danger)",
  PENDING: "var(--ink-3)",
};
const CP_STATUS_LABEL: Record<string, string> = {
  ACCEPTED: "AC", WRONG_ANSWER: "WA", TIME_LIMIT_EXCEEDED: "TLE",
  MEMORY_LIMIT_EXCEEDED: "MLE", RUNTIME_ERROR: "RE", COMPILATION_ERROR: "CE",
  PENDING: "PENDING",
};

const RESULT_STATUS_COLOR: Record<string, string> = {
  PASS: "var(--accent)",
  FAIL: "var(--danger)",
  TIME_OUT: "var(--warn)",
  MEMORY_OUT: "var(--warn)",
  ERROR: "var(--danger)",
  PENDING: "var(--ink-3)",
};
const RESULT_STATUS_LABEL: Record<string, string> = {
  PASS: "PASS", FAIL: "FAIL", TIME_OUT: "TIME OUT",
  MEMORY_OUT: "MEMORY OUT", ERROR: "ERROR", PENDING: "PENDING",
};

/** Per-task submission history — reused by TP, exam, and CP arenas. Pass
 *  exactly one of assessmentId (TP/exam) or competitionId (CP). */
export default function SubmissionsTab({ problemId, assessmentId, competitionId }: {
  problemId: string; assessmentId?: string; competitionId?: string;
}) {
  const [subs, setSubs] = useState<MySubmissionDTO[] | null>(null);
  const isCp = !!competitionId;
  const STATUS_COLOR = isCp ? CP_STATUS_COLOR : RESULT_STATUS_COLOR;
  const STATUS_LABEL = isCp ? CP_STATUS_LABEL : RESULT_STATUS_LABEL;
  const passValue = isCp ? "ACCEPTED" : "PASS";

  useEffect(() => {
    let alive = true;
    setSubs(null);
    getMySubmissions(problemId, assessmentId, competitionId)
      .then((d) => { if (alive) setSubs(d); })
      .catch(() => { if (alive) setSubs([]); });
    return () => { alive = false; };
  }, [problemId, assessmentId, competitionId]);

  if (subs === null) {
    return <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
      <Loader2 size={20} style={{ animation: "spin 1s linear infinite", color: "var(--accent)" }} />
    </div>;
  }

  if (subs.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 0", color: "var(--ink-3)" }}>
        <FileCode size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
        <p style={{ fontSize: 14 }}>No submissions yet</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {subs.map((sub) => {
        const color = STATUS_COLOR[sub.status] ?? "var(--ink-3)";
        const isAC = sub.status === passValue;
        return (
          <div key={sub.id} style={{
            padding: "12px 16px", borderRadius: 10, background: "var(--surface)",
            border: `1px solid ${isAC ? "rgba(0,200,150,.2)" : "var(--line)"}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  fontFamily: MONO, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                  color, background: `color-mix(in srgb, ${color} 12%, transparent)`,
                  border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
                }}>
                  {STATUS_LABEL[sub.status] ?? sub.status}
                </span>
                <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--ink-3)" }}>{sub.language}</span>
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                {sub.timeMs > 0 && <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--ink-3)" }}>{sub.timeMs}ms</span>}
                <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{sub.submittedAgo}</span>
              </div>
            </div>
            <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color }}>
              {sub.score} pts
            </span>
          </div>
        );
      })}
    </div>
  );
}
