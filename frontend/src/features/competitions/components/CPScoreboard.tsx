"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Snowflake, Loader2 } from "lucide-react";
import { getFullScoreboard, type FullScoreboard, type ScoreboardProblemCell } from "@/lib/api";

interface CPScoreboardProps {
  competitionId: string;
  /** Highlight the viewer's own row (teamId for TEAM, studentId for SOLO). */
  myParticipantId?: string | null;
  /** Poll interval ms (default 30s). */
  refreshMs?: number;
}

export default function CPScoreboard({
  competitionId, myParticipantId, refreshMs = 30_000,
}: CPScoreboardProps) {
  const [board, setBoard]   = useState<FullScoreboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [pulse, setPulse]   = useState(false);
  const firstLoad = useRef(true);

  const load = useCallback(async () => {
    try {
      const data = await getFullScoreboard(competitionId);
      setBoard(data);
      setPulse(true);
      setTimeout(() => setPulse(false), 800);
    } catch {
      /* silent — keep last good board */
    } finally {
      if (firstLoad.current) { setLoading(false); firstLoad.current = false; }
    }
  }, [competitionId]);

  useEffect(() => {
    load();
    const id = setInterval(load, refreshMs);
    return () => clearInterval(id);
  }, [load, refreshMs]);

  if (loading) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-primary)" }}>
        <Loader2 size={22} style={{ animation: "spin 0.8s linear infinite", color: "#0052cc" }} />
      </div>
    );
  }

  if (!board) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 13, background: "var(--bg-primary)" }}>
        Scoreboard unavailable.
      </div>
    );
  }

  const isIcpc    = board.scoringMode === "ICPC";
  const isRated   = board.scoringMode === "RATED";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--bg-primary)", overflow: "hidden" }}>
      {/* Header */}
      <div style={{
        padding: "10px 16px", borderBottom: "1px solid var(--border)",
        background: "var(--bg-tertiary)", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
          Scoreboard
          <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>
            {board.scoringMode}
          </span>
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: pulse ? "#00875a" : "var(--text-muted)", transition: "color 0.4s" }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%",
            background: pulse ? "#22c55e" : "#97a0af",
            boxShadow: pulse ? "0 0 0 3px rgba(34,197,94,0.2)" : "none",
            transition: "all 0.4s",
          }} />
          Live
        </span>
      </div>

      {/* Freeze banner */}
      {board.frozen && (
        <div style={{
          background: "rgba(255,139,0,0.12)", borderBottom: "1px solid rgba(255,139,0,0.4)",
          padding: "8px 16px", fontSize: 12, color: "#974f0c", fontWeight: 600,
          display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
        }}>
          <Snowflake size={14} />
          Scoreboard frozen · revealing when the contest ends
        </div>
      )}

      {/* Table */}
      <div style={{ flex: 1, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
              <th style={thSticky(0, 36)}>#</th>
              <th style={{ ...thSticky(36, 150), textAlign: "left" }}>{board.mode === "TEAM" ? "Team" : "Participant"}</th>
              {isIcpc ? (
                <>
                  <th style={thCell()}>Soln</th>
                  <th style={thCell()}>Pen</th>
                </>
              ) : (
                <th style={thCell()}>Score</th>
              )}
              {board.problems.map((p) => (
                <th key={p.problemId} style={thCell(56)} title={p.title}>
                  {p.label}
                  <div style={{ fontSize: 9, color: "var(--text-subtle)", fontWeight: 400 }}>
                    {p.maxPoints}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {board.rows.length === 0 ? (
              <tr><td colSpan={3 + board.problems.length} style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>
                No participants yet.
              </td></tr>
            ) : board.rows.map((row) => {
              const isMe = myParticipantId != null && row.participantId === myParticipantId;
              return (
                <tr key={row.participantId} style={{
                  borderBottom: "1px solid #f4f5f7",
                  background: isMe ? "#deebff" : "transparent",
                }}>
                  <td style={tdSticky(0, 36, isMe)}>
                    <RankBadge rank={row.rank} />
                  </td>
                  <td style={{ ...tdSticky(36, 150, isMe), textAlign: "left", fontWeight: 600, color: "var(--text-primary)" }}>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 140 }}>
                      {row.name}
                    </div>
                  </td>
                  {isIcpc ? (
                    <>
                      <td style={tdCenter(700)}>{row.solvedCount}</td>
                      <td style={tdCenter(500, "var(--text-muted)")}>{row.penaltyMinutes}</td>
                    </>
                  ) : (
                    <td style={tdCenter(700, "#0052cc")}>{row.score}</td>
                  )}
                  {board.problems.map((p) => (
                    <td key={p.problemId} style={{ padding: "6px 4px", textAlign: "center" }}>
                      <Cell cell={row.cells[p.problemId]} mode={board.scoringMode} maxPoints={p.maxPoints} rated={isRated} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── cell renderers ──────────────────────────────────────────────────────────

function Cell({ cell, mode, maxPoints, rated }: {
  cell: ScoreboardProblemCell | undefined;
  mode: string; maxPoints: number; rated: boolean;
}) {
  if (!cell || (!cell.attempted && !cell.solved)) {
    return <span style={{ color: "var(--border)" }}>—</span>;
  }

  const blood = cell.firstBlood ? <span title="First blood" style={{ marginLeft: 2 }}>🩸</span> : null;

  if (mode === "ICPC") {
    if (cell.solved) {
      return (
        <span style={{ color: "#00875a", fontWeight: 700 }}>
          ✓{cell.wrongAttempts > 0 ? ` ${cell.wrongAttempts}` : ""}{blood}
        </span>
      );
    }
    return <span style={{ color: "#de350b", fontWeight: 600 }}>✗ {cell.wrongAttempts}</span>;
  }

  // PARTIAL / RATED — show score
  const solvedColor = cell.solved ? "#00875a" : "var(--text-primary)";
  if (rated) {
    return (
      <span style={{ color: solvedColor, fontWeight: cell.solved ? 700 : 500 }}>
        {cell.score}
        {cell.wrongAttempts > 0 && <span style={{ color: "var(--text-subtle)", fontSize: 10 }}> (+{cell.wrongAttempts})</span>}
        {blood}
      </span>
    );
  }
  // PARTIAL
  return (
    <span style={{ color: solvedColor, fontWeight: cell.solved ? 700 : 500 }}>
      {cell.score}/{maxPoints}{cell.solved ? " ✓" : ""}{blood}
    </span>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
  if (medal) return <span style={{ fontSize: 14 }}>{medal}</span>;
  return <span style={{ color: "var(--text-muted)", fontWeight: 700 }}>{rank}</span>;
}

// ── style helpers ─────────────────────────────────────────────────────────────

function thCell(width?: number): React.CSSProperties {
  return {
    padding: "8px 6px", textAlign: "center", color: "var(--text-muted)",
    fontWeight: 600, width, whiteSpace: "nowrap",
  };
}

function thSticky(left: number, width: number): React.CSSProperties {
  return {
    padding: "8px 8px", textAlign: "center", color: "var(--text-muted)", fontWeight: 600,
    position: "sticky", left, width, background: "var(--bg-secondary)", zIndex: 2,
  };
}

function tdSticky(left: number, width: number, isMe: boolean): React.CSSProperties {
  return {
    padding: "7px 8px", textAlign: "center",
    position: "sticky", left, width,
    background: isMe ? "#deebff" : "var(--bg-primary)", zIndex: 1,
  };
}

function tdCenter(weight: number, color = "var(--text-primary)"): React.CSSProperties {
  return { padding: "7px 6px", textAlign: "center", fontWeight: weight, color };
}
