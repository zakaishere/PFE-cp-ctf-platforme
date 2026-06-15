"use client";

import { Lock, Lightbulb, ChevronDown, Clock, HardDrive, Inbox } from "lucide-react";
import { useState } from "react";
import type { ProblemDetailDTO, VisibleTestCaseDTO, MySubmissionDTO } from "@/lib/api";
import { getMySubmissions } from "@/lib/api";

// ── Loading skeleton ──────────────────────────────────────────────────────────
export function ProblemStatementSkeleton() {
  return (
    <div style={{ padding: "16px 20px" }}>
      <div className="skel" style={{ height: 22, width: "58%", borderRadius: 4, marginBottom: 14 }} />
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[80, 64, 72].map((w, i) => (
          <div key={i} className="skel" style={{ height: 24, width: w, borderRadius: 5 }} />
        ))}
      </div>
      {[100, 92, 78, 88, 65, 80].map((w, i) => (
        <div key={i} className="skel" style={{ height: 13, width: `${w}%`, borderRadius: 3, marginBottom: 10 }} />
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
type PanelTab = "description" | "submissions";

interface ProblemStatementProps {
  problem:           ProblemDetailDTO;
  onLoadSubmission:  (sub: MySubmissionDTO) => Promise<void>;
  loadedFromSubId:   string | null;
}

export function ProblemStatement({ problem, onLoadSubmission, loadedFromSubId }: ProblemStatementProps) {
  const [tab,          setTab]          = useState<PanelTab>("description");
  const [submissions,  setSubmissions]  = useState<MySubmissionDTO[] | null>(null);
  const [loadingSubs,  setLoadingSubs]  = useState(false);

  function handleTabChange(t: PanelTab) {
    setTab(t);
    if (t === "submissions" && submissions === null) {
      setLoadingSubs(true);
      getMySubmissions(problem.problemId)
        .then(setSubmissions)
        .catch(() => setSubmissions([]))
        .finally(() => setLoadingSubs(false));
    }
  }

  return (
    <div style={{
      height: "100%",
      background: "var(--bg-primary)",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* ── Tabs ─────────────────────────────────────────────── */}
      <div style={{
        display: "flex",
        borderBottom: "1px solid var(--border-subtle)",
        padding: "0 20px",
        background: "var(--bg-primary)",
        flexShrink: 0,
      }}>
        {([
          { key: "description", label: "Description"   },
          { key: "submissions", label: "My Submissions" },
        ] as { key: PanelTab; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handleTabChange(key)}
            style={{
              padding:      "12px 4px",
              marginRight:  20,
              background:   "transparent",
              border:       "none",
              borderBottom: tab === key ? "2px solid var(--blue)" : "2px solid transparent",
              color:        tab === key ? "var(--blue)" : "var(--text-muted)",
              fontSize:     13,
              fontWeight:   tab === key ? 700 : 500,
              cursor:       "pointer",
              fontFamily:   "inherit",
              transition:   "all 0.15s",
              marginBottom: -1,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab content ──────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {tab === "description" ? (
          <DescriptionTab problem={problem} />
        ) : (
          <SubmissionsTab
            submissions={submissions}
            loading={loadingSubs}
            onLoadSubmission={onLoadSubmission}
            loadedFromSubId={loadedFromSubId}
          />
        )}
      </div>
    </div>
  );
}

// ── Description tab ───────────────────────────────────────────────────────────

function DescriptionTab({ problem }: { problem: ProblemDetailDTO }) {
  return (
    <div style={{ padding: "20px 20px 40px" }}>

      <div style={{ marginBottom: 16 }}>
        <h1 style={{
          fontSize: 18, fontWeight: 800, color: "var(--text-primary)",
          letterSpacing: "-0.3px", marginBottom: 10, lineHeight: 1.25,
        }}>
          {problem.title}
        </h1>

        {/* Stats row */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12, flexWrap: "wrap" }}>
          <DifficultyBadgeLight difficulty={problem.difficulty} />

          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-muted)" }}>
            <span style={{ color: "var(--green)", fontWeight: 700 }}>
              {(problem.acceptanceRate ?? 0).toFixed(1)}%
            </span>
            <span>Acceptance</span>
          </div>

          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {(problem.totalSubmissions ?? 0).toLocaleString()} submissions
          </div>
        </div>

        {/* Category chip */}
        {problem.category && (
          <div style={{ marginBottom: 6 }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "3px 10px",
              background: "rgba(76,154,255,0.08)",
              border: "1px solid rgba(76,154,255,0.2)",
              borderRadius: 5,
              fontSize: 11, color: "var(--brand-2)", fontWeight: 600,
            }}>
              {problem.category}
            </span>
          </div>
        )}

        {/* Topic tags */}
        {problem.tags && problem.tags.length > 0 && (
          <TopicTags tags={problem.tags} />
        )}
      </div>

      {/* Constraint chips */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        <ConstraintChip icon={<Clock size={13} />} label={`${problem.timeLimitMs} ms`} />
        <ConstraintChip icon={<HardDrive size={13} />} label={`${problem.memoryLimitMb} MB`} />
      </div>

      <div style={{ height: 1, background: "var(--border-subtle)", marginBottom: 20 }} />

      {/* Description */}
      <div style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.78, marginBottom: 28 }}>
        {problem.description
          ? problem.description.split("\n\n").map((para, i) => (
              <p key={i} style={{ marginBottom: 14 }}>
                {para.split("\n").map((line, j) => (
                  <span key={j}>
                    {line}
                    {j < para.split("\n").length - 1 && <br />}
                  </span>
                ))}
              </p>
            ))
          : <p style={{ color: "var(--text-subtle)", fontStyle: "italic" }}>No description provided.</p>}
      </div>

      {/* Sample test cases */}
      {problem.visibleTestCases.length > 0 && (
        <div>
          <SectionLabel>Sample Test Cases</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {problem.visibleTestCases.map((tc, i) => (
              <SampleTestCase key={tc.id} index={i + 1} testCase={tc} />
            ))}
          </div>
        </div>
      )}

      {/* Hidden test cases */}
      {problem.hiddenTestCaseCount > 0 && (
        <div style={{ marginTop: 24 }}>
          <SectionLabel>Hidden Test Cases</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {Array.from({ length: problem.hiddenTestCaseCount }).map((_, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 12px",
                background: "var(--bg-secondary)",
                border: "1px solid var(--border)",
                borderRadius: 5,
                fontSize: 12, color: "var(--text-subtle)",
              }}>
                <Lock size={11} style={{ flexShrink: 0 }} />
                <span>Hidden test case {i + 1}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hints */}
      {problem.hints && problem.hints.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <HintsSection hints={problem.hints} />
        </div>
      )}
    </div>
  );
}

function TopicTags({ tags }: { tags: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? tags : tags.slice(0, 5);

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
      {shown.map(tag => (
        <span
          key={tag}
          style={{
            padding: "3px 10px",
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: 20,
            fontSize: 11, fontWeight: 600,
            color: "var(--text-muted)",
            cursor: "pointer",
            transition: "all 0.12s",
            userSelect: "none",
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.background  = "var(--blue-light)";
            el.style.color       = "var(--blue)";
            el.style.borderColor = "var(--blue)";
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.background  = "var(--bg-secondary)";
            el.style.color       = "var(--text-muted)";
            el.style.borderColor = "var(--border)";
          }}
        >
          {tag}
        </span>
      ))}
      {tags.length > 5 && (
        <button
          onClick={() => setExpanded(v => !v)}
          style={{
            padding: "3px 10px",
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: 20,
            fontSize: 11, fontWeight: 600,
            color: "var(--text-subtle)",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {expanded ? "− Less" : `+ ${tags.length - 5} more`}
        </button>
      )}
    </div>
  );
}

function ConstraintChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "4px 10px",
      background: "var(--bg-secondary)",
      border: "1px solid var(--border)",
      borderRadius: 5,
      fontSize: 12, color: "var(--text-muted)", fontWeight: 500,
    }}>
      <span style={{ fontSize: 11 }}>{icon}</span>
      {label}
    </span>
  );
}

function DifficultyBadgeLight({ difficulty }: { difficulty: string }) {
  const config: Record<string, { color: string; bg: string; text: string }> = {
    EASY:   { color: "var(--success-ink)", bg: "rgba(87,217,163,0.1)",  text: "Easy"   },
    MEDIUM: { color: "#ffc107", bg: "rgba(255,193,7,0.1)",   text: "Medium" },
    HARD:   { color: "var(--danger-ink)", bg: "rgba(255,107,74,0.1)",  text: "Hard"   },
  };
  const c = config[difficulty] ?? { color: "#888", bg: "rgba(136,136,136,0.1)", text: difficulty };
  return (
    <span style={{
      padding: "3px 10px", borderRadius: 5,
      fontSize: 12, fontWeight: 800,
      background: c.bg, color: c.color,
    }}>
      {c.text}
    </span>
  );
}

// ── Submissions tab ───────────────────────────────────────────────────────────

function SubmissionsTab({
  submissions, loading, onLoadSubmission, loadedFromSubId,
}: {
  submissions:      MySubmissionDTO[] | null;
  loading:          boolean;
  onLoadSubmission: (sub: MySubmissionDTO) => Promise<void>;
  loadedFromSubId:  string | null;
}) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function handleRowClick(sub: MySubmissionDTO) {
    if (loadingId) return;
    setLoadingId(sub.id);
    try {
      await onLoadSubmission(sub);
    } finally {
      setLoadingId(null);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 20 }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{
            height: 48, background: "var(--bg-secondary)",
            borderRadius: 6, marginBottom: 8,
            animation: "shimmer 1.5s infinite",
          }} />
        ))}
      </div>
    );
  }

  if (!submissions || submissions.length === 0) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
        <Inbox size={32} color="var(--ink-3)" style={{ marginBottom: 12 }} />
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
          No submissions yet
        </div>
        <div style={{ fontSize: 13 }}>Submit your solution to see it here</div>
      </div>
    );
  }

  return (
    <div style={{ padding: "12px 0" }}>
      {/* Hint banner */}
      <div style={{
        margin: "0 16px 12px",
        padding: "8px 12px",
        background: "rgba(76,154,255,0.08)",
        border: "1px solid rgba(76,154,255,0.15)",
        borderRadius: 6,
        fontSize: 12,
        color: "var(--text-muted)",
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}>
        <Lightbulb size={14} color="var(--brand-2)" />
        Click any submission to load its code into the editor
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "var(--bg-secondary)" }}>
            {["Status", "Language", "Time", "Memory", "Submitted"].map(h => (
              <th key={h} style={{
                padding: "8px 16px",
                textAlign: "left",
                fontSize: 11, fontWeight: 700,
                color: "var(--text-subtle)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                borderBottom: "1px solid var(--border-subtle)",
                whiteSpace: "nowrap",
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {submissions.map(sub => {
            const isLoaded  = loadedFromSubId === sub.id;
            const isLoading = loadingId === sub.id;
            return (
              <tr
                key={sub.id}
                onClick={() => handleRowClick(sub)}
                style={{
                  borderBottom: "1px solid var(--border-subtle)",
                  cursor: isLoading ? "wait" : "pointer",
                  background: isLoaded ? "rgba(76,154,255,0.07)" : "transparent",
                  borderLeft: isLoaded ? "3px solid var(--brand-2)" : "3px solid transparent",
                  transition: "background 0.1s, border-color 0.1s",
                }}
                onMouseEnter={e => {
                  if (!isLoaded) (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)";
                }}
                onMouseLeave={e => {
                  if (!isLoaded) (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                <td style={{ padding: "10px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <StatusBadge status={sub.status} />
                    {isLoading && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                        style={{ animation: "spin 0.8s linear infinite", flexShrink: 0 }}>
                        <circle cx="12" cy="12" r="10" stroke="var(--brand-2)"
                          strokeWidth="3" strokeDasharray="30 70" />
                      </svg>
                    )}
                    {isLoaded && !isLoading && (
                      <span style={{
                        fontSize: 10, fontWeight: 700,
                        color: "var(--brand-2)",
                        background: "rgba(76,154,255,0.12)",
                        padding: "1px 6px",
                        borderRadius: 3,
                      }}>
                        IN EDITOR
                      </span>
                    )}
                  </div>
                </td>
                <td style={{ padding: "10px 16px", fontSize: 12, color: "var(--text-muted)", fontFamily: "ui-monospace, monospace" }}>
                  {sub.language}
                </td>
                <td style={{ padding: "10px 16px", fontSize: 12, color: "var(--text-muted)" }}>
                  {sub.timeMs}ms
                </td>
                <td style={{ padding: "10px 16px", fontSize: 12, color: "var(--text-muted)" }}>
                  {sub.memoryKb > 0 ? `${(sub.memoryKb / 1024).toFixed(1)}MB` : "—"}
                </td>
                <td style={{ padding: "10px 16px", fontSize: 12, color: "var(--text-subtle)" }}>
                  {sub.submittedAgo}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; bg: string; label: string }> = {
    ACCEPTED:              { color: "var(--success-ink)", bg: "rgba(87,217,163,0.1)",  label: "Accepted"      },
    WRONG_ANSWER:          { color: "var(--danger-ink)", bg: "rgba(255,107,74,0.1)",  label: "Wrong Answer"  },
    TIME_LIMIT_EXCEEDED:   { color: "#ffc107", bg: "rgba(255,193,7,0.1)",   label: "Time Limit"    },
    RUNTIME_ERROR:         { color: "#c678dd", bg: "rgba(198,120,221,0.1)", label: "Runtime Error" },
    COMPILATION_ERROR:     { color: "#888",    bg: "rgba(136,136,136,0.1)", label: "Compile Error" },
    MEMORY_LIMIT_EXCEEDED: { color: "#56b6c2", bg: "rgba(86,182,194,0.1)",  label: "Memory Limit"  },
  };
  const c = config[status] ?? { color: "#888", bg: "rgba(136,136,136,0.1)", label: status };
  return (
    <span style={{
      padding: "3px 8px", borderRadius: 4,
      fontSize: 11, fontWeight: 700,
      background: c.bg, color: c.color,
      whiteSpace: "nowrap",
    }}>
      {c.label}
    </span>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, color: "var(--text-subtle)",
      textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 12,
    }}>
      {children}
    </div>
  );
}

function HintsSection({ hints }: { hints: string[] }) {
  const [revealed, setRevealed] = useState<Set<number>>(new Set());

  return (
    <div>
      <SectionLabel>Hints</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {hints.map((hint, i) => {
          const isOpen = revealed.has(i);
          return (
            <div key={i} style={{
              border: "1px solid var(--border)",
              borderRadius: 6,
              overflow: "hidden",
            }}>
              <button
                onClick={() => setRevealed(prev => {
                  const next = new Set(prev);
                  if (next.has(i)) next.delete(i); else next.add(i);
                  return next;
                })}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  background: "var(--bg-secondary)",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  gap: 8,
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
                  <Lightbulb size={12} style={{ color: "#ffc107" }} />
                  Hint {i + 1}
                  {!isOpen && (
                    <span style={{ fontSize: 10, color: "var(--text-subtle)", fontWeight: 400 }}>
                      — click to reveal
                    </span>
                  )}
                </span>
                <ChevronDown size={13} style={{
                  color: "var(--text-subtle)",
                  transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.15s",
                }} />
              </button>
              {isOpen && (
                <div style={{
                  padding: "10px 12px",
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  lineHeight: 1.6,
                  borderTop: "1px solid var(--border-subtle)",
                }}>
                  {hint}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SampleTestCase({ index, testCase }: { index: number; testCase: VisibleTestCaseDTO }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
      <div style={{
        padding: "6px 12px",
        background: "var(--bg-secondary)",
        borderBottom: "1px solid var(--border)",
        fontSize: 11, fontWeight: 700,
        color: "var(--text-subtle)",
        textTransform: "uppercase", letterSpacing: "0.5px",
      }}>
        Example {index}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", background: "var(--bg-primary)" }}>
        <div style={{ padding: "10px 12px", borderRight: "1px solid var(--border)" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-subtle)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 5 }}>
            Input
          </div>
          <pre style={{ fontSize: 12, fontFamily: "ui-monospace, Consolas, 'Courier New', monospace", color: "var(--text-primary)", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all", lineHeight: 1.6 }}>
            {testCase.input}
          </pre>
        </div>
        <div style={{ padding: "10px 12px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-subtle)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 5 }}>
            Expected Output
          </div>
          <pre style={{ fontSize: 12, fontFamily: "ui-monospace, Consolas, 'Courier New', monospace", color: "var(--text-primary)", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all", lineHeight: 1.6 }}>
            {testCase.expectedOutput}
          </pre>
        </div>
      </div>
    </div>
  );
}
