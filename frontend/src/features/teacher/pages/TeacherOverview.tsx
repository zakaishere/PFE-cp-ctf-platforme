"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import {
  ClipboardList, CheckCircle2, Clock, Code2, Trophy, AlertTriangle,
  Loader2, ArrowRight,
} from "lucide-react";
import {
  getAssessments, getCompetitions, getLeaderboard, getProblemsPage,
  type LeaderboardEntry,
} from "@/lib/api";
import { useAuth } from "@/features/auth/contexts/AuthContext";

const AVATAR_COLORS = [
  "#0052cc", "#6554c0", "#00875a", "#ff5630",
  "#ff8b00", "#36b37e", "#00b8d9", "#de350b",
];

// ── helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    " · " +
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
  );
}

function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";
}

function todayLabel(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

// ── tiny stat card ──────────────────────────────────────────────────────────

function Stat({
  icon, value, label, iconCls,
}: { icon: React.ReactNode; value: React.ReactNode; label: string; iconCls: string }) {
  return (
    <div className="psp-stat-card">
      <div className={`psp-stat-icon ${iconCls}`}>{icon}</div>
      <div>
        <div className="psp-stat-val">{value}</div>
        <div className="psp-stat-lbl">{label}</div>
      </div>
    </div>
  );
}

// ── page ────────────────────────────────────────────────────────────────────

type DashboardTab = "assessments" | "competitions" | "problems";

export default function TeacherOverview() {
  const router = useRouter();
  const { firstName } = useAuth();

  const [assessments, setAssessments] = useState<any[]>([]);
  const [competitions, setCompetitions] = useState<any[]>([]);
  const [problems, setProblems] = useState<any[]>([]);
  const [problemsTotal, setProblemsTotal] = useState<number>(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<DashboardTab>("assessments");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.allSettled([
      getAssessments(),
      getCompetitions(),
      getProblemsPage(0, 10),
      getLeaderboard(),
    ]).then((results) => {
      if (cancelled) return;
      if (results[0].status === "fulfilled") setAssessments(results[0].value ?? []);
      if (results[1].status === "fulfilled") setCompetitions(results[1].value ?? []);
      if (results[2].status === "fulfilled") {
        const page = results[2].value ?? {};
        setProblems(page.content ?? []);
        setProblemsTotal(page.totalElements ?? (page.content?.length ?? 0));
      }
      if (results[3].status === "fulfilled") setLeaderboard(results[3].value ?? []);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  // ── derived stats ──────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const activeAssessments = assessments.filter(
      (a) => a.status === "LIVE" || a.status === "UPCOMING" || a.status === "OPEN",
    ).length;
    const pendingRequests = assessments.reduce(
      (sum, a) => sum + (a.pendingJoinRequests ?? a.joinRequestCount ?? 0),
      0,
    );
    const activeCompetitions = competitions.filter(
      (c) => c.status === "ACTIVE" || c.status === "REGISTRATION" || c.status === "UPCOMING",
    ).length;
    return { activeAssessments, pendingRequests, activeCompetitions };
  }, [assessments, competitions]);

  // ── table data per tab ──────────────────────────────────────────────────
  const visibleAssessments = useMemo(
    () => assessments.slice().sort((a, b) => {
      const order: Record<string, number> = { LIVE: 0, UPCOMING: 1, OPEN: 2, CLOSED: 3 };
      return (order[a.status] ?? 4) - (order[b.status] ?? 4);
    }).slice(0, 6),
    [assessments],
  );

  const visibleCompetitions = useMemo(
    () => competitions.slice(0, 6),
    [competitions],
  );

  return (
    <>
      <Navbar />
      <div className="psp-breadcrumb">
        <Link href="/teacher">PSP</Link> ›{" "}
        <span style={{ color: "var(--text-primary)" }}>Dashboard</span>
      </div>

      <div className="psp-main">
        {/* Pending requests alert */}
        {stats.pendingRequests > 0 && (
          <div className="psp-alert psp-alert-warn">
            <AlertTriangle size={14} style={{ flexShrink: 0 }} />
            <span>
              <strong>{stats.pendingRequests} pending join request{stats.pendingRequests !== 1 ? "s" : ""}</strong>
              {" "}across your assessments —{" "}
              <Link
                href="/teacher/exams"
                style={{ color: "#0052cc", fontWeight: 600 }}
              >
                Review now
              </Link>
            </span>
          </div>
        )}

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "flex-start",
          justifyContent: "space-between", marginBottom: 20,
        }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)" }}>
              {firstName ? `Welcome back, ${firstName}` : "Teacher Dashboard"}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
              {todayLabel()}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="psp-btn psp-btn-secondary" onClick={() => router.push("/teacher/problems")}>
              <Code2 size={13} /> New Problem
            </button>
            <button className="psp-btn psp-btn-primary" onClick={() => router.push("/teacher/exams")}>
              <ClipboardList size={13} /> Create Assessment
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="psp-stats">
          <Stat
            iconCls="ic-blue"
            icon={<ClipboardList size={20} />}
            value={loading ? "…" : stats.activeAssessments}
            label="Active Assessments"
          />
          <Stat
            iconCls="ic-purple"
            icon={<Trophy size={20} />}
            value={loading ? "…" : stats.activeCompetitions}
            label="Active Competitions"
          />
          <Stat
            iconCls="ic-orange"
            icon={<Clock size={20} />}
            value={loading ? "…" : stats.pendingRequests}
            label="Pending Requests"
          />
          <Stat
            iconCls="ic-green"
            icon={<Code2 size={20} />}
            value={loading ? "…" : problemsTotal}
            label="Problems in Bank"
          />
        </div>

        {/* Tabs */}
        <div className="psp-tabs">
          <div
            className={`psp-tab${tab === "assessments" ? " active" : ""}`}
            onClick={() => setTab("assessments")}
          >
            Assessments
          </div>
          <div
            className={`psp-tab${tab === "competitions" ? " active" : ""}`}
            onClick={() => setTab("competitions")}
          >
            Competitions
          </div>
          <div
            className={`psp-tab${tab === "problems" ? " active" : ""}`}
            onClick={() => setTab("problems")}
          >
            Problems
          </div>
        </div>

        {/* Two-col layout */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>
          {/* Left */}
          <div>
            {/* Active tab content */}
            {tab === "assessments" && (
              <AssessmentsCard
                items={visibleAssessments}
                loading={loading}
                onCreate={() => router.push("/teacher/exams")}
                onOpen={() => router.push("/teacher/exams")}
              />
            )}
            {tab === "competitions" && (
              <CompetitionsCard
                items={visibleCompetitions}
                loading={loading}
                onCreate={() => router.push("/teacher/competitions")}
                onOpen={() => router.push("/teacher/competitions")}
              />
            )}
            {tab === "problems" && (
              <ProblemsCard
                items={problems.slice(0, 6)}
                loading={loading}
                onCreate={() => router.push("/teacher/problems")}
                onOpen={() => router.push("/teacher/problems")}
              />
            )}
          </div>

          {/* Right column */}
          <div>
            {/* Leaderboard */}
            <div className="psp-card" style={{ marginBottom: 14 }}>
              <div className="psp-card-header">
                <span className="psp-card-title" style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <Trophy size={13} color="#ff8b00" /> Top Students
                </span>
                <Link href="/leaderboard" style={{ fontSize: 11, color: "#0052cc" }}>
                  View All
                </Link>
              </div>
              <div className="psp-scroll">
                {leaderboard.length === 0 && !loading ? (
                  <div style={{ padding: 16, fontSize: 12, color: "var(--text-muted)" }}>
                    No leaderboard data yet.
                  </div>
                ) : leaderboard.slice(0, 7).map((u, i) => {
                  const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
                  const ini = initialsOf(`${u.firstName} ${u.lastName}`);
                  const medal = ["🥇", "🥈", "🥉"][i];
                  return (
                    <div key={u.studentId} style={{
                      display: "flex", alignItems: "center",
                      padding: "9px 14px", borderBottom: "1px solid #f4f5f7", gap: 10,
                    }}>
                      <div style={{ width: 22, textAlign: "center", fontWeight: 700, fontSize: 12 }}>
                        {medal ?? <span style={{ color: "var(--text-muted)" }}>{i + 1}</span>}
                      </div>
                      <div style={{
                        width: 26, height: 26, borderRadius: "50%", background: color,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 10, fontWeight: 700, color: "white", flexShrink: 0,
                      }}>
                        {ini}
                      </div>
                      <div style={{ flex: 1, fontSize: 12, fontWeight: 500 }}>
                        {u.firstName} {u.lastName}
                      </div>
                      <div style={{ fontWeight: 700, color: "#0052cc", fontSize: 12 }}>
                        {u.totalPoints} pts
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick links */}
            <div className="psp-card">
              <div className="psp-card-header">
                <span className="psp-card-title">Quick Actions</span>
              </div>
              <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                <QuickLink href="/teacher/problems" label="Manage Problem Bank" />
                <QuickLink href="/teacher/exams" label="Create / Manage Exams & TPs" />
                <QuickLink href="/teacher/competitions" label="Host a Competition" />
                <QuickLink href="/teacher/ctf" label="CTF Challenges" />
                <QuickLink href="/teacher/students" label="Students" />
                <QuickLink href="/teacher/monitor" label="Live Exam Monitor" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── tab content cards ──────────────────────────────────────────────────────

function AssessmentsCard({
  items, loading, onCreate, onOpen,
}: { items: any[]; loading: boolean; onCreate: () => void; onOpen: () => void }) {
  return (
    <div className="psp-card">
      <div className="psp-card-header">
        <span className="psp-card-title">Your Assessments</span>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="psp-btn psp-btn-secondary psp-btn-sm" onClick={onOpen}>
            View All <ArrowRight size={11} />
          </button>
          <button className="psp-btn psp-btn-primary psp-btn-sm" onClick={onCreate}>
            + New
          </button>
        </div>
      </div>
      {loading ? (
        <EmptyLoading label="Loading assessments…" />
      ) : items.length === 0 ? (
        <EmptyCreate
          label="No assessments yet"
          help="Create your first Exam or TP to get started."
          onCreate={onCreate}
          ctaLabel="Create Assessment"
        />
      ) : (
        <table className="psp-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Type</th>
              <th>Module</th>
              <th>Date</th>
              <th>Status</th>
              <th>Requests</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((a: any) => (
              <tr key={a.id} onClick={onOpen} style={{ cursor: "pointer" }}>
                <td className="td-link">{a.title}</td>
                <td>
                  {a.type === "LIVE_EXAM" ? (
                    <span className="psp-badge b-live">Live Exam</span>
                  ) : (
                    <span className="psp-badge b-tp">Open TP</span>
                  )}
                </td>
                <td className="td-muted">{a.moduleName ?? "—"}</td>
                <td className="td-muted">
                  {fmtDate(a.scheduledStartTime ?? a.deadline)}
                </td>
                <td>
                  <StatusPill status={a.status} />
                </td>
                <td>
                  {(a.pendingJoinRequests ?? 0) > 0 ? (
                    <span style={{ color: "#0052cc", fontWeight: 600, fontSize: 12 }}>
                      {a.pendingJoinRequests} pending
                    </span>
                  ) : (
                    <span className="td-muted">—</span>
                  )}
                </td>
                <td>
                  <button
                    className="psp-btn psp-btn-secondary psp-btn-sm"
                    onClick={(e) => { e.stopPropagation(); onOpen(); }}
                  >
                    Open
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function CompetitionsCard({
  items, loading, onCreate, onOpen,
}: { items: any[]; loading: boolean; onCreate: () => void; onOpen: () => void }) {
  return (
    <div className="psp-card">
      <div className="psp-card-header">
        <span className="psp-card-title">Your Competitions</span>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="psp-btn psp-btn-secondary psp-btn-sm" onClick={onOpen}>
            View All <ArrowRight size={11} />
          </button>
          <button className="psp-btn psp-btn-primary psp-btn-sm" onClick={onCreate}>
            + New
          </button>
        </div>
      </div>
      {loading ? (
        <EmptyLoading label="Loading competitions…" />
      ) : items.length === 0 ? (
        <EmptyCreate
          label="No competitions yet"
          help="Host a coding competition to engage your class."
          onCreate={onCreate}
          ctaLabel="Host Competition"
        />
      ) : (
        <table className="psp-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Mode</th>
              <th>Starts</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((c: any) => (
              <tr key={c.id ?? c.competitionId} onClick={onOpen} style={{ cursor: "pointer" }}>
                <td className="td-link">{c.title}</td>
                <td className="td-muted">{c.mode ?? "—"}</td>
                <td className="td-muted">{fmtDate(c.startTime)}</td>
                <td>
                  <StatusPill status={c.status} />
                </td>
                <td>
                  <button
                    className="psp-btn psp-btn-secondary psp-btn-sm"
                    onClick={(e) => { e.stopPropagation(); onOpen(); }}
                  >
                    Open
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ProblemsCard({
  items, loading, onCreate, onOpen,
}: { items: any[]; loading: boolean; onCreate: () => void; onOpen: () => void }) {
  return (
    <div className="psp-card">
      <div className="psp-card-header">
        <span className="psp-card-title">Recent Problems</span>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="psp-btn psp-btn-secondary psp-btn-sm" onClick={onOpen}>
            View All <ArrowRight size={11} />
          </button>
          <button className="psp-btn psp-btn-primary psp-btn-sm" onClick={onCreate}>
            + New Problem
          </button>
        </div>
      </div>
      {loading ? (
        <EmptyLoading label="Loading problems…" />
      ) : items.length === 0 ? (
        <EmptyCreate
          label="No problems yet"
          help="Build your problem bank — problems are reused across Exams, TPs and Competitions."
          onCreate={onCreate}
          ctaLabel="Create Problem"
        />
      ) : (
        <table className="psp-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Difficulty</th>
              <th>Test Cases</th>
              <th>Visibility</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p: any) => {
              const diff = (p.difficultyLevel ?? "EASY").toLowerCase();
              const diffCls = diff === "easy" ? "b-easy" : diff === "medium" ? "b-med" : "b-hard";
              const tcCount = Array.isArray(p.testCases) ? p.testCases.length : 0;
              return (
                <tr key={p.problemId} onClick={onOpen} style={{ cursor: "pointer" }}>
                  <td className="td-link">{p.title}</td>
                  <td><span className={`psp-badge ${diffCls}`}>{diff}</span></td>
                  <td className="td-muted">{tcCount}</td>
                  <td>
                    <span className={`psp-badge ${p.isPublic ? "b-pub" : "b-priv"}`}>
                      {p.isPublic ? "Public" : "Private"}
                    </span>
                  </td>
                  <td className="td-muted">
                    {p.createdAt
                      ? new Date(p.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── small reusable bits ─────────────────────────────────────────────────────

function StatusPill({ status }: { status?: string }) {
  if (!status) return <span className="td-muted">—</span>;
  const map: Record<string, { dot: string; label: string }> = {
    LIVE:         { dot: "d-red",    label: "Live"        },
    UPCOMING:     { dot: "d-orange", label: "Upcoming"    },
    OPEN:         { dot: "d-green",  label: "Open"        },
    CLOSED:       { dot: "d-gray",   label: "Closed"      },
    ACTIVE:       { dot: "d-red",    label: "Active"      },
    REGISTRATION: { dot: "d-blue",   label: "Registration"},
    PAUSED:       { dot: "d-orange", label: "Paused"      },
    FROZEN:       { dot: "d-blue",   label: "Frozen"      },
    ENDED:        { dot: "d-gray",   label: "Ended"       },
  };
  const m = map[status] ?? { dot: "d-gray", label: status };
  return (
    <span className="psp-status">
      <span className={`psp-dot ${m.dot}`} /> {m.label}
    </span>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "9px 12px", border: "1px solid var(--border)",
        borderRadius: 3, textDecoration: "none",
        fontSize: 12, fontWeight: 500, color: "var(--text-primary)",
        background: "var(--bg-primary)",
      }}
    >
      {label}
      <ArrowRight size={12} color="#5e6c84" />
    </Link>
  );
}

function EmptyLoading({ label }: { label: string }) {
  return (
    <div style={{
      padding: 32, textAlign: "center",
      color: "var(--text-muted)", fontSize: 12,
      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    }}>
      <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
      {label}
    </div>
  );
}

function EmptyCreate({
  label, help, onCreate, ctaLabel,
}: { label: string; help: string; onCreate: () => void; ctaLabel: string }) {
  return (
    <div style={{ padding: 32, textAlign: "center" }}>
      <CheckCircle2 size={28} color="var(--border)" style={{ margin: "0 auto 8px" }} />
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>
        {help}
      </div>
      <button className="psp-btn psp-btn-primary" onClick={onCreate}>
        {ctaLabel}
      </button>
    </div>
  );
}
