"use client";

import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { type ExamProblemDTO } from "@/lib/api";

interface QuestionStatementProps {
  problem: ExamProblemDTO | null;
  currentIndex: number;
  totalCount: number;
  onPrev: () => void;
  onNext: () => void;
  /** "Question" for exams, "Task" for TPs. */
  noun?: string;
}

const DIFF_CLASS: Record<string, { color: string; bg: string; border: string }> = {
  EASY:   { color: "var(--accent)", bg: "rgba(0,200,150,.08)", border: "rgba(0,200,150,.2)" },
  MEDIUM: { color: "var(--warn)",   bg: "var(--warn-soft)",    border: "rgba(232,160,48,.2)" },
  HARD:   { color: "var(--danger)", bg: "var(--danger-soft)",  border: "rgba(240,99,122,.2)" },
};

/** Center column — problem statement with prev/next nav, tags and IO samples. */
export default function QuestionStatement({
  problem,
  currentIndex,
  totalCount,
  onPrev,
  onNext,
  noun = "Question",
}: QuestionStatementProps) {
  if (!problem) {
    return (
      <div
        style={{
          background: "var(--bg)",
          borderRight: "1px solid var(--line-2)",
          height: "100%",
          display: "grid",
          placeItems: "center",
          color: "var(--ink-3)",
          fontSize: 13,
        }}
      >
        Select a {noun.toLowerCase()} from the left panel.
      </div>
    );
  }

  const diff = DIFF_CLASS[problem.difficulty];
  const diffLabel = problem.difficulty
    ? problem.difficulty.charAt(0) + problem.difficulty.slice(1).toLowerCase()
    : "";

  return (
    <div
      style={{
        background: "var(--bg)",
        borderRight: "1px solid var(--line-2)",
        overflowY: "auto",
        height: "100%",
        padding: "26px 30px 80px",
      }}
    >
      {/* Prev / Next nav */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 22 }}>
        <NavBtn onClick={onPrev} disabled={currentIndex <= 0}>
          <ChevronLeft size={14} /> Prev
        </NavBtn>
        <NavBtn onClick={onNext} disabled={currentIndex >= totalCount - 1}>
          Next <ChevronRight size={14} />
        </NavBtn>
        <span style={{ font: "500 12px var(--font-mono)", color: "var(--ink-3)", marginLeft: "auto" }}>
          {noun} {currentIndex + 1} of {totalCount}
        </span>
      </div>

      {/* Letter + title */}
      <div
        style={{
          font: "700 28px var(--font-mono)",
          color: "var(--accent)",
          lineHeight: 1,
          marginBottom: 6,
          textShadow: "0 0 20px rgba(0,200,150,.25)",
        }}
      >
        {problem.label}.
      </div>
      <div
        style={{
          font: "700 22px var(--font)",
          letterSpacing: "-0.02em",
          marginBottom: 14,
          lineHeight: 1.2,
          color: "var(--ink)",
        }}
      >
        {problem.title}
      </div>

      {/* Tags */}
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 22 }}>
        <Tag>{problem.timeLimitMs} ms</Tag>
        <Tag>{problem.memoryLimitMb} MB</Tag>
        {diffLabel && (
          <Tag color={diff?.color} bg={diff?.bg} border={diff?.border}>
            {diffLabel}
          </Tag>
        )}
        <Tag>{problem.points} pts</Tag>
      </div>

      {/* Body */}
      <div>
        {problem.description ? (
          problem.description.split("\n").map((line, i) => (
            <p
              key={i}
              style={{ lineHeight: 1.78, color: "#a8bea8", marginBottom: 14, fontSize: 14 }}
            >
              {line || <>&nbsp;</>}
            </p>
          ))
        ) : (
          <p style={{ color: "var(--ink-3)", fontSize: 14 }}>No description provided.</p>
        )}

        {problem.visibleTestCases.length > 0 && (
          <>
            <SectionHead>Sample test cases</SectionHead>
            {problem.visibleTestCases.map((tc) => (
              <div
                key={tc.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                <IoBox label="Input" text={tc.input} />
                <IoBox label="Output" text={tc.expectedOutput} />
              </div>
            ))}
          </>
        )}

        {problem.hiddenTestCaseCount > 0 && (
          <>
            <SectionHead>Hidden test cases</SectionHead>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12.5,
                color: "var(--ink-3)",
                border: "1px solid rgba(255,255,255,.07)",
                borderRadius: 10,
                background: "var(--surface)",
                padding: "10px 14px",
              }}
            >
              <Lock size={13} /> {problem.hiddenTestCaseCount} hidden test case
              {problem.hiddenTestCaseCount === 1 ? "" : "s"} run at judging time
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function NavBtn({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "7px 13px",
        borderRadius: 8,
        font: "600 13px var(--font)",
        cursor: disabled ? "not-allowed" : "pointer",
        border: "1px solid var(--line-2)",
        background: "var(--surface-2)",
        color: "var(--ink-2)",
        opacity: disabled ? 0.4 : 1,
        transition: "all 100ms",
      }}
    >
      {children}
    </button>
  );
}

function Tag({
  children,
  color,
  bg,
  border,
}: {
  children: React.ReactNode;
  color?: string;
  bg?: string;
  border?: string;
}) {
  return (
    <span
      style={{
        font: "500 11.5px var(--font-mono)",
        color: color ?? "var(--ink-2)",
        border: `1px solid ${border ?? "rgba(255,255,255,.08)"}`,
        borderRadius: 7,
        padding: "5px 11px",
        background: bg ?? "var(--surface-2)",
      }}
    >
      {children}
    </span>
  );
}

function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        font: "650 10.5px var(--font)",
        letterSpacing: "0.09em",
        textTransform: "uppercase",
        color: "var(--ink-3)",
        margin: "24px 0 12px",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      {children}
      <span style={{ flex: 1, height: 1, background: "rgba(255,255,255,.06)" }} />
    </div>
  );
}

function IoBox({ label, text }: { label: string; text: string }) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,.07)",
        borderRadius: 10,
        overflow: "hidden",
        background: "#0c0c0c",
      }}
    >
      <div
        style={{
          font: "650 10px var(--font)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--ink-3)",
          padding: "8px 12px",
          borderBottom: "1px solid rgba(255,255,255,.05)",
          background: "var(--surface-2)",
        }}
      >
        {label}
      </div>
      <pre
        style={{
          font: "400 12.5px var(--font-mono)",
          padding: 12,
          color: "#88a888",
          lineHeight: 1.6,
          margin: 0,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {text}
      </pre>
    </div>
  );
}
