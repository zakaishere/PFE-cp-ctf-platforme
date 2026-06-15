"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import type { ProblemDetailDTO } from "@/lib/api";
import { useTheme } from "@/contexts/ThemeContext";

interface ProblemTopBarProps {
  problem:  ProblemDetailDTO | null;
  loading?: boolean;
  initials?: string;
}

export function ProblemTopBar({ problem, loading, initials = "U" }: ProblemTopBarProps) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <div style={{
      height: 44,
      background: "#1a2332",
      borderBottom: "1px solid #253348",
      display: "flex",
      alignItems: "center",
      padding: "0 16px",
      gap: 12,
      flexShrink: 0,
    }}>
      {/* Logo */}
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: 6, textDecoration: "none", flexShrink: 0 }}>
        <div style={{
          width: 26, height: 26,
          background: "var(--brand)",
          borderRadius: 5,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "white", fontWeight: 900, fontSize: 12, flexShrink: 0, letterSpacing: "-0.5px",
        }}>
          P
        </div>
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
          fontSize: 12, fontWeight: 700, color: "#57d9a3", flexShrink: 0,
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

      {/* Dark mode toggle */}
      <button
        onClick={toggleTheme}
        title={isDark ? "Switch to light mode" : "Switch to dark mode"}
        style={{
          width: 28, height: 28,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.1)",
          border: "none",
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14,
          color: "white",
          flexShrink: 0,
          transition: "background 0.15s",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.2)")}
        onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
      >
        {isDark ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="4"/>
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
          </svg>
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        )}
      </button>

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
    EASY:   { bg: "rgba(0,135,90,0.15)",  color: "#57d9a3", text: "Easy"   },
    MEDIUM: { bg: "rgba(255,139,0,0.15)", color: "#ffc107", text: "Medium" },
    HARD:   { bg: "rgba(222,53,11,0.15)", color: "#ff6b4a", text: "Hard"   },
  };
  const c = config[difficulty] ?? { bg: "rgba(255,255,255,0.1)", color: "var(--text-subtle)", text: difficulty };
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
