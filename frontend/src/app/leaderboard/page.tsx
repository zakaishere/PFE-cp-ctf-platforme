"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { Trophy, Crown, Medal, Loader2 } from "lucide-react";
import {
  getLeaderboardGlobal, getLeaderboardCp, getLeaderboardCtf,
  type RankedLeaderboardEntry,
} from "@/lib/api";
import { useAuth } from "@/features/auth/contexts/AuthContext";
import { UserAvatar } from "@/components/ui/UserAvatar";

const MONO = "var(--font-mono), ui-monospace, monospace";

type Tab = "global" | "cp" | "ctf";

const TABS: { id: Tab; label: string }[] = [
  { id: "global", label: "Global" },
  { id: "cp",     label: "CP / Problems" },
  { id: "ctf",    label: "CTF" },
];

const FETCHERS: Record<Tab, () => Promise<RankedLeaderboardEntry[]>> = {
  global: () => getLeaderboardGlobal(),
  cp:     () => getLeaderboardCp(),
  ctf:    () => getLeaderboardCtf(),
};

const BADGE_STYLE: Record<string, { bg: string; color: string }> = {
  MASTER:       { bg: "var(--violet-soft)",  color: "var(--violet)" },
  EXPERT:       { bg: "var(--accent-dim)",   color: "var(--accent)" },
  INTERMEDIATE: { bg: "var(--warn-soft)",    color: "var(--warn)" },
  BEGINNER:     { bg: "var(--surface-2)",    color: "var(--ink-3)" },
};

// gold / silver / bronze
const MEDAL_COLORS = ["#f59e0b", "#94a3b8", "#cd7c3a"];

function RankCell({ rank }: { rank: number }) {
  if (rank <= 3) {
    const color = MEDAL_COLORS[rank - 1];
    const Icon = rank === 1 ? Crown : Medal;
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color, fontWeight: 800, fontFamily: MONO, fontSize: 14 }}>
        <Icon size={16} /> {rank}
      </span>
    );
  }
  return (
    <span style={{ color: "var(--ink-3)", fontFamily: MONO, fontSize: 13, fontWeight: 600 }}>
      {rank}
    </span>
  );
}

export default function LeaderboardPage() {
  const { userId } = useAuth();

  const [tab, setTab] = useState<Tab>("global");
  const [data, setData] = useState<Partial<Record<Tab, RankedLeaderboardEntry[]>>>({});
  const [loading, setLoading] = useState(true);

  // Restore tab from URL hash on mount
  useEffect(() => {
    const h = window.location.hash.replace("#", "");
    if (h === "cp" || h === "ctf" || h === "global") setTab(h);
  }, []);

  const switchTab = useCallback((t: Tab) => {
    setTab(t);
    window.history.replaceState(null, "", `#${t}`);
  }, []);

  // Fetch current tab (cached per tab)
  useEffect(() => {
    if (data[tab]) return;
    setLoading(true);
    let cancelled = false;
    FETCHERS[tab]()
      .then((rows) => { if (!cancelled) setData((d) => ({ ...d, [tab]: rows })); })
      .catch(() => { if (!cancelled) setData((d) => ({ ...d, [tab]: [] })); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tab, data]);

  const rows = data[tab];
  const myRow = userId ? rows?.find((r) => r.userId === userId) : undefined;

  return (
    <>
      <Navbar />

      <div style={{ minHeight: "calc(100vh - 56px)", background: "var(--bg)", color: "var(--ink)" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "44px 24px 80px" }}>

          {/* Header */}
          <div style={{ marginBottom: 22 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "var(--accent-dim)", border: "1px solid var(--accent-ring)",
              borderRadius: 999, padding: "4px 12px", fontSize: 11, fontWeight: 700,
              color: "var(--accent)", letterSpacing: "0.08em", textTransform: "uppercase",
              marginBottom: 14,
            }}>
              <Trophy size={12} /> Rankings
            </div>
            <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em", margin: 0 }}>
              Leaderboard
            </h1>
            <p style={{ fontSize: 14, color: "var(--ink-2)", margin: "6px 0 0" }}>
              Global combines CP and CTF scores. Switch tabs to see each discipline.
            </p>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--line-2)", marginBottom: 20 }}>
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => switchTab(t.id)}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    padding: "10px 16px", fontSize: 14, fontWeight: 700,
                    color: active ? "var(--accent)" : "var(--ink-3)",
                    borderBottom: `2px solid ${active ? "var(--accent)" : "transparent"}`,
                    marginBottom: -1,
                    transition: "color .15s",
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Table */}
          {loading && !rows ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
              <Loader2 size={28} style={{ animation: "spin 1s linear infinite", color: "var(--accent)" }} />
            </div>
          ) : !rows || rows.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "64px 0", color: "var(--ink-3)",
              border: "1px dashed var(--line-2)", borderRadius: 16,
            }}>
              <Trophy size={32} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
              <p style={{ fontSize: 14, margin: 0 }}>No one is ranked here yet — be the first.</p>
            </div>
          ) : (
            <>
              <div style={{
                background: "var(--surface)", border: "1px solid var(--line-2)",
                borderRadius: 16, overflow: "hidden",
              }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--line-2)" }}>
                      {["Rank", "User", "Score", "Solved", "Badge"].map((h, i) => (
                        <th key={h} style={{
                          padding: "12px 18px", textAlign: i >= 2 && i <= 3 ? "right" : "left",
                          fontSize: 11, fontWeight: 700, color: "var(--ink-3)",
                          letterSpacing: "0.06em", textTransform: "uppercase",
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const me = userId != null && r.userId === userId;
                      const badge = BADGE_STYLE[r.badge] ?? BADGE_STYLE.BEGINNER;
                      return (
                        <tr
                          key={r.userId}
                          style={{
                            borderBottom: "1px solid var(--line)",
                            background: me ? "var(--accent-dim)" : "transparent",
                            boxShadow: me ? "inset 2px 0 0 var(--accent)" : "none",
                          }}
                        >
                          <td style={{ padding: "12px 18px", width: 80 }}>
                            <RankCell rank={r.rank} />
                          </td>
                          <td style={{ padding: "12px 18px", fontWeight: 600 }}>
                            <Link
                              href={`/profile/u/${r.username}`}
                              style={{ display: "inline-flex", alignItems: "center", gap: 10, color: "var(--ink)", textDecoration: "none" }}
                            >
                              <UserAvatar avatarId={r.avatarId} name={r.fullName} size={26} />
                              {r.fullName}
                            </Link>
                            {me && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: "var(--accent)" }}>you</span>}
                          </td>
                          <td style={{
                            padding: "12px 18px", textAlign: "right",
                            fontFamily: MONO, fontWeight: 700, color: "var(--accent)",
                          }}>
                            {r.score.toLocaleString()}
                          </td>
                          <td style={{ padding: "12px 18px", textAlign: "right", fontFamily: MONO, color: "var(--ink-2)" }}>
                            {r.solved}
                          </td>
                          <td style={{ padding: "12px 18px", width: 140 }}>
                            <span style={{
                              fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
                              background: badge.bg, color: badge.color,
                              borderRadius: 20, padding: "3px 10px",
                            }}>
                              {r.badge}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {userId && !myRow && (
                <div style={{
                  marginTop: 16, padding: "12px 18px",
                  background: "var(--surface)", border: "1px solid var(--line-2)",
                  borderRadius: 12, fontSize: 13, color: "var(--ink-2)",
                }}>
                  You haven&apos;t solved any challenges yet — start practicing to appear here.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
