"use client";

import { Check } from "lucide-react";
import type { ReactNode } from "react";

export type TaskRailStatus = "solved" | "attempted" | "unsolved";

export interface TaskRailItem {
  id: string;
  label: string;   // A, B, C…
  title: string;
  points: number;
  status: TaskRailStatus;
  /** Right-aligned meta text/node — e.g. "45 / 50 pts", "×2" failed attempts. */
  meta?: ReactNode;
}

export interface TaskRailProps {
  items: TaskRailItem[];
  activeIndex: number;
  onSelect: (i: number) => void;
  /** "TASKS" | "QUESTIONS" | "PROBLEMS" — arena-specific column heading. */
  heading: string;
  /** Extra content rendered below the list (progress bar, legend, team activity…). */
  footer?: ReactNode;
  /** Fixed pixel width. Omit to let the wrapping container control sizing
   *  (e.g. a mobile single-column layout that needs full width). */
  width?: number;
}

const statusStyle: Record<TaskRailStatus, { bg: string; border: string; color: string }> = {
  solved:    { bg: "rgba(0,255,0,.12)",     border: "1px solid var(--accent-ring)", color: "var(--accent)" },
  attempted: { bg: "var(--danger-soft)",    border: "1px solid transparent",         color: "var(--danger)" },
  unsolved:  { bg: "var(--surface-2)",      border: "1px solid transparent",         color: "var(--ink-2)" },
};

/**
 * Shared task/question/problem list rail used by the TP, Exam, and CP
 * competition arenas — one visual language for "what am I working on and
 * how is it going" across every arena in the platform.
 */
export default function TaskRail({ items, activeIndex, onSelect, heading, footer, width }: TaskRailProps) {
  const solvedCount = items.filter((t) => t.status === "solved").length;

  return (
    <div style={{
      ...(width !== undefined ? { width, flexShrink: 0 } : {}),
      background: "var(--bg)", display: "flex", flexDirection: "column",
      borderRight: "1px solid var(--line-2)", overflowY: "auto", height: "100%",
    }}>
      <div style={{
        padding: "14px 14px 10px", borderBottom: "1px solid var(--line-2)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, background: "var(--bg)", zIndex: 2, flex: "none",
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          {heading}
        </span>
        <span style={{ font: "600 11.5px var(--font-mono)", color: "var(--accent)" }}>
          {solvedCount} / {items.length}
        </span>
      </div>

      <div style={{ padding: 8 }}>
        {items.length === 0 ? (
          <div style={{ padding: 16, fontSize: 12, color: "var(--ink-3)", textAlign: "center" }}>
            No {heading.toLowerCase()} assigned.
          </div>
        ) : items.map((t, i) => {
          const active = activeIndex === i;
          const s = statusStyle[t.status];
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(i)}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "var(--surface-2)"; }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
              style={{
                display: "flex", alignItems: "center", gap: 9, padding: "9px 10px",
                borderRadius: 9, cursor: "pointer", marginBottom: 3, width: "100%", textAlign: "left",
                background: active ? "var(--accent-dim)" : "transparent",
                border: active ? "1px solid var(--accent-ring)" : "1px solid transparent",
                transition: "background 0.1s",
              }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: 7, display: "grid", placeItems: "center",
                font: "700 12px var(--font-mono)", flexShrink: 0,
                background: active && t.status === "unsolved" ? "var(--accent-glow)" : s.bg,
                border: s.border, color: active && t.status === "unsolved" ? "var(--accent)" : s.color,
              }}>
                {t.status === "solved" ? <Check size={14} /> : t.label}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13, color: "var(--ink)", fontWeight: 600,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {t.title}
                </div>
                <div style={{ font: "500 11px var(--font-mono)", color: "var(--ink-3)", marginTop: 2 }}>
                  {t.points} pts
                </div>
              </div>
              {t.meta !== undefined && (
                <span style={{ font: "650 11.5px var(--font-mono)", flexShrink: 0, color: s.color }}>
                  {t.meta}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {footer}
    </div>
  );
}
