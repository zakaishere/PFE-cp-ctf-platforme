"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import {
  Trophy, Plus, Calendar, Timer, Users, Lock, Unlock,
  CheckCircle2, X, Loader2, Code2, AlertTriangle, Flame,
} from "lucide-react";
import {
  getCompetitions, createCompetition, publishCompetition,
  attachCompetitionProblem, detachCompetitionProblem,
  getAllProblems, getCompetitionJoinRequests,
  approveJoinRequest, rejectJoinRequest,
  bulkApproveCompetitionRequests,
  type CreateCompetitionRequest,
} from "@/lib/api";

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const STATUS_BADGE: Record<string, { cls: string; label: string }> = {
  DRAFT:        { cls: "b-pending", label: "Draft" },
  REGISTRATION: { cls: "b-tp",     label: "Registration" },
  LIVE:         { cls: "b-live",   label: "Live" },
  ENDED:        { cls: "b-pass",   label: "Ended" },
};

export default function CompetitionManagement() {
  const [competitions, setCompetitions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);

  // Create modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateCompetitionRequest>({
    title: "", description: "",
    mode: "SOLO", accessType: "REQUEST_BASED",
    scheduledStartTime: "", durationMinutes: 120,
    minTeamSize: 2, maxTeamSize: 4,
  });
  const [creating, setCreating] = useState(false);

  // Problem attachment
  const [problemPool, setProblemPool] = useState<any[]>([]);
  const [poolLoading, setPoolLoading] = useState(false);
  const [attaching, setAttaching] = useState<string | null>(null);

  // Join requests
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const [jrLoading, setJrLoading] = useState(false);
  const [jrActing, setJrActing] = useState<string | null>(null);

  // Active panel
  const [panel, setPanel] = useState<"problems" | "requests">("problems");

  const load = () => {
    setLoading(true);
    getCompetitions()
      .then((list) => { setCompetitions(list); if (list.length > 0) setSelected(list[0]); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const loadProblems = () => {
    setPoolLoading(true);
    getAllProblems().then(setProblemPool).catch(console.error).finally(() => setPoolLoading(false));
  };

  const loadJoinRequests = (id: string) => {
    setJrLoading(true);
    getCompetitionJoinRequests(id)
      .then((res) => setJoinRequests(res.content || res || []))
      .catch(console.error)
      .finally(() => setJrLoading(false));
  };

  useEffect(() => {
    if (!selected) return;
    const id = selected.competitionId || selected.id;
    if (panel === "problems") loadProblems();
    else loadJoinRequests(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, panel]);

  const handleCreate = async () => {
    if (!form.title.trim()) return;
    setCreating(true);
    try {
      const payload: CreateCompetitionRequest = { ...form };
      if (form.mode !== "TEAM") { delete payload.minTeamSize; delete payload.maxTeamSize; }
      const res = await createCompetition(payload);
      setCreateOpen(false);
      setForm({ title: "", description: "", mode: "SOLO", accessType: "REQUEST_BASED", scheduledStartTime: "", durationMinutes: 120, minTeamSize: 2, maxTeamSize: 4 });
      load();
    } catch (e) { console.error(e); }
    setCreating(false);
  };

  const handlePublish = async (id: string) => {
    try { await publishCompetition(id); load(); } catch (e) { console.error(e); }
  };

  const handleAttach = async (problemId: string) => {
    if (!selected) return;
    const id = selected.competitionId || selected.id;
    setAttaching(problemId);
    try { await attachCompetitionProblem(id, problemId); } catch (e) { console.error(e); }
    setAttaching(null);
  };

  const handleDetach = async (problemId: string) => {
    if (!selected) return;
    const id = selected.competitionId || selected.id;
    setAttaching(problemId);
    try { await detachCompetitionProblem(id, problemId); } catch (e) { console.error(e); }
    setAttaching(null);
  };

  const handleApprove = async (requestId: string) => {
    setJrActing(requestId);
    try {
      await approveJoinRequest(requestId);
      setJoinRequests((r) => r.filter((x) => x.id !== requestId));
    } catch (e) { console.error(e); }
    setJrActing(null);
  };

  const handleReject = async (requestId: string) => {
    setJrActing(requestId);
    try {
      await rejectJoinRequest(requestId);
      setJoinRequests((r) => r.filter((x) => x.id !== requestId));
    } catch (e) { console.error(e); }
    setJrActing(null);
  };

  const handleBulkApprove = async () => {
    if (!selected || joinRequests.length === 0) return;
    const id = selected.competitionId || selected.id;
    try {
      await bulkApproveCompetitionRequests(id, joinRequests.map((r) => r.id));
      setJoinRequests([]);
    } catch (e) { console.error(e); }
  };

  const attachedIds = new Set(
    (selected?.problems || []).map((p: any) => p.problemId || p.id)
  );

  return (
    <>
      <Navbar />
      <div className="psp-breadcrumb">
        <Link href="/teacher">PSP</Link> ›{" "}
        <span style={{ color: "var(--text-primary)" }}>Competitions</span>
      </div>
      <div className="psp-main">
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
              <Trophy size={18} color="#ff8b00" /> Competitions
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>Create and manage competitions</div>
          </div>
          <button className="psp-btn psp-btn-primary" onClick={() => setCreateOpen(true)}>
            <Plus size={13} /> New Competition
          </button>
        </div>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
            <Loader2 size={28} style={{ animation: "spin 1s linear infinite", color: "#0052cc" }} />
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16 }}>
            {/* Left: competition list */}
            <div>
              {competitions.length === 0 && (
                <div className="psp-card">
                  <div className="psp-empty">
                    <Trophy size={28} color="#97a0af" style={{ margin: "0 auto 8px" }} />
                    <div className="psp-empty-title">No competitions yet</div>
                    <div>Click "New Competition" to create one.</div>
                  </div>
                </div>
              )}
              {competitions.map((c) => {
                const id = c.competitionId || c.id;
                const sb = STATUS_BADGE[c.status] || { cls: "b-pending", label: c.status };
                const isSelected = selected && (selected.competitionId || selected.id) === id;
                return (
                  <div key={id} onClick={() => setSelected(c)}
                    style={{ background: "var(--bg-primary)", border: isSelected ? "1px solid #0052cc" : "1px solid var(--border)", borderLeft: isSelected ? "3px solid #0052cc" : "3px solid transparent", borderRadius: 3, padding: 14, marginBottom: 8, cursor: "pointer" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{c.title}</div>
                      <span className={`psp-badge ${sb.cls}`}>{sb.label}</span>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 6, fontSize: 11, color: "var(--text-muted)" }}>
                      <span>{(c.mode || "").toUpperCase() === "TEAM" ? "Team" : "Solo"}</span>
                      {c.scheduledStartTime && <span>· {formatDate(c.scheduledStartTime)}</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right: detail panel */}
            {selected ? (
              <div>
                <div className="psp-card" style={{ marginBottom: 14 }}>
                  <div className="psp-card-header">
                    <span className="psp-card-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {selected.status === "LIVE" && <Flame size={13} color="#de350b" />} {selected.title}
                    </span>
                    {selected.status === "DRAFT" && (
                      <button className="psp-btn psp-btn-primary psp-btn-sm" onClick={() => handlePublish(selected.competitionId || selected.id)}>
                        Publish (Open Registration)
                      </button>
                    )}
                  </div>
                  <div className="psp-card-body">
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12, color: "var(--text-muted)" }}>
                      {selected.scheduledStartTime && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Calendar size={12} />{formatDate(selected.scheduledStartTime)}</span>}
                      {selected.durationMinutes && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Timer size={12} />{selected.durationMinutes} min</span>}
                      {selected.mode?.toUpperCase() === "TEAM" && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Users size={12} />Teams of {selected.minTeamSize}–{selected.maxTeamSize}</span>}
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        {(selected.accessType || "").toUpperCase() === "REQUEST_BASED" ? <Lock size={12} /> : <Unlock size={12} />}
                        {(selected.accessType || "").toUpperCase() === "REQUEST_BASED" ? "Request Based" : "Open"}
                      </span>
                    </div>
                    {selected.description && <p style={{ marginTop: 10, fontSize: 13, color: "var(--text-primary)" }}>{selected.description}</p>}
                  </div>
                </div>

                {/* Sub-tabs */}
                <div className="psp-filter-bar" style={{ marginBottom: 14 }}>
                  <button className={`psp-ftab${panel === "problems" ? " on" : ""}`} onClick={() => setPanel("problems")}>
                    <Code2 size={12} /> Problem Bank
                  </button>
                  <button className={`psp-ftab${panel === "requests" ? " on" : ""}`} onClick={() => setPanel("requests")}>
                    <Users size={12} /> Join Requests
                  </button>
                </div>

                {/* Problems panel */}
                {panel === "problems" && (
                  <div className="psp-card">
                    <div className="psp-card-header">
                      <span className="psp-card-title">Attach Problems</span>
                    </div>
                    {poolLoading ? (
                      <div style={{ padding: 30, textAlign: "center" }}><Loader2 size={20} style={{ animation: "spin 1s linear infinite", color: "#0052cc" }} /></div>
                    ) : problemPool.length === 0 ? (
                      <div className="psp-empty"><div>No problems in bank yet.</div></div>
                    ) : (
                      <table className="psp-table">
                        <thead><tr><th>Title</th><th>Difficulty</th><th>Visibility</th><th></th></tr></thead>
                        <tbody>
                          {problemPool.map((p) => {
                            const pid = p.problemId || p.id;
                            const isAttached = attachedIds.has(pid);
                            const isActing = attaching === pid;
                            return (
                              <tr key={pid}>
                                <td className="td-link">{p.title}</td>
                                <td><span className={`psp-badge b-${(p.difficultyLevel || "easy").toLowerCase()}`}>{p.difficultyLevel || "Easy"}</span></td>
                                <td><span className={`psp-badge ${p.isPublic ? "b-pub" : "b-priv"}`}>{p.isPublic ? "Public" : "Private"}</span></td>
                                <td>
                                  {isAttached ? (
                                    <button className="psp-btn psp-btn-danger psp-btn-sm" disabled={isActing} onClick={() => handleDetach(pid)}>
                                      {isActing ? <Loader2 size={11} /> : <X size={11} />} Remove
                                    </button>
                                  ) : (
                                    <button className="psp-btn psp-btn-primary psp-btn-sm" disabled={isActing} onClick={() => handleAttach(pid)}>
                                      {isActing ? <Loader2 size={11} /> : <Plus size={11} />} Add
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {/* Join Requests panel */}
                {panel === "requests" && (
                  <div className="psp-card">
                    <div className="psp-card-header">
                      <span className="psp-card-title">Pending Join Requests ({joinRequests.length})</span>
                      {joinRequests.length > 0 && (
                        <button className="psp-btn psp-btn-success psp-btn-sm" onClick={handleBulkApprove}>Approve All</button>
                      )}
                    </div>
                    {jrLoading ? (
                      <div style={{ padding: 30, textAlign: "center" }}><Loader2 size={20} style={{ animation: "spin 1s linear infinite", color: "#0052cc" }} /></div>
                    ) : joinRequests.length === 0 ? (
                      <div className="psp-empty">
                        <CheckCircle2 size={28} color="#00875a" style={{ margin: "0 auto 8px" }} />
                        <div className="psp-empty-title">All clear!</div>
                        <div>No pending requests.</div>
                      </div>
                    ) : (
                      <div className="psp-scroll">
                        {joinRequests.map((r) => {
                          const isActing = jrActing === r.id;
                          return (
                            <div key={r.id} style={{ padding: "10px 16px", borderBottom: "1px solid #f4f5f7", display: "flex", alignItems: "center", gap: 10 }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 12, fontWeight: 600 }}>{r.studentName || r.studentId}</div>
                                {r.message && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{r.message}</div>}
                              </div>
                              <div style={{ display: "flex", gap: 5 }}>
                                <button disabled={isActing} onClick={() => handleApprove(r.id)} style={{ background: "var(--green-light)", color: "#006644", border: "none", padding: "3px 10px", borderRadius: 3, fontSize: 11, fontWeight: 600, cursor: isActing ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 3 }}>
                                  {isActing ? <Loader2 size={10} /> : <CheckCircle2 size={10} />} Approve
                                </button>
                                <button disabled={isActing} onClick={() => handleReject(r.id)} style={{ background: "var(--red-light)", color: "#bf2600", border: "none", padding: "3px 10px", borderRadius: 3, fontSize: 11, fontWeight: 600, cursor: isActing ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 3 }}>
                                  <X size={10} /> Reject
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="psp-card">
                <div className="psp-empty">
                  <AlertTriangle size={28} color="#97a0af" style={{ margin: "0 auto 8px" }} />
                  <div>Select a competition to manage it.</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Competition Modal */}
      {createOpen && (
        <div className="psp-modal-overlay" onClick={() => setCreateOpen(false)}>
          <div className="psp-modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div className="psp-modal-header">
              <span style={{ fontSize: 16, fontWeight: 600 }}>New Competition</span>
              <button onClick={() => setCreateOpen(false)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--text-muted)" }}><X size={18} /></button>
            </div>
            <div className="psp-modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className="psp-form-label">Title *</label>
                <input className="psp-form-input" placeholder="e.g. Spring Competition 2026" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <label className="psp-form-label">Description</label>
                <textarea className="psp-form-textarea" placeholder="Brief description of the competition…" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="psp-form-label">Mode</label>
                  <select className="psp-form-select" value={form.mode} onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value as "SOLO" | "TEAM" }))}>
                    <option value="SOLO">Solo</option>
                    <option value="TEAM">Team</option>
                  </select>
                </div>
                <div>
                  <label className="psp-form-label">Access</label>
                  <select className="psp-form-select" value={form.accessType} onChange={(e) => setForm((f) => ({ ...f, accessType: e.target.value as any }))}>
                    <option value="REQUEST_BASED">Request Based</option>
                    <option value="OPEN">Open</option>
                  </select>
                </div>
              </div>
              {form.mode === "TEAM" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label className="psp-form-label">Min Team Size</label>
                    <input type="number" className="psp-form-input" min={1} value={form.minTeamSize} onChange={(e) => setForm((f) => ({ ...f, minTeamSize: parseInt(e.target.value) || 2 }))} />
                  </div>
                  <div>
                    <label className="psp-form-label">Max Team Size</label>
                    <input type="number" className="psp-form-input" min={1} value={form.maxTeamSize} onChange={(e) => setForm((f) => ({ ...f, maxTeamSize: parseInt(e.target.value) || 4 }))} />
                  </div>
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="psp-form-label">Start Date & Time</label>
                  <input type="datetime-local" className="psp-form-input" value={form.scheduledStartTime} onChange={(e) => setForm((f) => ({ ...f, scheduledStartTime: e.target.value }))} />
                </div>
                <div>
                  <label className="psp-form-label">Duration (minutes)</label>
                  <input type="number" className="psp-form-input" placeholder="120" value={form.durationMinutes} onChange={(e) => setForm((f) => ({ ...f, durationMinutes: parseInt(e.target.value) || 120 }))} />
                </div>
              </div>
            </div>
            <div className="psp-modal-footer">
              <button className="psp-btn psp-btn-secondary" onClick={() => setCreateOpen(false)}>Cancel</button>
              <button className="psp-btn psp-btn-primary" onClick={handleCreate} disabled={creating} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {creating ? <Loader2 size={13} /> : <Plus size={13} />} Create Competition
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
