"use client";

import { useEffect, useState } from "react";
import { Snowflake, Trophy } from "lucide-react";
import { toast } from "@/components/ui/PSPToast";
import {
  getCtfScoreboard, getTeacherCtfTeams,
  type CTFScoreboardEntryDTO, type CTFTeacherTeamDTO,
} from "@/lib/api";

interface Props {
  competitionId: string;
  isFrozen: boolean;
  frozenAt: string | null;
}

export default function TeacherCtfScoreboardTab({ competitionId, isFrozen, frozenAt }: Props) {
  const [scoreboard, setScoreboard] = useState<CTFScoreboardEntryDTO[]>([]);
  const [teams, setTeams] = useState<CTFTeacherTeamDTO[]>([]);
  const [showDiff, setShowDiff] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getCtfScoreboard(competitionId),
      getTeacherCtfTeams(competitionId),
    ]).then(([sb, t]) => {
      setScoreboard(sb);
      setTeams(t);
    }).catch(() => toast.error("Failed to load scoreboard", "Please try again."))
      .finally(() => setLoading(false));
  }, [competitionId]);

  // "Show what changed after freeze" — if frozen, the public scoreboard is the
  // frozen snapshot. The teacher table reflects current totals (live). So if
  // showDiff is on we compare teacher totals vs scoreboard totals.
  const teamById = new Map(teams.map(t => [t.id, t]));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Trophy size={16} color="#f59e0b" />
          <span style={{ fontSize: 14, fontWeight: 700 }}>Scoreboard</span>
          {isFrozen && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              background: "rgba(34,211,238,0.12)", color: "#22d3ee",
              border: "1px solid rgba(34,211,238,0.3)", borderRadius: 4,
              padding: "2px 8px", fontSize: 11, fontWeight: 600,
            }}>
              <Snowflake size={11} /> Frozen{frozenAt ? ` at ${new Date(frozenAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : ""}
            </span>
          )}
        </div>
        {isFrozen && (
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)" }}>
            <input type="checkbox" checked={showDiff} onChange={(e) => setShowDiff(e.target.checked)} />
            Highlight teams that solved after freeze
          </label>
        )}
      </div>

      {loading ? (
        <div className="skel" style={{ height: 320, borderRadius: 8 }} />
      ) : scoreboard.length === 0 ? (
        <div className="psp-empty">
          <div className="psp-empty-title">No solves yet</div>
        </div>
      ) : (
        <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--surface-2, #0f172a)" }}>
                {["#", "Team", "Points (visible)", "Solves", "Points (live)", "Δ post-freeze"].map(h => (
                  <th key={h} style={{
                    padding: "10px 14px", textAlign: "left",
                    fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em",
                    fontWeight: 700, borderBottom: "1px solid var(--border)",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scoreboard.map(row => {
                const teacherTeam = teamById.get(row.teamId);
                const livePts = teacherTeam?.totalPoints ?? row.totalPoints;
                const diff = livePts - row.totalPoints;
                const changed = isFrozen && diff > 0;
                return (
                  <tr key={row.teamId} style={{
                    borderBottom: "1px solid var(--border)",
                    background: showDiff && changed ? "rgba(34,211,238,0.08)" : "transparent",
                  }}>
                    <td style={{ padding: "10px 14px", fontWeight: 700,
                      color: row.rank === 1 ? "#fbbf24" : row.rank === 2 ? "#94a3b8" : row.rank === 3 ? "#fb923c" : "var(--text-muted)",
                    }}>{row.rank}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{
                          width: 20, height: 20, borderRadius: "50%", background: row.avatarColor,
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          color: "#fff", fontSize: 10, fontWeight: 700,
                        }}>{row.teamName.charAt(0).toUpperCase()}</span>
                        <span style={{ fontWeight: 600 }}>{row.teamName}</span>
                        {teacherTeam?.isDisqualified && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, color: "#f87171",
                            background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)",
                            borderRadius: 3, padding: "1px 6px",
                          }}>DQ</span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px", fontFamily: "monospace", fontWeight: 700 }}>
                      {row.totalPoints}
                    </td>
                    <td style={{ padding: "10px 14px", color: "var(--text-muted)" }}>{row.solveCount}</td>
                    <td style={{ padding: "10px 14px", fontFamily: "monospace", color: "var(--text-muted)" }}>
                      {livePts}
                    </td>
                    <td style={{ padding: "10px 14px", fontFamily: "monospace",
                      color: diff > 0 ? "#22d3ee" : "var(--text-muted)",
                    }}>
                      {diff > 0 ? `+${diff}` : "0"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
