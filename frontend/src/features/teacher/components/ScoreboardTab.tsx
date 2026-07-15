"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { getScoreboard, type ScoreboardDTO, type ScoreboardCell } from "@/lib/api";

const MONO = "var(--font-mono), ui-monospace, monospace";

/** Per-problem, per-student score grid shared by the TP and Exam manage pages. */
export default function ScoreboardTab({ assessmentId }: { assessmentId: string }) {
  const [data, setData] = useState<ScoreboardDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getScoreboard(assessmentId)
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : "Failed to load scores"); });
    return () => { alive = false; };
  }, [assessmentId]);

  if (error) return <div style={{ padding: 32, textAlign: "center", color: "var(--danger)" }}>{error}</div>;
  if (!data) return <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} /></div>;

  if (data.students.length === 0) {
    return (
      <div className="psp-empty" style={{ padding: "32px 24px" }}>
        <div className="psp-empty-title">No submissions yet</div>
        <div>Scores appear here once students start submitting.</div>
      </div>
    );
  }

  const th: React.CSSProperties = {
    padding: "10px 12px", textAlign: "center", fontSize: 11, fontWeight: 700,
    color: "var(--ink-3)", letterSpacing: "0.04em", textTransform: "uppercase",
    borderBottom: "1px solid var(--line-2)", whiteSpace: "nowrap",
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 14, marginBottom: 14, fontSize: 12, color: "var(--ink-3)" }}>
        <span>Scoring: <strong style={{ color: "var(--ink-2)" }}>{data.scoringMode.replace(/_/g, " ")}</strong></span>
        {data.penaltyPercent != null && data.penaltyPercent > 0 && (
          <span>Penalty: <strong style={{ color: "var(--ink-2)" }}>-{data.penaltyPercent}% / failed attempt</strong></span>
        )}
        {data.passingScore != null && (
          <span>Passing score: <strong style={{ color: "var(--ink-2)" }}>{data.passingScore}%</strong></span>
        )}
      </div>

      <div style={{ overflowX: "auto", border: "1px solid var(--line)", borderRadius: "var(--r)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: "left" }}>Student</th>
              {data.problems.map((p, i) => (
                <th key={p.problemId} style={th}>
                  {String.fromCharCode(65 + i)} ({p.maxPoints}pts)
                </th>
              ))}
              <th style={th}>Total</th>
              {data.passingScore != null && <th style={th}>Status</th>}
            </tr>
          </thead>
          <tbody>
            {data.students.map((s) => (
              <tr key={s.studentId} style={{ borderBottom: "1px solid var(--line)" }}>
                <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                  {s.fullName}
                  <div style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 400 }}>{s.email}</div>
                </td>
                {s.scores.map((cell) => <ScoreCell key={cell.problemId} score={cell} />)}
                <td style={{ padding: "10px 12px", textAlign: "center", fontFamily: MONO, fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
                  {s.percentage}%
                </td>
                {data.passingScore != null && (
                  <td style={{ padding: "10px 12px", textAlign: "center" }}>
                    <StatusBadge status={s.status} percentage={s.percentage} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ScoreCell({ score }: { score: ScoreboardCell }) {
  const verdictColor: Record<string, string> = {
    AC: "var(--accent)", WA: "var(--danger)", PARTIAL: "var(--warn)",
  };
  const color = score.verdict ? (verdictColor[score.verdict] ?? "var(--ink-3)") : "var(--ink-3)";

  return (
    <td style={{ padding: "10px 12px", textAlign: "center", borderLeft: "1px solid var(--line)" }}>
      <div style={{
        fontFamily: MONO, fontSize: 13, fontWeight: 700,
        color: score.earnedPoints > 0 ? color : "var(--ink-3)",
      }}>
        {score.earnedPoints} / {score.maxPoints}
      </div>
      <div style={{ fontSize: 10, color, marginTop: 2 }}>
        {score.verdict ?? "—"}
        {score.attemptsUsed > 0 && (
          <span style={{ color: "var(--ink-3)", marginLeft: 4 }}>({score.attemptsUsed} att.)</span>
        )}
      </div>
    </td>
  );
}

function StatusBadge({ status, percentage }: { status: "PASS" | "FAIL" | null; percentage: number }) {
  if (!status) return <span style={{ color: "var(--ink-3)", fontSize: 12 }}>—</span>;
  const pass = status === "PASS";
  return (
    <span style={{
      fontFamily: MONO, fontSize: 11, fontWeight: 700,
      padding: "3px 10px", borderRadius: 20,
      color: pass ? "var(--accent)" : "var(--danger)",
      background: pass ? "var(--accent-dim, rgba(0,200,150,.10))" : "var(--danger-soft)",
      border: `1px solid ${pass ? "rgba(0,200,150,.2)" : "rgba(240,99,122,.2)"}`,
    }}>
      {status} {percentage}%
    </span>
  );
}
