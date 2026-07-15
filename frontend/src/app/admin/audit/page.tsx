"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "@/features/admin/shell/icons";
import { PageHeading, SkeletonRows, EmptyState, ErrorState } from "@/features/admin/shell/states";
import { getGlobalAudit, downloadGlobalAuditExport, type AuditEventDTO } from "@/lib/api";

const DOMAINS = ["", "ADMIN", "CTF", "EXAM", "TP", "CP"] as const;
const SEVERITIES = ["", "INFO", "WARN", "CHEAT"] as const;

function sevClass(s: string) {
  if (s === "WARN") return "warn";
  if (s === "CHEAT") return "cheat";
  return "";
}
function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function AdminAuditPage() {
  const [rows, setRows] = useState<AuditEventDTO[] | null>(null);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [domain, setDomain] = useState("");
  const [severity, setSeverity] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [err, setErr] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(() => {
    setRows(null); setErr(false);
    getGlobalAudit(page, 50, flaggedOnly)
      .then((p) => { setRows(p.content); setTotalPages(p.totalPages); })
      .catch(() => setErr(true));
  }, [page, flaggedOnly]);
  useEffect(() => { load(); }, [load]);

  // Domain/severity narrow the visible page; the same filters are applied
  // server-side (across all rows) when exporting.
  const visible = useMemo(() => (rows ?? []).filter((e) =>
    (!domain || e.domain === domain) && (!severity || e.severity === severity)), [rows, domain, severity]);

  const doExport = async () => {
    setExporting(true);
    try { await downloadGlobalAuditExport({ domain: domain || undefined, severity: severity || undefined, from: from || undefined, to: to || undefined }); }
    catch (e) { console.error(e); }
    setExporting(false);
  };

  return (
    <div className="content">
      <PageHeading
        eyebrow="GOVERNANCE"
        title="Audit Logs"
        subtitle="Immutable record of platform events and privileged actions"
        right={<button className="primary-button" disabled={exporting} onClick={doExport}><Icon name="download" /> Export CSV</button>}
      />

      <div className="toolbar" style={{ marginBottom: 12 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "var(--secondary)" }}>
          Domain
          <select className="field" value={domain} onChange={(e) => setDomain(e.target.value)} aria-label="Filter domain">
            {DOMAINS.map((d) => <option key={d || "ALL"} value={d}>{d || "All domains"}</option>)}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "var(--secondary)" }}>
          Severity
          <select className="field" value={severity} onChange={(e) => setSeverity(e.target.value)} aria-label="Filter severity">
            {SEVERITIES.map((s) => <option key={s || "ALL"} value={s}>{s || "All severities"}</option>)}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "var(--secondary)" }}>
          From (export)
          <input type="date" className="field" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Export from date" />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "var(--secondary)" }}>
          To (export)
          <input type="date" className="field" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Export to date" />
        </label>
        <button className={`btn-sm ${flaggedOnly ? "danger" : ""}`} style={{ alignSelf: "flex-end" }}
                onClick={() => { setPage(0); setFlaggedOnly((v) => !v); }} aria-pressed={flaggedOnly}>
          <Icon name="flag" size={13} /> Flagged only
        </button>
      </div>

      <section className="panel">
        <div className="panel-header">
          <h2>Events{rows ? ` · showing ${visible.length}` : ""}</h2>
          <button className="btn-sm" onClick={load}><Icon name="refresh" size={14} /> Refresh</button>
        </div>
        {err ? <ErrorState message="Couldn't load the audit feed. Admin permission is required." onRetry={load} />
          : rows == null ? <SkeletonRows rows={8} />
          : visible.length === 0 ? <EmptyState title="No matching events" message="Adjust the domain/severity filters, or clear “Flagged only”." />
          : (
            <>
              <div className="table-wrap">
                <table className="data-table audit-table">
                  <thead><tr><th>Time</th><th>Domain</th><th>Event</th><th>Actor</th><th>Context</th><th>Severity</th></tr></thead>
                  <tbody>
                    {visible.map((e) => (
                      <tr key={e.id}>
                        <td className="mono">{fmt(e.createdAt)}</td>
                        <td><span className={`status-pill ${e.domain === "ADMIN" ? "amber" : e.domain === "CTF" ? "ctf" : "muted"}`}>{e.domain}</span></td>
                        <td><strong>{e.eventType}</strong>{e.detail && Object.keys(e.detail).length > 0 && <small>{Object.entries(e.detail).slice(0, 2).map(([k, v]) => `${k}: ${String(v)}`).join(" · ")}</small>}</td>
                        <td className="mono">{e.actorUserId?.slice(0, 8) ?? "—"}</td>
                        <td className="mono">{e.contextId?.slice(0, 8) ?? "—"}</td>
                        <td><span className={`severity ${sevClass(e.severity)}`}>{e.severity}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="panel-footer">
                <span>Page {page + 1} of {Math.max(1, totalPages)}{(domain || severity) ? " · filtered view" : ""}</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn-sm" disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Previous</button>
                  <button className="btn-sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Next</button>
                </div>
              </div>
            </>
          )}
      </section>
    </div>
  );
}
