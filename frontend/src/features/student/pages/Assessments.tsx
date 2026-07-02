"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Spinner from "@/components/ui/Spinner";
import TimeProgress from "@/components/ui/TimeProgress";
import { JoinActionButton } from "@/components/ui/JoinActionButton";
import {
  Calendar, Timer, FileText, FlaskConical, Globe, RefreshCw,
  Search, BookOpen, Lock, Clock,
} from "lucide-react";
import { getAssessments, requestToJoinAssessment } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

type AssessmentStatus = "LIVE" | "UPCOMING" | "OPEN" | "CLOSED" | string;
type AssessmentType   = "LIVE_EXAM" | "OPEN_TP" | string;

// ── helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
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

// ── countdown pill ─────────────────────────────────────────────────────────────

function ComingInBadge({ targetDate }: { targetDate: string }) {
  const [label, setLabel] = useState<string>("");
  const compute = useCallback(() => {
    const diff = new Date(targetDate).getTime() - Date.now();
    if (diff <= 0) { setLabel("Starting…"); return; }
    const d = Math.floor(diff / 86_400_000);
    const h = Math.floor((diff % 86_400_000) / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    const s = Math.floor((diff % 60_000) / 1_000);
    if (d > 0) setLabel(`In ${d}d ${h}h`);
    else if (h > 0) setLabel(`In ${h}h ${m}m`);
    else setLabel(`In ${m}m ${s}s`);
  }, [targetDate]);
  useEffect(() => { compute(); const id = setInterval(compute, 1000); return () => clearInterval(id); }, [compute]);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: "var(--accent-soft)", color: "var(--brand)",
      fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 20,
    }}>
      <Clock size={10} />{label || "Coming Soon"}
    </span>
  );
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

  // ── derived counts ──────────────────────────────────────────────────────────
  const liveNow  = assessments.filter(a => a.status === "LIVE");
  const openTps  = assessments.filter(a => a.type === "OPEN_TP" && a.status === "OPEN");
  const upcoming = assessments.filter(a => a.status === "UPCOMING");
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

  // ── row rendering helpers ────────────────────────────────────────────────────

  const typeBadge = (a: any) => {
    if (a.type === "LIVE_EXAM") return (
      <span className="psp-badge" style={{ background: "var(--warn-soft)", color: "var(--warn-ink)" }}>Exam</span>
    );
    return (
      <span className="psp-badge" style={{ background: "var(--violet-soft)", color: "var(--violet)" }}>TP</span>
    );
  };

  const statusBadge = (a: any) => {
    const s = a.status as AssessmentStatus;
    if (s === "LIVE")     return <span className="psp-badge b-live">Live</span>;
    if (s === "OPEN")     return <span className="psp-badge b-tp">Open</span>;
    if (s === "UPCOMING") return <span className="psp-badge b-pending">Upcoming</span>;
    if (s === "CLOSED")   return <span className="psp-badge b-priv">Closed</span>;
    return null;
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

        {/* Stats row */}
        {!loading && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
            {[
              { val: assessments.length, lbl: "Total",    col: "var(--ink)" },
              { val: liveNow.length,     lbl: "Live Now", col: liveNow.length > 0 ? "var(--danger-ink)" : "var(--ink-3)" },
              { val: openTps.length,     lbl: "Open TPs", col: openTps.length > 0 ? "var(--success-ink)" : "var(--ink-3)" },
              { val: upcoming.length,    lbl: "Upcoming", col: upcoming.length > 0 ? "var(--brand)" : "var(--ink-3)" },
            ].map(({ val, lbl, col }) => (
              <div key={lbl} style={{
                background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r)",
                padding: "14px 16px",
              }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: col, letterSpacing: "-1px", lineHeight: 1, marginBottom: 3 }}>{val}</div>
                <div style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 500 }}>{lbl}</div>
              </div>
            ))}
          </div>
        )}

        {/* Filter bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 12, flexWrap: "wrap" }}>
          {TABS.map(t => (
            <button
              key={t.key}
              className={`psp-ftab${activeTab === t.key ? " on" : ""}`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label} ({t.count})
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

        {/* List */}
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
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r)", overflow: "hidden" }}>
            {sorted.map((a, i) => {
              const isExam    = a.type === "LIVE_EXAM";
              const isLive    = a.status === "LIVE";
              const isOpen    = a.status === "OPEN";
              const isUpcoming = a.status === "UPCOMING";
              const isClosed  = a.status === "CLOSED";
              const deadline  = formatDeadline(a.deadline);

              return (
                <div
                  key={a.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 14, padding: "14px 18px",
                    borderBottom: i < sorted.length - 1 ? "1px solid var(--line)" : "none",
                    opacity: isClosed ? 0.6 : 1,
                    transition: "background 0.1s",
                  }}
                  onMouseOver={e => { if (!isClosed) e.currentTarget.style.background = "var(--surface-2)"; }}
                  onMouseOut={e => (e.currentTarget.style.background = "")}
                >
                  {/* Icon tile */}
                  <div style={{
                    width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: isClosed
                      ? "var(--bg-2)"
                      : isExam ? "var(--warn-soft)" : "var(--violet-soft)",
                  }}>
                    {isExam
                      ? <FileText size={18} color={isClosed ? "var(--ink-3)" : "var(--warn)"} />
                      : <FlaskConical size={18} color={isClosed ? "var(--ink-3)" : "var(--violet)"} />
                    }
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4, flexWrap: "wrap" }}>
                      {isLive && (
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          background: "linear-gradient(135deg,#de350b,#ff5630)",
                          color: "#fff", fontSize: 11, fontWeight: 800,
                          padding: "2px 9px", borderRadius: 20, letterSpacing: "0.04em",
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff", animation: "blink 1s infinite" }} />
                          Happening Now
                        </span>
                      )}
                      {isUpcoming && a.scheduledStartTime && <ComingInBadge targetDate={a.scheduledStartTime} />}
                      <span style={{
                        fontWeight: 600, color: isClosed ? "var(--ink-3)" : "var(--ink)",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {a.title}
                      </span>
                      {statusBadge(a)}
                      {typeBadge(a)}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--ink-2)", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                      {a.moduleName && <span>{a.moduleName}</span>}
                      {isExam && a.scheduledStartTime && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <Calendar size={10} /> {formatDate(a.scheduledStartTime)}
                        </span>
                      )}
                      {a.durationMinutes && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <Timer size={10} /> {a.durationMinutes} min
                        </span>
                      )}
                      {!isExam && a.deadline && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <Calendar size={10} /> Deadline: {formatDate(a.deadline)}
                        </span>
                      )}
                      {a.maxAttempts && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <RefreshCw size={10} /> Max {a.maxAttempts} attempts
                        </span>
                      )}
                      {(a.problemsCount ?? 0) > 0 && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <FileText size={10} /> {a.problemsCount} problems
                        </span>
                      )}
                      {a.visibilityMode === "REQUEST_BASED" && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <Lock size={10} /> Request Based
                        </span>
                      )}
                      {(a.visibilityMode === "ACCESS_CODE" || a.strictAccessCode) && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <Lock size={10} /> Access Code
                        </span>
                      )}
                      {!isExam && isOpen && deadline && (
                        <span style={{ background: "var(--warn-soft)", color: "var(--warn-ink)", fontSize: 11, padding: "1px 7px", borderRadius: 4, fontWeight: 600 }}>
                          {deadline}
                        </span>
                      )}
                    </div>
                    {/* Attempts progress for open TPs */}
                    {!isExam && a.maxAttempts && (isOpen || isClosed) && (
                      <div style={{ marginTop: 6, maxWidth: 260 }}>
                        <TimeProgress
                          used={a.attemptsUsed ?? 0}
                          total={a.maxAttempts}
                          label="Attempts used"
                          color={isOpen ? "var(--brand)" : "var(--ink-3)"}
                        />
                      </div>
                    )}
                  </div>

                  {/* Action */}
                  <div style={{ flexShrink: 0 }}>
                    {isClosed ? (
                      (a.problemsCount ?? 0) > 0 ? (
                        <Link
                          href={isExam ? `/arena/exam/${a.id}` : `/arena/tp/${a.id}`}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 5,
                            fontSize: 12, color: "var(--ink-2)", textDecoration: "none",
                            padding: "5px 12px", border: "1px solid var(--line)", borderRadius: 6,
                            fontWeight: 500, transition: "all 0.1s",
                          }}
                        >
                          <FileText size={12} /> View
                        </Link>
                      ) : (
                        <span style={{ fontSize: 12, color: "var(--ink-3)", fontStyle: "italic" }}>Closed</span>
                      )
                    ) : (
                      <JoinActionButton
                        id={a.id}
                        type={isExam ? "EXAM" : "TP"}
                        visibility={a.visibilityMode || (a.strictAccessCode ? "ACCESS_CODE" : "MODULE_ONLY")}
                        itemStatus={a.status}
                        myJoinStatus={a.myJoinStatus || "NONE"}
                        onAction={handleAction}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes blink {
          0%,100% { opacity: 1; }
          50%      { opacity: 0.25; }
        }
      `}</style>
    </>
  );
}
