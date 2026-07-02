"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Spinner from "@/components/ui/Spinner";
import { useToast } from "@/hooks/use-toast";
import { Trophy, Search, Calendar, FileText } from "lucide-react";
import { getCompetitions, registerForCompetition, requestToJoinCompetition } from "@/lib/api";
import { EventCard, type EventStatus } from "@/components/ui/EventCard";

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

function fmtDuration(mins: number) {
  if (!mins) return "";
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

// ── FilterTabs ────────────────────────────────────────────────────────────────

function FilterTabs({ tabs, active, onChange }: {
  tabs: Array<{ key: string; label: string; count: number }>;
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--line-2)", marginBottom: 20 }}>
      {tabs.map(tab => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          style={{
            height: 40, padding: "0 16px", borderRadius: 0, border: "none", cursor: "pointer",
            borderBottom: active === tab.key ? "2px solid var(--accent)" : "2px solid transparent",
            marginBottom: -1,
            color: active === tab.key ? "var(--accent)" : "var(--ink-2)",
            fontWeight: active === tab.key ? 700 : 500,
            fontSize: 13, background: "none",
            transition: "all 0.15s ease",
            display: "inline-flex", alignItems: "center", gap: 6,
          }}
        >
          {tab.label}
          <span style={{
            fontFamily: "var(--font-mono)",
            color: active === tab.key ? "var(--accent)" : "var(--ink-3)",
            fontSize: 11, fontWeight: 700,
          }}>
            {tab.count}
          </span>
        </button>
      ))}
    </div>
  );
}

// ── Map a competition to EventCard props + primary action ─────────────────────

function competitionStatus(status: string): EventStatus {
  switch (status) {
    case "ACTIVE": case "LIVE":                        return "live";
    case "REGISTRATION": case "REGISTRATION_OPEN": case "OPEN": return "reg";
    case "ENDED": case "CLOSED":                       return "ended";
    case "UPCOMING":                                   return "scheduled";
    default:                                           return "closed"; // DRAFT etc.
  }
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

  /** Primary card action, mirroring JoinActionButton's decision path. */
  const cardAction = (c: any): { label: string; disabled?: boolean; run: () => void } => {
    const id  = c.competitionId || c.id;
    const st  = (c.status || "").toUpperCase();
    const vis = (c.visibilityMode || "PUBLIC_OPEN").toUpperCase();
    const js  = (c.myJoinStatus || "NONE").toUpperCase();
    const isEnded = st === "CLOSED" || st === "ENDED";
    const isActive = st === "ACTIVE" || st === "LIVE";
    const isReg   = st === "REGISTRATION_OPEN" || st === "REGISTRATION" || st === "OPEN";
    const go = (action: string) => () => handleAction(action, id);

    if (isEnded)          return { label: "View results", run: go("view-results") };
    if (js === "APPROVED") {
      if (isActive)       return { label: "Enter arena", run: go("enter") };
      if (isReg)          return { label: "Enter lobby", run: go("lobby") };
      return { label: "Approved", disabled: true, run: () => {} };
    }
    if (js === "PENDING")  return { label: "Request pending", disabled: true, run: () => {} };
    if (js === "REJECTED") return { label: "Request rejected", disabled: true, run: () => {} };

    // not joined — pick by visibility
    if (vis === "MODULE_ONLY")  return { label: "Open", run: go("enter") };
    if (vis === "ACCESS_CODE")  return { label: "Enter code", run: () => router.push(`/competitions/${id}/lobby`) };
    if (vis === "REQUEST_BASED") return { label: "Request to join", run: go("request") };
    return { label: "Register", run: go("register") }; // PUBLIC_OPEN / default
  };

  const live  = competitions.filter(c => (c.status || "").toUpperCase() === "ACTIVE");
  const reg   = competitions.filter(c => {
    const s = (c.status || "").toUpperCase();
    return s === "REGISTRATION" || s === "REGISTRATION_OPEN";
  });
  const ended = competitions.filter(c => (c.status || "").toUpperCase() === "ENDED");

  const filtered = competitions.filter(c => {
    const s = (c.status || "").toUpperCase();
    if (filter === "registration" && s !== "REGISTRATION" && s !== "REGISTRATION_OPEN") return false;
    if (filter === "active" && s !== "ACTIVE")   return false;
    if (filter === "ended" && s !== "ENDED")      return false;
    const q = search.trim().toLowerCase();
    return !q || (c.title || "").toLowerCase().includes(q);
  });

  const tabs = [
    { key: "all",          label: "All",               count: competitions.length },
    { key: "registration", label: "Registration Open", count: reg.length },
    { key: "active",       label: "Live Now",          count: live.length },
    { key: "ended",        label: "Ended",             count: ended.length },
  ];

  return (
    <>
      <Navbar />
      <div className="psp-main">

        {/* Header */}
        <div className="page-header">
          <div className="page-header-title">
            <Trophy size={20} />
            Competitions
          </div>
          <div className="page-header-sub">Codeforces-style contests — solo and team modes</div>
        </div>

        {/* Tabs + search */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 0 }}>
          <div style={{ flex: 1 }}>
            <FilterTabs tabs={tabs} active={filter} onChange={k => setFilter(k as FilterTab)} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid var(--line-2)", borderRadius: 8, padding: "0 10px", height: 34, marginBottom: 20, flexShrink: 0 }}>
            <Search size={12} color="var(--ink-3)" />
            <input
              placeholder="Search competitions…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ border: "none", outline: "none", fontSize: 12, color: "var(--ink)", width: 180, background: "transparent" }}
            />
          </div>
        </div>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
            <Spinner size={28} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="psp-empty" style={{ padding: 80 }}>
            <Trophy size={36} color="var(--line-2)" style={{ margin: "0 auto 12px" }} />
            <div className="psp-empty-title">No competitions</div>
            <div>{search ? "No results for that search." : "Check back later."}</div>
          </div>
        ) : (
          <div
            style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}
            className="card-grid stagger"
          >
            {filtered.map(c => {
              const id = c.competitionId || c.id;
              const st = (c.status || "").toUpperCase();
              const isEnded = st === "CLOSED" || st === "ENDED";
              const mode = (c.mode || "").toUpperCase() === "TEAM" ? "Team" : "Solo";
              const meta1 = [
                mode,
                fmtDuration(c.durationMinutes),
                c.problemCount > 0 ? `${c.problemCount} problem${c.problemCount !== 1 ? "s" : ""}` : "",
              ].filter(Boolean).join(" · ");
              const meta2 = isEnded
                ? `Ended ${fmtRelative(c.endTime)}`
                : c.startTime ? fmtDate(c.startTime) : undefined;
              const act = cardAction(c);
              return (
                <EventCard
                  key={id}
                  type="cp"
                  title={c.title}
                  status={competitionStatus(st)}
                  meta1={meta1 || "Competition"}
                  meta2={meta2}
                  meta1Icon={FileText}
                  meta2Icon={Calendar}
                  action={act.label}
                  actionDisabled={act.disabled}
                  onClick={act.disabled ? undefined : act.run}
                />
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
