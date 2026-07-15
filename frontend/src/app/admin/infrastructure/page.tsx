"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/features/admin/shell/icons";
import { PageHeading, SkeletonRows, UnavailablePanel, ErrorState } from "@/features/admin/shell/states";
import {
  getAdminHealthMetrics, getCTFAdminInstances, getCTFAdminConfig,
  type AdminHealthMetrics, type CTFAdminInstance, type CTFResourceConfig,
} from "@/lib/api";

const ACTIVE = new Set(["STARTING", "RUNNING"]);

export default function InfrastructurePage() {
  const [health, setHealth] = useState<AdminHealthMetrics | null>(null);
  const [instances, setInstances] = useState<CTFAdminInstance[] | null>(null);
  const [config, setConfig] = useState<CTFResourceConfig | null>(null);
  const [err, setErr] = useState(false);

  const load = useCallback(() => {
    setErr(false);
    getAdminHealthMetrics().then(setHealth).catch(() => setErr(true));
    getCTFAdminInstances().then(setInstances).catch(() => setInstances(null));
    getCTFAdminConfig().then(setConfig).catch(() => setConfig(null));
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 15_000); return () => clearInterval(t); }, [load]);

  const activeInstances = instances?.filter((i) => ACTIVE.has(i.status)).length;

  return (
    <div className="content">
      <PageHeading
        eyebrow="INFRASTRUCTURE"
        title="Infrastructure"
        subtitle="Service health, queues and CTF capacity"
        right={<button className="btn-sm" onClick={load}><Icon name="refresh" size={14} /> Refresh</button>}
      />

      <div className="main-grid">
        <section className="panel">
          <div className="panel-header"><h2>Core Services</h2><span style={{ fontSize: 11, color: "var(--secondary)" }}>Auto-refresh 15s</span></div>
          {err ? <ErrorState onRetry={load} />
            : health == null ? <SkeletonRows rows={3} />
            : (
              <div className="resource-list">
                <Row icon="queue" name="RabbitMQ Queue" value={health.rabbitmq.status === "UNKNOWN" ? "Unavailable" : `${health.rabbitmq.queueDepth} messages`} detail="psp.submission.queue depth" status={health.rabbitmq.status} pct={health.rabbitmq.status === "UNKNOWN" ? 0 : Math.min(100, health.rabbitmq.queueDepth)} />
                <Row icon="database" name="Database Connections" value={health.database.status === "UNKNOWN" ? "Unavailable" : `${health.database.active ?? "?"} / ${health.database.total ?? "?"}`} detail="HikariCP active / max" status={health.database.status} pct={health.database.total ? Math.round(((health.database.active ?? 0) / health.database.total) * 100) : 0} />
                <Row icon="cpu" name="JVM Heap" value={`${health.heap.usedMb} / ${health.heap.totalMb} MB (${health.heap.pct}%)`} detail="Backend heap usage" status={health.heap.status} pct={health.heap.pct} />
              </div>
            )}
          <div className="health-footer">
            <span className={health ? (health.overall === "OK" ? "" : health.overall === "WARN" ? "warn" : "crit") : "warn"}>
              <Icon name={health?.overall === "OK" ? "check" : "warning"} size={15} />
              {health ? `Overall: ${health.overall}` : "Status unknown"}
            </span>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header"><h2>CTF Capacity</h2></div>
          {instances == null || config == null ? <SkeletonRows rows={2} />
            : (
              <div className="resource-list">
                <Row icon="shield" name="Active Instances" value={`${activeInstances} / ${config.maxConcurrentInstances}`} detail="Running containers vs configured max" status={activeInstances != null && activeInstances >= config.maxConcurrentInstances ? "CRITICAL" : activeInstances != null && activeInstances >= config.maxConcurrentInstances * 0.8 ? "WARN" : "OK"} pct={config.maxConcurrentInstances ? Math.round(((activeInstances ?? 0) / config.maxConcurrentInstances) * 100) : 0} />
                <Row icon="clock" name="Instance Duration" value={`${config.maxInstanceDurationMinutes} min`} detail="Max lifetime before expiry" status="OK" pct={100} />
                <Row icon="cpu" name="Per-Container Limits" value={`${config.containerMemoryLimitMb} MB · ${config.containerCpuPercent}% CPU`} detail="Memory / CPU cap per container" status="OK" pct={100} />
              </div>
            )}
        </section>

        <section className="panel">
          <div className="panel-header"><h2>Judge Cluster & Workers</h2></div>
          <UnavailablePanel feature="Per-node judge & worker telemetry" note="Individual judge/worker node health, host CPU/memory, and running-container counts require the worker agents to report metrics — not implemented in this pass." />
        </section>

        <section className="panel">
          <div className="panel-header"><h2>Incidents</h2></div>
          <UnavailablePanel feature="Incident history" note="There is no incident tracking backend yet." />
        </section>
      </div>
    </div>
  );
}

function Row({ icon, name, value, detail, status, pct }: {
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
