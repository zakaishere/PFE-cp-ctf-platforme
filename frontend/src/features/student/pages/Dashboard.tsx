"use client";

import { useState, useEffect } from "react";
import { APP_NAME } from "@/lib/brand";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { ClipboardList, CheckCircle2, Trophy, Megaphone, Settings, Medal, Code2 } from "lucide-react";
import { getStudentProfile, getLeaderboard, type StudentProfile, type LeaderboardEntry } from "@/lib/api";
import StudentOnboardingModal from "@/features/student/components/StudentOnboardingModal";
import { Avatar, EmptyState } from "@/components/ui/algora";

const MEDAL_COLORS = ["#f5c451", "#c7cdd9", "#cd8a52"]; // gold, silver, bronze

function greetingForHour(h: number) {
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function StudentDashboard() {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [topStudents, setTopStudents] = useState<LeaderboardEntry[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    getStudentProfile()
      .then((p) => {
        setProfile(p);
        if (!p.profileComplete) setShowOnboarding(true);
      })
      .catch(console.error);
    getLeaderboard().then(setTopStudents).catch(console.error);
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

  const stats: { label: string; value: string }[] = [
    { label: "Solved",   value: "—" },         // no submissions feed wired to this page
    { label: "Points",   value: pointsLabel },
    { label: "Rank",     value: rankLabel },
    { label: "Contests", value: "—" },          // no contest-history source on this page
  ];

  const sectionLabel: React.CSSProperties = {
    font: "650 11px var(--font)", letterSpacing: ".07em", textTransform: "uppercase",
    color: "var(--ink-3)", margin: "22px 0 10px",
  };

  return (
    <>
      <StudentOnboardingModal open={showOnboarding} onComplete={handleOnboardingComplete} />
      <Navbar />
      <div className="psp-main">

        {/* Greeting */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4, gap: 16 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.02em" }}>
              {greeting}, {firstName}
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

        {/*
          Urgency sections (Active right now / Coming up / In progress) are skipped:
          this page fetches only profile + leaderboard, and per the brief these
          sections render nothing when there is no live/upcoming data to show.
        */}

        {/* Stats strip — compact, secondary to urgency */}
        <div style={sectionLabel}>Your stats</div>
        <div className="psp-card" style={{ display: "flex", alignItems: "center", padding: "4px 0", marginBottom: 4 }}>
          {stats.map((s, i) => (
            <div
              key={s.label}
              style={{
                flex: 1, padding: "14px 24px", display: "flex", flexDirection: "column", gap: 5,
                borderRight: i < stats.length - 1 ? "1px solid var(--line)" : "none",
              }}
            >
              <div style={{ font: "650 11px var(--font)", letterSpacing: ".07em", textTransform: "uppercase", color: "var(--ink-3)" }}>
                {s.label}
              </div>
              <div style={{ font: "700 20px var(--mono)", color: "var(--ink)" }}>{s.value}</div>
            </div>
          ))}
        </div>

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
                  background: isMe ? "var(--accent-soft)" : undefined,
                  borderLeft: isMe ? "3px solid var(--brand)" : undefined,
                }}>
                  <div style={{ width: 22, display: "flex", justifyContent: "center", alignItems: "center", fontWeight: 700, fontSize: 12 }}>
                    {i < 3 ? <Medal size={15} color={MEDAL_COLORS[i]} /> : <span style={{ color: "var(--text-muted)" }}>{i + 1}</span>}
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
