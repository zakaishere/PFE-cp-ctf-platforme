"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import {
  Activity, Calendar, Timer, RefreshCw, Users, FileText,
  CheckCircle2, XCircle, Clock, Loader2, ChevronRight,
} from "lucide-react";
import { getAssessments, getExamSubmissions, closeLiveExam } from "@/lib/api";
import { toast } from "@/components/ui/PSPToast";

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

function fmtDuration(mins: number) {
  if (!mins) return "—";
  const h = Math.floor(mins / 60), m = mins % 60;
  return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

function getRemainingMs(startIso: string | null | undefined, durationMins: number): number {
  if (!startIso) return 0;
  const end = new Date(startIso).getTime() + durationMins * 60_000;
  return end - Date.now();
}

function fmtRemaining(ms: number): string {
  if (ms <= 0) return "Ended";
  const secs = Math.floor(ms / 1000);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function examPhase(startIso: string | null | undefined, durationMins: number, isClosed: boolean): "upcoming" | "live" | "ended" {
  if (isClosed) return "ended";
  if (!startIso) return "upcoming";
  const start = new Date(startIso).getTime();
  const end = start + durationMins * 60_000;
  const now = Date.now();
  if (now < start) return "upcoming";
  if (now < end) return "live";
  return "ended";
}

// ── Countdown ticker ──────────────────────────────────────────────────────────

function Countdown({ startIso, durationMins }: { startIso: string; durationMins: number }) {
  const [ms, setMs] = useState(() => getRemainingMs(startIso, durationMins));

  useEffect(() => {
    const id = setInterval(() => setMs(getRemainingMs(startIso, durationMins)), 1000);
    return () => clearInterval(id);
  }, [startIso, durationMins]);

  const isUrgent = ms > 0 && ms < 5 * 60_000;
  return (
    <span style={{ fontFamily: "monospace", fontWeight: 700, color: isUrgent ? "#de350b" : "#172b4d", fontSize: 15 }}>
      {fmtRemaining(ms)}
    </span>
  );
}

// ── Submission stats ──────────────────────────────────────────────────────────

function submissionStats(subs: any[]) {
  const total = subs.length;
  const passed = subs.filter(s => s.status === "PASS" || s.status === "ACCEPTED" || s.status === "COMPLETED").length;
  const pending = subs.filter(s => s.status === "PENDING").length;
  const failed = total - passed - pending;
  const uniqueStudents = new Set(subs.map(s => s.studentId)).size;
  return { total, passed, pending, failed: Math.max(0, failed), uniqueStudents };
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function LiveExamMonitor() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [subLoading, setSubLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [closing, setClosing] = useState(false);

  // Load teacher's live exams
  useEffect(() => {
    setLoading(true);
    getAssessments()
      .then(data => {
        const liveExams = data.filter((a: any) => a.type === "LIVE_EXAM");
        setExams(liveExams);
        if (liveExams.length > 0 && !selected) {
          const first = liveExams.find((e: any) => examPhase(e.scheduledStartTime, e.durationMinutes, e.isClosed) === "live") ?? liveExams[0];
          setSelected(first);
        }
      })
      .catch(() => toast.error("Failed to load exams"))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchSubmissions = useCallback(async (exam: any) => {
    if (!exam) return;
    const id = exam.id || exam.assessmentId;
    setSubLoading(true);
    try {
      const data = await getExamSubmissions(id);
      setSubmissions(Array.isArray(data) ? data : data.content || []);
      setLastRefreshed(new Date());
    } catch {
      // silent — auto-refresh should not pop toasts
    } finally {
      setSubLoading(false);
    }
  }, []);

  // Fetch on select change
  useEffect(() => {
    setSubmissions([]);
    fetchSubmissions(selected);
  }, [selected, fetchSubmissions]);

  // Auto-refresh every 15s when exam is live
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!selected || !autoRefresh) return;
    const phase = examPhase(selected.scheduledStartTime, selected.durationMinutes, selected.isClosed);
    if (phase !== "live") return;
    intervalRef.current = setInterval(() => fetchSubmissions(selected), 15_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [selected, autoRefresh, fetchSubmissions]);

  const handleClose = async () => {
    if (!selected) return;
    const id = selected.id || selected.assessmentId;
    setClosing(true);
    try {
      await closeLiveExam(id);
      toast.success("Exam closed");
      setExams(prev => prev.map(e => (e.id || e.assessmentId) === id ? { ...e, isClosed: true } : e));
      setSelected((s: any) => s ? { ...s, isClosed: true } : s);
    } catch (e) {
      toast.error("Failed to close", e instanceof Error ? e.message : undefined);
    }
    setClosing(false);
  };

  // Group submissions by student
  const byStudent = submissions.reduce((acc: Record<string, any[]>, s: any) => {
    const key = s.studentId || "unknown";
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  const stats = submissionStats(submissions);
  const phase = selected ? examPhase(selected.scheduledStartTime, selected.durationMinutes, selected.isClosed) : "upcoming";

  return (
    <>
      <Navbar />
      <div className="mgr-shell">
        {/* ── LEFT: exam list ── */}
        <div className="mgr-left">
          <div className="mgr-left-header">
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Live Exams</span>
            <span className="psp-badge b-live" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span className="psp-dot d-red d-blink" /> Monitor
            </span>
          </div>

          <div className="mgr-list">
            {loading ? (
              Array(3).fill(0).map((_, i) => (
                <div key={i} className="mgr-skel-item">
                  <div className="skel mgr-skel-line" style={{ width: "70%" }} />
                  <div className="skel mgr-skel-line" style={{ width: "40%" }} />
                </div>
              ))
            ) : exams.length === 0 ? (
              <div className="psp-empty" style={{ padding: "32px 14px" }}>
                <Activity size={24} color="#97a0af" style={{ margin: "0 auto 8px" }} />
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>No live exams</div>
              </div>
            ) : exams.map(exam => {
              const id = exam.id || exam.assessmentId;
              const isSelected = selected && (selected.id || selected.assessmentId) === id;
              const p = examPhase(exam.scheduledStartTime, exam.durationMinutes, exam.isClosed);
              return (
                <div
                  key={id}
                  className={`mgr-list-item${isSelected ? " active" : ""}`}
                  onClick={() => { setSelected(exam); setSubmissions([]); }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                      {exam.title}
                    </span>
                    {p === "live" && (
                      <span className="psp-badge b-live" style={{ display: "inline-flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                        <span className="psp-dot d-red d-blink" style={{ width: 5, height: 5 }} /> LIVE
                      </span>
                    )}
                    {p === "upcoming" && <span className="psp-badge b-pending" style={{ flexShrink: 0 }}>Upcoming</span>}
                    {p === "ended" && <span className="psp-badge" style={{ background: "var(--bg-secondary)", color: "var(--text-subtle)", flexShrink: 0 }}>Ended</span>}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-subtle)" }}>
                    <Calendar size={9} style={{ display: "inline", marginRight: 3 }} />
                    {fmtDate(exam.scheduledStartTime)}
                    {exam.durationMinutes ? <span style={{ marginLeft: 8 }}><Timer size={9} style={{ display: "inline", marginRight: 3 }} />{fmtDuration(exam.durationMinutes)}</span> : null}
                  </div>
                  {exam.moduleName && (
                    <div style={{ fontSize: 11, color: "var(--text-subtle)", marginTop: 2 }}>{exam.moduleName}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── CENTER: monitor panel ── */}
        <div className="mgr-center">
          {!selected ? (
            <div className="psp-empty" style={{ marginTop: 80 }}>
              <Activity size={36} color="var(--border)" style={{ margin: "0 auto 12px" }} />
              <div className="psp-empty-title">Select an exam to monitor</div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div style={{ background: "var(--bg-primary)", borderBottom: "1px solid var(--border)", padding: "14px 20px", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>{selected.title}</div>
                    <div style={{ display: "flex", gap: 12, marginTop: 4, fontSize: 12, color: "var(--text-muted)" }}>
                      <span><Calendar size={11} style={{ display: "inline", marginRight: 3 }} />{fmtDate(selected.scheduledStartTime)}</span>
                      {selected.durationMinutes && <span><Timer size={11} style={{ display: "inline", marginRight: 3 }} />{fmtDuration(selected.durationMinutes)}</span>}
                      {selected.moduleName && <span>{selected.moduleName}</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {phase === "live" && selected.scheduledStartTime && (
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Time remaining</div>
                        <Countdown startIso={selected.scheduledStartTime} durationMins={selected.durationMinutes || 0} />
                      </div>
                    )}
                    <button
                      className="psp-btn psp-btn-secondary psp-btn-sm"
                      style={{ display: "flex", alignItems: "center", gap: 5 }}
                      disabled={subLoading}
                      onClick={() => fetchSubmissions(selected)}
                    >
                      <RefreshCw size={11} className={subLoading ? "animate-spin" : ""} /> Refresh
                    </button>
                    {phase === "live" && !selected.isClosed && (
                      <button
                        className="psp-btn psp-btn-danger psp-btn-sm"
                        onClick={handleClose}
                        disabled={closing}
                      >
                        {closing ? <Loader2 size={11} /> : null} Close Exam
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats row */}
              <div style={{ background: "var(--bg-primary)", borderBottom: "1px solid var(--border)", display: "flex", flexShrink: 0 }}>
                {[
                  { icon: <Users size={13} />, label: "Students", val: stats.uniqueStudents, color: "var(--brand)" },
                  { icon: <FileText size={13} />, label: "Total Subs", val: stats.total, color: "var(--text-primary)" },
                  { icon: <CheckCircle2 size={13} />, label: "Passed", val: stats.passed, color: "#00875a" },
                  { icon: <XCircle size={13} />, label: "Failed", val: stats.failed, color: "#de350b" },
                  { icon: <Clock size={13} />, label: "Pending", val: stats.pending, color: "#974f0c" },
                ].map(s => (
                  <div key={s.label} style={{ flex: 1, padding: "10px 16px", textAlign: "center", borderRight: "1px solid #f4f5f7" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, color: s.color, marginBottom: 2 }}>
                      {s.icon}
                      <span style={{ fontSize: 18, fontWeight: 700 }}>{s.val}</span>
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-subtle)", textTransform: "uppercase", letterSpacing: "0.4px" }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Auto-refresh toggle + last-refreshed */}
              <div style={{ background: "var(--bg-tertiary)", borderBottom: "1px solid var(--border)", padding: "6px 20px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                <div
                  style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", userSelect: "none" }}
                  onClick={() => setAutoRefresh(v => !v)}
                >
                  <div className={`psp-toggle${autoRefresh && phase === "live" ? " on" : ""}`} style={{ width: 28, height: 16 }}>
                    <div className="psp-toggle-knob" style={{ width: 12, height: 12, top: 2 }} />
                  </div>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    Auto-refresh {phase === "live" ? "(every 15s)" : "(exam not live)"}
                  </span>
                </div>
                {lastRefreshed && (
                  <span style={{ fontSize: 11, color: "var(--text-subtle)", marginLeft: "auto" }}>
                    Last refreshed: {lastRefreshed.toLocaleTimeString()}
                  </span>
                )}
              </div>

              {/* Phase alerts */}
              <div style={{ padding: "0 20px", flexShrink: 0, marginTop: 14 }}>
                {phase === "upcoming" && (
                  <div className="psp-alert psp-alert-info">
                    <Calendar size={14} />
                    <span>Exam hasn't started yet — monitoring will activate once it begins.</span>
                  </div>
                )}
                {phase === "ended" && (
                  <div className="psp-alert psp-alert-warn">
                    <XCircle size={14} />
                    <span>This exam has ended. Submissions are read-only.</span>
                  </div>
                )}
                {phase === "live" && (
                  <div className="psp-alert psp-alert-success" style={{ marginBottom: 0 }}>
                    <span className="psp-dot d-red d-blink" />
                    <span>Exam is <strong>live</strong> — submissions update every 15 seconds.</span>
                  </div>
                )}
              </div>

              {/* Submissions body */}
              <div className="mgr-center-body" style={{ paddingTop: 14 }}>
                {subLoading && submissions.length === 0 ? (
                  <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
                    <Loader2 size={22} style={{ animation: "spin 1s linear infinite", color: "var(--brand)" }} />
                  </div>
                ) : submissions.length === 0 ? (
                  <div className="psp-empty" style={{ border: "1px solid var(--border)", borderRadius: 3, background: "var(--bg-primary)" }}>
                    <FileText size={28} color="var(--border)" style={{ margin: "0 auto 8px" }} />
                    <div className="psp-empty-title">No submissions yet</div>
                    <div style={{ fontSize: 12, color: "var(--text-subtle)", marginTop: 4 }}>Submissions will appear here as students submit code</div>
                  </div>
                ) : (
                  <>
                    {/* Per-student summary */}
                    {Object.entries(byStudent).map(([studentId, subs]: [string, any[]]) => {
                      const passed = subs.filter(s => s.status === "PASS" || s.status === "ACCEPTED" || s.status === "COMPLETED").length;
                      return (
                        <div key={studentId} className="mgr-section" style={{ marginBottom: 10 }}>
                          <div className="mgr-section-title" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div className="req-avatar" style={{ width: 24, height: 24, fontSize: 10 }}>
                                {studentId.slice(0, 2).toUpperCase()}
                              </div>
                              <span style={{ fontSize: 12, color: "var(--text-primary)" }}>
                                {subs[0]?.studentName || `Student ${studentId.slice(0, 8)}`}
                              </span>
                            </div>
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{subs.length} submission{subs.length !== 1 ? "s" : ""}</span>
                              <span className={`psp-badge ${passed > 0 ? "b-pass" : "b-pending"}`} style={{ fontSize: 10 }}>
                                {passed}/{subs.length} passed
                              </span>
                            </div>
                          </div>
                          <table className="psp-table" style={{ background: "var(--bg-primary)" }}>
                            <thead>
                              <tr>
                                <th>Problem</th>
                                <th>Status</th>
                                <th>Language</th>
                                <th className="text-right">Score</th>
                              </tr>
                            </thead>
                            <tbody>
                              {subs.map((s: any, i: number) => (
                                <tr key={s.submissionId || i}>
                                  <td style={{ color: "var(--text-muted)", fontSize: 12 }}>{s.problemTitle || s.problemId?.slice(0, 8) || "—"}</td>
                                  <td>
                                    <span className={`psp-badge ${
                                      s.status === "PASS" || s.status === "ACCEPTED" || s.status === "COMPLETED" ? "b-pass" :
                                      s.status === "PENDING" ? "b-pending" : "b-hard"
                                    }`} style={{ fontSize: 10 }}>
                                      {s.status || "—"}
                                    </span>
                                  </td>
                                  <td style={{ fontSize: 11, color: "var(--text-subtle)" }}>{s.language || "—"}</td>
                                  <td style={{ textAlign: "right", fontWeight: 600, fontSize: 12, color: "var(--brand)" }}>
                                    {s.pointsAwarded != null ? Number(s.pointsAwarded).toFixed(1) : "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── RIGHT: exam info panel ── */}
        <div className="mgr-right">
          <div className="mgr-right-header">Exam Info</div>
          <div className="mgr-right-body">
            {!selected ? (
              <div style={{ fontSize: 12, color: "var(--text-subtle)", textAlign: "center", padding: 24 }}>Select an exam</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {/* Phase badge */}
                <div style={{ marginBottom: 4 }}>
                  {phase === "live" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", background: "var(--green-light)", borderRadius: 3, border: "1px solid #57d9a3" }}>
                      <span className="psp-dot d-red d-blink" />
                      <span style={{ fontSize: 12, color: "#006644", fontWeight: 600 }}>Exam is LIVE</span>
                    </div>
                  )}
                  {phase === "upcoming" && (
                    <div style={{ padding: "8px 12px", background: "var(--accent-soft)", borderRadius: 3, border: "1px solid #4c9aff", fontSize: 12, color: "#0747a6", fontWeight: 600 }}>
                      Scheduled — Not started
                    </div>
                  )}
                  {phase === "ended" && (
                    <div style={{ padding: "8px 12px", background: "var(--bg-secondary)", borderRadius: 3, fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
                      Exam ended
                    </div>
                  )}
                </div>

                {[
                  ["Module", selected.moduleName || "—"],
                  ["Start", fmtDate(selected.scheduledStartTime)],
                  ["Duration", fmtDuration(selected.durationMinutes)],
                  ["Visibility", (selected.visibilityMode || "—").replace(/_/g, " ")],
                  ["Access code", selected.strictAccessCode || "—"],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, gap: 8 }}>
                    <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>{k}</span>
                    <span style={{ color: "var(--text-primary)", fontWeight: 500, textAlign: "right", wordBreak: "break-word" }}>{v}</span>
                  </div>
                ))}

                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: 4 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Live Stats</div>
                  {[
                    ["Students", stats.uniqueStudents],
                    ["Submissions", stats.total],
                    ["Passed", stats.passed],
                    ["Failed", stats.failed],
                    ["Pending", stats.pending],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: "var(--text-muted)" }}>{k}</span>
                      <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{v}</span>
                    </div>
                  ))}
                </div>

                {stats.total > 0 && (
                  <div style={{ marginTop: 4 }}>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Pass rate</div>
                    <div style={{ background: "var(--bg-secondary)", borderRadius: 3, overflow: "hidden", height: 6 }}>
                      <div style={{ background: "#00875a", height: "100%", width: `${Math.round(stats.passed / stats.total * 100)}%`, transition: "width 0.5s" }} />
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, textAlign: "right" }}>
                      {stats.total > 0 ? Math.round(stats.passed / stats.total * 100) : 0}%
                    </div>
                  </div>
                )}

                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: 4 }}>
                  <Link
                    href="/teacher/exams"
                    style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--brand)", textDecoration: "none" }}
                  >
                    <ChevronRight size={12} /> Manage this exam
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
