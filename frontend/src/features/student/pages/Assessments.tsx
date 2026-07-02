"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Spinner from "@/components/ui/Spinner";
import { FileText, Calendar, Search, BookOpen } from "lucide-react";
import { getAssessments, requestToJoinAssessment } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { EventCard, type EventStatus } from "@/components/ui/EventCard";

type AssessmentStatus = "LIVE" | "UPCOMING" | "OPEN" | "CLOSED" | string;

// ── helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatDeadline(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  const diffMs = d.getTime() - Date.now();
  if (diffMs < 0) return null;
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays > 3) return `Due ${formatDate(iso)}`;
  const h = Math.floor(diffMs / 3_600_000);
  return h > 0 ? `Due in ${h}h` : "Due very soon";
}

function sortWeight(a: any): number {
  const s = a.status as AssessmentStatus;
  if (s === "LIVE")     return 0;
  if (s === "UPCOMING") return 1;
  if (s === "OPEN")     return 2;
  const endTime = a.scheduledEndTime || a.deadline;
  const ts = endTime ? new Date(endTime).getTime() : 0;
  return 3 + (1 - ts / 1e15);
}

function sortAssessments(list: any[]): any[] {
  return [...list].sort((a, b) => {
    const wa = sortWeight(a);
    const wb = sortWeight(b);
    if (wa !== wb) return wa - wb;
    const ta = a.scheduledStartTime ? new Date(a.scheduledStartTime).getTime() : 0;
    const tb = b.scheduledStartTime ? new Date(b.scheduledStartTime).getTime() : 0;
    return tb - ta;
  });
}

function assessmentStatus(status: string): EventStatus {
  switch (status) {
    case "LIVE":     return "live";
    case "OPEN":     return "open";
    case "UPCOMING": return "scheduled";
    case "CLOSED":   return "closed";
    default:         return "closed";
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

type TabKey = "All" | "Live Exams" | "Open TPs" | "Closed";

export default function ExamsTpsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [assessments, setAssessments] = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [activeTab, setActiveTab]     = useState<TabKey>("All");
  const [search, setSearch]           = useState("");

  useEffect(() => {
    getAssessments()
      .then(setAssessments)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const patchAssessment = (id: string, patch: any) =>
    setAssessments(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a));

  const handleAction = async (action: string, id: string, _extra?: string) => {
    const a = assessments.find(x => x.id === id);
    try {
      switch (action) {
        case "request":
          await requestToJoinAssessment(id);
          patchAssessment(id, { myJoinStatus: "PENDING" });
          toast({ title: "Request sent", description: "You'll be notified when approved." });
          break;
        case "register":
        case "enter-code":
          patchAssessment(id, { myJoinStatus: "APPROVED" });
          toast({ title: "Access granted!" });
          break;
        case "enter":
        case "lobby":
          if (a?.type === "OPEN_TP") router.push(`/arena/tp/${id}`);
          else router.push(`/arena/exam/${id}`);
          break;
        case "view-results":
          if (a?.type === "OPEN_TP") router.push(`/arena/tp/${id}`);
          else router.push(`/arena/exam/${id}`);
          break;
      }
    } catch (e: any) {
      if (e.message?.includes("409")) {
        patchAssessment(id, { myJoinStatus: "APPROVED" });
      } else {
        toast({ title: "Action failed", description: e.message, variant: "destructive" });
      }
    }
  };

  /** Primary card action, mirroring JoinActionButton's decision path. */
  const cardAction = (a: any): { label: string; disabled?: boolean; run: () => void } => {
    const st  = a.status as AssessmentStatus;
    const isExam = a.type === "LIVE_EXAM";
    const vis = (a.visibilityMode || (a.strictAccessCode ? "ACCESS_CODE" : "MODULE_ONLY")).toUpperCase();
    const js  = (a.myJoinStatus || "NONE").toUpperCase();
    const enter = () => handleAction("enter", a.id);
    const enterLabel = isExam ? "Enter exam" : "Open";

    if (st === "CLOSED") {
      return (a.problemsCount ?? 0) > 0
        ? { label: "View result", run: () => handleAction("view-results", a.id) }
        : { label: "Closed", disabled: true, run: () => {} };
    }
    if (st === "UPCOMING") {
      return { label: a.scheduledStartTime ? `Starts ${formatDate(a.scheduledStartTime)}` : "Scheduled", disabled: true, run: () => {} };
    }
    if (js === "APPROVED") return { label: enterLabel, run: enter };
    if (js === "PENDING")  return { label: "Request pending", disabled: true, run: () => {} };
    if (js === "REJECTED") return { label: "Request rejected", disabled: true, run: () => {} };
    if (vis === "REQUEST_BASED") return { label: "Request to join", run: () => handleAction("request", a.id) };
    if (vis === "ACCESS_CODE")   return { label: "Enter code", run: enter };
    return { label: enterLabel, run: enter }; // MODULE_ONLY / PUBLIC_OPEN / default
  };

  // ── derived counts ──────────────────────────────────────────────────────────
  const closed   = assessments.filter(a => a.status === "CLOSED");
  const exams    = assessments.filter(a => a.type === "LIVE_EXAM");
  const tps      = assessments.filter(a => a.type === "OPEN_TP");

  // ── filter by tab then search, then sort ────────────────────────────────────
  const byTab =
    activeTab === "Live Exams" ? exams  :
    activeTab === "Open TPs"   ? tps    :
    activeTab === "Closed"     ? closed :
    assessments;

  const q = search.trim().toLowerCase();
  const sorted = sortAssessments(byTab.filter(a => !q || (a.title || "").toLowerCase().includes(q)));

  const TABS: Array<{ key: TabKey; label: string; count: number }> = [
    { key: "All",        label: "All",        count: assessments.length },
    { key: "Live Exams", label: "Live Exams", count: exams.length },
    { key: "Open TPs",   label: "Open TPs",   count: tps.length },
    { key: "Closed",     label: "Closed",     count: closed.length },
  ];

  // ── meta line builders ────────────────────────────────────────────────────────

  const buildMeta1 = (a: any): string => {
    const isExam = a.type === "LIVE_EXAM";
    const unit = isExam ? "problems" : "tasks";
    return [
      a.moduleName,
      (a.problemsCount ?? 0) > 0 ? `${a.problemsCount} ${unit}` : "",
    ].filter(Boolean).join(" · ") || (isExam ? "Live Exam" : "TP");
  };

  const buildMeta2 = (a: any): string | undefined => {
    const isExam = a.type === "LIVE_EXAM";
    if (isExam) {
      return [
        a.durationMinutes ? `${a.durationMinutes} min` : "",
        a.scheduledStartTime ? formatDate(a.scheduledStartTime) : "",
      ].filter(Boolean).join(" · ") || undefined;
    }
    // TP
    const deadline = a.status === "OPEN" ? formatDeadline(a.deadline) : (a.deadline ? `Due ${formatDate(a.deadline)}` : "");
    const attempts = a.maxAttempts ? `${a.attemptsUsed ?? 0}/${a.maxAttempts} attempts` : "";
    return [deadline, attempts].filter(Boolean).join(" · ") || undefined;
  };

  return (
    <>
      <Navbar />

      <div className="psp-main">
        {/* Page header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <BookOpen size={18} color="var(--brand)" />
              <span style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)" }}>Exams &amp; TPs</span>
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-2)" }}>Your module assignments and exams</div>
          </div>
        </div>

        {/* Filter bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 20, flexWrap: "wrap" }}>
          {TABS.map(t => (
            <button
              key={t.key}
              className={`psp-ftab${activeTab === t.key ? " on" : ""}`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label} <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>({t.count})</span>
            </button>
          ))}
          <div style={{ marginLeft: "auto", position: "relative", display: "flex", alignItems: "center" }}>
            <Search size={13} color="var(--ink-3)" style={{ position: "absolute", left: 8, pointerEvents: "none" }} />
            <input
              className="psp-search"
              placeholder="Search…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 28 }}
            />
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
            <Spinner size={28} />
          </div>
        ) : sorted.length === 0 ? (
          <div className="psp-empty" style={{
            background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r)",
          }}>
            <BookOpen size={28} color="var(--ink-3)" style={{ margin: "0 auto 12px" }} />
            <div className="psp-empty-title">{q ? "No matching assessments" : "No exams or TPs assigned yet"}</div>
            <div>{q ? "No results for that search. Try a different title." : "Your teacher will share an access code when one is ready."}</div>
          </div>
        ) : (
          <div
            style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}
            className="card-grid stagger"
          >
            {sorted.map(a => {
              const act = cardAction(a);
              return (
                <EventCard
                  key={a.id}
                  type={a.type === "LIVE_EXAM" ? "exam" : "tp"}
                  title={a.title}
                  status={assessmentStatus(a.status)}
                  meta1={buildMeta1(a)}
                  meta2={buildMeta2(a)}
                  meta1Icon={FileText}
                  meta2Icon={Calendar}
                  action={act.label}
                  actionDisabled={act.disabled}
                  onClick={act.disabled ? undefined : act.run}
                />
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
