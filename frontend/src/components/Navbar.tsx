"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Home, ClipboardList, Trophy, Code2, BarChart2,
  Bell, LogOut, User, Flag, Search,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/features/auth/contexts/AuthContext";
import { getCtfCompetitions } from "@/lib/api";
import { APP_NAME, APP_MARK } from "@/lib/brand";

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
  { href: "/dashboard",    label: "Dashboard",    icon: <Home size={17} />,         exact: true },
  { href: "/assessments",  label: "Exams & TPs",  icon: <ClipboardList size={17} /> },
  { href: "/competitions", label: "Competitions", icon: <Trophy size={17} /> },
  { href: "/ctf",          label: "CTF",          icon: <Flag size={17} /> },
  { href: "/problems",     label: "Problems",     icon: <Code2 size={17} /> },
  { href: "/leaderboard",  label: "Leaderboard",  icon: <BarChart2 size={17} /> },
];

const teacherLinks = [
  { href: "/teacher",                  label: "Dashboard",     icon: <Home size={17} />,         exact: true },
  { href: "/teacher/exams",            label: "Exams & TPs",   icon: <ClipboardList size={17} /> },
  { href: "/teacher/competitions",     label: "Competitions",  icon: <Trophy size={17} /> },
  { href: "/teacher/problems",         label: "Problems",      icon: <Code2 size={17} /> },
  { href: "/teacher/ctf",              label: "CTF",           icon: <Flag size={17} /> },
  { href: "/leaderboard",              label: "Leaderboard",   icon: <BarChart2 size={17} /> },
];

const adminLinks = [
  { href: "/admin",                    label: "Dashboard",     icon: <Home size={17} />,         exact: true },
  { href: "/teacher/competitions",     label: "Competitions",  icon: <Trophy size={17} /> },
  { href: "/teacher/problems",         label: "Problems",      icon: <Code2 size={17} /> },
  { href: "/leaderboard",              label: "Leaderboard",   icon: <BarChart2 size={17} /> },
];

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

  const roleLabel =
    role === "ADMIN" ? "Admin" : role === "TEACHER" ? "Teacher" : "Student";

  const avatarBg =
    role === "ADMIN"   ? "linear-gradient(135deg, #9b8cff, #6d5ce8)" :
    role === "TEACHER" ? "linear-gradient(135deg, #4cd49b, #2dbd80)" :
    "linear-gradient(135deg, #f0a93c, #e8607e)";

  return (
    <nav className="anav">
      <Link href="/" className="anav-logo">
        <span className="anav-mark">{APP_MARK}</span>
        {APP_NAME}
      </Link>

      {isAuthenticated ? (
        <>
          <div className="anav-links">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`anav-link${isActive(l.href, l.exact) ? " active" : ""}`}
              >
                {l.icon}
                <span>{l.label}</span>
                {l.href === "/ctf" && hasActiveCtf && (
                  <span
                    title="Live competition"
                    style={{
                      width: 7, height: 7, borderRadius: "50%",
                      background: "var(--success)",
                      boxShadow: "0 0 0 2px var(--success-soft)",
                      animation: "ctf-nav-pulse 1.5s ease-in-out infinite",
                    }}
                  />
                )}
              </Link>
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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="anav-me" title={firstName || email || "Account"}>
                <span className="anav-av" style={{ background: avatarBg }}>{initials}</span>
                <span className="anav-meta">
                  <span className="anav-nm">{firstName || "User"}</span>
                  <span className="anav-rl">{roleLabel}</span>
                </span>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <div className="px-3 py-2">
                <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{firstName || "User"}</p>
                <p className="text-xs truncate" style={{ color: "var(--ink-3)" }}>{email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer text-sm">
                <User className="mr-2 h-3.5 w-3.5" /> Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer text-sm"
                style={{ color: "var(--danger-ink)" }}
                onClick={() => { logout(); router.push("/"); }}
              >
                <LogOut className="mr-2 h-3.5 w-3.5" /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
      `}</style>
    </nav>
  );
}
