"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Spinner from "@/components/ui/Spinner";
import MiniCountdown from "@/components/ui/MiniCountdown";
import { JoinActionButton } from "@/components/ui/JoinActionButton";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Timer, Users, FileText, Trophy, Search } from "lucide-react";
import { getCompetitions, registerForCompetition, requestToJoinCompetition } from "@/lib/api";

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

function fmtDuration(mins: number) {
  if (!mins) return "—";
  const h = Math.floor(mins / 60), m = mins % 60;
  return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

function fmtRelative(iso: string | null | undefined) {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60)  return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24)   return `${diffHrs}h ago`;
  return `${Math.floor(diffHrs / 24)}d ago`;
}

type FilterTab = "all" | "registration" | "active" | "ended";

// ── Shared sub-components ─────────────────────────────────────────────────────

function MetaChip({ icon, text, muted = false }: { icon: React.ReactNode; text: string; muted?: boolean }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 12, color: muted ? "var(--text-muted)" : "var(--text-secondary)", fontWeight: muted ? 400 : 500,
    }}>
      {icon}
      {text}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = (status || "").toUpperCase();
  if (s === "ACTIVE")                              return <span className="badge badge-live">Live Now</span>;
  if (s === "REGISTRATION" || s === "REGISTRATION_OPEN") return <span className="badge badge-blue">Registration Open</span>;
  if (s === "ENDED")                               return <span className="badge badge-gray">Ended</span>;
  if (s === "UPCOMING")                            return <span className="badge badge-blue">Upcoming</span>;
  return <span className="badge badge-gray">{status}</span>;
}

function StatCard({ value, label, color = "default" }: {
  value: number; label: string; color?: "default" | "red" | "green" | "blue" | "orange";
}) {
  const colors: Record<string, string> = {
    default: "var(--text-primary)",
    red:     value > 0 ? "var(--red)"    : "var(--text-muted)",
    green:   value > 0 ? "var(--green)"  : "var(--text-muted)",
    blue:    value > 0 ? "var(--blue)"   : "var(--text-muted)",
    orange:  value > 0 ? "var(--orange)" : "var(--text-muted)",
  };
  return (
    <div className="stat-card" style={{ flex: 1, minWidth: 0, cursor: "default" }}>
      <div style={{
        fontSize: 28, fontWeight: 800, color: colors[color],
        letterSpacing: "-1px", lineHeight: 1, marginBottom: 4,
      }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>{label}</div>
    </div>
  );
}

function FilterTabs({ tabs, active, onChange }: {
  tabs: Array<{ key: string; label: string; count: number }>;
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 0, borderBottom: "2px solid var(--border-subtle)", marginBottom: 20 }}>
      {tabs.map(tab => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          style={{
            height: 40, padding: "0 16px", borderRadius: 0, border: "none", cursor: "pointer",
            borderBottom: active === tab.key ? "2px solid var(--blue)" : "2px solid transparent",
            marginBottom: -2,
            color: active === tab.key ? "var(--blue)" : "var(--text-muted)",
            fontWeight: active === tab.key ? 700 : 500,
            fontSize: 13, background: "none",
            transition: "all 0.15s ease",
            display: "inline-flex", alignItems: "center", gap: 6,
          }}
        >
          {tab.label}
          <span style={{
            background: active === tab.key ? "var(--blue-light)" : "var(--bg-secondary)",
            color: active === tab.key ? "var(--blue)" : "var(--text-muted)",
            borderRadius: 10, padding: "1px 7px",
            fontSize: 11, fontWeight: 700,
          }}>
            {tab.count}
          </span>
        </button>
      ))}
    </div>
  );
}

// ── FeaturedLiveCard ──────────────────────────────────────────────────────────

function FeaturedLiveCard({ c, onAction }: { c: any; onAction: (action: string, id: string, extra?: string) => Promise<void> }) {
  const id     = c.competitionId || c.id;
  const isTeam = (c.mode || "").toUpperCase() === "TEAM";

  return (
    <div className="card" style={{
      borderLeft: "4px solid var(--red)",
      background: "linear-gradient(to right, var(--red-light), var(--bg-secondary))",
      marginBottom: 14,
      padding: "18px 20px",
      display: "flex", alignItems: "center", gap: 20,
      borderRadius: "0 8px 8px 0",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span className="badge badge-live">Live Now</span>
          <span className={`badge ${isTeam ? "badge-purple" : "badge-blue"}`}>
            {isTeam ? "Team" : "Solo"}
          </span>
        </div>
        <div style={{
          fontSize: 17, fontWeight: 800, color: "var(--text-primary)", marginBottom: 6,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {c.title}
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {c.problemCount > 0 && <MetaChip icon={<FileText size={11} />} text={`${c.problemCount} problems`} />}
          {(c.registeredCount ?? c.participantCount ?? 0) > 0 && (
            <MetaChip icon={<Users size={11} />} text={`${c.registeredCount ?? c.participantCount} registered`} />
          )}
          {c.endTime && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--red)", fontWeight: 600 }}>
              <Timer size={11} />
              <MiniCountdown targetDate={c.endTime} label="ends in" />
            </span>
          )}
        </div>
      </div>
      <div style={{ flexShrink: 0 }}>
        <JoinActionButton
          id={id}
          type="COMPETITION"
          visibility={c.visibilityMode || "PUBLIC_OPEN"}
          itemStatus="ACTIVE"
          myJoinStatus={c.myJoinStatus || "NONE"}
          onAction={onAction}
        />
      </div>
    </div>
  );
}

// ── CompetitionCard ───────────────────────────────────────────────────────────

function CompetitionCard({ c, onAction }: { c: any; onAction: (action: string, id: string, extra?: string) => Promise<void> }) {
  const id      = c.competitionId || c.id;
  const status  = (c.status || "").toUpperCase();
  const isTeam  = (c.mode || "").toUpperCase() === "TEAM";
  const isEnded = status === "ENDED";
  const isActive = status === "ACTIVE";
  const isReg   = status === "REGISTRATION" || status === "REGISTRATION_OPEN";

  const borderColor =
    isActive ? "#de350b" :
    isReg    ? "#0052cc" :
               "var(--border)";

  const registered = c.registeredCount ?? c.participantCount ?? 0;

  return (
    <div
      className="card card-hover"
      style={{
        borderLeft: `4px solid ${borderColor}`,
        borderRadius: "0 8px 8px 0",
        opacity: isEnded ? 0.8 : 1,
        background: isActive ? "var(--red-light)" : "var(--bg-secondary)",
      }}
    >
      {/* Top: title + badges */}
      <div style={{ padding: "16px 18px 10px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 3,
            letterSpacing: "-0.2px",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {c.title}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {c.creatorName ? `By ${c.creatorName}` : "PSP Platform"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <span className={`badge ${isTeam ? "badge-purple" : "badge-blue"}`}>
            {isTeam ? "Team" : "Solo"}
          </span>
          <StatusBadge status={status} />
        </div>
      </div>

      {/* Middle: meta chips */}
      <div style={{ padding: "0 18px 12px", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        {c.startTime && <MetaChip icon={<Calendar size={11} />} text={fmtDate(c.startTime)} />}
        {c.durationMinutes > 0 && <MetaChip icon={<Timer size={11} />} text={fmtDuration(c.durationMinutes)} />}
        {c.problemCount > 0 && <MetaChip icon={<FileText size={11} />} text={`${c.problemCount} problem${c.problemCount !== 1 ? "s" : ""}`} />}
        {isTeam && c.maxTeamSize && <MetaChip icon={<Users size={11} />} text={`Teams of ${c.minTeamSize ?? 1}–${c.maxTeamSize}`} />}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "var(--border-subtle)", margin: "0 18px" }} />

      {/* Bottom: context + action */}
      <div style={{
        padding: "12px 18px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        flexWrap: "wrap",
      }}>
        {/* Status context */}
        <div>
          {isReg && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {registered > 0 && (
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  <strong style={{ color: "var(--text-primary)" }}>{registered}</strong> registered
                </span>
              )}
              {c.startTime && (
                <MiniCountdown targetDate={c.startTime} label="Starts in" />
              )}
            </div>
          )}
          {isActive && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--red)", fontWeight: 600 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--red)", display: "inline-block", animation: "blink 1s infinite" }} />
              Live{registered > 0 ? ` · ${registered} participating` : ""}
            </div>
          )}
          {isEnded && (
            <span style={{ fontSize: 12, color: "var(--text-subtle)" }}>
              Ended {fmtRelative(c.endTime)}
              {registered > 0 ? ` · ${registered} participated` : ""}
            </span>
          )}
          {!isReg && !isActive && !isEnded && registered > 0 && (
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{registered} registered</span>
          )}
        </div>

        <JoinActionButton
          id={id}
          type="COMPETITION"
          visibility={c.visibilityMode || "PUBLIC_OPEN"}
          itemStatus={status}
          myJoinStatus={c.myJoinStatus || "NONE"}
          onAction={onAction}
        />
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CompetitionsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [competitions, setCompetitions] = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [filter, setFilter]             = useState<FilterTab>("all");
  const [search, setSearch]             = useState("");

  useEffect(() => {
    getCompetitions()
      .then(setCompetitions)
      .catch(e => toast({ title: "Failed to load competitions", description: e.message, variant: "destructive" }))
      .finally(() => setLoading(false));
  }, []);

  const patchComp = (id: string, patch: any) =>
    setCompetitions(prev => prev.map(c => (c.competitionId || c.id) === id ? { ...c, ...patch } : c));

  const handleAction = async (action: string, id: string, extra?: string) => {
    try {
      switch (action) {
        case "register":
        case "enter-code":
          await registerForCompetition(id);
          patchComp(id, { myJoinStatus: "APPROVED" });
          toast({ title: "Registered!", description: "Enter the lobby to prepare." });
          break;
        case "request":
          await requestToJoinCompetition(id);
          patchComp(id, { myJoinStatus: "PENDING" });
          toast({ title: "Request sent", description: "You'll be notified when approved." });
          break;
        case "enter":
        case "lobby":
          router.push(`/competitions/${id}/lobby`);
          break;
        case "view-results":
          router.push(`/competitions/${id}/lobby`);
          break;
      }
    } catch (e: any) {
      if (e.message?.includes("409")) {
        if (action === "register" || action === "enter-code") patchComp(id, { myJoinStatus: "APPROVED" });
        if (action === "request")  patchComp(id, { myJoinStatus: "PENDING" });
      } else {
        toast({ title: "Action failed", description: e.message, variant: "destructive" });
      }
    }
  };

  const live  = competitions.filter(c => (c.status || "").toUpperCase() === "ACTIVE");
  const reg   = competitions.filter(c => {
    const s = (c.status || "").toUpperCase();
    return s === "REGISTRATION" || s === "REGISTRATION_OPEN";
  });
  const ended = competitions.filter(c => (c.status || "").toUpperCase() === "ENDED");
  const myJoined = competitions.filter(c => (c.myJoinStatus || "").toUpperCase() === "APPROVED");

  const filtered = competitions.filter(c => {
    const s = (c.status || "").toUpperCase();
    if (filter === "registration" && s !== "REGISTRATION" && s !== "REGISTRATION_OPEN") return false;
    if (filter === "active" && s !== "ACTIVE")   return false;
    if (filter === "ended" && s !== "ENDED")      return false;
    const q = search.trim().toLowerCase();
    return !q || (c.title || "").toLowerCase().includes(q);
  });

  const liveFiltered  = filtered.filter(c => (c.status || "").toUpperCase() === "ACTIVE");
  const otherFiltered = filtered.filter(c => (c.status || "").toUpperCase() !== "ACTIVE");

  const allEnded = competitions.length > 0 && ended.length === competitions.length;
  const noOpenComps = live.length === 0 && reg.length === 0;

  const tabs = [
    { key: "all",          label: "All",               count: competitions.length },
    { key: "registration", label: "Registration Open", count: reg.length },
    { key: "active",       label: "Live Now",          count: live.length },
    { key: "ended",        label: "Ended",             count: ended.length },
  ];

  return (
    <>
      <Navbar />
      <div className="psp-breadcrumb">
        <Link href="/dashboard">PSP</Link> › <span style={{ color: "var(--text-primary)" }}>Competitions</span>
      </div>
      <div className="psp-main">

        {/* Header */}
        <div className="page-header">
          <div className="page-header-title">
            <Trophy size={20} />
            Competitions
          </div>
          <div className="page-header-sub">Codeforces-style contests — solo and team modes</div>
        </div>

        {/* Stats row */}
        {!loading && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
            <StatCard value={competitions.length} label="Total"      color="default" />
            <StatCard value={live.length}         label="Live Now"   color="red"     />
            <StatCard value={reg.length}          label="Upcoming"   color="blue"    />
            <StatCard value={myJoined.length}     label="Registered" color="green"   />
          </div>
        )}

        {/* Tabs + search */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 0 }}>
          <div style={{ flex: 1 }}>
            <FilterTabs tabs={tabs} active={filter} onChange={k => setFilter(k as FilterTab)} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid var(--border)", borderRadius: 6, padding: "0 10px", height: 34, marginBottom: 20, flexShrink: 0 }}>
            <Search size={12} color="#97a0af" />
            <input
              placeholder="Search competitions…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ border: "none", outline: "none", fontSize: 12, color: "var(--text-primary)", width: 180, background: "transparent" }}
            />
          </div>
        </div>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
            <Spinner size={28} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="psp-empty" style={{ padding: 80 }}>
            <Trophy size={36} color="var(--border)" style={{ margin: "0 auto 12px" }} />
            <div className="psp-empty-title">No competitions</div>
            <div>{search ? "No results for that search." : "Check back later."}</div>
          </div>
        ) : (
          <div>
            {/* Featured live competitions — full width */}
            {liveFiltered.map(c => (
              <FeaturedLiveCard key={c.competitionId || c.id} c={c} onAction={handleAction} />
            ))}

            {/* Encouraging empty state when all ended */}
            {noOpenComps && allEnded && filter === "all" && (
              <div style={{
                background: "var(--bg-tertiary)",
                border: "1px dashed var(--border)",
                borderRadius: 8,
                padding: "24px 20px",
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                gap: 16,
              }}>
                <Trophy size={32} color="#c1c7d0" />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 4 }}>
                    No active competitions right now
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                    Check back soon — new competitions are posted regularly. Browse past results below.
                  </div>
                </div>
              </div>
            )}

            {/* 2-column grid for the rest */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }} className="stagger">
              {otherFiltered.map(c => (
                <CompetitionCard key={c.competitionId || c.id} c={c} onAction={handleAction} />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
