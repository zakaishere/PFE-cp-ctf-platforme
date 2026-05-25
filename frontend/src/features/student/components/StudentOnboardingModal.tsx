"use client";

import { useState, useEffect } from "react";
import { GraduationCap, ChevronRight, Loader2, CheckCircle2 } from "lucide-react";
import { getDepartments, getDivisionsByDepartment, getSemesters, updateStudentProfile } from "@/lib/api";

interface AcademicOption { id: string; name: string; }

interface Props {
  open: boolean;
  onComplete: () => void;
}

export default function StudentOnboardingModal({ open, onComplete }: Props) {
  const [departments, setDepartments] = useState<AcademicOption[]>([]);
  const [divisions, setDivisions] = useState<AcademicOption[]>([]);
  const [semesters, setSemesters] = useState<AcademicOption[]>([]);

  const [departmentId, setDepartmentId] = useState("");
  const [divisionId, setDivisionId] = useState("");
  const [semesterId, setSemesterId] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [loadingDivisions, setLoadingDivisions] = useState(false);

  useEffect(() => {
    if (!open) return;
    getDepartments().then(setDepartments).catch(console.error);
    getSemesters().then(setSemesters).catch(console.error);
  }, [open]);

  useEffect(() => {
    if (!departmentId) { setDivisions([]); setDivisionId(""); return; }
    setLoadingDivisions(true);
    setDivisionId("");
    getDivisionsByDepartment(departmentId)
      .then(setDivisions)
      .catch(console.error)
      .finally(() => setLoadingDivisions(false));
  }, [departmentId]);

  const handleSave = async () => {
    if (!divisionId || !semesterId) return;
    setSaving(true);
    try {
      await updateStudentProfile({ divisionId, semesterId });
      setDone(true);
      setTimeout(onComplete, 900);
    } catch (e: any) {
      console.error(e);
      onComplete();
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(9,30,66,0.72)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div className="modal-panel" style={{ background: "var(--bg-primary)", borderRadius: 6, width: "100%", maxWidth: 460, boxShadow: "0 8px 32px rgba(0,0,0,0.24)" }}>
        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#deebff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <GraduationCap size={20} color="#0052cc" />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Complete your profile</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Select your filière and semester to get started</div>
          </div>
        </div>

        {done ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <CheckCircle2 size={40} color="#00875a" style={{ margin: "0 auto 12px" }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Profile saved!</div>
          </div>
        ) : (
          <div style={{ padding: "20px 24px 24px" }}>
            {/* Department */}
            <div className="form-field">
              <label className="label">Department / Faculty</label>
              <select
                className="select"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
              >
                <option value="">— Select department —</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            {/* Division */}
            <div className="form-field">
              <label className="label">Filière / Branch</label>
              <select
                className="select"
                value={divisionId}
                onChange={(e) => setDivisionId(e.target.value)}
                disabled={!departmentId || loadingDivisions}
              >
                <option value="">
                  {loadingDivisions ? "Loading…" : !departmentId ? "— Select department first —" : "— Select filière —"}
                </option>
                {divisions.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            {/* Semester */}
            <div className="form-field" style={{ marginBottom: 24 }}>
              <label className="label">Semester</label>
              <select
                className="select"
                value={semesterId}
                onChange={(e) => setSemesterId(e.target.value)}
              >
                <option value="">— Select semester —</option>
                {semesters.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-secondary btn-md" onClick={onComplete}>
                Skip for now
              </button>
              <button
                className="btn btn-primary btn-md"
                onClick={handleSave}
                disabled={!divisionId || !semesterId || saving}
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <ChevronRight size={14} />}
                Save & continue
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
