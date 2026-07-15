"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import { Code2, Trophy, BookOpenCheck } from "lucide-react";
import { fetchProblemsPage, getCompetitions } from "@/lib/api";
import { ModeCard } from "@/components/ui/ModeCard";

// ── Stats ────────────────────────────────────────────────────────────────────

interface ProblemStats {
  problems: number;
  easy: number;
  medium: number;
  hard: number;
  competitions: number;
}

function useProblemStats() {
  const [stats, setStats] = useState<ProblemStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      fetchProblemsPage({ page: 0, size: 1 }),
      fetchProblemsPage({ page: 0, size: 1, difficulty: "EASY" }),
      fetchProblemsPage({ page: 0, size: 1, difficulty: "MEDIUM" }),
      fetchProblemsPage({ page: 0, size: 1, difficulty: "HARD" }),
      getCompetitions(),
    ]).then(([all, easy, medium, hard, comps]) => {
      if (cancelled) return;
      const total = (r: typeof all) => (r.status === "fulfilled" ? r.value.totalElements : 0);
      setStats({
        problems: total(all),
        easy: total(easy),
        medium: total(medium),
        hard: total(hard),
        competitions: comps.status === "fulfilled" ? (comps.value as unknown[]).length : 0,
      });
    });
    return () => { cancelled = true; };
  }, []);

  return stats;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ProblemsLandingPage() {
  const stats = useProblemStats();

  const statItems = [
    { label: "Problems",     value: stats?.problems },
    { label: "Easy",         value: stats?.easy },
    { label: "Medium",       value: stats?.medium },
    { label: "Hard",         value: stats?.hard },
    { label: "Competitions", value: stats?.competitions },
  ];

  return (
    <>
      <Navbar />

      <div style={{ minHeight: "calc(100vh - 56px)", background: "var(--bg)", color: "var(--ink)" }}>
        {/* HERO ─────────────────────────────────────────────────────────── */}
        <section style={{ padding: "72px 24px 44px", textAlign: "center", maxWidth: 760, margin: "0 auto" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "var(--accent-dim)", border: "1px solid var(--accent-ring)",
            borderRadius: 999, padding: "5px 14px", fontSize: 11, fontWeight: 700,
            color: "var(--accent)", letterSpacing: "0.08em", textTransform: "uppercase",
            marginBottom: 22,
          }}>
            <BookOpenCheck size={12} /> Competitive Programming
          </div>

          <h1 style={{
            fontSize: 44, fontWeight: 800, color: "var(--ink)",
            letterSpacing: "-0.025em", lineHeight: 1.1, marginBottom: 14,
          }}>
            Code. Solve. Improve.
          </h1>
          <p style={{ fontSize: 16, color: "var(--ink-2)", margin: 0, lineHeight: 1.5 }}>
            Grind the problem bank at your own pace, or put your skills on the
            line in rated competitions.
          </p>
        </section>

        {/* MODE CARDS ───────────────────────────────────────────────────── */}
        <section style={{
          maxWidth: 980, margin: "0 auto", padding: "0 24px",
          display: "flex", gap: 20, flexWrap: "wrap", alignItems: "stretch",
        }}>
          <ModeCard
            href="/problems/practice"
            icon={<Code2 size={22} />}
            badge="Practice"
            title="Problem Bank"
            blurb="Hundreds of algorithmic problems with instant judging. Filter by difficulty, track your solves."
            points={[
              "Easy, Medium & Hard tiers",
              "Instant verdicts on submission",
              "Hints and visible test cases",
            ]}
            action="Browse Problems"
          />
          <ModeCard
            href="/competitions"
            icon={<Trophy size={22} />}
            badge="Compete"
            title="Competitions"
            blurb="Timed contests against the whole campus. Climb the scoreboard and earn your rank."
            points={[
              "Live scoreboard",
              "Penalty-based ranking",
              "Open and invite-only contests",
            ]}
            action="View Competitions"
          />
        </section>

        {/* STATS ────────────────────────────────────────────────────────── */}
        <section style={{ maxWidth: 980, margin: "0 auto", padding: "40px 24px 80px" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 1,
            background: "var(--line-2)",
            border: "1px solid var(--line-2)",
            borderRadius: "var(--r)",
            overflow: "hidden",
          }}>
            {statItems.map((s) => (
              <div key={s.label} style={{ background: "var(--surface)", padding: "18px 20px", textAlign: "center" }}>
                <div style={{
                  fontSize: 24, fontWeight: 800, color: "var(--ink)",
                  fontFamily: "var(--font-mono), ui-monospace, monospace",
                  minHeight: 30,
                }}>
                  {s.value ?? "—"}
                </div>
                <div style={{
                  fontSize: 11, fontWeight: 600, color: "var(--ink-3)",
                  letterSpacing: "0.06em", textTransform: "uppercase", marginTop: 4,
                }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
