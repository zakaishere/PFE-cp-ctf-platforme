"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Home, ClipboardList, Trophy, Code2, BarChart2,
  Bell, LogOut, User, Flag, Search, Shield,
} from "lucide-react";
import {
  Dropdown, DropdownTrigger, DropdownContent,
  DropdownHeader, DropdownItem, DropdownSeparator,
} from "@/components/ui/PSPDropdown";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { useAuth } from "@/features/auth/contexts/AuthContext";
import { getCtfCompetitions } from "@/lib/api";
import { APP_NAME } from "@/lib/brand";

// 60-second cached check for an active CTF competition
const CTF_CACHE_KEY = "psp_ctf_has_active_v1";
const CTF_CACHE_TTL = 60_000;

function useHasActiveCtf(enabled: boolean) {
  const [hasActive, setHasActive] = useState(false);
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    let cancelled = false;
    try {
      const raw = sessionStorage.getItem(CTF_CACHE_KEY);
      if (raw) {
        const { v, t } = JSON.parse(raw);
        if (Date.now() - t < CTF_CACHE_TTL) { setHasActive(v); return; }
      }
    } catch { /* ignore */ }
    getCtfCompetitions()
      .then((list) => {
        if (cancelled) return;
        const v = list.some((c) => c.started && !c.ended);
        setHasActive(v);
        try { sessionStorage.setItem(CTF_CACHE_KEY, JSON.stringify({ v, t: Date.now() })); } catch {}
      })
      .catch(() => { /* silent */ });
    return () => { cancelled = true; };
  }, [enabled]);
  return hasActive;
}

interface NavChild { href: string; label: string }
interface NavLink {
  href: string;
  label: string;
  icon: React.ReactNode;
  exact?: boolean;
  children?: NavChild[];
}

const studentLinks: NavLink[] = [
  { href: "/dashboard",    label: "Dashboard",    icon: <Home size={17} />,         exact: true },
  { href: "/assessments",  label: "Exams & TPs",  icon: <ClipboardList size={17} /> },
  {
    href: "/ctf", label: "CTF", icon: <Flag size={17} />,
    children: [
      { href: "/ctf/competitions", label: "Competitions" },
      { href: "/ctf/practice",     label: "Practice" },
    ],
  },
  {
    href: "/problems", label: "Problems", icon: <Code2 size={17} />,
    children: [
      { href: "/problems/practice", label: "Problem Bank" },
      { href: "/competitions",      label: "Competitions" },
    ],
  },
  { href: "/leaderboard",  label: "Leaderboard",  icon: <BarChart2 size={17} /> },
];

const teacherLinks: NavLink[] = [
  { href: "/teacher",                  label: "Dashboard",     icon: <Home size={17} />,         exact: true },
  { href: "/teacher/exams",            label: "Exams & TPs",   icon: <ClipboardList size={17} /> },
  { href: "/teacher/competitions",     label: "Competitions",  icon: <Trophy size={17} /> },
  { href: "/teacher/problems",         label: "Problems",      icon: <Code2 size={17} /> },
  {
    href: "/teacher/ctf", label: "CTF", icon: <Flag size={17} />,
    children: [
      { href: "/teacher/ctf",          label: "Competitions" },
      { href: "/teacher/ctf/practice", label: "Practice Challenges" },
    ],
  },
  { href: "/leaderboard",              label: "Leaderboard",   icon: <BarChart2 size={17} /> },
];

const adminLinks: NavLink[] = [
  { href: "/admin",                    label: "Dashboard",     icon: <Home size={17} />,         exact: true },
  { href: "/teacher/competitions",     label: "Competitions",  icon: <Trophy size={17} /> },
  { href: "/teacher/problems",         label: "Problems",      icon: <Code2 size={17} /> },
  { href: "/leaderboard",              label: "Leaderboard",   icon: <BarChart2 size={17} /> },
];

// Nav link with an optional hover dropdown (opens after a 400ms hover)
function NavItem({ link, active, extra }: {
  link: NavLink;
  active: boolean;
  extra?: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  // Close on navigation
  useEffect(() => { setOpen(false); }, [pathname]);

  if (!link.children) {
    return (
      <Link href={link.href} className={`anav-link${active ? " active" : ""}`}>
        {link.icon}
        <span>{link.label}</span>
        {extra}
      </Link>
    );
  }

  const enter = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    openTimer.current = setTimeout(() => setOpen(true), 400);
  };
  const leave = () => {
    if (openTimer.current) clearTimeout(openTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  };

  return (
    <div className="anav-drop" onMouseEnter={enter} onMouseLeave={leave}>
      <Link href={link.href} className={`anav-link${active ? " active" : ""}`}>
        {link.icon}
        <span>{link.label}</span>
        {extra}
      </Link>
      {open && (
        <div className="anav-drop-menu">
          {link.children.map((c) => (
            <Link
              key={c.href + c.label}
              href={c.href}
              className={`anav-drop-item${pathname === c.href || pathname.startsWith(c.href + "/") ? " active" : ""}`}
            >
              {c.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, role, firstName, email, avatarId, logout } = useAuth();

  const links =
    role === "STUDENT" ? studentLinks :
    role === "TEACHER" ? teacherLinks :
    role === "ADMIN"   ? adminLinks   :
    [];

  const hasActiveCtf = useHasActiveCtf(isAuthenticated && (role === "STUDENT" || role === "TEACHER"));

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  const roleLabel =
    role === "ADMIN" ? "Admin" : role === "TEACHER" ? "Teacher" : "Student";

  return (
    <nav className="anav">
      <Link href="/" className="anav-logo">
        <img src="/algora-logo-icon.png" alt="" width={30} height={30} className="anav-mark-img" />
        {APP_NAME}
      </Link>

      {isAuthenticated ? (
        <>
          <div className="anav-links">
            {links.map((l) => (
              <NavItem
                key={l.href}
                link={l}
                active={isActive(l.href, l.exact)}
                extra={l.href === "/ctf" && hasActiveCtf ? (
                  <span
                    title="Live competition"
                    style={{
                      width: 7, height: 7, borderRadius: "50%",
                      background: "var(--success)",
                      boxShadow: "0 0 0 2px var(--success-soft)",
                      animation: "ctf-nav-pulse 1.5s ease-in-out infinite",
                    }}
                  />
                ) : undefined}
              />
            ))}
          </div>

          <div className="anav-spacer" />

          <div className="anav-search">
            <Search />
            <input placeholder="Search…" aria-label="Search" />
          </div>

          <button className="anav-iconbtn" title="Notifications" aria-label="Notifications">
            <Bell />
            <span className="dot" />
          </button>

          <Dropdown>
            <DropdownTrigger asChild>
              <div className="anav-me" title={firstName || email || "Account"}>
                <UserAvatar avatarId={avatarId} name={firstName || email || undefined} size={28} />
                <span className="anav-meta">
                  <span className="anav-nm">{firstName || "User"}</span>
                  <span className="anav-rl">{roleLabel}</span>
                </span>
              </div>
            </DropdownTrigger>
            <DropdownContent align="end" width={220}>
              <DropdownHeader>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <UserAvatar avatarId={avatarId} name={firstName || email || undefined} size={36} />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", margin: 0 }}>{firstName || "User"}</p>
                    <p style={{ fontSize: 11, color: "var(--ink-3)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</p>
                  </div>
                </div>
              </DropdownHeader>
              <DropdownItem icon={<User size={14} />} onClick={() => router.push("/profile")}>
                Profile
              </DropdownItem>
              {role === "ADMIN" && (
                <DropdownItem icon={<Shield size={14} />} onClick={() => router.push("/admin")}>
                  Admin Panel
                </DropdownItem>
              )}
              <DropdownSeparator />
              <DropdownItem icon={<LogOut size={14} />} danger onClick={() => { logout(); router.push("/"); }}>
                Log out
              </DropdownItem>
            </DropdownContent>
          </Dropdown>
        </>
      ) : (
        <>
          <div className="anav-links">
            <Link href="/#features" className="anav-link"><span>Features</span></Link>
            <Link href="/#how" className="anav-link"><span>How it works</span></Link>
            <Link href="/leaderboard" className="anav-link"><span>Leaderboard</span></Link>
          </div>
          <div className="anav-spacer" />
          <Link href="/auth" className="btn btn-secondary btn-sm">Sign In</Link>
          <Link href="/auth" className="btn btn-primary btn-sm">Get Started</Link>
        </>
      )}
      <style jsx global>{`
        @keyframes ctf-nav-pulse {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.5; }
        }
        .anav-drop { position: relative; }
        .anav-drop-menu {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          min-width: 176px;
          background: var(--surface);
          border: 1px solid var(--line-2);
          border-radius: 10px;
          padding: 6px;
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
          z-index: 200;
          display: flex;
          flex-direction: column;
          gap: 2px;
          animation: anav-drop-in 120ms ease;
        }
        @keyframes anav-drop-in {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .anav-drop-item {
          display: block;
          padding: 8px 12px;
          border-radius: 7px;
          font-size: 13px;
          font-weight: 600;
          color: var(--ink-2);
          text-decoration: none;
        }
        .anav-drop-item:hover { background: var(--surface-2); color: var(--ink); }
        .anav-drop-item.active { background: var(--accent-soft); color: var(--brand-2); }
      `}</style>
    </nav>
  );
}
