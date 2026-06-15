"use client";

import { useState, useEffect } from "react";
import { APP_NAME } from "@/lib/brand";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { Users, BookOpen, Clock, ClipboardList, Monitor, AlertTriangle, CheckCircle2, X, Loader2, Server } from "lucide-react";
import { getPendingTeachers, activateTeacher, rejectTeacher, getLeaderboard, getCTFAdminConfig, updateCTFAdminConfig, getPlatformStats, getAdminHealthMetrics, type PendingTeacher, type LeaderboardEntry, type CTFResourceConfig, type PlatformStats, type AdminHealthMetrics } from "@/lib/api";
import { LoadingButton } from "@/components/ui/LoadingButton";

const AVATAR_COLORS = ["var(--brand)","#6554c0","#00875a","var(--warn)","#ff5630","#36b37e","#00b8d9","#de350b"];

function initials(t: PendingTeacher) {
  return `${t.firstName.charAt(0)}${t.lastName.charAt(0)}`.toUpperCase();
}

export default function AdminDashboard() {
  const [pending, setPending] = useState<PendingTeacher[]>([]);
  const [loadingPending, setLoadingPending] = useState(true);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [topStudents, setTopStudents] = useState<LeaderboardEntry[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Platform stats
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [health, setHealth] = useState<AdminHealthMetrics | null>(null);

  // CTF config state
  const [ctfConfig, setCtfConfig] = useState<CTFResourceConfig | null>(null);
  const [ctfConfigDraft, setCtfConfigDraft] = useState<Partial<CTFResourceConfig>>({});
  const [savingCtf, setSavingCtf] = useState(false);

  useEffect(() => {
    setLoadingPending(true);
    getPendingTeachers()
      .then(setPending)
      .catch(console.error)
      .finally(() => setLoadingPending(false));
    getLeaderboard().then(setTopStudents).catch(console.error);
    getCTFAdminConfig().then((c) => { setCtfConfig(c); setCtfConfigDraft(c); }).catch(console.error);
    getPlatformStats().then(setStats).catch(console.error);
    getAdminHealthMetrics().then(setHealth).catch(console.error);
  }, []);

  const saveCtfConfig = async () => {
    setSavingCtf(true);
    try {
      const updated = await updateCTFAdminConfig(ctfConfigDraft);
      setCtfConfig(updated);
      setCtfConfigDraft(updated);
    } catch (e) { console.error(e); }
    setSavingCtf(false);
  };

  const approve = async (id: string) => {
    setActionLoading(id);
    try {
      await activateTeacher(id);
      setPending((p) => p.filter((t) => t.id !== id));
    } catch (e) { console.error(e); }
    setActionLoading(null);
  };

  const reject = async () => {
    if (!rejectTarget) return;
    setActionLoading(rejectTarget);
    try {
      await rejectTeacher(rejectTarget);
      setPending((p) => p.filter((t) => t.id !== rejectTarget));
    } catch (e) { console.error(e); }
    setRejectTarget(null);
    setRejectReason("");
    setActionLoading(null);
  };

  return (
    <>
      <Navbar />
      <div className="psp-breadcrumb">
        <Link href="/admin">{APP_NAME}</Link> › <span style={{ color: "var(--text-primary)" }}>Admin Dashboard</span>
      </div>

      <div className="psp-main">
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)" }}>Admin Dashboard</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>Platform overview and teacher management</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="psp-btn psp-btn-secondary">Export Users</button>
            <button className="psp-btn psp-btn-primary">+ Add Admin</button>
          </div>
        </div>

        {/* Stats — 4 columns (dynamic) */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
          {[
            { icon: <Clock size={20} />,    val: loadingPending ? "…" : String(pending.length),  lbl: "Pending Teachers", cls: "ic-orange" },
            { icon: <BookOpen size={20} />, val: stats ? String(stats.activeTeachers) : "…",     lbl: "Active Teachers",  cls: "ic-green"  },
            { icon: <Users size={20} />,    val: stats ? String(stats.totalStudents)  : "…",     lbl: "Total Students",   cls: "ic-blue"   },
            { icon: <Monitor size={20} />,  val: stats ? String(stats.totalSubmissions) : "…",   lbl: "Submissions",      cls: "ic-red"    },
          ].map((s, i) => (
            <div key={i} className="psp-stat-card">
              <div className={`psp-stat-icon ${s.cls}`}>{s.icon}</div>
              <div><div className="psp-stat-val">{s.val}</div><div className="psp-stat-lbl">{s.lbl}</div></div>
            </div>
          ))}
        </div>

        {pending.length > 0 && (
          <div className="psp-alert psp-alert-warn">
            <AlertTriangle size={14} style={{ flexShrink: 0 }} />
            <span><strong>{pending.length} teacher account{pending.length !== 1 ? "s" : ""}</strong> are waiting for your approval. Review them below.</span>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>
          {/* Left */}
          <div>
            {/* Pending teachers */}
            <div className="psp-card">
              <div className="psp-card-header">
                <span className="psp-card-title"><Clock size={13} style={{ display: "inline", marginRight: 5, color: "var(--warn)" }} />Pending Teacher Approvals ({pending.length})</span>
                <button className="psp-btn psp-btn-success psp-btn-sm" onClick={() => pending.forEach((t) => approve(t.id))}>Approve All</button>
              </div>
              <div style={{ padding: 14 }}>
                {loadingPending ? (
                  <div className="psp-empty"><Loader2 size={24} style={{ margin: "0 auto 8px", animation: "spin 1s linear infinite" }} /><div>Loading…</div></div>
                ) : pending.length === 0 ? (
                  <div className="psp-empty">
                    <CheckCircle2 size={32} color="#00875a" style={{ margin: "0 auto 8px" }} />
                    <div className="psp-empty-title">All clear!</div>
                    <div>No pending approvals.</div>
                  </div>
                ) : pending.map((t, idx) => {
                  const color = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                  const ini = initials(t);
                  const isActing = actionLoading === t.id;
                  return (
                  <div key={t.id} style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 3, padding: 16, marginBottom: 10, display: "flex", alignItems: "flex-start", gap: 14 }}>
                    <div style={{ width: 42, height: 42, borderRadius: "50%", background: color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, color: "white", flexShrink: 0 }}>{ini}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{t.firstName} {t.lastName}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{t.email}</div>
                      <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                        {[t.specialty, t.department].filter(Boolean).map((chip, ci) => (
                          <span key={ci} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 3, padding: "2px 8px", fontSize: 11, color: "var(--text-muted)" }}>{chip}</span>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button onClick={() => approve(t.id)} disabled={isActing} style={{ background: "var(--green-light)", color: "#006644", border: "1px solid #57d9a3", borderRadius: 3, height: 30, padding: "0 14px", fontSize: 12, fontWeight: 600, cursor: isActing ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                        {isActing ? <Loader2 size={12} /> : <CheckCircle2 size={12} />} Approve
                      </button>
                      <button onClick={() => setRejectTarget(t.id)} disabled={isActing} style={{ background: "var(--red-light)", color: "#de350b", border: "1px solid #ff8f73", borderRadius: 3, height: 30, padding: "0 14px", fontSize: 12, fontWeight: 600, cursor: isActing ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                        <X size={12} /> Reject
                      </button>
                    </div>
                  </div>
                )})}
              </div>
            </div>

            {/* Quick links for admin teacher capabilities */}
            <div className="psp-card">
              <div className="psp-card-header">
                <span className="psp-card-title">Admin Tools</span>
              </div>
              <div style={{ padding: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Link href="/teacher/problems" className="psp-btn psp-btn-secondary">Manage Problems</Link>
                <Link href="/teacher/competitions" className="psp-btn psp-btn-primary">Host Competition</Link>
                <Link href="/leaderboard" className="psp-btn psp-btn-secondary">View Leaderboard</Link>
                <Link href="/ctf" className="psp-btn psp-btn-secondary">CTF Challenges</Link>
              </div>
            </div>
          </div>

          {/* Right */}
          <div>
            {/* Platform activity placeholder — real events via WebSocket in future */}
            <div className="psp-card" style={{ marginBottom: 14 }}>
              <div className="psp-card-header">
                <span className="psp-card-title">Platform Activity</span>
                <span style={{ fontSize: 11, color: "var(--text-subtle)" }}>Live</span>
              </div>
              <div style={{ padding: 16, fontSize: 12, color: "var(--text-muted)" }}>
                Real-time activity feed will appear here once WebSocket is connected.
              </div>
            </div>

            {/* System health */}
            <div className="psp-card" style={{ marginBottom: 14 }}>
              <div className="psp-card-header">
                <span className="psp-card-title">System Health</span>
                {health && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
                    background: health.overall === "OK" ? "rgba(0,135,90,0.12)" : health.overall === "WARN" ? "rgba(255,139,0,0.12)" : "rgba(222,53,11,0.12)",
                    color: health.overall === "OK" ? "#00875a" : health.overall === "WARN" ? "var(--warn)" : "#de350b",
                  }}>{health.overall}</span>
                )}
              </div>
              <div className="psp-card-body">
                {!health ? (
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Loading…</div>
                ) : ([
                  {
                    label: "RabbitMQ Queue",
                    val: health.rabbitmq.status === "UNKNOWN" ? "Unavailable" : `${health.rabbitmq.queueDepth} msgs`,
                    status: health.rabbitmq.status,
                  },
                  {
                    label: "DB Connections",
                    val: health.database.status === "UNKNOWN" ? "Unavailable"
                      : `${health.database.active ?? "?"} / ${health.database.total ?? "?"} active`,
                    status: health.database.status,
                  },
                  {
                    label: "JVM Heap",
                    val: `${health.heap.usedMb} / ${health.heap.totalMb} MB (${health.heap.pct}%)`,
                    status: health.heap.status,
                  },
                ] as Array<{ label: string; val: string; status: string }>).map((row, i) => {
                  const clr = row.status === "OK" ? "#00875a" : row.status === "WARN" ? "var(--warn)" : row.status === "CRITICAL" ? "#de350b" : "var(--text-muted)";
                  return (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{row.label}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <strong style={{ color: "var(--text-primary)", fontSize: 12 }}>{row.val}</strong>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "1px 5px", borderRadius: 3,
                          background: `${clr}1a`, color: clr,
                        }}>{row.status}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Platform overview */}
            <div className="psp-card" style={{ marginBottom: 14 }}>
              <div className="psp-card-header"><span className="psp-card-title">Platform Overview</span></div>
              <div className="psp-card-body">
                {([
                  { label: "Total Users",        val: stats ? String((stats.activeTeachers ?? 0) + (stats.totalStudents ?? 0)) : "…" },
                  { label: "Active Live Exams",  val: stats ? `${stats.activeLiveExams}${stats.activeLiveExams > 0 ? " ongoing" : ""}` : "…", color: stats && stats.activeLiveExams > 0 ? "#de350b" : undefined },
                  { label: "Open TPs",           val: stats ? String(stats.openTps) : "…" },
                  { label: "Problems in Bank",   val: stats ? String(stats.totalProblems) : "…" },
                  { label: "Competitions",       val: stats ? String(stats.totalCompetitions) : "…" },
                ] as Array<{ label: string; val: string; color?: string }>).map((row, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                    <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{row.label}</span>
                    <strong style={{ color: row.color || "var(--text-primary)" }}>{row.val}</strong>
                  </div>
                ))}
              </div>
            </div>

            {/* CTF Resource Configuration */}
            <div className="psp-card" style={{ marginBottom: 14 }}>
              <div className="psp-card-header">
                <span className="psp-card-title">
                  <Server size={13} style={{ display: "inline", marginRight: 5, color: "var(--blue)" }} />
                  CTF Server Resources
                </span>
              </div>
              <div style={{ padding: 14, fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>
                Adjust based on available server hardware.
              </div>
              {ctfConfig == null ? (
                <div style={{ padding: 16, fontSize: 12, color: "var(--text-muted)" }}>Loading config…</div>
              ) : (
                <div style={{ padding: "0 14px 14px" }}>
                  {([
                    { key: "maxConcurrentInstances",    label: "Max Concurrent Instances", unit: "containers", help: "3 recommended for 8 GB RAM, 20+ for 32 GB server" },
                    { key: "maxInstancesPerUser",        label: "Max Instances Per User",   unit: "",           help: "Typically 1 to conserve resources" },
                    { key: "maxInstanceDurationMinutes", label: "Instance Duration",         unit: "minutes",    help: "How long before an idle instance is expired" },
                    { key: "containerMemoryLimitMb",     label: "Container Memory Limit",   unit: "MB",         help: "Per-container RAM cap (128–512 MB recommended)" },
                    { key: "containerCpuPercent",        label: "Container CPU Limit",      unit: "%",          help: "Percentage of a single CPU core (50 = 0.5 vCPU)" },
                    { key: "cleanupIntervalSeconds",     label: "Cleanup Interval",         unit: "seconds",    help: "How often the scheduler checks for expired instances" },
                  ] as Array<{ key: keyof CTFResourceConfig; label: string; unit: string; help: string }>).map(({ key, label, unit, help }) => (
                    <div key={key} style={{ marginBottom: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <label className="label" style={{ margin: 0, fontSize: 12 }}>{label}</label>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <input
                            type="number"
                            className="input"
                            value={(ctfConfigDraft[key] as number) ?? ""}
                            onChange={(e) => setCtfConfigDraft((d) => ({ ...d, [key]: parseInt(e.target.value, 10) || 0 }))}
                            style={{ width: 72, textAlign: "center", padding: "3px 6px", fontSize: 13 }}
                          />
                          {unit && <span style={{ fontSize: 11, color: "var(--text-subtle)" }}>{unit}</span>}
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-subtle)" }}>{help}</div>
                    </div>
                  ))}
                  <LoadingButton
                    loading={savingCtf}
                    onClick={saveCtfConfig}
                    variant="primary"
                    size="sm"
                    style={{ width: "100%" }}
                  >
                    Save Configuration
                  </LoadingButton>
                  {ctfConfig.updatedAt && (
                    <div style={{ fontSize: 11, color: "var(--text-subtle)", marginTop: 8, textAlign: "center" }}>
                      Last saved: {new Date(ctfConfig.updatedAt).toLocaleString()}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Top students */}
            <div className="psp-card">
              <div className="psp-card-header">
                <span className="psp-card-title">Top Students</span>
                <Link href="/leaderboard" style={{ fontSize: 11, color: "var(--brand)" }}>Full Leaderboard</Link>
              </div>
              {topStudents.slice(0, 5).map((s, i) => {
                const medals = ["🥇","🥈","🥉"];
                const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
                const ini = `${s.firstName.charAt(0)}${s.lastName.charAt(0)}`.toUpperCase();
                return (
                  <div key={s.studentId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", borderBottom: i < 4 ? "1px solid #f4f5f7" : "none", fontSize: 12 }}>
                    <span style={{ fontSize: 16, width: 20, textAlign: "center" }}>{medals[i] || String(i + 1)}</span>
                    <div style={{ width: 26, height: 26, borderRadius: "50%", background: color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "white" }}>{ini}</div>
                    <span style={{ flex: 1, fontWeight: 500 }}>{s.firstName} {s.lastName}</span>
                    <span style={{ fontWeight: 700, color: "var(--brand)" }}>{s.totalPoints} pts</span>
                  </div>
                );
              })}
              {topStudents.length === 0 && <div style={{ padding: 16, fontSize: 12, color: "var(--text-muted)" }}>No data yet.</div>}
            </div>
          </div>
        </div>
      </div>

      {/* Reject modal */}
      {rejectTarget && (
        <div className="psp-modal-overlay" onClick={() => setRejectTarget(null)}>
          <div className="psp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="psp-modal-header">
              <span style={{ fontSize: 16, fontWeight: 600 }}>
                {(() => { const t = pending.find((x) => x.id === rejectTarget); return t ? `Reject: ${t.firstName} ${t.lastName}` : "Reject Teacher"; })()}
              </span>
              <button onClick={() => setRejectTarget(null)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--text-muted)" }}>
                <X size={18} />
              </button>
            </div>
            <div className="psp-modal-body">
              <label className="label">Reason (optional)</label>
              <textarea
                className="psp-form-textarea"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Cannot verify university affiliation…"
              />
              <div className="psp-alert psp-alert-warn" style={{ marginTop: 12, marginBottom: 0 }}>
                <AlertTriangle size={13} style={{ flexShrink: 0 }} />
                The teacher will receive an email notification with this reason.
              </div>
            </div>
            <div className="psp-modal-footer">
              <button className="psp-btn psp-btn-secondary" onClick={() => setRejectTarget(null)}>Cancel</button>
              <button className="psp-btn psp-btn-danger" onClick={reject} disabled={!!actionLoading} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {actionLoading ? <Loader2 size={13} /> : null} Reject Account
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
