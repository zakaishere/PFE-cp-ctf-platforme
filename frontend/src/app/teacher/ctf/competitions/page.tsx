"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { Plus, Trophy, Clock, Users, Zap, Lock, Edit2 } from "lucide-react";
import Spinner from "@/components/ui/Spinner";
import { toast } from "@/components/ui/PSPToast";
import {
  listTeacherCtfCompetitions,
  type CTFCompetitionDTO,
} from "@/lib/api";

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function statusBadge(c: CTFCompetitionDTO) {
  if (c.ended) {
    return { label: "ENDED",    bg: "rgba(148,163,184,0.12)", fg: "#94a3b8", border: "rgba(148,163,184,0.3)" };
  }
  if (c.started) {
    return { label: "LIVE",     bg: "rgba(16,185,129,0.12)",  fg: "#34d399", border: "rgba(16,185,129,0.35)" };
  }
  return   { label: "UPCOMING", bg: "rgba(96,165,250,0.12)",  fg: "#60a5fa", border: "rgba(96,165,250,0.35)" };
}

export default function TeacherCTFCompetitionsPage() {
  const [list, setList] = useState<CTFCompetitionDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listTeacherCtfCompetitions()
      .then(setList)
      .catch(() => toast.error("Failed to load competitions", "Could not fetch your CTF competitions."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Navbar />
      <div className="psp-breadcrumb">
        <Link href="/teacher">PSP</Link> ›{" "}
        <Link href="/teacher/ctf">CTF</Link> ›{" "}
        <span style={{ color: "var(--text-primary)" }}>Competitions</span>
      </div>

      <div className="psp-main">
        <div style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 22,
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Trophy size={20} color="#a78bfa" />
              <span style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>
                My Competitions
              </span>
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
              Create and manage CTF competitions. Each competition holds its own set of challenges and teams.
            </div>
          </div>
          <Link href="/teacher/ctf/competitions/new">
            <button className="psp-btn psp-btn-secondary" style={{ gap: 6 }}>
              <Plus size={14} /> New Competition
            </button>
          </Link>
        </div>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
            <Spinner size={28} />
          </div>
        ) : list.length === 0 ? (
          <div className="psp-empty">
            <Trophy size={36} style={{ margin: "0 auto 10px", color: "var(--text-subtle)" }} />
            <div className="psp-empty-title">No competitions yet</div>
            <div>Create your first CTF competition to get started.</div>
            <div style={{ marginTop: 14 }}>
              <Link href="/teacher/ctf/competitions/new">
                <button className="psp-btn psp-btn-primary" style={{ gap: 6 }}>
                  <Plus size={14} /> Create Competition
                </button>
              </Link>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 14 }}>
            {list.map((c) => {
              const b = statusBadge(c);
              return (
                <div
                  key={c.id}
                  className="psp-card"
                  style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{
                      background: b.bg, color: b.fg, border: `1px solid ${b.border}`,
                      borderRadius: 4, padding: "2px 8px", fontSize: 10, fontWeight: 700, letterSpacing: "0.05em",
                    }}>{b.label}</span>
                    {c.visibility !== "PUBLIC" && (
                      <span style={{ fontSize: 11, color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: 3 }}>
                        <Lock size={11} /> {c.visibility.replace("_", " ")}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{c.title}</div>
                  {c.description && (
                    <div style={{
                      fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5,
                      overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                    }}>
                      {c.description}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: "var(--text-muted)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                    <span><Clock size={10} style={{ display: "inline", verticalAlign: -1, marginRight: 4 }} />{fmtDateTime(c.startTime)}</span>
                    <span><Clock size={10} style={{ display: "inline", verticalAlign: -1, marginRight: 4 }} />{fmtDateTime(c.endTime)}</span>
                    <span><Users size={10} style={{ display: "inline", verticalAlign: -1, marginRight: 4 }} />Max {c.maxTeamSize}</span>
                    <span><Zap size={10} style={{ display: "inline", verticalAlign: -1, marginRight: 4 }} />{c.scoringMode}</span>
                  </div>
                  <div style={{
                    display: "flex", justifyContent: "flex-end", gap: 8,
                    paddingTop: 8, borderTop: "1px solid var(--border)", marginTop: 4,
                  }}>
                    <Link href={`/ctf/competitions/${c.id}`} className="psp-btn psp-btn-secondary psp-btn-sm" style={{ gap: 4 }}>
                      View
                    </Link>
                    <Link href={`/teacher/ctf/${c.id}/manage?tab=settings`} className="psp-btn psp-btn-secondary psp-btn-sm" style={{ gap: 4 }}>
                      <Edit2 size={11} /> Manage
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
