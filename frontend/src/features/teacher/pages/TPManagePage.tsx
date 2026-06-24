"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Settings, BookOpen, BarChart3, Download, PlayCircle, StopCircle, Loader2, Plus, X,
  GripVertical, ChevronDown, ChevronUp, ChevronLeft, FlaskConical,
} from "lucide-react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "@/components/ui/PSPToast";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import {
  getAssessmentDetail, patchAssessmentSettings,
  addProblemToAssessment, removeAssessmentProblem, reorderAssessmentProblems,
  patchAssessmentProblem, getProblemsPicker, getExamSubmissions,
  type ProblemPickerItem,
} from "@/lib/api";

type TabKey = "settings" | "problems" | "progress" | "export";

const NAV_GROUPS = [
  { label: "SETUP",    items: [
    { key: "settings" as TabKey, label: "Settings",  icon: <Settings size={14} />  },
    { key: "problems" as TabKey, label: "Problems",  icon: <BookOpen size={14} />  },
  ]},
  { label: "PROGRESS", items: [
    { key: "progress" as TabKey, label: "Student Progress", icon: <BarChart3 size={14} /> },
  ]},
  { label: "EXPORT",   items: [
    { key: "export" as TabKey, label: "Export", icon: <Download size={14} /> },
  ]},
];
const VALID_TABS: TabKey[] = ["settings","problems","progress","export"];

function tpStatus(detail: any): string {
  if (!detail) return "OPEN";
  if (detail.status) return detail.status.toUpperCase();
  const deadline = detail.deadline;
  if (!deadline) return "OPEN";
  return new Date(deadline) > new Date() ? "OPEN" : "CLOSED";
}

export default function TPManagePage() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("progress");

  const loadDetail = useCallback(async () => {
    try { const d = await getAssessmentDetail(id); setDetail(d); }
    catch { toast.error("Failed to load TP"); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  useEffect(() => {
    if (!detail) return;
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tab") as TabKey | null;
    if (t && VALID_TABS.includes(t)) { setTab(t); return; }
    const s = tpStatus(detail);
    setTab(s === "CLOSED" ? "progress" : "progress");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!detail]);

  function navigate(t: string) {
    setTab(t as TabKey);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", t);
    window.history.replaceState({}, "", url.toString());
  }

  const status = tpStatus(detail);
  const headings: Record<TabKey, string> = {
    settings: "Settings", problems: "Problems", progress: "Student Progress", export: "Export",
  };

  const statusPill = (s: string) => {
    const map: Record<string, { bg: string; color: string; label: string }> = {
      OPEN:   { bg: "var(--success-soft)", color: "var(--success)", label: "Open" },
      CLOSED: { bg: "var(--bg-2)", color: "var(--ink-3)", label: "Closed" },
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

  const deadline = detail?.deadline ? new Date(detail.deadline).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" } as Intl.DateTimeFormatOptions) : "—";

  return (
    <>
      <Navbar />
      <div className="psp-breadcrumb">
        <Link href="/teacher/exams">Exams &amp; TPs</Link> ›{" "}
        <span style={{ color: "var(--ink)" }}>{detail?.title ?? "TP"}</span>
      </div>
      <div className="psp-main">
        {/* Header card */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r)", padding: "22px 24px", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: 9, background: "var(--violet-soft)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <FlaskConical size={20} color="var(--violet)" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 21, fontWeight: 700, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{detail?.title ?? "TP"}</div>
            </div>
            {statusPill(status)}
            <Link href="/teacher/exams" style={{ fontSize: 12, color: "var(--ink-3)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0, marginLeft: 4 }}>
              <ChevronLeft size={13} /> Back
            </Link>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, background: "var(--line)", borderRadius: 8, overflow: "hidden" }}>
            {[
              { label: "Deadline",     value: deadline },
              { label: "Max Attempts", value: String(detail?.maxAttemptsAllowed ?? detail?.maxAttempts ?? "—") },
              { label: "Problems",     value: String(detail?.problemsCount ?? "—") },
              { label: "Submitted",    value: String(detail?.submissionCount ?? 0) },
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
          <div>
            <div style={{ display: "flex", gap: 2, marginBottom: 16, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r)", padding: 4, overflowX: "auto" }}>
              {(Object.entries(headings) as [TabKey, string][]).map(([key, label]) => (
                <button key={key} onClick={() => navigate(key)} style={{ padding: "7px 14px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 13, fontWeight: tab === key ? 600 : 400, background: tab === key ? "var(--brand)" : "transparent", color: tab === key ? "#fff" : "var(--ink-3)", transition: "all 0.1s", whiteSpace: "nowrap" }}>
                  {label}
                </button>
              ))}
            </div>
            {tab === "settings" && <TPSettingsTab detail={detail} onSaved={loadDetail} />}
            {tab === "problems" && <TPProblemsTab detail={detail} assessmentId={id} onChanged={loadDetail} />}
            {tab === "progress" && <TPProgressTab assessmentId={id} />}
            {tab === "export"   && <TPExportTab assessmentId={id} />}
          </div>

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
              <div style={{ fontSize: 13, color: "var(--ink-3)", fontStyle: "italic" }}>No actions available.</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function TPSettingsTab({ detail, onSaved }: { detail: any; onSaved: () => void }) {
  const [form, setForm] = useState({
    title:       detail?.title ?? "",
    description: detail?.description ?? "",
    deadline:    detail?.deadline ? String(detail.deadline).slice(0, 16) : "",
    maxAttempts: detail?.maxAttempts ?? 3,
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await patchAssessmentSettings(detail.assessmentId ?? detail.id, {
        title:       form.title,
        description: form.description,
        deadline:    form.deadline,
        maxAttemptsAllowed: form.maxAttempts,
      });
      toast.success("Saved");
      onSaved();
    } catch { /* toast */ }
    finally { setSaving(false); }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <section style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8, padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 16 }}>1. Basic Info</div>
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
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 16 }}>2. Deadline & Attempts</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label className="psp-form-label">Deadline</label>
            <input className="psp-form-input" type="datetime-local" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
          </div>
          <div>
            <label className="psp-form-label">Max Attempts</label>
            <input className="psp-form-input" type="number" value={form.maxAttempts} onChange={e => setForm(f => ({ ...f, maxAttempts: parseInt(e.target.value) || 3 }))} />
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

// Problems tab identical to exam
function TPProblemsTab({ detail, assessmentId, onChanged }: { detail: any; assessmentId: string; onChanged: () => void }) {
  const [picker, setPicker] = useState<ProblemPickerItem[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerLoading, setPickerLoading] = useState(false);
  const [attaching, setAttaching] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const problems: any[] = detail?.problems ?? [];

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = problems.findIndex(p => p.problemId === active.id);
    const newIdx = problems.findIndex(p => p.problemId === over.id);
    const reordered = arrayMove(problems, oldIdx, newIdx);
    try { await reorderAssessmentProblems(assessmentId, reordered.map(p => p.problemId)); onChanged(); }
    catch { /* toast */ }
  }

  const filtered = picker.filter(p => !pickerSearch || p.title.toLowerCase().includes(pickerSearch.toLowerCase()));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{problems.length} problems</span>
        <button className="psp-btn psp-btn-primary psp-btn-sm" onClick={async () => {
          setShowPicker(true); setPickerLoading(true);
          try { const d = await getProblemsPicker(); setPicker(d); } catch {} finally { setPickerLoading(false); }
        }}><Plus size={12} /> Add Problem</button>
      </div>

      {problems.length === 0 && (
        <div className="psp-empty" style={{ padding: "32px 24px" }}>
          <FlaskConical size={28} color="var(--ink-3)" style={{ margin: "0 auto 12px" }} />
          <div className="psp-empty-title">No tasks added</div>
          <div>Add tasks from your problem bank. Each task can have its own point value and attempt limit.</div>
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={problems.map(p => p.problemId)} strategy={verticalListSortingStrategy}>
          {problems.map((p: any, i: number) => {
            const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: p.problemId });
            return (
              <div key={p.problemId} ref={setNodeRef}
                style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
                className="mgr-prob-row">
                <div className="mgr-prob-row-main">
                  <span className="mgr-drag-handle" {...attributes} {...listeners}><GripVertical size={14} /></span>
                  <span style={{ width: 22, height: 22, background: "#6366f1", color: "white", borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span style={{ flex: 1, fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</span>
                  <button className="psp-btn psp-btn-secondary psp-btn-sm" style={{ color: "#f87171", borderColor: "rgba(239,68,68,0.4)" }}
                    disabled={removing === p.problemId}
                    onClick={async () => { setRemoving(p.problemId); try { await removeAssessmentProblem(assessmentId, p.problemId); onChanged(); } catch {} finally { setRemoving(null); } }}>
                    {removing === p.problemId ? "…" : "Remove"}
                  </button>
                </div>
              </div>
            );
          })}
        </SortableContext>
      </DndContext>

      {showPicker && (
        <div className="psp-modal-overlay" onClick={() => setShowPicker(false)}>
          <div className="psp-modal" style={{ maxWidth: 520, maxHeight: "80vh", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
            <div className="psp-modal-header">
              <span style={{ fontSize: 16, fontWeight: 600 }}>Add Problem</span>
              <button onClick={() => setShowPicker(false)} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={18} /></button>
            </div>
            <div style={{ padding: "10px 20px" }}>
              <input className="psp-form-input" placeholder="Search…" value={pickerSearch} onChange={e => setPickerSearch(e.target.value)} />
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 20px" }}>
              {pickerLoading ? <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} /></div>
                : filtered.map(p => {
                  const added = problems.some(ep => ep.problemId === p.problemId);
                  return (
                    <div key={p.problemId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid var(--border)" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{p.title}</div>
                        <span className={`psp-badge b-${(p.difficulty || "medium").toLowerCase()}`} style={{ fontSize: 10 }}>{p.difficulty}</span>
                      </div>
                      <button className="psp-btn psp-btn-primary psp-btn-sm" disabled={added || attaching === p.problemId}
                        onClick={async () => { setAttaching(p.problemId); try { await addProblemToAssessment(assessmentId, p.problemId); onChanged(); toast.success("Added"); } catch {} finally { setAttaching(null); } }}>
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

function TPProgressTab({ assessmentId }: { assessmentId: string }) {
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
      <table className="psp-table">
        <thead><tr><th>Student</th><th>Score</th><th>Status</th><th>Last Active</th></tr></thead>
        <tbody>
          {submissions.length === 0 ? (
            <tr><td colSpan={4} style={{ textAlign: "center", color: "var(--text-muted)", padding: 32 }}>No submissions yet. They&apos;ll appear here in real time once the event is active.</td></tr>
          ) : submissions.map((s: any, i: number) => (
            <tr key={i}>
              <td>{s.studentFirstName ?? s.firstName ?? "—"} {s.studentLastName ?? s.lastName ?? ""}</td>
              <td className="td-muted">{s.result?.pointsAwarded != null ? `${s.result.pointsAwarded} pts` : "—"}</td>
              <td><span className={`psp-badge ${s.isAccepted ? "b-easy" : "b-tp"}`}>{s.isAccepted ? "Accepted" : s.status ?? "—"}</span></td>
              <td className="td-muted">{s.timestamp ? new Date(s.timestamp).toLocaleString() : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TPExportTab({ assessmentId }: { assessmentId: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 400 }}>
      {[
        { label: "Results CSV",       href: `/api/teacher/exams/${assessmentId}/results/export` },
        { label: "All Submissions",   href: `/api/teacher/exams/${assessmentId}/submissions?format=csv` },
      ].map(item => (
        <a key={item.label} href={item.href} className="psp-btn psp-btn-secondary"
          style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }} download>
          <Download size={13} /> {item.label}
        </a>
      ))}
    </div>
  );
}
