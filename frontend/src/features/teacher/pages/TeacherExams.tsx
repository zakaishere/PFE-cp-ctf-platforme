"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Copy, Check, Calendar, Clock, Lock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  createLiveExam, createOpenTP, addProblemToAssessment,
  CreateAssessmentRequest, getAssessments, getExamSubmissions, closeLiveExam,
  getMyModules, getProblemsPicker, ModuleOption, ProblemPickerItem,
} from "@/lib/api";

interface StudentResult {
  name: string;
  status: "Completed" | "In Progress" | "Not Started";
  grade: string;
}

interface Assessment {
  id: string;
  title: string;
  type: "Exam" | "TP";
  date: string;
  duration: string;
  status: "Active" | "Scheduled" | "Completed";
  accessCode: string;
  students: StudentResult[];
}

const mockAssessments: Assessment[] = [
  {
    id: "exam-1",
    title: "Algorithms Final Exam",
    type: "Exam",
    date: "2026-04-18",
    duration: "2h",
    status: "Scheduled",
    accessCode: "ALG-2026-FINAL",
    students: [
      { name: "Amine Bouzid", status: "Not Started", grade: "—" },
      { name: "Sara Khelifi", status: "Not Started", grade: "—" },
      { name: "Youcef Mebarki", status: "Not Started", grade: "—" },
    ],
  },
  {
    id: "exam-2",
    title: "Data Structures Midterm",
    type: "Exam",
    date: "2026-03-15",
    duration: "1h30",
    status: "Completed",
    accessCode: "DS-MID-2026",
    students: [
      { name: "Amine Bouzid", status: "Completed", grade: "85/100" },
      { name: "Sara Khelifi", status: "Completed", grade: "92/100" },
      { name: "Youcef Mebarki", status: "Completed", grade: "78/100" },
      { name: "Fatima Zahra", status: "Completed", grade: "88/100" },
    ],
  },
  {
    id: "tp-1",
    title: "TP 3 — Sorting & Searching",
    type: "TP",
    date: "2026-04-20",
    duration: "Open",
    status: "Active",
    accessCode: "TP3-SORT-26",
    students: [
      { name: "Amine Bouzid", status: "Completed", grade: "3/3" },
      { name: "Sara Khelifi", status: "In Progress", grade: "2/3" },
      { name: "Youcef Mebarki", status: "Not Started", grade: "0/3" },
    ],
  },
  {
    id: "tp-2",
    title: "TP 4 — Graph Algorithms",
    type: "TP",
    date: "2026-04-28",
    duration: "Open",
    status: "Scheduled",
    accessCode: "TP4-GRAPH-26",
    students: [],
  },
];

const statusColor: Record<string, string> = {
  Active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  Scheduled: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  Completed: "bg-muted text-muted-foreground border-border",
};

const TeacherExams = () => {
  const [assessments, setAssessments] = useState<Assessment[]>(mockAssessments);
  const [selected, setSelected] = useState<Assessment>(mockAssessments[0]);
  const [selectedSubmissions, setSelectedSubmissions] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const [createForm, setCreateForm] = useState({
    title: "",
    description: "",
    type: "exam",
    moduleId: "",
    visibilityMode: "MODULE_ONLY",
    problemIds: [] as string[],
    date: "",
    duration: "120",
    accessCode: "",
    deadline: "",
    maxAttempts: 3,
    isPenaltyEnabled: true,
  });

  const [editingAssessmentId, setEditingAssessmentId] = useState<string | null>(null);
  const [problemsPool, setProblemsPool] = useState<any[]>([]);

  // Create form extras
  const [modules, setModules] = useState<ModuleOption[]>([]);
  const [pickerProblems, setPickerProblems] = useState<ProblemPickerItem[]>([]);
  const [loadingForm, setLoadingForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const { toast } = useToast();

  const loadProblems = async () => {
    try {
      const data = await getProblemsPicker();
      setProblemsPool(data);
    } catch (e) {
      toast({ title: "Failed to load problems pool", variant: "destructive" });
    }
  };

  useEffect(() => {
    getAssessments().then((data) => {
      const formatted = data.map((d: any) => ({
        id: d.id,
        title: d.title,
        type: (d.type === "LIVE_EXAM" ? "Exam" : "TP") as "Exam" | "TP",
        date: new Date(d.scheduledStartTime || d.deadline || new Date()).toLocaleDateString(),
        duration: d.durationMinutes ? `${d.durationMinutes}m` : "Open",
        status: "Active" as "Completed" | "Active" | "Scheduled", // simplified
        accessCode: d.strictAccessCode || "",
        students: []
      }));
      if (formatted.length > 0) {
        setAssessments(formatted);
        setSelected(formatted[0]);
      }
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (selected && selected.id && selected.id.includes("-")) {
      getExamSubmissions(selected.id)
        .then((res: any) => setSelectedSubmissions(res.content || res || []))
        .catch(console.error);
    } else {
      setSelectedSubmissions(selected?.students || []);
    }
  }, [selected?.id]);

  const resetForm = () => {
    setCreateForm({
      title: "",
      description: "",
      type: "exam",
      moduleId: "",
      visibilityMode: "MODULE_ONLY",
      problemIds: [],
      date: "",
      duration: "120",
      accessCode: "",
      deadline: "",
      maxAttempts: 3,
      isPenaltyEnabled: true,
    });
    setFieldErrors({});
  };

  const openCreateDialog = async () => {
    resetForm();
    setCreateOpen(true);
    if (modules.length === 0 || pickerProblems.length === 0) {
      setLoadingForm(true);
      try {
        const [mods, probs] = await Promise.all([getMyModules(), getProblemsPicker()]);
        setModules(mods);
        setPickerProblems(probs);
      } catch (e: any) {
        toast({ title: "Failed to load form data", description: e.message, variant: "destructive" });
      } finally {
        setLoadingForm(false);
      }
    }
  };

  const toggleProblem = (id: string) => {
    setCreateForm(f => ({
      ...f,
      problemIds: f.problemIds.includes(id)
        ? f.problemIds.filter(p => p !== id)
        : [...f.problemIds, id],
    }));
  };

  const clientValidate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!createForm.title.trim()) errors.title = "Title is required.";
    if (createForm.visibilityMode === "MODULE_ONLY" && !createForm.moduleId)
      errors.moduleId = "Module is required for Module-Only visibility.";
    if (createForm.visibilityMode === "ACCESS_CODE" && !createForm.accessCode.trim())
      errors.accessCode = "Access code is required.";
    if (createForm.type === "exam") {
      if (!createForm.date) errors.date = "Start date/time is required.";
      else if (new Date(createForm.date) <= new Date()) errors.date = "Start time must be in the future.";
      const dur = parseInt(createForm.duration);
      if (!dur || dur < 1 || dur > 600) errors.duration = "Duration must be between 1 and 600 minutes.";
    } else {
      if (!createForm.deadline) errors.deadline = "Deadline is required.";
      else if (new Date(createForm.deadline) <= new Date()) errors.deadline = "Deadline must be in the future.";
      if (!createForm.maxAttempts || createForm.maxAttempts < 1 || createForm.maxAttempts > 100)
        errors.maxAttempts = "Max attempts must be between 1 and 100.";
    }
    if (createForm.problemIds.length === 0) errors.problemIds = "Select at least one problem.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreate = async () => {
    if (!clientValidate()) return;
    setSubmitting(true);
    try {
      const data: CreateAssessmentRequest = {
        title: createForm.title,
        description: createForm.description || "No description",
        moduleId: createForm.moduleId || "",
        visibilityMode: createForm.visibilityMode,
        isPenaltyEnabled: createForm.type === "exam" ? createForm.isPenaltyEnabled : undefined,
      };

      let res;
      if (createForm.type === "exam") {
        data.scheduledStartTime = new Date(createForm.date).toISOString();
        data.durationMinutes = parseInt(createForm.duration);
        if (createForm.visibilityMode === "ACCESS_CODE") data.strictAccessCode = createForm.accessCode;
        res = await createLiveExam(data);
      } else {
        data.deadline = new Date(createForm.deadline).toISOString();
        data.maxAttempts = createForm.maxAttempts;
        res = await createOpenTP(data);
      }

      // Attach selected problems sequentially
      for (const pid of createForm.problemIds) {
        await addProblemToAssessment(res.assessmentId, pid);
      }

      toast({ title: "Assessment created successfully!" });
      setCreateOpen(false);
      resetForm();

      // Refresh assessments list
      const updated = await getAssessments();
      const formatted = updated.map((d: any) => ({
        id: d.id,
        title: d.title,
        type: (d.type === "LIVE_EXAM" ? "Exam" : "TP") as "Exam" | "TP",
        date: new Date(d.scheduledStartTime || d.deadline || new Date()).toLocaleDateString(),
        duration: d.durationMinutes ? `${d.durationMinutes}m` : "Open",
        status: "Active" as "Completed" | "Active" | "Scheduled",
        accessCode: d.strictAccessCode || "",
        students: [],
      }));
      if (formatted.length > 0) {
        setAssessments(formatted);
        setSelected(formatted[formatted.length - 1]);
      }
    } catch (err: any) {
      toast({ title: "Failed to create assessment", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddProblem = async (problemId: string) => {
    if (!editingAssessmentId) return;
    try {
      await addProblemToAssessment(editingAssessmentId, problemId);
      toast({ title: "Problem attached!" });
    } catch (err: any) {
      toast({ title: "Failed to attach problem", description: err.message, variant: "destructive" });
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(selected.accessCode);
    setCopied(true);
    toast({ title: "Access code copied!" });
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="relative">
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 min-h-[70vh]">
        {/* Left: Assessment list */}
        <div className="space-y-2 overflow-y-auto max-h-[75vh] pr-1">
          {assessments.map((a) => (
            <motion.div
              key={a.id}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelected(a)}
              className={`cursor-pointer rounded-xl border p-4 transition-all ${
                selected.id === a.id
                  ? "border-primary/50 bg-primary/5"
                  : "border-border/40 bg-card/40 hover:border-border"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-sm text-foreground truncate pr-2">
                  {a.title}
                </h3>
                <Badge
                  variant="outline"
                  className={`text-[10px] shrink-0 ${statusColor[a.status]}`}
                >
                  {a.status}
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <Badge variant="secondary" className="text-[10px]">
                  {a.type}
                </Badge>
                <span>{a.date}</span>
                <span>{a.duration}</span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Right: Detail panel or Editor panel */}
        <AnimatePresence mode="wait">
          {editingAssessmentId ? (
            <motion.div
              key="editor"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.15 }}
            >
              <Card className="bg-card/60 backdrop-blur-lg border-border/40">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">Editing Assessment</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">Assign problems to Assessment <code className="bg-muted px-1 py-0.5 rounded text-xs">{editingAssessmentId?.substring(0, 8)}</code></p>
                    </div>
                    <Button variant="outline" onClick={() => setEditingAssessmentId(null)}>Done Editing</Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <h3 className="font-medium text-sm text-foreground">Available Problem Bank</h3>
                  {problemsPool.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3">
                      {problemsPool.map((p) => (
                        <div key={p.problemId} className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-card/40">
                          <div>
                            <p className="font-medium text-sm">{p.title}</p>
                            <div className="flex gap-2">
                              <Badge variant="outline" className="text-[10px]">{p.difficulty || "EASY"}</Badge>
                              {p.isPublic && <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400">Public</Badge>}
                            </div>
                          </div>
                          <Button size="sm" onClick={() => handleAddProblem(p.problemId)}>Add to Assessment</Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-8 text-center italic">No problems found in bank.</p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.15 }}
            >
            <Card className="bg-card/60 backdrop-blur-lg border-border/40">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{selected.title}</CardTitle>
                  <div className="flex items-center gap-3">
                    {selected.type === "Exam" && (
                      <Button variant="outline" size="sm" onClick={() => {
                        closeLiveExam(selected.id).then(() => toast({ title: "Exam officially closed and calculating /20 grades." })).catch(e => toast({ title: "Failed to close", variant: "destructive" }));
                      }} className="h-7 text-xs border-amber-500/30 text-amber-500 hover:bg-amber-500/10">End Exam</Button>
                    )}
                    <Badge
                      variant="outline"
                      className={statusColor[selected.status] || "bg-muted text-muted-foreground"}
                    >
                      {selected.status}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Meta */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span>{selected.date}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4 text-primary" />
                    <span>{selected.duration}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-primary" />
                    <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono text-foreground">
                      {selected.accessCode}
                    </code>
                    <button
                      onClick={copyCode}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {copied ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Student table */}
                {selectedSubmissions.length > 0 ? (
                  <div className="rounded-lg border border-border/40 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border/40">
                          <TableHead>Student</TableHead>
                          <TableHead>Execution Status</TableHead>
                          <TableHead className="text-right">Codeforces Points</TableHead>
                          <TableHead className="text-right">Penalty</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedSubmissions.map((s, i) => (
                          <TableRow key={i} className="border-border/40">
                            <TableCell className="font-medium text-foreground text-xs font-mono">
                              {s.name || s.studentId?.substring(0, 8) || "Unknown"}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${
                                  s.status === "PASS" || s.status === "Completed"
                                    ? "text-emerald-400 border-emerald-500/30"
                                    : "text-rose-400 border-rose-500/30"
                                }`}
                              >
                                {s.status || "FAIL"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm text-foreground">
                              {s.grade || s.pointsAwarded || 0}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm text-destructive">
                              {s.teacherPenaltyOverride || 0}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No students enrolled yet.
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* FAB */}
      <motion.div
        className="fixed bottom-6 right-6 z-40"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Button
          onClick={openCreateDialog}
          className="h-14 w-14 rounded-2xl shadow-lg shadow-primary/25"
          size="icon"
        >
          <Plus className="h-6 w-6" />
        </Button>
      </motion.div>

      {/* Create Assessment Modal */}
      <Dialog open={createOpen} onOpenChange={open => { setCreateOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-lg bg-card border-border/60">
          <DialogHeader>
            <DialogTitle>Create New Assessment</DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto pr-1">
          {loadingForm ? (
            <div className="py-12 flex items-center justify-center text-muted-foreground text-sm">Loading form data…</div>
          ) : (
          <div className="space-y-4 py-2">
            {/* Title */}
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Title</label>
              <Input
                placeholder="e.g. Algorithms Midterm"
                value={createForm.title}
                onChange={e => { setCreateForm(f => ({ ...f, title: e.target.value })); setFieldErrors(fe => ({ ...fe, title: "" })); }}
              />
              {fieldErrors.title && <p className="text-xs text-destructive mt-1">{fieldErrors.title}</p>}
            </div>

            {/* Type */}
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Type</label>
              <Select value={createForm.type} onValueChange={v => setCreateForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="exam">Exam</SelectItem>
                  <SelectItem value="tp">Open TP</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Visibility Mode */}
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Visibility</label>
              <Select value={createForm.visibilityMode} onValueChange={v => setCreateForm(f => ({ ...f, visibilityMode: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MODULE_ONLY">Module only (enrolled students)</SelectItem>
                  <SelectItem value="ACCESS_CODE">Access code</SelectItem>
                  <SelectItem value="REQUEST_BASED">Request-based (approve individually)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Module (only when MODULE_ONLY) */}
            {createForm.visibilityMode === "MODULE_ONLY" && (
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Module</label>
                <Select value={createForm.moduleId} onValueChange={v => { setCreateForm(f => ({ ...f, moduleId: v })); setFieldErrors(fe => ({ ...fe, moduleId: "" })); }}>
                  <SelectTrigger><SelectValue placeholder="Select a module" /></SelectTrigger>
                  <SelectContent>
                    {modules.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldErrors.moduleId && <p className="text-xs text-destructive mt-1">{fieldErrors.moduleId}</p>}
              </div>
            )}

            {/* Type-specific fields */}
            {createForm.type === "exam" ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">Date & Time</label>
                    <Input type="datetime-local" value={createForm.date} onChange={e => { setCreateForm(f => ({ ...f, date: e.target.value })); setFieldErrors(fe => ({ ...fe, date: "" })); }} />
                    {fieldErrors.date && <p className="text-xs text-destructive mt-1">{fieldErrors.date}</p>}
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">Duration (mins)</label>
                    <Input placeholder="120" type="number" value={createForm.duration} onChange={e => { setCreateForm(f => ({ ...f, duration: e.target.value })); setFieldErrors(fe => ({ ...fe, duration: "" })); }} />
                    {fieldErrors.duration && <p className="text-xs text-destructive mt-1">{fieldErrors.duration}</p>}
                  </div>
                </div>
                {createForm.visibilityMode === "ACCESS_CODE" && (
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">Access Code</label>
                    <Input placeholder="e.g. ALG-2026-MID" className="font-mono" value={createForm.accessCode} onChange={e => { setCreateForm(f => ({ ...f, accessCode: e.target.value })); setFieldErrors(fe => ({ ...fe, accessCode: "" })); }} />
                    {fieldErrors.accessCode && <p className="text-xs text-destructive mt-1">{fieldErrors.accessCode}</p>}
                  </div>
                )}
              </>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Deadline</label>
                  <Input type="datetime-local" value={createForm.deadline} onChange={e => { setCreateForm(f => ({ ...f, deadline: e.target.value })); setFieldErrors(fe => ({ ...fe, deadline: "" })); }} />
                  {fieldErrors.deadline && <p className="text-xs text-destructive mt-1">{fieldErrors.deadline}</p>}
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Max Attempts</label>
                  <Input placeholder="3" type="number" value={createForm.maxAttempts?.toString() || ""} onChange={e => { setCreateForm(f => ({ ...f, maxAttempts: parseInt(e.target.value) || 1 })); setFieldErrors(fe => ({ ...fe, maxAttempts: "" })); }} />
                  {fieldErrors.maxAttempts && <p className="text-xs text-destructive mt-1">{fieldErrors.maxAttempts}</p>}
                </div>
              </div>
            )}

            {/* Problem Picker */}
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Problems</label>
              {fieldErrors.problemIds && <p className="text-xs text-destructive mb-1">{fieldErrors.problemIds}</p>}
              {pickerProblems.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No problems available.</p>
              ) : (
                <div className="max-h-48 overflow-y-auto border border-border/40 rounded-lg divide-y divide-border/30">
                  {pickerProblems.map(p => (
                    <label key={p.problemId} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/30 transition-colors">
                      <input
                        type="checkbox"
                        checked={createForm.problemIds.includes(p.problemId)}
                        onChange={() => { toggleProblem(p.problemId); setFieldErrors(fe => ({ ...fe, problemIds: "" })); }}
                        className="accent-primary"
                      />
                      <span className="text-sm text-foreground flex-1 truncate">{p.title}</span>
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${p.difficulty === "EASY" ? "border-emerald-500/30 text-emerald-400" : p.difficulty === "MEDIUM" ? "border-amber-500/30 text-amber-400" : "border-rose-500/30 text-rose-400"}`}>{p.difficulty}</Badge>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
          )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setCreateOpen(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleCreate} disabled={submitting || loadingForm}>
              {submitting ? "Creating…" : "Create Assessment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeacherExams;
