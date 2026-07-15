"use client";

import React from "react";

/**
 * Algora status pill / badge with a leading dot.
 * Variants map to the platform's semantic tokens.
 */
export type PillVariant =
  | "live" | "open" | "reg" | "closed" | "draft"
  | "exam" | "tp" | "cp";

export interface PillProps {
  variant: PillVariant;
  children: React.ReactNode;
  /** Hide the leading dot (e.g. for type tags like exam/tp/cp). */
  noDot?: boolean;
  style?: React.CSSProperties;
}

const STYLES: Record<PillVariant, { bg: string; color: string; dot: string; border?: string }> = {
  live:   { bg: "var(--danger-soft)",  color: "var(--danger)", dot: "var(--danger)" },
  open:   { bg: "var(--accent-dim)",   color: "var(--accent)", dot: "var(--accent)", border: "1px solid var(--accent-ring)" },
  reg:    { bg: "var(--warn-soft)",    color: "var(--warn)",   dot: "var(--warn)" },
  closed: { bg: "var(--surface-2)",    color: "var(--ink-2)",  dot: "var(--ink-3)", border: "1px solid var(--line-2)" },
  draft:  { bg: "var(--bg-2)",         color: "var(--ink-3)",  dot: "var(--ink-3)", border: "1px solid var(--line)" },
  exam:   { bg: "var(--warn-soft)",    color: "var(--warn)",   dot: "var(--warn)" },
  tp:     { bg: "var(--violet-soft)",  color: "var(--violet)", dot: "var(--violet)" },
  cp:     { bg: "var(--accent-dim)",   color: "var(--accent)", dot: "var(--accent)" },
};

export function Pill({ variant, children, noDot, style }: PillProps) {
  const s = STYLES[variant];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        font: "650 11.5px var(--font-ui)",
        padding: "4px 10px",
        borderRadius: 999,
        whiteSpace: "nowrap",
        background: s.bg,
        color: s.color,
        border: s.border,
        ...style,
      }}
    >
      {!noDot && (
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, flex: "none" }} />
      )}
      {children}
    </span>
  );
}

/** Alias — some call sites read better as <StatusBadge/>. */
export const StatusBadge = Pill;

export default Pill;
