"use client";

import { CheckCircle2, Sparkles, Star } from "lucide-react";
import type { CTFCompetitionChallengeDTO } from "@/lib/api";
import { CAT_CONFIG, DIFF_COLORS } from "./categoryConfig";

interface Props {
  challenge: CTFCompetitionChallengeDTO;
  onOpen:    (id: string) => void;
  /** Show NEW badge (typically for 60s after a NEW_CHALLENGE notification). */
  isNew?:    boolean;
  /** When the team has solved: extra meta (time ago, solver name). Optional. */
  solvedMeta?: { atIso: string | null; solverName: string | null; pointsAwarded: number | null };
}

export default function ChallengeCard({ challenge: c, onOpen, isNew, solvedMeta }: Props) {
  const conf   = CAT_CONFIG[c.category];
  const accent = conf?.accent ?? "var(--ink-2)";
  const solved = c.solvedByMe;

  const displayPts = c.currentPoints ?? c.basePoints;
  const maxPts = c.basePoints || 1;
  const barPct = Math.max(5, Math.round((displayPts / maxPts) * 100));

  return (
    <button
      type="button"
      onClick={() => onOpen(c.id)}
      style={{
        background: solved ? "rgba(34,197,94,0.05)" : "var(--bg-2)",
        border: `1px solid ${solved ? "rgba(34,197,94,0.3)" : "var(--line)"}`,
        borderLeft: solved ? "3px solid var(--success)" : "1px solid var(--line)",
        borderRadius: 8,
        padding: "14px 16px",
        display: "flex", flexDirection: "column", gap: 10,
        textAlign: "left", color: "inherit", cursor: "pointer",
        transition: "border-color 150ms, transform 100ms",
      }}
      onMouseEnter={e => {
        if (!solved) (e.currentTarget as HTMLButtonElement).style.borderColor = `${accent}80`;
      }}
      onMouseLeave={e => {
        if (!solved) (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--line)";
      }}
    >
      {/* Header row: category icon + badges */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
          color: accent, textTransform: "uppercase",
        }}>
          {conf?.icon} {c.category}
        </span>
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          {isNew && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 3,
              fontSize: 9, fontWeight: 700, color: "#a78bfa",
              background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.45)",
              borderRadius: 3, padding: "1px 6px",
            }}>
              <Sparkles size={9} /> NEW
            </span>
          )}
          {solved && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 3,
              fontSize: 10, fontWeight: 700, color: "var(--success)",
              background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)",
              borderRadius: 4, padding: "1px 6px",
            }}>
              <CheckCircle2 size={9} /> SOLVED
            </span>
          )}
          <span style={{
            fontSize: 10, fontWeight: 700,
            color: DIFF_COLORS[c.difficulty] ?? "var(--ink-2)",
            background: `${DIFF_COLORS[c.difficulty] ?? "var(--ink-2)"}18`,
            border: `1px solid ${DIFF_COLORS[c.difficulty] ?? "var(--ink-2)"}30`,
            borderRadius: 4, padding: "1px 6px",
          }}>
            {c.difficulty}
          </span>
        </div>
      </div>

      {/* Title */}
      <div style={{ fontSize: 15, fontWeight: 700, color: solved ? "var(--ink-2)" : "var(--ink)", lineHeight: 1.3 }}>
        {c.title}
      </div>

      {/* Solved-by line OR points bar */}
      {solved && solvedMeta ? (
        <div style={{ fontSize: 11, color: "var(--ink-2)" }}>
          Solved
          {solvedMeta.solverName ? ` by ${solvedMeta.solverName}` : ""}
          {solvedMeta.atIso ? ` · ${timeAgo(solvedMeta.atIso)}` : ""}
          {solvedMeta.pointsAwarded !== null ? ` · +${solvedMeta.pointsAwarded} pts` : ""}
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: "var(--ink-2)", fontFamily: "ui-monospace, monospace" }}>
              {c.solveCount} solve{c.solveCount !== 1 ? "s" : ""}
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: accent }}>{displayPts} pts</span>
          </div>
          <div style={{ height: 3, background: "var(--line)", borderRadius: 2 }}>
            <div style={{
              height: "100%", borderRadius: 2,
              background: accent, opacity: 0.65,
              width: `${barPct}%`, transition: "width 500ms ease",
            }} />
          </div>
        </div>
      )}

      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        fontSize: 11, color: "var(--ink-3)",
      }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <Star size={11} color="var(--ink-2)" /> {c.solveCount} teams solved
        </span>
        {!solved && (
          <span style={{ color: accent, fontWeight: 600 }}>Open →</span>
        )}
      </div>
    </button>
  );
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000)     return "just now";
  if (ms < 3_600_000)  return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}
