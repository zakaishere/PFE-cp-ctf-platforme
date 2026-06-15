"use client";

import { useState, useEffect } from "react";
import { APP_NAME } from "@/lib/brand";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { ClipboardList, CheckCircle2, Trophy, Star, Megaphone, Settings, Medal } from "lucide-react";
import { getStudentProfile, getLeaderboard, type StudentProfile, type LeaderboardEntry } from "@/lib/api";
import StudentOnboardingModal from "@/features/student/components/StudentOnboardingModal";

const MEDAL_COLORS = ["#f5c451", "#c7cdd9", "#cd8a52"]; // gold, silver, bronze
const AVATAR_COLORS = ["var(--brand)","#6554c0","#00875a","var(--warn)","#ff5630","#36b37e","#00b8d9","#de350b"];

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
  const subtitle = [profile?.divisionName, profile?.semesterName].filter(Boolean).join(" · ") || "Profile incomplete";

  return (
    <>
      <StudentOnboardingModal open={showOnboarding} onComplete={handleOnboardingComplete} />
      <Navbar />
      <div className="psp-breadcrumb">
        <Link href="/dashboard">{APP_NAME}</Link> ›{" "}
        <span style={{ color: "var(--text-primary)" }}>Dashboard</span>
      </div>
      <div className="psp-main">

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)" }}>Welcome back, {firstName}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>{subtitle}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
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
          <div className="psp-alert psp-alert-warn" style={{ marginBottom: 16 }}>
            <Megaphone size={14} style={{ flexShrink: 0 }} />
            <span>
              Your academic profile is incomplete.{" "}
              <button onClick={() => setShowOnboarding(true)} style={{ background: "none", border: "none", color: "var(--brand)", fontWeight: 600, cursor: "pointer", padding: 0 }}>
                Select your filière and semester →
              </button>
            </span>
          </div>
        )}

        {/* Stats */}
        <div className="psp-stats">
          <div className="psp-stat-card">
            <div className="psp-stat-icon ic-blue"><ClipboardList size={20} /></div>
            <div><div className="psp-stat-val">—</div><div className="psp-stat-lbl">Active Assessments</div></div>
          </div>
          <div className="psp-stat-card">
            <div className="psp-stat-icon ic-green"><CheckCircle2 size={20} /></div>
            <div><div className="psp-stat-val">—</div><div className="psp-stat-lbl">Problems Solved</div></div>
          </div>
          <div className="psp-stat-card">
            <div className="psp-stat-icon ic-purple"><Trophy size={20} /></div>
            <div><div className="psp-stat-val">—</div><div className="psp-stat-lbl">Your Rank</div></div>
          </div>
          <div className="psp-stat-card">
            <div className="psp-stat-icon ic-orange"><Star size={20} /></div>
            <div><div className="psp-stat-val">{profile?.totalPoints ?? "—"}</div><div className="psp-stat-lbl">Total Points</div></div>
          </div>
        </div>

        {/* Two-col layout */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>
          <div>
            {/* Assessments */}
            <div className="psp-card">
              <div className="psp-card-header">
                <span className="psp-card-title">Assessments</span>
                <Link href="/assessments" style={{ fontSize: 12, color: "var(--brand)" }}>View all</Link>
              </div>
              <div style={{ padding: "24px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                Visit <Link href="/assessments" style={{ color: "var(--brand)" }}>Assessments</Link> to see your exams and TPs.
              </div>
            </div>

            {/* Submissions placeholder */}
            <div className="psp-card">
              <div className="psp-card-header"><span className="psp-card-title">Recent Submissions</span></div>
              <div style={{ padding: "24px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                Visit <Link href="/problems" style={{ color: "var(--brand)" }}>Problems</Link> to practice and submit solutions.
              </div>
            </div>
          </div>

          {/* Right col */}
          <div>
            {/* Top Leaderboard */}
            <div className="psp-card" style={{ marginBottom: 14 }}>
              <div className="psp-card-header">
                <span className="psp-card-title" style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <Trophy size={13} color="var(--warn)" /> Leaderboard
                </span>
                <Link href="/leaderboard" style={{ fontSize: 11, color: "var(--brand)" }}>View All</Link>
              </div>
              <div className="psp-scroll">
                {topStudents.slice(0, 5).map((u, i) => {
                  const isMe = u.studentId === profile?.userId;
                  const ini = `${u.firstName.charAt(0)}${u.lastName.charAt(0)}`.toUpperCase();
                  const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
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
                      <div style={{ width: 26, height: 26, borderRadius: "50%", background: color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "white", flexShrink: 0 }}>
                        {ini}
                      </div>
                      <div style={{ flex: 1, fontSize: 12, fontWeight: 500 }}>{isMe ? <strong>You</strong> : `${u.firstName} ${u.lastName}`}</div>
                      <div style={{ fontWeight: 700, color: "var(--brand)", fontSize: 12 }}>{u.totalPoints}</div>
                    </div>
                  );
                })}
                {topStudents.length === 0 && (
                  <div style={{ padding: 16, fontSize: 12, color: "var(--text-muted)" }}>No data yet.</div>
                )}
              </div>
            </div>

            {/* Profile card */}
            <div className="psp-card">
              <div className="psp-card-header">
                <span className="psp-card-title">My Profile</span>
                <button onClick={() => setShowOnboarding(true)} style={{ fontSize: 11, color: "var(--brand)", background: "none", border: "none", cursor: "pointer" }}>Edit</button>
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
