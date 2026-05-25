"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import {
  Users, BookOpen, Search, CheckCircle2, Clock,
  XCircle, Loader2, GraduationCap, ChevronRight,
} from "lucide-react";
import {
  getAssessments,
  getAssessmentJoinRequests,
  getExamSubmissions,
  approveJoinRequest,
  rejectJoinRequest,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
}

function initials(first = "", last = ""): string {
  return ((first[0] ?? "") + (last[0] ?? "")).toUpperCase() || "?";
}

// Aggregate unique students across all approved join requests
function buildStudentMap(allRequests: { assessmentTitle: string; requests: any[] }[]): Record<string, any> {
  const map: Record<string, any> = {};
  for (const { assessmentTitle, requests } of allRequests) {
    for (const r of requests) {
      const key = r.studentId;
      if (!map[key]) {
        map[key] = {
          studentId: r.studentId,
          firstName: r.firstName || "",
          lastName: r.lastName || "",
          email: r.email || "",
          divisionName: r.divisionName || "",
          semesterName: r.semesterName || "",
          apogeeNumber: r.apogeeNumber || "",
          assessments: [],
        };
      }
      map[key].assessments.push({ title: assessmentTitle, status: r.status, decidedAt: r.decidedAt });
    }
  }
  return map;
}

// ── Main ──────────────────────────────────────────────────────────────────────

type ViewMode = "enrolled" | "requests";

export default function TeacherStudents() {
  const { toast } = useToast();

  const [assessments, setAssessments] = useState<any[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "exam" | "tp">("all");
  const [viewMode, setViewMode] = useState<ViewMode>("requests");

  // Pending join requests for selected assessment
  const [pendingReqs, setPendingReqs] = useState<any[]>([]);
  const [approvedReqs, setApprovedReqs] = useState<any[]>([]);
  const [reqLoading, setReqLoading] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  // All-students overview (across all assessments)
  const [allStudents, setAllStudents] = useState<Record<string, any>>({});
  const [overviewLoading, setOverviewLoading] = useState(false);

  // Student search in the right panel
  const [studentSearch, setStudentSearch] = useState("");

  // Load teacher's assessments
  useEffect(() => {
    setListLoading(true);
    getAssessments()
      .then(data => {
        setAssessments(data);
        if (data.length > 0) setSelected(data[0]);
      })
      .catch(() => toast({ title: "Failed to load assessments", variant: "destructive" }))
      .finally(() => setListLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load join requests for selected assessment
  useEffect(() => {
    if (!selected) return;
    const id = selected.id || selected.assessmentId;
    setReqLoading(true);
    setPendingReqs([]);
    setApprovedReqs([]);

    Promise.all([
      getAssessmentJoinRequests(id, "PENDING", 0, 50).catch(() => ({ content: [] })),
      getAssessmentJoinRequests(id, "APPROVED", 0, 50).catch(() => ({ content: [] })),
    ]).then(([pending, approved]) => {
      setPendingReqs(pending.content || pending || []);
      setApprovedReqs(approved.content || approved || []);
    }).finally(() => setReqLoading(false));
  }, [selected]);

  // Build all-students overview from all REQUEST_BASED assessments
  const loadAllStudents = useCallback(async () => {
    const requestBased = assessments.filter(a => a.visibilityMode === "REQUEST_BASED");
    if (requestBased.length === 0) { setAllStudents({}); return; }

    setOverviewLoading(true);
    try {
      const results = await Promise.all(
        requestBased.map(async a => {
          const id = a.id || a.assessmentId;
          const data = await getAssessmentJoinRequests(id, "APPROVED", 0, 100).catch(() => ({ content: [] }));
          return { assessmentTitle: a.title, requests: data.content || data || [] };
        })
      );
      setAllStudents(buildStudentMap(results));
    } finally {
      setOverviewLoading(false);
    }
  }, [assessments]);

  useEffect(() => {
    if (assessments.length > 0) loadAllStudents();
  }, [assessments, loadAllStudents]);

  // Approve / reject
  const handleApprove = async (requestId: string) => {
    setActing(requestId);
    try {
      await approveJoinRequest(requestId);
      // Move from pending to approved
      const req = pendingReqs.find(r => r.requestId === requestId);
      setPendingReqs(prev => prev.filter(r => r.requestId !== requestId));
      if (req) setApprovedReqs(prev => [...prev, { ...req, status: "APPROVED" }]);
      toast({ title: "Request approved" });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
    setActing(null);
  };

  const handleReject = async (requestId: string) => {
    setActing(requestId);
    try {
      await rejectJoinRequest(requestId);
      setPendingReqs(prev => prev.filter(r => r.requestId !== requestId));
      toast({ title: "Request rejected" });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
    setActing(null);
  };

  // Filtered assessment list
  const filtered = assessments.filter(a => {
    if (filter === "exam" && a.type !== "LIVE_EXAM") return false;
    if (filter === "tp" && a.type !== "OPEN_TP") return false;
    return !search || (a.title || "").toLowerCase().includes(search.toLowerCase());
  });

  // Filtered all-students list
  const allStudentsList = Object.values(allStudents).filter(s => {
    if (!studentSearch) return true;
    const q = studentSearch.toLowerCase();
    return (
      (s.firstName + " " + s.lastName).toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      (s.divisionName || "").toLowerCase().includes(q)
    );
  });

  const totalApproved = approvedReqs.length;
  const totalPending = pendingReqs.length;
  const isRequestBased = selected?.visibilityMode === "REQUEST_BASED";

  return (
    <>
      <Navbar />
      <div className="psp-breadcrumb">
        <Link href="/teacher">PSP</Link> › <span style={{ color: "var(--text-primary)" }}>Students</span>
      </div>

      <div className="mgr-shell">
        {/* ── LEFT: assessment list ── */}
        <div className="mgr-left">
          <div className="mgr-left-header">
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Assessments</span>
            <span className="psp-badge b-easy" style={{ fontSize: 10 }}>{assessments.length}</span>
          </div>
          <div className="mgr-left-search">
            <input
              className="psp-search"
              placeholder="Search…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="mgr-filter-row">
            {(["all", "exam", "tp"] as const).map(f => (
              <button key={f} className={`psp-ftab${filter === f ? " on" : ""}`} onClick={() => setFilter(f)}>
                {f === "all" ? "All" : f === "exam" ? "Exams" : "TPs"}
              </button>
            ))}
          </div>
          <div className="mgr-list">
            {listLoading ? (
              Array(4).fill(0).map((_, i) => (
                <div key={i} className="mgr-skel-item">
                  <div className="skel mgr-skel-line" style={{ width: "65%" }} />
                  <div className="skel mgr-skel-line" style={{ width: "40%" }} />
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div className="psp-empty" style={{ padding: "32px 14px" }}>
                <BookOpen size={24} color="#97a0af" style={{ margin: "0 auto 8px" }} />
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>No assessments</div>
              </div>
            ) : filtered.map(a => {
              const id = a.id || a.assessmentId;
              const isSelected = selected && (selected.id || selected.assessmentId) === id;
              const isExam = a.type === "LIVE_EXAM";
              return (
                <div
                  key={id}
                  className={`mgr-list-item${isSelected ? " active" : ""}`}
                  onClick={() => { setSelected(a); setStudentSearch(""); }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                      {a.title}
                    </span>
                    {isExam
                      ? <span className="psp-badge b-live" style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 9, flexShrink: 0 }}><span className="psp-dot d-red" style={{ width: 5, height: 5 }} />Exam</span>
                      : <span className="psp-badge b-easy" style={{ fontSize: 9, flexShrink: 0 }}>TP</span>
                    }
                  </div>
                  <div style={{ display: "flex", gap: 6, fontSize: 11, color: "var(--text-subtle)" }}>
                    {a.moduleName && <span>{a.moduleName}</span>}
                    {a.visibilityMode && (
                      <span className="psp-badge b-priv" style={{ fontSize: 9 }}>
                        {a.visibilityMode.replace(/_/g, " ")}
                      </span>
                    )}
                    {(a.pendingRequestCount > 0) && (
                      <span className="psp-badge b-pending" style={{ fontSize: 9 }}>{a.pendingRequestCount} pending</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── CENTER: student / request view ── */}
        <div className="mgr-center">
          {!selected ? (
            <div className="psp-empty" style={{ marginTop: 80 }}>
              <Users size={36} color="var(--border)" style={{ margin: "0 auto 12px" }} />
              <div className="psp-empty-title">Select an assessment</div>
              <div>Choose an exam or TP from the list to view its students</div>
            </div>
          ) : (
            <>
              <div className="mgr-center-tabs">
                {(["requests", "enrolled"] as ViewMode[]).map(mode => (
                  <button
                    key={mode}
                    className={`psp-tab${viewMode === mode ? " active" : ""}`}
                    onClick={() => setViewMode(mode)}
                  >
                    {mode === "requests"
                      ? `Requests${pendingReqs.length > 0 ? ` (${pendingReqs.length} pending)` : ""}`
                      : `Enrolled (${totalApproved})`}
                  </button>
                ))}
              </div>

              <div className="mgr-center-body">
                {/* Visibility note */}
                {!isRequestBased && (
                  <div className="psp-alert psp-alert-info" style={{ marginBottom: 14 }}>
                    <GraduationCap size={14} />
                    <span>
                      This assessment uses <strong>{(selected.visibilityMode || "MODULE_ONLY").replace(/_/g, " ")}</strong> access.
                      {selected.visibilityMode === "MODULE_ONLY"
                        ? " All students from the module have automatic access — no join requests apply."
                        : " Students enter an access code directly — no join requests apply."}
                    </span>
                  </div>
                )}

                {/* REQUESTS tab */}
                {viewMode === "requests" && (
                  <>
                    {reqLoading ? (
                      <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
                        <Loader2 size={22} style={{ animation: "spin 1s linear infinite", color: "#0052cc" }} />
                      </div>
                    ) : (
                      <>
                        {/* Pending */}
                        <div style={{ marginBottom: 20 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                            <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>
                              Pending
                              {pendingReqs.length > 0 && (
                                <span className="psp-badge b-pending" style={{ marginLeft: 8 }}>{pendingReqs.length}</span>
                              )}
                            </div>
                          </div>

                          {pendingReqs.length === 0 ? (
                            <div style={{ padding: "16px 0", fontSize: 12, color: "var(--text-subtle)", display: "flex", alignItems: "center", gap: 6 }}>
                              <CheckCircle2 size={14} color="#00875a" /> No pending requests
                            </div>
                          ) : pendingReqs.map(r => {
                            const fullName = [r.firstName, r.lastName].filter(Boolean).join(" ") || "Unknown";
                            const isActing = acting === r.requestId;
                            return (
                              <div key={r.requestId} className="mgr-section" style={{ marginBottom: 8 }}>
                                <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                                  <div className="req-avatar">{initials(r.firstName, r.lastName)}</div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>{fullName}</div>
                                    <div style={{ display: "flex", gap: 6, marginTop: 2, flexWrap: "wrap", alignItems: "center" }}>
                                      {r.apogeeNumber && (
                                        <span style={{ fontSize: 10, color: "var(--text-muted)", background: "var(--bg-secondary)", padding: "1px 5px", borderRadius: 2, fontFamily: "monospace" }}>{r.apogeeNumber}</span>
                                      )}
                                      {r.divisionName && <span style={{ fontSize: 11, color: "var(--text-subtle)" }}>{r.divisionName}{r.semesterName ? ` · ${r.semesterName}` : ""}</span>}
                                      {r.email && <span style={{ fontSize: 11, color: "var(--text-subtle)" }}>{r.email}</span>}
                                    </div>
                                    {r.message && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3, fontStyle: "italic" }}>"{r.message}"</div>}
                                  </div>
                                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                                    <button
                                      className="req-btn req-btn-approve"
                                      disabled={isActing}
                                      onClick={() => handleApprove(r.requestId)}
                                    >
                                      {isActing ? <Loader2 size={10} /> : <CheckCircle2 size={10} />}
                                      {isActing ? "…" : "Approve"}
                                    </button>
                                    <button
                                      className="req-btn req-btn-reject"
                                      disabled={isActing}
                                      onClick={() => handleReject(r.requestId)}
                                    >
                                      <XCircle size={10} /> Reject
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Recently decided */}
                        {approvedReqs.length > 0 && (
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)", marginBottom: 10 }}>
                              Approved ({approvedReqs.length})
                            </div>
                            <div className="mgr-section">
                              <table className="psp-table" style={{ background: "var(--bg-primary)" }}>
                                <thead>
                                  <tr>
                                    <th>Student</th>
                                    <th>Division</th>
                                    <th>Email</th>
                                    <th>Approved</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {approvedReqs.map((r, i) => (
                                    <tr key={r.requestId || i}>
                                      <td>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                          <div className="req-avatar" style={{ width: 24, height: 24, fontSize: 10 }}>
                                            {initials(r.firstName, r.lastName)}
                                          </div>
                                          <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 12 }}>
                                            {[r.firstName, r.lastName].filter(Boolean).join(" ") || "—"}
                                          </span>
                                        </div>
                                      </td>
                                      <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                                        {r.divisionName || "—"}{r.semesterName ? ` · ${r.semesterName}` : ""}
                                      </td>
                                      <td style={{ fontSize: 11, color: "var(--text-subtle)" }}>{r.email || "—"}</td>
                                      <td style={{ fontSize: 11, color: "var(--text-subtle)" }}>{r.decidedAt ? fmtDate(r.decidedAt) : "—"}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}

                {/* ENROLLED tab */}
                {viewMode === "enrolled" && (
                  <>
                    {reqLoading ? (
                      <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
                        <Loader2 size={22} style={{ animation: "spin 1s linear infinite", color: "#0052cc" }} />
                      </div>
                    ) : approvedReqs.length === 0 ? (
                      <div className="psp-empty" style={{ border: "1px solid var(--border)", borderRadius: 3, background: "var(--bg-primary)" }}>
                        <Users size={28} color="var(--border)" style={{ margin: "0 auto 8px" }} />
                        <div className="psp-empty-title">No enrolled students</div>
                        <div style={{ fontSize: 12, color: "var(--text-subtle)", marginTop: 4 }}>
                          {isRequestBased ? "No approved join requests yet" : "Students access via module enrollment or access code"}
                        </div>
                      </div>
                    ) : (
                      <div className="mgr-section">
                        <table className="psp-table" style={{ background: "var(--bg-primary)" }}>
                          <thead>
                            <tr>
                              <th>Student</th>
                              <th>Division · Semester</th>
                              <th>Email</th>
                              <th>Joined</th>
                            </tr>
                          </thead>
                          <tbody>
                            {approvedReqs.map((r, i) => (
                              <tr key={r.requestId || i}>
                                <td>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <div className="req-avatar" style={{ width: 26, height: 26, fontSize: 10 }}>
                                      {initials(r.firstName, r.lastName)}
                                    </div>
                                    <div>
                                      <div style={{ fontWeight: 600, fontSize: 12, color: "var(--text-primary)" }}>
                                        {[r.firstName, r.lastName].filter(Boolean).join(" ") || "—"}
                                      </div>
                                      {r.apogeeNumber && (
                                        <div style={{ fontSize: 10, color: "var(--text-subtle)", fontFamily: "monospace" }}>{r.apogeeNumber}</div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                                  {[r.divisionName, r.semesterName].filter(Boolean).join(" · ") || "—"}
                                </td>
                                <td style={{ fontSize: 11, color: "var(--text-subtle)" }}>{r.email || "—"}</td>
                                <td style={{ fontSize: 11, color: "var(--text-subtle)" }}>{r.decidedAt ? fmtDate(r.decidedAt) : "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── RIGHT: all-students overview ── */}
        <div className="mgr-right">
          <div className="mgr-right-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>All Enrolled</span>
            <span className="psp-badge b-easy" style={{ fontSize: 10 }}>{Object.keys(allStudents).length}</span>
          </div>
          <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
            <div style={{ position: "relative" }}>
              <Search size={11} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "var(--text-subtle)" }} />
              <input
                className="psp-search"
                placeholder="Search students…"
                value={studentSearch}
                onChange={e => setStudentSearch(e.target.value)}
                style={{ paddingLeft: 26 }}
              />
            </div>
          </div>
          <div className="mgr-right-body" style={{ padding: 0 }}>
            {overviewLoading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
                <Loader2 size={16} style={{ animation: "spin 1s linear infinite", color: "#0052cc" }} />
              </div>
            ) : allStudentsList.length === 0 ? (
              <div style={{ padding: "24px 16px", textAlign: "center", color: "var(--text-subtle)", fontSize: 12 }}>
                {Object.keys(allStudents).length === 0
                  ? "No students enrolled in REQUEST_BASED assessments"
                  : "No students match your search"}
              </div>
            ) : allStudentsList.map(s => (
              <div key={s.studentId} style={{ padding: "10px 14px", borderBottom: "1px solid #f4f5f7" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div className="req-avatar" style={{ width: 26, height: 26, fontSize: 10, flexShrink: 0 }}>
                    {initials(s.firstName, s.lastName)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 12, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {[s.firstName, s.lastName].filter(Boolean).join(" ") || "Unknown"}
                    </div>
                    {s.divisionName && (
                      <div style={{ fontSize: 10, color: "var(--text-subtle)" }}>
                        {s.divisionName}{s.semesterName ? ` · ${s.semesterName}` : ""}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4, marginTop: 5, flexWrap: "wrap" }}>
                  {s.assessments.slice(0, 2).map((a: any, i: number) => (
                    <span key={i} className="psp-badge b-easy" style={{ fontSize: 9, maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {a.title}
                    </span>
                  ))}
                  {s.assessments.length > 2 && (
                    <span style={{ fontSize: 10, color: "var(--text-subtle)" }}>+{s.assessments.length - 2} more</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
