"use client";

import { useEffect, useState } from "react";
import { APP_NAME } from "@/lib/brand";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import {
  Trophy, FileText, FlaskConical, Flag, ArrowRight,
  Clock, AlertTriangle, Loader2, Plus, Zap,
} from "lucide-react";
import { getTeacherDashboardOverview, type TeacherDashboardOverview } from "@/lib/api";
import { useAuth } from "@/features/auth/contexts/AuthContext";
import DomainStatusBadge from "@/components/manage/DomainStatusBadge";

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    + ", " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function fmtRemaining(startIso: string | null, durationMinutes?: number): string | null {
  if (!startIso || !durationMinutes) return null;
  const endMs = new Date(startIso).getTime() + durationMinutes * 60_000;
  const rem = endMs - Date.now();
  if (rem <= 0) return "Ended";
  const h = Math.floor(rem / 3_600_000);
  const m = Math.floor((rem % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}

function greeting(name: string | null | undefined) {
  const h = new Date().getHours();
  const g = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  return name ? `${g}, ${name}` : g;
}

function todayLabel() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

const DOMAIN_ICONS: Record<string, React.ReactNode> = {
  COMPETITION: <Trophy size={13} />,
  EXAM:        <FileText size={13} />,
  TP:          <FlaskConical size={13} />,
  CTF:         <Flag size={13} />,
};

// ── stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  icon, label, active, upcoming, total, createHref, listHref, unit,
}: {
  icon: React.ReactNode; label: string;
  active?: number; upcoming?: number; total: number;
  createHref: string; listHref: string; unit?: string;
}) {
  return (
    <div style={{
      background: "var(--bg-primary)", border: "1px solid var(--border)",
      borderRadius: 10, padding: "18px 20px",
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
          {icon} {label}
        </div>
        <Link href={createHref} style={{
          display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11,
          color: "var(--brand)", textDecoration: "none", fontWeight: 600,
        }}>
          <Plus size={11} /> New
        </Link>
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.8 }}>
        {active !== undefined && (
          <div><span style={{ color: "var(--success)", fontWeight: 700 }}>{active} active</span></div>
        )}
        {upcoming !== undefined && (
          <div><span style={{ color: "var(--brand)", fontWeight: 600 }}>{upcoming} upcoming</span></div>
        )}
        <div>{total} total</div>
      </div>
      <Link href={listHref} style={{
        fontSize: 11, color: "var(--text-muted)", textDecoration: "none",
        display: "flex", alignItems: "center", gap: 4,
      }}>
        Manage all <ArrowRight size={10} />
      </Link>
    </div>
  );
}

// ── active item tile ──────────────────────────────────────────────────────────

function ActiveTile({
  icon, status, title, subtitle, remaining, manageUrl,
}: {
  icon: React.ReactNode; status: string; title: string;
  subtitle?: string; remaining?: string | null; manageUrl: string;
}) {
  return (
    <div style={{
      background: "var(--bg-secondary)", border: "1px solid var(--border)",
      borderRadius: 8, padding: "12px 16px", marginBottom: 10,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <DomainStatusBadge status={status} />
            {icon}
          </div>
          <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {title}
          </div>
          {subtitle && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{subtitle}</div>}
          {remaining && <div style={{ fontSize: 11, color: "var(--warn)", fontWeight: 500, marginTop: 4 }}>{remaining}</div>}
        </div>
        <Link href={manageUrl} style={{
          display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11,
          fontWeight: 600, color: "var(--brand)", textDecoration: "none", whiteSpace: "nowrap",
        }}>
          Manage <ArrowRight size={11} />
        </Link>
      </div>
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function TeacherOverview() {
  const { firstName } = useAuth();
  const router = useRouter();
  const [data, setData]       = useState<TeacherDashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  useEffect(() => {
    let cancelled = false;
    function load() {
      getTeacherDashboardOverview()
        .then(d => { if (!cancelled) { setData(d); setLoading(false); } })
        .catch(() => { if (!cancelled) { setError(true); setLoading(false); } });
    }
    load();
    const id = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const stats = data?.stats;
  const upcoming = data?.upcomingEvents ?? [];

  return (
    <>
      <Navbar />
      <div className="psp-breadcrumb">
        <Link href="/teacher">{APP_NAME}</Link> ›{" "}
        <span style={{ color: "var(--text-primary)" }}>Dashboard</span>
      </div>

      <div className="psp-main">
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>
            {greeting(firstName)}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>{todayLabel()}</div>
        </div>

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
            <Loader2 size={24} style={{ animation: "spin 1s linear infinite", color: "var(--brand)" }} />
          </div>
        )}

        {!loading && !error && data && (
          <>
            {/* Stat cards row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 28 }}>
              <StatCard
                icon={<Trophy size={14} color="var(--warn)" />}
                label="Competitions"
                active={stats?.competitions.active}
                upcoming={stats?.competitions.upcoming}
                total={stats?.competitions.total ?? 0}
                createHref="/teacher/competitions"
                listHref="/teacher/competitions"
              />
              <StatCard
                icon={<FileText size={14} color="var(--brand)" />}
                label="Exams"
                active={stats?.exams.active}
                upcoming={stats?.exams.upcoming}
                total={stats?.exams.total ?? 0}
                createHref="/teacher/exams"
                listHref="/teacher/exams"
              />
              <StatCard
                icon={<FlaskConical size={14} color="var(--success)" />}
                label="TPs"
                active={stats?.tps.open}
                total={stats?.tps.total ?? 0}
                createHref="/teacher/exams"
                listHref="/teacher/exams"
                unit="open"
              />
            </div>

            {/* CTF card */}
            {(stats?.ctfs.active ?? 0) + (stats?.ctfs.upcoming ?? 0) > 0 && (
              <div style={{
                background: "var(--accent-soft)", border: "1px solid var(--accent-ring)",
                borderRadius: 8, padding: "14px 20px", marginBottom: 24,
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
                    <Flag size={14} color="var(--brand-2)" /> CTF
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {stats?.ctfs.active ?? 0} ACTIVE · {stats?.ctfs.upcoming ?? 0} UPCOMING · {stats?.ctfs.total ?? 0} total
                  </div>
                </div>
                <Link href="/teacher/ctf" style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  background: "var(--brand)", color: "white", padding: "6px 14px",
                  borderRadius: 6, fontSize: 12, fontWeight: 600, textDecoration: "none",
                }}>
                  Manage CTF <ArrowRight size={12} />
                </Link>
              </div>
            )}

            {/* Two columns */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>

              {/* Left: Active now */}
              <div>
                {data.activeCompetitions.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
                      Active Competitions
                    </div>
                    {data.activeCompetitions.map(c => (
                      <ActiveTile key={c.id}
                        icon={<Trophy size={12} color="var(--warn)" />}
                        status="ACTIVE" title={c.title}
                        subtitle={`${c.mode} · ${c.durationMinutes}min`}
                        remaining={fmtRemaining(c.startTime, c.durationMinutes)}
                        manageUrl={c.manageUrl}
                      />
                    ))}
                  </div>
                )}

                {data.activeExams.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
                      Active Exams
                    </div>
                    {data.activeExams.map(e => (
                      <ActiveTile key={e.id}
                        icon={<FileText size={12} color="var(--brand)" />}
                        status="ACTIVE" title={e.title}
                        remaining={fmtRemaining(e.scheduledStartTime, e.durationMinutes)}
                        manageUrl={e.manageUrl}
                      />
                    ))}
                  </div>
                )}

                {data.openTPs.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
                      Open TPs
                    </div>
                    {data.openTPs.map(tp => (
                      <ActiveTile key={tp.id}
                        icon={<FlaskConical size={12} color="var(--success)" />}
                        status="OPEN" title={tp.title}
                        subtitle={tp.deadline ? `Deadline: ${fmtDate(tp.deadline)}` : "No deadline"}
                        manageUrl={tp.manageUrl}
                      />
                    ))}
                  </div>
                )}

                {data.activeCtfs.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
                      Active CTFs
                    </div>
                    {data.activeCtfs.map(c => (
                      <ActiveTile key={c.id}
                        icon={<Flag size={12} color="var(--brand-2)" />}
                        status="ACTIVE" title={c.title}
                        manageUrl={c.manageUrl}
                      />
                    ))}
                  </div>
                )}

                {data.activeCompetitions.length === 0 && data.activeExams.length === 0
                  && data.openTPs.length === 0 && data.activeCtfs.length === 0 && (
                  <div className="psp-empty" style={{ padding: "32px 24px" }}>
                    <Zap size={28} color="var(--ink-3)" style={{ margin: "0 auto 12px" }} />
                    <div className="psp-empty-title">Nothing active right now</div>
                    <div>Create a competition, exam, or TP to get started.</div>
                    <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 14 }}>
                      <button className="psp-btn psp-btn-primary" onClick={() => router.push("/teacher/competitions")}>
                        <Trophy size={12} /> New Competition
                      </button>
                      <button className="psp-btn psp-btn-secondary" onClick={() => router.push("/teacher/exams")}>
                        <FileText size={12} /> New Exam
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Right: Upcoming */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
                  Upcoming (next 7 days)
                </div>
                {upcoming.length === 0 ? (
                  <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "16px 0" }}>Nothing scheduled in the next 7 days.</div>
                ) : upcoming.map((ev, i) => (
                  <Link key={i} href={ev.manageUrl} style={{
                    display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 0",
                    borderBottom: "1px solid var(--border-subtle)", textDecoration: "none",
                    color: "var(--text-primary)",
                  }}>
                    <span style={{ marginTop: 1 }}>{DOMAIN_ICONS[ev.type] ?? <Clock size={13} />}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{fmtDate(ev.startTime)}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.title}</div>
                    </div>
                    <ArrowRight size={11} style={{ flexShrink: 0, marginTop: 3, color: "var(--text-muted)" }} />
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}

        {!loading && error && (
          <div className="psp-alert psp-alert-warn">
            <AlertTriangle size={14} />
            <span>Failed to load dashboard data. <button className="psp-btn psp-btn-secondary psp-btn-sm" onClick={() => { setError(false); setLoading(true); getTeacherDashboardOverview().then(setData).catch(() => setError(true)).finally(() => setLoading(false)); }}>Retry</button></span>
          </div>
        )}
      </div>
    </>
  );
}
