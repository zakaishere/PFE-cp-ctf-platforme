"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Icon, type IconName } from "./icons";
import { useAuth } from "@/features/auth/contexts/AuthContext";
import { getAdminHealthMetrics, getPendingTeachers } from "@/lib/api";

interface NavItem { label: string; href: string; icon: IconName }
interface NavGroup { label: string; items: NavItem[] }

const NAV: NavGroup[] = [
  { label: "Platform", items: [
    { label: "Overview", href: "/admin", icon: "grid" },
    { label: "Users & Roles", href: "/admin/users", icon: "users" },
    { label: "Problems", href: "/admin/problems", icon: "code" },
    { label: "Competitions", href: "/admin/competitions", icon: "trophy" },
  ]},
  { label: "Operations", items: [
    { label: "CTF Operations", href: "/admin/ctf", icon: "shield" },
    { label: "Submissions", href: "/admin/submissions", icon: "file" },
  ]},
  { label: "Infrastructure", items: [
    { label: "Infrastructure", href: "/admin/infrastructure", icon: "server" },
  ]},
  { label: "Governance", items: [
    { label: "Audit Logs", href: "/admin/audit", icon: "audit" },
    { label: "Settings", href: "/admin/settings", icon: "settings" },
  ]},
];

const CREATE_ITEMS: { label: string; icon: IconName; href?: string }[] = [
  { label: "Problem", icon: "code", href: "/teacher/problems" },
  { label: "Competition", icon: "trophy", href: "/teacher/competitions" },
  { label: "CTF challenge", icon: "shield", href: "/teacher/ctf" },
  { label: "Administrator", icon: "users" }, // no backend flow yet — disabled
];

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(href + "/");
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { firstName, email, role, logout } = useAuth();

  const [menuOpen, setMenuOpen] = useState(false);       // mobile sidebar
  const [newOpen, setNewOpen] = useState(false);         // + New menu
  const [profileOpen, setProfileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [health, setHealth] = useState<"OK" | "WARN" | "CRITICAL" | "UNKNOWN">("UNKNOWN");
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  // Close transient menus on route change.
  useEffect(() => { setMenuOpen(false); setNewOpen(false); setProfileOpen(false); }, [pathname]);

  // Global shortcuts: Cmd/Ctrl+K opens palette, Esc closes overlays.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((v) => !v);
      }
      if (e.key === "Escape") { setCommandOpen(false); setNewOpen(false); setProfileOpen(false); setMenuOpen(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Real system status + pending-approvals badge (best-effort, honest on failure).
  const loadStatus = useCallback(() => {
    getAdminHealthMetrics().then((m) => setHealth(m.overall)).catch(() => setHealth("UNKNOWN"));
    getPendingTeachers().then((p) => setPendingCount(p.length)).catch(() => setPendingCount(null));
  }, []);
  useEffect(() => {
    loadStatus();
    const t = setInterval(loadStatus, 30_000);
    return () => clearInterval(t);
  }, [loadStatus]);

  const go = useCallback((href: string) => { setCommandOpen(false); router.push(href); }, [router]);

  const statusMeta = useMemo(() => {
    switch (health) {
      case "OK": return { cls: "", text: "All Systems Operational" };
      case "WARN": return { cls: "warn", text: "Degraded Performance" };
      case "CRITICAL": return { cls: "crit", text: "Critical Alerts" };
      default: return { cls: "warn", text: "Status Unknown" };
    }
  }, [health]);

  return (
    <div className="admin-scope">
      <div className="app-shell">
        <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
          <Link href="/admin" className="brand" aria-label="Algora admin — overview">
            <img src="/algora-logo-icon.png" alt="" width={28} height={28} className="brand-mark-img" />
            <span>ALGORA</span>
          </Link>
          <nav aria-label="Admin navigation">
            {NAV.map((group) => (
              <div className="nav-group" key={group.label}>
                <p>{group.label}</p>
                {group.items.map((item) => (
                  <Link key={item.href} href={item.href}
                        className={`nav-item ${isActive(pathname, item.href) ? "active" : ""}`}
                        aria-current={isActive(pathname, item.href) ? "page" : undefined}>
                    <Icon name={item.icon} />
                    <span>{item.label}</span>
                    {item.href === "/admin/users" && pendingCount ? <span className="nav-badge">{pendingCount}</span> : null}
                  </Link>
                ))}
              </div>
            ))}
          </nav>
          <div className="admin-profile" style={{ position: "relative" }}>
            <button className="admin-profile-btn" onClick={() => setProfileOpen((v) => !v)} aria-haspopup="menu" aria-expanded={profileOpen}>
              <span className="avatar">{(firstName?.[0] ?? email?.[0] ?? "A").toUpperCase()}</span>
              <span>
                <strong>{firstName ?? "Administrator"}</strong>
                <small>{email ?? role ?? "admin"}</small>
              </span>
              <Icon name="chevron" size={15} />
            </button>
            {profileOpen && (
              <div className="create-menu" role="menu" style={{ right: 12, left: 12, bottom: 70, top: "auto", width: "auto" }}>
                <button role="menuitem" onClick={() => { setProfileOpen(false); router.push("/profile"); }}>
                  <Icon name="users" /><span><strong>My profile</strong></span>
                </button>
                <button role="menuitem" onClick={() => { logout(); router.push("/auth"); }}>
                  <Icon name="logout" /><span><strong>Sign out</strong></span>
                </button>
              </div>
            )}
          </div>
        </aside>

        <section className="workspace">
          <header className="topbar">
            <button className="mobile-menu" onClick={() => setMenuOpen((v) => !v)} aria-label="Toggle navigation">
              <Icon name={menuOpen ? "close" : "menu"} />
            </button>
            <button className="search-trigger" onClick={() => setCommandOpen(true)} aria-label="Open command palette">
              <Icon name="search" />
              <span>Search users, problems, competitions…</span>
              <kbd>⌘ K</kbd>
            </button>
            <div className={`system-state ${statusMeta.cls}`}>
              <span className="status-dot" />
              <strong>System Status</strong>
              <span>{statusMeta.text}</span>
            </div>
            <Link className="icon-button notification" href="/admin" aria-label={`Notifications${pendingCount ? `: ${pendingCount} pending` : ""}`}>
              <Icon name="bell" />
              {pendingCount ? <em>{pendingCount}</em> : null}
            </Link>
            <div className="create-wrap">
              <button className="primary-button" onClick={() => setNewOpen((v) => !v)} aria-haspopup="menu" aria-expanded={newOpen}>
                <Icon name="plus" />New <span className="caret">⌄</span>
              </button>
              {newOpen && (
                <div className="create-menu" role="menu">
                  {CREATE_ITEMS.map((item) => item.href ? (
                    <Link key={item.label} role="menuitem" href={item.href} onClick={() => setNewOpen(false)}>
                      <Icon name={item.icon} /><span><strong>New {item.label}</strong><small>Open creation workflow</small></span>
                    </Link>
                  ) : (
                    <button key={item.label} role="menuitem" disabled title="No creation workflow yet">
                      <Icon name={item.icon} /><span><strong>New {item.label}</strong><small>Not yet implemented</small></span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </header>

          <main>{children}</main>
        </section>

        {menuOpen && <button className="mobile-overlay" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}

        {commandOpen && (
          <div className="modal-backdrop" role="presentation" onMouseDown={() => setCommandOpen(false)}>
            <Command className="command-palette" role="dialog" aria-modal="true" aria-label="Command menu"
                     onMouseDown={(e) => e.stopPropagation()} loop>
              <div className="command-input">
                <Icon name="search" />
                <Command.Input autoFocus placeholder="Search or jump to…" />
                <kbd>ESC</kbd>
              </div>
              <Command.List className="command-list">
                <Command.Empty className="command-empty">No results found.</Command.Empty>
                <Command.Group heading="Navigate">
                  {NAV.flatMap((g) => g.items).map((item) => (
                    <Command.Item key={item.href} className="command-item" value={`${item.label} ${item.href}`} onSelect={() => go(item.href)}>
                      <span className="cmd-ico"><Icon name={item.icon} size={14} /></span>
                      <strong>{item.label}</strong>
                    </Command.Item>
                  ))}
                </Command.Group>
                <Command.Group heading="Quick actions">
                  <Command.Item className="command-item" value="Review teacher approvals" onSelect={() => go("/admin/users?role=TEACHER")}>
                    <span className="cmd-ico"><Icon name="users" size={14} /></span><strong>Review teacher approvals</strong>
                  </Command.Item>
                  <Command.Item className="command-item" value="Open CTF operations infrastructure" onSelect={() => go("/admin/ctf")}>
                    <span className="cmd-ico"><Icon name="shield" size={14} /></span><strong>Open CTF operations</strong>
                  </Command.Item>
                  <Command.Item className="command-item" value="Search audit events log" onSelect={() => go("/admin/audit")}>
                    <span className="cmd-ico"><Icon name="audit" size={14} /></span><strong>Search audit events</strong>
                  </Command.Item>
                </Command.Group>
              </Command.List>
            </Command>
          </div>
        )}
      </div>
    </div>
  );
}
