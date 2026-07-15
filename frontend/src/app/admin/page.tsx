"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/features/admin/shell/icons";
import { PageHeading, SkeletonRows, EmptyState, UnavailablePanel, ErrorState, ConfirmDialog } from "@/features/admin/shell/states";
import {
  getPlatformStats, getAdminDashboardOverview, getSubmissionsToday,
  getAdminHealthMetrics, getCTFAdminInstances, getCTFAdminConfig, getGlobalAudit,
  getPendingTeachers, activateTeacher, rejectTeacher,
  type PlatformStats, type AdminHealthMetrics, type CTFResourceConfig,
  type AuditEventDTO, type PendingTeacher, type CTFAdminInstance,
} from "@/lib/api";

const fmt = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString());
const ACTIVE_INSTANCE = new Set(["STARTING", "RUNNING"]);

function severityClass(s: string) {
  if (s === "WARN") return "warn";
  if (s === "CHEAT" || s === "CRITICAL") return "crit";
  return "";
}
function timeAgo(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return d.toLocaleDateString();
}

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [activeComps, setActiveComps] = useState<number | null>(null);
  const [subsToday, setSubsToday] = useState<number | null>(null);
  const [health, setHealth] = useState<AdminHealthMetrics | null>(null);
  const [instances, setInstances] = useState<CTFAdminInstance[] | null>(null);
  const [ctfConfig, setCtfConfig] = useState<CTFResourceConfig | null>(null);
  const [audit, setAudit] = useState<AuditEventDTO[] | null>(null);
  const [pending, setPending] = useState<PendingTeacher[] | null>(null);

  const [statsErr, setStatsErr] = useState(false);
  const [healthErr, setHealthErr] = useState(false);
  const [auditErr, setAuditErr] = useState(false);
  const [pendingErr, setPendingErr] = useState(false);

  const [acting, setActing] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PendingTeacher | null>(null);

  const loadStats = useCallback(() => {
    setStatsErr(false);
    getPlatformStats().then(setStats).catch(() => setStatsErr(true));
    getAdminDashboardOverview().then((o) => setActiveComps(o.stats.activeCompetitions)).catch(() => setActiveComps(null));
    getSubmissionsToday().then((r) => setSubsToday(r.count)).catch(() => setSubsToday(null));
  }, []);
  const loadHealth = useCallback(() => {
    setHealthErr(false);
    getAdminHealthMetrics().then(setHealth).catch(() => setHealthErr(true));
  }, []);
  const loadCtf = useCallback(() => {
    getCTFAdminInstances().then(setInstances).catch(() => setInstances(null));
    getCTFAdminConfig().then(setCtfConfig).catch(() => setCtfConfig(null));
  }, []);
  const loadAudit = useCallback(() => {
    setAuditErr(false);
    getGlobalAudit(0, 6).then((p) => setAudit(p.content)).catch(() => setAuditErr(true));
  }, []);
  const loadPending = useCallback(() => {
    setPendingErr(false);
    getPendingTeachers().then(setPending).catch(() => setPendingErr(true));
  }, []);

  useEffect(() => { loadStats(); loadHealth(); loadCtf(); loadAudit(); loadPending(); }, [loadStats, loadHealth, loadCtf, loadAudit, loadPending]);

  const approve = async (id: string) => {
    setActing(id);
    try { await activateTeacher(id); setPending((p) => (p ?? []).filter((t) => t.id !== id)); }
    catch (e) { console.error(e); }
    setActing(null);
  };
  const doReject = async () => {
    if (!rejectTarget) return;
    setActing(rejectTarget.id);
    try { await rejectTeacher(rejectTarget.id); setPending((p) => (p ?? []).filter((t) => t.id !== rejectTarget.id)); }
    catch (e) { console.error(e); }
    setActing(null); setRejectTarget(null);
  };

  const activeInstances = instances?.filter((i) => ACTIVE_INSTANCE.has(i.status)).length ?? null;
  const totalUsers = stats ? (stats.totalStudents ?? 0) + (stats.totalTeachers ?? 0) : null;
  const pendingCount = pending?.length ?? 0;

  const attention: { tone: "danger" | "warning" | "ok"; icon: Parameters<typeof Icon>[0]["name"]; title: string; detail: string; href: string; action: string }[] = [];
  if (pendingCount > 0) attention.push({ tone: "warning", icon: "users", title: `${pendingCount} teacher approval${pendingCount !== 1 ? "s" : ""}`, detail: "Awaiting review", href: "/admin/users?role=TEACHER", action: "Review" });
  if (health && health.overall !== "OK") attention.push({ tone: health.overall === "CRITICAL" ? "danger" : "warning", icon: "server", title: `Infrastructure ${health.overall === "CRITICAL" ? "critical" : "degraded"}`, detail: "One or more services need attention", href: "/admin/infrastructure", action: "View" });
  if (ctfConfig && activeInstances != null && ctfConfig.maxConcurrentInstances > 0 && activeInstances >= ctfConfig.maxConcurrentInstances * 0.8)
    attention.push({ tone: "warning", icon: "shield", title: "CTF capacity high", detail: `${activeInstances}/${ctfConfig.maxConcurrentInstances} instances in use`, href: "/admin/ctf", action: "Manage" });

  return (
    <div className="content">
      <PageHeading
        eyebrow="ADMIN / CONTROL CENTER"
        title="Admin Control Center"
        subtitle="Platform operations, security and live oversight"
        right={<span className="last-updated"><span className="status-dot" />Live · updated just now</span>}
      />

      {/* 1 — Attention queue */}
      <section className="attention-strip" aria-label="Requires attention" style={{ marginBottom: 12 }}>
        {pendingErr || healthErr ? (
          <button onClick={() => { loadPending(); loadHealth(); }}>
            <span className="attention-icon warning"><Icon name="warning" /></span>
            <span><strong>Some signals unavailable</strong><small>Couldn&apos;t load part of the queue — retry</small></span>
            <span className="strip-action">Retry <Icon name="refresh" size={14} /></span>
          </button>
        ) : attention.length === 0 ? (
          <button style={{ cursor: "default" }}>
            <span className="attention-icon ok"><Icon name="check" /></span>
            <span><strong>All clear</strong><small>No items need attention right now</small></span>
            <span className="strip-action">Nominal</span>
          </button>
        ) : attention.map((a) => (
          <Link key={a.title} href={a.href}>
            <span className={`attention-icon ${a.tone}`}><Icon name={a.icon} /></span>
            <span><strong>{a.title}</strong><small>{a.detail}</small></span>
            <span className="strip-action">{a.action} <Icon name="chevron" size={14} /></span>
          </Link>
        ))}
      </section>

      {/* 2 — KPI cards */}
      <section className="kpi-grid">
        <Link className="kpi-card" href="/admin/users">
          <span className="kpi-icon"><Icon name="users" /></span>
          <span className="kpi-copy"><strong>{statsErr ? "—" : fmt(totalUsers)}</strong><small>Total Users</small></span>
        </Link>
        <Link className="kpi-card" href="/admin/competitions">
          <span className="kpi-icon"><Icon name="trophy" /></span>
          <span className="kpi-copy"><strong>{fmt(activeComps)}</strong><small>Live Competitions</small></span>
        </Link>
        <Link className="kpi-card" href="/admin/submissions">
          <span className="kpi-icon submissions"><Icon name="file" /></span>
          <span className="kpi-copy"><strong>{fmt(subsToday)}</strong><small>Submissions Today</small></span>
        </Link>
        <Link className="kpi-card" href="/admin/ctf">
          <span className="kpi-icon"><Icon name="shield" /></span>
          <span className="kpi-copy"><strong>{fmt(activeInstances)}</strong><small>Active CTF Instances</small></span>
        </Link>
      </section>

      <div className="main-grid">
        {/* Pending approvals — real + actionable */}
        <section className="panel">
          <div className="panel-header">
            <div><span className="live-dot" /><h2>Pending Teacher Approvals{pending ? ` (${pending.length})` : ""}</h2></div>
            <Link href="/admin/users?role=TEACHER">Manage users</Link>
          </div>
          {pendingErr ? <ErrorState onRetry={loadPending} />
            : pending == null ? <SkeletonRows rows={3} />
            : pending.length === 0 ? <EmptyState title="All clear!" message="No teacher accounts are waiting for approval." />
            : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Teacher</th><th>Email</th><th>Department</th><th style={{ textAlign: "right" }}>Actions</th></tr></thead>
                  <tbody>
                    {pending.map((t) => (
                      <tr key={t.id}>
                        <td><strong>{t.firstName} {t.lastName}</strong><small>{t.specialty ?? "—"}</small></td>
                        <td>{t.email}</td>
                        <td>{t.department ?? "—"}</td>
                        <td>
                          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                            <button className="btn-sm green" disabled={acting === t.id} onClick={() => approve(t.id)}>
                              <Icon name="check" size={13} /> Approve
                            </button>
                            <button className="btn-sm danger" disabled={acting === t.id} onClick={() => setRejectTarget(t)}>
                              <Icon name="close" size={13} /> Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </section>

        {/* Infrastructure — real metrics we have */}
        <section className="panel">
          <div className="panel-header"><h2>Infrastructure</h2><Link href="/admin/infrastructure">View all</Link></div>
          {healthErr ? <ErrorState onRetry={loadHealth} />
            : health == null ? <SkeletonRows rows={3} />
            : (
              <div className="resource-list">
                <ResourceRow icon="queue" name="RabbitMQ" value={health.rabbitmq.status === "UNKNOWN" ? "Unavailable" : `${health.rabbitmq.queueDepth} msgs`} detail="Submission queue depth" status={health.rabbitmq.status} pct={health.rabbitmq.status === "UNKNOWN" ? 0 : Math.min(100, health.rabbitmq.queueDepth)} />
                <ResourceRow icon="database" name="Database" value={health.database.status === "UNKNOWN" ? "Unavailable" : `${health.database.active ?? "?"} / ${health.database.total ?? "?"}`} detail="Active connections" status={health.database.status} pct={health.database.total ? Math.round(((health.database.active ?? 0) / health.database.total) * 100) : 0} />
                <ResourceRow icon="cpu" name="JVM Heap" value={`${health.heap.pct}%`} detail={`${health.heap.usedMb} / ${health.heap.totalMb} MB`} status={health.heap.status} pct={health.heap.pct} />
                <div style={{ padding: "10px 0 2px" }}>
                  <UnavailablePanel feature="Judge cluster & CTF worker telemetry" note="Per-node health, host CPU/memory and container capacity are not reported yet." />
                </div>
              </div>
            )}
          <div className="health-footer">
            <span className={health ? (health.overall === "OK" ? "" : health.overall === "WARN" ? "warn" : "crit") : "warn"}>
              <Icon name={health?.overall === "OK" ? "check" : "warning"} size={15} />
              {health ? (health.overall === "OK" ? "Core services operational" : `Overall: ${health.overall}`) : "Status unknown"}
            </span>
          </div>
        </section>

        {/* Live competitions — aggregate view not built (excluded this pass) */}
        <section className="panel">
          <div className="panel-header"><div><span className="live-dot" /><h2>Live Competitions</h2></div><Link href="/admin/competitions">Manage</Link></div>
          <UnavailablePanel feature="Live competition operations table" note="Participants, submission counts and judge load are not aggregated yet. The competitions management screen is available from “Manage”." />
        </section>

        {/* Recent audit — real */}
        <section className="panel">
          <div className="panel-header"><h2>Recent Audit Log</h2><Link href="/admin/audit">View full log</Link></div>
          {auditErr ? <ErrorState onRetry={loadAudit} />
            : audit == null ? <SkeletonRows rows={4} />
            : audit.length === 0 ? <EmptyState title="No audit events yet" message="Privileged actions will appear here as they happen." />
            : (
              <div className="table-wrap">
                <table className="data-table audit-table">
                  <thead><tr><th>Event</th><th>Actor</th><th>Time</th><th>Severity</th></tr></thead>
                  <tbody>
                    {audit.map((e) => (
                      <tr key={e.id}>
                        <td><strong>{e.eventType}</strong><small>{e.domain}</small></td>
                        <td className="mono">{e.actorUserId?.slice(0, 8) ?? "—"}</td>
                        <td>{timeAgo(e.createdAt)}</td>
                        <td><span className={`severity ${severityClass(e.severity)}`}>{e.severity}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </section>
      </div>

      <ConfirmDialog
        open={!!rejectTarget}
        title="Reject teacher application"
        danger
        busy={acting === rejectTarget?.id}
        confirmLabel="Reject account"
        onCancel={() => setRejectTarget(null)}
        onConfirm={doReject}
      >
        This permanently removes <strong>{rejectTarget?.firstName} {rejectTarget?.lastName}</strong>&apos;s pending
        application ({rejectTarget?.email}). This action is recorded in the audit log.
      </ConfirmDialog>
    </div>
  );
}

function ResourceRow({ icon, name, value, detail, status, pct }: {
  icon: Parameters<typeof Icon>[0]["name"]; name: string; value: string; detail: string;
  status: "OK" | "WARN" | "CRITICAL" | "UNKNOWN"; pct: number;
}) {
  const tone = status === "OK" ? "" : status === "WARN" ? "amber" : status === "CRITICAL" ? "red" : "unknown";
  return (
    <div className="resource-row">
      <span className="resource-icon"><Icon name={icon} /></span>
      <span className="resource-copy">
        <span><strong>{name}</strong><b>{value}</b></span>
        <small>{detail} · {status}</small>
        <span className={`resource-progress ${tone}`}><i style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /></span>
      </span>
    </div>
  );
}
