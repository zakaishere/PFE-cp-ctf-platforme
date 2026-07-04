"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Settings, BookOpen, Eye, BarChart3, AlertTriangle, Download,
  StopCircle, Loader2, Plus, GripVertical, ChevronDown, ChevronUp,
  X, Users, CheckCircle2, ChevronLeft, FileText, Send,
} from "lucide-react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "@/components/ui/PSPToast";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import {
  getAssessmentDetail, closeLiveExam, patchAssessmentSettings,
  addProblemToAssessment, removeAssessmentProblem, reorderAssessmentProblems,
  patchAssessmentProblem, getProblemsPicker, getExamSubmissions,
  type ProblemPickerItem,
} from "@/lib/api";

// ── Nav ───────────────────────────────────────────────────────────────────────

type TabKey = "settings" | "problems" | "monitor" | "results" | "violations" | "export";

const NAV_GROUPS = [
  { label: "SETUP", items: [
    { key: "settings"   as TabKey, label: "Settings",   icon: <Settings size={14} />      },
    { key: "problems"   as TabKey, label: "Problems",   icon: <BookOpen size={14} />      },
  ]},
  { label: "LIVE", items: [
    { key: "monitor"    as TabKey, label: "Monitor",    icon: <Eye size={14} />           },
    { key: "results"    as TabKey, label: "Results",    icon: <BarChart3 size={14} />     },
    { key: "violations" as TabKey, label: "Violations", icon: <AlertTriangle size={14} /> },
  ]},
  { label: "EXPORT", items: [
    { key: "export"     as TabKey, label: "Export",     icon: <Download size={14} />      },
  ]},
];
const VALID_TABS: TabKey[] = ["settings","problems","monitor","results","violations","export"];

// ── helpers ───────────────────────────────────────────────────────────────────

function examStatus(detail: any): string {
  if (!detail) return "UPCOMING";
  if (detail.status) return detail.status.toUpperCase();
  if (detail.isEnded || detail.isClosed) return "ENDED";
  const start = detail.scheduledStartTime;
  if (!start) return "UPCOMING";
  const now = Date.now();
  const startMs = new Date(start).getTime();
  const endMs   = startMs + (detail.durationMinutes ?? 90) * 60_000;
  if (now < startMs) return "UPCOMING";
  if (now < endMs)   return "ACTIVE";
  return "ENDED";
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ExamManagePage() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("monitor");
  const [closing, setClosing] = useState(false);

  const loadDetail = useCallback(async () => {
    try {
      const d = await getAssessmentDetail(id);
      setDetail(d);
    } catch { toast.error("Failed to load exam"); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  useEffect(() => {
    if (!detail) return;
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tab") as TabKey | null;
    if (t && VALID_TABS.includes(t)) { setTab(t); return; }
    const s = examStatus(detail);
    if (s === "UPCOMING") setTab("settings");
    else if (s === "ENDED") setTab("results");
    else setTab("monitor");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!detail]);

  function navigate(t: string) {
    setTab(t as TabKey);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", t);
    window.history.replaceState({}, "", url.toString());
  }

  async function handleClose() {
    if (!confirm("Close this exam? Students will no longer be able to submit.")) return;
    setClosing(true);
    try {
      await closeLiveExam(id);
      toast.success("Exam closed");
      loadDetail();
    } catch { /* toast */ }
    finally { setClosing(false); }
  }

  const status = examStatus(detail);
  const isActive = status === "ACTIVE";
  const isEnded  = status === "ENDED";

  const headings: Record<TabKey, string> = {
    settings: "Settings", problems: "Problems", monitor: "Live Monitor",
    results: "Results", violations: "Violations", export: "Export",
  };

  const statusPill = (s: string) => {
    const map: Record<string, { bg: string; color: string; label: string }> = {
      ACTIVE: { bg: "var(--danger-soft)", color: "var(--danger)", label: "Live" },
      UPCOMING: { bg: "var(--warn-soft)", color: "var(--warn)", label: "Upcoming" },
      ENDED: { bg: "var(--bg-2)", color: "var(--ink-3)", label: "Ended" },
    };
    const st = map[s] ?? { bg: "var(--accent-soft)", color: "var(--brand)", label: s };
    return <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 9, background: st.bg, color: st.color, letterSpacing: "0.04em", flexShrink: 0 }}>{st.label}</span>;
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
          <Loader2 size={24} style={{ animation: "spin 1s linear infinite", color: "var(--brand)" }} />
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="psp-main">
        {/* Header card */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r)", padding: "22px 24px", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: 9, background: "var(--warn-soft)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <FileText size={20} color="var(--warn)" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 21, fontWeight: 700, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{detail?.title ?? "Exam"}</div>
            </div>
            {statusPill(status)}
            <Link href="/teacher/exams" style={{ fontSize: 12, color: "var(--ink-3)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0, marginLeft: 4 }}>
              <ChevronLeft size={13} /> Back
            </Link>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, background: "var(--line)", borderRadius: 8, overflow: "hidden" }}>
            {[
              { label: "Start",     value: detail?.scheduledStartTime ? new Date(detail.scheduledStartTime).toLocaleDateString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" } as Intl.DateTimeFormatOptions) : "—" },
              { label: "Duration",  value: detail?.durationMinutes ? `${detail.durationMinutes} min` : "—" },
              { label: "Problems",  value: String(detail?.problemsCount ?? "—") },
              { label: "Submitted", value: String(detail?.submissionCount ?? 0) },
            ].map((s, i) => (
              <div key={i} style={{ background: "var(--bg-2)", padding: "12px 16px" }}>
                <div style={{ fontSize: 11, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)" }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Two-column layout */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20, alignItems: "start" }}>
          {/* Left: horizontal tab bar + content */}
          <div>
            <div style={{ display: "flex", gap: 2, marginBottom: 16, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r)", padding: 4, overflowX: "auto" }}>
              {(Object.entries(headings) as [TabKey, string][]).map(([key, label]) => (
                <button key={key} onClick={() => navigate(key)} style={{ padding: "7px 14px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 13, fontWeight: tab === key ? 600 : 400, background: tab === key ? "var(--brand)" : "transparent", color: tab === key ? "#fff" : "var(--ink-3)", transition: "all 0.1s", whiteSpace: "nowrap" }}>
                  {label}
                </button>
              ))}
            </div>
            {tab === "settings"   && <ExamSettingsTab detail={detail} onSaved={loadDetail} />}
            {tab === "problems"   && <ExamProblemsTab detail={detail} assessmentId={id} onChanged={loadDetail} />}
            {tab === "monitor"    && <ExamMonitorTab assessmentId={id} detail={detail} />}
            {tab === "results"    && <ExamResultsTab assessmentId={id} detail={detail} />}
            {tab === "violations" && <ExamViolationsTab assessmentId={id} />}
            {tab === "export"     && <ExamExportTab assessmentId={id} title={detail?.title ?? "exam"} />}
          </div>

          {/* Right sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r)", padding: "16px 18px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Info</div>
              {detail?.description && <p style={{ fontSize: 13, color: "var(--ink-2)", margin: "0 0 10px", lineHeight: 1.5 }}>{detail.description}</p>}
              {detail?.moduleName && <div style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 6 }}>Module: <span style={{ color: "var(--ink-2)" }}>{detail.moduleName}</span></div>}
              {detail?.visibilityMode && <div style={{ fontSize: 12, color: "var(--ink-3)" }}>Visibility: <span style={{ color: "var(--ink-2)" }}>{(detail.visibilityMode as string).replace(/_/g, " ")}</span></div>}
              {!detail?.description && !detail?.moduleName && <div style={{ fontSize: 13, color: "var(--ink-3)", fontStyle: "italic" }}>No details added.</div>}
            </div>
            <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r)", padding: "16px 18px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Quick Actions</div>
              {isActive ? (
                <button className="psp-btn psp-btn-secondary" style={{ width: "100%", justifyContent: "center", color: "var(--danger)", borderColor: "var(--line)" }} onClick={handleClose} disabled={closing}>
                  {closing ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <StopCircle size={13} />}
                  Close Exam
                </button>
              ) : (
                <div style={{ fontSize: 13, color: "var(--ink-3)", fontStyle: "italic" }}>No actions available.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Settings tab ──────────────────────────────────────────────────────────────

function ExamSettingsTab({ detail, onSaved }: { detail: any; onSaved: () => void }) {
  const [form, setForm] = useState({
    title:              detail?.title ?? "",
    description:        detail?.description ?? "",
    scheduledStartTime: detail?.scheduledStartTime ? String(detail.scheduledStartTime).slice(0, 16) : "",
    durationMinutes:    detail?.durationMinutes ?? 90,
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await patchAssessmentSettings(detail.assessmentId ?? detail.id, {
        title:              form.title,
        description:        form.description,
        scheduledStartTime: form.scheduledStartTime,
        durationMinutes:    form.durationMinutes,
      });
      toast.success("Saved");
      onSaved();
    } catch { /* toast */ }
    finally { setSaving(false); }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <section style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8, padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 16 }}>
          1. Basic Info
        </div>
        <div style={{ marginBottom: 14 }}>
          <label className="psp-form-label">Title *</label>
          <input className="psp-form-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label className="psp-form-label">Description</label>
          <textarea className="psp-form-textarea" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ minHeight: 80 }} />
        </div>
      </section>

      <section style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8, padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 16 }}>
          2. Schedule
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label className="psp-form-label">Start Date & Time</label>
            <input className="psp-form-input" type="datetime-local" value={form.scheduledStartTime}
              onChange={e => setForm(f => ({ ...f, scheduledStartTime: e.target.value }))} />
          </div>
          <div>
            <label className="psp-form-label">Duration (minutes)</label>
            <input className="psp-form-input" type="number" value={form.durationMinutes}
              onChange={e => setForm(f => ({ ...f, durationMinutes: parseInt(e.target.value) || 90 }))} />
          </div>
        </div>
      </section>

      <button className="psp-btn psp-btn-primary" onClick={save} disabled={saving} style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {saving && <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />}
        Save Settings
      </button>
    </div>
  );
}

// ── Problems tab ──────────────────────────────────────────────────────────────

function ExamProblemsTab({ detail, assessmentId, onChanged }: { detail: any; assessmentId: string; onChanged: () => void }) {
  const [picker, setPicker]         = useState<ProblemPickerItem[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerLoading, setPickerLoading] = useState(false);
  const [attaching, setAttaching]   = useState<string | null>(null);
  const [removing, setRemoving]     = useState<string | null>(null);
  const problems: any[] = detail?.problems ?? [];

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  async function openPicker() {
    setShowPicker(true); setPickerLoading(true);
    try { const d = await getProblemsPicker(); setPicker(d); }
    catch { /* silent */ }
    finally { setPickerLoading(false); }
  }

  async function attach(problemId: string) {
    setAttaching(problemId);
    try { await addProblemToAssessment(assessmentId, problemId); onChanged(); toast.success("Problem added"); }
    catch { /* toast */ }
    finally { setAttaching(null); }
  }

  async function remove(problemId: string) {
    setRemoving(problemId);
    try { await removeAssessmentProblem(assessmentId, problemId); onChanged(); }
    catch { /* toast */ }
    finally { setRemoving(null); }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = problems.findIndex(p => p.problemId === active.id);
    const newIdx = problems.findIndex(p => p.problemId === over.id);
    const reordered = arrayMove(problems, oldIdx, newIdx);
    try { await reorderAssessmentProblems(assessmentId, reordered.map(p => p.problemId)); onChanged(); }
    catch { /* toast */ }
  }

  const filteredPicker = picker.filter(p => !pickerSearch || p.title.toLowerCase().includes(pickerSearch.toLowerCase()));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{problems.length} problem{problems.length !== 1 ? "s" : ""}</span>
        <button className="psp-btn psp-btn-primary psp-btn-sm" onClick={openPicker}><Plus size={12} /> Add Problem</button>
      </div>

      {problems.length === 0 ? (
        <div className="psp-empty" style={{ padding: "32px 24px" }}>
          <BookOpen size={28} color="var(--ink-3)" style={{ margin: "0 auto 12px" }} />
          <div className="psp-empty-title">No problems attached</div>
          <div>Attach problems to this exam. Students won&apos;t be able to start until at least one is added.</div>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={problems.map(p => p.problemId)} strategy={verticalListSortingStrategy}>
            {problems.map((p: any, i: number) => (
              <ExamProblemRow key={p.problemId} problem={p} label={String.fromCharCode(65 + i)}
                removing={removing === p.problemId} onRemove={() => remove(p.problemId)}
                onPatch={async (data) => { await patchAssessmentProblem(assessmentId, p.problemId, data); onChanged(); }}
              />
            ))}
          </SortableContext>
        </DndContext>
      )}

      {showPicker && (
        <div className="psp-modal-overlay" onClick={() => setShowPicker(false)}>
          <div className="psp-modal" style={{ maxWidth: 520, maxHeight: "80vh", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
            <div className="psp-modal-header">
              <span style={{ fontSize: 16, fontWeight: 600 }}>Add Problems</span>
              <button onClick={() => setShowPicker(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={18} /></button>
            </div>
            <div style={{ padding: "10px 20px" }}>
              <input className="psp-form-input" placeholder="Search…" value={pickerSearch} onChange={e => setPickerSearch(e.target.value)} />
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 20px" }}>
              {pickerLoading ? <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} /></div>
                : filteredPicker.map(p => {
                  const added = problems.some(ep => ep.problemId === p.problemId);
                  return (
                    <div key={p.problemId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid var(--border)" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{p.title}</div>
                        <span className={`psp-badge b-${(p.difficulty || "medium").toLowerCase()}`} style={{ fontSize: 10 }}>{p.difficulty}</span>
                      </div>
                      <button className="psp-btn psp-btn-primary psp-btn-sm" disabled={added || attaching === p.problemId} onClick={() => attach(p.problemId)}>
                        {added ? "Added" : attaching === p.problemId ? "…" : "Add"}
                      </button>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ExamProblemRow({ problem, label, removing, onRemove, onPatch }: {
  problem: any; label: string; removing: boolean; onRemove: () => void; onPatch: (data: any) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [pts, setPts] = useState(String(problem.pointsOverride ?? problem.maxPoints ?? 25));
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: problem.problemId });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }} className="mgr-prob-row">
      <div className="mgr-prob-row-main" onClick={() => setExpanded(e => !e)}>
        <span className="mgr-drag-handle" {...attributes} {...listeners} onClick={e => e.stopPropagation()}><GripVertical size={14} /></span>
        <span style={{ width: 22, height: 22, background: "#6366f1", color: "white", borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{label}</span>
        <span style={{ flex: 1, fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{problem.title}</span>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{pts} pts</span>
        {expanded ? <ChevronUp size={14} color="#5e6c84" /> : <ChevronDown size={14} color="#5e6c84" />}
      </div>
      {expanded && (
        <div className="mgr-prob-expand">
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
            <div>
              <label className="psp-form-label">Max Points</label>
              <input className="psp-form-input" type="number" value={pts} onChange={e => setPts(e.target.value)} style={{ width: 90 }} />
            </div>
            <button className="psp-btn psp-btn-primary psp-btn-sm" onClick={() => onPatch({ pointsOverride: parseInt(pts) || 25 })}>Save</button>
            <button className="psp-btn psp-btn-secondary psp-btn-sm" style={{ color: "#f87171", borderColor: "rgba(239,68,68,0.4)" }} disabled={removing} onClick={onRemove}>
              {removing ? "…" : "Remove"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Monitor tab ───────────────────────────────────────────────────────────────

function ExamMonitorTab({ assessmentId, detail }: { assessmentId: string; detail: any }) {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await getExamSubmissions(assessmentId);
      setSubmissions(Array.isArray(data) ? data : (data as any).content ?? []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [assessmentId]);

  useEffect(() => { load(); const id = setInterval(load, 15_000); return () => clearInterval(id); }, [load]);

  const started  = submissions.filter(s => s.status !== "NOT_STARTED").length;
  const total    = detail?.enrolledCount ?? submissions.length;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Enrolled",    value: total },
          { label: "Submitted",   value: started },
          { label: "Still going", value: Math.max(0, started - (submissions.filter(s => s.status === "SUBMITTED").length)) },
          { label: "Not started", value: Math.max(0, total - started) },
        ].map(s => (
          <div key={s.label} className="psp-stat-card"><div><div className="psp-stat-val">{s.value}</div><div className="psp-stat-lbl">{s.label}</div></div></div>
        ))}
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} /></div>
      ) : submissions.length === 0 ? (
        <div className="psp-empty" style={{ padding: "32px 24px" }}>
          <Send size={28} color="var(--ink-3)" style={{ margin: "0 auto 12px" }} />
          <div className="psp-empty-title">No submissions yet</div>
          <div>They&apos;ll appear here in real time once the event is active.</div>
        </div>
      ) : (
        <table className="psp-table">
          <thead>
            <tr><th>Student</th><th>Status</th><th>Score</th><th>Time</th></tr>
          </thead>
          <tbody>
            {submissions.map((s: any, i: number) => (
              <tr key={i}>
                <td className="td-link">{s.studentFirstName ?? s.firstName ?? "—"} {s.studentLastName ?? s.lastName ?? ""}</td>
                <td><span className={`psp-badge ${s.isAccepted ? "b-easy" : "b-live"}`}>{s.isAccepted ? "Accepted" : s.status ?? "—"}</span></td>
                <td className="td-muted">{s.result?.pointsAwarded != null ? `${s.result.pointsAwarded} pts` : "—"}</td>
                <td className="td-muted">{s.timestamp ? new Date(s.timestamp).toLocaleTimeString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Results tab ───────────────────────────────────────────────────────────────

function ExamResultsTab({ assessmentId, detail }: { assessmentId: string; detail: any }) {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getExamSubmissions(assessmentId)
      .then(d => setSubmissions(Array.isArray(d) ? d : (d as any).content ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [assessmentId]);

  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} /></div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <a href={`/api/teacher/exams/${assessmentId}/results/export`} className="psp-btn psp-btn-secondary psp-btn-sm" download>
          <Download size={12} /> Export Grades CSV
        </a>
      </div>
      <table className="psp-table">
        <thead><tr><th>Student</th><th>Score</th><th>Status</th><th>Submitted</th></tr></thead>
        <tbody>
          {submissions.map((s: any, i: number) => (
            <tr key={i}>
              <td>{s.studentFirstName ?? s.firstName ?? "—"} {s.studentLastName ?? s.lastName ?? ""}</td>
              <td>{s.result?.pointsAwarded != null ? `${s.result.pointsAwarded}` : "—"}</td>
              <td><span className={`psp-badge ${s.isAccepted ? "b-easy" : "b-live"}`}>{s.isAccepted ? "Accepted" : s.status ?? "Pending"}</span></td>
              <td className="td-muted">{s.timestamp ? new Date(s.timestamp).toLocaleString() : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {submissions.length === 0 && <div className="psp-empty"><div>No results yet.</div></div>}
    </div>
  );
}

// ── Violations tab ────────────────────────────────────────────────────────────

function ExamViolationsTab({ assessmentId }: { assessmentId: string }) {
  return (
    <div className="psp-card">
      <div className="psp-card-body" style={{ color: "var(--text-muted)", fontSize: 13 }}>
        Anti-cheat violations are logged from the exam arena. Export them below.
        <div style={{ marginTop: 12 }}>
          <a href={`/api/teacher/${assessmentId}/audit/export.csv?domain=EXAM`} className="psp-btn psp-btn-secondary psp-btn-sm" download>
            <Download size={12} /> Export Violations CSV
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Export tab ────────────────────────────────────────────────────────────────

function ExamExportTab({ assessmentId, title }: { assessmentId: string; title: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 400 }}>
      {[
        { label: "Grades CSV",        href: `/api/teacher/exams/${assessmentId}/results/export` },
        { label: "All Submissions",   href: `/api/teacher/exams/${assessmentId}/submissions?format=csv` },
        { label: "Violations Report", href: `/api/teacher/${assessmentId}/audit/export.csv?domain=EXAM` },
      ].map(item => (
        <a key={item.label} href={item.href}
          className="psp-btn psp-btn-secondary"
          style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}
          download>
          <Download size={13} /> {item.label}
        </a>
      ))}
    </div>
  );
}
