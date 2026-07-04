"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Spinner from "@/components/ui/Spinner";
import { ArrowLeft, Clock, Lock, FileText, Calendar, Play, ShieldCheck, AlertTriangle } from "lucide-react";
import { getAssessments } from "@/lib/api";

/**
 * Pre-start waiting room for a LIVE_EXAM. Reached by clicking a SCHEDULED
 * (UPCOMING) exam card. Pulls its data from the existing assessments list
 * endpoint (no new API), shows a live countdown to the start time, an
 * access-code field when required, and gates the "Enter exam" button until
 * the scheduled start. Once live it links into the arena at /arena/exam/[id].
 *
 * The backend does NOT enforce a start-time gate on the exam-room endpoint,
 * so this page holds that gate on the client.
 */

function formatWhen(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/** Break a positive ms span into d/h/m/s parts. */
function breakdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  };
}

export default function ExamWaitingRoom({ id }: { id: string }) {
  const router = useRouter();

  const [exam, setExam]       = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [now, setNow]         = useState(() => Date.now());
  const [code, setCode]       = useState("");
  const refetchedAtStart      = useRef(false);

  const load = () =>
    getAssessments()
      .then((list) => {
        const found = (list as any[]).find((a) => String(a.id) === String(id));
        if (!found) setNotFound(true);
        else { setExam(found); setNotFound(false); }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  // 1s tick drives the countdown.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const startMs = exam?.scheduledStartTime ? new Date(exam.scheduledStartTime).getTime() : null;
  const status: string = exam?.status ?? "";
  const isClosed = status === "CLOSED";
  const started  = startMs != null ? now >= startMs : status === "LIVE";
  const isLive   = !isClosed && (status === "LIVE" || started);

  // When the countdown crosses the start time while still marked UPCOMING,
  // refetch once so the authoritative status flips to LIVE.
  useEffect(() => {
    if (!refetchedAtStart.current && exam?.status === "UPCOMING" && startMs != null && now >= startMs) {
      refetchedAtStart.current = true;
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="psp-main" style={{ display: "flex", justifyContent: "center", padding: 80 }}>
          <Spinner size={28} />
        </div>
      </>
    );
  }

  if (notFound || !exam) {
    return (
      <>
        <Navbar />
        <div className="psp-main" style={{ maxWidth: 560 }}>
          <BackLink onClick={() => router.push("/assessments")} />
          <div style={{
            background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r)",
            padding: 40, textAlign: "center",
          }}>
            <AlertTriangle size={28} color="var(--ink-3)" style={{ margin: "0 auto 12px" }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>Exam not found</div>
            <div style={{ fontSize: 13, color: "var(--ink-2)" }}>
              This exam isn&apos;t available to you, or it may have been removed.
            </div>
          </div>
        </div>
      </>
    );
  }

  const vis = (exam.visibilityMode || (exam.strictAccessCode ? "ACCESS_CODE" : "MODULE_ONLY")).toUpperCase();
  const needsCode = vis === "ACCESS_CODE";
  const codeOk = !needsCode || code.trim() === String(exam.strictAccessCode ?? "").trim();

  const t = breakdown((startMs ?? now) - now);
  const enterExam = () => router.push(`/arena/exam/${id}`);
  const hasProblems = (exam.problemsCount ?? 0) > 0;

  return (
    <>
      <Navbar />
      <div className="psp-main" style={{ maxWidth: 560 }}>
        <BackLink onClick={() => router.push("/assessments")} />

        <div style={{
          background: "var(--surface)", border: "1px solid var(--line-2)", borderRadius: "var(--r)",
          overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{ padding: "20px 22px", borderBottom: "1px solid var(--line-2)" }}>
            <div style={{
              fontSize: 10.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase",
              color: "var(--warn)", marginBottom: 6,
            }}>
              Live Exam
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-.02em", color: "var(--ink)", lineHeight: 1.25 }}>
              {exam.title}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 12 }}>
              {exam.moduleName && <Meta icon={<FileText size={13} />} text={exam.moduleName} />}
              {exam.durationMinutes ? <Meta icon={<Clock size={13} />} text={`${exam.durationMinutes} min`} /> : null}
              {exam.scheduledStartTime && <Meta icon={<Calendar size={13} />} text={formatWhen(exam.scheduledStartTime)} />}
            </div>
          </div>

          {/* Body — status-dependent */}
          <div style={{ padding: "22px" }}>
            {isClosed ? (
              <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>This exam has ended</div>
                <div style={{ fontSize: 12.5, color: "var(--ink-2)", marginBottom: 18 }}>
                  {hasProblems ? "Your submissions are available to review." : "Grades are pending release."}
                </div>
                <button
                  className="psp-btn psp-btn-primary"
                  disabled={!hasProblems}
                  onClick={hasProblems ? enterExam : undefined}
                  style={{ width: "100%", justifyContent: "center", opacity: hasProblems ? 1 : 0.6 }}
                >
                  {hasProblems ? "View result" : "Grades pending"}
                </button>
              </div>
            ) : isLive ? (
              <>
                <div style={{
                  display: "flex", alignItems: "center", gap: 8, justifyContent: "center",
                  color: "var(--accent)", fontSize: 13, fontWeight: 700, marginBottom: 16,
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", boxShadow: "0 0 8px var(--accent)" }} />
                  Exam is live now
                </div>
                {needsCode && <AccessCodeField code={code} setCode={setCode} ok={codeOk} />}
                <button
                  className="psp-btn psp-btn-primary"
                  disabled={!codeOk}
                  onClick={codeOk ? enterExam : undefined}
                  style={{ width: "100%", justifyContent: "center", gap: 8, opacity: codeOk ? 1 : 0.6 }}
                >
                  <Play size={14} /> Enter exam
                </button>
              </>
            ) : (
              <>
                <div style={{ textAlign: "center", marginBottom: 6, fontSize: 12.5, color: "var(--ink-2)" }}>
                  Starts in
                </div>
                <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 20 }}>
                  {(t.d > 0 ? [["d", t.d], ["h", t.h], ["m", t.m], ["s", t.s]] : [["h", t.h], ["m", t.m], ["s", t.s]]).map(([label, val]) => (
                    <div key={label as string} style={{
                      background: "var(--bg-2)", border: "1px solid var(--line-2)", borderRadius: 8,
                      padding: "10px 12px", minWidth: 56, textAlign: "center",
                    }}>
                      <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "var(--font-mono)", color: "var(--ink)", lineHeight: 1 }}>
                        {String(val).padStart(2, "0")}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--ink-3)", textTransform: "uppercase", marginTop: 4 }}>{label}</div>
                    </div>
                  ))}
                </div>
                {needsCode && <AccessCodeField code={code} setCode={setCode} ok={codeOk} />}
                <button
                  className="psp-btn psp-btn-primary"
                  disabled
                  style={{ width: "100%", justifyContent: "center", gap: 8, opacity: 0.55, cursor: "not-allowed" }}
                >
                  <Lock size={13} /> Not started yet
                </button>
                <div style={{ fontSize: 11.5, color: "var(--ink-3)", textAlign: "center", marginTop: 10 }}>
                  This page will unlock automatically when the exam starts.
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 6,
      color: "var(--ink-3)", fontSize: 13, fontWeight: 600,
      background: "none", border: "none", cursor: "pointer",
      marginBottom: 18, padding: 0,
    }}>
      <ArrowLeft size={14} /> Back to Exams &amp; TPs
    </button>
  );
}

function Meta({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--ink-2)" }}>
      <span style={{ color: "var(--ink-3)", display: "flex" }}>{icon}</span>
      {text}
    </span>
  );
}

function AccessCodeField({ code, setCode, ok }: { code: string; setCode: (v: string) => void; ok: boolean }) {
  const entered = code.trim().length > 0;
  return (
    <div style={{ marginBottom: 16 }}>
      <label className="psp-form-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Lock size={12} /> Access code
      </label>
      <input
        className="psp-form-input"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Enter the code from your teacher"
      />
      {entered && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6, marginTop: 6,
          fontSize: 11.5, color: ok ? "var(--accent)" : "var(--danger)",
        }}>
          {ok ? <><ShieldCheck size={12} /> Code accepted</> : "Code doesn't match yet"}
        </div>
      )}
    </div>
  );
}
