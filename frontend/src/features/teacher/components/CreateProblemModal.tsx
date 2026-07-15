"use client";

import { useState } from "react";
import { Plus, Trash2, X, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/PSPToast";
import { createProblem, type TestCaseRequest } from "@/lib/api";

interface CreateProblemModalProps {
  open: boolean;
  onClose: () => void;
  /** Scopes the new problem so it only shows up in the matching picker
   *  (TP_ONLY / EXAM_ONLY). Omit for CP, where problems stay in the shared
   *  global/private bank like today. */
  defaultVisibility?: "TP_ONLY" | "EXAM_ONLY";
  onCreated: (problemId: string) => void;
}

interface TestCaseRow { inputData: string; expectedOutput: string; isHidden: boolean; }

const emptyRow = (): TestCaseRow => ({ inputData: "", expectedOutput: "", isHidden: false });

/**
 * Inline "create a new problem" modal, mirroring the CTF competition's
 * "Add Challenge" flow (create-in-context, distinct from picking an existing
 * one from the bank). Used by TP/Exam/Competition problem tabs.
 */
export default function CreateProblemModal({ open, onClose, defaultVisibility, onCreated }: CreateProblemModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState("EASY");
  const [category, setCategory] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [testCases, setTestCases] = useState<TestCaseRow[]>([emptyRow()]);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  function reset() {
    setTitle(""); setDescription(""); setDifficulty("EASY"); setCategory("");
    setTagsInput(""); setTestCases([emptyRow()]);
  }

  function updateRow(i: number, patch: Partial<TestCaseRow>) {
    setTestCases(rows => rows.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  }

  async function handleCreate() {
    if (!title.trim()) { toast.warning("Title required", "Give the problem a title first."); return; }
    if (testCases.every(tc => !tc.expectedOutput.trim())) {
      toast.warning("At least one test case", "Add at least one test case with an expected output.");
      return;
    }
    setSaving(true);
    try {
      const mappedTC: TestCaseRequest[] = testCases
        .filter(tc => tc.expectedOutput.trim())
        .map(tc => ({ inputData: tc.inputData, expectedOutput: tc.expectedOutput, isHidden: tc.isHidden }));
      const tags = tagsInput.split(",").map(t => t.trim()).filter(Boolean);

      const res = await createProblem({
        title: title.trim(),
        description,
        difficultyLevel: difficulty,
        isPublic: !defaultVisibility, // TP/Exam-scoped problems aren't public bank entries
        visibility: defaultVisibility,
        category: category || undefined,
        tags,
        testCases: mappedTC,
      });

      toast.success("Problem created", `"${title.trim()}" is ready to attach.`);
      onCreated(res.problemId);
      reset();
      onClose();
    } catch (err) {
      toast.error("Failed to create problem", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="psp-modal-overlay" onClick={onClose}>
      <div className="psp-modal" style={{ maxWidth: 560, maxHeight: "85vh", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
        <div className="psp-modal-header">
          <span style={{ fontSize: 16, fontWeight: 600 }}>Create New Problem</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={18} /></button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label className="psp-form-label">Title *</label>
            <input className="psp-form-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Two Sum" />
          </div>

          <div>
            <label className="psp-form-label">Description</label>
            <textarea className="psp-form-textarea" value={description} onChange={e => setDescription(e.target.value)}
              style={{ minHeight: 90 }} placeholder="Problem statement, input/output format, constraints…" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label className="psp-form-label">Difficulty</label>
              <select className="psp-form-input" value={difficulty} onChange={e => setDifficulty(e.target.value)}>
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>
            </div>
            <div>
              <label className="psp-form-label">Category</label>
              <input className="psp-form-input" value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Arrays" />
            </div>
          </div>

          <div>
            <label className="psp-form-label">Tags (comma-separated)</label>
            <input className="psp-form-input" value={tagsInput} onChange={e => setTagsInput(e.target.value)} placeholder="arrays, hashmap" />
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <label className="psp-form-label" style={{ margin: 0 }}>Test Cases *</label>
              <button type="button" className="psp-btn psp-btn-secondary psp-btn-sm"
                onClick={() => setTestCases(rows => [...rows, emptyRow()])}>
                <Plus size={12} /> Add case
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {testCases.map((tc, i) => (
                <div key={i} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 10 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                    <div>
                      <label className="psp-form-label" style={{ fontSize: 11 }}>Input</label>
                      <textarea className="psp-form-textarea" value={tc.inputData}
                        onChange={e => updateRow(i, { inputData: e.target.value })}
                        style={{ minHeight: 50, fontFamily: "var(--font-mono)", fontSize: 12 }} />
                    </div>
                    <div>
                      <label className="psp-form-label" style={{ fontSize: 11 }}>Expected Output</label>
                      <textarea className="psp-form-textarea" value={tc.expectedOutput}
                        onChange={e => updateRow(i, { expectedOutput: e.target.value })}
                        style={{ minHeight: 50, fontFamily: "var(--font-mono)", fontSize: 12 }} />
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink-2)" }}>
                      <input type="checkbox" checked={tc.isHidden} onChange={e => updateRow(i, { isHidden: e.target.checked })} />
                      Hidden from students
                    </label>
                    {testCases.length > 1 && (
                      <button type="button" onClick={() => setTestCases(rows => rows.filter((_, idx) => idx !== i))}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", display: "flex", alignItems: "center" }}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--line)", display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button className="psp-btn psp-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="psp-btn psp-btn-primary" onClick={handleCreate} disabled={saving} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {saving && <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />}
            Create & Attach
          </button>
        </div>
      </div>
    </div>
  );
}
