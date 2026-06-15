"use client";

import { useState, useRef } from "react";
import { APP_NAME } from "@/lib/brand";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { useInfiniteProblems } from "@/hooks/useInfiniteProblems";
import { ProblemRowSkeleton } from "@/components/problems/ProblemRowSkeleton";

const DIFFICULTIES = ["", "EASY", "MEDIUM", "HARD"] as const;

const difficultyColor = (d: string) =>
  ({ EASY: "b-easy", MEDIUM: "b-med", HARD: "b-hard" }[d] ?? "b-easy");

const difficultyLabel = (d: string) =>
  ({ EASY: "Easy", MEDIUM: "Medium", HARD: "Hard" }[d] ?? d);

export default function ProblemsPage() {
  const [search, setSearch]         = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [liveSearch, setLiveSearch] = useState("");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setLiveSearch(val);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setSearch(val), 350);
  }

  const { problems, loading, initialLoad, error, hasMore, totalElements, sentinelRef } =
    useInfiniteProblems({ search, difficulty });

  return (
    <>
      <Navbar />
      <div className="psp-breadcrumb">
        <Link href="/dashboard">{APP_NAME}</Link> › <span style={{ color: "var(--text-primary)" }}>Problems</span>
      </div>
      <div className="psp-main">
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)" }}>Problem Set</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
            {totalElements > 0 ? `${totalElements} problems` : "Practice on public problems and earn points"}
          </div>
        </div>

        <div className="psp-card">
          {/* Filter bar */}
          <div className="psp-card-header" style={{ flexWrap: "wrap", gap: 8 }}>
            <input
              className="psp-search"
              placeholder="Search problems…"
              value={liveSearch}
              onChange={handleSearchChange}
            />
            <div className="psp-filter-bar" style={{ margin: 0 }}>
              {DIFFICULTIES.map(d => (
                <button
                  key={d}
                  className={`psp-ftab${difficulty === d ? " on" : ""}`}
                  onClick={() => setDifficulty(d)}
                >
                  {d ? difficultyLabel(d) : "All"}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <table className="psp-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Status</th>
                <th>Title</th>
                <th>Difficulty</th>
                <th>Pass Rate</th>
                <th>Submissions</th>
                <th>Points</th>
              </tr>
            </thead>
            <tbody>
              {initialLoad && Array.from({ length: 15 }).map((_, i) => (
                <ProblemRowSkeleton key={i} />
              ))}

              {!initialLoad && problems.map((p, idx) => (
                <tr key={p.problemId}>
                  <td className="td-muted">{idx + 1}</td>
                  <td>
                    {p.solvedByCurrentUser
                      ? <span style={{ color: "#00875a", fontWeight: 700 }}>✓</span>
                      : <span style={{ color: "var(--border)" }}>○</span>}
                  </td>
                  <td>
                    <Link href={`/problems/${p.problemId}`} className="td-link">
                      {p.title}
                    </Link>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                      By {p.authorName}
                    </div>
                  </td>
                  <td>
                    <span className={`psp-badge ${difficultyColor(p.difficulty)}`}>
                      {difficultyLabel(p.difficulty)}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 56, height: 4, background: "var(--border)", borderRadius: 2 }}>
                        <div style={{ width: `${p.passRate}%`, height: "100%", background: "var(--brand)", borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.passRate.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="td-muted">{p.submissionCount.toLocaleString()}</td>
                  <td className="td-muted">{p.points} pts</td>
                </tr>
              ))}

              {!initialLoad && loading && Array.from({ length: 5 }).map((_, i) => (
                <ProblemRowSkeleton key={`skel-${i}`} />
              ))}
            </tbody>
          </table>

          {/* Empty state */}
          {!initialLoad && !loading && problems.length === 0 && (
            <div className="psp-empty">
              <div className="psp-empty-title">No problems found</div>
              <div>Try adjusting your search or filters.</div>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div style={{ textAlign: "center", padding: "24px 16px", color: "#de350b", fontSize: 13 }}>
              {error} —{" "}
              <button onClick={() => window.location.reload()} style={{ background: "none", border: "none", color: "var(--brand)", cursor: "pointer", textDecoration: "underline" }}>
                Retry
              </button>
            </div>
          )}

          {/* End of list */}
          {!hasMore && problems.length > 0 && (
            <div style={{ textAlign: "center", padding: "12px 0", fontSize: 12, color: "var(--text-muted)" }}>
              All {totalElements} problems loaded
            </div>
          )}
        </div>

        {/* Invisible sentinel — triggers next page load */}
        <div ref={sentinelRef} style={{ height: 1 }} />
      </div>
    </>
  );
}
