"use client";

import { useState } from "react";
import { Trophy, ChevronDown } from "lucide-react";
import { type ExamResultsDTO, type ExamProblemResultDTO } from "@/lib/api";

const VERDICT: Record<string, { label: string; color: string; bg: string; border: string }> = {
  AC:      { label: "Accepted",      color: "var(--accent)",     bg: "rgba(0,255,0,.1)",  border: "rgba(0,255,0,.18)" },
  WA:      { label: "Wrong Answer",  color: "var(--danger-ink)", bg: "var(--danger-soft)",  border: "rgba(240,99,122,.18)" },
  PARTIAL: { label: "Partial",       color: "var(--warn)",       bg: "var(--warn-soft)",    border: "rgba(232,160,48,.18)" },
  NS:      { label: "Not submitted", color: "var(--ink-3)",      bg: "var(--surface-2)",    border: "rgba(255,255,255,.08)" },
};

/** Full-width post-exam results view — grade hero, stats, per-problem cards. */
export default function ExamResults({ data }: { data: ExamResultsDTO }) {
  const [openId, setOpenId] = useState<string | null>(data.problems[0]?.problemId ?? null);

  return (
    <div style={{ flex: 1, overflowY: "auto", background: "var(--bg)" }}>
      {/* Hero */}
      <div
        style={{
          textAlign: "center",
          padding: "44px 24px 36px",
          borderBottom: "1px solid var(--line-2)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(ellipse at 50% -10%, rgba(0,255,0,.07) 0%, transparent 65%)",
            pointerEvents: "none",
          }}
        />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              display: "grid",
              placeItems: "center",
              margin: "0 auto 20px",
              background: "rgba(0,255,0,.1)",
              border: "1px solid rgba(0,255,0,.22)",
            }}
          >
            <Trophy size={32} color="var(--accent)" />
          </div>
          <h2 style={{ font: "700 24px var(--font)", letterSpacing: "-0.02em", marginBottom: 4, color: "var(--ink)" }}>
            Exam complete
          </h2>
          <div style={{ color: "var(--ink-2)", fontSize: 13.5, marginBottom: 22 }}>
            {data.title} · Results released
          </div>
          <div
            style={{
              font: "800 56px var(--font-mono)",
              color: "var(--accent)",
              letterSpacing: -2,
              textShadow: "0 0 32px rgba(0,255,0,.45)",
              lineHeight: 1,
              marginBottom: 12,
            }}
          >
            {data.gradePercent}%
          </div>
          <span
            style={{
              font: "650 12.5px var(--font)",
              padding: "5px 18px",
              borderRadius: 999,
              display: "inline-block",
              color: data.passed ? "var(--accent)" : "var(--danger-ink)",
              background: data.passed ? "rgba(0,255,0,.12)" : "var(--danger-soft)",
              border: `1px solid ${data.passed ? "rgba(0,255,0,.25)" : "rgba(240,99,122,.25)"}`,
            }}
          >
            {data.passed ? "Passed" : "Failed"} · Required ≥ {data.passingScore}%
          </span>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 24px 60px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 30 }}>
          <Stat label="Final score" value={`${data.finalScore} / ${data.totalPoints}`} accent />
          <Stat label="Submitted" value={`${data.submittedCount} / ${data.problemCount}`} />
          <Stat label="Accepted" value={String(data.acceptedCount)} accent />
          <Stat label="Problems" value={String(data.problemCount)} />
        </div>

        <SectionHead>Submission results</SectionHead>
        {data.problems.map((p) => (
          <ResultCard
            key={p.problemId}
            p={p}
            open={openId === p.problemId}
            onToggle={() => setOpenId((cur) => (cur === p.problemId ? null : p.problemId))}
          />
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid rgba(255,255,255,.07)",
        borderRadius: 12,
        padding: 18,
        textAlign: "center",
      }}
    >
      <div
        style={{
          font: "650 10px var(--font)",
          letterSpacing: "0.09em",
          textTransform: "uppercase",
          color: "var(--ink-3)",
          marginBottom: 9,
        }}
      >
        {label}
      </div>
      <div style={{ font: "700 22px var(--font-mono)", color: accent ? "var(--accent)" : "var(--ink)" }}>
        {value}
      </div>
    </div>
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
        marginBottom: 14,
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      {children}
      <span style={{ flex: 1, height: 1, background: "rgba(255,255,255,.07)" }} />
    </div>
  );
}

function ResultCard({
  p,
  open,
  onToggle,
}: {
  p: ExamProblemResultDTO;
  open: boolean;
  onToggle: () => void;
}) {
  const v = VERDICT[p.verdict] ?? VERDICT.NS;
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid rgba(255,255,255,.07)",
        borderRadius: 12,
        overflow: "hidden",
        marginBottom: 10,
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "15px 18px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          borderBottom: open ? "1px solid rgba(255,255,255,.07)" : "none",
          textAlign: "left",
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 9,
            display: "grid",
            placeItems: "center",
            font: "700 14px var(--font-mono)",
            flex: "none",
            color: v.color,
            background: v.bg,
            border: `1px solid ${v.border}`,
          }}
        >
          {p.label}
        </div>
        <div style={{ flex: 1, font: "650 14.5px var(--font)", color: "var(--ink)" }}>{p.title}</div>
        <div style={{ font: "600 13px var(--font-mono)", color: "var(--ink-2)", marginRight: 8 }}>
          <b style={{ color: "var(--ink)", fontWeight: 700 }}>{p.earnedPoints}</b> / {p.maxPoints} pts
        </div>
        <span
          style={{
            font: "650 11.5px var(--font-mono)",
            padding: "4px 10px",
            borderRadius: 7,
            color: v.color,
            background: v.bg,
            border: `1px solid ${v.border}`,
          }}
        >
          {v.label}
        </span>
        <ChevronDown
          size={16}
          color="var(--ink-3)"
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 120ms", flex: "none" }}
        />
      </button>

      {open && (
        <div style={{ padding: "16px 18px", background: "rgba(0,0,0,.12)" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 0",
              fontSize: 12.5,
              color: "var(--ink-2)",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                flex: "none",
                background:
                  p.verdict === "AC"
                    ? "var(--accent)"
                    : p.verdict === "NS"
                      ? "var(--ink-3)"
                      : "var(--danger)",
              }}
            />
            <span style={{ flex: 1 }}>
              {p.totalCases > 0
                ? `${p.passedCases} / ${p.totalCases} test cases passed`
                : "No judged test cases"}
            </span>
          </div>

          <div
            style={{
              font: "650 10px var(--font)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--ink-3)",
              margin: "14px 0 8px",
            }}
          >
            Your submitted code{p.language ? ` · ${p.language}` : ""}
          </div>
          <pre
            style={{
              background: "#0c0c0c",
              border: "1px solid rgba(255,255,255,.07)",
              borderRadius: 9,
              padding: 14,
              font: "400 12px var(--font-mono)",
              color: "#88a888",
              lineHeight: 1.65,
              maxHeight: 220,
              overflow: "auto",
              margin: 0,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {p.submittedCode || "— No submission —"}
          </pre>
        </div>
      )}
    </div>
  );
}
