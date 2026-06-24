"use client";

import { useState } from "react";
import { APP_NAME } from "@/lib/brand";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import {
  Plus, Calendar, Check, X, Settings, ChevronLeft, ChevronRight, ChevronDown,
  FileText, ListChecks, Loader2,
} from "lucide-react";
import { createCompetition, CreateCompetitionRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

// ─── helpers (mirror of the manager's formatters) ────────────────────────────

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

const STEPS = [
  { label: "Basics",   icon: <FileText size={13} /> },
  { label: "Schedule", icon: <Calendar size={13} /> },
  { label: "Format",   icon: <Settings size={13} /> },
  { label: "Problems", icon: <ListChecks size={13} /> },
  { label: "Review",   icon: <Check size={13} /> },
];

const EMPTY_FORM: CreateCompetitionRequest = {
  title: "", description: "", mode: "SOLO", accessType: "REQUEST_BASED",
  scheduledStartTime: "", durationMinutes: 120, minTeamSize: 2, maxTeamSize: 4,
  scoringMode: "ICPC", freezeEnabled: false, freezeMinutesBeforeEnd: 60,
};

export default function CompetitionCreateWizard() {
  const router = useRouter();
  const { toast } = useToast();

  const [createForm, setCreateForm] = useState<CreateCompetitionRequest>({ ...EMPTY_FORM });
  const [createStep, setCreateStep] = useState(0);
  const [creating, setCreating] = useState(false);

  // Format step: advanced settings collapsed by default; auto-open when any
  // advanced field is non-default (team mode, custom access, or freeze on).
  const [advOpen, setAdvOpen] = useState(() =>
    createForm.mode === "TEAM" ||
    createForm.accessType !== "REQUEST_BASED" ||
    !!createForm.freezeEnabled
  );

  const last = STEPS.length - 1;
  const canNext = createStep !== 0 || createForm.title.trim().length > 0;
  const scoreDesc =
    createForm.scoringMode === "RATED"
      ? "Points decay over time. Faster solves earn more; each problem has a starting value, decay rate and floor."
      : createForm.scoringMode === "PARTIAL"
      ? "Score = percentage of test cases passed. Best submission counts. No time penalty."
      : "Ranked by problems solved, then total penalty time. Each wrong attempt adds the problem's penalty minutes.";

  const cancel = () => router.push("/teacher/competitions");

  const handleCreate = async () => {
    if (!createForm.title.trim()) return;
    setCreating(true);
    try {
      const payload = { ...createForm };
      if (payload.mode !== "TEAM") { delete payload.minTeamSize; delete payload.maxTeamSize; }
      await createCompetition(payload);
      toast({ title: "Competition created" });
      router.push("/teacher/competitions");
    } catch (e: any) {
      toast({ title: "Failed to create", description: e.message, variant: "destructive" });
      setCreating(false);
    }
  };

  const Segmented = ({ value, options, onChange }: { value: string; options: { v: string; label: string }[]; onChange: (v: string) => void }) => (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${options.length}, 1fr)`, gap: 8 }}>
      {options.map(o => {
        const active = value === o.v;
        return (
          <button key={o.v} type="button" onClick={() => onChange(o.v)} style={{
            padding: "9px 6px", borderRadius: "var(--r-sm)", cursor: "pointer",
            border: active ? "1px solid var(--brand)" : "1px solid var(--line)",
            background: active ? "var(--accent-soft)" : "var(--bg-2)",
            color: active ? "var(--brand-2)" : "var(--ink-2)",
            fontWeight: active ? 700 : 500, fontSize: 12.5,
          }}>{o.label}</button>
        );
      })}
    </div>
  );

  return (
    <>
      <Navbar />
      <div className="psp-breadcrumb">
        <Link href="/teacher">{APP_NAME}</Link> ›{" "}
        <Link href="/teacher/competitions">Competitions</Link> ›{" "}
        <span style={{ color: "var(--text-primary)" }}>New</span>
      </div>

      <div className="psp-main" style={{ maxWidth: 980, paddingBottom: 96 }}>
        {/* Page header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <Plus size={20} color="var(--brand)" />
          <span style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>New competition</span>
        </div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>
          Set the basics, schedule, format and scoring. You&apos;ll attach problems after creating.
        </div>

        {/* Stepper — full width near the top */}
        <div style={{
          display: "flex", alignItems: "center", gap: 4,
          padding: "16px 20px", marginBottom: 24,
          background: "var(--bg-secondary)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
        }}>
          {STEPS.map((s, i) => {
            const done = i < createStep, active = i === createStep;
            return (
              <div key={s.label} style={{ display: "flex", alignItems: "center", flex: i === last ? "0 0 auto" : 1 }}>
                <button type="button" onClick={() => i < createStep && setCreateStep(i)}
                  style={{ display: "flex", alignItems: "center", gap: 7, background: "none", border: "none", cursor: i < createStep ? "pointer" : "default", padding: 0 }}>
                  <span style={{
                    width: 26, height: 26, borderRadius: "50%", display: "grid", placeItems: "center",
                    fontSize: 12, fontWeight: 700, flexShrink: 0,
                    background: active ? "var(--brand)" : done ? "var(--accent-soft)" : "var(--bg-2)",
                    color: active ? "#0a0e18" : done ? "var(--brand-2)" : "var(--ink-3)",
                    border: active ? "none" : `1px solid ${done ? "var(--accent-ring)" : "var(--line)"}`,
                  }}>{done ? <Check size={13} /> : i + 1}</span>
                  <span style={{ fontSize: 12.5, fontWeight: active ? 700 : 500, color: active ? "var(--ink)" : "var(--ink-3)", whiteSpace: "nowrap" }}>{s.label}</span>
                </button>
                {i !== last && <div style={{ flex: 1, height: 1, background: done ? "var(--accent-ring)" : "var(--line)", margin: "0 10px" }} />}
              </div>
            );
          })}
        </div>

        {/* Form content — constrained column */}
        <div style={{ maxWidth: 780, display: "flex", flexDirection: "column", gap: 14, minHeight: 240 }}>
          {/* Step 0 — Basics */}
          {createStep === 0 && (<>
            <div><label className="psp-form-label">Title *</label><input className="psp-form-input" autoFocus value={createForm.title} onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Spring Algorithms Cup" /></div>
            <div><label className="psp-form-label">Description</label><textarea className="psp-form-textarea" value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} style={{ minHeight: 110 }} placeholder="What is this competition about?" /></div>
          </>)}

          {/* Step 1 — Schedule */}
          {createStep === 1 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><label className="psp-form-label">Start date & time</label><input type="datetime-local" className="psp-form-input" value={createForm.scheduledStartTime} onChange={e => setCreateForm(f => ({ ...f, scheduledStartTime: e.target.value }))} /></div>
              <div><label className="psp-form-label">Duration (minutes)</label><input type="number" className="psp-form-input" value={createForm.durationMinutes} onChange={e => setCreateForm(f => ({ ...f, durationMinutes: parseInt(e.target.value) || 120 }))} /></div>
            </div>
          )}

          {/* Step 2 — Format */}
          {createStep === 2 && (<>
            <div>
              <label className="psp-form-label">Mode</label>
              <Segmented value={createForm.mode ?? "SOLO"} options={[{ v: "SOLO", label: "Solo" }, { v: "TEAM", label: "Team" }]} onChange={v => { setCreateForm(f => ({ ...f, mode: v as any })); if (v === "TEAM") setAdvOpen(true); }} />
            </div>
            <div>
              <label className="psp-form-label">Scoring mode</label>
              <Segmented value={createForm.scoringMode ?? "ICPC"} options={[{ v: "ICPC", label: "ICPC" }, { v: "RATED", label: "Rated" }, { v: "PARTIAL", label: "Partial" }]} onChange={v => setCreateForm(f => ({ ...f, scoringMode: v as any }))} />
              <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.5 }}>{scoreDesc}</div>
            </div>

            <AdvancedSection open={advOpen} onToggle={() => setAdvOpen(o => !o)}>
              {createForm.mode === "TEAM" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div><label className="psp-form-label">Min team size</label><input type="number" className="psp-form-input" value={createForm.minTeamSize} onChange={e => setCreateForm(f => ({ ...f, minTeamSize: parseInt(e.target.value) || 2 }))} /></div>
                  <div><label className="psp-form-label">Max team size</label><input type="number" className="psp-form-input" value={createForm.maxTeamSize} onChange={e => setCreateForm(f => ({ ...f, maxTeamSize: parseInt(e.target.value) || 4 }))} /></div>
                </div>
              )}
              <div>
                <label className="psp-form-label">Access</label>
                <Segmented value={createForm.accessType ?? "REQUEST_BASED"} options={[{ v: "REQUEST_BASED", label: "Request based" }, { v: "OPEN", label: "Open" }]} onChange={v => setCreateForm(f => ({ ...f, accessType: v as any }))} />
              </div>
              {/* Freeze only applies to ICPC / RATED */}
              {createForm.scoringMode !== "PARTIAL" && (
                <div style={{ border: "1px solid var(--line)", borderRadius: "var(--r-sm)", padding: "10px 12px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                    <input type="checkbox" checked={!!createForm.freezeEnabled} onChange={e => setCreateForm(f => ({ ...f, freezeEnabled: e.target.checked }))} />
                    Freeze scoreboard before the competition ends
                  </label>
                  {createForm.freezeEnabled && (
                    <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Freeze</span>
                      <input type="number" className="psp-form-input" style={{ width: 80 }} value={createForm.freezeMinutesBeforeEnd ?? 60} onChange={e => setCreateForm(f => ({ ...f, freezeMinutesBeforeEnd: parseInt(e.target.value) || 60 }))} />
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>minutes before end</span>
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: "var(--text-subtle)", marginTop: 6 }}>Players see standings as of the freeze moment; full standings reveal when the contest ends. Teachers always see live.</div>
                </div>
              )}
            </AdvancedSection>
          </>)}

          {/* Step 3 — Problems */}
          {createStep === 3 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "28px 16px", gap: 10 }}>
              <div style={{ width: 46, height: 46, borderRadius: 12, background: "var(--accent-soft)", display: "grid", placeItems: "center", color: "var(--brand)" }}><ListChecks size={22} /></div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>Add problems after creating</div>
              <div style={{ fontSize: 12.5, color: "var(--ink-2)", maxWidth: 360, lineHeight: 1.6 }}>
                Once the competition is created you&apos;ll attach problems and set per-problem points{createForm.scoringMode === "RATED" ? ", decay rate and floor" : createForm.scoringMode === "ICPC" ? " and wrong-answer penalty" : ""} on the Manage screen.
              </div>
            </div>
          )}

          {/* Step 4 — Review */}
          {createStep === 4 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {[
                ["Title", createForm.title || "—"],
                ["Description", createForm.description?.trim() ? createForm.description : "—"],
                ["Start", createForm.scheduledStartTime ? fmtDate(createForm.scheduledStartTime) : "Not scheduled"],
                ["Duration", fmtDuration(createForm.durationMinutes ?? 120)],
                ["Mode", createForm.mode === "TEAM" ? `Team (${createForm.minTeamSize}–${createForm.maxTeamSize})` : "Solo"],
                ["Access", createForm.accessType === "OPEN" ? "Open" : "Request based"],
                ["Scoring", createForm.scoringMode ?? "ICPC"],
                ["Freeze", createForm.scoringMode !== "PARTIAL" && createForm.freezeEnabled ? `${createForm.freezeMinutesBeforeEnd ?? 60} min before end` : "Off"],
              ].map(([k, v], i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "9px 0", borderBottom: i < 7 ? "1px solid var(--line)" : "none" }}>
                  <span style={{ fontSize: 12.5, color: "var(--ink-3)" }}>{k}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)", textAlign: "right", maxWidth: 380, overflow: "hidden", textOverflow: "ellipsis" }}>{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sticky footer */}
      <div style={{
        position: "sticky", bottom: 0, zIndex: 5,
        background: "var(--bg-secondary)", borderTop: "1px solid var(--line)",
        padding: "12px 0",
      }}>
        <div className="psp-main" style={{ maxWidth: 980, paddingTop: 0, paddingBottom: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button className="psp-btn psp-btn-secondary" onClick={() => createStep === 0 ? cancel() : setCreateStep(s => s - 1)} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {createStep === 0 ? <><X size={14} /> Cancel</> : <><ChevronLeft size={14} /> Back</>}
          </button>
          {createStep < last ? (
            <button className="psp-btn psp-btn-primary" disabled={!canNext} onClick={() => setCreateStep(s => s + 1)} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              Next <ChevronRight size={14} />
            </button>
          ) : (
            <button className="psp-btn psp-btn-primary" onClick={handleCreate} disabled={creating} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {creating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Create competition
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ── Collapsible "Advanced settings" disclosure (max-height transition, 200ms) ──
function AdvancedSection({ open, onToggle, children }: {
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
        style={{
          display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
          color: "var(--ink-3)", font: "600 13px var(--font)", padding: "4px 0 2px", userSelect: "none",
        }}
      >
        <ChevronDown size={16} style={{ transition: "transform 200ms ease", transform: open ? "rotate(180deg)" : "none" }} />
        Advanced settings
      </div>
      <div style={{ overflow: "hidden", maxHeight: open ? 600 : 0, transition: "max-height 200ms ease" }}>
        <div style={{ paddingTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
