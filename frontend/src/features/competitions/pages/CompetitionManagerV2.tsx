"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { APP_NAME } from "@/lib/brand";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import {
  Trophy, Plus, Calendar, Timer, Users, Lock, Unlock, Flame, Loader2,
  GripVertical, ChevronDown, ChevronUp, Copy, Check, X, Settings,
  BarChart2, Search, AlertTriangle, CheckCircle2, RefreshCw, Trash2,
} from "lucide-react";
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
  getCompetitions, getCompetitionDetail, createCompetition, publishCompetition,
  attachCompetitionProblem, detachCompetitionProblem,
  getCompetitionJoinRequests, approveJoinRequest, rejectJoinRequest,
  bulkApproveCompetitionRequests, getCompetitionScoreboard,
  getProblemsPicker, ProblemPickerItem, CreateCompetitionRequest,
  reorderCompetitionProblems, patchCompetitionProblem,
  patchCompetitionPenalty, patchCompetitionSettings,
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

function safeVisibility(v: unknown): string {
  if (v === "REQUEST_BASED") return "Request Based";
  if (v === "ACCESS_CODE")   return "Access Code";
  if (v === "PUBLIC_OPEN")   return "Public Open";
  if (v === "OPEN")          return "Open";
  return v ? String(v) : "—";
}

function safePenalty(enabled: unknown, minutes: unknown): string {
  if (enabled === true)  return `${minutes ?? 10}min per WA`;
  if (enabled === false) return "Disabled";
  return "—";
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

type Tab = "overview" | "problems" | "requests" | "scoreboard" | "settings";
type RightMode = "quickActions" | "picker" | "createProblem";

// ─── SortableProblemRow ────────────────────────────────────────────────────

function SortableProblemRow({
  cp, onRemove, onPatch, removing,
}: {
  cp: any; onRemove: (id: string) => void; onPatch: (id: string, data: any) => void; removing: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [pts, setPts]     = useState<string>(String(cp.points ?? 500));
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: cp.problemId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const diffCls = cp.difficultyLevel === "EASY" ? "b-easy" : cp.difficultyLevel === "MEDIUM" ? "b-med" : "b-hard";

  return (
    <div ref={setNodeRef} style={style} className="mgr-prob-row">
      <div className="mgr-prob-row-main" onClick={() => setExpanded(e => !e)}>
        <span className="mgr-drag-handle" {...attributes} {...listeners} onClick={e => e.stopPropagation()}>
          <GripVertical size={14} />
        </span>
        <span style={{ width: 22, height: 22, background: "var(--brand)", color: "white", borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
          {cp.label}
        </span>
        <span style={{ flex: 1, fontWeight: 600, fontSize: 13, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {cp.title}
        </span>
        <span className={`psp-badge ${diffCls}`}>{cp.difficultyLevel}</span>
        <span style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{cp.points} pts</span>
        <span style={{ fontSize: 12, color: "var(--text-subtle)", whiteSpace: "nowrap" }}>{cp.timeLimitMs}ms</span>
        {expanded ? <ChevronUp size={14} color="#5e6c84" /> : <ChevronDown size={14} color="#5e6c84" />}
      </div>
      {expanded && (
        <div className="mgr-prob-expand">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label className="psp-form-label">Max Points</label>
              <div style={{ display: "flex", gap: 6 }}>
                <input className="psp-form-input" type="number" value={pts}
                  onChange={e => setPts(e.target.value)}
                  style={{ height: 28, fontSize: 12 }} />
                <button className="psp-btn psp-btn-secondary psp-btn-sm"
                  onClick={() => onPatch(cp.problemId, { maxPoints: parseInt(pts) || cp.points })}>
                  Save
                </button>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button className="psp-btn psp-btn-danger psp-btn-sm"
                disabled={removing === cp.problemId}
                onClick={() => onRemove(cp.problemId)}>
                {removing === cp.problemId ? <Loader2 size={11} /> : <Trash2 size={11} />} Remove
              </button>
            </div>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
            Time limit: {cp.timeLimitMs}ms · Memory: {cp.memoryLimitMb ?? 256}MB
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────

export default function CompetitionManagerV2() {
  const { toast } = useToast();

  // left column
  const [list, setList]           = useState<any[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [search, setSearch]       = useState("");
  const [filter, setFilter]       = useState<"all" | "registration" | "active" | "ended">("all");

  // center
  const [selected, setSelected]   = useState<any | null>(null);
  const [detail, setDetail]       = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [tab, setTab]             = useState<Tab>("overview");

  // right column
  const [rightMode, setRightMode] = useState<RightMode>("quickActions");
  const [pickerProblems, setPickerProblems] = useState<ProblemPickerItem[]>([]);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerFilter, setPickerFilter] = useState("all");
  const [pickerLoading, setPickerLoading] = useState(false);
  const [attaching, setAttaching] = useState<string | null>(null);

  // join requests
  const [requests, setRequests]   = useState<any[]>([]);
  const [reqLoading, setReqLoading] = useState(false);
  const [reqActing, setReqActing] = useState<string | null>(null);

  // scoreboard
  const [scoreboard, setScoreboard] = useState<any[]>([]);
  const [sbLoading, setSbLoading] = useState(false);

  // settings
  const [settingsForm, setSettingsForm] = useState({ title: "", description: "", durationMinutes: 120, penaltyEnabled: false, penaltyMinutes: 10 });
  const [savingSettings, setSavingSettings] = useState(false);

  // create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateCompetitionRequest>({
    title: "", description: "", mode: "SOLO", accessType: "REQUEST_BASED",
    scheduledStartTime: "", durationMinutes: 120, minTeamSize: 2, maxTeamSize: 4,
    scoringMode: "ICPC", freezeEnabled: false, freezeMinutesBeforeEnd: 60,
  });
  const [creating, setCreating] = useState(false);

  // problem reorder
  const [removing, setRemoving] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ── data loading ──────────────────────────────────────────────────────────

  const loadList = useCallback(() => {
    setListLoading(true);
    getCompetitions()
      .then(data => { setList(data); if (data.length > 0 && !selected) setSelected(data[0]); })
      .catch(e => toast({ title: "Failed to load competitions", description: e.message, variant: "destructive" }))
      .finally(() => setListLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  useEffect(() => {
    if (!selected) return;
    const id = selected.competitionId || selected.id;
    setDetailLoading(true);
    getCompetitionDetail(id)
      .then(d => {
        setDetail(d);
        setSettingsForm({
          title: d.title || "",
          description: d.description || "",
          durationMinutes: d.durationMinutes || 120,
          penaltyEnabled: d.penaltyEnabled || false,
          penaltyMinutes: d.penaltyMinutes ?? 10,
        });
      })
      .catch(e => toast({ title: "Failed to load competition detail", description: e.message, variant: "destructive" }))
      .finally(() => setDetailLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  useEffect(() => {
    if (!selected || tab !== "requests") return;
    const id = selected.competitionId || selected.id;
    setReqLoading(true);
    getCompetitionJoinRequests(id)
      .then(r => setRequests(r.content || r || []))
      .catch(console.error)
      .finally(() => setReqLoading(false));
  }, [selected, tab]);

  useEffect(() => {
    if (!selected || tab !== "scoreboard") return;
    const id = selected.competitionId || selected.id;
    setSbLoading(true);
    getCompetitionScoreboard(id)
      .then(setScoreboard)
      .catch(console.error)
      .finally(() => setSbLoading(false));
  }, [selected, tab]);

  // ── problem reorder ───────────────────────────────────────────────────────

  const handleDragEnd = async (event: DragEndEvent) => {
    if (!detail) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIdx = detail.problems.findIndex((p: any) => p.problemId === active.id);
    const newIdx = detail.problems.findIndex((p: any) => p.problemId === over.id);
    const newOrder = arrayMove(detail.problems, oldIdx, newIdx).map((p: any, i: number) => ({
      ...p, orderIndex: i, label: String.fromCharCode(65 + i),
    }));
    setDetail((d: any) => ({ ...d, problems: newOrder }));

    try {
      await reorderCompetitionProblems(detail.competitionId, newOrder.map((p: any) => p.problemId));
    } catch (e: any) {
      toast({ title: "Reorder failed", description: e.message, variant: "destructive" });
    }
  };

  const handleRemoveProblem = async (problemId: string) => {
    if (!detail) return;
    const id = detail.competitionId;
    setRemoving(problemId);
    try {
      await detachCompetitionProblem(id, problemId);
      setDetail((d: any) => ({ ...d, problems: d.problems.filter((p: any) => p.problemId !== problemId) }));
      toast({ title: "Problem removed" });
    } catch (e: any) {
      toast({ title: "Failed to remove", description: e.message, variant: "destructive" });
    }
    setRemoving(null);
  };

  const handlePatchProblem = async (problemId: string, data: any) => {
    if (!detail) return;
    try {
      await patchCompetitionProblem(detail.competitionId, problemId, data);
      if (data.maxPoints !== undefined) {
        setDetail((d: any) => ({ ...d, problems: d.problems.map((p: any) => p.problemId === problemId ? { ...p, points: data.maxPoints } : p) }));
      }
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
    if (!detail) return;
    setAttaching(problemId);
    try {
      await attachCompetitionProblem(detail.competitionId, problemId);
      const fresh = await getCompetitionDetail(detail.competitionId);
      setDetail(fresh);
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
    const id = selected.competitionId || selected.id;
    try {
      await bulkApproveCompetitionRequests(id, requests.map(r => r.requestId));
      setRequests([]);
      toast({ title: "All requests approved" });
    } catch (e: any) { toast({ title: "Failed", description: e.message, variant: "destructive" }); }
  };

  // ── settings save ─────────────────────────────────────────────────────────

  const handleSaveSettings = async () => {
    if (!detail) return;
    setSavingSettings(true);
    try {
      await patchCompetitionSettings(detail.competitionId, {
        title: settingsForm.title,
        description: settingsForm.description,
        durationMinutes: settingsForm.durationMinutes,
      });
      await patchCompetitionPenalty(detail.competitionId, {
        penaltyEnabled: settingsForm.penaltyEnabled,
        penaltyMinutes: settingsForm.penaltyMinutes,
      });
      setDetail((d: any) => ({ ...d, ...settingsForm }));
      toast({ title: "Settings saved" });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    }
    setSavingSettings(false);
  };

  // ── create competition ────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!createForm.title.trim()) return;
    setCreating(true);
    try {
      const payload = { ...createForm };
      if (payload.mode !== "TEAM") { delete payload.minTeamSize; delete payload.maxTeamSize; }
      await createCompetition(payload);
      setCreateOpen(false);
      setCreateForm({ title: "", description: "", mode: "SOLO", accessType: "REQUEST_BASED", scheduledStartTime: "", durationMinutes: 120, minTeamSize: 2, maxTeamSize: 4 });
      loadList();
      toast({ title: "Competition created" });
    } catch (e: any) {
      toast({ title: "Failed to create", description: e.message, variant: "destructive" });
    }
    setCreating(false);
  };

  // ── filtered list ─────────────────────────────────────────────────────────

  const filtered = list.filter(c => {
    const s = (c.status || "").toUpperCase();
    if (filter === "registration" && s !== "REGISTRATION") return false;
    if (filter === "active"       && s !== "ACTIVE")       return false;
    if (filter === "ended"        && s !== "ENDED")        return false;
    const q = search.trim().toLowerCase();
    return !q || (c.title || "").toLowerCase().includes(q);
  });

  // ── status helpers ────────────────────────────────────────────────────────

  const statusBadge = (status: string) => {
    const s = (status || "").toUpperCase();
    if (s === "ACTIVE")       return <span className="psp-badge b-live" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span className="psp-dot d-red d-blink" />{s}</span>;
    if (s === "REGISTRATION") return <span className="psp-badge b-solo">REGISTRATION</span>;
    if (s === "ENDED")        return <span className="psp-badge b-priv">ENDED</span>;
    return <span className="psp-badge b-pending">{s}</span>;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      <Navbar />
      <div className="psp-breadcrumb">
        <Link href="/teacher">{APP_NAME}</Link> › <span style={{ color: "var(--text-primary)" }}>Competitions</span>
      </div>

      <div className="mgr-shell">
        {/* ── LEFT COLUMN ─────────────────────────────────────────────── */}
        <div className="mgr-left">
          <div className="mgr-left-header">
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Competitions</span>
            <button className="psp-btn psp-btn-primary psp-btn-sm" onClick={() => setCreateOpen(true)}>
              <Plus size={11} /> New
            </button>
          </div>
          <div className="mgr-left-search">
            <input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="mgr-filter-row">
            {(["all","registration","active","ended"] as const).map(f => (
              <button key={f} className={`psp-ftab${filter === f ? " on" : ""}`} onClick={() => setFilter(f)}>
                {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
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
                <Trophy size={24} color="#97a0af" style={{ margin: "0 auto 8px" }} />
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>No competitions</div>
              </div>
            ) : filtered.map(c => {
              const id = c.competitionId || c.id;
              const isSelected = selected && (selected.competitionId || selected.id) === id;
              const s = (c.status || "").toUpperCase();
              return (
                <div key={id} className={`mgr-list-item${isSelected ? " active" : ""}`} onClick={() => { setSelected(c); setTab("overview"); }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6, marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{c.title}</span>
                    {statusBadge(c.status)}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <span className={`psp-badge ${(c.mode || "SOLO") === "TEAM" ? "b-comp" : "b-solo"}`} style={{ fontSize: 10 }}>{c.mode || "SOLO"}</span>
                    {c.startTime && <span style={{ fontSize: 11, color: "var(--text-muted)" }}><Calendar size={10} style={{ display: "inline", marginRight: 2 }} />{fmtDate(c.startTime)}</span>}
                  </div>
                  <div style={{ display: "flex", gap: 10, marginTop: 4, fontSize: 11, color: "var(--text-subtle)" }}>
                    {c.durationMinutes && <span>{fmtDuration(c.durationMinutes)}</span>}
                    {c.problemCount != null && <span>{c.problemCount} prob.</span>}
                    {c.participantCount != null && <span>{c.participantCount} reg.</span>}
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
              <Trophy size={36} color="var(--border)" style={{ margin: "0 auto 12px" }} />
              <div className="psp-empty-title">Select a competition</div>
              <div>Choose a competition from the list to manage it</div>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="mgr-center-tabs">
                {(["overview","problems","requests","scoreboard","settings"] as Tab[]).map(t => (
                  <button key={t} className={`psp-tab${tab === t ? " active" : ""}`}
                    onClick={() => { setTab(t); if (t === "problems") setRightMode("quickActions"); else setRightMode("quickActions"); }}>
                    {t === "overview" ? "Overview" : t === "problems" ? `Problems${detail ? ` (${detail.problems?.length ?? 0})` : ""}` : t === "requests" ? `Requests${requests.length > 0 ? ` (${requests.length})` : ""}` : t.charAt(0).toUpperCase() + t.slice(1)}
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
                                  {statusBadge(detail.status)}
                                  <span className={`psp-badge ${detail.mode === "TEAM" ? "b-comp" : "b-solo"}`}>{detail.mode}</span>
                                  {detail.visibilityMode && <span className="psp-badge b-priv">{detail.visibilityMode}</span>}
                                </div>
                              </div>
                              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                                {detail.status === "REGISTRATION" && (
                                  <button className="psp-btn psp-btn-primary psp-btn-sm" onClick={async () => { try { await publishCompetition(detail.competitionId); const fresh = await getCompetitionDetail(detail.competitionId); setDetail(fresh); toast({ title: "Competition started" }); } catch (e: any) { toast({ title: "Failed", description: e.message, variant: "destructive" }); } }}>
                                    <Flame size={11} /> Start Now
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="mgr-stats-row">
                              {[
                                { label: "Start", val: fmtDate(detail.startTime) },
                                { label: "Duration", val: fmtDuration(detail.durationMinutes) },
                                { label: "Problems", val: detail.problems?.length ?? 0 },
                                { label: "Registered", val: selected?.participantCount ?? "—" },
                              ].map(s => (
                                <div key={s.label} className="mgr-stat-box">
                                  <div className="mgr-stat-box-val" style={{ fontSize: s.label === "Start" ? 11 : 20 }}>{String(s.val)}</div>
                                  <div className="mgr-stat-box-lbl">{s.label}</div>
                                </div>
                              ))}
                            </div>
                            {detail.description && <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>{detail.description}</p>}
                            <div style={{ fontSize: 12, color: "var(--text-muted)", background: "var(--bg-secondary)", padding: "8px 12px", borderRadius: 3 }}>
                              <strong>Scoring formula:</strong> Score = max(maxPts × 0.3, maxPts − (maxPts ÷ 250) × minutesElapsed)
                              <br />
                              {detail.penaltyEnabled && <span>Wrong answer penalty: +{detail.penaltyMinutes ?? 10} minutes added to effective solve time</span>}
                              {!detail.penaltyEnabled && <span>No wrong answer penalty</span>}
                            </div>
                          </div>
                        </div>
                        {detail.mode === "TEAM" && (
                          <div className="mgr-section">
                            <div className="mgr-section-title"><Users size={12} /> Team Settings</div>
                            <div className="mgr-section-body" style={{ fontSize: 13, color: "var(--text-primary)" }}>
                              {detail.minTeamSize ?? 1} – {detail.maxTeamSize} members per team
                            </div>
                          </div>
                        )}
                        {(detail.status === "REGISTRATION" || detail.status === "DRAFT") && detail.startTime && (
                          <div className="psp-alert psp-alert-info">
                            <Calendar size={14} />
                            <span>Starts in <strong>{countdown(detail.startTime)}</strong></span>
                          </div>
                        )}
                      </>
                    )}

                    {/* PROBLEMS */}
                    {tab === "problems" && (
                      <>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                            Problems in this competition ({detail.problems?.length ?? 0})
                          </span>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button className="psp-btn psp-btn-secondary psp-btn-sm" onClick={openPicker}>
                              <Plus size={11} /> Add from Bank
                            </button>
                          </div>
                        </div>
                        {(!detail.problems || detail.problems.length === 0) ? (
                          <div className="psp-empty" style={{ border: "1px dashed var(--border)", borderRadius: 3 }}>
                            <BarChart2 size={24} color="var(--border)" style={{ margin: "0 auto 8px" }} />
                            <div className="psp-empty-title">No problems yet</div>
                            <div style={{ marginTop: 8 }}>
                              <button className="psp-btn psp-btn-primary psp-btn-sm" onClick={openPicker}><Plus size={11} /> Add from Bank</button>
                            </div>
                          </div>
                        ) : (
                          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext items={detail.problems.map((p: any) => p.problemId)} strategy={verticalListSortingStrategy}>
                              {detail.problems.map((cp: any) => (
                                <SortableProblemRow
                                  key={cp.problemId} cp={cp}
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
                            Pending Join Requests
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
                                      {r.status === "APPROVED" ? "✓ Approved" : "✕ Rejected"}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}

                    {/* SCOREBOARD */}
                    {tab === "scoreboard" && (
                      <>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Scoreboard</span>
                            {detail.status === "ACTIVE" && <span className="psp-badge b-live" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span className="psp-dot d-red d-blink" />Live</span>}
                            {detail.status === "ENDED"  && <span className="psp-badge b-pass">Final Results</span>}
                          </div>
                          <button className="psp-btn psp-btn-secondary psp-btn-sm" onClick={() => { setSbLoading(true); getCompetitionScoreboard(detail.competitionId).then(setScoreboard).finally(() => setSbLoading(false)); }}>
                            <RefreshCw size={11} /> Refresh
                          </button>
                        </div>
                        {sbLoading ? (
                          <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                            <Loader2 size={20} style={{ animation: "spin 1s linear infinite", color: "var(--brand)" }} />
                          </div>
                        ) : scoreboard.length === 0 ? (
                          <div className="psp-empty" style={{ border: "1px solid var(--border)", borderRadius: 3 }}>
                            <BarChart2 size={28} color="var(--border)" style={{ margin: "0 auto 8px" }} />
                            <div className="psp-empty-title">No submissions yet</div>
                          </div>
                        ) : (
                          <div className="mgr-section">
                            <table className="psp-table">
                              <thead>
                                <tr>
                                  <th>#</th>
                                  <th>Student / Team</th>
                                  <th>Solved</th>
                                  <th className="text-right">Score</th>
                                  <th className="text-right">Penalty</th>
                                </tr>
                              </thead>
                              <tbody>
                                {scoreboard.map((row: any, i: number) => (
                                  <tr key={i}>
                                    <td style={{ fontWeight: 700, color: "var(--text-primary)" }}>{i + 1}</td>
                                    <td>{row.studentName || row.teamName || row.studentId?.slice(0, 8)}</td>
                                    <td>{row.solved ?? row.solvedCount ?? "—"}</td>
                                    <td style={{ textAlign: "right", fontWeight: 600, color: "var(--brand)" }}>{row.totalScore ?? row.score ?? 0}</td>
                                    <td style={{ textAlign: "right", color: "var(--text-muted)" }}>{row.penalty ?? 0}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </>
                    )}

                    {/* SETTINGS */}
                    {tab === "settings" && (
                      <>
                        <div className="mgr-section" style={{ marginBottom: 14 }}>
                          <div className="mgr-section-title"><Settings size={12} /> Competition Settings</div>
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
                              <div>
                                <label className="psp-form-label">Duration (minutes)</label>
                                <input className="psp-form-input" type="number"
                                  value={settingsForm.durationMinutes}
                                  disabled={detail.status === "ACTIVE" || detail.status === "ENDED"}
                                  onChange={e => setSettingsForm(f => ({ ...f, durationMinutes: parseInt(e.target.value) || 120 }))} />
                              </div>
                              <div>
                                <label className="psp-form-label" style={{ marginBottom: 8 }}>Penalty Configuration</label>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                                  <div className={`psp-toggle${settingsForm.penaltyEnabled ? " on" : ""}`}
                                    onClick={() => setSettingsForm(f => ({ ...f, penaltyEnabled: !f.penaltyEnabled }))}>
                                    <div className="psp-toggle-knob" />
                                  </div>
                                  <span style={{ fontSize: 13, color: "var(--text-primary)" }}>Enable wrong answer penalty</span>
                                </div>
                                {settingsForm.penaltyEnabled && (
                                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 46 }}>
                                    <label className="psp-form-label" style={{ marginBottom: 0, whiteSpace: "nowrap" }}>Penalty per wrong answer:</label>
                                    <input className="psp-form-input" type="number" style={{ width: 80 }}
                                      value={settingsForm.penaltyMinutes}
                                      onChange={e => setSettingsForm(f => ({ ...f, penaltyMinutes: parseInt(e.target.value) || 10 }))} />
                                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>minutes</span>
                                  </div>
                                )}
                              </div>
                              <button className="psp-btn psp-btn-primary" style={{ alignSelf: "flex-start" }}
                                disabled={savingSettings} onClick={handleSaveSettings}>
                                {savingSettings ? <Loader2 size={13} /> : null} Save Changes
                              </button>
                            </div>
                          </div>
                        </div>
                        <div className="mgr-danger">
                          <div className="mgr-danger-title">⚠ Danger Zone</div>
                          <div style={{ display: "flex", gap: 10 }}>
                            {detail.status !== "ENDED" && (
                              <button className="psp-btn psp-btn-danger psp-btn-sm">Cancel Competition</button>
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
                  <div style={{ fontSize: 12, color: "var(--text-subtle)", textAlign: "center", padding: 24 }}>Select a competition</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {detail.status === "REGISTRATION" && (
                      <button className="psp-btn psp-btn-primary" style={{ width: "100%", justifyContent: "center" }}
                        onClick={async () => { try { await publishCompetition(detail.competitionId); loadList(); } catch (e: any) { toast({ title: "Failed", description: e.message, variant: "destructive" }); } }}>
                        <Flame size={13} /> Start Competition
                      </button>
                    )}
                    <button className="psp-btn psp-btn-secondary" style={{ width: "100%", justifyContent: "center" }}
                      onClick={openPicker}>
                      <Plus size={13} /> Add Problem
                    </button>
                    <button className="psp-btn psp-btn-secondary" style={{ width: "100%", justifyContent: "center" }}
                      onClick={() => setTab("requests")}>
                      <Users size={13} /> View Requests
                    </button>
                    <button className="psp-btn psp-btn-secondary" style={{ width: "100%", justifyContent: "center" }}
                      onClick={() => setTab("settings")}>
                      <Settings size={13} /> Settings
                    </button>
                    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: 4 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Competition Info</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {[
                          ["Status",     safeStr(detail.status)],
                          ["Mode",       safeStr(detail.mode)],
                          ["Start",      fmtDate(detail.startTime)],
                          ["Duration",   fmtDuration(detail.durationMinutes)],
                          ["Visibility", safeVisibility(detail.visibilityMode)],
                          ["Penalty",    safePenalty(detail.penaltyEnabled, detail.penaltyMinutes)],
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
                <input placeholder="Search problems…" value={pickerSearch}
                  onChange={e => setPickerSearch(e.target.value)}
                  style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 3, padding: "0 8px", height: 28, fontSize: 12, outline: "none" }} />
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
                  <div style={{ display: "flex", justifyContent: "center", padding: 32 }}><Loader2 size={18} style={{ animation: "spin 1s linear infinite", color: "var(--brand)" }} /></div>
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

      {/* Create Competition Modal */}
      {createOpen && (
        <div className="psp-modal-overlay" onClick={() => setCreateOpen(false)}>
          <div className="psp-modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="psp-modal-header">
              <span style={{ fontSize: 16, fontWeight: 600 }}>New Competition</span>
              <button onClick={() => setCreateOpen(false)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--text-muted)" }}><X size={18} /></button>
            </div>
            <div className="psp-modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div><label className="psp-form-label">Title *</label><input className="psp-form-input" value={createForm.title} onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))} /></div>
              <div><label className="psp-form-label">Description</label><textarea className="psp-form-textarea" value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} style={{ minHeight: 70 }} /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label className="psp-form-label">Mode</label>
                  <select className="psp-form-select" value={createForm.mode} onChange={e => setCreateForm(f => ({ ...f, mode: e.target.value as any }))}>
                    <option value="SOLO">Solo</option><option value="TEAM">Team</option>
                  </select>
                </div>
                <div><label className="psp-form-label">Access</label>
                  <select className="psp-form-select" value={createForm.accessType} onChange={e => setCreateForm(f => ({ ...f, accessType: e.target.value as any }))}>
                    <option value="REQUEST_BASED">Request Based</option><option value="OPEN">Open</option>
                  </select>
                </div>
              </div>
              {createForm.mode === "TEAM" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div><label className="psp-form-label">Min Team</label><input type="number" className="psp-form-input" value={createForm.minTeamSize} onChange={e => setCreateForm(f => ({ ...f, minTeamSize: parseInt(e.target.value) || 2 }))} /></div>
                  <div><label className="psp-form-label">Max Team</label><input type="number" className="psp-form-input" value={createForm.maxTeamSize} onChange={e => setCreateForm(f => ({ ...f, maxTeamSize: parseInt(e.target.value) || 4 }))} /></div>
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label className="psp-form-label">Start Date & Time</label><input type="datetime-local" className="psp-form-input" value={createForm.scheduledStartTime} onChange={e => setCreateForm(f => ({ ...f, scheduledStartTime: e.target.value }))} /></div>
                <div><label className="psp-form-label">Duration (mins)</label><input type="number" className="psp-form-input" value={createForm.durationMinutes} onChange={e => setCreateForm(f => ({ ...f, durationMinutes: parseInt(e.target.value) || 120 }))} /></div>
              </div>

              {/* Scoring mode */}
              <div>
                <label className="psp-form-label">Scoring Mode</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  {(["ICPC", "RATED", "PARTIAL"] as const).map(m => {
                    const active = (createForm.scoringMode ?? "ICPC") === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setCreateForm(f => ({ ...f, scoringMode: m }))}
                        style={{
                          padding: "8px 6px", borderRadius: 6, cursor: "pointer",
                          border: active ? "2px solid #0052cc" : "1px solid var(--border)",
                          background: active ? "var(--accent-soft)" : "var(--bg-primary)",
                          color: active ? "var(--brand)" : "var(--text-primary)",
                          fontWeight: active ? 700 : 500, fontSize: 12,
                        }}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.5 }}>
                  {createForm.scoringMode === "RATED"
                    ? "Points decay over time. Faster solves earn more; each problem has a starting value, decay rate and floor."
                    : createForm.scoringMode === "PARTIAL"
                    ? "Score = percentage of test cases passed. Best submission counts. No time penalty."
                    : "Teams ranked by problems solved, then total penalty time. Each wrong attempt adds the problem's penalty minutes."}
                </div>
              </div>

              {/* Scoreboard freeze (ICPC / RATED only) */}
              {createForm.scoringMode !== "PARTIAL" && (
                <div style={{ border: "1px solid var(--border)", borderRadius: 6, padding: "10px 12px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={!!createForm.freezeEnabled}
                      onChange={e => setCreateForm(f => ({ ...f, freezeEnabled: e.target.checked }))}
                    />
                    Freeze scoreboard before the competition ends
                  </label>
                  {createForm.freezeEnabled && (
                    <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Freeze</span>
                      <input
                        type="number"
                        className="psp-form-input"
                        style={{ width: 80 }}
                        value={createForm.freezeMinutesBeforeEnd ?? 60}
                        onChange={e => setCreateForm(f => ({ ...f, freezeMinutesBeforeEnd: parseInt(e.target.value) || 60 }))}
                      />
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>minutes before end</span>
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: "var(--text-subtle)", marginTop: 6 }}>
                    Players see standings as of the freeze moment; full standings reveal when the contest ends. Teachers always see live.
                  </div>
                </div>
              )}
            </div>
            <div className="psp-modal-footer">
              <button className="psp-btn psp-btn-secondary" onClick={() => setCreateOpen(false)}>Cancel</button>
              <button className="psp-btn psp-btn-primary" onClick={handleCreate} disabled={creating} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {creating ? <Loader2 size={13} /> : <Plus size={13} />} Create
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
