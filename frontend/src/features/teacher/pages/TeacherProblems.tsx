"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import {
  Plus, Search, Edit2, Trash2, Eye, EyeOff, Send, Save,
  ChevronDown, ChevronUp, Code2, FileText, X, ExternalLink,
  Lightbulb, ChevronLeft, ChevronRight, Check,
} from "lucide-react";
import { toast } from "@/components/ui/PSPToast";
import {
  createProblem,
  updateProblem,
  deleteProblem as deleteProblemApi,
  toggleProblemVisibility,
  getProblemsPage,
  CreateProblemRequest,
  UpdateProblemRequest,
  TestCaseRequest,
} from "@/lib/api";
import { TagsInput } from "@/components/problem/TagsInput";

// ─── Types ───────────────────────────────────────────────────────────────────

type ProblemStatus = "published" | "draft" | "unpublished";
type Difficulty    = "Easy" | "Medium" | "Hard";

interface TestCase {
  id:             string;
  input:          string;
  expectedOutput: string;
  isHidden:       boolean;
}

interface Problem {
  id:           string;
  title:        string;
  description:  string;
  category:     string;
  difficulty:   Difficulty;
  status:       ProblemStatus;
  testCases:    TestCase[];
  tags:         string[];
  hints:        string[];
  timeLimitMs:  number;
  memoryLimitMb: number;
  createdAt:    string;
  updatedAt:    string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const categories = [
  "Arrays", "Strings", "Linked Lists", "Trees", "Graphs",
  "Dynamic Programming", "Sorting", "Backtracking", "Stacks",
  "Design", "Two Pointers", "Math",
];

const emptyTestCase = (): TestCase => ({
  id: `tc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  input: "", expectedOutput: "", isHidden: false,
});

const emptyProblem = () => ({
  title: "", description: "", category: "Arrays",
  difficulty: "Easy" as Difficulty, status: "draft" as ProblemStatus,
  testCases: [emptyTestCase()], timeLimitMs: 2000, memoryLimitMb: 256,
  tags: [] as string[], hints: [] as string[],
});

// ─── Badge helpers (use existing psp-badge classes from globals.css) ──────────

function statusBadgeClass(s: ProblemStatus) {
  if (s === "published") return "b-tp";      // green solid
  if (s === "draft")     return "b-pending"; // amber solid
  return "b-priv";                           // gray
}

function diffBadgeClass(d: Difficulty) {
  if (d === "Easy")   return "b-easy";
  if (d === "Medium") return "b-med";
  return "b-hard";
}

// ─── Icon button style ────────────────────────────────────────────────────────

const iconBtn: React.CSSProperties = {
  width: 28, height: 28, display: "flex", alignItems: "center",
  justifyContent: "center", border: "none", background: "none",
  cursor: "pointer", color: "var(--text-muted)", borderRadius: 3,
  transition: "background 0.1s, color 0.1s",
};

// ─── Component ───────────────────────────────────────────────────────────────

const TeacherProblems = () => {
  // list state
  const [problems, setProblems]           = useState<Problem[]>([]);
  const [currentPage, setCurrentPage]     = useState(0);
  const [pageSize]                        = useState(20);
  const [totalPages, setTotalPages]       = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [isLoading, setIsLoading]         = useState(false);

  // filters
  const [search, setSearch]           = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [diffFilter, setDiffFilter]   = useState<string>("all");

  // editor
  const [editorOpen, setEditorOpen]         = useState(false);
  const [editingProblem, setEditingProblem] = useState<Problem | null>(null);
  const [form, setForm]                     = useState(emptyProblem());
  const [testCases, setTestCases]           = useState<TestCase[]>([emptyTestCase()]);
  const [expandedTC, setExpandedTC]         = useState<string | null>(null);

  // delete
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchProblems(currentPage, pageSize);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize]);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchProblems = async (page: number, size: number) => {
    setIsLoading(true);
    try {
      const raw = await getProblemsPage(page, size) as any;
      let items: any[], total: number, pages: number;

      if (Array.isArray(raw)) {
        items = raw.slice(page * size, page * size + size);
        total = raw.length;
        pages = Math.max(1, Math.ceil(raw.length / size));
      } else {
        items = raw.content ?? [];
        total = raw.totalElements ?? 0;
        pages = raw.totalPages ?? 0;
      }

      const mapped: Problem[] = items.map((d: any) => ({
        id:          d.problemId,
        title:       d.title,
        description: d.description,
        category:    d.category || "General",
        difficulty:  d.difficultyLevel
          ? (d.difficultyLevel.charAt(0).toUpperCase() + d.difficultyLevel.slice(1).toLowerCase()) as Difficulty
          : "Easy",
        status:    (d.isPublic ? "published" : "draft") as ProblemStatus,
        testCases: d.testCases?.map((tc: any) => ({
          id:             tc.id || tc.testCaseId,
          input:          tc.inputData,
          expectedOutput: tc.expectedOutput,
          isHidden:       tc.isHidden,
        })) || [],
        tags:         d.tags         || [],
        hints:        d.hints        || [],
        timeLimitMs:  d.timeLimitMs  || 2000,
        memoryLimitMb: d.memoryLimitMb || 256,
        createdAt:   d.createdAt ? d.createdAt.split("T")[0] : new Date().toISOString().split("T")[0],
        updatedAt:   new Date().toISOString().split("T")[0],
      }));

      setProblems(mapped);
      setTotalPages(pages);
      setTotalElements(total);
    } catch {
      toast.error("Failed to load problems", "Could not fetch the problems list.");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Filters ────────────────────────────────────────────────────────────────

  const filtered = problems.filter(p => {
    const matchSearch = p.title.toLowerCase().includes(search.toLowerCase())
      || p.category.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    const matchDiff   = diffFilter   === "all" || p.difficulty === diffFilter;
    return matchSearch && matchStatus && matchDiff;
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingProblem(null);
    const initial = emptyProblem();
    setForm(initial);
    setTestCases(initial.testCases);
    setExpandedTC(null);
    setEditorOpen(true);
  };

  const openEdit = (p: Problem) => {
    setEditingProblem(p);
    setForm({
      title:        p.title,
      description:  p.description,
      category:     p.category || "General",
      difficulty:   p.difficulty,
      status:       p.status,
      testCases:    p.testCases,
      timeLimitMs:  p.timeLimitMs  || 2000,
      memoryLimitMb: p.memoryLimitMb || 256,
      tags:   [...(p.tags  || [])],
      hints:  [...(p.hints || [])],
    });
    setTestCases([...p.testCases]);
    setExpandedTC(null);
    setEditorOpen(true);
  };

  const saveProblem = async (status: ProblemStatus) => {
    if (!form.title.trim()) {
      toast.warning("Title required", "Please enter a problem title before saving.");
      return;
    }
    try {
      const isPublic = status === "published";
      const mappedTC: TestCaseRequest[] = testCases.map(tc => ({
        inputData:      tc.input,
        expectedOutput: tc.expectedOutput,
        isHidden:       tc.isHidden,
      }));

      if (editingProblem) {
        const req: UpdateProblemRequest = {
          title: form.title, description: form.description,
          difficultyLevel: form.difficulty.toUpperCase(), isPublic,
          timeLimitMs: form.timeLimitMs, memoryLimitMb: form.memoryLimitMb,
          testCases: mappedTC, tags: form.tags, category: form.category, hints: form.hints,
        };
        await updateProblem(editingProblem.id, req);
        toast.success("Problem updated", "Your changes have been saved.");
      } else {
        const req: CreateProblemRequest = {
          title: form.title, description: form.description,
          difficultyLevel: form.difficulty.toUpperCase(), isPublic,
          timeLimitMs: form.timeLimitMs, memoryLimitMb: form.memoryLimitMb,
          testCases: mappedTC, tags: form.tags, category: form.category, hints: form.hints,
        };
        await createProblem(req);
        toast.success(
          status === "published" ? "Problem published" : "Problem saved as draft",
          `"${form.title}" is now ${status === "published" ? "live for students" : "saved as a draft"}.`
        );
      }
      setEditorOpen(false);
      // Always go back to page 0 so the newest/updated problem is visible at the top
      setCurrentPage(0);
      fetchProblems(0, pageSize);
    } catch (err: any) {
      toast.error(
        editingProblem ? "Error updating problem" : "Error creating problem",
        err.message ?? "Something went wrong. Please try again."
      );
    }
  };

  const deleteProblem = async () => {
    if (!deleteId) return;
    try {
      await deleteProblemApi(deleteId);
      setProblems(prev => prev.filter(p => p.id !== deleteId));
      toast.success("Problem deleted", "The problem has been permanently removed.");
    } catch (err: any) {
      toast.error("Error deleting problem", err.message ?? "Could not delete the problem.");
    } finally {
      setDeleteId(null);
    }
  };

  const toggleStatus = async (p: Problem) => {
    const next: ProblemStatus = p.status === "published" ? "unpublished" : "published";
    try {
      await toggleProblemVisibility(p.id, next === "published");
      setProblems(prev => prev.map(x =>
        x.id === p.id ? { ...x, status: next, updatedAt: new Date().toISOString().split("T")[0] } : x
      ));
      toast.success(`Problem ${next}`, `"${p.title}" is now ${next}.`);
    } catch (err: any) {
      toast.error("Error updating visibility", err.message ?? "Could not update the problem visibility.");
    }
  };

  // ── Test case helpers ──────────────────────────────────────────────────────

  const addTestCase = () => {
    const tc = emptyTestCase();
    setTestCases(prev => [...prev, tc]);
    setExpandedTC(tc.id);
  };
  const removeTestCase   = (id: string) => setTestCases(prev => prev.filter(tc => tc.id !== id));
  const updateTestCase   = (id: string, field: keyof TestCase, value: string | boolean) =>
    setTestCases(prev => prev.map(tc => tc.id === id ? { ...tc, [field]: value } : tc));

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <Navbar />
      <div className="psp-main">

        {/* ── Page Header ───────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)" }}>Problems</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
              {totalElements} problem{totalElements !== 1 ? "s" : ""} in your library — manage, publish, and assign to assessments
            </div>
          </div>
          <button className="psp-btn psp-btn-primary" onClick={openCreate}>
            <Code2 size={13} /> New Problem
          </button>
        </div>

        {/* ── Problems Table ─────────────────────────────────────────────── */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r)", overflow: "hidden" }}>

          {/* Toolbar */}
          <div style={{ padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: "0 0 200px" }}>
              <Search size={12} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "var(--ink-3)", pointerEvents: "none" }} />
              <input className="psp-search" style={{ paddingLeft: 26, width: "100%" }} placeholder="Search problems…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {/* Status segmented group */}
            <div style={{ display: "inline-flex", background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: 9, padding: 3, gap: 2 }}>
              {(["all", "published", "draft", "unpublished"] as const).map(s => (
                <button key={s} onClick={() => setStatusFilter(s)} style={{ padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: statusFilter === s ? 600 : 400, background: statusFilter === s ? "var(--surface-3)" : "transparent", color: statusFilter === s ? "var(--ink)" : "var(--ink-3)", transition: "all 0.1s" }}>
                  {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
            {/* Difficulty segmented group */}
            <div style={{ display: "inline-flex", background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: 9, padding: 3, gap: 2 }}>
              {(["all", "Easy", "Medium", "Hard"] as const).map(d => (
                <button key={d} onClick={() => setDiffFilter(d)} style={{ padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: diffFilter === d ? 600 : 400, background: diffFilter === d ? "var(--surface-3)" : "transparent", color: diffFilter === d ? "var(--ink)" : "var(--ink-3)", transition: "all 0.1s" }}>
                  {d === "all" ? "All Difficulties" : d}
                </button>
              ))}
            </div>
          </div>

          {/* Column headers */}
          <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 110px 180px 90px 80px", padding: "7px 16px", background: "var(--bg-2)", borderBottom: "1px solid var(--line)" }}>
            {(["", "Problem", "Difficulty", "Category", "Test cases", ""] as const).map((h, i) => (
              <div key={i} style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: i === 5 ? "right" : "left" }}>
                {h}
              </div>
            ))}
          </div>

          {/* Loading skeletons */}
          {isLoading && Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "40px 1fr 110px 180px 90px 80px", padding: "12px 16px", borderBottom: "1px solid var(--line)", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "center" }}><div className="skel" style={{ width: 20, height: 20, borderRadius: "50%" }} /></div>
              <div><div className="skel" style={{ width: "52%", height: 13, borderRadius: 3, marginBottom: 6 }} /><div className="skel" style={{ width: "32%", height: 10, borderRadius: 3 }} /></div>
              <div className="skel" style={{ width: 58, height: 14, borderRadius: 3 }} />
              <div className="skel" style={{ width: 80, height: 12, borderRadius: 3 }} />
              <div className="skel" style={{ width: 36, height: 12, borderRadius: 3 }} />
              <div />
            </div>
          ))}

          {/* Empty state */}
          {!isLoading && filtered.length === 0 && (
            <div className="psp-empty">
              <div className="psp-empty-title">No problems found</div>
              <div style={{ fontSize: 13 }}>
                Try adjusting your filters or{" "}
                <button style={{ color: "var(--brand)", background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: 0, fontSize: 13 }} onClick={openCreate}>
                  create a new problem
                </button>
              </div>
            </div>
          )}

          {/* Problem rows */}
          {!isLoading && filtered.map(p => (
            <ProblemRow key={p.id} p={p} onEdit={openEdit} onToggle={toggleStatus} onDelete={id => setDeleteId(id)} />
          ))}

          {/* Pagination footer */}
          {!isLoading && totalPages > 1 && (
            <div style={{ padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid var(--line)" }}>
              <span style={{ fontSize: 12, color: "var(--ink-3)" }}>
                {totalElements > 0 ? `${currentPage * pageSize + 1}–${Math.min((currentPage + 1) * pageSize, totalElements)} of ${totalElements}` : `${totalElements} problems`}
              </span>
              <div style={{ display: "flex", gap: 4 }}>
                <button disabled={currentPage === 0} onClick={() => setCurrentPage(p => Math.max(0, p - 1))} style={{ width: 32, height: 32, border: "1px solid var(--line)", borderRadius: 7, background: "transparent", color: "var(--ink-2)", cursor: currentPage === 0 ? "not-allowed" : "pointer", opacity: currentPage === 0 ? 0.4 : 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i).map(pg => (
                  <button key={pg} onClick={() => setCurrentPage(pg)} style={{ width: 32, height: 32, border: "1px solid var(--line)", borderRadius: 7, fontSize: 13, fontWeight: 600, background: currentPage === pg ? "var(--brand)" : "transparent", color: currentPage === pg ? "#fff" : "var(--ink-2)", cursor: "pointer" }}>
                    {pg + 1}
                  </button>
                ))}
                <button disabled={currentPage >= totalPages - 1} onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))} style={{ width: 32, height: 32, border: "1px solid var(--line)", borderRadius: 7, background: "transparent", color: "var(--ink-2)", cursor: currentPage >= totalPages - 1 ? "not-allowed" : "pointer", opacity: currentPage >= totalPages - 1 ? 0.4 : 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Problem Editor Modal ───────────────────────────────────────── */}
      {editorOpen && (
        <div
          className="psp-modal-overlay"
          onClick={e => e.target === e.currentTarget && setEditorOpen(false)}
        >
          <div className="psp-modal" style={{ width: "90vw", maxWidth: 720, maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
            {/* Header */}
            <div className="psp-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FileText size={16} color="var(--brand)" />
                <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                  {editingProblem ? "Edit Problem" : "New Problem"}
                </span>
              </div>
              <button
                style={{ ...iconBtn, color: "var(--text-muted)" }}
                onClick={() => setEditorOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="psp-modal-body" style={{ overflowY: "auto", flex: 1 }}>
              <div style={{ display: "grid", gap: 16 }}>

                {/* Title */}
                <div>
                  <label className="psp-form-label">Title</label>
                  <input
                    className="psp-form-input"
                    placeholder="e.g. Two Sum"
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="psp-form-label">Description</label>
                  <textarea
                    className="psp-form-textarea"
                    placeholder="Describe the problem statement, constraints, and examples…"
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    style={{ minHeight: 100 }}
                  />
                </div>

                {/* Category + Difficulty */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label className="psp-form-label">Category</label>
                    <select
                      className="psp-form-select"
                      value={form.category}
                      onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    >
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="psp-form-label">Difficulty</label>
                    <select
                      className="psp-form-select"
                      value={form.difficulty}
                      onChange={e => setForm(f => ({ ...f, difficulty: e.target.value as Difficulty }))}
                    >
                      <option value="Easy">Easy</option>
                      <option value="Medium">Medium</option>
                      <option value="Hard">Hard</option>
                    </select>
                  </div>
                </div>

                {/* Topics */}
                <div>
                  <label className="psp-form-label">Topics (up to 8)</label>
                  <TagsInput
                    value={form.tags}
                    onChange={tags => setForm(f => ({ ...f, tags }))}
                  />
                </div>

                {/* Hints */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <label className="psp-form-label" style={{ marginBottom: 0, display: "flex", alignItems: "center", gap: 6 }}>
                      <Lightbulb size={13} color="var(--warn)" />
                      Hints ({form.hints.length})
                      <span style={{ fontSize: 11, color: "var(--text-subtle)", fontWeight: 400 }}>
                        — shown to students on request
                      </span>
                    </label>
                    <button
                      className="psp-btn psp-btn-secondary psp-btn-sm"
                      type="button"
                      onClick={() => setForm(f => ({ ...f, hints: [...f.hints, ""] }))}
                    >
                      <Plus size={11} /> Add Hint
                    </button>
                  </div>
                  <div style={{ display: "grid", gap: 6 }}>
                    {form.hints.map((hint, idx) => (
                      <div key={idx} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: "var(--text-subtle)", fontFamily: "monospace", minWidth: 22, textAlign: "right" }}>
                          #{idx + 1}
                        </span>
                        <input
                          className="psp-form-input"
                          style={{ flex: 1 }}
                          placeholder={`Hint ${idx + 1}…`}
                          value={hint}
                          onChange={e => {
                            const updated = [...form.hints];
                            updated[idx] = e.target.value;
                            setForm(f => ({ ...f, hints: updated }));
                          }}
                        />
                        <button
                          style={iconBtn}
                          type="button"
                          onClick={() => setForm(f => ({ ...f, hints: f.hints.filter((_, i) => i !== idx) }))}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                    {form.hints.length === 0 && (
                      <p style={{ fontSize: 12, color: "var(--text-subtle)", fontStyle: "italic", paddingLeft: 28 }}>
                        No hints yet.
                      </p>
                    )}
                  </div>
                </div>

                {/* Execution Limits */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label className="psp-form-label">Time Limit (ms)</label>
                    <input
                      className="psp-form-input"
                      type="number"
                      placeholder="2000"
                      value={form.timeLimitMs}
                      onChange={e => setForm(f => ({ ...f, timeLimitMs: parseInt(e.target.value) || 2000 }))}
                    />
                  </div>
                  <div>
                    <label className="psp-form-label">Memory Limit (MB)</label>
                    <input
                      className="psp-form-input"
                      type="number"
                      placeholder="256"
                      value={form.memoryLimitMb}
                      onChange={e => setForm(f => ({ ...f, memoryLimitMb: parseInt(e.target.value) || 256 }))}
                    />
                  </div>
                </div>

                {/* Test Cases */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <label className="psp-form-label" style={{ marginBottom: 0, display: "flex", alignItems: "center", gap: 6 }}>
                      <Code2 size={13} color="var(--brand)" />
                      Test Cases ({testCases.length})
                    </label>
                    <button className="psp-btn psp-btn-secondary psp-btn-sm" onClick={addTestCase}>
                      <Plus size={11} /> Add
                    </button>
                  </div>
                  <div style={{ display: "grid", gap: 6 }}>
                    {testCases.map((tc, idx) => (
                      <div key={tc.id} style={{ border: "1px solid var(--border)", borderRadius: 3, overflow: "hidden" }}>
                        <div
                          role="button"
                          tabIndex={0}
                          style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "8px 12px", cursor: "pointer", background: "var(--bg-tertiary)",
                          }}
                          onClick={() => setExpandedTC(expandedTC === tc.id ? null : tc.id)}
                          onKeyDown={e => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setExpandedTC(expandedTC === tc.id ? null : tc.id);
                            }
                          }}
                        >
                          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>#{idx + 1}</span>
                            <span style={{ fontSize: 12, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 340 }}>
                              {tc.input || "Empty test case"}
                            </span>
                            {tc.isHidden && (
                              <span className="psp-badge b-priv" style={{ fontSize: 10 }}>Hidden</span>
                            )}
                          </span>
                          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <button
                              type="button"
                              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", padding: 2 }}
                              onClick={e => { e.stopPropagation(); removeTestCase(tc.id); }}
                            >
                              <X size={12} />
                            </button>
                            {expandedTC === tc.id
                              ? <ChevronUp size={13} color="var(--text-muted)" />
                              : <ChevronDown size={13} color="var(--text-muted)" />
                            }
                          </span>
                        </div>
                        {expandedTC === tc.id && (
                          <div style={{ padding: 12, borderTop: "1px solid var(--border)", display: "grid", gap: 10, background: "var(--bg-primary)" }}>
                            <div>
                              <label className="psp-form-label" style={{ fontSize: 11 }}>Input</label>
                              <textarea
                                className="psp-form-textarea"
                                placeholder="e.g. [2,7,11,15], target=9"
                                value={tc.input}
                                onChange={e => updateTestCase(tc.id, "input", e.target.value)}
                                style={{ minHeight: 56, fontFamily: "var(--font-mono), monospace", fontSize: 12.5, background: "#0c0c0c", color: "#b8d0b8" }}
                              />
                            </div>
                            <div>
                              <label className="psp-form-label" style={{ fontSize: 11 }}>Expected Output</label>
                              <textarea
                                className="psp-form-textarea"
                                placeholder="e.g. [0,1]"
                                value={tc.expectedOutput}
                                onChange={e => updateTestCase(tc.id, "expectedOutput", e.target.value)}
                                style={{ minHeight: 56, fontFamily: "var(--font-mono), monospace", fontSize: 12.5, background: "#0c0c0c", color: "#b8d0b8" }}
                              />
                            </div>
                            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, color: "var(--text-secondary)" }}>
                              <input
                                type="checkbox"
                                checked={tc.isHidden}
                                onChange={e => updateTestCase(tc.id, "isHidden", e.target.checked)}
                                style={{ accentColor: "var(--brand)" }}
                              />
                              Hidden from students (used for grading only)
                            </label>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>

            {/* Footer */}
            <div className="psp-modal-footer">
              <button className="psp-btn psp-btn-secondary" onClick={() => setEditorOpen(false)}>
                Cancel
              </button>
              <button
                className="psp-btn psp-btn-secondary"
                style={{ borderColor: "var(--warn)", color: "var(--warn)" }}
                onClick={() => saveProblem("draft")}
              >
                <Save size={13} /> Save as Draft
              </button>
              <button className="psp-btn psp-btn-primary" onClick={() => saveProblem("published")}>
                <Send size={13} /> Publish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ──────────────────────────────────── */}
      {!!deleteId && (
        <div className="psp-modal-overlay" onClick={e => e.target === e.currentTarget && setDeleteId(null)}>
          <div className="psp-modal" style={{ width: 400 }}>
            <div className="psp-modal-header">
              <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Delete problem?</span>
              <button style={iconBtn} onClick={() => setDeleteId(null)}><X size={16} /></button>
            </div>
            <div className="psp-modal-body" style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              This action cannot be undone. The problem and all its test cases will be permanently removed.
            </div>
            <div className="psp-modal-footer">
              <button className="psp-btn psp-btn-secondary" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="psp-btn psp-btn-danger" onClick={deleteProblem}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// ─── Problem Row ──────────────────────────────────────────────────────────────

function ProblemRow({
  p,
  onEdit,
  onToggle,
  onDelete,
}: {
  p:        Problem;
  onEdit:   (p: Problem) => void;
  onToggle: (p: Problem) => void;
  onDelete: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);

  const dot = p.status === "published"
    ? { bg: "var(--success-soft)", border: "var(--success)", check: true }
    : p.status === "draft"
    ? { bg: "var(--warn-soft)", border: "var(--warn)", check: false }
    : { bg: "transparent", border: "var(--line-strong)", check: false };

  const diffColor = p.difficulty === "Easy" ? "var(--success-ink)" : p.difficulty === "Medium" ? "var(--warn-ink)" : "var(--danger-ink)";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "40px 1fr 110px 180px 90px 80px",
        padding: "11px 16px",
        borderBottom: "1px solid var(--line)",
        alignItems: "center",
        background: hovered ? "var(--surface-2)" : "transparent",
        transition: "background 0.1s",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Col 1: status dot */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <div style={{ width: 20, height: 20, borderRadius: "50%", background: dot.bg, border: `1.5px solid ${dot.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {dot.check && <Check size={10} color="var(--success)" />}
        </div>
      </div>

      {/* Col 2: title + tags */}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: p.tags.length ? 4 : 0 }}>
          {p.title}
        </div>
        {p.tags.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {p.tags.slice(0, 4).map(tag => (
              <span key={tag} style={{ background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: 6, padding: "1px 7px", fontSize: 11, fontFamily: "ui-monospace, monospace", color: "var(--ink-3)" }}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Col 3: difficulty */}
      <div style={{ fontSize: 13, fontFamily: "ui-monospace, monospace", fontWeight: 600, color: diffColor }}>
        {p.difficulty}
      </div>

      {/* Col 4: category */}
      <div style={{ fontSize: 13, color: "var(--ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {p.category}
      </div>

      {/* Col 5: test cases */}
      <div style={{ fontSize: 13, color: "var(--ink-3)" }}>
        {p.testCases.length}
      </div>

      {/* Col 6: actions */}
      <div style={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
        <Link href={`/problems/${p.id}`} target="_blank">
          <ActionIcon title="Try problem"><ExternalLink size={13} /></ActionIcon>
        </Link>
        <ActionIcon title={p.status === "published" ? "Unpublish" : "Publish"} onClick={() => onToggle(p)}>
          {p.status === "published" ? <EyeOff size={13} /> : <Eye size={13} />}
        </ActionIcon>
        <ActionIcon title="Edit" onClick={() => onEdit(p)}>
          <Edit2 size={13} />
        </ActionIcon>
        <ActionIcon title="Delete" danger onClick={() => onDelete(p.id)}>
          <Trash2 size={13} />
        </ActionIcon>
      </div>
    </div>
  );
}

// ─── Action icon button ───────────────────────────────────────────────────────

function ActionIcon({
  children, title, danger = false, onClick,
}: {
  children: React.ReactNode;
  title?:   string;
  danger?:  boolean;
  onClick?: () => void;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
        border: "none", cursor: "pointer", borderRadius: 6, transition: "background 0.1s, color 0.1s",
        background: hov ? (danger ? "var(--danger-soft)" : "var(--surface-3)") : "transparent",
        color: hov ? (danger ? "var(--danger)" : "var(--ink)") : "var(--ink-3)",
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      {children}
    </button>
  );
}

export default TeacherProblems;
