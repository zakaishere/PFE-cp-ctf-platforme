"use client";

import { useState, useEffect } from "react";
import { APP_NAME } from "@/lib/brand";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import {
  Plus, Search, Edit2, Trash2, Eye, EyeOff, Send, Save,
  ChevronDown, ChevronUp, Code2, FileText, X, ExternalLink,
  Lightbulb, CheckCircle2, Clock, ChevronLeft, ChevronRight,
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

  // ── Derived stats ──────────────────────────────────────────────────────────

  const stats = {
    total:       totalElements,
    published:   problems.filter(p => p.status === "published").length,
    draft:       problems.filter(p => p.status === "draft").length,
    unpublished: problems.filter(p => p.status === "unpublished").length,
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <Navbar />
      <div className="psp-breadcrumb">
        <Link href="/teacher">{APP_NAME}</Link> ›{" "}
        <span style={{ color: "var(--text-primary)" }}>Problems</span>
      </div>

      <div className="psp-main">

        {/* ── Page Header ───────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)" }}>Problems</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
              {totalElements} problem{totalElements !== 1 ? "s" : ""} in your library — manage, publish, and assign to assessments
            </div>
          </div>
          <button className="psp-btn psp-btn-secondary" onClick={openCreate}>
            <Code2 size={13} /> New Problem
          </button>
        </div>

        {/* ── Stats ─────────────────────────────────────────────────────── */}
        <div className="psp-stats">
          <div className="psp-stat-card">
            <div className="psp-stat-icon ic-blue"><FileText size={20} /></div>
            <div>
              <div className="psp-stat-val">{stats.total}</div>
              <div className="psp-stat-lbl">Total Problems</div>
            </div>
          </div>
          <div className="psp-stat-card">
            <div className="psp-stat-icon ic-green"><CheckCircle2 size={20} /></div>
            <div>
              <div className="psp-stat-val">{stats.published}</div>
              <div className="psp-stat-lbl">Published</div>
            </div>
          </div>
          <div className="psp-stat-card">
            <div className="psp-stat-icon ic-orange"><Clock size={20} /></div>
            <div>
              <div className="psp-stat-val">{stats.draft}</div>
              <div className="psp-stat-lbl">Drafts</div>
            </div>
          </div>
          <div className="psp-stat-card">
            <div className="psp-stat-icon ic-purple"><EyeOff size={20} /></div>
            <div>
              <div className="psp-stat-val">{stats.unpublished}</div>
              <div className="psp-stat-lbl">Unpublished</div>
            </div>
          </div>
        </div>

        {/* ── Problems Card ─────────────────────────────────────────────── */}
        <div className="psp-card">

          {/* Card header */}
          <div className="psp-card-header">
            <span className="psp-card-title">All Problems</span>
            <div style={{ position: "relative" }}>
              <Search
                size={12}
                style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "var(--text-subtle)", pointerEvents: "none" }}
              />
              <input
                className="psp-search"
                style={{ paddingLeft: 26, width: 220 }}
                placeholder="Search problems…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Filter bar */}
          <div className="psp-filter-bar">
            {(["all", "published", "draft", "unpublished"] as const).map(s => (
              <button
                key={s}
                className={`psp-ftab${statusFilter === s ? " on" : ""}`}
                onClick={() => setStatusFilter(s)}
              >
                {s === "all" ? "All Status" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
            <span style={{ margin: "0 8px", color: "var(--border-strong)", fontSize: 14, userSelect: "none" }}>|</span>
            {(["all", "Easy", "Medium", "Hard"] as const).map(d => (
              <button
                key={d}
                className={`psp-ftab${diffFilter === d ? " on" : ""}`}
                onClick={() => setDiffFilter(d)}
              >
                {d === "all" ? "All Difficulties" : d}
              </button>
            ))}
          </div>

          {/* Loading skeletons */}
          {isLoading && Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div className="skel" style={{ width: "52%", height: 13, borderRadius: 2, marginBottom: 8 }} />
                <div className="skel" style={{ width: "28%", height: 10, borderRadius: 2 }} />
              </div>
              <div className="skel" style={{ width: 56, height: 20, borderRadius: 2 }} />
              <div className="skel" style={{ width: 56, height: 20, borderRadius: 2 }} />
            </div>
          ))}

          {/* Empty state */}
          {!isLoading && filtered.length === 0 && (
            <div className="psp-empty">
              <div className="psp-empty-title">No problems found</div>
              <div style={{ fontSize: 13 }}>
                Try adjusting your filters or{" "}
                <button
                  style={{ color: "var(--brand)", background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: 0, fontSize: 13 }}
                  onClick={openCreate}
                >
                  create a new problem
                </button>
              </div>
            </div>
          )}

          {/* Problem rows */}
          {!isLoading && filtered.map(p => (
            <ProblemRow
              key={p.id}
              p={p}
              onEdit={openEdit}
              onToggle={toggleStatus}
              onDelete={id => setDeleteId(id)}
            />
          ))}

          {/* Pagination footer */}
          {!isLoading && totalPages > 1 && (
            <div style={{ padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid var(--border)" }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                Page {currentPage + 1} of {totalPages} · {totalElements} total
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  className="psp-btn psp-btn-secondary psp-btn-sm"
                  disabled={currentPage === 0}
                  onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                >
                  <ChevronLeft size={12} /> Prev
                </button>
                <button
                  className="psp-btn psp-btn-secondary psp-btn-sm"
                  disabled={currentPage >= totalPages - 1}
                  onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                >
                  Next <ChevronRight size={12} />
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
          <div className="psp-modal" style={{ width: 680, maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
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
                                style={{ minHeight: 56, fontFamily: "monospace", fontSize: 12 }}
                              />
                            </div>
                            <div>
                              <label className="psp-form-label" style={{ fontSize: 11 }}>Expected Output</label>
                              <textarea
                                className="psp-form-textarea"
                                placeholder="e.g. [0,1]"
                                value={tc.expectedOutput}
                                onChange={e => updateTestCase(tc.id, "expectedOutput", e.target.value)}
                                style={{ minHeight: 56, fontFamily: "monospace", fontSize: 12 }}
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

// ─── Problem Row (extracted for clarity) ─────────────────────────────────────

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

  return (
    <div
      style={{
        padding: "12px 16px",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        gap: 14,
        background: hovered ? "var(--bg-secondary)" : "transparent",
        transition: "background 0.1s",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
          <span style={{
            fontSize: 13, fontWeight: 600, color: "var(--text-primary)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 340,
          }}>
            {p.title}
          </span>
          <span className={`psp-badge ${statusBadgeClass(p.status)}`}>{p.status}</span>
          <span className={`psp-badge ${diffBadgeClass(p.difficulty)}`}>{p.difficulty}</span>
        </div>
        <div style={{ display: "flex", gap: 14, fontSize: 11, color: "var(--text-muted)", alignItems: "center", flexWrap: "wrap" }}>
          <span>{p.category}</span>
          <span>{p.testCases.length} test case{p.testCases.length !== 1 ? "s" : ""}</span>
          {p.tags.length > 0 && (
            <span>
              {p.tags.slice(0, 3).join(", ")}{p.tags.length > 3 ? ` +${p.tags.length - 3}` : ""}
            </span>
          )}
          {p.hints.length > 0 && (
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <Lightbulb size={10} />
              {p.hints.length} hint{p.hints.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 2, alignItems: "center", flexShrink: 0 }}>
        <Link href={`/problems/${p.id}`} target="_blank">
          <ActionIcon title="Try problem"><ExternalLink size={13} /></ActionIcon>
        </Link>
        <ActionIcon
          title={p.status === "published" ? "Unpublish" : "Publish"}
          onClick={() => onToggle(p)}
        >
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
        width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
        border: "none", cursor: "pointer", borderRadius: 3, transition: "background 0.1s, color 0.1s",
        background: hov ? (danger ? "var(--red-light)" : "var(--bg-hover)") : "transparent",
        color: hov ? (danger ? "#de350b" : "var(--text-primary)") : "var(--text-muted)",
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      {children}
    </button>
  );
}

export default TeacherProblems;
