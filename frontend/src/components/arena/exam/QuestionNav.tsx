"use client";

import { type ExamProblemDTO } from "@/lib/api";

interface QuestionNavProps {
  problems: ExamProblemDTO[];
  currentIndex: number;
  onSelect: (index: number) => void;
  /** Column heading — "Questions" for exams, "Tasks" for TPs. */
  label?: string;
  /**
   * TP mode: render each problem's score under the grid instead of a plain
   * answered/not legend. When provided, the legend is replaced by a per-task
   * score list.
   */
  scoreOf?: (problem: ExamProblemDTO) => { earned: number; total: number } | null;
}

/**
 * Left rail of the arena — a badge grid of every problem/task with an
 * answered (green) / current (glow outline) state, plus a legend or, in TP
 * mode, a per-task score summary.
 */
export default function QuestionNav({
  problems,
  currentIndex,
  onSelect,
  label = "Questions",
  scoreOf,
}: QuestionNavProps) {
  const answered = problems.filter((p) => p.solvedByCurrentUser).length;

  return (
    <div
      style={{
        background: "var(--bg-2)",
        borderRight: "1px solid var(--line-2)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        height: "100%",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "14px 16px 12px",
          borderBottom: "1px solid var(--line-2)",
          flex: "none",
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
          {label}
        </span>
        <span style={{ font: "600 12px var(--font-mono)", color: "var(--accent)" }}>
          {answered} / {problems.length}
        </span>
      </div>

      {/* Badge grid */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {problems.length === 0 ? (
          <div style={{ padding: 16, fontSize: 12, color: "var(--ink-3)" }}>
            No {label.toLowerCase()} assigned.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 8,
              padding: 14,
            }}
          >
            {problems.map((p, i) => {
              const done = p.solvedByCurrentUser;
              const now = i === currentIndex;
              return (
                <button
                  key={p.problemId}
                  type="button"
                  onClick={() => onSelect(i)}
                  title={`${p.label}. ${p.title}`}
                  style={{
                    aspectRatio: "1",
                    borderRadius: 10,
                    display: "grid",
                    placeItems: "center",
                    font: "700 14px var(--font-mono)",
                    cursor: "pointer",
                    userSelect: "none",
                    transition: "all 100ms",
                    background: done
                      ? now
                        ? "rgba(0,200,150,.15)"
                        : "rgba(0,200,150,.10)"
                      : now
                        ? "var(--surface-2)"
                        : "var(--surface)",
                    border: now
                      ? "2px solid var(--accent)"
                      : done
                        ? "1.5px solid rgba(0,200,150,.28)"
                        : "1.5px solid rgba(255,255,255,.07)",
                    boxShadow: now ? "0 0 0 3px rgba(0,200,150,.15)" : "none",
                    color: done ? "var(--accent)" : now ? "var(--ink)" : "var(--ink-3)",
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Legend / per-task scores */}
      {scoreOf ? (
        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid var(--line-2)",
            flex: "none",
            maxHeight: "40%",
            overflowY: "auto",
          }}
        >
          {problems.map((p) => {
            const s = scoreOf(p);
            return (
              <div
                key={p.problemId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "4px 0",
                  fontSize: 12,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 3,
                    flex: "none",
                    background:
                      s && s.earned > 0 ? "var(--accent)" : "var(--surface-3)",
                  }}
                />
                <span
                  style={{
                    flex: 1,
                    color: "var(--ink-2)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {p.label}. {p.title}
                </span>
                <span style={{ font: "500 11.5px var(--font-mono)", color: "var(--ink-3)" }}>
                  {s ? `${s.earned} / ${s.total}` : `— / ${p.points}`}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid var(--line-2)",
            flex: "none",
          }}
        >
          <Legend color="rgba(0,200,150,.6)" text="Answered" />
          <Legend color="var(--surface-3)" text="Not answered" />
        </div>
      )}
    </div>
  );
}

function Legend({ color, text }: { color: string; text: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        fontSize: 12.5,
        color: "var(--ink-2)",
        padding: "4px 0",
      }}
    >
      <span style={{ width: 10, height: 10, borderRadius: 3, flex: "none", background: color }} />
      {text}
    </div>
  );
}
