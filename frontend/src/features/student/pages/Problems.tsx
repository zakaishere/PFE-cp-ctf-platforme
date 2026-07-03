"use client";

import { useState, useRef } from "react";
import { Check, Search } from "lucide-react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { useInfiniteProblems } from "@/hooks/useInfiniteProblems";

const DIFFICULTIES = ["", "EASY", "MEDIUM", "HARD"] as const;
type Difficulty = typeof DIFFICULTIES[number];

const diffLabel = (d: string) =>
  ({ EASY: "Easy", MEDIUM: "Medium", HARD: "Hard" }[d] ?? d);

const diffColor = (d: string) =>
  ({ EASY: "var(--accent)", MEDIUM: "var(--warn)", HARD: "var(--danger)" }[d] ?? "var(--ink-2)");

type SolvedFilter = "all" | "solved" | "unsolved";

export default function ProblemsPage() {
  const [search, setSearch]           = useState("");
  const [difficulty, setDifficulty]   = useState<Difficulty>("");
  const [solvedFilter, setSolvedFilter] = useState<SolvedFilter>("all");
  const [liveSearch, setLiveSearch]   = useState("");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setLiveSearch(val);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setSearch(val), 350);
  }

  const { problems, loading, initialLoad, error, hasMore, totalElements, sentinelRef } =
    useInfiniteProblems({ search, difficulty });

  const solvedCount = problems.filter(p => p.solvedByCurrentUser).length;

  const visible = problems.filter(p => {
    if (solvedFilter === "solved"   && !p.solvedByCurrentUser) return false;
    if (solvedFilter === "unsolved" &&  p.solvedByCurrentUser) return false;
    return true;
  });

  const COL = "32px 1fr 100px 160px 70px";

  return (
    <>
      <Navbar />
      <div className="psp-main">
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)" }}>Problem Set</div>
            {solvedCount > 0 && (
              <span style={{ fontSize: 12, color: "var(--ink-3)" }}>{solvedCount} solved</span>
            )}
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 3 }}>
            {totalElements > 0 ? `${totalElements} problems available` : "Practice on public problems and earn points"}
          </div>
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r)", overflow: "hidden" }}>

          {/* Toolbar */}
          <div style={{ padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: "0 0 200px" }}>
              <Search size={12} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "var(--ink-3)", pointerEvents: "none" }} />
              <input className="psp-search" style={{ paddingLeft: 26, width: "100%" }} placeholder="Search problems…" value={liveSearch} onChange={handleSearchChange} />
            </div>
            {/* Difficulty segmented group */}
            <div style={{ display: "inline-flex", background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: 9, padding: 3, gap: 2 }}>
              {DIFFICULTIES.map(d => (
                <button key={d} onClick={() => setDifficulty(d)} style={{ padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: difficulty === d ? 600 : 400, background: difficulty === d ? "var(--surface-3)" : "transparent", color: difficulty === d ? "var(--ink)" : "var(--ink-3)", transition: "all 0.1s" }}>
                  {d ? diffLabel(d) : "All Difficulties"}
                </button>
              ))}
            </div>
            {/* Solved segmented group */}
            <div style={{ display: "inline-flex", background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: 9, padding: 3, gap: 2 }}>
              {(["all", "solved", "unsolved"] as const).map(s => (
                <button key={s} onClick={() => setSolvedFilter(s)} style={{ padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: solvedFilter === s ? 600 : 400, background: solvedFilter === s ? "var(--surface-3)" : "transparent", color: solvedFilter === s ? "var(--ink)" : "var(--ink-3)", transition: "all 0.1s" }}>
                  {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Column headers */}
          <div style={{ display: "grid", gridTemplateColumns: COL, padding: "7px 16px", background: "var(--bg-2)", borderBottom: "1px solid var(--line)" }}>
            {(["", "Problem", "Difficulty", "Pass Rate", "Points"] as const).map((h, i) => (
              <div key={i} style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {h}
              </div>
            ))}
          </div>

          {/* Loading skeletons */}
          {initialLoad && Array.from({ length: 15 }).map((_, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: COL, padding: "12px 16px", borderBottom: "1px solid var(--line)", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "center" }}><div className="skel" style={{ width: 18, height: 18, borderRadius: "50%" }} /></div>
              <div><div className="skel" style={{ width: "50%", height: 13, borderRadius: 3, marginBottom: 5 }} /><div className="skel" style={{ width: "28%", height: 10, borderRadius: 3 }} /></div>
              <div className="skel" style={{ width: 52, height: 13, borderRadius: 3 }} />
              <div className="skel" style={{ width: 80, height: 8, borderRadius: 4 }} />
              <div className="skel" style={{ width: 36, height: 12, borderRadius: 3 }} />
            </div>
          ))}

          {/* Rows */}
          {!initialLoad && visible.map(p => {
            const dc = diffColor(p.difficulty);
            return (
              <Link
                key={p.problemId}
                href={`/problems/${p.problemId}`}
                style={{ display: "grid", gridTemplateColumns: COL, padding: "11px 16px", borderBottom: "1px solid var(--line)", alignItems: "center", textDecoration: "none", transition: "background 0.1s" }}
                onMouseOver={e => (e.currentTarget.style.background = "var(--surface-2)")}
                onMouseOut={e => (e.currentTarget.style.background = "")}
              >
                {/* Col 1: solved dot */}
                <div style={{ display: "flex", justifyContent: "center" }}>
                  {p.solvedByCurrentUser ? (
                    <div style={{ width: 18, height: 18, borderRadius: "50%", background: "var(--success-soft)", border: "1.5px solid var(--success)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Check size={9} color="var(--success)" />
                    </div>
                  ) : (
                    <div style={{ width: 18, height: 18, borderRadius: "50%", border: "1.5px solid var(--line-strong)" }} />
                  )}
                </div>

                {/* Col 2: title */}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 2 }}>
                    {p.title}
                  </div>
                  {p.authorName && (
                    <div style={{ fontSize: 11, color: "var(--ink-3)" }}>by {p.authorName}</div>
                  )}
                </div>

                {/* Col 3: difficulty */}
                <div style={{ fontSize: 13, fontFamily: "ui-monospace, monospace", fontWeight: 600, color: dc }}>
                  {diffLabel(p.difficulty)}
                </div>

                {/* Col 4: pass rate bar */}
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <div style={{ flex: 1, height: 4, background: "var(--line)", borderRadius: 2, maxWidth: 80 }}>
                    <div style={{ width: `${Math.min(p.passRate ?? 0, 100)}%`, height: "100%", background: "var(--brand)", borderRadius: 2 }} />
                  </div>
                  <span style={{ fontSize: 11, color: "var(--ink-3)", flexShrink: 0 }}>{(p.passRate ?? 0).toFixed(0)}%</span>
                </div>

                {/* Col 5: points */}
                <div style={{ fontSize: 13, color: "var(--ink-3)" }}>{p.points} pts</div>
              </Link>
            );
          })}

          {/* More loading */}
          {!initialLoad && loading && Array.from({ length: 5 }).map((_, i) => (
            <div key={`more-${i}`} style={{ display: "grid", gridTemplateColumns: COL, padding: "12px 16px", borderBottom: "1px solid var(--line)", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "center" }}><div className="skel" style={{ width: 18, height: 18, borderRadius: "50%" }} /></div>
              <div className="skel" style={{ width: "40%", height: 13, borderRadius: 3 }} />
              <div className="skel" style={{ width: 52, height: 13, borderRadius: 3 }} />
              <div className="skel" style={{ width: 80, height: 8, borderRadius: 4 }} />
              <div className="skel" style={{ width: 36, height: 12, borderRadius: 3 }} />
            </div>
          ))}

          {/* Empty */}
          {!initialLoad && !loading && visible.length === 0 && (
            <div className="psp-empty" style={{ padding: "32px 24px" }}>
              <Search size={28} color="var(--ink-3)" style={{ margin: "0 auto 12px" }} />
              <div className="psp-empty-title">No problems match your filters</div>
              <div>Try adjusting the difficulty or status.</div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ textAlign: "center", padding: "24px 16px", color: "var(--danger)", fontSize: 13 }}>
              {error} —{" "}
              <button onClick={() => window.location.reload()} style={{ background: "none", border: "none", color: "var(--brand)", cursor: "pointer", textDecoration: "underline" }}>
                Retry
              </button>
            </div>
          )}

          {/* End of list */}
          {!hasMore && problems.length > 0 && (
            <div style={{ textAlign: "center", padding: "12px 0", fontSize: 12, color: "var(--ink-3)" }}>
              All {totalElements} problems loaded
            </div>
          )}
        </div>

        {/* Sentinel for infinite scroll */}
        <div ref={sentinelRef} style={{ height: 1 }} />
      </div>
    </>
  );
}
