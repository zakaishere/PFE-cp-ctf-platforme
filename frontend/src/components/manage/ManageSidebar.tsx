"use client";

import Link from "next/link";
import { ChevronLeft, Loader2 } from "lucide-react";
import DomainStatusBadge from "./DomainStatusBadge";

export interface SidebarNavItem {
  key:     string;
  label:   string;
  icon:    React.ReactNode;
  badge?:  number;
}

export interface SidebarNavGroup {
  label: string;
  items: SidebarNavItem[];
}

interface ManageSidebarProps {
  /** Competition / exam / TP title. */
  title:       string;
  status:      string;
  navGroups:   SidebarNavGroup[];
  activeTab:   string;
  onTabChange: (tab: string) => void;
  backHref:    string;
  backLabel:   string;
  /** Primary action slot (Start / End buttons etc.) */
  actions?:    React.ReactNode;
  /** Footer slot (schedule info etc.) */
  footer?:     React.ReactNode;
  loading?:    boolean;
}

export default function ManageSidebar({
  title, status, navGroups, activeTab, onTabChange,
  backHref, backLabel, actions, footer, loading,
}: ManageSidebarProps) {
  return (
    <aside style={{
      width: 260, flexShrink: 0,
      borderRight: "1px solid var(--border)",
      background: "var(--surface)",
      display: "flex", flexDirection: "column",
      overflowY: "auto",
      position: "sticky",
      top: 52,
      height: "calc(100vh - 52px)",
    }}>
      {/* Header */}
      <div style={{ padding: "16px 16px 12px" }}>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Loader2 size={14} style={{ animation: "spin 1s linear infinite", color: "var(--text-muted)" }} />
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Loading…</span>
          </div>
        ) : (
          <>
            <div style={{
              fontSize: 14, fontWeight: 800, color: "var(--text-primary)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              marginBottom: 6,
            }}>
              {title}
            </div>
            <DomainStatusBadge status={status} />
          </>
        )}
      </div>

      {/* Actions slot */}
      {actions && (
        <>
          <div style={{ padding: "0 12px 12px" }}>
            {actions}
          </div>
          <div style={{ height: 1, background: "var(--border)", margin: "0 0 8px" }} />
        </>
      )}

      {/* Navigation */}
      <nav style={{ flex: 1, padding: "0 8px" }}>
        {navGroups.map(group => (
          <div key={group.label} style={{ marginBottom: 16 }}>
            <div style={{
              padding: "4px 8px 6px",
              fontSize: 10, fontWeight: 700, color: "var(--text-muted)",
              textTransform: "uppercase", letterSpacing: "0.08em",
            }}>
              {group.label}
            </div>
            {group.items.map(item => {
              const active = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onTabChange(item.key)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 9,
                    padding: "8px 10px", borderRadius: 6, marginBottom: 2,
                    background: active ? "rgba(99,102,241,0.12)" : "transparent",
                    color: active ? "#818cf8" : "var(--text-secondary)",
                    border: "none", cursor: "pointer", textAlign: "left",
                    fontSize: 13, fontWeight: active ? 700 : 500,
                    borderLeft: `3px solid ${active ? "#6366f1" : "transparent"}`,
                    transition: "all 100ms",
                  }}
                >
                  <span style={{ flexShrink: 0 }}>{item.icon}</span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span style={{
                      background: "rgba(239,68,68,0.15)", color: "#f87171",
                      fontSize: 10, fontWeight: 700, borderRadius: 10, padding: "1px 6px",
                    }}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer slot */}
      {footer && (
        <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", fontSize: 11, color: "var(--text-muted)" }}>
          {footer}
        </div>
      )}

      {/* Back link */}
      <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)" }}>
        <Link href={backHref} style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          fontSize: 12, color: "var(--text-muted)", textDecoration: "none",
        }}>
          <ChevronLeft size={13} />
          {backLabel}
        </Link>
      </div>
    </aside>
  );
}
