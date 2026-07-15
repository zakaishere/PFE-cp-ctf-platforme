"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import { Trophy, Target, Flag } from "lucide-react";
import {
  getCtfCompetitions,
  getCTFChallenges,
} from "@/lib/api";
import { ModeCard } from "@/components/ui/ModeCard";

// ── Stats ────────────────────────────────────────────────────────────────────

interface CTFStats {
  competitions: number;
  liveNow: number;
  challenges: number;
  categories: number;
}

function useCtfStats() {
  const [stats, setStats] = useState<CTFStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([getCtfCompetitions(), getCTFChallenges()]).then(
      ([comps, chals]) => {
        if (cancelled) return;
        const competitions = comps.status === "fulfilled" ? comps.value : [];
        const challenges = chals.status === "fulfilled" ? chals.value : [];
        setStats({
          competitions: competitions.length,
          liveNow: competitions.filter((c) => c.started && !c.ended).length,
          challenges: challenges.length,
          categories: new Set(challenges.map((c) => c.category)).size,
        });
      }
    );
    return () => { cancelled = true; };
  }, []);

  return stats;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CTFLandingPage() {
  const stats = useCtfStats();

  const statItems = [
    { label: "Competitions", value: stats?.competitions },
    { label: "Live now",     value: stats?.liveNow },
    { label: "Challenges",   value: stats?.challenges },
    { label: "Categories",   value: stats?.categories },
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
            <Flag size={12} /> Capture The Flag
          </div>

          <h1 style={{
            fontSize: 44, fontWeight: 800, color: "var(--ink)",
            letterSpacing: "-0.025em", lineHeight: 1.1, marginBottom: 14,
          }}>
            Hack. Learn. Capture.
          </h1>
          <p style={{ fontSize: 16, color: "var(--ink-2)", margin: 0, lineHeight: 1.5 }}>
            Compete against other teams in timed events, or sharpen your skills
            at your own pace on standalone challenges.
          </p>
        </section>

        {/* MODE CARDS ───────────────────────────────────────────────────── */}
        <section style={{
          maxWidth: 980, margin: "0 auto", padding: "0 24px",
          display: "flex", gap: 20, flexWrap: "wrap", alignItems: "stretch",
        }}>
          <ModeCard
            href="/ctf/competitions"
            icon={<Trophy size={22} />}
            badge="Compete"
            title="Competitions"
            blurb="Timed team events with a live scoreboard. Join with an access code or browse open competitions."
            points={[
              "Team-based, live scoreboard",
              "Dynamic or static scoring",
              "First bloods & prizes",
            ]}
            action="Browse Competitions"
          />
          <ModeCard
            href="/ctf/practice"
            icon={<Target size={22} />}
            badge="Practice"
            title="CTF Practice"
            blurb="Standalone challenges across every category. No timer, no team required — solve at your own pace."
            points={[
              "Web, Pwn, Crypto, Forensics & more",
              "Hints when you're stuck",
              "Track your solves",
            ]}
            action="Start Practicing"
          />
        </section>

        {/* STATS ────────────────────────────────────────────────────────── */}
        <section style={{
          maxWidth: 980, margin: "0 auto", padding: "40px 24px 80px",
        }}>
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
