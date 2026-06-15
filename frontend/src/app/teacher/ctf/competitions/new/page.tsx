"use client";

import { useState } from "react";
import { APP_NAME } from "@/lib/brand";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { Trophy, KeyRound, AlertCircle, Save, Calendar, Timer, Gamepad2, UserPlus, Check } from "lucide-react";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { toast } from "@/components/ui/PSPToast";
import {
  createTeacherCtfCompetition,
  type CTFCompetitionCreateRequest,
} from "@/lib/api";
import { ApiException } from "@/lib/api";

// Local datetime ISO without timezone, suitable for backend LocalDateTime
function toLocalIso(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

function defaultStart() {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(0, 0, 0);
  return toLocalIso(d).slice(0, 16);
}
function defaultEnd() {
  const d = new Date(Date.now() + 25 * 60 * 60 * 1000);
  d.setMinutes(0, 0, 0);
  return toLocalIso(d).slice(0, 16);
}

const SCORING: Array<{ value: "DYNAMIC" | "STATIC"; label: string; hint: string }> = [
  { value: "DYNAMIC", label: "Dynamic", hint: "Points decay as more teams solve" },
  { value: "STATIC",  label: "Static",  hint: "Fixed points per challenge" },
];

const VISIBILITY: Array<{ value: "PUBLIC" | "ACCESS_CODE"; label: string; hint: string }> = [
  { value: "PUBLIC",      label: "Public",       hint: "Anyone authenticated can browse it" },
  { value: "ACCESS_CODE", label: "Access code",  hint: "Only people with the code can join" },
];

export default function NewTeacherCTFCompetitionPage() {
  const router = useRouter();

  const [form, setForm] = useState<CTFCompetitionCreateRequest>({
    title:        "",
    description:  "",
    startTime:    defaultStart(),
    endTime:      defaultEnd(),
    maxTeamSize:  4,
    minTeamSize:  1,
    scoringMode:  "DYNAMIC",
    dynamicMinPoints:   50,
    dynamicDecayFactor: 0.08,
    visibility:   "PUBLIC",
    accessCode:   "",
    bannerUrl:    "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [topError, setTopError] = useState<string | null>(null);

  // ── Schedule state ───────────────────────────────────────────────────────
  const [timingMode, setTimingMode] = useState<"SCHEDULED" | "DURATION" | "MANUAL" | "REGISTRATION">("SCHEDULED");
  const [startNow, setStartNow] = useState(false);
  const [durationHours, setDurationHours] = useState(2);
  const [durationMinutes, setDurationMinutes] = useState(0);
  const [regEndMode, setRegEndMode] = useState<"duration" | "manual">("duration");

  function computeEndPreview() {
    const base = startNow
      ? new Date()
      : form.startTime ? new Date(form.startTime) : new Date();
    const totalMin = durationHours * 60 + durationMinutes;
    const end = new Date(base.getTime() + totalMin * 60 * 1000);
    return end.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function update<K extends keyof CTFCompetitionCreateRequest>(key: K, value: CTFCompetitionCreateRequest[K]) {
    setForm((p) => ({ ...p, [key]: value }));
    if (fieldErrors[key as string]) {
      setFieldErrors((p) => { const n = { ...p }; delete n[key as string]; return n; });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTopError(null);
    setFieldErrors({});

    const errs: Record<string, string> = {};
    if (!form.title.trim() || form.title.trim().length < 3) errs.title = "Title must be at least 3 characters.";

    if (timingMode === "SCHEDULED") {
      if (!form.startTime) errs.startTime = "Start time is required.";
      if (!form.endTime)   errs.endTime   = "End time is required.";
      if (form.startTime && form.endTime && new Date(form.endTime) <= new Date(form.startTime)) {
        errs.endTime = "End time must be after start time.";
      }
    }
    if (timingMode === "DURATION") {
      if (!startNow && !form.startTime) errs.startTime = "Start time is required.";
      if (durationHours * 60 + durationMinutes < 1) errs.durationHours = "Duration must be at least 1 minute.";
    }
    if (timingMode === "REGISTRATION" && regEndMode === "duration") {
      if (durationHours * 60 + durationMinutes < 1) errs.durationHours = "Duration must be at least 1 minute.";
    }
    if (form.visibility === "ACCESS_CODE" && !form.accessCode?.trim()) {
      errs.accessCode = "Access code is required for non-public competitions.";
    }
    if (form.minTeamSize && form.maxTeamSize && form.minTeamSize > form.maxTeamSize) {
      errs.minTeamSize = "Min team size cannot exceed max team size.";
    }
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }

    const totalMinutes = durationHours * 60 + durationMinutes;
    const noFixedTime = timingMode === "MANUAL" || timingMode === "REGISTRATION";

    function fmtIso(v: string | undefined) {
      if (!v) return undefined;
      return v.length === 16 ? v + ":00" : v;
    }

    const payload: CTFCompetitionCreateRequest = {
      ...form,
      title: form.title.trim(),
      description: form.description?.trim() || undefined,
      timingMode,
      startTime: noFixedTime ? undefined
        : timingMode === "DURATION" && startNow ? undefined
        : fmtIso(form.startTime ?? undefined),
      endTime: timingMode === "SCHEDULED" ? fmtIso(form.endTime ?? undefined) : undefined,
      durationHours: (timingMode === "DURATION" || (timingMode === "REGISTRATION" && regEndMode === "duration"))
        ? totalMinutes : undefined,
      accessCode: form.visibility === "PUBLIC" ? undefined : form.accessCode?.trim() || undefined,
      bannerUrl: form.bannerUrl?.trim() || undefined,
    };

    setSubmitting(true);
    try {
      const created = await createTeacherCtfCompetition(payload);
      toast.success("Competition created", `"${created.title}" is ready.`);
      router.push(`/teacher/ctf/competitions`);
    } catch (err) {
      if (err instanceof ApiException) {
        if (err.isValidationError()) {
          setFieldErrors(err.fieldErrors ?? {});
          setTopError("Please correct the highlighted fields.");
        } else {
          setTopError(err.message || "Failed to create competition.");
        }
      } else {
        setTopError("Failed to create competition.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Navbar />
      <div className="psp-breadcrumb">
        <Link href="/teacher">{APP_NAME}</Link> ›{" "}
        <Link href="/teacher/ctf">CTF</Link> ›{" "}
        <Link href="/teacher/ctf/competitions">Competitions</Link> ›{" "}
        <span style={{ color: "var(--text-primary)" }}>New</span>
      </div>

      <div className="psp-main" style={{ maxWidth: 780 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <Trophy size={20} color="#a78bfa" />
          <span style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>
            New CTF Competition
          </span>
        </div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>
          Define the time window, scoring rules, and access policy. You can attach challenges afterward.
        </div>

        <form onSubmit={handleSubmit}>
          {topError && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "var(--red-light)", color: "var(--red)",
              border: "1px solid var(--red)", borderRadius: 4,
              padding: "10px 14px", marginBottom: 16, fontSize: 13,
            }}>
              <AlertCircle size={14} /> {topError}
            </div>
          )}

          {/* ── Basic info ── */}
          <div className="psp-card" style={{ padding: 18, marginBottom: 14 }}>
            <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 13, color: "var(--text-primary)" }}>
              Basic info
            </div>

            <Field label="Title" required error={fieldErrors.title}>
              <input className="input"
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                maxLength={255}
                placeholder="Winter CTF 2026"
              />
            </Field>

            <Field label="Description" error={fieldErrors.description}>
              <textarea className="input"
                value={form.description ?? ""}
                onChange={(e) => update("description", e.target.value)}
                rows={3}
                maxLength={5000}
                placeholder="Decode. Exploit. Capture."
              />
            </Field>
          </div>

          {/* ── Schedule ── */}
          <div className="psp-card" style={{ padding: 18, marginBottom: 14 }}>
            <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 13, color: "var(--text-primary)" }}>
              Schedule
            </div>

            {/* 2×2 mode cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              {(
                [
                  { mode: "SCHEDULED",   icon: <Calendar size={14} />, title: "Scheduled",         desc: "Set exact start and end date/time. Fully automatic." },
                  { mode: "DURATION",    icon: <Timer    size={14} />, title: "Duration",           desc: "Starts now or at a time, runs for a set duration then stops automatically." },
                  { mode: "MANUAL",      icon: <Gamepad2 size={14} />, title: "Manual",             desc: "You start and stop it yourself from the control panel." },
                  { mode: "REGISTRATION",icon: <UserPlus size={14} />, title: "Registration First", desc: "Open registration for teams, then start when you are ready." },
                ] as const
              ).map(({ mode, icon, title, desc }) => {
                const selected = timingMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setTimingMode(mode)}
                    style={{
                      padding: "12px 14px", borderRadius: 8, textAlign: "left",
                      cursor: "pointer", transition: "border-color 120ms, background 120ms",
                      border: `1px solid ${selected ? "#6366f1" : "var(--border)"}`,
                      background: selected ? "rgba(99,102,241,0.08)" : "var(--bg-secondary)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <span style={{ color: "#818cf8" }}>{icon}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{title}</span>
                    </div>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0, lineHeight: 1.45 }}>{desc}</p>
                  </button>
                );
              })}
            </div>

            {/* SCHEDULED fields */}
            {timingMode === "SCHEDULED" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Field label="Start time" required error={fieldErrors.startTime}>
                  <input className="input" type="datetime-local"
                    value={(form.startTime ?? "").slice(0, 16)}
                    onChange={(e) => update("startTime", e.target.value)}
                  />
                </Field>
                <Field label="End time" required error={fieldErrors.endTime}>
                  <input className="input" type="datetime-local"
                    value={(form.endTime ?? "").slice(0, 16)}
                    onChange={(e) => update("endTime", e.target.value)}
                  />
                </Field>
              </div>
            )}

            {/* DURATION fields */}
            {timingMode === "DURATION" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={startNow}
                    onChange={(e) => setStartNow(e.target.checked)}
                    style={{ width: 16, height: 16 }}
                  />
                  <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                    Start immediately when I save
                  </span>
                </label>

                {!startNow && (
                  <Field label="Start time" required error={fieldErrors.startTime}>
                    <input className="input" type="datetime-local"
                      value={(form.startTime ?? "").slice(0, 16)}
                      onChange={(e) => update("startTime", e.target.value)}
                    />
                  </Field>
                )}

                <Field label="Duration" error={fieldErrors.durationHours}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input className="input" type="number" min={0} max={168}
                        value={durationHours}
                        onChange={(e) => setDurationHours(Math.max(0, parseInt(e.target.value) || 0))}
                        style={{ width: 72, textAlign: "center" }}
                      />
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>hours</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input className="input" type="number" min={0} max={59}
                        value={durationMinutes}
                        onChange={(e) => setDurationMinutes(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                        style={{ width: 72, textAlign: "center" }}
                      />
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>minutes</span>
                    </div>
                  </div>
                  {(durationHours > 0 || durationMinutes > 0) && (
                    <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
                      Ends approximately: <strong style={{ color: "var(--text-primary)" }}>{computeEndPreview()}</strong>
                    </p>
                  )}
                </Field>
              </div>
            )}

            {/* MANUAL info */}
            {timingMode === "MANUAL" && (
              <div style={{
                padding: "12px 14px", borderRadius: 8,
                background: "var(--bg-secondary)", border: "1px solid var(--border)",
              }}>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 4px" }}>
                  <span style={{display:"inline-flex",alignItems:"center",gap:4}}><Check size={13} /> No schedule needed</span>
                </p>
                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
                  After saving, go to the Control panel and press{" "}
                  <strong style={{ color: "var(--text-primary)" }}>Start Competition</strong>{" "}
                  when you are ready. You also stop it manually.
                </p>
              </div>
            )}

            {/* REGISTRATION fields */}
            {timingMode === "REGISTRATION" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{
                  padding: "12px 14px", borderRadius: 8,
                  background: "var(--bg-secondary)", border: "1px solid var(--border)",
                }}>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 4px" }}>
                    Registration opens immediately when saved.
                  </p>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
                    Players can create and join teams. Challenges stay hidden until you press Start in the control panel.
                  </p>
                </div>

                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>
                    After you start, end the competition:
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="regEnd"
                        checked={regEndMode === "duration"}
                        onChange={() => setRegEndMode("duration")}
                      />
                      <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                        Automatically after a duration
                      </span>
                    </label>

                    {regEndMode === "duration" && (
                      <div style={{ marginLeft: 24, display: "flex", flexDirection: "column", gap: 8 }}>
                        <Field label="" error={fieldErrors.durationHours}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <input className="input" type="number" min={0} max={168}
                                value={durationHours}
                                onChange={(e) => setDurationHours(Math.max(0, parseInt(e.target.value) || 0))}
                                style={{ width: 72, textAlign: "center" }}
                              />
                              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>hours</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <input className="input" type="number" min={0} max={59}
                                value={durationMinutes}
                                onChange={(e) => setDurationMinutes(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                                style={{ width: 72, textAlign: "center" }}
                              />
                              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>minutes</span>
                            </div>
                          </div>
                        </Field>
                      </div>
                    )}

                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="regEnd"
                        checked={regEndMode === "manual"}
                        onChange={() => setRegEndMode("manual")}
                      />
                      <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                        Manually — I will stop it myself
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Teams + scoring ── */}
          <div className="psp-card" style={{ padding: 18, marginBottom: 14 }}>
            <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 13, color: "var(--text-primary)" }}>
              Teams &amp; scoring
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 12 }}>
              <Field label="Min team size" error={fieldErrors.minTeamSize}>
                <input className="input" type="number" min={1} max={20}
                  value={form.minTeamSize ?? 1}
                  onChange={(e) => update("minTeamSize", Number(e.target.value))}
                />
              </Field>
              <Field label="Max team size" error={fieldErrors.maxTeamSize}>
                <input className="input" type="number" min={1} max={20}
                  value={form.maxTeamSize ?? 4}
                  onChange={(e) => update("maxTeamSize", Number(e.target.value))}
                />
              </Field>
            </div>

            <Field label="Scoring mode" required>
              <div style={{ display: "flex", gap: 8 }}>
                {SCORING.map((s) => (
                  <Pill
                    key={s.value}
                    active={form.scoringMode === s.value}
                    onClick={() => update("scoringMode", s.value)}
                    label={s.label}
                    hint={s.hint}
                  />
                ))}
              </div>
            </Field>

            {form.scoringMode === "DYNAMIC" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 10 }}>
                <Field label="Minimum points floor" error={fieldErrors.dynamicMinPoints}>
                  <input className="input" type="number" min={0} max={10000}
                    value={form.dynamicMinPoints ?? 50}
                    onChange={(e) => update("dynamicMinPoints", Number(e.target.value))}
                  />
                </Field>
                <Field label="Decay factor (0–1)" error={fieldErrors.dynamicDecayFactor}>
                  <input className="input" type="number" step={0.01} min={0} max={1}
                    value={form.dynamicDecayFactor ?? 0.08}
                    onChange={(e) => update("dynamicDecayFactor", Number(e.target.value))}
                  />
                </Field>
              </div>
            )}
          </div>

          {/* ── Access ── */}
          <div className="psp-card" style={{ padding: 18, marginBottom: 14 }}>
            <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 13, color: "var(--text-primary)" }}>
              Access
            </div>

            <Field label="Visibility" required>
              <div style={{ display: "flex", gap: 8 }}>
                {VISIBILITY.map((v) => (
                  <Pill
                    key={v.value}
                    active={form.visibility === v.value}
                    onClick={() => update("visibility", v.value)}
                    label={v.label}
                    hint={v.hint}
                  />
                ))}
              </div>
            </Field>

            {form.visibility === "ACCESS_CODE" && (
              <div style={{ marginTop: 10 }}>
                <Field label="Access code" required error={fieldErrors.accessCode}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <KeyRound size={14} style={{ color: "var(--text-muted)" }} />
                    <input
                      className="input"
                      value={form.accessCode ?? ""}
                      onChange={(e) => update("accessCode", e.target.value.toUpperCase().replace(/\s+/g, ""))}
                      placeholder="WINTER2026"
                      maxLength={30}
                      style={{ fontFamily: "ui-monospace, monospace", letterSpacing: "0.06em" }}
                    />
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                    Students enter this code at /ctf to unlock the competition.
                  </div>
                </Field>
              </div>
            )}
          </div>

          {/* ── Footer actions ── */}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Link href="/teacher/ctf/competitions">
              <button type="button" className="psp-btn psp-btn-secondary">Cancel</button>
            </Link>
            <LoadingButton
              type="submit"
              loading={submitting}
              className="psp-btn psp-btn-primary"
              style={{ gap: 6 }}
            >
              <Save size={13} /> Create Competition
            </LoadingButton>
          </div>
        </form>
      </div>
    </>
  );
}

// ── Small UI helpers ─────────────────────────────────────────────────────────

function Field({
  label, required, error, children,
}: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 5 }}>
        {label} {required && <span style={{ color: "var(--red)" }}>*</span>}
      </label>
      {children}
      {error && (
        <div style={{ fontSize: 11, color: "var(--red)", marginTop: 4 }}>
          {error}
        </div>
      )}
    </div>
  );
}

function Pill({
  active, onClick, label, hint,
}: { active: boolean; onClick: () => void; label: string; hint: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        background: active ? "var(--blue-light)" : "var(--bg-secondary)",
        color:      active ? "var(--blue)"        : "var(--text-secondary)",
        border:     `1px solid ${active ? "var(--blue)" : "var(--border)"}`,
        borderRadius: 6,
        padding: "10px 12px",
        cursor: "pointer",
        textAlign: "left",
        transition: "all 120ms ease",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{hint}</div>
    </button>
  );
}
