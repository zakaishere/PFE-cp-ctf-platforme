"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import {
  ClipboardList, CheckCircle2, Trophy, Megaphone, Settings, Medal, Code2,
  Zap, FlaskConical, ArrowRight,
} from "lucide-react";
import {
  getStudentProfile, getLeaderboard, getAssessments,
  type StudentProfile, type LeaderboardEntry,
} from "@/lib/api";
import StudentOnboardingModal from "@/features/student/components/StudentOnboardingModal";
import { Avatar, EmptyState, Pill, Button } from "@/components/ui/algora";

const MEDAL_COLORS = ["#f5c451", "#c7cdd9", "#cd8a52"]; // gold, silver, bronze

function greetingForHour(h: number) {
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

// ── Glowing countdown for the live hero ───────────────────────────────────────

function HeroCountdown({ targetIso }: { targetIso: string | null }) {
  const compute = useCallback(() => {
    if (!targetIso) return null;
    const diff = new Date(targetIso).getTime() - Date.now();
    if (diff <= 0) return "00:00:00";
    const h = Math.floor(diff / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    const s = Math.floor((diff % 60_000) / 1_000);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }, [targetIso]);

  const [label, setLabel] = useState<string | null>(compute);
  useEffect(() => {
    setLabel(compute());
    const id = setInterval(() => setLabel(compute()), 1000);
    return () => clearInterval(id);
  }, [compute]);

  if (!label) return <span style={{ fontSize: 13, color: "var(--ink-2)" }}>In progress</span>;
  return (
    <span style={{
      fontFamily: "var(--font-mono), ui-monospace, monospace",
      fontSize: 24, fontWeight: 600, color: "var(--accent)",
      textShadow: "0 0 16px rgba(0,200,150,.5)", letterSpacing: "1px",
    }}>
      {label}
    </span>
  );
}

export default function StudentDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [topStudents, setTopStudents] = useState<LeaderboardEntry[]>([]);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    getStudentProfile()
      .then((p) => {
        setProfile(p);
        if (!p.profileComplete) setShowOnboarding(true);
      })
      .catch(console.error);
    getLeaderboard().then(setTopStudents).catch(console.error);
    getAssessments().then(setAssessments).catch(console.error);
  }, []);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    getStudentProfile().then(setProfile).catch(console.error);
  };

  const firstName = profile?.firstName ?? "…";
  const now = new Date();
  const greeting = greetingForHour(now.getHours());
  const dateLine = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  // Rank derived from the already-loaded leaderboard (no extra fetch)
  const rankIdx = profile ? topStudents.findIndex((u) => u.studentId === profile.userId) : -1;
  const rankLabel = rankIdx >= 0 ? `#${rankIdx + 1}` : "—";
  const pointsLabel = profile?.totalPoints != null ? profile.totalPoints.toLocaleString() : "—";

  // Urgency-first derived data (from existing assessments feed)
  const liveNow = assessments.find((a) => a.status === "LIVE");
  const inProgress = assessments
    .filter((a) => a.type === "OPEN_TP" && a.status === "OPEN")
    .sort((a, b) => {
      const ta = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const tb = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      return ta - tb;
    });

  const stats: { label: string; value: string; accent?: boolean }[] = [
    { label: "Solved",   value: "—", accent: true },
    { label: "Points",   value: pointsLabel },
    { label: "Rank",     value: rankLabel },
    { label: "Contests", value: "—" },
  ];

  const sectionLabel: React.CSSProperties = {
    font: "650 11px var(--font-ui)", letterSpacing: ".07em", textTransform: "uppercase",
    color: "var(--ink-3)", margin: "22px 0 10px",
  };

  const enterLive = () => {
    if (!liveNow) return;
    router.push(liveNow.type === "OPEN_TP" ? `/arena/tp/${liveNow.id}` : `/arena/exam/${liveNow.id}`);
  };

  return (
    <>
      <StudentOnboardingModal open={showOnboarding} onComplete={handleOnboardingComplete} />
      <Navbar />
      <div className="psp-main">

        {/* Greeting */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4, gap: 16 }}>
          <div>
            <div style={{ fontSize: 25, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.02em" }}>
              {greeting}, <span style={{ color: "var(--accent)" }}>{firstName}</span>
            </div>
            <div style={{ fontSize: 14, color: "var(--ink-2)", marginTop: 3 }}>{dateLine}</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button
              className="psp-btn psp-btn-secondary"
              onClick={() => setShowOnboarding(true)}
              title="Update profile"
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <Settings size={13} /> Profile
            </button>
            <Link href="/problems" className="psp-btn psp-btn-secondary"><CheckCircle2 size={13} /> Practice</Link>
            <Link href="/assessments" className="psp-btn psp-btn-primary"><ClipboardList size={13} /> My Assessments</Link>
          </div>
        </div>

        {/* Profile incomplete banner */}
        {profile && !profile.profileComplete && (
          <div className="psp-alert psp-alert-warn" style={{ marginTop: 16, marginBottom: 0 }}>
            <Megaphone size={14} style={{ flexShrink: 0 }} />
            <span>
              Your academic profile is incomplete.{" "}
              <button onClick={() => setShowOnboarding(true)} style={{ background: "none", border: "none", color: "var(--brand)", fontWeight: 600, cursor: "pointer", padding: 0 }}>
                Select your filière and semester →
              </button>
            </span>
          </div>
        )}

        {/* ACTIVE RIGHT NOW — only when something is live */}
        {liveNow && (
          <>
            <div style={sectionLabel}>Active right now</div>
            <div style={{
              position: "relative",
              display: "flex", alignItems: "center", gap: 20,
              padding: "20px 22px",
              background:
                "linear-gradient(90deg, rgba(0,200,150,.05) 0%, transparent 60%), var(--surface)",
              border: "1px solid rgba(0,200,150,.2)",
              borderRadius: "var(--r)",
              overflow: "hidden",
            }}>
              {/* dot grid */}
              <span aria-hidden style={{
                position: "absolute", inset: 0,
                backgroundImage: "radial-gradient(circle, rgba(0,200,150,.06) 1px, transparent 1px)",
                backgroundSize: "24px 24px", pointerEvents: "none",
              }} />
              {/* icon tile */}
              <div style={{
                width: 48, height: 48, borderRadius: 10, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "var(--danger-soft)", position: "relative", zIndex: 1,
              }}>
                <Zap size={22} color="var(--danger)" />
              </div>
              {/* center */}
              <div style={{ flex: 1, minWidth: 0, position: "relative", zIndex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ font: "650 10px var(--font-ui)", letterSpacing: ".1em", textTransform: "uppercase", color: "var(--danger)" }}>
                    {liveNow.type === "LIVE_EXAM" ? "Live Exam" : "Live"}
                  </span>
                  <Pill variant="live">Live</Pill>
                </div>
                <div style={{
                  fontSize: 19, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.02em",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {liveNow.title}
                </div>
                <div style={{ fontSize: 12.5, color: "var(--ink-2)", marginTop: 4, display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {liveNow.moduleName && <span>{liveNow.moduleName}</span>}
                  {(liveNow.problemsCount ?? 0) > 0 && <span>{liveNow.problemsCount} problems</span>}
                </div>
              </div>
              {/* right */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10, flexShrink: 0, position: "relative", zIndex: 1 }}>
                <HeroCountdown targetIso={liveNow.scheduledEndTime ?? null} />
                <Button variant="primary" onClick={enterLive}>
                  Enter arena <ArrowRight size={15} />
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Stats strip */}
        <div style={sectionLabel}>Your stats</div>
        <div className="psp-card" style={{ display: "flex", alignItems: "center", padding: "4px 0", marginBottom: 4 }}>
          {stats.map((s, i) => (
            <div
              key={s.label}
              style={{
                flex: 1, padding: "14px 24px", display: "flex", flexDirection: "column", gap: 5,
                borderRight: i < stats.length - 1 ? "1px solid var(--line-2)" : "none",
              }}
            >
              <div style={{ font: "650 11px var(--font-ui)", letterSpacing: ".07em", textTransform: "uppercase", color: "var(--ink-3)" }}>
                {s.label}
              </div>
              <div style={{ font: "700 20px var(--font-mono)", color: s.accent ? "var(--accent)" : "var(--ink)" }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* IN PROGRESS — open TPs with deadlines */}
        {inProgress.length > 0 && (
          <>
            <div style={sectionLabel}>In progress</div>
            <div className="psp-card">
              {inProgress.map((a, i) => {
                const used = a.attemptsUsed ?? 0;
                const total = a.maxAttempts ?? 0;
                const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
                return (
                  <div key={a.id} style={{
                    display: "flex", alignItems: "center", gap: 14, padding: "12px 16px",
                    borderBottom: i < inProgress.length - 1 ? "1px solid var(--line)" : "none",
                  }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 8, flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: "var(--violet-soft)",
                    }}>
                      <FlaskConical size={18} color="var(--violet)" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {a.title}
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 2 }}>
                        {a.deadline ? `Due ${new Date(a.deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : "No deadline"}
                      </div>
                      {total > 0 && (
                        <div style={{ marginTop: 6, height: 5, background: "var(--bg-2)", borderRadius: 999, overflow: "hidden", maxWidth: 300 }}>
                          <div style={{
                            width: `${pct}%`, height: "100%", background: "var(--accent)",
                            boxShadow: "0 0 8px rgba(0,200,150,.5)", borderRadius: 999,
                          }} />
                        </div>
                      )}
                    </div>
                    <button
                      className="psp-btn psp-btn-secondary"
                      onClick={() => router.push(`/arena/tp/${a.id}`)}
                      style={{ flexShrink: 0 }}
                    >
                      Open
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Leaderboard — real data */}
        <div style={sectionLabel}>Leaderboard</div>
        <div className="psp-card">
          <div className="psp-card-header">
            <span className="psp-card-title" style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <Trophy size={13} color="var(--warn)" /> Top students
            </span>
            <Link href="/leaderboard" style={{ fontSize: 12, color: "var(--brand)" }}>View all</Link>
          </div>
          <div className="psp-scroll">
            {topStudents.slice(0, 5).map((u, i) => {
              const isMe = u.studentId === profile?.userId;
              const ini = `${u.firstName.charAt(0)}${u.lastName.charAt(0)}`.toUpperCase();
              return (
                <div key={u.studentId} style={{
                  display: "flex", alignItems: "center", padding: "9px 14px",
                  borderBottom: "1px solid var(--line)", gap: 10,
                  background: isMe ? "var(--accent-dim)" : undefined,
                  borderLeft: isMe ? "3px solid var(--brand)" : undefined,
                }}>
                  <div style={{ width: 22, display: "flex", justifyContent: "center", alignItems: "center", fontWeight: 700, fontSize: 12 }}>
                    {i < 3 ? <Medal size={15} color={MEDAL_COLORS[i]} /> : <span style={{ color: "var(--ink-3)" }}>{i + 1}</span>}
                  </div>
                  <Avatar initials={ini} size="sm" />
                  <div style={{ flex: 1, fontSize: 12, fontWeight: 500 }}>{isMe ? <strong>You</strong> : `${u.firstName} ${u.lastName}`}</div>
                  <div style={{ fontWeight: 700, color: "var(--brand)", fontSize: 12 }}>{u.totalPoints}</div>
                </div>
              );
            })}
            {topStudents.length === 0 && (
              <EmptyState
                icon={Medal}
                title="No rankings yet"
                description="Solve practice problems to earn points and appear here."
                style={{ padding: "32px 16px" }}
              />
            )}
          </div>
        </div>

        {/* Profile — real data */}
        <div style={sectionLabel}>My profile</div>
        <div className="psp-card">
          <div className="psp-card-header">
            <span className="psp-card-title">Academic details</span>
            <button onClick={() => setShowOnboarding(true)} style={{ fontSize: 12, color: "var(--brand)", background: "none", border: "none", cursor: "pointer" }}>Edit</button>
          </div>
          <div className="psp-card-body">
            {[
              { label: "Apogee Number", val: profile?.apogeeNumber ?? "—" },
              { label: "Filière", val: profile?.divisionName ?? "Not set" },
              { label: "Semester", val: profile?.semesterName ?? "Not set" },
              { label: "Total Points", val: String(profile?.totalPoints ?? 0) },
            ].map((row, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{row.label}</span>
                <strong style={{ color: "var(--text-primary)", fontSize: 13 }}>{row.val}</strong>
              </div>
            ))}
            <Link href="/problems" className="psp-btn psp-btn-secondary" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 4 }}>
              <Code2 size={13} /> Go to Practice
            </Link>
          </div>
        </div>

      </div>
    </>
  );
}
