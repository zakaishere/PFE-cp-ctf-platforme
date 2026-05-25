"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft, LayoutGrid, Puzzle, Trophy, Users, Bell,
  Volume2, VolumeX, Pause, Snowflake, Loader2,
} from "lucide-react";
import { useCTFCompetition } from "@/features/ctf/context/CTFCompetitionContext";
import { DIFF_COLORS } from "@/features/ctf/shared/categoryConfig";
import CTFNotificationToast from "@/features/ctf/components/CTFNotificationToast";
import CTFNotificationBell  from "@/features/ctf/components/CTFNotificationBell";
import ChallengeModal       from "@/features/ctf/shared/ChallengeModal";
import "./ctf-shell.css";

const pad2 = (n: number) => String(n).padStart(2, "0");

interface NavItem {
  href:    string;
  label:   string;
  icon:    React.ReactNode;
  badge?:  number;
}

export default function CTFShell({ competitionId, children }: {
  competitionId: string;
  children: React.ReactNode;
}) {
  const ctx = useCTFCompetition();
  const pathname = usePathname();

  const items: NavItem[] = useMemo(() => [
    { href: `/ctf/competitions/${competitionId}`,                label: "Overview",      icon: <LayoutGrid size={16} /> },
    { href: `/ctf/competitions/${competitionId}/challenges`,     label: "Challenges",    icon: <Puzzle size={16} /> },
    { href: `/ctf/competitions/${competitionId}/scoreboard`,     label: "Scoreboard",    icon: <Trophy size={16} /> },
    { href: `/ctf/competitions/${competitionId}/team`,           label: "My Team",       icon: <Users size={16} /> },
    { href: `/ctf/competitions/${competitionId}/notifications`,  label: "Notifications", icon: <Bell size={16} />, badge: ctx.unreadCount },
  ], [competitionId, ctx.unreadCount]);

  const showModal = ctx.selectedChallengeId !== null && ctx.competition !== null;

  if (ctx.loading || !ctx.competition) {
    return (
      <div className="ctf-shell" style={{ alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={28} style={{ animation: "spin 1s linear infinite", color: "#6366f1" }} />
      </div>
    );
  }

  return (
    <div className="ctf-shell">
      <TopBar />
      <NavTabs items={items} pathname={pathname} />

      <main className="ctf-shell-main">
        <div className="ctf-shell-content">
          {children}
        </div>
      </main>

      <CTFNotificationToast
        toasts={ctx.pendingToasts}
        onDismiss={ctx.dismissToast}
        onAction={(n) => {
          const cid = typeof n.metadata?.challengeId === "string" ? n.metadata.challengeId : null;
          if (cid) {
            ctx.dismissToast(n.id);
            ctx.openChallenge(cid);
          }
        }}
      />

      {showModal && (
        <ChallengeModal
          competitionId={competitionId}
          challengeId={ctx.selectedChallengeId!}
          teamId={ctx.myTeam?.id ?? undefined}
          canSolve={ctx.canSolve && ctx.myTeam !== null}
          isPaused={ctx.isPaused || ctx.status === "PAUSED"}
          isEnded={ctx.status === "ENDED"}
          onClose={ctx.closeChallenge}
        />
      )}
    </div>
  );
}

// ── Nav tabs (BAR 2) ───────────────────────────────────────────────────────────

function NavTabs({ items, pathname }: { items: NavItem[]; pathname: string }) {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const allHrefs     = items.map(i => i.href);

  const challengesHref = items.find(i => i.label === "Challenges")?.href ?? "";
  const onChallenges   = isActiveLink(pathname, challengesHref, allHrefs);

  const diff   = searchParams.get("diff")   ?? "ALL";
  const status = searchParams.get("status") ?? "ALL";

  function setParam(key: string, value: string) {
    const p = new URLSearchParams(searchParams.toString());
    value === "ALL" ? p.delete(key) : p.set(key, value);
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <nav className="ctf-shell-navtabs" aria-label="CTF sections">
      {/* Left: page links */}
      <div className="ctf-navtabs-links">
        {items.map(item => {
          const active = isActiveLink(pathname, item.href, allHrefs);
          return (
            <Link key={item.href} href={item.href}
              className={`ctf-nav-tab${active ? " active" : ""}`}>
              {item.icon}
              <span className="ctf-nav-tab-label">{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="ctf-nav-badge">{item.badge > 99 ? "99+" : item.badge}</span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Right: difficulty + status filters (challenges page only) */}
      {onChallenges && (
        <div className="ctf-navtabs-filters">
          <span className="ctf-navtabs-sep" />

          <span className="ctf-navtabs-filter-label">Difficulty</span>
          {(["ALL", "EASY", "MEDIUM", "HARD"] as const).map(d => (
            <button key={d} type="button"
              className={`ctf-navtabs-pill${diff === d ? " active" : ""}`}
              onClick={() => setParam("diff", d)}>
              {d !== "ALL" && (
                <span style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: DIFF_COLORS[d], flexShrink: 0,
                }} />
              )}
              {d === "ALL" ? "All" : d.charAt(0) + d.slice(1).toLowerCase()}
            </button>
          ))}

          <span className="ctf-navtabs-sep" />

          <span className="ctf-navtabs-filter-label">Status</span>
          {(["ALL", "UNSOLVED", "SOLVED"] as const).map(s => (
            <button key={s} type="button"
              className={`ctf-navtabs-pill${status === s ? " active" : ""}`}
              onClick={() => setParam("status", s)}>
              {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      )}
    </nav>
  );
}

// ── Top bar ────────────────────────────────────────────────────────────────────

function TopBar() {
  const ctx = useCTFCompetition();
  const comp = ctx.competition!;
  return (
    <div className="ctf-shell-topbar">
      {/* Left */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <Link href="/ctf"
          style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: 12, color: "#64748b", textDecoration: "none",
            padding: "4px 6px", borderRadius: 4,
          }}>
          <ChevronLeft size={14} />
          <span className="ctf-shell-topbar-title-secondary">Back to PSP</span>
        </Link>
        <span style={{ color: "#334155", fontSize: 14 }}>/</span>
        <span style={{
          fontSize: 14, fontWeight: 700, color: "#f8fafc",
          maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {comp.title.length > 30 ? comp.title.slice(0, 30) + "…" : comp.title}
        </span>
      </div>

      {/* Center status badge */}
      <CenterStatus />

      {/* Right — team + bell + mute */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {ctx.myTeam ? (
          <TeamPill />
        ) : (
          <span className="ctf-shell-topbar-title-secondary"
            style={{ fontSize: 11, color: "#64748b" }}>
            No team
          </span>
        )}
        <CTFNotificationBell
          notifications={ctx.notifications}
          unreadCount={ctx.unreadCount}
          onMarkAllRead={ctx.markAllRead}
        />
        <button
          type="button"
          onClick={ctx.toggleMute}
          aria-label={ctx.isMuted ? "Unmute notification sounds" : "Mute notification sounds"}
          title={ctx.isMuted ? "Unmute notification sounds" : "Mute notification sounds"}
          style={{
            background: "transparent", border: "1px solid #334155",
            borderRadius: 6, padding: "6px 8px", cursor: "pointer",
            color: ctx.isMuted ? "#f87171" : "#94a3b8",
            display: "inline-flex", alignItems: "center",
          }}
        >
          {ctx.isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>
      </div>
    </div>
  );
}

function CenterStatus() {
  const ctx = useCTFCompetition();
  const comp = ctx.competition!;

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (ctx.status === "PAUSED") {
    return <Badge color="#fbbf24" icon={<Pause size={11} />}>Paused</Badge>;
  }
  if (ctx.status === "FROZEN") {
    return <Badge color="#22d3ee" icon={<Snowflake size={11} />}>Scoreboard Frozen</Badge>;
  }
  if (ctx.status === "ENDED") {
    return <Badge color="#94a3b8">Ended</Badge>;
  }
  if (ctx.status === "UPCOMING") {
    if (comp.timingMode === "REGISTRATION") {
      return <Badge color="#a78bfa">Registration open</Badge>;
    }
    if (!comp.startTime) {
      return <Badge color="#60a5fa">Waiting to start</Badge>;
    }
    const ms = Math.max(0, new Date(comp.startTime).getTime() - now);
    return <Badge color="#60a5fa">Starts in {fmtCountdown(ms)}</Badge>;
  }
  if (ctx.status === "ACTIVE") {
    const endIso = (comp as { computedEndTime?: string | null }).computedEndTime ?? comp.endTime;
    if (!endIso) {
      return (
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontFamily: "ui-monospace, monospace", fontWeight: 700,
          fontSize: 14, color: "#34d399",
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%", background: "#22c55e",
            animation: "ctf-pulse-dot 1.8s infinite", display: "inline-block",
          }} />
          Live
        </span>
      );
    }
    const ms = Math.max(0, new Date(endIso).getTime() - now);
    const lessThanHour = ms < 3600_000;
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        fontFamily: "ui-monospace, monospace", fontWeight: 700,
        fontSize: 14,
        color: lessThanHour ? "#f87171" : "#34d399",
        animation: lessThanHour ? "ctf-timer-blink 1.2s steps(1) infinite" : undefined,
      }}>
        <span style={{
          width: 7, height: 7, borderRadius: "50%",
          background: lessThanHour ? "#f87171" : "#22c55e",
          animation: "ctf-pulse-dot 1.8s infinite",
          display: "inline-block",
        }} />
        {fmtCountdown(ms)} remaining
      </span>
    );
  }
  return null;
}

function Badge({ color, icon, children }: {
  color: string; icon?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 12, fontWeight: 700,
      color, background: `${color}1a`, border: `1px solid ${color}55`,
      padding: "5px 10px", borderRadius: 6,
    }}>
      {icon}
      <span style={{ fontFamily: "ui-monospace, monospace" }}>{children}</span>
    </span>
  );
}

function TeamPill() {
  const ctx = useCTFCompetition();
  const team = ctx.myTeam!;
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      padding: "4px 10px", border: "1px solid #1e293b", borderRadius: 6,
      maxWidth: 240,
    }}>
      <span style={{
        width: 10, height: 10, borderRadius: "50%", background: team.avatarColor,
        flexShrink: 0,
      }} />
      <span style={{
        fontSize: 12, fontWeight: 600, color: "#f8fafc",
        maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {team.name}
      </span>
      <span style={{ color: "#334155", fontSize: 12 }}>|</span>
      <span style={{ fontSize: 11, color: "#94a3b8" }}>
        Score: <strong style={{ color: "#f8fafc", fontFamily: "ui-monospace, monospace" }}>
          {team.totalPoints ?? 0}
        </strong>
      </span>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (d > 0) return `${d}d ${pad2(h)}:${pad2(m)}:${pad2(s)}`;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

function isActiveLink(pathname: string, href: string, allHrefs: string[]): boolean {
  const overview = allHrefs[0];
  if (href === overview) {
    return pathname === overview;
  }
  return pathname === href || pathname.startsWith(href + "/");
}
