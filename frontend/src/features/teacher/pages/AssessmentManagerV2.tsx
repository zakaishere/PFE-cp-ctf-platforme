"use client";

import { useState, useEffect, useCallback } from "react";
import { APP_NAME } from "@/lib/brand";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { BookOpen, Plus, Calendar, Timer, FileText, Loader2, GripVertical, ChevronDown, ChevronUp, X, Settings, Search, AlertTriangle, CheckCircle2, Trash2, Users, FlaskConical, Lock, Unlock, RefreshCw, Check } from "lucide-react";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  getAssessments, getAssessmentDetail, createLiveExam, createOpenTP,
  addProblemToAssessment, removeAssessmentProblem,
  getAssessmentJoinRequests, approveJoinRequest, rejectJoinRequest,
  bulkApproveAssessmentRequests, getExamSubmissions, closeLiveExam,
  overridePenalty, getProblemsPicker, ProblemPickerItem, CreateAssessmentRequest,
  reorderAssessmentProblems, patchAssessmentProblem, patchAssessmentSettings,
  getMyModules, ModuleOption,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

// ─── helpers ────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    " · " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function fmtDuration(mins: number) {
  if (!mins) return "—";
  const h = Math.floor(mins / 60), m = mins % 60;
  return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function safeStr(v: unknown): string {
  if (v === null || v === undefined) return "—";
  return String(v);
}

function initials(firstName: string, lastName: string): string {
  return ((firstName[0] ?? "") + (lastName[0] ?? "")).toUpperCase() || "?";
}

function countdown(iso: string | null | undefined): string {
  if (!iso) return "";
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "Started";
  const days = Math.floor(diff / 86400000);
  const hrs  = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (days > 0) return `${days}d ${hrs}h`;
  if (hrs  > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

type Tab = "overview" | "problems" | "requests" | "submissions" | "settings";
type RightMode = "quickActions" | "picker";

// ─── SortableAssessmentProblemRow ────────────────────────────────────────────

function SortableAssessmentProblemRow({
  ap, onRemove, onPatch, removing,
}: {
  ap: any; onRemove: (id: string) => void; onPatch: (id: string, data: any) => void; removing: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [pts, setPts] = useState<string>(String(ap.pointsOverride ?? ap.points ?? 100));
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: ap.problemId });

  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const diff = ap.difficulty || ap.difficultyLevel || "EASY";
  const diffCls = diff === "EASY" ? "b-easy" : diff === "MEDIUM" ? "b-med" : "b-hard";

  return (
    <div ref={setNodeRef} style={style} className="mgr-prob-row">
      <div className="mgr-prob-row-main" onClick={() => setExpanded(e => !e)}>
        <span className="mgr-drag-handle" {...attributes} {...listeners} onClick={e => e.stopPropagation()}>
          <GripVertical size={14} />
        </span>
        <span style={{ width: 22, height: 22, background: "var(--brand)", color: "white", borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
          {ap.orderIndex != null ? String.fromCharCode(65 + ap.orderIndex) : "?"}
        </span>
        <span style={{ flex: 1, fontWeight: 600, fontSize: 13, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {ap.title}
        </span>
        <span className={`psp-badge ${diffCls}`}>{diff}</span>
        {expanded ? <ChevronUp size={14} color="#5e6c84" /> : <ChevronDown size={14} color="#5e6c84" />}
      </div>
      {expanded && (
        <div className="mgr-prob-expand">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label className="psp-form-label">Points Override</label>
              <div style={{ display: "flex", gap: 6 }}>
                <input className="psp-form-input" type="number" value={pts}
                  onChange={e => setPts(e.target.value)}
                  style={{ height: 28, fontSize: 12 }} />
                <button className="psp-btn psp-btn-secondary psp-btn-sm"
                  onClick={() => onPatch(ap.problemId, { points: parseInt(pts) || 100 })}>
                  Save
                </button>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button className="psp-btn psp-btn-danger psp-btn-sm"
                disabled={removing === ap.problemId}
                onClick={() => onRemove(ap.problemId)}>
                {removing === ap.problemId ? <Loader2 size={11} /> : <Trash2 size={11} />} Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────

export default function AssessmentManagerV2() {
  const { toast } = useToast();

  // left column
  const [list, setList]               = useState<any[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [search, setSearch]           = useState("");
  const [filter, setFilter]           = useState<"all" | "exam" | "tp">("all");

  // center
  const [selected, setSelected]       = useState<any | null>(null);
  const [detail, setDetail]           = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [tab, setTab]                 = useState<Tab>("overview");

  // right column
  const [rightMode, setRightMode]     = useState<RightMode>("quickActions");
  const [pickerProblems, setPickerProblems] = useState<ProblemPickerItem[]>([]);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerFilter, setPickerFilter] = useState("all");
  const [pickerLoading, setPickerLoading] = useState(false);
  const [attaching, setAttaching]     = useState<string | null>(null);

  // join requests
  const [requests, setRequests]       = useState<any[]>([]);
  const [reqLoading, setReqLoading]   = useState(false);
  const [reqActing, setReqActing]     = useState<string | null>(null);

  // submissions
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [subLoading, setSubLoading]   = useState(false);
  const [penalizing, setPenalizing]   = useState<string | null>(null);
  const [penaltyForm, setPenaltyForm] = useState<{ id: string; value: string; reason: string } | null>(null);

  // settings
  const [settingsForm, setSettingsForm] = useState({
    title: "", description: "",
    scheduledStartTime: "", durationMinutes: 90, isPenaltyEnabled: true,
    deadline: "", maxAttemptsAllowed: 3,
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // create modal
  const [createOpen, setCreateOpen]   = useState(false);
  const [createType, setCreateType]   = useState<"exam" | "tp">("exam");
  const [createForm, setCreateForm]   = useState<CreateAssessmentRequest>({
    title: "", description: "", moduleId: "",
    visibilityMode: "MODULE_ONLY", strictAccessCode: "",
    scheduledStartTime: "", durationMinutes: 90,
    deadline: "", maxAttempts: 3,
  });
  // Fields from the design that the backend doesn't accept yet — rendered but
  // NOT sent (kept out of the create payload). See backend follow-ups.
  const [pendingFields, setPendingFields] = useState({ passingScore: 60, tpAttemptDurationMin: 0 });
  const [modules, setModules]         = useState<ModuleOption[]>([]);
  const [creating, setCreating]       = useState(false);

  // problem reorder
  const [removing, setRemoving]       = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ── data loading ──────────────────────────────────────────────────────────

  const loadList = useCallback(() => {
    setListLoading(true);
    getAssessments()
      .then(data => { setList(data); if (data.length > 0 && !selected) setSelected(data[0]); })
      .catch(e => toast({ title: "Failed to load assessments", description: e.message, variant: "destructive" }))
      .finally(() => setListLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  useEffect(() => {
    if (!selected) return;
    const id = selected.id || selected.assessmentId;
    setDetailLoading(true);
    getAssessmentDetail(id)
      .then(d => {
        setDetail({ ...selected, ...d });
        const isExam = (selected.type || d.type) === "LIVE_EXAM";
        setSettingsForm({
          title:              d.title || selected.title || "",
          description:        d.description || selected.description || "",
          scheduledStartTime: d.scheduledStartTime ? d.scheduledStartTime.slice(0, 16) : (selected.scheduledStartTime ? String(selected.scheduledStartTime).slice(0, 16) : ""),
          durationMinutes:    d.durationMinutes || selected.durationMinutes || 90,
          isPenaltyEnabled:   d.isPenaltyEnabled ?? true,
          deadline:           d.deadline ? String(d.deadline).slice(0, 16) : (selected.deadline ? String(selected.deadline).slice(0, 16) : ""),
          maxAttemptsAllowed: d.maxAttemptsAllowed || selected.maxAttemptsAllowed || 3,
        });
      })
      .catch(e => toast({ title: "Failed to load assessment detail", description: e.message, variant: "destructive" }))
      .finally(() => setDetailLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  useEffect(() => {
    if (!selected || tab !== "requests") return;
    const id = selected.id || selected.assessmentId;
    setReqLoading(true);
    getAssessmentJoinRequests(id)
      .then(r => setRequests(r.content || r || []))
      .catch(console.error)
      .finally(() => setReqLoading(false));
  }, [selected, tab]);

  useEffect(() => {
    if (!selected || tab !== "submissions") return;
    const id = selected.id || selected.assessmentId;
    setSubLoading(true);
    getExamSubmissions(id)
      .then(data => setSubmissions(Array.isArray(data) ? data : data.content || []))
      .catch(console.error)
      .finally(() => setSubLoading(false));
  }, [selected, tab]);

  // ── problem reorder ───────────────────────────────────────────────────────

  const handleDragEnd = async (event: DragEndEvent) => {
    if (!detail?.problems) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIdx = detail.problems.findIndex((p: any) => p.problemId === active.id);
    const newIdx = detail.problems.findIndex((p: any) => p.problemId === over.id);
    const newOrder = arrayMove(detail.problems, oldIdx, newIdx).map((p: any, i: number) => ({
      ...p, orderIndex: i,
    }));
    setDetail((d: any) => ({ ...d, problems: newOrder }));

    const id = detail.assessmentId || selected?.id;
    try {
      await reorderAssessmentProblems(id, newOrder.map((p: any) => p.problemId));
    } catch (e: any) {
      toast({ title: "Reorder failed", description: e.message, variant: "destructive" });
    }
  };

  const handleRemoveProblem = async (problemId: string) => {
    if (!detail) return;
    const id = detail.assessmentId || selected?.id;
    setRemoving(problemId);
    try {
      await removeAssessmentProblem(id, problemId);
      setDetail((d: any) => ({ ...d, problems: d.problems.filter((p: any) => p.problemId !== problemId) }));
      toast({ title: "Problem removed" });
    } catch (e: any) {
      toast({ title: "Failed to remove", description: e.message, variant: "destructive" });
    }
    setRemoving(null);
  };

  const handlePatchProblem = async (problemId: string, data: any) => {
    if (!detail) return;
    const id = detail.assessmentId || selected?.id;
    try {
      await patchAssessmentProblem(id, problemId, data);
      toast({ title: "Problem updated" });
    } catch (e: any) {
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    }
  };

  // ── picker ────────────────────────────────────────────────────────────────

  const openPicker = async () => {
    setRightMode("picker");
    if (pickerProblems.length === 0) {
      setPickerLoading(true);
      try { setPickerProblems(await getProblemsPicker()); }
      catch (e: any) { toast({ title: "Failed to load problems", description: e.message, variant: "destructive" }); }
      finally { setPickerLoading(false); }
    }
  };

  const handleAttach = async (problemId: string) => {
    if (!detail && !selected) return;
    const id = (detail?.assessmentId) || selected?.id;
    setAttaching(problemId);
    try {
      await addProblemToAssessment(id, problemId);
      const fresh = await getAssessmentDetail(id);
      setDetail((d: any) => ({ ...d, ...fresh }));
      toast({ title: "Problem added" });
    } catch (e: any) {
      toast({ title: "Failed to add problem", description: e.message, variant: "destructive" });
    }
    setAttaching(null);
  };

  // ── join requests ─────────────────────────────────────────────────────────

  const handleApprove = async (requestId: string) => {
    setReqActing(requestId);
    try {
      await approveJoinRequest(requestId);
      setRequests(r => r.filter(x => x.requestId !== requestId));
      toast({ title: "Request approved" });
    } catch (e: any) { toast({ title: "Failed", description: e.message, variant: "destructive" }); }
    setReqActing(null);
  };

  const handleReject = async (requestId: string) => {
    setReqActing(requestId);
    try {
      await rejectJoinRequest(requestId);
      setRequests(r => r.filter(x => x.requestId !== requestId));
      toast({ title: "Request rejected" });
    } catch (e: any) { toast({ title: "Failed", description: e.message, variant: "destructive" }); }
    setReqActing(null);
  };

  const handleBulkApprove = async () => {
    if (!selected || requests.length === 0) return;
    const id = selected.id || selected.assessmentId;
    try {
      await bulkApproveAssessmentRequests(id, requests.map(r => r.requestId));
      setRequests([]);
      toast({ title: "All requests approved" });
    } catch (e: any) { toast({ title: "Failed", description: e.message, variant: "destructive" }); }
  };

  // ── settings save ─────────────────────────────────────────────────────────

  const handleSaveSettings = async () => {
    if (!selected) return;
    const id = selected.id || selected.assessmentId;
    const isExam = (selected.type) === "LIVE_EXAM";
    setSavingSettings(true);
    try {
      const payload: any = {
        title: settingsForm.title,
        description: settingsForm.description,
      };
      if (isExam) {
        payload.durationMinutes    = settingsForm.durationMinutes;
        payload.isPenaltyEnabled   = settingsForm.isPenaltyEnabled;
        payload.scheduledStartTime = settingsForm.scheduledStartTime;
      } else {
        payload.deadline           = settingsForm.deadline;
        payload.maxAttemptsAllowed = settingsForm.maxAttemptsAllowed;
      }
      await patchAssessmentSettings(id, payload);
      setDetail((d: any) => d ? { ...d, ...payload } : d);
      setList(l => l.map(a => (a.id === id || a.assessmentId === id) ? { ...a, title: settingsForm.title } : a));
      toast({ title: "Settings saved" });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    }
    setSavingSettings(false);
  };

  // ── close exam ────────────────────────────────────────────────────────────

  const handleClose = async () => {
    if (!selected) return;
    const id = selected.id || selected.assessmentId;
    try {
      await closeLiveExam(id);
      loadList();
      toast({ title: "Exam closed" });
    } catch (e: any) { toast({ title: "Failed to close", description: e.message, variant: "destructive" }); }
  };

  // ── create assessment ─────────────────────────────────────────────────────

  const openCreate = async (type: "exam" | "tp") => {
    setCreateType(type);
    setCreateOpen(true);
    if (modules.length === 0) {
      try { setModules(await getMyModules()); } catch {}
    }
  };

  const handleCreate = async () => {
    if (!createForm.title.trim()) return;
    setCreating(true);
    try {
      if (createType === "exam") {
        await createLiveExam(createForm);
      } else {
        await createOpenTP(createForm);
      }
      setCreateOpen(false);
      setCreateForm({ title: "", description: "", moduleId: "", visibilityMode: "MODULE_ONLY", strictAccessCode: "", scheduledStartTime: "", durationMinutes: 90, deadline: "", maxAttempts: 3 });
      loadList();
      toast({ title: createType === "exam" ? "Exam created" : "TP created" });
    } catch (e: any) {
      toast({ title: "Failed to create", description: e.message, variant: "destructive" });
    }
    setCreating(false);
  };

  // ── filtered list ─────────────────────────────────────────────────────────

  const filtered = list.filter(a => {
    if (filter === "exam" && a.type !== "LIVE_EXAM") return false;
    if (filter === "tp"   && a.type !== "OPEN_TP")   return false;
    const q = search.trim().toLowerCase();
    return !q || (a.title || "").toLowerCase().includes(q);
  });

  // ── status / type helpers ─────────────────────────────────────────────────

  const typeBadge = (type: string) => {
    if (type === "LIVE_EXAM") return <span className="psp-badge b-live" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span className="psp-dot d-red" />Exam</span>;
    return <span className="psp-badge b-easy">TP</span>;
  };

  const isExam = (a: any) => (a?.type) === "LIVE_EXAM";

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      <Navbar />
      <div className="psp-breadcrumb">
        <Link href="/teacher">{APP_NAME}</Link> › <span style={{ color: "var(--text-primary)" }}>Exams & TPs</span>
      </div>

      <div className="mgr-shell">
        {/* ── LEFT COLUMN ─────────────────────────────────────────────── */}
        <div className="mgr-left">
          <div className="mgr-left-header">
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Assessments</span>
            <div style={{ display: "flex", gap: 4 }}>
              <button className="psp-btn psp-btn-primary psp-btn-sm" onClick={() => openCreate("exam")}>
                <Plus size={11} /> Exam
              </button>
              <button className="psp-btn psp-btn-secondary psp-btn-sm" onClick={() => openCreate("tp")}>
                <Plus size={11} /> TP
              </button>
            </div>
          </div>
          <div className="mgr-left-search">
            <input className="psp-search" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="mgr-filter-row">
            {(["all", "exam", "tp"] as const).map(f => (
              <button key={f} className={`psp-ftab${filter === f ? " on" : ""}`} onClick={() => setFilter(f)}>
                {f === "all" ? "All" : f === "exam" ? "Live Exams" : "Open TPs"}
              </button>
            ))}
          </div>
          <div className="mgr-list">
            {listLoading ? (
              Array(4).fill(0).map((_, i) => (
                <div key={i} className="mgr-skel-item">
                  <div className="skel mgr-skel-line" style={{ width: "70%" }} />
                  <div className="skel mgr-skel-line" style={{ width: "50%" }} />
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div className="psp-empty" style={{ padding: "32px 16px" }}>
                <BookOpen size={24} color="#97a0af" style={{ margin: "0 auto 8px" }} />
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>No assessments</div>
              </div>
            ) : filtered.map(a => {
              const id = a.id || a.assessmentId;
              const isSelected = selected && (selected.id || selected.assessmentId) === id;
              return (
                <div key={id} className={`mgr-list-item${isSelected ? " active" : ""}`}
                  onClick={() => { setSelected(a); setTab("overview"); }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6, marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{a.title}</span>
                    {typeBadge(a.type)}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    {a.moduleName && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{a.moduleName}</span>}
                    {a.visibilityMode && (
                      <span className="psp-badge b-priv" style={{ fontSize: 10 }}>
                        {a.visibilityMode === "MODULE_ONLY" ? <Unlock size={8} style={{ display: "inline", marginRight: 2 }} /> : <Lock size={8} style={{ display: "inline", marginRight: 2 }} />}
                        {a.visibilityMode.replace("_", " ")}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 10, marginTop: 4, fontSize: 11, color: "var(--text-subtle)" }}>
                    {a.type === "LIVE_EXAM" && a.scheduledStartTime && (
                      <span><Calendar size={10} style={{ display: "inline", marginRight: 2 }} />{fmtDate(a.scheduledStartTime)}</span>
                    )}
                    {a.type === "OPEN_TP" && a.deadline && (
                      <span><Timer size={10} style={{ display: "inline", marginRight: 2 }} />Due {fmtDate(a.deadline)}</span>
                    )}
                    {a.problemsCount != null && <span>{a.problemsCount} prob.</span>}
                    {a.pendingRequestCount > 0 && (
                      <span className="psp-badge b-pending" style={{ fontSize: 9 }}>{a.pendingRequestCount} pending</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── CENTER COLUMN ─────────────────────────────────────────────── */}
        <div className="mgr-center">
          {!selected ? (
            <div className="psp-empty" style={{ marginTop: 80 }}>
              <BookOpen size={36} color="var(--border)" style={{ margin: "0 auto 12px" }} />
              <div className="psp-empty-title">Select an assessment</div>
              <div>Choose an exam or TP from the list to manage it</div>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="mgr-center-tabs">
                {(["overview", "problems", "requests", "submissions", "settings"] as Tab[]).map(t => (
                  <button key={t} className={`psp-tab${tab === t ? " active" : ""}`}
                    onClick={() => setTab(t)}>
                    {t === "overview"    ? "Overview"
                     : t === "problems"  ? `Problems${detail ? ` (${detail.problems?.length ?? 0})` : ""}`
                     : t === "requests"  ? `Requests${requests.length > 0 ? ` (${requests.length})` : ""}`
                     : t === "submissions" ? "Submissions"
                     : "Settings"}
                  </button>
                ))}
              </div>

              {/* Tab body */}
              <div className="mgr-center-body">
                {detailLoading ? (
                  <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
                    <Loader2 size={24} style={{ animation: "spin 1s linear infinite", color: "var(--brand)" }} />
                  </div>
                ) : !detail ? null : (
                  <>
                    {/* OVERVIEW */}
                    {tab === "overview" && (
                      <>
                        <div className="mgr-section" style={{ marginBottom: 14 }}>
                          <div className="mgr-section-body">
                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
                              <div>
                                <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>{detail.title}</div>
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                  {typeBadge(detail.type || selected.type)}
                                  {detail.visibilityMode && <span className="psp-badge b-priv">{detail.visibilityMode}</span>}
                                </div>
                              </div>
                              {isExam(selected) && !detail.isClosed && (
                                <button className="psp-btn psp-btn-danger psp-btn-sm" onClick={handleClose}>
                                  <X size={11} /> Close Exam
                                </button>
                              )}
                              {isExam(selected) && detail.isClosed && (
                                <span className="psp-badge b-priv">Closed</span>
                              )}
                            </div>
                            {(() => {
                              const stats = isExam(selected) ? [
                                { label: "Start", val: fmtDate(detail.scheduledStartTime || selected.scheduledStartTime) },
                                { label: "Duration", val: fmtDuration(detail.durationMinutes || selected.durationMinutes) },
                                { label: "Problems", val: detail.problems?.length ?? 0 },
                                { label: "Penalty", val: detail.isPenaltyEnabled ? "On" : "Off" },
                              ] : [
                                { label: "Deadline", val: fmtDate(detail.deadline || selected.deadline) },
                                { label: "Max Attempts", val: String(detail.maxAttemptsAllowed || selected.maxAttemptsAllowed || "∞") },
                                { label: "Problems", val: detail.problems?.length ?? 0 },
                                { label: "Module", val: selected.moduleName || "—" },
                              ];
                              return (
                                <div className="mgr-stats-row">
                                  {stats.map(s => (
                                    <div key={s.label} className="mgr-stat-box">
                                      <div className="mgr-stat-box-val" style={{ fontSize: ["Start","Deadline"].includes(s.label) ? 11 : 20 }}>{String(s.val)}</div>
                                      <div className="mgr-stat-box-lbl">{s.label}</div>
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}
                            {detail.description && <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 12 }}>{detail.description}</p>}
                          </div>
                        </div>

                        {isExam(selected) && !detail.isClosed && (detail.scheduledStartTime || selected.scheduledStartTime) && (
                          <div className="psp-alert psp-alert-info">
                            <Calendar size={14} />
                            <span>
                              {countdown(detail.scheduledStartTime || selected.scheduledStartTime) === "Started"
                                ? "Exam is currently live"
                                : <>Starts in <strong>{countdown(detail.scheduledStartTime || selected.scheduledStartTime)}</strong></>}
                            </span>
                          </div>
                        )}
                      </>
                    )}

                    {/* PROBLEMS */}
                    {tab === "problems" && (
                      <>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                            Problems ({detail.problems?.length ?? 0})
                          </span>
                          <button className="psp-btn psp-btn-secondary psp-btn-sm" onClick={openPicker}>
                            <Plus size={11} /> Add from Bank
                          </button>
                        </div>
                        {(!detail.problems || detail.problems.length === 0) ? (
                          <div className="psp-empty" style={{ border: "1px dashed var(--border)", borderRadius: 3 }}>
                            <FileText size={24} color="var(--border)" style={{ margin: "0 auto 8px" }} />
                            <div className="psp-empty-title">No problems yet</div>
                            <div style={{ marginTop: 8 }}>
                              <button className="psp-btn psp-btn-primary psp-btn-sm" onClick={openPicker}><Plus size={11} /> Add from Bank</button>
                            </div>
                          </div>
                        ) : (
                          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext items={detail.problems.map((p: any) => p.problemId)} strategy={verticalListSortingStrategy}>
                              {detail.problems.map((ap: any) => (
                                <SortableAssessmentProblemRow
                                  key={ap.problemId} ap={ap}
                                  onRemove={handleRemoveProblem}
                                  onPatch={handlePatchProblem}
                                  removing={removing}
                                />
                              ))}
                            </SortableContext>
                          </DndContext>
                        )}
                      </>
                    )}

                    {/* JOIN REQUESTS */}
                    {tab === "requests" && (
                      <>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                            Pending Requests
                            {requests.length > 0 && <span className="psp-badge b-pending" style={{ marginLeft: 8 }}>{requests.length}</span>}
                          </span>
                          {requests.length > 0 && (
                            <button className="psp-btn psp-btn-success psp-btn-sm" onClick={handleBulkApprove}>
                              <CheckCircle2 size={11} /> Approve All
                            </button>
                          )}
                        </div>
                        {reqLoading ? (
                          <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                            <Loader2 size={20} style={{ animation: "spin 1s linear infinite", color: "var(--brand)" }} />
                          </div>
                        ) : requests.length === 0 ? (
                          <div className="psp-empty" style={{ border: "1px solid var(--border)", borderRadius: 3 }}>
                            <CheckCircle2 size={28} color="#00875a" style={{ margin: "0 auto 8px" }} />
                            <div className="psp-empty-title">All clear!</div>
                            <div>No pending requests</div>
                          </div>
                        ) : (
                          <div className="mgr-section">
                            {requests.map(r => {
                              const fullName = [r.firstName, r.lastName].filter(Boolean).join(" ") || "Unknown Student";
                              const acting = reqActing === r.requestId;
                              return (
                                <div key={r.requestId} style={{ padding: "10px 16px", borderBottom: "1px solid #f4f5f7", display: "flex", alignItems: "center", gap: 10 }}>
                                  <div className="req-avatar">{initials(r.firstName ?? "", r.lastName ?? "")}</div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{fullName}</div>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 2, alignItems: "center" }}>
                                      {r.apogeeNumber && (
                                        <span style={{ fontSize: 10, color: "var(--text-muted)", background: "var(--bg-secondary)", padding: "1px 5px", borderRadius: 2, fontFamily: "monospace" }}>{r.apogeeNumber}</span>
                                      )}
                                      {r.divisionName && <span style={{ fontSize: 11, color: "var(--text-subtle)" }}>{r.divisionName}{r.semesterName ? ` · ${r.semesterName}` : ""}</span>}
                                      {r.email && <span style={{ fontSize: 11, color: "var(--text-subtle)" }}>{r.email}</span>}
                                    </div>
                                    {r.message && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3, fontStyle: "italic" }}>"{r.message}"</div>}
                                  </div>
                                  {r.requestedAt && <span style={{ fontSize: 10, color: "var(--text-subtle)", flexShrink: 0, whiteSpace: "nowrap" }}>{fmtRelative(r.requestedAt)}</span>}
                                  {r.status === "PENDING" ? (
                                    <>
                                      <button className="req-btn req-btn-approve" disabled={acting} onClick={() => handleApprove(r.requestId)}>
                                        {acting ? <Loader2 size={10} /> : <CheckCircle2 size={10} />} {acting ? "…" : "Approve"}
                                      </button>
                                      <button className="req-btn req-btn-reject" disabled={acting} onClick={() => handleReject(r.requestId)}>
                                        <X size={10} /> Reject
                                      </button>
                                    </>
                                  ) : (
                                    <span className={`psp-badge ${r.status === "APPROVED" ? "b-pass" : "b-hard"}`} style={{ flexShrink: 0 }}>
                                      {r.status === "APPROVED" ? <span style={{display:"inline-flex",alignItems:"center",gap:4}}><Check size={12} /> Approved</span> : <span style={{display:"inline-flex",alignItems:"center",gap:4}}><X size={12} /> Rejected</span>}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}

                    {/* SUBMISSIONS */}
                    {tab === "submissions" && (
                      <>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Submissions</span>
                          <button className="psp-btn psp-btn-secondary psp-btn-sm"
                            onClick={() => {
                              const id = selected.id || selected.assessmentId;
                              setSubLoading(true);
                              getExamSubmissions(id)
                                .then(d => setSubmissions(Array.isArray(d) ? d : d.content || []))
                                .finally(() => setSubLoading(false));
                            }}>
                            <RefreshCw size={11} /> Refresh
                          </button>
                        </div>
                        {subLoading ? (
                          <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                            <Loader2 size={20} style={{ animation: "spin 1s linear infinite", color: "var(--brand)" }} />
                          </div>
                        ) : submissions.length === 0 ? (
                          <div className="psp-empty" style={{ border: "1px solid var(--border)", borderRadius: 3 }}>
                            <FileText size={28} color="var(--border)" style={{ margin: "0 auto 8px" }} />
                            <div className="psp-empty-title">No submissions yet</div>
                          </div>
                        ) : (
                          <>
                            <div className="mgr-section">
                              <table className="psp-table">
                                <thead>
                                  <tr>
                                    <th>Student</th>
                                    <th>Problem</th>
                                    <th>Status</th>
                                    <th className="text-right">Score</th>
                                    <th>Time</th>
                                    {isExam(selected) && <th>Actions</th>}
                                  </tr>
                                </thead>
                                <tbody>
                                  {submissions.map((s: any, i: number) => (
                                    <tr key={s.id || i}>
                                      <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{s.studentName || s.student?.name || s.studentId?.slice(0, 8) || "—"}</td>
                                      <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{s.problemTitle || s.problem?.title || "—"}</td>
                                      <td>
                                        <span className={`psp-badge ${s.result === "ACCEPTED" || s.status === "ACCEPTED" ? "b-pass" : s.result === "PENDING" || s.status === "PENDING" ? "b-pending" : "b-hard"}`}>
                                          {s.result || s.status || "—"}
                                        </span>
                                      </td>
                                      <td style={{ textAlign: "right", fontWeight: 600, color: "var(--brand)" }}>{s.score ?? "—"}</td>
                                      <td style={{ fontSize: 11, color: "var(--text-subtle)" }}>{s.timestamp ? fmtDate(s.timestamp) : "—"}</td>
                                      {isExam(selected) && (
                                        <td>
                                          {penaltyForm?.id === (s.id || String(i)) ? (
                                            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                                              <input type="number" placeholder="pts" style={{ width: 52, height: 24, fontSize: 11, border: "1px solid var(--border)", borderRadius: 3, padding: "0 4px" }}
                                                value={penaltyForm!.value}
                                                onChange={e => setPenaltyForm(f => f ? { ...f, value: e.target.value } : f)} />
                                              <button style={{ background: "var(--red-light)", color: "#bf2600", border: "none", borderRadius: 3, padding: "2px 6px", fontSize: 10, cursor: "pointer" }}
                                                disabled={penalizing === (s.id || String(i))}
                                                onClick={async () => {
                                                  if (!penaltyForm) return;
                                                  setPenalizing(s.id || String(i));
                                                  try {
                                                    await overridePenalty(s.id, { penaltyValue: Number(penaltyForm.value), reason: penaltyForm.reason || "Manual penalty" });
                                                    setPenaltyForm(null);
                                                    toast({ title: "Penalty applied" });
                                                  } catch (e: any) { toast({ title: "Failed", description: e.message, variant: "destructive" }); }
                                                  setPenalizing(null);
                                                }}>
                                                {penalizing === (s.id || String(i)) ? <Loader2 size={9} /> : "OK"}
                                              </button>
                                              <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }} onClick={() => setPenaltyForm(null)}><X size={11} /></button>
                                            </div>
                                          ) : (
                                            <button style={{ background: "#fff0b3", color: "var(--text-primary)", border: "none", padding: "2px 8px", borderRadius: 3, fontSize: 10, fontWeight: 600, cursor: "pointer" }}
                                              onClick={() => setPenaltyForm({ id: s.id || String(i), value: "10", reason: "" })}>
                                              <AlertTriangle size={9} style={{ display: "inline", marginRight: 2 }} />Penalize
                                            </button>
                                          )}
                                        </td>
                                      )}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </>
                        )}
                      </>
                    )}

                    {/* SETTINGS */}
                    {tab === "settings" && (
                      <>
                        <div className="mgr-section" style={{ marginBottom: 14 }}>
                          <div className="mgr-section-title"><Settings size={12} /> Assessment Settings</div>
                          <div className="mgr-section-body">
                            <div style={{ display: "grid", gap: 14 }}>
                              <div>
                                <label className="psp-form-label">Title</label>
                                <input className="psp-form-input" value={settingsForm.title}
                                  onChange={e => setSettingsForm(f => ({ ...f, title: e.target.value }))} />
                              </div>
                              <div>
                                <label className="psp-form-label">Description</label>
                                <textarea className="psp-form-textarea" value={settingsForm.description}
                                  onChange={e => setSettingsForm(f => ({ ...f, description: e.target.value }))} />
                              </div>

                              {isExam(selected) ? (
                                <>
                                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                    <div>
                                      <label className="psp-form-label">Start Date & Time</label>
                                      <input type="datetime-local" className="psp-form-input"
                                        value={settingsForm.scheduledStartTime}
                                        onChange={e => setSettingsForm(f => ({ ...f, scheduledStartTime: e.target.value }))} />
                                    </div>
                                    <div>
                                      <label className="psp-form-label">Duration (minutes)</label>
                                      <input type="number" className="psp-form-input"
                                        value={settingsForm.durationMinutes}
                                        onChange={e => setSettingsForm(f => ({ ...f, durationMinutes: parseInt(e.target.value) || 90 }))} />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="psp-form-label" style={{ marginBottom: 8 }}>Penalty</label>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                      <div className={`psp-toggle${settingsForm.isPenaltyEnabled ? " on" : ""}`}
                                        onClick={() => setSettingsForm(f => ({ ...f, isPenaltyEnabled: !f.isPenaltyEnabled }))}>
                                        <div className="psp-toggle-knob" />
                                      </div>
                                      <span style={{ fontSize: 13, color: "var(--text-primary)" }}>Enable score penalty for late/wrong submissions</span>
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div>
                                    <label className="psp-form-label">Deadline</label>
                                    <input type="datetime-local" className="psp-form-input"
                                      value={settingsForm.deadline}
                                      onChange={e => setSettingsForm(f => ({ ...f, deadline: e.target.value }))} />
                                  </div>
                                  <div>
                                    <label className="psp-form-label">Max Attempts Allowed</label>
                                    <input type="number" className="psp-form-input"
                                      value={settingsForm.maxAttemptsAllowed}
                                      onChange={e => setSettingsForm(f => ({ ...f, maxAttemptsAllowed: parseInt(e.target.value) || 3 }))} />
                                  </div>
                                </>
                              )}

                              <button className="psp-btn psp-btn-primary" style={{ alignSelf: "flex-start" }}
                                disabled={savingSettings} onClick={handleSaveSettings}>
                                {savingSettings ? <Loader2 size={13} /> : null} Save Changes
                              </button>
                            </div>
                          </div>
                        </div>
                        <div className="mgr-danger">
                          <div className="mgr-danger-title" style={{display:"flex",alignItems:"center",gap:6}}><AlertTriangle size={13} /> Danger Zone</div>
                          <div style={{ display: "flex", gap: 10 }}>
                            {isExam(selected) && !detail.isClosed && (
                              <button className="psp-btn psp-btn-danger psp-btn-sm" onClick={handleClose}>Close Exam</button>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── RIGHT COLUMN ─────────────────────────────────────────────── */}
        <div className="mgr-right">
          {rightMode === "quickActions" && (
            <>
              <div className="mgr-right-header">Quick Actions</div>
              <div className="mgr-right-body">
                {!detail ? (
                  <div style={{ fontSize: 12, color: "var(--text-subtle)", textAlign: "center", padding: 24 }}>Select an assessment</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <button className="psp-btn psp-btn-secondary" style={{ width: "100%", justifyContent: "center" }} onClick={openPicker}>
                      <Plus size={13} /> Add Problem
                    </button>
                    <button className="psp-btn psp-btn-secondary" style={{ width: "100%", justifyContent: "center" }} onClick={() => setTab("requests")}>
                      <Users size={13} /> View Requests
                    </button>
                    <button className="psp-btn psp-btn-secondary" style={{ width: "100%", justifyContent: "center" }} onClick={() => setTab("submissions")}>
                      <FileText size={13} /> Submissions
                    </button>
                    <button className="psp-btn psp-btn-secondary" style={{ width: "100%", justifyContent: "center" }} onClick={() => setTab("settings")}>
                      <Settings size={13} /> Settings
                    </button>
                    {isExam(selected) && !detail.isClosed && (
                      <button className="psp-btn psp-btn-danger" style={{ width: "100%", justifyContent: "center" }} onClick={handleClose}>
                        <X size={13} /> Close Exam
                      </button>
                    )}
                    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: 4 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Info</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {[
                          ["Type",       selected.type === "LIVE_EXAM" ? "Live Exam" : "Open TP"],
                          ["Module",     safeStr(selected.moduleName)],
                          ["Visibility", safeStr(selected.visibilityMode).replace(/_/g, " ") || "—"],
                          ...(isExam(selected) ? [
                            ["Start",    fmtDate(detail.scheduledStartTime || selected.scheduledStartTime)],
                            ["Duration", fmtDuration(detail.durationMinutes || selected.durationMinutes)],
                            ["Penalty",  detail.isPenaltyEnabled === true ? "Enabled" : detail.isPenaltyEnabled === false ? "Disabled" : "—"],
                          ] : [
                            ["Deadline",     fmtDate(detail.deadline || selected.deadline)],
                            ["Max Attempts", safeStr(detail.maxAttemptsAllowed ?? selected.maxAttemptsAllowed ?? "∞")],
                          ]),
                        ].map(([k, v]) => (
                          <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                            <span style={{ color: "var(--text-muted)" }}>{k}</span>
                            <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {rightMode === "picker" && (
            <>
              <div className="mgr-right-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>Add from Bank</span>
                <button onClick={() => setRightMode("quickActions")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={14} /></button>
              </div>
              <div style={{ padding: "8px 16px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
                <input className="psp-search" placeholder="Search problems…" value={pickerSearch}
                  onChange={e => setPickerSearch(e.target.value)} />
                <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                  {["all","EASY","MEDIUM","HARD"].map(f => (
                    <button key={f} className={`psp-ftab${pickerFilter === f ? " on" : ""}`}
                      onClick={() => setPickerFilter(f)} style={{ fontSize: 10 }}>
                      {f === "all" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mgr-right-body" style={{ padding: 0 }}>
                {pickerLoading ? (
                  <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
                    <Loader2 size={18} style={{ animation: "spin 1s linear infinite", color: "var(--brand)" }} />
                  </div>
                ) : (
                  pickerProblems
                    .filter(p => {
                      const matchQ = !pickerSearch || p.title.toLowerCase().includes(pickerSearch.toLowerCase());
                      const matchF = pickerFilter === "all" || p.difficulty === pickerFilter;
                      const alreadyAdded = detail?.problems?.some((dp: any) => dp.problemId === p.problemId);
                      return matchQ && matchF && !alreadyAdded;
                    })
                    .map(p => {
                      const diffCls = p.difficulty === "EASY" ? "b-easy" : p.difficulty === "MEDIUM" ? "b-med" : "b-hard";
                      return (
                        <div key={p.problemId} style={{ padding: "8px 16px", borderBottom: "1px solid #f4f5f7", display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{p.title}</div>
                            <span className={`psp-badge ${diffCls}`} style={{ marginTop: 2 }}>{p.difficulty}</span>
                          </div>
                          <button className="psp-btn psp-btn-primary psp-btn-sm"
                            disabled={attaching === p.problemId}
                            onClick={() => handleAttach(p.problemId)}>
                            {attaching === p.problemId ? <Loader2 size={10} /> : <Plus size={10} />}
                          </button>
                        </div>
                      );
                    })
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Create Assessment Modal */}
      {createOpen && (
        <div className="psp-modal-overlay" onClick={() => setCreateOpen(false)}>
          <div className="psp-modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div className="psp-modal-header">
              <span style={{ fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                {createType === "exam" ? <FileText size={16} color="var(--brand)" /> : <FlaskConical size={16} color="var(--success)" />}
                {createType === "exam" ? "New Live Exam" : "New Open TP"}
              </span>
              <button onClick={() => setCreateOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={18} /></button>
            </div>
            <div className="psp-modal-body" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* ── Section: Basics ── */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div className="section-title" style={{ marginBottom: 0 }}>Basics</div>
                <div>
                  <label className="psp-form-label">Title *</label>
                  <input className="psp-form-input" autoFocus value={createForm.title}
                    onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))} placeholder={createType === "exam" ? "e.g. Midterm — Data Structures" : "e.g. Lab 3 — Recursion"} />
                </div>
                <div>
                  <label className="psp-form-label">Description</label>
                  <textarea className="psp-form-textarea" value={createForm.description}
                    onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                    style={{ minHeight: 64 }} />
                </div>
                <div>
                  <label className="psp-form-label">Module</label>
                  <select className="psp-form-select" value={createForm.moduleId}
                    onChange={e => setCreateForm(f => ({ ...f, moduleId: e.target.value }))}>
                    <option value="">Select module…</option>
                    {modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              </div>

              {/* ── Section: Schedule & access ── */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
                <div className="section-title" style={{ marginBottom: 0 }}>Schedule &amp; access</div>
                {createType === "exam" ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label className="psp-form-label">Start date &amp; time</label>
                      <input type="datetime-local" className="psp-form-input" value={createForm.scheduledStartTime}
                        onChange={e => setCreateForm(f => ({ ...f, scheduledStartTime: e.target.value }))} />
                    </div>
                    <div>
                      <label className="psp-form-label">Duration (mins)</label>
                      <input type="number" className="psp-form-input" value={createForm.durationMinutes}
                        onChange={e => setCreateForm(f => ({ ...f, durationMinutes: parseInt(e.target.value) || 90 }))} />
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label className="psp-form-label">Deadline</label>
                      <input type="datetime-local" className="psp-form-input" value={createForm.deadline}
                        onChange={e => setCreateForm(f => ({ ...f, deadline: e.target.value }))} />
                    </div>
                    <div>
                      <label className="psp-form-label">Max attempts</label>
                      <input type="number" className="psp-form-input" value={createForm.maxAttempts}
                        onChange={e => setCreateForm(f => ({ ...f, maxAttempts: parseInt(e.target.value) || 3 }))} />
                    </div>
                  </div>
                )}
                <div>
                  <label className="psp-form-label">Visibility</label>
                  <select className="psp-form-select" value={createForm.visibilityMode}
                    onChange={e => setCreateForm(f => ({ ...f, visibilityMode: e.target.value }))}>
                    <option value="MODULE_ONLY">Module only</option>
                    <option value="REQUEST_BASED">Request based</option>
                    <option value="ACCESS_CODE">Access code</option>
                  </select>
                </div>
                {createForm.visibilityMode === "ACCESS_CODE" && (
                  <div>
                    <label className="psp-form-label">Access code</label>
                    <input className="psp-form-input" value={createForm.strictAccessCode}
                      onChange={e => setCreateForm(f => ({ ...f, strictAccessCode: e.target.value }))} placeholder="Students enter this code to join" />
                  </div>
                )}
              </div>

              {/* ── Section: Grading (fields pending backend support) ── */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
                <div className="section-title" style={{ marginBottom: 0 }}>Grading</div>
                {createType === "exam" ? (
                  <div>
                    <label className="psp-form-label">Passing score (%)</label>
                    <input type="number" min={0} max={100} className="psp-form-input" value={pendingFields.passingScore}
                      onChange={e => setPendingFields(f => ({ ...f, passingScore: parseInt(e.target.value) || 0 }))} />
                    <div className="hint">Pass/fail threshold. Not yet enforced by the backend — see follow-ups.</div>
                  </div>
                ) : (
                  <div>
                    <label className="psp-form-label">Attempt duration (mins, optional)</label>
                    <input type="number" min={0} className="psp-form-input" value={pendingFields.tpAttemptDurationMin}
                      onChange={e => setPendingFields(f => ({ ...f, tpAttemptDurationMin: parseInt(e.target.value) || 0 }))} placeholder="0 = no limit" />
                    <div className="hint">Per-attempt time limit. Not yet enforced by the backend — see follow-ups.</div>
                  </div>
                )}
              </div>
            </div>
            <div className="psp-modal-footer">
              <button className="psp-btn psp-btn-secondary" onClick={() => setCreateOpen(false)}>Cancel</button>
              <button className="psp-btn psp-btn-primary" onClick={handleCreate} disabled={creating}
                style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {creating ? <Loader2 size={13} /> : <Plus size={13} />} Create
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
