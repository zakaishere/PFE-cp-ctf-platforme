"use client";

import { useEffect, useState } from "react";
import { Users, ChevronDown, ChevronRight, Shield, ShieldOff } from "lucide-react";
import { toast } from "@/components/ui/PSPToast";
import {
  getTeacherCtfTeams, disqualifyTeacherCtfTeam,
  type CTFTeacherTeamDTO,
} from "@/lib/api";

interface Props { competitionId: string; }

function relTime(iso: string | null) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function TeacherCtfTeamsTab({ competitionId }: Props) {
  const [teams, setTeams]       = useState<CTFTeacherTeamDTO[]>([]);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dqTarget, setDqTarget] = useState<{ id: string; name: string } | null>(null);
  const [dqReason, setDqReason] = useState("");
  const [dqBusy, setDqBusy]    = useState(false);

  const load = () => {
    setLoading(true);
    getTeacherCtfTeams(competitionId)
      .then(setTeams)
      .catch(() => toast.error("Failed to load teams", "Please try again."))
      .finally(() => setLoading(false));
  };

  useEffect(load, [competitionId]);

  function toggle(id: string) {
    setExpanded(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  async function confirmDisqualify() {
    if (!dqTarget) return;
    setDqBusy(true);
    try {
      await disqualifyTeacherCtfTeam(competitionId, dqTarget.id, dqReason || undefined);
      toast.success("Team disqualified", `${dqTarget.name} has been disqualified.`);
      setDqTarget(null);
      setDqReason("");
      load();
    } catch {
      // toast already shown
    } finally {
      setDqBusy(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[0, 1, 2].map(i => (
          <div key={i} className="skel" style={{ height: 52, borderRadius: 6 }} />
        ))}
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="psp-empty">
        <Users size={36} style={{ margin: "0 auto 10px", color: "var(--text-subtle)" }} />
        <div className="psp-empty-title">No teams yet</div>
        <div>Teams will appear here once students register.</div>
      </div>
    );
  }

  const sorted = [...teams].sort((a, b) => b.totalPoints - a.totalPoints);

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
          {teams.length} team{teams.length !== 1 ? "s" : ""} registered
        </span>
        <button className="psp-btn psp-btn-secondary psp-btn-sm" onClick={load} style={{ fontSize: 12 }}>
          ⟳ Refresh
        </button>
      </div>

      {/* Table */}
      <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--surface-2, #0f172a)" }}>
              {["", "Team", "Members", "Score", "Solves", "Last Solve", "Status", "Actions"].map(h => (
                <th key={h} style={{
                  padding: "9px 12px", textAlign: "left", fontSize: 11,
                  color: "var(--text-muted)", textTransform: "uppercase",
                  letterSpacing: "0.05em", fontWeight: 700,
                  borderBottom: "1px solid var(--border)",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((team, rank) => {
              const open = expanded.has(team.id);
              return (
                <>
                  <tr
                    key={team.id}
                    style={{
                      borderBottom: open ? "none" : "1px solid var(--border)",
                      background: team.isDisqualified ? "rgba(239,68,68,0.04)" : undefined,
                    }}
                  >
                    {/* Expand toggle */}
                    <td style={{ padding: "10px 8px 10px 12px", width: 32 }}>
                      <button
                        type="button"
                        onClick={() => toggle(team.id)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 2 }}
                      >
                        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                    </td>

                    {/* Name */}
                    <td style={{ padding: "10px 12px", fontWeight: 700, color: "var(--text-primary)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{
                          width: 24, height: 24, borderRadius: "50%",
                          background: team.avatarColor, flexShrink: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: "#fff", fontSize: 10, fontWeight: 800,
                        }}>
                          {team.name.charAt(0).toUpperCase()}
                        </span>
                        <div>
                          <div>{team.name}</div>
                          {team.captainName && (
                            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>
                              Cap: {team.captainName}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: "10px 12px", color: "var(--text-muted)" }}>{team.members.length}</td>
                    <td style={{ padding: "10px 12px", fontWeight: 700, color: "#a78bfa" }}>{team.totalPoints}</td>
                    <td style={{ padding: "10px 12px", color: "var(--text-muted)" }}>{team.solveCount}</td>
                    <td style={{ padding: "10px 12px", color: "var(--text-muted)", fontSize: 12 }}>{relTime(team.lastSolveAt)}</td>

                    {/* Status */}
                    <td style={{ padding: "10px 12px" }}>
                      {team.isDisqualified ? (
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          background: "rgba(239,68,68,0.12)", color: "#f87171",
                          border: "1px solid rgba(239,68,68,0.3)",
                          borderRadius: 4, padding: "2px 8px", fontSize: 10, fontWeight: 700,
                        }}>
                          <ShieldOff size={10} /> DQ
                        </span>
                      ) : (
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          background: "rgba(16,185,129,0.1)", color: "#34d399",
                          border: "1px solid rgba(16,185,129,0.3)",
                          borderRadius: 4, padding: "2px 8px", fontSize: 10, fontWeight: 700,
                        }}>
                          <Shield size={10} /> Active
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: "8px 12px" }}>
                      {!team.isDisqualified && (
                        <button
                          className="psp-btn psp-btn-secondary psp-btn-sm"
                          style={{ gap: 4, color: "#f87171", borderColor: "rgba(239,68,68,0.35)", fontSize: 11 }}
                          onClick={() => setDqTarget({ id: team.id, name: team.name })}
                        >
                          <ShieldOff size={10} /> Disqualify
                        </button>
                      )}
                    </td>
                  </tr>

                  {/* Expanded members */}
                  {open && (
                    <tr key={`${team.id}-exp`} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td colSpan={8} style={{ padding: "0 12px 14px 50px", background: "var(--bg-secondary)" }}>
                        {team.members.length === 0 ? (
                          <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "8px 0" }}>No members.</div>
                        ) : (
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8, paddingTop: 10 }}>
                            {team.members.map(m => (
                              <div key={m.userId} style={{
                                padding: "8px 10px", borderRadius: 6,
                                background: "var(--surface)", border: "1px solid var(--border)",
                              }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>
                                  {m.displayName}
                                  {m.role === "CAPTAIN" && (
                                    <span style={{ marginLeft: 4, fontSize: 9, color: "#f59e0b", fontWeight: 700 }}>CAP</span>
                                  )}
                                </div>
                                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                                  {m.solveCount ?? 0} solve{(m.solveCount ?? 0) !== 1 ? "s" : ""}
                                  {m.pointsContributed != null && ` · ${m.pointsContributed}pts`}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Disqualify modal */}
      {dqTarget && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200,
        }} onClick={() => { setDqTarget(null); setDqReason(""); }}>
          <div
            className="psp-card"
            style={{ width: 400, maxWidth: "92vw", padding: 20 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: "#f87171" }}>
              Disqualify &ldquo;{dqTarget.name}&rdquo;?
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12, lineHeight: 1.5 }}>
              This will remove the team from the scoreboard and mark them as disqualified. This cannot be undone.
            </div>
            <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>
              Reason (optional)
            </label>
            <input
              className="input"
              value={dqReason}
              onChange={e => setDqReason(e.target.value)}
              placeholder="e.g. Sharing flags with another team"
              style={{ marginBottom: 14 }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                className="psp-btn psp-btn-secondary"
                onClick={() => { setDqTarget(null); setDqReason(""); }}
                disabled={dqBusy}
              >
                Cancel
              </button>
              <button
                className="psp-btn psp-btn-primary"
                style={{ background: "#dc2626", borderColor: "#dc2626" }}
                onClick={confirmDisqualify}
                disabled={dqBusy}
              >
                {dqBusy ? "Working…" : "Disqualify"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
