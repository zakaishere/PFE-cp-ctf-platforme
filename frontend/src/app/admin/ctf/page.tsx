"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/features/admin/shell/icons";
import { PageHeading, SkeletonRows, EmptyState, ErrorState, ConfirmDialog } from "@/features/admin/shell/states";
import {
  getCTFAdminInstances, forceStopCTFAdminInstance, getCTFAdminConfig, updateCTFAdminConfig,
  getCTFAdminImages, prewarmCTFAdminImages, getCTFAdminChallenges, getCTFAdminSubmissions,
  type CTFAdminInstance, type CTFResourceConfig, type CTFAdminImage, type CTFAdminChallengeRow, type CTFSubmission,
} from "@/lib/api";

type Tab = "instances" | "config" | "images" | "challenges" | "submissions";
const TABS: { id: Tab; label: string }[] = [
  { id: "instances", label: "Instances" },
  { id: "config", label: "Configuration" },
  { id: "images", label: "Docker Images" },
  { id: "challenges", label: "Challenges" },
  { id: "submissions", label: "Submissions" },
];

const ACTIVE = new Set(["STARTING", "RUNNING"]);
function instTone(s: string) {
  if (ACTIVE.has(s)) return "";
  if (s === "FAILED") return "red";
  if (s === "EXPIRED" || s === "STOPPED") return "muted";
  return "amber";
}

export default function CTFOperationsPage() {
  const [tab, setTab] = useState<Tab>("instances");
  return (
    <div className="content">
      <PageHeading eyebrow="OPERATIONS" title="CTF Operations" subtitle="Instances, capacity, images and challenge oversight" />
      <div className="filter-tabs" role="tablist" aria-label="CTF sections" style={{ marginBottom: 12 }}>
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "instances" && <InstancesTab />}
      {tab === "config" && <ConfigTab />}
      {tab === "images" && <ImagesTab />}
      {tab === "challenges" && <ChallengesTab />}
      {tab === "submissions" && <SubmissionsTab />}
    </div>
  );
}

function InstancesTab() {
  const [rows, setRows] = useState<CTFAdminInstance[] | null>(null);
  const [err, setErr] = useState(false);
  const [target, setTarget] = useState<CTFAdminInstance | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => { setErr(false); setRows(null); getCTFAdminInstances().then(setRows).catch(() => setErr(true)); }, []);
  useEffect(() => { load(); const t = setInterval(load, 15_000); return () => clearInterval(t); }, [load]);

  const stop = async () => {
    if (!target) return;
    setBusy(true);
    try { await forceStopCTFAdminInstance(target.id); setRows((r) => (r ?? []).filter((x) => x.id !== target.id)); }
    catch (e) { console.error(e); }
    setBusy(false); setTarget(null);
  };

  return (
    <section className="panel">
      <div className="panel-header"><h2>Active Instances{rows ? ` (${rows.length})` : ""}</h2><button className="btn-sm" onClick={load}><Icon name="refresh" size={14} /> Refresh</button></div>
      {err ? <ErrorState onRetry={load} />
        : rows == null ? <SkeletonRows rows={5} />
        : rows.length === 0 ? <EmptyState title="No running instances" message="Started CTF containers will appear here." />
        : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Instance</th><th>Status</th><th>Port</th><th>Owner</th><th>Started</th><th>Expires</th><th style={{ textAlign: "right" }}>Action</th></tr></thead>
              <tbody>
                {rows.map((i) => (
                  <tr key={i.id}>
                    <td><strong className="mono">{i.id.slice(0, 8)}</strong><small>{i.containerName ?? "—"}</small></td>
                    <td><span className={`status-pill ${instTone(i.status)}`}>{i.status}</span></td>
                    <td className="mono">{i.assignedPort ?? "—"}</td>
                    <td className="mono">{i.userId?.slice(0, 8) ?? i.teamId?.slice(0, 8) ?? "—"}</td>
                    <td>{i.startedAt ? new Date(i.startedAt).toLocaleTimeString() : "—"}</td>
                    <td>{i.expiresAt ? new Date(i.expiresAt).toLocaleTimeString() : "—"}</td>
                    <td>
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <button className="btn-sm danger" onClick={() => setTarget(i)}><Icon name="trash" size={13} /> Force-stop</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      <ConfirmDialog open={!!target} title="Force-stop instance" danger busy={busy}
                     confirmLabel="Force-stop" onCancel={() => setTarget(null)} onConfirm={stop}>
        This immediately terminates container <strong className="mono">{target?.id.slice(0, 8)}</strong> and frees its port.
        The action is recorded in the audit log.
      </ConfirmDialog>
    </section>
  );
}

const CONFIG_FIELDS: { key: keyof CTFResourceConfig; label: string; unit: string; help: string }[] = [
  { key: "maxConcurrentInstances", label: "Max Concurrent Instances", unit: "containers", help: "Global cap across all users" },
  { key: "maxInstancesPerUser", label: "Max Instances Per User", unit: "", help: "Usually 1 to conserve resources" },
  { key: "maxInstanceDurationMinutes", label: "Instance Duration", unit: "minutes", help: "Lifetime before an instance expires" },
  { key: "containerMemoryLimitMb", label: "Container Memory Limit", unit: "MB", help: "Per-container RAM cap" },
  { key: "containerCpuPercent", label: "Container CPU Limit", unit: "%", help: "Percent of one core (50 = 0.5 vCPU)" },
  { key: "cleanupIntervalSeconds", label: "Cleanup Interval", unit: "seconds", help: "How often expired instances are reaped" },
];

function ConfigTab() {
  const [config, setConfig] = useState<CTFResourceConfig | null>(null);
  const [draft, setDraft] = useState<Partial<CTFResourceConfig>>({});
  const [err, setErr] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(() => { setErr(false); setConfig(null); getCTFAdminConfig().then((c) => { setConfig(c); setDraft(c); }).catch(() => setErr(true)); }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try { const u = await updateCTFAdminConfig(draft); setConfig(u); setDraft(u); setSaved(true); setTimeout(() => setSaved(false), 2500); }
    catch (e) { console.error(e); }
    setSaving(false); setConfirmOpen(false);
  };

  return (
    <section className="panel">
      <div className="panel-header"><h2>Resource Configuration</h2>{config?.updatedAt && <span style={{ fontSize: 11, color: "var(--secondary)" }}>Last saved {new Date(config.updatedAt).toLocaleString()}</span>}</div>
      {err ? <ErrorState onRetry={load} />
        : config == null ? <SkeletonRows rows={6} />
        : (
          <div style={{ padding: 18 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 16 }}>
              {CONFIG_FIELDS.map(({ key, label, unit, help }) => (
                <div key={key}>
                  <label style={{ display: "block", fontSize: 12, marginBottom: 5 }}>{label}</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="number" className="field" style={{ width: 110 }}
                           value={(draft[key] as number) ?? ""}
                           onChange={(e) => setDraft((d) => ({ ...d, [key]: parseInt(e.target.value, 10) || 0 }))} />
                    {unit && <span style={{ fontSize: 11, color: "var(--muted)" }}>{unit}</span>}
                  </div>
                  <p style={{ margin: "5px 0 0", fontSize: 11, color: "var(--muted)" }}>{help}</p>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 18 }}>
              <button className="primary-button" onClick={() => setConfirmOpen(true)}><Icon name="settings" /> Save configuration</button>
              {saved && <span className="success-text" style={{ fontSize: 12 }}><Icon name="check" size={14} /> Saved &amp; audited</span>}
            </div>
          </div>
        )}
      <ConfirmDialog open={confirmOpen} title="Update CTF resource limits" busy={saving}
                     confirmLabel="Save changes" onCancel={() => setConfirmOpen(false)} onConfirm={save}>
        Changing container/instance limits affects capacity for every user. The change is recorded in the audit log.
      </ConfirmDialog>
    </section>
  );
}

function ImagesTab() {
  const [rows, setRows] = useState<CTFAdminImage[] | null>(null);
  const [err, setErr] = useState(false);
  const [refs, setRefs] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => { setErr(false); setRows(null); getCTFAdminImages().then(setRows).catch(() => setErr(true)); }, []);
  useEffect(() => { load(); }, [load]);

  const prewarm = async () => {
    const list = refs.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
    if (list.length === 0) return;
    setBusy(true); setMsg(null);
    try { const r = await prewarmCTFAdminImages(list); setMsg(r.message); setRefs(""); setTimeout(load, 1200); }
    catch (e) { console.error(e); setMsg("Pre-warm failed."); }
    setBusy(false);
  };

  return (
    <div className="stack">
      <section className="panel">
        <div className="panel-header"><h2>Pre-warm images</h2></div>
        <div style={{ padding: 18 }}>
          <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--secondary)" }}>Pull Docker images ahead of time (comma- or newline-separated refs). Recorded in the audit log.</p>
          <textarea className="field grow" style={{ width: "100%", minHeight: 72, padding: 10, resize: "vertical" }}
                    placeholder="ghcr.io/org/challenge:latest" value={refs} onChange={(e) => setRefs(e.target.value)} />
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
            <button className="primary-button" disabled={busy || !refs.trim()} onClick={prewarm}><Icon name="download" /> Pre-warm</button>
            {msg && <span style={{ fontSize: 12, color: "var(--secondary)" }}>{msg}</span>}
          </div>
        </div>
      </section>
      <section className="panel">
        <div className="panel-header"><h2>Image cache{rows ? ` (${rows.length})` : ""}</h2><button className="btn-sm" onClick={load}><Icon name="refresh" size={14} /> Refresh</button></div>
        {err ? <ErrorState onRetry={load} />
          : rows == null ? <SkeletonRows rows={4} />
          : rows.length === 0 ? <EmptyState title="No images cached" message="Pre-warmed images will be listed here." />
          : (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Image</th><th>Status</th><th>Pulled</th><th>Error</th></tr></thead>
                <tbody>
                  {rows.map((im) => (
                    <tr key={im.id}>
                      <td className="mono">{im.imageRef}</td>
                      <td><span className={`status-pill ${im.status === "READY" || im.status === "PULLED" ? "" : im.status === "FAILED" ? "red" : "amber"}`}>{im.status}</span></td>
                      <td>{im.pulledAt ? new Date(im.pulledAt).toLocaleString() : "—"}</td>
                      <td className="red-text" style={{ fontSize: 11 }}>{im.error ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </section>
    </div>
  );
}

function ChallengesTab() {
  const [rows, setRows] = useState<CTFAdminChallengeRow[] | null>(null);
  const [err, setErr] = useState(false);
  const load = useCallback(() => { setErr(false); setRows(null); getCTFAdminChallenges().then(setRows).catch(() => setErr(true)); }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <section className="panel">
      <div className="panel-header"><h2>Challenges{rows ? ` (${rows.length})` : ""}</h2><button className="btn-sm" onClick={load}><Icon name="refresh" size={14} /> Refresh</button></div>
      {err ? <ErrorState onRetry={load} />
        : rows == null ? <SkeletonRows rows={5} />
        : rows.length === 0 ? <EmptyState title="No challenges" message="Challenges created by teachers/admins will appear here." />
        : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Title</th><th>Category</th><th>Difficulty</th><th>Points</th><th>Instanced</th><th>Active</th></tr></thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td><strong>{c.title}</strong><small className="mono">{c.id.slice(0, 8)}</small></td>
                    <td>{c.category ?? "—"}</td>
                    <td>{c.difficulty ?? "—"}</td>
                    <td className="mono">{c.basePoints ?? "—"}</td>
                    <td>{c.requiresInstance ? "Yes" : "No"}</td>
                    <td>{(c.isActive ?? c.active) ? <span className="status-pill">ACTIVE</span> : <span className="status-pill muted">OFF</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </section>
  );
}

function SubmissionsTab() {
  const [rows, setRows] = useState<CTFSubmission[] | null>(null);
  const [err, setErr] = useState(false);
  const load = useCallback(() => { setErr(false); setRows(null); getCTFAdminSubmissions(undefined, 0, 50).then(setRows).catch(() => setErr(true)); }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <section className="panel">
      <div className="panel-header"><h2>Flag Submissions{rows ? ` (${rows.length})` : ""}</h2><button className="btn-sm" onClick={load}><Icon name="refresh" size={14} /> Refresh</button></div>
      {err ? <ErrorState onRetry={load} />
        : rows == null ? <SkeletonRows rows={6} />
        : rows.length === 0 ? <EmptyState title="No submissions" message="Flag submissions will appear here." />
        : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Challenge</th><th>User</th><th>Result</th><th>Attempt</th><th>When</th><th>IP</th></tr></thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id}>
                    <td className="mono">{s.challengeId.slice(0, 8)}</td>
                    <td className="mono">{s.userId.slice(0, 8)}</td>
                    <td>{s.isCorrect ? <span className="status-pill">CORRECT</span> : <span className="status-pill red">WRONG</span>}</td>
                    <td className="mono">#{s.attemptNumber}</td>
                    <td>{s.submittedAt ? new Date(s.submittedAt).toLocaleString() : "—"}</td>
                    <td className="mono">{s.ipAddress ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </section>
  );
}
