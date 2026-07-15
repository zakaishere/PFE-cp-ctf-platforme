"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import {
  Trophy, Megaphone, Medal, Code2, Zap, FlaskConical, GraduationCap,
  ArrowRight, ArrowUpRight, CheckCircle2, Flag, Clock, AlertCircle,
  RefreshCw, Target, Award, Hash, Activity,
} from "lucide-react";
import {
  getStudentProfile, getMyProfile, getLeaderboardGlobal, getAssessments,
  type StudentProfile, type UserProfile, type RankedLeaderboardEntry,
} from "@/lib/api";
import StudentOnboardingModal from "@/features/student/components/StudentOnboardingModal";
import { Avatar, EmptyState, Pill, Button } from "@/components/ui/algora";

const MEDAL_COLORS = ["#f5c451", "#c7cdd9", "#cd8a52"]; // gold, silver, bronze

type Load<T> = { status: "loading" | "ready" | "error"; data: T | null };

function greetingForHour(h: number) {
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.round(hr / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// ── Live countdown for the hero ───────────────────────────────────────────────

function HeroCountdown({ targetIso }: { targetIso: string }) {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    const compute = () => {
      const clamped = Math.max(0, new Date(targetIso).getTime() - Date.now());
      const h = Math.floor(clamped / 3_600_000);
      const m = Math.floor((clamped % 3_600_000) / 60_000);
      const s = Math.floor((clamped % 60_000) / 1_000);
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    };
    // First paint via a 0ms timeout so the set never runs synchronously in the
    // effect body; the interval keeps it ticking.
    const t = setTimeout(() => setLabel(compute()), 0);
    const id = setInterval(() => setLabel(compute()), 1000);
    return () => { clearTimeout(t); clearInterval(id); };
  }, [targetIso]);

  if (!label) return null;

  return (
    <span style={{
      fontFamily: "var(--font-mono), ui-monospace, monospace",
      fontSize: 22, fontWeight: 600, color: "var(--accent)",
      textShadow: "0 0 16px rgba(0,255,0,.5)", letterSpacing: "1px",
    }}>
      {label}
    </span>
  );
}

// ── Small reusable bits ───────────────────────────────────────────────────────

function Skel({ w, h, r = 6, style }: { w?: number | string; h: number; r?: number; style?: React.CSSProperties }) {
  return <div className="skel" style={{ width: w ?? "100%", height: h, borderRadius: r, ...style }} />;
}

function SectionError({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <div className="psp-card" style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px" }}>
      <AlertCircle size={18} color="var(--danger)" style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 13, color: "var(--ink-2)" }}>Couldn&apos;t load {label}.</span>
      <button className="psp-btn psp-btn-secondary" onClick={onRetry} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <RefreshCw size={13} /> Retry
      </button>
    </div>
  );
}

const sectionLabel: React.CSSProperties = {
  font: "650 11px var(--font-ui)", letterSpacing: ".07em", textTransform: "uppercase",
  color: "var(--ink-3)", margin: "24px 0 10px",
};

// ── Type/route helpers for assessment items (reuse existing arena routes) ──────

/** The subset of the `/api/assessments` student feed that the dashboard reads. */
interface Item {
  id: string;
  title: string;
  type: "OPEN_TP" | "LIVE_EXAM";
  status: "OPEN" | "LIVE" | "UPCOMING" | "CLOSED" | "DRAFT";
  deadline?: string | null;
  scheduledStartTime?: string | null;
  durationMinutes?: number | null;
  moduleName?: string;
  problemsCount?: number;
}

function itemMeta(a: Item): { chip: "exam" | "tp"; chipText: string; icon: typeof FlaskConical; iconColor: string; iconBg: string } {
  if (a.type === "OPEN_TP") {
    return { chip: "tp", chipText: "TP", icon: FlaskConical, iconColor: "var(--violet)", iconBg: "var(--violet-soft)" };
  }
  return { chip: "exam", chipText: "Exam", icon: GraduationCap, iconColor: "var(--warn)", iconBg: "var(--warn-soft)" };
}

function resumeHref(a: Item): string {
  if (a.type === "OPEN_TP") return `/arena/tp/${a.id}`;
  if (a.status === "LIVE") return `/arena/exam/${a.id}`;
  return `/assessments/${a.id}`; // upcoming exam → waiting room
}

function actionLabel(a: Item): string {
  if (a.type === "OPEN_TP") return "Open";
  if (a.status === "LIVE") return "Enter exam";
  return "View details";
}

function dueLabel(a: Item): string {
  if (a.type === "OPEN_TP") return a.deadline ? `Due ${fmtDateTime(a.deadline)}` : "No deadline";
  if (a.status === "LIVE") return "Live now";
  return a.scheduledStartTime ? `Starts ${fmtDateTime(a.scheduledStartTime)}` : "Scheduled";
}

function urgencyKey(a: Item): number {
  if (a.status === "LIVE") return 0; // live first
  const t = a.type === "OPEN_TP" ? a.deadline : a.scheduledStartTime;
  return t ? new Date(t).getTime() : Number.MAX_SAFE_INTEGER;
}

// ── Activity item rendering ───────────────────────────────────────────────────

function activityIcon(type: string): { icon: typeof CheckCircle2; color: string } {
  switch (type) {
    case "ctf_solve":   return { icon: Flag, color: "var(--accent)" };
    case "competition": return { icon: Trophy, color: "var(--warn)" };
    case "exam":        return { icon: GraduationCap, color: "var(--violet)" };
    default:            return { icon: CheckCircle2, color: "var(--accent)" };
  }
}

export default function StudentDashboard() {
  const router = useRouter();

  const [profile, setProfile] = useState<Load<StudentProfile>>({ status: "loading", data: null });
  const [gam, setGam] = useState<Load<UserProfile>>({ status: "loading", data: null });
  const [board, setBoard] = useState<Load<RankedLeaderboardEntry[]>>({ status: "loading", data: null });
  const [assess, setAssess] = useState<Load<Item[]>>({ status: "loading", data: null });
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Fetchers resolve state inside the async callback (safe in an effect).
  const fetchProfile = useCallback(() => {
    getStudentProfile()
      .then((p) => {
        setProfile({ status: "ready", data: p });
        if (!p.profileComplete) setShowOnboarding(true);
      })
      .catch(() => setProfile((p) => ({ status: "error", data: p.data })));
  }, []);
  const fetchGam = useCallback(() => {
    getMyProfile()
      .then((d) => setGam({ status: "ready", data: d }))
      .catch(() => setGam((p) => ({ status: "error", data: p.data })));
  }, []);
  const fetchBoard = useCallback(() => {
    getLeaderboardGlobal(10)
      .then((d) => setBoard({ status: "ready", data: d }))
      .catch(() => setBoard((p) => ({ status: "error", data: p.data })));
  }, []);
  const fetchAssess = useCallback(() => {
    getAssessments()
      .then((d) => setAssess({ status: "ready", data: d as Item[] }))
      .catch(() => setAssess((p) => ({ status: "error", data: p.data })));
  }, []);

  // Retry handlers (event context) flip back to loading before refetching.
  const loadProfile = useCallback(() => { setProfile((p) => ({ status: "loading", data: p.data })); fetchProfile(); }, [fetchProfile]);
  const loadGam = useCallback(() => { setGam((p) => ({ status: "loading", data: p.data })); fetchGam(); }, [fetchGam]);
  const loadBoard = useCallback(() => { setBoard((p) => ({ status: "loading", data: p.data })); fetchBoard(); }, [fetchBoard]);
  const loadAssess = useCallback(() => { setAssess((p) => ({ status: "loading", data: p.data })); fetchAssess(); }, [fetchAssess]);

  useEffect(() => {
    fetchProfile(); fetchGam(); fetchBoard(); fetchAssess();
  }, [fetchProfile, fetchGam, fetchBoard, fetchAssess]);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    loadProfile();
  };

  const now = new Date();
  const greeting = greetingForHour(now.getHours());
  const dateLine = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const firstName = profile.data?.firstName ?? "";

  // Actionable assessment items, urgency-first.
  const actionable = useMemo(() => {
    const list = assess.data ?? [];
    return list
      .filter((a) =>
        (a.type === "OPEN_TP" && a.status === "OPEN") ||
        (a.type === "LIVE_EXAM" && (a.status === "LIVE" || a.status === "UPCOMING")))
      .sort((a, b) => urgencyKey(a) - urgencyKey(b));
  }, [assess.data]);

  const heroItem = actionable[0] ?? null;
  const inProgress = actionable.slice(1);

  const liveExamEnd = useMemo(() => {
    if (!heroItem || heroItem.type !== "LIVE_EXAM" || heroItem.status !== "LIVE") return null;
    if (!heroItem.scheduledStartTime || heroItem.durationMinutes == null) return null;
    return new Date(new Date(heroItem.scheduledStartTime).getTime() + heroItem.durationMinutes * 60000).toISOString();
  }, [heroItem]);

  // ── Stats (all real, from /api/profile/me) ───────────────────────────────────
  const g = gam.data;
  const stats = [
    { label: "Solved", icon: Target, color: "var(--accent)",
      value: g ? String(g.problemsSolved) : null, accent: true },
    { label: "Points", icon: Award, color: "var(--warn)",
      value: g ? g.globalScore.toLocaleString() : null },
    { label: "Rank", icon: Hash, color: "var(--violet)",
      value: g ? (g.globalRank != null ? `#${g.globalRank}` : "Unranked") : null },
    { label: "CTF Solved", icon: Flag, color: "var(--accent)",
      value: g ? String(g.ctfSolved) : null },
  ];

  const recent = g?.recentActivity ?? [];

  return (
    <>
      <StudentOnboardingModal open={showOnboarding} onComplete={handleOnboardingComplete} />
      <Navbar />
      <div className="psp-main">

        {/* ── Greeting ── */}
        <div style={{ marginBottom: 4 }}>
          <div style={{ font: "600 10px var(--font-mono)", letterSpacing: ".12em", color: "var(--ink-3)", textTransform: "uppercase" }}>
            {dateLine}
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.02em", marginTop: 6 }}>
            {profile.status === "loading" && !profile.data
              ? <Skel w={260} h={30} style={{ display: "inline-block", verticalAlign: "middle" }} />
              : <>{greeting}{firstName && <>, <span style={{ color: "var(--accent)" }}>{firstName}</span></>}</>}
          </div>
        </div>

        {/* Profile incomplete banner (existing feature preserved) */}
        {profile.data && !profile.data.profileComplete && (
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

        {/* ── Continue where you left off ── */}
        <div style={sectionLabel}>Continue where you left off</div>
        {assess.status === "loading" && !assess.data ? (
          <div className="psp-card" style={{ padding: 24 }}>
            <Skel w={140} h={12} />
            <Skel w={320} h={22} style={{ marginTop: 14 }} />
            <Skel w={200} h={12} style={{ marginTop: 10 }} />
            <Skel w={170} h={38} r={10} style={{ marginTop: 20 }} />
          </div>
        ) : assess.status === "error" && !assess.data ? (
          <SectionError label="your work" onRetry={loadAssess} />
        ) : heroItem ? (
          <HeroCard item={heroItem} liveExamEnd={liveExamEnd} onResume={() => router.push(resumeHref(heroItem))} />
        ) : (
          <div className="psp-card sd-hero" style={{ overflow: "hidden", border: "1px solid var(--line-2)" }}>
            <div style={{ padding: "26px 28px" }}>
              <div style={{ font: "650 10px var(--font-mono)", letterSpacing: ".12em", color: "var(--accent)", textTransform: "uppercase" }}>
                Ready when you are
              </div>
              <h2 style={{ margin: "12px 0 4px", fontSize: 24, letterSpacing: "-0.03em", color: "var(--ink)" }}>
                No active exams or TPs
              </h2>
              <p style={{ margin: 0, color: "var(--ink-2)", fontSize: 13.5 }}>
                Keep your skills sharp — jump into the practice problem set.
              </p>
              <div style={{ marginTop: 22 }}>
                <Button variant="primary" onClick={() => router.push("/problems")}>
                  Continue practice <ArrowRight size={15} />
                </Button>
              </div>
            </div>
            <div className="sd-hero-art" style={{
              display: "grid", placeItems: "center",
              background: "radial-gradient(circle, rgba(0,255,0,.10), transparent 62%)",
            }}>
              <Code2 size={72} color="var(--accent)" style={{ opacity: 0.5 }} />
            </div>
          </div>
        )}

        {/* ── Stats ── */}
        <div style={sectionLabel}>Your stats</div>
        <div className="sd-stats">
          {stats.map((s) => (
            <div key={s.label} className="psp-card sd-lift" style={{ display: "flex", alignItems: "center", gap: 14, padding: 16 }}>
              <span style={{
                width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                display: "grid", placeItems: "center", background: s.color === "var(--warn)" ? "var(--warn-soft)" : s.color === "var(--violet)" ? "var(--violet-soft)" : "var(--accent-dim)",
              }}>
                <s.icon size={19} color={s.color} />
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ font: "650 10px var(--font-mono)", letterSpacing: ".07em", textTransform: "uppercase", color: "var(--ink-3)" }}>
                  {s.label}
                </div>
                {gam.status === "loading" && !gam.data ? (
                  <Skel w={54} h={22} style={{ marginTop: 6 }} />
                ) : gam.status === "error" && !gam.data ? (
                  <button onClick={loadGam} title="Retry" style={{ marginTop: 4, background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--ink-3)", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12 }}>
                    <RefreshCw size={12} /> Retry
                  </button>
                ) : (
                  <div style={{ font: "700 22px var(--font-mono)", color: s.accent ? "var(--accent)" : "var(--ink)", marginTop: 2, letterSpacing: "-0.02em" }}>
                    {s.value}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ── Two-column content ── */}
        <div className="sd-grid" style={{ marginTop: 8 }}>
          {/* LEFT */}
          <div className="sd-col">
            {/* In progress */}
            <div>
              <div style={{ ...sectionLabel, margin: "0 0 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>In progress</span>
                <Link href="/assessments" style={{ fontSize: 11, color: "var(--brand)", textTransform: "none", letterSpacing: 0, fontWeight: 500 }}>
                  View all →
                </Link>
              </div>
              {assess.status === "loading" && !assess.data ? (
                <div className="psp-card" style={{ padding: 16, display: "grid", gap: 14 }}>
                  {[0, 1].map((i) => <Skel key={i} h={44} />)}
                </div>
              ) : assess.status === "error" && !assess.data ? (
                <SectionError label="your work" onRetry={loadAssess} />
              ) : inProgress.length > 0 ? (
                <div className="psp-card" style={{ overflow: "hidden" }}>
                  {inProgress.map((a, i) => {
                    const m = itemMeta(a);
                    return (
                      <div
                        key={a.id}
                        className="sd-row-hover"
                        onClick={() => router.push(resumeHref(a))}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === "Enter") router.push(resumeHref(a)); }}
                        style={{
                          display: "flex", alignItems: "center", gap: 14, padding: "13px 16px", cursor: "pointer",
                          borderBottom: i < inProgress.length - 1 ? "1px solid var(--line)" : "none",
                        }}
                      >
                        <span style={{ width: 38, height: 38, borderRadius: 9, flexShrink: 0, display: "grid", placeItems: "center", background: m.iconBg }}>
                          <m.icon size={18} color={m.iconColor} />
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                            <Pill variant={m.chip} noDot>{m.chipText}</Pill>
                            {a.status === "LIVE" && <Pill variant="live">Live</Pill>}
                            <span style={{ fontSize: 11.5, color: a.status === "LIVE" ? "var(--danger)" : "var(--ink-3)" }}>{dueLabel(a)}</span>
                          </div>
                          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {a.title}
                          </div>
                        </div>
                        <span className="psp-btn psp-btn-secondary" style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6, pointerEvents: "none" }}>
                          {actionLabel(a)} <ArrowRight size={13} />
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="psp-card">
                  <EmptyState
                    icon={FlaskConical}
                    title={heroItem ? "Nothing else in progress" : "No exams or TPs assigned"}
                    description={heroItem ? "You're all caught up on assigned work." : "Assigned exams and TPs will appear here."}
                    style={{ padding: "34px 16px" }}
                  />
                </div>
              )}
            </div>

            {/* Recent activity */}
            <div>
              <div style={{ ...sectionLabel, margin: "0 0 10px" }}>Recent activity</div>
              {gam.status === "loading" && !gam.data ? (
                <div className="psp-card" style={{ padding: 16, display: "grid", gap: 14 }}>
                  {[0, 1, 2].map((i) => <Skel key={i} h={34} />)}
                </div>
              ) : gam.status === "error" && !gam.data ? (
                <SectionError label="recent activity" onRetry={loadGam} />
              ) : recent.length > 0 ? (
                <div className="psp-card" style={{ overflow: "hidden" }}>
                  {recent.slice(0, 6).map((act, i) => {
                    const ai = activityIcon(act.type);
                    return (
                      <div key={i} style={{
                        display: "flex", alignItems: "center", gap: 12, padding: "11px 16px",
                        borderBottom: i < Math.min(recent.length, 6) - 1 ? "1px solid var(--line)" : "none",
                      }}>
                        <ai.icon size={16} color={ai.color} style={{ flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {act.title}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>
                            {[act.category, act.difficulty].filter(Boolean).join(" · ") || relTime(act.timestamp)}
                          </div>
                        </div>
                        {act.points > 0 && (
                          <span style={{ font: "700 12px var(--font-mono)", color: "var(--accent)", flexShrink: 0 }}>+{act.points}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="psp-card">
                  <EmptyState
                    icon={Activity}
                    title="No activity yet"
                    description="Solve a problem or join a contest to see your history here."
                    style={{ padding: "34px 16px" }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* RIGHT */}
          <div className="sd-col">
            {/* Leaderboard */}
            <div className="psp-card" style={{ overflow: "hidden" }}>
              <div className="psp-card-header">
                <span className="psp-card-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Trophy size={13} color="var(--warn)" /> Leaderboard
                </span>
                <Link href="/leaderboard" style={{ fontSize: 12, color: "var(--brand)" }}>View all</Link>
              </div>
              {board.status === "loading" && !board.data ? (
                <div style={{ padding: 14, display: "grid", gap: 12 }}>
                  {[0, 1, 2, 3].map((i) => <Skel key={i} h={30} />)}
                </div>
              ) : board.status === "error" && !board.data ? (
                <div style={{ padding: 14 }}><SectionError label="the leaderboard" onRetry={loadBoard} /></div>
              ) : (board.data ?? []).length > 0 ? (
                <div>
                  {(board.data ?? []).slice(0, 6).map((u, i) => {
                    const isMe = u.userId === profile.data?.userId;
                    const ini = (u.fullName || u.username || "?").split(" ").map((p) => p.charAt(0)).slice(0, 2).join("");
                    return (
                      <div key={u.userId} style={{
                        display: "flex", alignItems: "center", padding: "9px 14px", gap: 10,
                        borderBottom: i < Math.min((board.data ?? []).length, 6) - 1 ? "1px solid var(--line)" : "none",
                        background: isMe ? "var(--accent-dim)" : undefined,
                        borderLeft: isMe ? "3px solid var(--brand)" : "3px solid transparent",
                      }}>
                        <div style={{ width: 20, display: "grid", placeItems: "center", fontWeight: 700, fontSize: 12 }}>
                          {u.rank <= 3 ? <Medal size={15} color={MEDAL_COLORS[u.rank - 1]} /> : <span style={{ color: "var(--ink-3)" }}>{u.rank}</span>}
                        </div>
                        <Avatar initials={ini} size="sm" />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {isMe ? "You" : u.fullName || u.username}
                          </div>
                          <div style={{ fontSize: 10.5, color: "var(--ink-3)", marginTop: 1 }}>{u.solved} solved</div>
                        </div>
                        <div style={{ font: "700 12px var(--font-mono)", color: "var(--accent)", flexShrink: 0 }}>{u.score.toLocaleString()}</div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  icon={Medal}
                  title="No rankings yet"
                  description="Solve problems to earn points and appear here."
                  style={{ padding: "30px 16px" }}
                />
              )}
            </div>

            {/* Academic profile */}
            <div className="psp-card">
              <div className="psp-card-header">
                <span className="psp-card-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <GraduationCap size={13} color="var(--violet)" /> Academic profile
                </span>
                <Link href="/profile" style={{ fontSize: 12, color: "var(--brand)" }}>Edit</Link>
              </div>
              <div className="psp-card-body">
                {profile.status === "loading" && !profile.data ? (
                  <div style={{ display: "grid", gap: 12 }}>{[0, 1, 2].map((i) => <Skel key={i} h={16} />)}</div>
                ) : profile.status === "error" && !profile.data ? (
                  <SectionError label="your profile" onRetry={loadProfile} />
                ) : (
                  <>
                    {[
                      { label: "Apogée", val: profile.data?.apogeeNumber || "—" },
                      { label: "Filière", val: profile.data?.divisionName || "Not set" },
                      { label: "Semester", val: profile.data?.semesterName || "Not set" },
                    ].map((row) => (
                      <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 11 }}>
                        <span style={{ fontSize: 12.5, color: "var(--ink-3)" }}>{row.label}</span>
                        <strong style={{ color: "var(--ink)", fontSize: 12.5, fontWeight: 600 }}>{row.val}</strong>
                      </div>
                    ))}
                    <Link href="/profile" className="psp-btn psp-btn-secondary" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                      View full profile <ArrowUpRight size={13} />
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Hero card ─────────────────────────────────────────────────────────────────

function HeroCard({ item, liveExamEnd, onResume }: { item: Item; liveExamEnd: string | null; onResume: () => void }) {
  const m = itemMeta(item);
  const isLive = item.status === "LIVE";
  return (
    <div className="psp-card sd-hero" style={{ overflow: "hidden", position: "relative", border: isLive ? "1px solid var(--accent-ring)" : "1px solid var(--line-2)" }}>
      {/* dot grid */}
      <span aria-hidden style={{
        position: "absolute", inset: 0,
        backgroundImage: "radial-gradient(circle, rgba(0,255,0,.05) 1px, transparent 1px)",
        backgroundSize: "24px 24px", pointerEvents: "none",
      }} />
      <div style={{ padding: "26px 28px", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span aria-hidden style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)", boxShadow: "0 0 10px var(--accent)" }} />
          <span style={{ font: "650 10px var(--font-mono)", letterSpacing: ".12em", color: "var(--accent)", textTransform: "uppercase" }}>
            Continue where you left off
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "16px 0 6px" }}>
          <Pill variant={m.chip} noDot>{m.chipText}</Pill>
          {isLive && <Pill variant="live">Live</Pill>}
        </div>
        <h2 style={{ margin: "0 0 4px", fontSize: 25, letterSpacing: "-0.03em", color: "var(--ink)", lineHeight: 1.15 }}>
          {item.title}
        </h2>
        <p style={{ margin: 0, color: "var(--ink-2)", fontSize: 13, display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
          {item.moduleName && <span>{item.moduleName}</span>}
          {(item.problemsCount ?? 0) > 0 && <span>{item.problemsCount} problems</span>}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: isLive ? "var(--danger)" : "var(--ink-2)" }}>
            <Clock size={13} /> {dueLabel(item)}
          </span>
        </p>
        <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <Button variant="primary" onClick={onResume}>
            {actionLabel(item)} <ArrowRight size={15} />
          </Button>
          {liveExamEnd && <HeroCountdown targetIso={liveExamEnd} />}
        </div>
      </div>
      <div className="sd-hero-art" style={{
        display: "grid", placeItems: "center", position: "relative", zIndex: 1,
        background: "radial-gradient(circle, rgba(0,255,0,.10), transparent 62%)",
      }}>
        {isLive ? <Zap size={72} color="var(--accent)" style={{ opacity: 0.55 }} /> : <m.icon size={72} color={m.iconColor} style={{ opacity: 0.5 }} />}
      </div>
    </div>
  );
}
