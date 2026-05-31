"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Settings, Puzzle, Gamepad2, BarChart3, Users, FileText,
  AlertTriangle, Download, PlayCircle, StopCircle, X,
  Calendar, GripVertical, Loader2, Plus, ChevronDown, ChevronUp,
} from "lucide-react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "@/components/ui/PSPToast";
import ManageLayout from "@/components/manage/ManageLayout";
import CPScoreboard from "@/features/competitions/components/CPScoreboard";
import {
  getCompetitionDetail, getCompetitionOverview, startCompetition, endCompetition,
  patchCompetitionSettings, attachCompetitionProblem, detachCompetitionProblem,
  reorderCompetitionProblems, patchCompetitionProblem, getCompetitionJoinRequests,
  approveJoinRequest, rejectJoinRequest, bulkApproveCompetitionRequests,
  getProblemsPicker, type ProblemPickerItem,
} from "@/lib/api";
import { useAuth } from "@/features/auth/contexts/AuthContext";

// ── Types ─────────────────────────────────────────────────────────────────────

type TabKey = "settings" | "problems" | "control" | "scoreboard" | "teams" | "submissions" | "violations" | "export";

const NAV_GROUPS = [
  { label: "SETUP", items: [
    { key: "settings"   as TabKey, label: "Settings",    icon: <Settings size={14} />    },
    { key: "problems"   as TabKey, label: "Problems",    icon: <Puzzle size={14} />      },
  ]},
  { label: "LIVE", items: [
    { key: "control"    as TabKey, label: "Control",     icon: <Gamepad2 size={14} />    },
    { key: "scoreboard" as TabKey, label: "Scoreboard",  icon: <BarChart3 size={14} />   },
    { key: "teams"      as TabKey, label: "Teams",       icon: <Users size={14} />       },
    { key: "submissions"as TabKey, label: "Submissions", icon: <FileText size={14} />    },
    { key: "violations" as TabKey, label: "Violations",  icon: <AlertTriangle size={14} />},
  ]},
  { label: "EXPORT", items: [
    { key: "export"     as TabKey, label: "Export",      icon: <Download size={14} />    },
  ]},
];

const VALID_TABS: TabKey[] = ["settings","problems","control","scoreboard","teams","submissions","violations","export"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CompetitionManagePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { userId } = useAuth();

  const [comp, setComp]         = useState<any | null>(null);
  const [detail, setDetail]     = useState<any | null>(null);
  const [overview, setOverview] = useState<any | null>(null);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState<TabKey>("control");
  const [sidebarAction, setSidebarAction] = useState<"start" | "end" | null>(null);
  const [endText, setEndText]   = useState("");
  const [actionBusy, setActionBusy] = useState(false);

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadDetail = useCallback(async () => {
    try {
      const [d, o] = await Promise.all([
        getCompetitionDetail(id),
        getCompetitionOverview(id).catch(() => null),
      ]);
      setComp(d);
      setDetail(d);
      setOverview(o);
    } catch {
      toast.error("Failed to load competition", "Please refresh.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  // Sync tab from URL
  useEffect(() => {
    if (!comp) return;
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tab") as TabKey | null;
    if (t && VALID_TABS.includes(t)) { setTab(t); return; }
    if (comp.status === "UPCOMING" || comp.status === "REGISTRATION") setTab("settings");
    else if (comp.status === "ENDED") setTab("scoreboard");
    else setTab("control");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!comp]);

  function navigate(t: string) {
    setTab(t as TabKey);
    setSidebarAction(null);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", t);
    window.history.replaceState({}, "", url.toString());
  }

  // ── Lifecycle actions ─────────────────────────────────────────────────────

  async function runAction(action: "start" | "end") {
    if (action === "end" && endText !== comp?.title) return;
    setActionBusy(true);
    try {
      if (action === "start") await startCompetition(id);
      else                    await endCompetition(id);
      toast.success("Done", `Competition ${action === "start" ? "started" : "ended"}.`);
      setSidebarAction(null);
      setEndText("");
      await loadDetail();
    } catch { /* apiClient shows toast */ }
    finally { setActionBusy(false); }
  }

  // ── Sidebar actions slot ──────────────────────────────────────────────────

  const isRegistration = comp?.status === "REGISTRATION";
  const isActive       = comp?.status === "ACTIVE";
  const isEnded        = comp?.status === "ENDED";

  const sidebarActions = (
    <>
      {isRegistration && sidebarAction !== "start" && (
        <button
          className="psp-btn psp-btn-primary"
          style={{ width: "100%", justifyContent: "center", gap: 6, marginBottom: 6, background: "linear-gradient(135deg,#10b981,#059669)", borderColor: "#10b981" }}
          onClick={() => setSidebarAction("start")}
        >
          <PlayCircle size={14} /> Start Competition
        </button>
      )}
      {sidebarAction === "start" && (
        <SidebarConfirm
          message={`Start "${comp?.title}" now?`} cta="Start"
          busy={actionBusy} onConfirm={() => runAction("start")}
          onCancel={() => setSidebarAction(null)}
        />
      )}
      {(isActive || isRegistration) && sidebarAction !== "end" && (
        <button
          className="psp-btn psp-btn-secondary"
          style={{ width: "100%", justifyContent: "center", gap: 6, color: "#f87171", borderColor: "rgba(239,68,68,0.4)" }}
          onClick={() => setSidebarAction("end")}
        >
          <StopCircle size={13} /> End Early
        </button>
      )}
      {sidebarAction === "end" && (
        <SidebarEndConfirm
          name={comp?.title ?? ""} text={endText}
          onTextChange={setEndText} busy={actionBusy}
          onConfirm={() => runAction("end")}
          onCancel={() => { setSidebarAction(null); setEndText(""); }}
        />
      )}
    </>
  );

  const tabHeadings: Record<TabKey, string> = {
    settings: "Settings", problems: "Problems", control: "Control Panel",
    scoreboard: "Scoreboard", teams: "Teams", submissions: "Submissions",
    violations: "Violations", export: "Export",
  };

  if (loading) {
    return (
      <ManageLayout
        title="Loading…" status="DRAFT" navGroups={NAV_GROUPS}
        activeTab={tab} onTabChange={navigate}
        backHref="/teacher/competitions" backLabel="Back to Competitions"
        loading
      >
        <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
          <Loader2 size={24} style={{ animation: "spin 1s linear infinite", color: "#6366f1" }} />
        </div>
      </ManageLayout>
    );
  }

  return (
    <ManageLayout
      title={comp?.title ?? "Competition"}
      status={comp?.status ?? "DRAFT"}
      navGroups={NAV_GROUPS}
      activeTab={tab}
      onTabChange={navigate}
      backHref="/teacher/competitions"
      backLabel="Back to Competitions"
      actions={(isRegistration || isActive) ? sidebarActions : undefined}
      footer={comp?.startTime ? (
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <Calendar size={11} />
          <span>{fmtDate(comp.startTime)}</span>
        </div>
      ) : undefined}
    >
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>
          {tabHeadings[tab]}
        </div>
      </div>

      {tab === "settings"    && <SettingsTab comp={comp} onSaved={loadDetail} />}
      {tab === "problems"    && <ProblemsTab comp={comp} detail={detail} onChanged={loadDetail} />}
      {tab === "control"     && <ControlTab comp={comp} overview={overview} />}
      {tab === "scoreboard"  && (
        <div style={{ height: "calc(100vh - 180px)", display: "flex", flexDirection: "column", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
          <CPScoreboard competitionId={id} />
        </div>
      )}
      {tab === "teams"       && <TeamsTab competitionId={id} />}
      {tab === "submissions" && <SubmissionsTab competitionId={id} />}
      {tab === "violations"  && <ViolationsTab competitionId={id} />}
      {tab === "export"      && <ExportTab competitionId={id} title={comp?.title ?? "competition"} />}
    </ManageLayout>
  );
}

// ── Settings tab ──────────────────────────────────────────────────────────────

function SettingsTab({ comp, onSaved }: { comp: any; onSaved: () => void }) {
  const [form, setForm] = useState({
    title:           comp?.title ?? "",
    description:     comp?.description ?? "",
    durationMinutes: comp?.durationMinutes ?? 120,
    scoringMode:     comp?.scoringMode ?? "ICPC",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await patchCompetitionSettings(comp.competitionId ?? comp.id, {
        title:           form.title,
        description:     form.description,
        durationMinutes: form.durationMinutes,
      });
      toast.success("Saved", "Competition settings updated.");
      onSaved();
    } catch { /* apiClient shows toast */ }
    finally { setSaving(false); }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <FormSection number={1} title="Basic Info">
        <FormField label="Title *">
          <input className="psp-form-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
        </FormField>
        <FormField label="Description">
          <textarea className="psp-form-textarea" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ minHeight: 80 }} />
        </FormField>
      </FormSection>

      <FormSection number={2} title="Schedule">
        <FormField label="Duration (minutes)">
          <input className="psp-form-input" type="number" value={form.durationMinutes}
            onChange={e => setForm(f => ({ ...f, durationMinutes: parseInt(e.target.value) || 120 }))} style={{ maxWidth: 120 }} />
        </FormField>
      </FormSection>

      <FormSection number={3} title="Scoring Mode">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
          {(["ICPC", "RATED", "PARTIAL"] as const).map(m => (
            <div key={m} style={{
              padding: "10px 8px", borderRadius: 6, textAlign: "center",
              border: form.scoringMode === m ? "2px solid #6366f1" : "1px solid var(--border)",
              background: form.scoringMode === m ? "rgba(99,102,241,0.1)" : "var(--bg-primary)",
              color: form.scoringMode === m ? "#818cf8" : "var(--text-secondary)",
              fontWeight: 600, fontSize: 12,
            }}>
              {m}
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Scoring mode can only be changed before competition starts.</div>
      </FormSection>

      <button className="psp-btn psp-btn-primary" onClick={save} disabled={saving} style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {saving ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : null}
        Save Settings
      </button>
    </div>
  );
}

// ── Problems tab ──────────────────────────────────────────────────────────────

function ProblemsTab({ comp, detail, onChanged }: { comp: any; detail: any; onChanged: () => void }) {
  const [showPicker, setShowPicker] = useState(false);
  const [picker, setPicker]         = useState<ProblemPickerItem[]>([]);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerLoading, setPickerLoading] = useState(false);
  const [attaching, setAttaching]   = useState<string | null>(null);
  const [removing, setRemoving]     = useState<string | null>(null);
  const problems: any[] = detail?.problems ?? [];
  const compId = comp?.competitionId ?? comp?.id;

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  async function openPicker() {
    setShowPicker(true);
    setPickerLoading(true);
    try {
      const data = await getProblemsPicker();
      setPicker(data);
    } catch { /* silent */ }
    finally { setPickerLoading(false); }
  }

  async function attachProblem(problemId: string) {
    setAttaching(problemId);
    try {
      await attachCompetitionProblem(compId, problemId);
      toast.success("Problem added");
      onChanged();
    } catch { /* apiClient shows toast */ }
    finally { setAttaching(null); }
  }

  async function removeProblem(problemId: string) {
    setRemoving(problemId);
    try {
      await detachCompetitionProblem(compId, problemId);
      onChanged();
    } catch { /* apiClient shows toast */ }
    finally { setRemoving(null); }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = problems.findIndex(p => p.problemId === active.id);
    const newIdx = problems.findIndex(p => p.problemId === over.id);
    const reordered = arrayMove(problems, oldIdx, newIdx);
    try {
      await reorderCompetitionProblems(compId, reordered.map(p => p.problemId));
      onChanged();
    } catch { /* silent */ }
  }

  const filteredPicker = picker.filter(p => {
    const q = pickerSearch.toLowerCase();
    return !q || p.title.toLowerCase().includes(q);
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{problems.length} problem{problems.length !== 1 ? "s" : ""}</span>
        <button className="psp-btn psp-btn-primary psp-btn-sm" onClick={openPicker}>
          <Plus size={12} /> Add from Problem Bank
        </button>
      </div>

      {problems.length === 0 ? (
        <div className="psp-empty" style={{ padding: 48 }}>
          <Puzzle size={32} color="var(--border)" style={{ margin: "0 auto 12px" }} />
          <div className="psp-empty-title">No problems yet</div>
          <div>Add problems from the bank to get started.</div>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={problems.map(p => p.problemId)} strategy={verticalListSortingStrategy}>
            <div>
              {problems.map((p: any, i: number) => (
                <SortableProblemRow
                  key={p.problemId}
                  problem={p}
                  label={String.fromCharCode(65 + i)}
                  removing={removing === p.problemId}
                  onRemove={() => removeProblem(p.problemId)}
                  onPatch={async (data) => {
                    await patchCompetitionProblem(compId, p.problemId, data);
                    onChanged();
                  }}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Problem picker modal */}
      {showPicker && (
        <div className="psp-modal-overlay" onClick={() => setShowPicker(false)}>
          <div className="psp-modal" style={{ maxWidth: 520, maxHeight: "80vh", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
            <div className="psp-modal-header">
              <span style={{ fontSize: 16, fontWeight: 600 }}>Add Problems</span>
              <button onClick={() => setShowPicker(false)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--text-muted)" }}><X size={18} /></button>
            </div>
            <div style={{ padding: "10px 20px" }}>
              <input className="psp-form-input" placeholder="Search problems…" value={pickerSearch} onChange={e => setPickerSearch(e.target.value)} />
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 20px" }}>
              {pickerLoading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                  <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
                </div>
              ) : filteredPicker.map(p => {
                const alreadyAdded = problems.some(ep => ep.problemId === p.problemId);
                const diffCls = (p.difficulty || "MEDIUM").toLowerCase();
                return (
                  <div key={p.problemId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{p.title}</div>
                      <span className={`psp-badge b-${diffCls}`} style={{ fontSize: 10 }}>{p.difficulty}</span>
                    </div>
                    <button
                      className="psp-btn psp-btn-primary psp-btn-sm"
                      disabled={alreadyAdded || attaching === p.problemId}
                      onClick={() => attachProblem(p.problemId)}
                    >
                      {alreadyAdded ? "Added" : attaching === p.problemId ? "…" : "Add"}
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

function SortableProblemRow({ problem, label, removing, onRemove, onPatch }: {
  problem: any; label: string; removing: boolean;
  onRemove: () => void; onPatch: (data: any) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [pts, setPts] = useState(String(problem.points ?? 100));
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: problem.problemId });
  const diff = (problem.difficultyLevel || problem.difficulty || "EASY").toLowerCase();

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="mgr-prob-row">
      <div className="mgr-prob-row-main" onClick={() => setExpanded(e => !e)}>
        <span className="mgr-drag-handle" {...attributes} {...listeners} onClick={e => e.stopPropagation()}>
          <GripVertical size={14} />
        </span>
        <span style={{ width: 22, height: 22, background: "#6366f1", color: "white", borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
          {label}
        </span>
        <span style={{ flex: 1, fontWeight: 600, fontSize: 13, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {problem.title}
        </span>
        <span className={`psp-badge b-${diff}`}>{diff}</span>
        {expanded ? <ChevronUp size={14} color="#5e6c84" /> : <ChevronDown size={14} color="#5e6c84" />}
      </div>
      {expanded && (
        <div className="mgr-prob-expand">
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div>
              <label className="psp-form-label">Max Points</label>
              <input className="psp-form-input" type="number" value={pts} onChange={e => setPts(e.target.value)} style={{ width: 100 }} />
            </div>
            <button className="psp-btn psp-btn-primary psp-btn-sm" onClick={() => onPatch({ maxPoints: parseInt(pts) || 100 })}>
              Save
            </button>
            <button className="psp-btn psp-btn-secondary psp-btn-sm" style={{ color: "#f87171", borderColor: "rgba(239,68,68,0.4)" }}
              disabled={removing} onClick={onRemove}>
              {removing ? "…" : "Remove"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Control tab ───────────────────────────────────────────────────────────────

function ControlTab({ comp, overview }: { comp: any; overview: any }) {
  return (
    <div>
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Mode",        value: overview?.mode ?? comp?.mode ?? "—"        },
          { label: "Scoring",     value: overview?.scoringMode ?? comp?.scoringMode ?? "—" },
          { label: "Submissions", value: overview?.submissionCount ?? 0             },
          { label: "Accepted",    value: overview?.acCount ?? 0                     },
        ].map(s => (
          <div key={s.label} className="psp-stat-card">
            <div>
              <div className="psp-stat-val">{s.value}</div>
              <div className="psp-stat-lbl">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Status info */}
      <div className="psp-card">
        <div className="psp-card-header"><span className="psp-card-title">Competition Status</span></div>
        <div className="psp-card-body">
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            Status: <strong>{comp?.status ?? "—"}</strong>
            {comp?.startTime && <> · Started: {new Date(comp.startTime).toLocaleString()}</>}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Teams tab ─────────────────────────────────────────────────────────────────

function TeamsTab({ competitionId }: { competitionId: string }) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    getCompetitionJoinRequests(competitionId)
      .then(r => setRequests(r.content ?? r ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [competitionId]);

  async function approve(id: string) {
    setActing(id);
    try { await approveJoinRequest(id); setRequests(r => r.filter(x => x.id !== id)); toast.success("Approved"); }
    catch { /* toast */ }
    finally { setActing(null); }
  }

  async function reject(id: string) {
    setActing(id);
    try { await rejectJoinRequest(id); setRequests(r => r.filter(x => x.id !== id)); toast.success("Rejected"); }
    catch { /* toast */ }
    finally { setActing(null); }
  }

  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} /></div>;

  return (
    <div>
      {requests.length === 0 ? (
        <div className="psp-empty"><div>No pending join requests.</div></div>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <button className="psp-btn psp-btn-primary psp-btn-sm"
              onClick={() => bulkApproveCompetitionRequests(competitionId, requests.map(r => r.id)).then(() => setRequests([]))}>
              Approve All
            </button>
          </div>
          {requests.map((r: any) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{r.studentFirstName} {r.studentLastName}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{r.studentEmail}</div>
              </div>
              <button className="psp-btn psp-btn-secondary psp-btn-sm" style={{ background: "var(--green-light)", color: "#006644" }}
                disabled={acting === r.id} onClick={() => approve(r.id)}>Approve</button>
              <button className="psp-btn psp-btn-secondary psp-btn-sm" style={{ background: "var(--red-light)", color: "#de350b" }}
                disabled={acting === r.id} onClick={() => reject(r.id)}>Reject</button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ── Submissions tab ───────────────────────────────────────────────────────────

function SubmissionsTab({ competitionId }: { competitionId: string }) {
  return (
    <div className="psp-card">
      <div className="psp-card-body" style={{ color: "var(--text-muted)", fontSize: 13 }}>
        Submission history is available via the Scoreboard tab or the Export tab.
      </div>
    </div>
  );
}

// ── Violations tab ────────────────────────────────────────────────────────────

function ViolationsTab({ competitionId }: { competitionId: string }) {
  return (
    <div className="psp-card">
      <div className="psp-card-body" style={{ color: "var(--text-muted)", fontSize: 13 }}>
        Anti-cheat violations are logged. Export them from the Export tab.
      </div>
    </div>
  );
}

// ── Export tab ────────────────────────────────────────────────────────────────

function ExportTab({ competitionId, title }: { competitionId: string; title: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 400 }}>
      {[
        { label: "Final Scoreboard (CSV)",  href: `/api/competitions/${competitionId}/scoreboard/full?format=csv` },
        { label: "All Submissions (CSV)",   href: `/api/teacher/${competitionId}/submissions/export` },
        { label: "Team List (CSV)",         href: `/api/competitions/${competitionId}/teams/export` },
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

// ── Shared form helpers ───────────────────────────────────────────────────────

function FormSection({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8, padding: 20, marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 16 }}>
        {number}. {title}
      </div>
      {children}
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label className="psp-form-label">{label}</label>
      {children}
    </div>
  );
}

// ── Sidebar inline confirm helpers ────────────────────────────────────────────

function SidebarConfirm({ message, cta, busy, onConfirm, onCancel }: {
  message: string; cta: string; busy: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 6, padding: 10, marginBottom: 6 }}>
      <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 8px", lineHeight: 1.4 }}>{message}</p>
      <div style={{ display: "flex", gap: 6 }}>
        <button className="psp-btn psp-btn-secondary psp-btn-sm" onClick={onCancel} disabled={busy} style={{ flex: 1 }}><X size={11} /> Cancel</button>
        <button className="psp-btn psp-btn-primary psp-btn-sm" onClick={onConfirm} disabled={busy} style={{ flex: 1, justifyContent: "center" }}>
          {busy ? "…" : cta}
        </button>
      </div>
    </div>
  );
}

function SidebarEndConfirm({ name, text, onTextChange, busy, onConfirm, onCancel }: {
  name: string; text: string; onTextChange: (v: string) => void;
  busy: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 6, padding: 10, marginBottom: 6 }}>
      <p style={{ fontSize: 12, color: "#fca5a5", margin: "0 0 6px", lineHeight: 1.4 }}>
        ⚠ Type the competition name to confirm ending.
      </p>
      <input className="input" value={text} onChange={e => onTextChange(e.target.value)} placeholder={name} style={{ marginBottom: 8, fontSize: 12 }} />
      <div style={{ display: "flex", gap: 6 }}>
        <button className="psp-btn psp-btn-secondary psp-btn-sm" onClick={onCancel} disabled={busy} style={{ flex: 1 }}>Cancel</button>
        <button className="psp-btn psp-btn-primary psp-btn-sm" onClick={onConfirm} disabled={busy || text !== name}
          style={{ flex: 1, justifyContent: "center", background: "#dc2626", borderColor: "#dc2626" }}>
          {busy ? "…" : "End"}
        </button>
      </div>
    </div>
  );
}
