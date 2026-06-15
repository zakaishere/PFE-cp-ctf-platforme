"use client";

import { useState, useEffect, useCallback } from "react";
import { APP_NAME } from "@/lib/brand";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Spinner from "@/components/ui/Spinner";
import TimeProgress from "@/components/ui/TimeProgress";
import MiniCountdown from "@/components/ui/MiniCountdown";
import { JoinActionButton } from "@/components/ui/JoinActionButton";
import {
  Calendar, Timer, FileText, Globe, RefreshCw,
  Search, BookOpen, Lock, Zap, Clock, ChevronRight,
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

/** Returns a numeric sort weight — lower = higher in list */
function sortWeight(a: any): number {
  const s = a.status as AssessmentStatus;
  const t = a.type   as AssessmentType;

  if (s === "LIVE")     return 0;   // happening now → absolute top
  if (s === "UPCOMING") return 1;   // coming soon
  if (s === "OPEN")     return 2;   // open TPs
  // closed: sort by most-recently-ended so newest closed is first in that section
  const endTime = a.scheduledEndTime || a.deadline;
  const ts = endTime ? new Date(endTime).getTime() : 0;
  return 3 + (1 - ts / 1e15);      // ~3.x, newest closed first
}

/** Full sorted list — closed always at the bottom */
function sortAssessments(list: any[]): any[] {
  return [...list].sort((a, b) => {
    const wa = sortWeight(a);
    const wb = sortWeight(b);
    if (wa !== wb) return wa - wb;
    // Within same group: newest scheduled start first
    const ta = a.scheduledStartTime ? new Date(a.scheduledStartTime).getTime() : 0;
    const tb = b.scheduledStartTime ? new Date(b.scheduledStartTime).getTime() : 0;
    return tb - ta;
  });
}

// ── tiny sub-components ──────────────────────────────────────────────────────

function MetaChip({ icon, text, muted = false }: { icon: React.ReactNode; text: string; muted?: boolean }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 12, color: muted ? "#adb5c7" : "#5e6c84", fontWeight: muted ? 400 : 500,
    }}>
      {icon}
      {text}
    </span>
  );
}

/** "HAPPENING NOW" pulsing banner — used inside the card header */
function HappeningNowBadge() {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: "linear-gradient(135deg,#de350b,#ff5630)",
      color: "#fff", fontSize: 11, fontWeight: 800,
      padding: "2px 9px", borderRadius: 20,
      letterSpacing: "0.04em", textTransform: "uppercase",
      boxShadow: "0 0 0 0 rgba(222,53,11,0.4)",
      animation: "livePulse 2s infinite",
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: "50%", background: "#fff",
        animation: "blink 1s infinite", flexShrink: 0,
      }} />
      Happening Now
    </span>
  );
}

/** "COMING IN …" countdown pill */
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

  useEffect(() => {
    compute();
    const id = setInterval(compute, 1000);
    return () => clearInterval(id);
  }, [compute]);

  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: "linear-gradient(135deg,#0052cc,#2684ff)",
      color: "#fff", fontSize: 11, fontWeight: 800,
      padding: "2px 9px", borderRadius: 20,
      letterSpacing: "0.04em",
    }}>
      <Clock size={10} />
      {label || "Coming Soon"}
    </span>
  );
}

function TypeBadge({ type }: { type: AssessmentType }) {
  if (type === "LIVE_EXAM") return <span className="badge badge-red">Live Exam</span>;
  if (type === "OPEN_TP")   return <span className="badge badge-green">Open TP</span>;
  return <span className="badge badge-gray">{type}</span>;
}

function StatusBadge({ type, status }: { type: AssessmentType; status: AssessmentStatus }) {
  if (type === "LIVE_EXAM") {
    if (status === "LIVE")     return <span className="badge badge-live">Live</span>;
    if (status === "UPCOMING") return <span className="badge badge-blue">Upcoming</span>;
    return <span className="badge badge-gray">Closed</span>;
  }
  if (type === "OPEN_TP") {
    if (status === "OPEN")   return <span className="badge badge-green">Open</span>;
    return <span className="badge badge-gray">Closed</span>;
  }
  return null;
}

function StatCard({ value, label, color = "default" }: {
  value: number; label: string; color?: "default" | "red" | "green" | "blue";
}) {
  const colors: Record<string, string> = {
    default: "#172b4d",
    red:     value > 0 ? "#de350b" : "#97a0af",
    green:   value > 0 ? "#00875a" : "#97a0af",
    blue:    value > 0 ? "var(--brand)" : "#97a0af",
  };
  return (
    <div className="stat-card" style={{ flex: 1, minWidth: 0, cursor: "default" }}>
      <div style={{
        fontSize: 28, fontWeight: 800, color: colors[color],
        letterSpacing: "-1px", lineHeight: 1, marginBottom: 4,
      }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>{label}</div>
    </div>
  );
}

function FilterTabs<T extends string>({ tabs, active, onChange }: {
  tabs: Array<{ key: T; label: string; count: number }>;
  active: T;
  onChange: (key: T) => void;
}) {
  return (
    <div style={{ display: "flex", borderBottom: "2px solid var(--border-subtle)", marginBottom: 20 }}>
      {tabs.map(tab => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          style={{
            height: 40, padding: "0 16px", borderRadius: 0, border: "none", cursor: "pointer",
            borderBottom: active === tab.key ? "2px solid #0052cc" : "2px solid transparent",
            marginBottom: -2,
            color: active === tab.key ? "var(--brand)" : "#5e6c84",
            fontWeight: active === tab.key ? 700 : 500,
            fontSize: 13, background: "none",
            transition: "all 0.15s ease",
            display: "inline-flex", alignItems: "center", gap: 6,
          }}
        >
          {tab.label}
          <span style={{
            background: active === tab.key ? "var(--accent-soft)" : "#f1f2f4",
            color: active === tab.key ? "var(--brand)" : "#7a869a",
            borderRadius: 10, padding: "1px 7px",
            fontSize: 11, fontWeight: 700,
          }}>
            {tab.count}
          </span>
        </button>
      ))}
    </div>
  );
}

// ── "Closed" section divider ──────────────────────────────────────────────────

function ClosedSectionDivider() {
  return (
    <div style={{
      gridColumn: "1 / -1",
      display: "flex", alignItems: "center", gap: 10,
      margin: "8px 0",
    }}>
      <div style={{ flex: 1, height: 1, background: "var(--border-subtle)" }} />
      <span style={{
        fontSize: 11, fontWeight: 700, color: "#97a0af",
        textTransform: "uppercase", letterSpacing: "0.06em",
        background: "#f8f9fa", padding: "2px 10px", borderRadius: 10,
        border: "1px solid var(--border-subtle)",
      }}>
        Expired
      </span>
      <div style={{ flex: 1, height: 1, background: "var(--border-subtle)" }} />
    </div>
  );
}

// ── Assessment Card ───────────────────────────────────────────────────────────

function AssessmentCard({
  a, featured, onAction,
}: {
  a: any;
  featured?: boolean;
  onAction: (action: string, id: string, extra?: string) => Promise<void>;
}) {
  const type: AssessmentType     = a.type || "";
  const status: AssessmentStatus = a.status || "";

  const isLive     = status === "LIVE";
  const isUpcoming = status === "UPCOMING";
  const isOpen     = status === "OPEN";
  const isClosed   = status === "CLOSED";
  const deadline   = formatDeadline(a.deadline);

  const borderColor =
    isLive     ? "#de350b" :
    isOpen     ? "#00875a" :
    isUpcoming ? "var(--brand)" :
                 "#dfe1e6";   // muted border for closed

  return (
    <div
      className={`card${!isClosed ? " card-hover" : ""}`}
      style={{
        borderLeft: `4px solid ${borderColor}`,
        borderRadius: "0 8px 8px 0",
        // closed: visually dimmed but still shows; pointer events preserved
        opacity: isClosed ? 0.55 : 1,
        filter: isClosed ? "grayscale(30%)" : "none",
        background: isLive ? "#fff8f8" : isUpcoming ? "#f4f7ff" : "white",
        transition: "opacity 0.2s, filter 0.2s",
        ...(featured ? { gridColumn: "1 / -1" } : {}),
      }}
    >
      {/* Header */}
      <div style={{ padding: "16px 18px 8px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Status pill — happening now / coming in X */}
          {isLive && (
            <div style={{ marginBottom: 6 }}>
              <HappeningNowBadge />
            </div>
          )}
          {isUpcoming && a.scheduledStartTime && (
            <div style={{ marginBottom: 6 }}>
              <ComingInBadge targetDate={a.scheduledStartTime} />
            </div>
          )}

          <div style={{
            fontSize: 15, fontWeight: 700,
            color: isClosed ? "#97a0af" : "var(--text-primary)",
            marginBottom: 3, letterSpacing: "-0.2px",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {a.title}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {a.host ? `By ${a.host}` : ""}
            {a.moduleName ? (a.host ? ` · ${a.moduleName}` : a.moduleName) : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <TypeBadge type={type} />
          <StatusBadge type={type} status={status} />
        </div>
      </div>

      {/* Meta chips */}
      <div style={{ padding: "0 18px 12px", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        {a.scheduledStartTime && (
          <MetaChip icon={<Calendar size={11} />} text={formatDate(a.scheduledStartTime)} />
        )}
        {a.deadline && (
          <MetaChip icon={<Calendar size={11} />} text={`Deadline: ${formatDate(a.deadline)}`} />
        )}
        {a.durationMinutes && (
          <MetaChip icon={<Timer size={11} />} text={`${a.durationMinutes} min`} />
        )}
        {a.maxAttempts && (
          <MetaChip icon={<RefreshCw size={11} />} text={`Max ${a.maxAttempts} attempts`} />
        )}
        {(a.problemsCount ?? 0) > 0 && (
          <MetaChip icon={<FileText size={11} />} text={`${a.problemsCount} problem${a.problemsCount !== 1 ? "s" : ""}`} />
        )}
        {a.visibilityMode === "REQUEST_BASED" && (
          <MetaChip icon={<Lock size={11} />} text="Request Based" />
        )}
        {(a.visibilityMode === "ACCESS_CODE" || a.strictAccessCode) && (
          <MetaChip icon={<Lock size={11} />} text="Access Code" />
        )}
        {!a.visibilityMode && !a.strictAccessCode && (
          <MetaChip icon={<Globe size={11} />} text="Module Only" />
        )}
      </div>

      {/* Deadline urgency pill for open TPs */}
      {type === "OPEN_TP" && isOpen && deadline && (
        <div style={{ padding: "0 18px 10px" }}>
          <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "var(--orange-light)", color: "#974f0c", fontWeight: 600 }}>
            {deadline}
          </span>
        </div>
      )}

      {/* Attempts progress for TPs */}
      {type === "OPEN_TP" && a.maxAttempts && (
        <div style={{ padding: "0 18px 12px" }}>
          <TimeProgress
            used={a.attemptsUsed ?? 0}
            total={a.maxAttempts}
            label="Attempts used"
            color={isOpen ? "var(--brand)" : "#97a0af"}
          />
        </div>
      )}

      {/* Live exam time progress bar */}
      {isLive && a.scheduledStartTime && a.durationMinutes && (
        <div style={{ padding: "0 18px 12px" }}>
          <TimeProgress
            used={Math.max(0, Math.floor((Date.now() - new Date(a.scheduledStartTime).getTime()) / 60_000))}
            total={a.durationMinutes}
            label="Time elapsed"
            color="#de350b"
          />
        </div>
      )}

      {/* Divider */}
      <div style={{ height: 1, background: "var(--border-subtle)", margin: "0 18px" }} />

      {/* Footer */}
      <div style={{
        padding: "12px 18px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
      }}>
        {/* Closed: show "View Problems" link instead of hiding access */}
        {isClosed ? (
          <span style={{ fontSize: 12, color: "#97a0af", fontStyle: "italic" }}>
            This {type === "OPEN_TP" ? "TP" : "exam"} has ended
          </span>
        ) : <span />}

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* Always allow viewing problems, even for closed */}
          {isClosed && (a.problemsCount ?? 0) > 0 && (
            <Link
              href={type === "OPEN_TP" ? `/arena/tp/${a.id}` : `/arena/exam/${a.id}`}
              style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                fontSize: 12, color: "#5e6c84", textDecoration: "none",
                padding: "5px 10px", border: "1px solid var(--border)", borderRadius: 6,
                fontWeight: 500,
                transition: "all 0.15s",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.color = "var(--brand)";
                (e.currentTarget as HTMLElement).style.borderColor = "var(--brand)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.color = "#5e6c84";
                (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
              }}
            >
              <FileText size={12} /> View Problems
            </Link>
          )}
          {!isClosed && (
            <JoinActionButton
              id={a.id}
              type={type === "OPEN_TP" ? "TP" : "EXAM"}
              visibility={a.visibilityMode || (a.strictAccessCode ? "ACCESS_CODE" : "MODULE_ONLY")}
              itemStatus={status}
              myJoinStatus={a.myJoinStatus || "NONE"}
              onAction={onAction}
            />
          )}
        </div>
      </div>
    </div>
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

  const handleAction = async (action: string, id: string, extra?: string) => {
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

  // ── derived counts (before sorting / filtering) ──────────────────────────
  const exams   = assessments.filter(a => a.type === "LIVE_EXAM");
  const tps     = assessments.filter(a => a.type === "OPEN_TP");
  const closed  = assessments.filter(a => a.status === "CLOSED");
  const upcoming = assessments.filter(a => a.status === "UPCOMING");
  const liveNow  = assessments.filter(a => a.status === "LIVE");
  const openTps  = assessments.filter(a => a.type === "OPEN_TP" && a.status === "OPEN");

  // ── filter by tab then search, then SORT ─────────────────────────────────
  const byTab =
    activeTab === "Live Exams" ? exams :
    activeTab === "Open TPs"   ? tps   :
    activeTab === "Closed"     ? closed :
    assessments;

  const q = search.trim().toLowerCase();
  const filtered = byTab.filter(a => !q || (a.title || "").toLowerCase().includes(q));

  // Sort: live → upcoming → open → closed (newest-closed first within each group)
  const sorted = sortAssessments(filtered);

  // Split active vs closed for rendering divider
  const activeItems = sorted.filter(a => a.status !== "CLOSED");
  const closedItems = sorted.filter(a => a.status === "CLOSED");

  // Featured: the first LIVE exam (spans full width)
  const featuredLive = activeItems.find(a => a.type === "LIVE_EXAM" && a.status === "LIVE");
  const restActive   = activeItems.filter(a => a !== featuredLive);

  const tabs: Array<{ key: TabKey; label: string; count: number }> = [
    { key: "All",        label: "All",        count: assessments.length },
    { key: "Live Exams", label: "Live Exams", count: exams.length },
    { key: "Open TPs",   label: "Open TPs",   count: tps.length },
    { key: "Closed",     label: "Closed",     count: closed.length },
  ];

  const totalDisplayed = sorted.length;

  return (
    <>
      <Navbar />
      <div className="psp-breadcrumb">
        <Link href="/dashboard">{APP_NAME}</Link> › <span style={{ color: "var(--text-primary)" }}>Exams &amp; TPs</span>
      </div>
      <div className="psp-main">

        {/* Page header */}
        <div className="page-header">
          <div className="page-header-title">
            <BookOpen size={20} />
            Exams &amp; TPs
          </div>
          <div className="page-header-sub">Your module assignments and exams</div>
        </div>

        {/* Stats row */}
        {!loading && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
            <StatCard value={assessments.length} label="Total"    color="default" />
            <StatCard value={liveNow.length}     label="Live Now" color="red"     />
            <StatCard value={openTps.length}     label="Open TPs" color="green"   />
            <StatCard value={upcoming.length}    label="Upcoming" color="blue"    />
          </div>
        )}

        {/* Tabs + search */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <FilterTabs tabs={tabs} active={activeTab} onChange={setActiveTab} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid var(--border)", borderRadius: 6, padding: "0 10px", height: 34, marginBottom: 20, flexShrink: 0 }}>
            <Search size={12} color="#97a0af" />
            <input
              placeholder="Search…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ border: "none", outline: "none", fontSize: 12, color: "var(--text-primary)", width: 160, background: "transparent" }}
            />
          </div>
        </div>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
            <Spinner size={28} />
          </div>
        ) : totalDisplayed === 0 ? (
          <div className="psp-empty" style={{ padding: 80 }}>
            <BookOpen size={36} color="var(--border)" style={{ margin: "0 auto 12px" }} />
            <div className="psp-empty-title">No exams or TPs</div>
            <div>{q ? "No results for that search." : "Check back later or request access from your teacher."}</div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14 }} className="stagger">

            {/* Featured live exam — spans full width */}
            {featuredLive && (
              <AssessmentCard key={featuredLive.id} a={featuredLive} featured onAction={handleAction} />
            )}

            {/* Active items (upcoming + open TPs) */}
            {restActive.map(a => (
              <AssessmentCard key={a.id} a={a} onAction={handleAction} />
            ))}

            {/* ── Divider before closed section ── */}
            {closedItems.length > 0 && activeItems.length > 0 && (
              <ClosedSectionDivider />
            )}

            {/* Closed / expired — grayed but accessible */}
            {closedItems.map(a => (
              <AssessmentCard key={a.id} a={a} onAction={handleAction} />
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes blink {
          0%,100% { opacity: 1; }
          50%      { opacity: 0.25; }
        }
        @keyframes livePulse {
          0%   { box-shadow: 0 0 0 0   rgba(222,53,11,0.45); }
          70%  { box-shadow: 0 0 0 8px rgba(222,53,11,0);    }
          100% { box-shadow: 0 0 0 0   rgba(222,53,11,0);    }
        }
      `}</style>
    </>
  );
}
