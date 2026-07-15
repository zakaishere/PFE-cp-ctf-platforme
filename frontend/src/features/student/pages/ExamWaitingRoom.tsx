"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Spinner from "@/components/ui/Spinner";
import { ArrowLeft, Clock, Lock, FileText, Calendar, Play, ShieldCheck, AlertTriangle, Hourglass, UserCheck, Send, Loader2 } from "lucide-react";
import { getAssessments, requestToJoinAssessment, verifyAssessmentAccessCode } from "@/lib/api";
import { toast } from "@/components/ui/PSPToast";

/**
 * Pre-start waiting room for a LIVE_EXAM. Reached by clicking a SCHEDULED
 * (UPCOMING) exam card. Pulls its data from the existing assessments list
 * endpoint (no new API), shows a live countdown to the start time, and — the
 * important part — lets the student get *cleared for entry before the exam
 * starts*:
 *   • REQUEST_BASED → send a join request and wait for teacher approval.
 *   • ACCESS_CODE   → enter the access code to confirm access.
 * Once cleared, the student simply waits for the countdown; when it goes live
 * the "Enter exam" button unlocks and drops them straight into /arena/exam/[id].
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
  const [codeConfirmed, setCodeConfirmed] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [codeError, setCodeError]         = useState("");
  const [joinStatus, setJoinStatus] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const refetchedAtStart      = useRef(false);

  const load = () =>
    getAssessments()
      .then((list) => {
        const found = (list as any[]).find((a) => String(a.id) === String(id));
        if (!found) setNotFound(true);
        else {
          setExam(found);
          setNotFound(false);
          if (found.myJoinStatus) setJoinStatus(found.myJoinStatus);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  // 1s tick drives the countdown.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Poll every 15s so a pending request flipping to approved — and the exam
  // going live — show up without the student needing to reload.
  useEffect(() => {
    const t = setInterval(() => { load(); }, 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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

  const sendJoinRequest = async () => {
    setRequesting(true);
    try {
      await requestToJoinAssessment(id);
      setJoinStatus("PENDING");
      toast.success("Request sent — waiting for your teacher to approve.");
      load();
    } catch (e: any) {
      toast.error(e?.message || "Could not send request. Please try again.");
    } finally {
      setRequesting(false);
    }
  };

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
  const needsCode    = vis === "ACCESS_CODE";
  const needsRequest = vis === "REQUEST_BASED";

  // "Cleared for entry": the student has done what's needed to be allowed in
  // once the exam starts. MODULE_ONLY needs nothing; ACCESS_CODE needs the
  // code verified server-side (never compared in the browser — the real
  // value isn't sent to students); REQUEST_BASED needs an approved request.
  const cleared =
    needsRequest ? joinStatus === "APPROVED"
    : needsCode  ? codeConfirmed
    : true;

  async function handleConfirmAccess() {
    if (!code.trim()) return;
    setVerifyingCode(true);
    setCodeError("");
    try {
      await verifyAssessmentAccessCode(id, code.trim());
      if (typeof window !== "undefined") {
        sessionStorage.setItem(`arena_access_code_${id}`, code.trim());
      }
      setCodeConfirmed(true);
      toast.success("Access confirmed — you're in.");
    } catch {
      setCodeError("Invalid access code — try again");
    } finally {
      setVerifyingCode(false);
    }
  }

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
            ) : (
              <>
                {/* Live indicator when the exam has started */}
                {isLive && (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 8, justifyContent: "center",
                    color: "var(--accent)", fontSize: 13, fontWeight: 700, marginBottom: 16,
                  }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", boxShadow: "0 0 8px var(--accent)" }} />
                    Exam is live now
                  </div>
                )}

                {/* Countdown while still upcoming */}
                {!isLive && (
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
                  </>
                )}

                {/* Registration / access — available BEFORE and after the start */}
                {needsRequest && <RequestJoinBlock
                  status={joinStatus}
                  requesting={requesting}
                  onRequest={sendJoinRequest}
                />}
                {needsCode && !cleared && (
                  <>
                    <AccessCodeField code={code} setCode={setCode} />
                    {codeError && (
                      <div style={{ fontSize: 12, color: "var(--danger)", textAlign: "center", marginBottom: 10 }}>
                        {codeError}
                      </div>
                    )}
                  </>
                )}
                {needsCode && !codeConfirmed && !isLive && (
                  <button
                    className="psp-btn psp-btn-primary"
                    disabled={verifyingCode || !code.trim()}
                    onClick={handleConfirmAccess}
                    style={{ width: "100%", justifyContent: "center", gap: 8, marginBottom: 12, opacity: verifyingCode || !code.trim() ? 0.6 : 1 }}
                  >
                    <ShieldCheck size={14} /> {verifyingCode ? "Checking…" : "Confirm access"}
                  </button>
                )}

                {/* Cleared-and-waiting confirmation */}
                {cleared && !isLive && (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 8, justifyContent: "center",
                    color: "var(--accent)", fontSize: 12.5, fontWeight: 600, marginBottom: 14,
                  }}>
                    <UserCheck size={14} /> You&apos;re in — the exam will unlock automatically when it starts.
                  </div>
                )}

                {/* Primary action */}
                {isLive && cleared ? (
                  <button
                    className="psp-btn psp-btn-primary"
                    onClick={enterExam}
                    style={{ width: "100%", justifyContent: "center", gap: 8 }}
                  >
                    <Play size={14} /> Enter exam
                  </button>
                ) : isLive && !cleared ? (
                  <div style={{ fontSize: 11.5, color: "var(--ink-3)", textAlign: "center", marginTop: 4 }}>
                    {needsRequest
                      ? "You need an approved request to enter this exam."
                      : "Enter the access code above to enter this exam."}
                  </div>
                ) : cleared ? (
                  <button
                    className="psp-btn psp-btn-primary"
                    disabled
                    style={{ width: "100%", justifyContent: "center", gap: 8, opacity: 0.55, cursor: "not-allowed" }}
                  >
                    <Lock size={13} /> Not started yet
                  </button>
                ) : null}
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

/** REQUEST_BASED: request-to-join and its status, usable before the start. */
function RequestJoinBlock({
  status, requesting, onRequest,
}: { status: string | null; requesting: boolean; onRequest: () => void }) {
  if (status === "APPROVED") return null; // handled by the "you're in" banner

  if (status === "PENDING") {
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", marginBottom: 14,
        background: "var(--warn-soft)", border: "1px solid var(--line-2)", borderRadius: 8,
        color: "var(--warn)", fontSize: 12.5, fontWeight: 600,
      }}>
        <Hourglass size={15} />
        Request sent — waiting for your teacher to approve. Keep this page open.
      </div>
    );
  }

  if (status === "REJECTED") {
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", marginBottom: 14,
        background: "var(--danger-soft)", border: "1px solid var(--line-2)", borderRadius: 8,
        color: "var(--danger)", fontSize: 12.5, fontWeight: 600,
      }}>
        <AlertTriangle size={15} />
        Your request was declined by the teacher.
      </div>
    );
  }

  // NOT_REQUESTED (or null)
  return (
    <button
      className="psp-btn psp-btn-primary"
      onClick={onRequest}
      disabled={requesting}
      style={{ width: "100%", justifyContent: "center", gap: 8, marginBottom: 12, opacity: requesting ? 0.7 : 1 }}
    >
      {requesting ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={14} />}
      {requesting ? "Sending request…" : "Request to join"}
    </button>
  );
}

function AccessCodeField({ code, setCode }: { code: string; setCode: (v: string) => void }) {
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
    </div>
  );
}
