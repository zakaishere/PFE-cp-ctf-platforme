"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import { Trophy, Loader2, Medal } from "lucide-react";
import { getLeaderboard, type LeaderboardEntry } from "@/lib/api";
import { useAuth } from "@/features/auth/contexts/AuthContext";

const MEDAL_COLORS = ["#f5c451", "#c7cdd9", "#cd8a52"]; // gold, silver, bronze
const AVATAR_COLORS = ["var(--brand)","#6554c0","#00875a","#ff5630","var(--warn)","#36b37e","#00b8d9","#de350b"];

function levelFor(pts: number) {
  if (pts >= 300) return { label: "Advanced",     className: "badge-purple" };
  if (pts >= 150) return { label: "Intermediate", className: "badge-blue"   };
  return              { label: "Beginner",       className: "badge-gray"   };
}

export default function LeaderboardPage() {
  const { userId } = useAuth();
  const [rows, setRows] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    getLeaderboard()
      .then(setRows)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = rows.filter((r) =>
    `${r.firstName} ${r.lastName}`.toLowerCase().includes(search.toLowerCase())
  );

  const podium = filtered.slice(0, 3);

  return (
    <>
      <Navbar />
      <div className="psp-main">
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
            <Trophy size={20} color="var(--warn)" /> Leaderboard
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>Top students ranked by total points</div>
        </div>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
            <Loader2 size={28} style={{ animation: "spin 1s linear infinite", color: "var(--brand)" }} />
          </div>
        ) : (
          <>
            {/* Podium — silver | gold | bronze */}
            {podium.length >= 3 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20 }}>
                {[podium[1], podium[0], podium[2]].map((p, i) => {
                  const borders = ["#c7cdd9","#f5c451","#cd8a52"]; // silver, gold, bronze
                  const color = AVATAR_COLORS[rows.indexOf(p) % AVATAR_COLORS.length];
                  const ini = `${p.firstName.charAt(0)}${p.lastName.charAt(0)}`.toUpperCase();
                  return (
                    <div key={p.studentId} style={{ background: "var(--surface)", border: `1px solid ${borders[i]}`, borderTop: `3px solid ${borders[i]}`, borderRadius: "var(--r)", padding: 20, textAlign: "center" }}>
                      <Medal size={30} color={borders[i]} style={{ marginBottom: 8 }} />
                      <div style={{ width: 52, height: 52, borderRadius: "50%", background: color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: "white", margin: "0 auto 10px" }}>{ini}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{p.firstName} {p.lastName}</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: "var(--blue)" }}>{p.totalPoints} pts</div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Full table */}
            <div className="psp-card">
              <div className="psp-card-header">
                <span className="psp-card-title">Full Rankings</span>
                <input className="psp-search" placeholder="Search student…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <table className="psp-table">
                <thead>
                  <tr><th>Rank</th><th>Student</th><th>Points</th><th>Level</th></tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => {
                    const lv = levelFor(r.totalPoints);
                    const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
                    const ini = `${r.firstName.charAt(0)}${r.lastName.charAt(0)}`.toUpperCase();
                    const isMe = r.studentId === userId;
                    return (
                      <tr key={r.studentId} className={isMe ? "lb-me" : ""}>
                        <td>
                          {i < 3 ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13 }}>
                              <Medal size={15} color={MEDAL_COLORS[i]} /> {i + 1}
                            </span>
                          ) : (
                            <span style={{ fontWeight: 700, color: "var(--text-muted)", fontSize: 13 }}>{i + 1}</span>
                          )}
                        </td>
                        <td style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px" }}>
                          <div style={{ width: 28, height: 28, borderRadius: "50%", background: color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "white", flexShrink: 0 }}>{ini}</div>
                          {r.firstName} {r.lastName}
                          {isMe && <span className="badge badge-blue" style={{ fontSize: 10, padding: "1px 6px" }}>You</span>}
                        </td>
                        <td style={{ fontWeight: 700, color: "var(--blue)" }}>{r.totalPoints}</td>
                        <td>
                          <span className={`badge ${lv.className}`}>{lv.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={4} style={{ textAlign: "center", color: "var(--text-muted)", padding: 24, fontSize: 13 }}>No rankings yet — solve practice problems to earn points and appear here.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  );
}
