"use client";

import { useState, useEffect, useCallback } from "react";
import Navbar from "@/components/Navbar";
import {
  ShieldAlert, AlertTriangle, Globe, Monitor, X, Loader2, ChevronRight,
} from "lucide-react";
import {
  getAuditSummary, getAuditUserLog,
  type AuditDomain, type UserAuditSummary, type AuditEventDTO,
} from "@/lib/api";

const MONO = "var(--font-mono), ui-monospace, monospace";

// ── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: UserAuditSummary["status"] }) {
  const map = {
    "MULTI-IP FLAG": { color: "var(--danger)", bg: "var(--danger-soft)", icon: <ShieldAlert size={11} /> },
    "REVIEW":        { color: "var(--warn)",   bg: "var(--warn-soft)",   icon: <AlertTriangle size={11} /> },
    "CLEAN":         { color: "var(--accent)", bg: "var(--accent-dim)",  icon: null },
  }[status];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 10, fontWeight: 700, letterSpacing: "0.04em",
      color: map.color, background: map.bg,
      border: `1px solid color-mix(in srgb, ${map.color} 25%, transparent)`,
      borderRadius: 20, padding: "3px 9px",
    }}>
      {map.icon}{status}
    </span>
  );
}

// ── Metadata formatter for the drill-down ────────────────────────────────────

function formatEvent(e: AuditEventDTO): string {
  const d = e.detail ?? {};
  switch (e.eventType) {
    case "TAB_SWITCH":   return "Switched away from the exam tab";
    case "WINDOW_BLUR":
    case "FOCUS_LOSS":   return "Window lost focus";
    case "COPY_ATTEMPT": return "Attempted to copy content";
    case "PASTE_ATTEMPT":return "Attempted to paste outside the editor";
    case "CUT_ATTEMPT":  return "Attempted to cut content";
    case "CONTEXT_MENU": return "Opened the right-click menu";
    case "MULTI_IP":     return `Connected from multiple IPs: ${Array.isArray(d.ips) ? (d.ips as string[]).join(", ") : "—"}`;
    default:             return e.eventType.replace(/_/g, " ").toLowerCase();
  }
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// ── Drill-down drawer ────────────────────────────────────────────────────────

function UserDrawer({ domain, contextId, user, onClose }: {
  domain: AuditDomain; contextId: string; user: UserAuditSummary; onClose: () => void;
}) {
  const [log, setLog] = useState<AuditEventDTO[] | null>(null);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => { if (ev.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    getAuditUserLog(domain, contextId, user.userId)
      .then((l) => { if (!cancelled) setLog(l); })
      .catch(() => { if (!cancelled) setLog([]); });
    return () => { cancelled = true; };
  }, [domain, contextId, user.userId]);

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,.55)",
      backdropFilter: "blur(4px)", display: "flex", justifyContent: "flex-end",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 480, height: "100%", background: "var(--bg-2)",
        borderLeft: "1px solid var(--line-2)", display: "flex", flexDirection: "column",
      }}>
        <div style={{
          padding: "18px 22px", borderBottom: "1px solid var(--line)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>{user.userName}</div>
            <div style={{ fontSize: 12, color: "var(--ink-3)", fontFamily: MONO, marginTop: 2 }}>
              {user.ips.join(" · ") || "no IP recorded"}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{
            background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 8,
            padding: 6, color: "var(--ink-2)", cursor: "pointer", display: "flex",
          }}><X size={14} /></button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "8px 22px" }}>
          {log === null ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
              <Loader2 size={22} style={{ animation: "spin 1s linear infinite", color: "var(--accent)" }} />
            </div>
          ) : log.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--ink-3)", padding: "24px 0" }}>No events recorded.</p>
          ) : log.map((e) => (
            <div key={e.id} style={{
              display: "flex", gap: 12, padding: "10px 0", alignItems: "flex-start",
              borderBottom: "1px solid var(--line)",
              background: e.severity === "CHEAT" ? "var(--danger-soft)" : "transparent",
            }}>
              <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--ink-3)", flexShrink: 0, width: 62 }}>
                {fmtTime(e.createdAt)}
              </span>
              <span style={{ fontSize: 12, color: "var(--ink)", flex: 1 }}>{formatEvent(e)}</span>
              {typeof e.detail?.ip === "string" && (
                <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--ink-3)", flexShrink: 0 }}>
                  {e.detail.ip as string}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Dashboard ────────────────────────────────────────────────────────────────

export default function AuditDashboard({ domain, contextId, title }: {
  domain: AuditDomain; contextId: string; title?: string;
}) {
  const [rows, setRows] = useState<UserAuditSummary[] | null>(null);
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [selected, setSelected] = useState<UserAuditSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    getAuditSummary(domain, contextId)
      .then((r) => { setRows(r); setError(null); })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load audit log"));
  }, [domain, contextId]);

  useEffect(() => { load(); }, [load]);

  const visible = (rows ?? []).filter((r) => !flaggedOnly || r.flagged);
  const flaggedCount = (rows ?? []).filter((r) => r.flagged).length;

  const th: React.CSSProperties = {
    padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700,
    color: "var(--ink-3)", letterSpacing: "0.06em", textTransform: "uppercase",
  };
  const td: React.CSSProperties = { padding: "12px 14px", fontSize: 13, color: "var(--ink)" };

  return (
    <>
      <Navbar />
      {selected && (
        <UserDrawer domain={domain} contextId={contextId} user={selected} onClose={() => setSelected(null)} />
      )}
      <div style={{ minHeight: "calc(100vh - 56px)", background: "var(--bg)", color: "var(--ink)" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 24px 80px" }}>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
            <div>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "var(--warn-soft)", border: "1px solid color-mix(in srgb, var(--warn) 20%, transparent)",
                borderRadius: 999, padding: "4px 12px", fontSize: 11, fontWeight: 700,
                color: "var(--warn)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12,
              }}>
                <ShieldAlert size={12} /> Audit Log
              </div>
              <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", margin: 0 }}>
                {title ?? `${domain} audit`}
              </h1>
              {flaggedCount > 0 && (
                <p style={{ fontSize: 13, color: "var(--danger)", margin: "6px 0 0", fontWeight: 600 }}>
                  {flaggedCount} participant{flaggedCount === 1 ? "" : "s"} flagged for review
                </p>
              )}
            </div>
            <button onClick={() => setFlaggedOnly((v) => !v)} style={{
              fontSize: 13, fontWeight: 600, cursor: "pointer",
              padding: "8px 14px", borderRadius: 8,
              color: flaggedOnly ? "var(--danger)" : "var(--ink-2)",
              background: flaggedOnly ? "var(--danger-soft)" : "var(--surface)",
              border: `1px solid ${flaggedOnly ? "color-mix(in srgb, var(--danger) 25%, transparent)" : "var(--line-2)"}`,
            }}>
              Flagged only
            </button>
          </div>

          {error ? (
            <div style={{ padding: "48px 0", textAlign: "center", color: "var(--danger)" }}>{error}</div>
          ) : rows === null ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
              <Loader2 size={26} style={{ animation: "spin 1s linear infinite", color: "var(--accent)" }} />
            </div>
          ) : visible.length === 0 ? (
            <div style={{ textAlign: "center", padding: "56px 0", color: "var(--ink-3)", border: "1px dashed var(--line-2)", borderRadius: 16 }}>
              <Monitor size={30} style={{ opacity: 0.4, marginBottom: 10 }} />
              <p style={{ fontSize: 14, margin: 0 }}>{flaggedOnly ? "No flagged participants." : "No audit activity recorded yet."}</p>
            </div>
          ) : (
            <div style={{ background: "var(--surface)", border: "1px solid var(--line-2)", borderRadius: 16, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--line-2)" }}>
                    <th style={th}>User</th>
                    <th style={{ ...th, textAlign: "center" }}>IPs</th>
                    <th style={{ ...th, textAlign: "center" }}>Tabs</th>
                    <th style={{ ...th, textAlign: "center" }}>Focus</th>
                    <th style={{ ...th, textAlign: "center" }}>Paste</th>
                    <th style={th}>Status</th>
                    <th style={th}></th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr key={r.userId} onClick={() => setSelected(r)} style={{
                      borderBottom: "1px solid var(--line)", cursor: "pointer",
                      background: r.multiIp ? "var(--danger-soft)" : "transparent",
                    }}>
                      <td style={{ ...td, fontWeight: 600 }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                          {r.flagged && <AlertTriangle size={13} color="var(--danger)" />}
                          {r.userName}
                        </span>
                      </td>
                      <td style={{ ...td, textAlign: "center", fontFamily: MONO }}>
                        {r.distinctIpCount > 1 ? (
                          <span title={r.ips.join(", ")} style={{ color: "var(--danger)", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <Globe size={12} />{r.distinctIpCount}
                          </span>
                        ) : (
                          <span style={{ color: "var(--ink-3)" }} title={r.ips[0] ?? ""}>{r.distinctIpCount}</span>
                        )}
                      </td>
                      <td style={{ ...td, textAlign: "center", fontFamily: MONO, color: r.tabSwitches >= 3 ? "var(--warn)" : "var(--ink-2)" }}>{r.tabSwitches}</td>
                      <td style={{ ...td, textAlign: "center", fontFamily: MONO, color: "var(--ink-2)" }}>{r.focusLosses}</td>
                      <td style={{ ...td, textAlign: "center", fontFamily: MONO, color: r.copyPastes >= 3 ? "var(--warn)" : "var(--ink-2)" }}>{r.copyPastes}</td>
                      <td style={td}><StatusBadge status={r.status} /></td>
                      <td style={{ ...td, textAlign: "right", color: "var(--ink-3)" }}><ChevronRight size={15} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
