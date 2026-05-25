"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Home, ClipboardList, Trophy, Code2, BarChart2,
  Bell, HelpCircle, Settings, LogOut, User, Flag,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/features/auth/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { getCtfCompetitions } from "@/lib/api";

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

const studentLinks = [
  { href: "/dashboard",    label: "Dashboard",    icon: <Home size={14} />,         exact: true },
  { href: "/assessments",  label: "Exams & TPs",  icon: <ClipboardList size={14} /> },
  { href: "/competitions", label: "Competitions", icon: <Trophy size={14} /> },
  { href: "/ctf",          label: "CTF",          icon: <Flag size={14} /> },
  { href: "/problems",     label: "Problems",     icon: <Code2 size={14} /> },
  { href: "/leaderboard",  label: "Leaderboard",  icon: <BarChart2 size={14} /> },
];

const teacherLinks = [
  { href: "/teacher",                  label: "Dashboard",     icon: <Home size={14} />,         exact: true },
  { href: "/teacher/exams",            label: "Exams & TPs",   icon: <ClipboardList size={14} /> },
  { href: "/teacher/competitions",     label: "Competitions",  icon: <Trophy size={14} /> },
  { href: "/teacher/problems",         label: "Problems",      icon: <Code2 size={14} /> },
  { href: "/teacher/ctf",              label: "CTF",           icon: <Flag size={14} /> },
  { href: "/leaderboard",              label: "Leaderboard",   icon: <BarChart2 size={14} /> },
];

const adminLinks = [
  { href: "/admin",                    label: "Dashboard",     icon: <Home size={14} />,         exact: true },
  { href: "/teacher/competitions",     label: "Competitions",  icon: <Trophy size={14} /> },
  { href: "/teacher/problems",         label: "Problems",      icon: <Code2 size={14} /> },
  { href: "/leaderboard",              label: "Leaderboard",   icon: <BarChart2 size={14} /> },
];

function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="psp-nav-btn"
      style={{
        background: isDark ? "rgba(76,154,255,0.1)" : "rgba(255,255,255,0.12)",
        border: isDark ? "1px solid rgba(76,154,255,0.2)" : "1px solid rgba(255,255,255,0.2)",
        color: isDark ? "#4c9aff" : "white",
      }}
    >
      {isDark ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="4"/>
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      )}
    </button>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, role, firstName, email, logout } = useAuth();

  const links =
    role === "STUDENT" ? studentLinks :
    role === "TEACHER" ? teacherLinks :
    role === "ADMIN"   ? adminLinks   :
    [];

  const hasActiveCtf = useHasActiveCtf(isAuthenticated && (role === "STUDENT" || role === "TEACHER"));

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  const initials = firstName
    ? firstName.charAt(0).toUpperCase()
    : email
    ? email.charAt(0).toUpperCase()
    : "U";

  const avatarColor =
    role === "ADMIN"   ? "#6554c0" :
    role === "TEACHER" ? "#00875a" :
    "#ff5630";

  return (
    <nav className="psp-navbar">
      <Link href="/" className="psp-nav-logo">
        <div className="psp-nav-logo-box">P</div>
        PSP Platform
      </Link>

      {isAuthenticated ? (
        <>
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`psp-nav-link${isActive(l.href, l.exact) ? " active" : ""}`}
              style={{ position: "relative" }}
            >
              {l.icon}
              {l.label}
              {l.href === "/ctf" && hasActiveCtf && (
                <span
                  title="Live competition"
                  style={{
                    position: "absolute",
                    top: 6, right: 4,
                    width: 7, height: 7, borderRadius: "50%",
                    background: "#22c55e",
                    boxShadow: "0 0 0 2px rgba(34,197,94,0.3)",
                    animation: "ctf-nav-pulse 1.5s ease-in-out infinite",
                  }}
                />
              )}
            </Link>
          ))}

          <div className="psp-nav-right">
            <ThemeToggle />
            <button className="psp-nav-btn" title="Notifications">
              <Bell size={14} />
            </button>
            <button className="psp-nav-btn" title="Settings">
              <Settings size={14} />
            </button>
            <button className="psp-nav-btn" title="Help">
              <HelpCircle size={14} />
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div
                  className="psp-avatar"
                  style={{ background: avatarColor, cursor: "pointer" }}
                  title={firstName || email || "Account"}
                >
                  {initials}
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-3 py-2">
                  <p className="text-sm font-semibold text-[#172b4d]">{firstName || "User"}</p>
                  <p className="text-xs text-[#5e6c84] truncate">{email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer text-sm">
                  <User className="mr-2 h-3.5 w-3.5" /> Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer text-sm text-red-600 focus:text-red-600"
                  onClick={() => { logout(); router.push("/"); }}
                >
                  <LogOut className="mr-2 h-3.5 w-3.5" /> Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </>
      ) : (
        <>
          <Link href="/#features" className="psp-nav-link">Features</Link>
          <Link href="/#how" className="psp-nav-link">How it works</Link>
          <Link href="/leaderboard" className="psp-nav-link">Leaderboard</Link>
          <div className="psp-nav-right">
            <Link href="/auth"
              className="psp-nav-link"
              style={{ border: "1.5px solid rgba(255,255,255,0.45)", borderRadius: 3, height: 32, padding: "0 14px" }}
            >
              Sign In
            </Link>
            <Link href="/auth"
              className="psp-nav-link"
              style={{ background: "var(--bg-primary)", color: "#0052cc", borderRadius: 3, height: 32, padding: "0 14px", fontWeight: 700, marginLeft: 4 }}
            >
              Get Started
            </Link>
          </div>
        </>
      )}
      <style jsx global>{`
        @keyframes ctf-nav-pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 2px rgba(34,197,94,0.3); }
          50%      { opacity: 0.55; box-shadow: 0 0 0 4px rgba(34,197,94,0.12); }
        }
      `}</style>
    </nav>
  );
}
