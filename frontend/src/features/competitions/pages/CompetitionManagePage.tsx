"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Settings, Puzzle, Gamepad2, BarChart3, Users, FileText,
  AlertTriangle, Download, PlayCircle, StopCircle, X,
  Calendar, GripVertical, Loader2, Plus, ChevronDown, ChevronUp,
  ChevronLeft, Trophy,
} from "lucide-react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "@/components/ui/PSPToast";
import Navbar from "@/components/Navbar";
import Link from "next/link";
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

// ── Join-request row helpers ──────────────────────────────────────────────────

function reqInitials(first?: string, last?: string) {
  const a = (first ?? "").trim().charAt(0);
  const b = (last ?? "").trim().charAt(0);
  return (a + b).toUpperCase() || "?";
}

const REQ_AVATAR_GRADIENTS = [
  "linear-gradient(135deg,#00c896,#00e6aa)",
  "linear-gradient(135deg,#2ec27e,#4cd49b)",
  "linear-gradient(135deg,#e8a030,#eeb866)",
  "linear-gradient(135deg,#9b8cf6,#b8acff)",
  "linear-gradient(135deg,#f0637a,#ff8fa3)",
  "linear-gradient(135deg,#00b8d9,#36b37e)",
];

function reqAvatarGradient(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return REQ_AVATAR_GRADIENTS[h % REQ_AVATAR_GRADIENTS.length];
}

function reqTimeAgo(iso: string) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
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

  const statusPill = (s: string) => {
    const map: Record<string, { bg: string; color: string; label: string }> = {
      ACTIVE:       { bg: "var(--danger-soft)",  color: "var(--danger)",  label: "Live" },
      REGISTRATION: { bg: "var(--accent-soft)",  color: "var(--brand)",   label: "Registration" },
      ENDED:        { bg: "var(--bg-2)",          color: "var(--ink-3)",   label: "Ended" },
      UPCOMING:     { bg: "var(--warn-soft)",     color: "var(--warn)",    label: "Upcoming" },
    };
    const st = map[s] ?? { bg: "var(--bg-2)", color: "var(--ink-3)", label: s };
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

  const compStatus = comp?.status ?? "DRAFT";

  return (
    <>
      <Navbar />
      <div className="psp-main">
        {/* Header card */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r)", padding: "22px 24px", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: 9, background: isEnded ? "var(--bg-2)" : "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Trophy size={20} color={isEnded ? "var(--ink-3)" : "var(--brand)"} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 21, fontWeight: 700, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{comp?.title ?? "Competition"}</div>
            </div>
            {statusPill(compStatus)}
            <Link href="/teacher/competitions" style={{ fontSize: 12, color: "var(--ink-3)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0, marginLeft: 4 }}>
              <ChevronLeft size={13} /> Back
            </Link>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, background: "var(--line)", borderRadius: 8, overflow: "hidden" }}>
            {[
              { label: "Start",      value: comp?.startTime ? fmtDate(comp.startTime) : "—" },
              { label: "Duration",   value: comp?.durationMinutes ? `${comp.durationMinutes} min` : "—" },
              { label: "Problems",   value: String(comp?.problemCount ?? comp?.problemsCount ?? "—") },
              { label: "Registered", value: String(comp?.participantCount ?? overview?.registrationCount ?? 0) },
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
              {(Object.entries(tabHeadings) as [TabKey, string][]).map(([key, label]) => (
                <button key={key} onClick={() => navigate(key)} style={{ padding: "7px 14px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 13, fontWeight: tab === key ? 600 : 400, background: tab === key ? "var(--brand)" : "transparent", color: tab === key ? "#fff" : "var(--ink-3)", transition: "all 0.1s", whiteSpace: "nowrap" }}>
                  {label}
                </button>
              ))}
            </div>
            {tab === "settings"    && <SettingsTab comp={comp} onSaved={loadDetail} />}
            {tab === "problems"    && <ProblemsTab comp={comp} detail={detail} onChanged={loadDetail} />}
            {tab === "control"     && <ControlTab comp={comp} overview={overview} />}
            {tab === "scoreboard"  && (
              <div style={{ height: "calc(100vh - 180px)", display: "flex", flexDirection: "column", border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden" }}>
                <CPScoreboard competitionId={id} />
              </div>
            )}
            {tab === "teams"       && <TeamsTab competitionId={id} />}
            {tab === "submissions" && <SubmissionsTab competitionId={id} />}
            {tab === "violations"  && <ViolationsTab competitionId={id} />}
            {tab === "export"      && <ExportTab competitionId={id} title={comp?.title ?? "competition"} />}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r)", padding: "16px 18px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Info</div>
              {comp?.description && <p style={{ fontSize: 13, color: "var(--ink-2)", margin: "0 0 10px", lineHeight: 1.5 }}>{comp.description}</p>}
              {comp?.scoringMode && <div style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 6 }}>Scoring: <span style={{ color: "var(--ink-2)" }}>{comp.scoringMode}</span></div>}
              {comp?.mode && <div style={{ fontSize: 12, color: "var(--ink-3)" }}>Mode: <span style={{ color: "var(--ink-2)" }}>{comp.mode}</span></div>}
              {!comp?.description && !comp?.scoringMode && <div style={{ fontSize: 13, color: "var(--ink-3)", fontStyle: "italic" }}>No details added.</div>}
            </div>
            <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r)", padding: "16px 18px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Quick Actions</div>
              {sidebarActions}
              {!isRegistration && !isActive && (
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
        <div className="psp-empty" style={{ padding: "32px 24px" }}>
          <Puzzle size={28} color="var(--ink-3)" style={{ margin: "0 auto 12px" }} />
          <div className="psp-empty-title">No problems attached</div>
          <div>Add from your problem bank to make this contest submittable.</div>
          <button className="psp-btn psp-btn-primary psp-btn-sm" onClick={openPicker} style={{ marginTop: 14 }}>
            <Plus size={12} /> Add problem
          </button>
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

  async function approve(requestId: string) {
    setActing(requestId);
    try { await approveJoinRequest(requestId); setRequests(r => r.filter(x => x.requestId !== requestId)); toast.success("Approved"); }
    catch { /* toast */ }
    finally { setActing(null); }
  }

  async function reject(requestId: string) {
    setActing(requestId);
    try { await rejectJoinRequest(requestId); setRequests(r => r.filter(x => x.requestId !== requestId)); toast.success("Rejected"); }
    catch { /* toast */ }
    finally { setActing(null); }
  }

  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} /></div>;

  return (
    <div>
      {requests.length === 0 ? (
        <div className="psp-empty" style={{ padding: "32px 24px" }}>
          <Users size={28} color="var(--ink-3)" style={{ margin: "0 auto 12px" }} />
          <div className="psp-empty-title">No join requests</div>
          <div>Requests appear here when visibility is set to Request-based.</div>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: "var(--ink-2)" }}>
              {requests.length} pending request{requests.length !== 1 ? "s" : ""}
            </span>
            <button className="psp-btn psp-btn-primary psp-btn-sm"
              onClick={() => bulkApproveCompetitionRequests(competitionId, requests.map(r => r.requestId)).then(() => setRequests([]))}>
              Approve All
            </button>
          </div>
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r)", overflow: "hidden" }}>
            {requests.map((r: any, i: number) => {
              const fullName = [r.firstName, r.lastName].filter(Boolean).join(" ") || "Unknown student";
              const filiereLine = [r.divisionName, r.semesterName].filter(Boolean).join(" · ");
              const busy = acting === r.requestId;
              return (
                <div
                  key={r.requestId}
                  style={{
                    display: "flex", alignItems: "center", gap: 14, padding: "14px 18px",
                    borderBottom: i < requests.length - 1 ? "1px solid var(--line)" : "none",
                    transition: "background 0.1s",
                  }}
                  onMouseOver={e => (e.currentTarget.style.background = "var(--surface-2)")}
                  onMouseOut={e => (e.currentTarget.style.background = "")}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 700, color: "#fff",
                    background: reqAvatarGradient(fullName),
                  }}>
                    {reqInitials(r.firstName, r.lastName)}
                  </div>

                  {/* Name + apogée */}
                  <div style={{ minWidth: 0, flex: "0 0 auto", width: 200 }}>
                    <div style={{ fontWeight: 650, fontSize: 13.5, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {fullName}
                    </div>
                    {r.apogeeNumber && (
                      <div style={{ fontSize: 11.5, color: "var(--ink-3)", fontFamily: "ui-monospace, monospace" }}>
                        {r.apogeeNumber}
                      </div>
                    )}
                  </div>

                  {/* Filière · semester */}
                  <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {filiereLine || <span style={{ color: "var(--ink-3)" }}>—</span>}
                  </div>

                  {/* Requested time */}
                  <div style={{ flexShrink: 0, fontSize: 12, color: "var(--ink-3)", fontFamily: "ui-monospace, monospace" }}>
                    {r.requestedAt ? `Requested ${reqTimeAgo(r.requestedAt)}` : ""}
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button
                      className="psp-btn psp-btn-sm"
                      disabled={busy}
                      onClick={() => approve(r.requestId)}
                      style={{ background: "var(--success-soft)", color: "#5dd4a0", border: "1px solid var(--success)" }}
                    >
                      Approve
                    </button>
                    <button
                      className="psp-btn psp-btn-sm"
                      disabled={busy}
                      onClick={() => reject(r.requestId)}
                      style={{ background: "var(--danger-soft)", color: "#ff8fa3", border: "1px solid var(--danger)" }}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
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
        Type the competition name to confirm ending.
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
