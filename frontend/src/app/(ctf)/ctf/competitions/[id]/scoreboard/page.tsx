"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Trophy, Snowflake, Loader2, ChevronDown } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ReferenceLine, ResponsiveContainer,
} from "recharts";
import {
  getCtfScoreboard,
  getCtfScoreboardGraph,
  type CTFScoreboardEntryDTO,
  type CTFScoreTimelineDTO,
} from "@/lib/api";
import { useCTFCompetition } from "@/features/ctf/context/CTFCompetitionContext";

export default function ScoreboardPage() {
  const { id } = useParams<{ id: string }>();
  const ctx = useCTFCompetition();

  const [board, setBoard] = useState<CTFScoreboardEntryDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = () => {
    setLoading(true);
    getCtfScoreboard(id)
      .then(setBoard)
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, [id]);
  useEffect(() => {
    const latest = ctx.notifications[0];
    if (!latest) return;
    if (latest.type === "SCOREBOARD_FROZEN" || latest.type === "SCOREBOARD_UNFROZEN"
        || latest.type === "COMPETITION_ENDED") reload();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.notifications]);

  if (loading || !ctx.competition) {
    return <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
      <Loader2 size={28} style={{ animation: "spin 1s linear infinite", color: "#6366f1" }} />
    </div>;
  }

  const status = ctx.status ?? ctx.competition.status;

  if (status === "UPCOMING") {
    return <PreStartScoreboard startTime={ctx.competition.startTime} teams={board} />;
  }

  const visible = board.filter(e => e.totalPoints > 0 || e.solveCount > 0);

  const shared = (
    <ScoreTimeline
      competitionId={id}
      status={status}
      frozenAt={ctx.competition.frozenAt ?? null}
    />
  );

  if (status === "ENDED" && visible.length > 0) {
    return (
      <>
        <FinalResults visible={visible} myTeamId={ctx.myTeam?.id ?? null} />
        {shared}
      </>
    );
  }

  return (
    <>
      <LiveScoreboard
        visible={visible}
        myTeamId={ctx.myTeam?.id ?? null}
        isFrozen={status === "FROZEN"}
        frozenAt={ctx.competition.frozenAt ?? null}
      />
      {shared}
    </>
  );
}

// ── Pre-start ─────────────────────────────────────────────────────────────────

function PreStartScoreboard({ startTime, teams }: {
  startTime: string | null;
  teams: CTFScoreboardEntryDTO[];
}) {
  return (
    <div style={{
      maxWidth: 720, margin: "40px auto", textAlign: "center",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
    }}>
      <Trophy size={56} color="#475569" />
      <div style={{ fontSize: 22, fontWeight: 800, color: "#f8fafc" }}>Scoreboard</div>
      <div style={{ fontSize: 13, color: "#64748b" }}>
        Rankings will appear once teams start solving challenges.
      </div>
      {startTime && (
        <div style={{ fontSize: 12, color: "#94a3b8" }}>
          Competition starts {new Date(startTime).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
        </div>
      )}

      <div style={{ marginTop: 24, width: "100%" }}>
        <div style={{
          fontSize: 11, color: "#64748b", marginBottom: 10, fontWeight: 700,
          letterSpacing: "0.06em", textTransform: "uppercase",
        }}>
          {teams.length} team{teams.length !== 1 ? "s" : ""} registered
        </div>
        {teams.length === 0 ? (
          <div style={{ fontSize: 12, color: "#475569" }}>No teams yet — be the first to register.</div>
        ) : (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            {teams.map(t => (
              <span key={t.teamId} style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "5px 12px",
                background: "#0f172a", border: "1px solid #1e293b", borderRadius: 999,
                fontSize: 12, color: "#cbd5e1",
              }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: t.avatarColor }} />
                {t.teamName}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Live scoreboard ──────────────────────────────────────────────────────────

function LiveScoreboard({ visible, myTeamId, isFrozen, frozenAt }: {
  visible: CTFScoreboardEntryDTO[];
  myTeamId: string | null;
  isFrozen: boolean;
  frozenAt: string | null;
}) {
  const ctx = useCTFCompetition();
  const solveTotal = visible.reduce((s, e) => s + e.solveCount, 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Trophy size={18} color="#f59e0b" />
            <span style={{ fontSize: 18, fontWeight: 800 }}>Live Scoreboard</span>
            {isFrozen && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                background: "rgba(34,211,238,0.1)", color: "#22d3ee",
                border: "1px solid rgba(34,211,238,0.35)", borderRadius: 4,
                padding: "2px 8px", fontSize: 10, fontWeight: 700, letterSpacing: "0.05em",
              }}>
                <Snowflake size={11} /> FROZEN
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
            {isFrozen && frozenAt
              ? `Showing scoreboard as of ${new Date(frozenAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}`
              : `Updates in real-time · ${visible.length} team${visible.length !== 1 ? "s" : ""} · ${solveTotal} solve${solveTotal !== 1 ? "s" : ""}`}
          </div>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyScoreboard />
      ) : (
        <ScoreboardTable
          rows={visible}
          myTeamId={myTeamId}
          competitionId={ctx.competition!.id}
        />
      )}
    </div>
  );
}

// ── Final podium ─────────────────────────────────────────────────────────────

function FinalResults({ visible, myTeamId }: {
  visible: CTFScoreboardEntryDTO[];
  myTeamId: string | null;
}) {
  const ctx = useCTFCompetition();
  const top3 = visible.slice(0, 3);

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <span style={{ fontSize: 18, fontWeight: 800 }}>Final Results</span>
      </div>

      {top3.length > 0 && (
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1.2fr 1fr", gap: 16, alignItems: "end",
          padding: "20px 20px 30px",
          background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12,
          marginBottom: 18,
        }}>
          {top3[1] && <PodiumStep entry={top3[1]} rank={2} height={120} medal="🥈" />}
          {top3[0] && <PodiumStep entry={top3[0]} rank={1} height={160} medal="🥇" />}
          {top3[2] && <PodiumStep entry={top3[2]} rank={3} height={90}  medal="🥉" />}
        </div>
      )}

      <ScoreboardTable
        rows={visible}
        myTeamId={myTeamId}
        competitionId={ctx.competition!.id}
      />
    </div>
  );
}

function PodiumStep({ entry, rank, height, medal }: {
  entry: CTFScoreboardEntryDTO; rank: number; height: number; medal: string;
}) {
  const accent = rank === 1 ? "#fbbf24" : rank === 2 ? "#94a3b8" : "#fb923c";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div style={{ fontSize: 36 }}>{medal}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#f8fafc", textAlign: "center" }}>
        {entry.teamName}
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color: accent, fontFamily: "ui-monospace, monospace" }}>
        {entry.totalPoints} pts
      </div>
      <div style={{ fontSize: 11, color: "#64748b" }}>{entry.solveCount} solves</div>
      <div style={{
        width: "100%", height,
        background: `linear-gradient(180deg, ${accent}33, ${accent}11)`,
        borderTop: `3px solid ${accent}`,
        borderRadius: 4,
      }} />
    </div>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────────

function EmptyScoreboard() {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "96px 24px", gap: 16,
    }}>
      <Trophy size={64} color="#475569" />
      <h3 style={{ fontSize: 18, fontWeight: 600, color: "#f8fafc", margin: 0 }}>
        No scores yet
      </h3>
      <p style={{ fontSize: 13, color: "#64748b", textAlign: "center", maxWidth: 360, margin: 0 }}>
        Be the first team to solve a challenge and claim the top spot.
      </p>
    </div>
  );
}

// ── Shared table ─────────────────────────────────────────────────────────────

function ScoreboardTable({ rows, myTeamId, competitionId }: {
  rows: CTFScoreboardEntryDTO[];
  myTeamId: string | null;
  competitionId: string;
}) {
  void competitionId;
  const myEntry = useMemo(() => rows.find(r => r.teamId === myTeamId), [rows, myTeamId]);

  return (
    <div style={{ overflow: "hidden", border: "1px solid #1e293b", borderRadius: 8, background: "#0f172a" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "#0a0f1e" }}>
            {["Rank", "Team", "Score", "Solves", "Last solve"].map(h => (
              <th key={h} style={{
                padding: "10px 14px", textAlign: h === "Score" || h === "Solves" ? "right" : "left",
                fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em",
                fontWeight: 700, borderBottom: "1px solid #1e293b",
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const mine = r.teamId === myTeamId;
            const podium = r.rank <= 3;
            const podiumColor = r.rank === 1 ? "#fbbf24" : r.rank === 2 ? "#94a3b8" : r.rank === 3 ? "#fb923c" : null;
            return (
              <tr key={r.teamId} style={{
                borderBottom: "1px solid #1a2234",
                background: mine ? "rgba(99,102,241,0.1)" : "transparent",
              }}>
                <td style={{ padding: "10px 14px", fontWeight: 700, color: podiumColor ?? "#64748b", fontSize: podium ? 15 : 13 }}>
                  {r.rank}
                </td>
                <td style={{ padding: "10px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                      width: 20, height: 20, borderRadius: "50%", background: r.avatarColor,
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      color: "#fff", fontSize: 10, fontWeight: 700,
                    }}>{r.teamName.charAt(0).toUpperCase()}</span>
                    <span style={{ fontWeight: 600, color: mine ? "#a78bfa" : "#f8fafc", fontSize: podium ? 14 : 13 }}>
                      {r.teamName}
                      {mine && <span style={{ fontSize: 9, color: "#6366f1", marginLeft: 6, fontWeight: 700 }}>(YOU)</span>}
                    </span>
                  </div>
                </td>
                <td style={{
                  padding: "10px 14px", textAlign: "right", fontWeight: 700,
                  fontFamily: "ui-monospace, monospace", color: podiumColor ?? "#f8fafc",
                  fontSize: podium ? 15 : 13,
                }}>
                  {r.totalPoints}
                </td>
                <td style={{ padding: "10px 14px", textAlign: "right", color: "#64748b" }}>
                  {r.solveCount}
                </td>
                <td style={{ padding: "10px 14px", color: "#64748b", fontSize: 12 }}>
                  {r.lastSolveAt
                    ? new Date(r.lastSolveAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
                    : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {myEntry && rows.length > 8 && (
        <div style={{
          position: "sticky", bottom: 0,
          background: "rgba(99,102,241,0.18)", borderTop: "1px solid #6366f1",
          padding: "8px 14px", display: "flex", alignItems: "center", gap: 10,
          fontSize: 12, color: "#f8fafc",
        }}>
          <span style={{ color: "#a78bfa", fontWeight: 700 }}>#{myEntry.rank}</span>
          <span style={{ width: 16, height: 16, borderRadius: "50%", background: myEntry.avatarColor }} />
          <span style={{ fontWeight: 600 }}>{myEntry.teamName}</span>
          <span style={{ marginLeft: "auto", fontFamily: "ui-monospace, monospace" }}>
            {myEntry.totalPoints} pts · {myEntry.solveCount} solves
          </span>
        </div>
      )}
    </div>
  );
}

// ── Score Timeline chart ──────────────────────────────────────────────────────

function ScoreTimeline({ competitionId, status, frozenAt }: {
  competitionId: string;
  status: string;
  frozenAt: string | null;
}) {
  const [graphData, setGraphData] = useState<CTFScoreTimelineDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(status !== "ENDED");

  useEffect(() => {
    if (status !== "ACTIVE" && status !== "ENDED" && status !== "FROZEN") {
      setLoading(false);
      return;
    }
    getCtfScoreboardGraph(competitionId)
      .then(setGraphData)
      .catch(() => {})
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competitionId, status]);

  // All hooks must come before any conditional return (Rules of Hooks).
  // Merge all team events into a flat timeline sorted by time.
  const { chartData, startMs } = useMemo(() => {
    if (!graphData?.teams.length) return { chartData: [], startMs: 0 };

    const s = graphData.competitionStart
      ? new Date(graphData.competitionStart).getTime()
      : Math.min(...graphData.teams.flatMap(t =>
          t.points.map(p => new Date(p.time).getTime())
        ));

    const allEvents = graphData.teams
      .flatMap(t => t.points.map(p => ({
        ms: new Date(p.time).getTime(),
        teamId: t.teamId,
        score: p.score,
      })))
      .sort((a, b) => a.ms - b.ms);

    const currentScores: Record<string, number> = {};
    graphData.teams.forEach(t => { currentScores[t.teamId] = 0; });

    const rows: Array<Record<string, number>> = [];
    for (const evt of allEvents) {
      currentScores[evt.teamId] = evt.score;
      const minutes = Math.round((evt.ms - s) / 6000) / 10;
      const row: Record<string, number> = { minutes };
      graphData.teams.forEach(t => { row[t.teamId] = currentScores[t.teamId]; });
      rows.push({ ...row });
    }

    return { chartData: rows, startMs: s };
  }, [graphData]);

  const maxScore = useMemo(() => {
    if (!chartData.length || !graphData) return 100;
    let m = 0;
    chartData.forEach(row => {
      graphData.teams.forEach(t => {
        const v = row[t.teamId] as number ?? 0;
        if (v > m) m = v;
      });
    });
    return Math.ceil(m * 1.1) || 100;
  }, [chartData, graphData]);

  // Safe to return early now that all hooks have been called.
  const qualifyingTeams = graphData?.teams.filter(t => t.points.length > 0) ?? [];
  if (!loading && qualifyingTeams.length < 2) return null;

  const freezeMinutes = frozenAt && startMs > 0
    ? (new Date(frozenAt).getTime() - startMs) / 60000
    : null;

  const fmtMinutes = (m: number) => {
    const h = Math.floor(m / 60);
    const min = Math.floor(m % 60);
    return h > 0 ? `${h}h${min.toString().padStart(2, "0")}m` : `${min}m`;
  };

  return (
    <div style={{ marginTop: 20, border: "1px solid #1e293b", borderRadius: 8, overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", background: "#0f172a", border: "none", cursor: "pointer",
          color: "#f8fafc",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 14 }}>
          📈 Score Timeline — Top {graphData?.teams.length ?? 10} Teams
        </span>
        <ChevronDown size={16} style={{
          color: "#64748b",
          transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
          transition: "transform 150ms",
        }} />
      </button>

      {expanded && (
        <div style={{ padding: "16px 4px 12px", background: "#060a16" }}>
          {loading ? (
            <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Loader2 size={24} style={{ animation: "spin 1s linear infinite", color: "#6366f1" }} />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="minutes"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={fmtMinutes}
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  axisLine={{ stroke: "#1e293b" }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, maxScore]}
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                />
                <Tooltip
                  content={
                    <ChartTooltip
                      teams={graphData?.teams ?? []}
                      fmtMinutes={fmtMinutes}
                    />
                  }
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  formatter={(value) => {
                    const team = graphData?.teams.find(t => t.teamId === value);
                    return <span style={{ color: "#94a3b8" }}>{team?.teamName ?? value}</span>;
                  }}
                />
                {freezeMinutes !== null && (
                  <ReferenceLine
                    x={freezeMinutes}
                    stroke="#22d3ee"
                    strokeDasharray="4 4"
                    label={{ value: "Scoreboard frozen", fill: "#22d3ee", fontSize: 9, position: "insideTopRight" }}
                  />
                )}
                {(graphData?.teams ?? []).map(team => (
                  <Line
                    key={team.teamId}
                    dataKey={team.teamId}
                    name={team.teamName}
                    stroke={team.accentColor}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    type="stepAfter"
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </div>
  );
}

type TooltipPayloadEntry = {
  dataKey: string;
  value: number;
  stroke: string;
  name: string;
};

function ChartTooltip({ active, payload, label, teams, fmtMinutes }: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: number;
  teams: CTFScoreTimelineDTO["teams"];
  fmtMinutes: (m: number) => string;
}) {
  if (!active || !payload?.length) return null;

  const sorted = [...payload]
    .filter(p => p.value > 0)
    .sort((a, b) => b.value - a.value);

  return (
    <div style={{
      background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8,
      padding: "8px 12px", fontSize: 12, maxWidth: 210,
    }}>
      <div style={{ color: "#64748b", marginBottom: 6, fontSize: 11 }}>
        T+{fmtMinutes(label ?? 0)}
      </div>
      {sorted.map(e => {
        const team = teams.find(t => t.teamId === e.dataKey);
        return (
          <div key={e.dataKey} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: e.stroke ?? team?.accentColor ?? "#6366f1",
              flexShrink: 0,
            }} />
            <span style={{
              color: "#f8fafc", flex: 1, fontSize: 11,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {team?.teamName ?? e.dataKey}
            </span>
            <span style={{ fontFamily: "ui-monospace, monospace", color: "#f8fafc", fontWeight: 700 }}>
              {e.value}
            </span>
          </div>
        );
      })}
    </div>
  );
}
