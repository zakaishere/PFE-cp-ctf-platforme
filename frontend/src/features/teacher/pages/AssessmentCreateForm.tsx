"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { X, Plus, Loader2, ChevronDown } from "lucide-react";
import {
  createLiveExam, createOpenTP, getMyModules,
  CreateAssessmentRequest, ModuleOption,
} from "@/lib/api";
import { toast } from "@/components/ui/PSPToast";

const EMPTY_FORM: CreateAssessmentRequest = {
  title: "", description: "", moduleId: "",
  visibilityMode: "MODULE_ONLY", strictAccessCode: "",
  scheduledStartTime: "", durationMinutes: 90,
  deadline: "", maxAttempts: 3,
};

export default function AssessmentCreateForm({ type }: { type: "exam" | "tp" }) {
  const router = useRouter();
  const isExam = type === "exam";

  const [createForm, setCreateForm] = useState<CreateAssessmentRequest>({ ...EMPTY_FORM });
  // Fields from the design that the backend doesn't accept yet — rendered but
  // NOT sent (kept out of the create payload). See backend follow-ups.
  const [pendingFields, setPendingFields] = useState({ passingScore: 60, tpAttemptDurationMin: 0 });
  const [modules, setModules] = useState<ModuleOption[]>([]);
  const [creating, setCreating] = useState(false);

  // Advanced settings start collapsed; auto-open if any advanced field was
  // seeded with a non-default value (e.g. returning to edit a draft).
  const [advOpen, setAdvOpen] = useState(() =>
    isExam
      ? pendingFields.passingScore !== 60
      : createForm.maxAttempts !== 3 || pendingFields.tpAttemptDurationMin !== 0
  );

  useEffect(() => {
    let cancelled = false;
    getMyModules().then(m => { if (!cancelled) setModules(m); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const cancel = () => router.push("/teacher/exams");

  const handleCreate = async () => {
    if (!createForm.title.trim()) {
      toast.warning("Title required", "Give it a title first.");
      return;
    }
    if (createForm.visibilityMode === "MODULE_ONLY" && !createForm.moduleId) {
      toast.warning("Module required", "Pick a module, or switch visibility to Request based / Access code.");
      return;
    }
    if (createForm.visibilityMode === "ACCESS_CODE" && !createForm.strictAccessCode?.trim()) {
      toast.warning("Access code required", "Set a code students will enter to join.");
      return;
    }
    if (isExam && !createForm.scheduledStartTime?.trim()) {
      toast.warning("Start time required", "Pick a start date & time before creating.");
      return;
    }
    if (!isExam && !createForm.deadline?.trim()) {
      toast.warning("Deadline required", "Pick a deadline before creating.");
      return;
    }

    setCreating(true);
    try {
      if (isExam) {
        await createLiveExam(createForm);
      } else {
        await createOpenTP(createForm);
      }
      toast.success(isExam ? "Exam created" : "TP created", `"${createForm.title}" is ready — attach problems next.`);
      router.push("/teacher/exams");
    } catch (e) {
      toast.error("Failed to create", e instanceof Error ? e.message : "Please try again.");
      setCreating(false);
    }
  };

  return (
    <>
      <Navbar />

      <div className="psp-main" style={{ maxWidth: 780, paddingBottom: 96 }}>
        {/* Back link — focused creation flow, no full breadcrumb */}
        <button onClick={() => router.back()} style={{
          display: "flex", alignItems: "center", gap: 6,
          color: "var(--ink-3)", fontSize: 13, fontWeight: 600,
          background: "none", border: "none", cursor: "pointer",
          marginBottom: 20, padding: 0,
        }}>
          ← Back
        </button>

        {/* Page header */}
        <div style={{ marginBottom: 6 }}>
          <span style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>
            {isExam ? "New Live Exam" : "New Open TP"}
          </span>
        </div>
        <div style={{ fontSize: 13.5, color: "var(--text-secondary)", marginBottom: 24 }}>
          {isExam
            ? "Schedule a timed exam, set access, then attach problems afterward."
            : "Open a practice TP with a deadline and attempt limit, then attach tasks afterward."}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* ── Section: Basics ── */}
          <div className="psp-card" style={{ padding: 18, border: "1px solid rgba(255,255,255,.08)", display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="section-title" style={{ marginBottom: 0 }}>Basics</div>
            <div>
              <label className="psp-form-label">Title <span className="req">*</span></label>
              <input className="psp-form-input" autoFocus value={createForm.title}
                onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))} placeholder={isExam ? "e.g. Midterm — Data Structures" : "e.g. Lab 3 — Recursion"} />
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
          <div className="psp-card" style={{ padding: 18, border: "1px solid rgba(255,255,255,.08)", display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="section-title" style={{ marginBottom: 0 }}>Schedule &amp; access</div>
            {isExam ? (
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
              <div>
                <label className="psp-form-label">Deadline</label>
                <input type="datetime-local" className="psp-form-input" value={createForm.deadline}
                  onChange={e => setCreateForm(f => ({ ...f, deadline: e.target.value }))} />
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

          {/* ── Section: Advanced (collapsed by default) ── */}
          <div className="psp-card" style={{ padding: "4px 18px 18px", border: "1px solid rgba(255,255,255,.08)" }}>
            <AdvancedSection open={advOpen} onToggle={() => setAdvOpen(o => !o)}>
              {isExam ? (
                <div>
                  <label className="psp-form-label">Passing score (%)</label>
                  <input type="number" min={0} max={100} className="psp-form-input" value={pendingFields.passingScore}
                    onChange={e => setPendingFields(f => ({ ...f, passingScore: parseInt(e.target.value) || 0 }))} />
                  <div className="hint">Pass/fail threshold. Not yet enforced by the backend — see follow-ups.</div>
                </div>
              ) : (
                <>
                  <div>
                    <label className="psp-form-label">Max attempts</label>
                    <input type="number" className="psp-form-input" value={createForm.maxAttempts}
                      onChange={e => setCreateForm(f => ({ ...f, maxAttempts: parseInt(e.target.value) || 3 }))} />
                  </div>
                  <div>
                    <label className="psp-form-label">Attempt duration (mins, optional)</label>
                    <input type="number" min={0} className="psp-form-input" value={pendingFields.tpAttemptDurationMin}
                      onChange={e => setPendingFields(f => ({ ...f, tpAttemptDurationMin: parseInt(e.target.value) || 0 }))} placeholder="0 = no limit" />
                    <div className="hint">Per-attempt time limit. Not yet enforced by the backend — see follow-ups.</div>
                  </div>
                </>
              )}
            </AdvancedSection>
          </div>
        </div>
      </div>

      {/* Sticky footer */}
      <div style={{
        position: "sticky", bottom: 0, zIndex: 5,
        background: "rgba(10,10,10,.95)", backdropFilter: "blur(12px)",
        borderTop: "1px solid rgba(255,255,255,.08)",
        padding: "12px 0",
      }}>
        <div className="psp-main" style={{ maxWidth: 780, paddingTop: 0, paddingBottom: 0, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10 }}>
          <button className="psp-btn psp-btn-secondary" onClick={cancel} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <X size={14} /> Cancel
          </button>
          <button className="psp-btn psp-btn-primary" onClick={handleCreate} disabled={creating}
            style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {creating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Create {isExam ? "exam" : "TP"}
          </button>
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
          color: "var(--ink-3)", font: "600 13px var(--font)", padding: "12px 0 2px", userSelect: "none",
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
