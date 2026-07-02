"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { KeyRound, ArrowRight, Trophy, Zap, AlertCircle, X, Lock, Unlock } from "lucide-react";
import {
  getCtfCompetitions,
  joinCtfByAccessCode,
  type CTFCompetitionDTO,
} from "@/lib/api";
import { EventCard, type EventStatus } from "@/components/ui/EventCard";

// ── Status mapping ───────────────────────────────────────────────────────────

function ctfStatus(comp: CTFCompetitionDTO): EventStatus {
  if (comp.ended || comp.status === "ENDED") return "ended";
  if (comp.started) return "live";
  return "scheduled";
}

// ── Access code modal ────────────────────────────────────────────────────────

function AccessCodeModal({ comp, onClose, onSuccess }: {
  comp: CTFCompetitionDTO;
  onClose: () => void;
  onSuccess: (id: string) => void;
}) {
  const [code, setCode] = useState("");
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function handleSubmit() {
    const trimmed = code.trim();
    if (!trimmed) { setError("Enter the access code."); return; }
    setError(null);
    setValidating(true);
    try {
      const joined = await joinCtfByAccessCode(trimmed);
      onSuccess(joined.id);
    } catch {
      setError("Invalid access code. Please try again.");
      setCode("");
      inputRef.current?.focus();
    } finally {
      setValidating(false);
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 999,
      background: "rgba(0,0,0,0.65)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={onClose}>
      <div style={{
        background: "var(--surface)", border: "1px solid var(--line-2)", borderRadius: "var(--r)",
        padding: 28, width: "100%", maxWidth: 380, position: "relative",
      }} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} style={{
          position: "absolute", top: 14, right: 14,
          background: "transparent", border: "none", cursor: "pointer", color: "var(--ink-3)",
          display: "flex", alignItems: "center",
        }}>
          <X size={18} />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <KeyRound size={16} color="var(--accent)" />
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>Access Code Required</span>
        </div>
        <p style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 18 }}>
          &ldquo;{comp.title}&rdquo; requires an access code to enter.
        </p>

        <input
          ref={inputRef}
          type="text"
          value={code}
          onChange={(e) => { setError(null); setCode(e.target.value.toUpperCase().replace(/\s+/g, "")); }}
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); if (e.key === "Escape") onClose(); }}
          placeholder="ENTER CODE"
          maxLength={30}
          disabled={validating}
          style={{
            width: "100%", boxSizing: "border-box",
            background: "var(--bg-2)", border: `1px solid ${error ? "var(--danger)" : "var(--line-2)"}`,
            borderRadius: 8, padding: "12px 16px", color: "var(--ink)",
            fontFamily: "var(--font-mono), ui-monospace, monospace",
            fontSize: 16, fontWeight: 600, letterSpacing: "0.08em",
            outline: "none", marginBottom: 12,
          }}
        />

        {error && (
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            color: "var(--danger)", fontSize: 13, marginBottom: 12,
          }}>
            <AlertCircle size={13} /> {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} disabled={validating} style={{
            flex: 1, padding: "10px 0", background: "transparent",
            border: "1px solid var(--line-2)", borderRadius: 8, color: "var(--ink-2)",
            fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>
            Cancel
          </button>
          <LoadingButton
            loading={validating}
            onClick={handleSubmit}
            disabled={!code.trim()}
            style={{
              flex: 2, padding: "10px 0",
              background: "var(--accent)",
              border: "none", borderRadius: 8, color: "#0a0a0a",
              fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}
          >
            Enter
          </LoadingButton>
        </div>
      </div>
    </div>
  );
}

// ── Open Competition Card (EventCard wrapper) ─────────────────────────────────

function CtfEventCard({ comp }: { comp: CTFCompetitionDTO }) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const ended = comp.ended || comp.status === "ENDED";
  const isCode = comp.visibility === "ACCESS_CODE";

  const enter = () => {
    if (isCode && !ended) setShowModal(true);
    else router.push(`/ctf/competitions/${comp.id}`);
  };

  const meta1 = `${comp.scoringMode === "DYNAMIC" ? "Dynamic" : "Static"} scoring · Max ${comp.maxTeamSize}/team`;
  const meta2 = isCode ? "Access code required" : "Open to all";

  return (
    <>
      {showModal && (
        <AccessCodeModal
          comp={comp}
          onClose={() => setShowModal(false)}
          onSuccess={(id) => router.push(`/ctf/competitions/${id}`)}
        />
      )}
      <EventCard
        type="ctf"
        title={comp.title}
        status={ctfStatus(comp)}
        meta1={meta1}
        meta2={meta2}
        meta1Icon={Zap}
        meta2Icon={isCode ? Lock : Unlock}
        action={ended ? "View results" : "Enter competition"}
        onClick={enter}
      />
    </>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CTFEntryPage() {
  const router = useRouter();

  const [accessCode, setAccessCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);

  const [competitions, setCompetitions] = useState<CTFCompetitionDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getCtfCompetitions()
      .then(setCompetitions)
      .catch(() => setCompetitions([]))
      .finally(() => setLoading(false));
  }, []);

  const open = useMemo(
    () => competitions.filter((c) => !c.ended).slice(0, 6),
    [competitions]
  );

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const code = accessCode.trim();
    if (!code) {
      setAccessError("Please enter an access code.");
      return;
    }
    setAccessError(null);
    setSubmitting(true);
    try {
      const comp = await joinCtfByAccessCode(code);
      router.push(`/ctf/competitions/${comp.id}`);
    } catch {
      setAccessError("Invalid or expired access code.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Navbar />

      <div style={{ minHeight: "calc(100vh - 56px)", background: "var(--bg)", color: "var(--ink)" }}>
        {/* HERO ── access code entry ─────────────────────────────────────── */}
        <section style={{
          padding: "72px 24px 40px",
          textAlign: "center",
          maxWidth: 720,
          margin: "0 auto",
        }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "var(--accent-dim)", border: "1px solid var(--accent-ring)",
            borderRadius: 999, padding: "5px 14px", fontSize: 11, fontWeight: 700,
            color: "var(--accent)", letterSpacing: "0.08em", textTransform: "uppercase",
            marginBottom: 22,
          }}>
            <Trophy size={12} /> CTF Arena
          </div>

          <h1 style={{
            fontSize: 44, fontWeight: 800, color: "var(--ink)",
            letterSpacing: "-0.025em", lineHeight: 1.1, marginBottom: 14,
          }}>
            CTF Competitions
          </h1>
          <p style={{ fontSize: 16, color: "var(--ink-2)", marginBottom: 36, lineHeight: 1.5 }}>
            Test your skills. Form a team. Compete.
          </p>

          {/* Access code box */}
          <form
            onSubmit={handleSubmit}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line-2)",
              borderRadius: "var(--r)",
              padding: 22,
              boxShadow: "var(--card-shadow)",
            }}
          >
            <div style={{
              display: "flex", alignItems: "center", gap: 8, marginBottom: 12,
              fontSize: 12, color: "var(--ink-2)", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase",
            }}>
              <KeyRound size={14} color="var(--accent)" />
              Enter competition access code
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <input
                type="text"
                value={accessCode}
                onChange={(e) => {
                  setAccessError(null);
                  setAccessCode(e.target.value.toUpperCase().replace(/\s+/g, ""));
                }}
                placeholder="WINTER2025"
                maxLength={30}
                autoComplete="off"
                spellCheck={false}
                style={{
                  flex: 1,
                  background: "var(--bg-2)",
                  border: `1px solid ${accessError ? "var(--danger)" : "var(--line-2)"}`,
                  borderRadius: 8,
                  padding: "13px 16px",
                  color: "var(--ink)",
                  fontFamily: "var(--font-mono), ui-monospace, monospace",
                  fontSize: 16,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  outline: "none",
                  transition: "border-color 150ms ease",
                }}
                onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = "var(--accent)"; }}
                onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = accessError ? "var(--danger)" : "var(--line-2)"; }}
              />
              <LoadingButton
                type="submit"
                loading={submitting}
                disabled={!accessCode.trim()}
                style={{
                  background: "var(--accent)",
                  color: "#0a0a0a",
                  border: "none",
                  borderRadius: 8,
                  padding: "0 22px",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  letterSpacing: "0.02em",
                  whiteSpace: "nowrap",
                }}
              >
                Enter <ArrowRight size={15} />
              </LoadingButton>
            </div>

            {accessError && (
              <div style={{
                marginTop: 12, display: "flex", alignItems: "center", gap: 6,
                color: "var(--danger)", fontSize: 13, fontWeight: 500,
              }}>
                <AlertCircle size={14} /> {accessError}
              </div>
            )}
          </form>

          {/* Divider */}
          <div style={{
            display: "flex", alignItems: "center", gap: 14, margin: "40px 0 24px",
            color: "var(--ink-3)", fontSize: 12, fontWeight: 600,
            textTransform: "uppercase", letterSpacing: "0.08em",
          }}>
            <span style={{ flex: 1, height: 1, background: "var(--line-2)" }} />
            or browse open competitions
            <span style={{ flex: 1, height: 1, background: "var(--line-2)" }} />
          </div>
        </section>

        {/* OPEN COMPETITIONS ─────────────────────────────────────────────── */}
        <section style={{
          maxWidth: 1100, margin: "0 auto", padding: "0 24px 80px",
        }}>
          {loading ? (
            <div className="card-grid">
              {[0, 1, 2].map((i) => (
                <div key={i} style={{
                  height: 260, background: "var(--surface)", border: "1px solid var(--line-2)",
                  borderRadius: "var(--r)", opacity: 0.5,
                }} />
              ))}
            </div>
          ) : open.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "48px 0", color: "var(--ink-2)",
              background: "var(--surface)", border: "1px dashed var(--line-2)", borderRadius: "var(--r)",
            }}>
              <Trophy size={36} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>
                No open competitions right now
              </div>
              <div style={{ fontSize: 13 }}>
                Got an access code? Enter it above to join a private competition.
              </div>
            </div>
          ) : (
            <>
              <div className="card-grid">
                {open.map((c) => <CtfEventCard key={c.id} comp={c} />)}
              </div>

              <div style={{ textAlign: "center", marginTop: 32 }}>
                <Link href="/ctf/competitions" style={{
                  color: "var(--ink-2)", fontSize: 13, fontWeight: 600, textDecoration: "none",
                  borderBottom: "1px solid var(--line-2)", paddingBottom: 2,
                }}>
                  See all competitions →
                </Link>
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}
