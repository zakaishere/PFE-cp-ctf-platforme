"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import type { ProblemDetailDTO } from "@/lib/api";

interface ProblemTopBarProps {
  problem:  ProblemDetailDTO | null;
  loading?: boolean;
  initials?: string;
}

export function ProblemTopBar({ problem, loading, initials = "U" }: ProblemTopBarProps) {
  return (
    <div style={{
      height: 44,
      background: "var(--bg-2)",
      borderBottom: "1px solid var(--line)",
      display: "flex",
      alignItems: "center",
      padding: "0 16px",
      gap: 12,
      flexShrink: 0,
    }}>
      {/* Logo */}
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: 6, textDecoration: "none", flexShrink: 0 }}>
        <img src="/algora-logo-icon.png" alt="" width={26} height={26} style={{ objectFit: "contain" }} />
      </Link>

      <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 16 }}>|</span>

      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, minWidth: 0 }}>
        <Link
          href="/problems"
          style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none", whiteSpace: "nowrap" }}
          onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.85)")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}
        >
          Problems
        </Link>
        <span style={{ color: "rgba(255,255,255,0.25)", flexShrink: 0 }}>›</span>
        <span style={{
          color: "rgba(255,255,255,0.85)",
          fontWeight: 600,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          maxWidth: 260,
        }}>
          {loading ? "Loading…" : (problem?.title ?? "Problem")}
        </span>
        {problem?.authorName && !loading && (
          <span style={{ color: "rgba(255,255,255,0.4)", fontWeight: 400, marginLeft: 2 }}>
            (By {problem.authorName})
          </span>
        )}
      </div>

      {problem && <DifficultyBadge difficulty={problem.difficulty} />}

      {/* Solved badge */}
      {problem?.solvedByCurrentUser && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "3px 10px",
          background: "rgba(87,217,163,0.12)",
          border: "1px solid rgba(87,217,163,0.25)",
          borderRadius: 20,
          fontSize: 12, fontWeight: 700, color: "var(--success-ink)", flexShrink: 0,
        }}>
          <CheckCircle2 size={12} />
          Solved
        </div>
      )}

      <div style={{ flex: 1 }} />

      {/* Acceptance stats */}
      {problem && (
        <div style={{ display: "flex", gap: 12, fontSize: 11, color: "rgba(255,255,255,0.4)", flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <span style={{ color: "rgba(87,217,163,0.8)", fontWeight: 700 }}>
              {problem.acceptanceRate?.toFixed(1) ?? "0.0"}%
            </span>
            <span>accepted</span>
          </div>
          <div style={{ color: "rgba(255,255,255,0.2)" }}>·</div>
          <div>{(problem.totalSubmissions ?? 0).toLocaleString()} submissions</div>
        </div>
      )}

      {/* User avatar */}
      <div style={{
        width: 28, height: 28,
        background: "var(--brand)",
        borderRadius: "50%",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "white", fontSize: 10, fontWeight: 700,
        flexShrink: 0, cursor: "pointer",
      }} title="Profile">
        {initials}
      </div>
    </div>
  );
}

export function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const config: Record<string, { bg: string; color: string; text: string }> = {
    EASY:   { bg: "var(--success-soft)", color: "var(--success-ink)", text: "Easy"   },
    MEDIUM: { bg: "var(--warn-soft)",    color: "var(--warn-ink)",    text: "Medium" },
    HARD:   { bg: "var(--danger-soft)",  color: "var(--danger-ink)",  text: "Hard"   },
  };
  const c = config[difficulty] ?? { bg: "var(--surface-2)", color: "var(--text-subtle)", text: difficulty };
  return (
    <span style={{
      padding: "2px 9px", borderRadius: 4,
      fontSize: 11, fontWeight: 700,
      background: c.bg, color: c.color, flexShrink: 0,
    }}>
      {c.text}
    </span>
  );
}
