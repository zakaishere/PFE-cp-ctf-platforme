"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { Trophy, Clock, Users, Plus, ChevronRight, Zap, Lock, Calendar } from "lucide-react";
import {
  getCtfCompetitions,
  type CTFCompetitionDTO,
} from "@/lib/api";

// ── Helpers ───────────────────────────────────────────────────────────────────

function useCountdown(targetIso: string) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, new Date(targetIso).getTime() - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetIso]);

  const d = Math.floor(remaining / 86400000);
  const h = Math.floor((remaining % 86400000) / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  return { remaining, d, h, m, s };
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtCountdown(d: number, h: number, m: number, s: number) {
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

// ── Active Competition Card ────────────────────────────────────────────────────

function ActiveCard({ comp }: { comp: CTFCompetitionDTO }) {
  const { d, h, m, s } = useCountdown(comp.endTime ?? "");

  return (
    <Link href={`/ctf/competitions/${comp.id}`} style={{ textDecoration: "none" }}>
      <div style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)",
        border: "1px solid #334155",
        borderRadius: 8,
        overflow: "hidden",
        cursor: "pointer",
        transition: "border-color 150ms ease, transform 150ms ease",
        position: "relative",
      }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "#6366f1";
          (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "#334155";
          (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
        }}
      >
        {/* Banner / gradient area */}
        <div style={{
          height: 120,
          background: comp.bannerUrl
            ? `url(${comp.bannerUrl}) center/cover`
            : "linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #ec4899 100%)",
          position: "relative",
          display: "flex",
          alignItems: "flex-start",
          padding: "12px 16px",
          justifyContent: "space-between",
        }}>
          {/* Live badge */}
          <span style={{
            background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 20, padding: "3px 10px", fontSize: 11,
            fontWeight: 700, color: "#fff",
            display: "flex", alignItems: "center", gap: 5,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%",
              background: "#22c55e",
              boxShadow: "0 0 0 2px rgba(34,197,94,0.3)",
              animation: "ctf-pulse 2s infinite",
              display: "inline-block",
            }} />
            LIVE NOW
          </span>
        </div>

        {/* Body */}
        <div style={{ padding: "16px 18px" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc", marginBottom: 6 }}>
            {comp.title}
          </div>
          {comp.description && (
            <div style={{
              fontSize: 13, color: "#94a3b8", marginBottom: 12,
              overflow: "hidden", display: "-webkit-box",
              WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
            }}>
              {comp.description}
            </div>
          )}

          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#94a3b8" }}>
              <Clock size={13} color="#f87171" />
              <span style={{ color: "#f87171", fontWeight: 600 }}>
                Ends in {comp.endTime ? fmtCountdown(d, h, m, s) : "—"}
              </span>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#94a3b8" }}>
              <Users size={13} /> Max {comp.maxTeamSize} per team
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#94a3b8" }}>
              <Zap size={13} color="#a78bfa" />
              <span style={{ color: "#a78bfa" }}>{comp.scoringMode === "DYNAMIC" ? "Dynamic" : "Static"} scoring</span>
            </span>
          </div>

          <div style={{
            marginTop: 14, display: "flex", alignItems: "center", justifyContent: "flex-end",
            fontSize: 12, color: "#6366f1", fontWeight: 600, gap: 4,
          }}>
            Enter Competition <ChevronRight size={13} />
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── Upcoming Competition Card ──────────────────────────────────────────────────

function UpcomingCard({ comp }: { comp: CTFCompetitionDTO }) {
  const { d, h, m } = useCountdown(comp.startTime ?? "");

  return (
    <Link href={`/ctf/competitions/${comp.id}`} style={{ textDecoration: "none" }}>
      <div style={{
        background: "#0f172a",
        border: "1px solid #1e293b",
        borderRadius: 8, padding: "16px 18px",
        cursor: "pointer",
        transition: "border-color 150ms ease, transform 150ms ease",
      }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "#4f46e5";
          (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "#1e293b";
          (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#f8fafc" }}>{comp.title}</div>
          <span style={{
            background: "#1e293b", border: "1px solid #334155",
            borderRadius: 4, padding: "2px 8px", fontSize: 10,
            fontWeight: 700, color: "#60a5fa", whiteSpace: "nowrap",
          }}>
            UPCOMING
          </span>
        </div>

        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>
          Starts in <span style={{ color: "#f8fafc", fontWeight: 600 }}>{fmtCountdown(d, h, m, 0)}</span>
          {" · "}Starts {fmtDate(comp.startTime)}
        </div>

        <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#64748b" }}>
          <span><Users size={11} style={{ display: "inline", marginRight: 3 }} />{comp.maxTeamSize} per team</span>
          <span><Zap size={11} style={{ display: "inline", marginRight: 3 }} />{comp.scoringMode}</span>
          {comp.visibility !== "PUBLIC" && (
            <span><Lock size={11} style={{ display: "inline", marginRight: 3 }} />{comp.visibility.replace("_", " ")}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

// ── Past Competition Row ───────────────────────────────────────────────────────

function PastRow({ comp }: { comp: CTFCompetitionDTO }) {
  return (
    <Link href={`/ctf/competitions/${comp.id}`} style={{ textDecoration: "none" }}>
      <div style={{
        display: "flex", alignItems: "center", padding: "10px 16px",
        borderBottom: "1px solid #1e293b",
        cursor: "pointer", transition: "background 150ms ease",
        gap: 16,
      }}
        onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = "#0f172a"}
        onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = "transparent"}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8" }}>{comp.title}</div>
        </div>
        <div style={{ fontSize: 12, color: "#475569", whiteSpace: "nowrap" }}>
          <Calendar size={11} style={{ display: "inline", marginRight: 4 }} />
          {fmtDate(comp.startTime)} → {fmtDate(comp.endTime)}
        </div>
        <span style={{ fontSize: 11, color: "#475569" }}>Ended</span>
        <ChevronRight size={13} color="#334155" />
      </div>
    </Link>
  );
}

// ── Section Header ─────────────────────────────────────────────────────────────

function SectionHeader({ icon, label, count }: { icon: React.ReactNode; label: string; count?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
      {icon}
      <span style={{ fontSize: 13, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em" }}>
        {label}
      </span>
      {count !== undefined && (
        <span style={{
          background: "#1e293b", border: "1px solid #334155",
          borderRadius: 10, padding: "1px 7px", fontSize: 11, fontWeight: 700, color: "#64748b",
        }}>{count}</span>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CTFCompetitionsPage() {
  const [competitions, setCompetitions] = useState<CTFCompetitionDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    setRole(typeof window !== "undefined" ? localStorage.getItem("autograde_role") : null);
    getCtfCompetitions()
      .then(setCompetitions)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const active   = competitions.filter(c => c.started && !c.ended);
  const upcoming = competitions.filter(c => !c.started);
  const past     = competitions.filter(c => c.ended);

  const canCreate = role === "TEACHER" || role === "ADMIN";

  return (
    <>
      <Navbar />
      <div className="psp-breadcrumb">
        <Link href="/dashboard">PSP</Link> ›{" "}
        <Link href="/ctf">CTF</Link> ›{" "}
        <span style={{ color: "var(--text-primary)" }}>Competitions</span>
      </div>

      <div className="psp-main" style={{ maxWidth: 1000 }}>
        {/* Page header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <Trophy size={22} color="#a78bfa" />
              <span style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)" }}>
                CTF Competitions
              </span>
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Team-based capture-the-flag competitions with live scoreboards.
            </div>
          </div>
          {canCreate && (
            <Link href="/teacher/ctf/competitions/new">
              <button className="psp-btn psp-btn-secondary" style={{ gap: 6 }}>
                <Plus size={14} /> Create Competition
              </button>
            </Link>
          )}
        </div>

        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skel" style={{ height: 200, borderRadius: 8 }} />
            ))}
          </div>
        ) : (
          <>
            {/* Active Now */}
            {active.length > 0 && (
              <section style={{ marginBottom: 36 }}>
                <SectionHeader
                  icon={<span style={{
                    width: 8, height: 8, borderRadius: "50%", background: "#22c55e",
                    display: "inline-block", boxShadow: "0 0 0 2px rgba(34,197,94,0.3)",
                    animation: "ctf-pulse 2s infinite",
                  }} />}
                  label="Active Now"
                  count={active.length}
                />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))", gap: 14 }}>
                  {active.map(c => <ActiveCard key={c.id} comp={c} />)}
                </div>
              </section>
            )}

            {/* Upcoming */}
            {upcoming.length > 0 && (
              <section style={{ marginBottom: 36 }}>
                <SectionHeader
                  icon={<Calendar size={14} color="#60a5fa" />}
                  label="Upcoming"
                  count={upcoming.length}
                />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                  {upcoming.map(c => <UpcomingCard key={c.id} comp={c} />)}
                </div>
              </section>
            )}

            {/* Past */}
            {past.length > 0 && (
              <section>
                <SectionHeader
                  icon={<Clock size={14} color="#475569" />}
                  label="Past"
                  count={past.length}
                />
                <div style={{
                  background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, overflow: "hidden",
                }}>
                  {past.map(c => <PastRow key={c.id} comp={c} />)}
                </div>
              </section>
            )}

            {/* Empty state */}
            {competitions.length === 0 && (
              <div style={{ textAlign: "center", padding: "80px 0", color: "#475569" }}>
                <Trophy size={40} style={{ margin: "0 auto 16px", opacity: 0.3 }} />
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>No competitions yet</div>
                <div style={{ fontSize: 13 }}>
                  {canCreate ? "Create the first CTF competition." : "Check back soon for upcoming CTF competitions."}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <style jsx global>{`
        @keyframes ctf-pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 2px rgba(34,197,94,0.3); }
          50%       { opacity: 0.7; box-shadow: 0 0 0 4px rgba(34,197,94,0.15); }
        }
      `}</style>
    </>
  );
}
