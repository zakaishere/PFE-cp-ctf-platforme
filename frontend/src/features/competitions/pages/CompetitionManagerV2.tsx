"use client";

import { useState, useEffect, useCallback } from "react";
import { APP_NAME } from "@/lib/brand";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { Trophy, Plus, Calendar, Users, Search } from "lucide-react";
import { getCompetitions } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

// ─── helpers ────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    " · " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function fmtDuration(mins: number) {
  if (!mins) return "—";
  const h = Math.floor(mins / 60), m = mins % 60;
  return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

type FilterKey = "all" | "registration" | "active" | "ended";

// ─── Main ────────────────────────────────────────────────────────────────────

export default function CompetitionManagerV2() {
  const { toast } = useToast();
  const router = useRouter();

  const [list, setList]               = useState<any[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [search, setSearch]           = useState("");
  const [filter, setFilter]           = useState<FilterKey>("all");

  const loadList = useCallback(() => {
    setListLoading(true);
    getCompetitions()
      .then(data => setList(data))
      .catch(e => toast({ title: "Failed to load competitions", description: e.message, variant: "destructive" }))
      .finally(() => setListLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  const isActive = (c: any) => (c.status || "").toUpperCase() === "ACTIVE";
  const isReg    = (c: any) => (c.status || "").toUpperCase() === "REGISTRATION";
  const isEnded  = (c: any) => (c.status || "").toUpperCase() === "ENDED";

  const filtered = list.filter(c => {
    const s = (c.status || "").toUpperCase();
    if (filter === "registration" && s !== "REGISTRATION") return false;
    if (filter === "active"       && s !== "ACTIVE")       return false;
    if (filter === "ended"        && s !== "ENDED")        return false;
    const q = search.trim().toLowerCase();
    return !q || (c.title || "").toLowerCase().includes(q);
  });

  const counts = {
    all:          list.length,
    registration: list.filter(isReg).length,
    active:       list.filter(isActive).length,
    ended:        list.filter(isEnded).length,
  };

  const statusBadge = (c: any) => {
    const s = (c.status || "").toUpperCase();
    if (s === "ACTIVE")       return <span className="psp-badge b-live">Live</span>;
    if (s === "REGISTRATION") return <span className="psp-badge b-solo">Registration</span>;
    if (s === "ENDED")        return <span className="psp-badge b-priv">Ended</span>;
    return <span className="psp-badge b-pending">{c.status || "—"}</span>;
  };

  const scoringPill = (c: any) => {
    const mode = (c.scoringMode || c.mode || "").toUpperCase();
    if (mode === "ICPC" || mode === "PENALTY") return (
      <span className="psp-badge" style={{ background: "var(--accent-soft)", color: "var(--brand)" }}>ICPC</span>
    );
    if (mode === "RATED") return (
      <span className="psp-badge" style={{ background: "var(--warn-soft)", color: "var(--warn-ink)" }}>Rated</span>
    );
    return (
      <span className="psp-badge" style={{ background: "var(--success-soft)", color: "var(--success-ink)" }}>Partial</span>
    );
  };

  const rowActions = (c: any) => {
    const id = c.competitionId || c.id;
    const manageHref = `/teacher/competitions/${id}/manage`;
    const editHref   = `/teacher/competitions/${id}/edit`;

    if (isEnded(c)) {
      return (
        <button
          className="psp-btn psp-btn-secondary psp-btn-sm"
          onClick={e => { e.stopPropagation(); router.push(manageHref); }}
        >
          Results
        </button>
      );
    }
    if (isActive(c)) {
      return (
        <button
          className="psp-btn psp-btn-primary psp-btn-sm"
          onClick={e => { e.stopPropagation(); router.push(manageHref); }}
        >
          Manage
        </button>
      );
    }
    if (isReg(c)) {
      return (
        <div style={{ display: "flex", gap: 6 }}>
          <button
            className="psp-btn psp-btn-secondary psp-btn-sm"
            onClick={e => { e.stopPropagation(); router.push(editHref); }}
          >
            Edit
          </button>
          <button
            className="psp-btn psp-btn-primary psp-btn-sm"
            onClick={e => { e.stopPropagation(); router.push(manageHref); }}
          >
            Manage
          </button>
        </div>
      );
    }
    // Draft or unknown
    return (
      <div style={{ display: "flex", gap: 6 }}>
        <button
          className="psp-btn psp-btn-secondary psp-btn-sm"
          onClick={e => { e.stopPropagation(); router.push(editHref); }}
        >
          Edit
        </button>
        <button
          className="psp-btn psp-btn-primary psp-btn-sm"
          onClick={e => { e.stopPropagation(); router.push(manageHref); }}
        >
          Publish
        </button>
      </div>
    );
  };

  const FILTERS: { key: FilterKey; label: string }[] = [
    { key: "all",          label: "All"              },
    { key: "active",       label: "Live"             },
    { key: "registration", label: "Registration Open" },
    { key: "ended",        label: "Ended"            },
  ];

  return (
    <>
      <Navbar />
      <div className="psp-breadcrumb">
        <Link href="/teacher">{APP_NAME}</Link> › <span style={{ color: "var(--text-primary)" }}>Competitions</span>
      </div>

      <div className="psp-main">
        {/* Page header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, gap: 16 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>Competitions</div>
            <div style={{ fontSize: 13, color: "var(--ink-2)" }}>Run live competitive programming rounds for your students</div>
          </div>
          <button className="psp-btn psp-btn-primary psp-btn-sm" onClick={() => router.push("/teacher/competitions/new")}>
            <Plus size={11} /> New Competition
          </button>
        </div>

        {/* Filter bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 12, flexWrap: "wrap" }}>
          {FILTERS.map(f => (
            <button
              key={f.key}
              className={`psp-ftab${filter === f.key ? " on" : ""}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label} ({counts[f.key]})
            </button>
          ))}
          <div style={{ marginLeft: "auto", position: "relative", display: "flex", alignItems: "center" }}>
            <Search size={13} color="var(--ink-3)" style={{ position: "absolute", left: 8, pointerEvents: "none" }} />
            <input
              className="psp-search"
              placeholder="Search…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 28 }}
            />
          </div>
        </div>

        {/* List */}
        {listLoading ? (
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r)" }}>
            {Array(4).fill(0).map((_, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", borderBottom: i < 3 ? "1px solid var(--line)" : "none" }}>
                <div className="skel" style={{ width: 40, height: 40, borderRadius: 8, flexShrink: 0 }} />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div className="skel" style={{ width: "40%", height: 14, borderRadius: 3 }} />
                  <div className="skel" style={{ width: "60%", height: 11, borderRadius: 3 }} />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="psp-empty" style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r)" }}>
            <Trophy size={28} color="var(--ink-3)" style={{ margin: "0 auto 8px" }} />
            <div className="psp-empty-title">No competitions found</div>
            <div>Try a different filter or create your first competition</div>
          </div>
        ) : (
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r)", overflow: "hidden" }}>
            {filtered.map((c, i) => {
              const id = c.competitionId || c.id;
              const active = isActive(c);
              const ended  = isEnded(c);
              return (
                <div
                  key={id}
                  onClick={() => router.push(`/teacher/competitions/${id}/manage`)}
                  style={{
                    display: "flex", alignItems: "center", gap: 14, padding: "14px 18px",
                    borderBottom: i < filtered.length - 1 ? "1px solid var(--line)" : "none",
                    cursor: "pointer", transition: "background 0.1s",
                  }}
                  onMouseOver={e => (e.currentTarget.style.background = "var(--surface-2)")}
                  onMouseOut={e => (e.currentTarget.style.background = "")}
                >
                  {/* Icon tile */}
                  <div style={{
                    width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: ended ? "var(--bg-2)" : "var(--accent-soft)",
                  }}>
                    <Trophy size={18} color={ended ? "var(--ink-3)" : "var(--brand)"} />
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {c.title}
                      </span>
                      {statusBadge(c)}
                      {scoringPill(c)}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--ink-2)", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                      {c.startTime && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <Calendar size={10} /> {fmtDate(c.startTime)}
                        </span>
                      )}
                      {c.durationMinutes && <span>{fmtDuration(c.durationMinutes)}</span>}
                      {(c.mode || "").toUpperCase() === "TEAM" && c.maxTeamSize && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <Users size={10} /> up to {c.maxTeamSize}
                        </span>
                      )}
                      {c.problemCount != null && <span>{c.problemCount} problems</span>}
                      {c.participantCount != null && <span>{c.participantCount} registered</span>}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ flexShrink: 0 }}>
                    {rowActions(c)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
