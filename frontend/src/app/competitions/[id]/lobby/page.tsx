"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  getCompetitionLobby,
  createCompetitionTeam,
  joinCompetitionTeam,
  leaveCompetitionTeam,
  getApiBaseUrl,
} from "@/lib/api";
import { Trophy, Crown, Copy, Check, AlertTriangle, ClipboardList, Clock } from "lucide-react";
import { EmptyState } from "@/components/ui/algora";
import { toast } from "@/components/ui/PSPToast";
import { useCountdown } from "@/hooks/useCountdown";
import { useAuth } from "@/features/auth/contexts/AuthContext";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

// ─── types ──────────────────────────────────────────────────────────────────

interface ProblemPreview {
  label: string;
  difficultyLevel: string;
  points: number;
}

interface TeamMember {
  studentId: string;
  firstName: string;
  lastName: string;
  isCaptain: boolean;
  joinedAt: string;
}

interface TeamSummary {
  teamId: string;
  teamName: string;
  memberCount: number;
  isMyTeam: boolean;
}

interface MyTeam {
  teamId: string;
  teamName: string;
  inviteCode: string;
  isCaptain: boolean;
  members: TeamMember[];
}

interface LobbyData {
  competitionId: string;
  title: string;
  description: string;
  mode: string;
  status: string;
  durationMinutes: number;
  minTeamSize: number | null;
  maxTeamSize: number | null;
  penaltyEnabled: boolean;
  penaltyMinutes: number;
  secondsUntilStart: number;
  startTime: string | null;
  problems: ProblemPreview[];
  teams: TeamSummary[];
  myTeam: MyTeam | null;
  registeredCount: number;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

const AVATAR_COLORS = ["var(--brand)", "#6554c0", "var(--success)", "#ff5630", "var(--warn)"];
const DIFF_COLOR: Record<string, string> = {
  EASY:   "var(--success)",
  MEDIUM: "var(--warn)",
  HARD:   "var(--danger)",
};

function avatarColor(i: number) { return AVATAR_COLORS[i % AVATAR_COLORS.length]; }

function initials(f: string, l: string) {
  return ((f[0] ?? "") + (l[0] ?? "")).toUpperCase() || "?";
}

function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return "";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 10) return "just now";
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function fmtStartDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function anonymizeTeamName(name: string, isMyTeam: boolean): string {
  if (isMyTeam) return name;
  return (name[0] ?? "?") + "─".repeat(Math.max(3, name.length - 1));
}

function shouldRevealProblems(status: string) {
  return status === "ACTIVE" || status === "ENDED";
}

// ─── OTP invite-code input ───────────────────────────────────────────────────

function InviteCodeInput({
  value, onChange, onComplete,
}: { value: string; onChange: (v: string) => void; onComplete: (c: string) => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const LEN = 6;

  function onInput(i: number, char: string) {
    const upper = char.toUpperCase().replace(/[^A-Z0-9]/, "");
    if (!upper) return;
    const chars = value.padEnd(LEN, " ").split("");
    chars[i] = upper;
    const next = chars.join("").trimEnd();
    onChange(next);
    if (i < LEN - 1) refs.current[i + 1]?.focus();
    const full = next.replace(/ /g, "");
    if (full.length === LEN) onComplete(full);
  }

  function onKeyDown(i: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace") {
      if (!value[i] && i > 0) {
        refs.current[i - 1]?.focus();
      } else {
        const chars = value.padEnd(LEN, " ").split("");
        chars[i] = " ";
        onChange(chars.join(""));
      }
    }
    if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < LEN - 1) refs.current[i + 1]?.focus();
  }

  function onPaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, LEN);
    onChange(pasted.padEnd(LEN, " "));
    const focusIdx = Math.min(pasted.length, LEN - 1);
    refs.current[focusIdx]?.focus();
    if (pasted.length === LEN) onComplete(pasted);
  }

  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
      {Array.from({ length: LEN }).map((_, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el; }}
          maxLength={1}
          value={value[i]?.trim() ?? ""}
          onChange={e => onInput(i, e.target.value)}
          onKeyDown={e => onKeyDown(i, e)}
          onPaste={onPaste}
          style={{
            width: 44, height: 52,
            border: "2px solid var(--border)",
            borderRadius: 3,
            textAlign: "center",
            fontSize: 22,
            fontWeight: 800,
            fontFamily: "ui-monospace, monospace",
            color: "var(--brand)",
            background: "var(--bg-primary)",
            outline: "none",
            transition: "border-color 0.12s, box-shadow 0.12s",
            textTransform: "uppercase",
          }}
          onFocus={e => {
            e.currentTarget.style.borderColor = "var(--brand)";
            e.currentTarget.style.boxShadow = "0 0 0 2px var(--accent-ring)";
          }}
          onBlur={e => {
            e.currentTarget.style.borderColor = "var(--border)";
            e.currentTarget.style.boxShadow = "none";
          }}
        />
      ))}
    </div>
  );
}

// ─── invite-code display (read-only) ─────────────────────────────────────────

function InviteCodeDisplay({ code }: { code: string }) {
  const chars = code.toUpperCase().padEnd(6, " ").split("");
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
      {chars.map((ch, i) => (
        <div key={i} className="invite-code-box">{ch.trim()}</div>
      ))}
    </div>
  );
}

// ─── countdown boxes ─────────────────────────────────────────────────────────

function CountdownBoxes({ h, m, s, isUrgent, isCritical }: {
  h: string; m: string; s: string;
  isUrgent: boolean; isCritical: boolean;
}) {
  const numColor = isCritical ? "var(--danger-ink)" : isUrgent ? "var(--warn-ink)" : "var(--accent)";
  const cls = isCritical ? "countdown-critical" : isUrgent ? "countdown-urgent" : "";

  return (
    <div className={`countdown-display ${cls}`} style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
      {[{ val: h, lbl: "hours" }, { val: m, lbl: "min" }, { val: s, lbl: "sec" }].map(({ val, lbl }, i) => (
        <>
          {i > 0 && <span style={{ fontSize: 36, fontWeight: 600, color: "var(--ink-3)", marginBottom: 14 }}>:</span>}
          <div className="countdown-box" key={lbl}>
            <div className="countdown-number" style={{ color: numColor }}>{val}</div>
            <div className="countdown-label">{lbl}</div>
          </div>
        </>
      ))}
    </div>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

export default function CompetitionLobbyPage() {
  const params = useParams();
  const router = useRouter();
  const competitionId = params.id as string;
  const { userId } = useAuth();

  const [lobby, setLobby] = useState<LobbyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Team create/join state
  const [teamNameInput, setTeamNameInput] = useState("");
  const [codeInput, setCodeInput] = useState("      ");
  const [teamAction, setTeamAction] = useState<"idle" | "creating" | "joining" | "leaving">("idle");
  const [teamError, setTeamError] = useState<string | null>(null);
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const [copied, setCopied] = useState(false);

  const stompRef = useRef<Client | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── fetch lobby ────────────────────────────────────────────────────────────
  const loadLobby = useCallback(async (silent = false) => {
    try {
      const data = await getCompetitionLobby(competitionId) as LobbyData;
      setLobby(data);
      if (data.status === "ACTIVE" && !silent) {
        // don't auto-redirect — stay on lobby so user can click Enter Arena
      }
    } catch (e: unknown) {
      if (!silent) setError(e instanceof Error ? e.message : "Failed to load lobby");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [competitionId]);

  useEffect(() => { loadLobby(); }, [loadLobby]);

  // ── status poll ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!lobby || lobby.status !== "REGISTRATION") return;
    pollRef.current = setInterval(async () => {
      try {
        const data = await getCompetitionLobby(competitionId) as LobbyData;
        if (data.status !== lobby.status) {
          setLobby(data);
          if (data.status === "ACTIVE") {
            toast.success("Competition started!", "The arena is now open. Good luck!");
          }
        } else {
          // Update teams list silently
          setLobby(prev => prev ? {
            ...prev,
            teams: data.teams,
            myTeam: data.myTeam,
            registeredCount: data.registeredCount,
          } : prev);
        }
      } catch { /* silent */ }
    }, 30_000);
    return () => clearInterval(pollRef.current!);
  }, [competitionId, lobby?.status]);

  // ── WebSocket for team updates ─────────────────────────────────────────────
  useEffect(() => {
    if (!lobby?.myTeam) return;
    const teamId = lobby.myTeam.teamId;

    const client = new Client({
      webSocketFactory: () => new SockJS(`${getApiBaseUrl()}/ws`),
      onConnect: () => {
        client.subscribe(`/topic/competitions/${competitionId}/teams/${teamId}`, msg => {
          try {
            const event = JSON.parse(msg.body);
            if (event.type === "MEMBER_JOINED") {
              const newMember = event.team?.members?.at(-1);
              if (newMember) {
                toast.success("Teammate joined!", `${newMember.firstName} ${newMember.lastName} joined your team.`);
              }
              loadLobby(true);
            } else if (event.type === "MEMBER_LEFT") {
              loadLobby(true);
            } else if (event.type === "CAPTAIN_CHANGED") {
              loadLobby(true);
              if (event.team?.captainId === userId) {
                toast.info("You are now captain", "The previous captain left the team.");
              }
            }
          } catch { /* ignore */ }
        });
      },
      reconnectDelay: 5000,
    });

    client.activate();
    stompRef.current = client;
    return () => { client.deactivate(); };
  }, [lobby?.myTeam?.teamId, competitionId, userId, loadLobby]);

  // ── countdown ─────────────────────────────────────────────────────────────
  const countdown = useCountdown(lobby?.secondsUntilStart ?? 0);
  const isLive = lobby?.status === "ACTIVE";

  // ── team actions ──────────────────────────────────────────────────────────
  async function handleCreateTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!teamNameInput.trim()) return;
    setTeamAction("creating"); setTeamError(null);
    try {
      await createCompetitionTeam(competitionId, teamNameInput.trim());
      setTeamNameInput("");
      await loadLobby();
    } catch (e: unknown) {
      setTeamError(e instanceof Error ? e.message : "Failed to create team");
    } finally { setTeamAction("idle"); }
  }

  async function handleJoinTeam(code?: string) {
    const c = (code ?? codeInput).replace(/ /g, "");
    if (c.length < 6) return;
    setTeamAction("joining"); setTeamError(null);
    try {
      await joinCompetitionTeam(competitionId, c);
      setCodeInput("      ");
      await loadLobby();
    } catch (e: unknown) {
      setTeamError(e instanceof Error ? e.message : "Invalid invite code");
    } finally { setTeamAction("idle"); }
  }

  async function handleLeaveTeam() {
    setTeamAction("leaving"); setTeamError(null);
    try {
      await leaveCompetitionTeam(competitionId);
      setLeaveConfirm(false);
      await loadLobby();
    } catch (e: unknown) {
      setTeamError(e instanceof Error ? e.message : "Failed to leave team");
    } finally { setTeamAction("idle"); }
  }

  async function copyInviteCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const el = document.createElement("textarea");
      el.value = code;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── computed ──────────────────────────────────────────────────────────────
  const isTeamMode = lobby?.mode === "TEAM";
  const myTeam = lobby?.myTeam ?? null;
  const minTeamSize = lobby?.minTeamSize ?? 1;
  const maxTeamSize = lobby?.maxTeamSize ?? 4;
  const memberCount = myTeam?.members.length ?? 0;
  const teamReady = !isTeamMode || memberCount >= minTeamSize;
  const canEnterArena = (isLive || countdown.isLive) && teamReady;

  // ── render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ padding: 64, textAlign: "center", color: "var(--text-muted)" }}>
        Loading lobby…
      </div>
    );
  }

  if (error || !lobby) {
    return (
      <div style={{ padding: 64, textAlign: "center" }}>
        <AlertTriangle size={40} color="var(--danger)" style={{ margin: "0 auto 12px" }} />
        <div style={{ color: "var(--danger)", fontSize: 14, fontWeight: 600 }}>{error ?? "Competition not found"}</div>
        <Link href="/competitions" style={{ color: "var(--brand)", fontSize: 13, marginTop: 12, display: "inline-block" }}>
          ← Back to Competitions
        </Link>
      </div>
    );
  }

  const labels = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const totalPts = lobby.problems.reduce((s, p) => s + p.points, 0);
  const revealed = shouldRevealProblems(lobby.status);

  const statusLabel = lobby.status === "REGISTRATION" ? "Registration Open"
    : lobby.status === "ACTIVE" ? "Live Now"
    : lobby.status === "ENDED" ? "Ended"
    : lobby.status;

  const heroBg = "var(--surface)";

  return (
    <>
      <style>{`
        /* ── countdown boxes ── */
        .countdown-box {
          background: var(--surface-2);
          border: 1px solid var(--line-2);
          border-radius: var(--r-sm);
          padding: 8px 16px;
          min-width: 64px;
          text-align: center;
        }
        .countdown-number {
          font-size: 48px;
          font-weight: 700;
          font-family: var(--font-mono), ui-monospace, monospace;
          line-height: 1;
          color: var(--accent);
          text-shadow: 0 0 14px rgba(0,200,150,.5);
        }
        .countdown-label {
          font-size: 10px;
          color: var(--ink-3);
          margin-top: 4px;
          text-transform: uppercase;
          letter-spacing: 0.8px;
        }
        .countdown-critical .countdown-number { animation: pulse-num 0.8s ease-in-out infinite; }

        /* ── problem title shimmer ── */
        .problem-title-hidden {
          height: 14px;
          width: 160px;
          border-radius: 3px;
          background: linear-gradient(90deg, var(--surface) 0%, var(--surface-2) 40%, var(--surface) 80%);
          background-size: 200% 100%;
          animation: shimmer 2s ease-in-out infinite;
          display: inline-block;
        }

        /* ── invite code display boxes ── */
        .invite-code-box {
          width: 44px;
          height: 52px;
          background: var(--surface-2);
          border: 2px solid var(--line-2);
          border-radius: var(--r-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          font-weight: 800;
          font-family: var(--font-mono), ui-monospace, monospace;
          color: var(--accent);
        }

        /* ── enter arena button ── */
        .enter-arena-btn {
          width: 100%;
          height: 44px;
          background: var(--danger);
          color: white;
          border: none;
          border-radius: 3px;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.15s, transform 0.1s;
          animation: arena-pulse 2s ease-in-out infinite;
        }
        .enter-arena-btn:hover  { background: var(--danger-ink); }
        .enter-arena-btn:active { transform: scale(0.98); }
        .enter-arena-btn:disabled {
          background: var(--ink-3);
          cursor: not-allowed;
          animation: none;
        }

        /* ── lobby layout ── */
        .lobby-grid { display: grid; grid-template-columns: 1fr 320px; gap: 16px; }
        .lobby-card {
          background: var(--surface);
          border: 1px solid var(--line-2);
          border-radius: 12px;
          margin-bottom: 14px;
          overflow: hidden;
        }
        .lobby-card-hd {
          padding: 14px 18px;
          border-bottom: 1px solid var(--line-2);
          font-size: 13px;
          font-weight: 700;
          color: var(--ink);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .prob-row {
          display: flex;
          align-items: center;
          padding: 10px 14px;
          border-bottom: 1px solid var(--bg-2);
          gap: 10px;
        }
        .prob-row:last-child { border-bottom: none; }
        .prob-lbl {
          width: 32px;
          height: 32px;
          border-radius: 3px;
          background: var(--accent-soft);
          color: var(--brand);
          font-weight: 800;
          font-size: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .diff-badge {
          font-size: 10px;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 3px;
          flex-shrink: 0;
        }
        .member-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 0;
          border-bottom: 1px solid var(--bg-2);
        }
        .member-row:last-child { border-bottom: none; }
        .mem-av {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: 700;
          color: white;
          flex-shrink: 0;
        }
        .team-row {
          padding: 8px 14px;
          border-bottom: 1px solid var(--bg-2);
          font-size: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .team-row:last-child { border-bottom: none; }
        .team-row-mine {
          border-left: 3px solid var(--brand);
          background: var(--accent-soft);
          padding-left: 11px;
        }
        .readiness-bar {
          margin-top: 12px;
          padding: 8px 12px;
          border-radius: 3px;
          font-size: 12px;
          font-weight: 500;
        }
        .readiness-ok   { background: var(--success-soft); color: var(--success-ink); }
        .readiness-warn { background: var(--warn-soft); color: var(--warn-ink); }

        /* ── animations ── */
        @keyframes pulse-num {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.5; }
        }
        @keyframes arena-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(222,53,11,0.4); }
          50%       { box-shadow: 0 0 0 8px rgba(222,53,11,0); }
        }
        @keyframes live-blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }

        @media (max-width: 900px) {
          .lobby-grid { grid-template-columns: 1fr; }
        }
      `}</style>


      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* HERO BANNER                                                       */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <div style={{
        background: heroBg,
        border: "1px solid var(--line)",
        borderLeft: "none", borderRight: "none",
        padding: "28px 40px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 24,
        flexWrap: "wrap",
      }}>
        {/* Left: title + meta */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <Trophy size={20} color="var(--warn-ink)" />
            <h1 style={{
              fontSize: 24,
              fontWeight: 800,
              color: "var(--ink)",
              letterSpacing: "-0.3px",
              margin: 0,
            }}>
              {lobby.title}
            </h1>
            {/* Status badge */}
            {isLive ? (
              <span style={{
                background: "var(--danger-soft)",
                color: "var(--danger-ink)",
                border: "1px solid var(--danger)",
                borderRadius: 20,
                padding: "3px 12px",
                fontSize: 11,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}>
                <span style={{ animation: "live-blink 1s infinite", color: "var(--danger)" }}>●</span>
                Live Now
              </span>
            ) : (
              <span style={{
                background: "var(--accent-soft)",
                color: "var(--brand)",
                border: "1px solid var(--accent-ring)",
                borderRadius: 20,
                padding: "3px 12px",
                fontSize: 11,
                fontWeight: 700,
              }}>
                {statusLabel}
              </span>
            )}
          </div>
          <div style={{ color: "var(--ink-2)", fontSize: 13, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <span>{isTeamMode ? "Team Competition" : "Individual Competition"}</span>
            <span>·</span>
            <span>{lobby.problems.length} Problem{lobby.problems.length !== 1 ? "s" : ""}</span>
            <span>·</span>
            <span>{lobby.durationMinutes} min</span>
            {lobby.startTime && <><span>·</span><span>{fmtStartDate(lobby.startTime)}</span></>}
          </div>
        </div>

        {/* Right: countdown or live indicator */}
        <div style={{ textAlign: "center" }}>
          {isLive || countdown.isLive ? (
            <div style={{ color: "var(--ink)" }}>
              <div style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 8 }}>
                Competition is Live!
              </div>
              <div style={{ fontSize: 32, fontWeight: 800, fontFamily: "ui-monospace, monospace", color: "var(--danger-ink)" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--danger)", display: "inline-block", marginRight: 6 }} />Started
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 10, letterSpacing: 1 }}>
                STARTS IN
              </div>
              <CountdownBoxes
                h={countdown.hours}
                m={countdown.minutes}
                s={countdown.seconds}
                isUrgent={countdown.isUrgent}
                isCritical={countdown.isCritical}
              />
            </>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* MAIN CONTENT                                                      */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <div className="main">
        <div className="lobby-grid">

          {/* ── LEFT COLUMN ── */}
          <div>

            {/* ── TEAM SECTION ── */}
            {isTeamMode ? (
              myTeam ? (
                /* ─── State B/C: in a team ─── */
                <div className="lobby-card" style={{
                  border: "2px solid var(--brand)",
                  marginBottom: 14,
                }}>
                  {/* Header */}
                  <div style={{
                    padding: "14px 20px",
                    borderBottom: "1px solid var(--line)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {myTeam.isCaptain && <Crown size={15} color="var(--warn-ink)" />}
                      <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
                        {myTeam.teamName}
                      </span>
                      <span style={{
                        background: myTeam.isCaptain ? "var(--accent-soft)" : "var(--bg-2)",
                        color: myTeam.isCaptain ? "var(--brand)" : "var(--ink-2)",
                        borderRadius: 3,
                        padding: "1px 8px",
                        fontSize: 10,
                        fontWeight: 700,
                      }}>
                        {myTeam.isCaptain ? "Captain" : "Member"}
                      </span>
                    </div>
                    {/* Leave team */}
                    {leaveConfirm ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                        <span style={{ color: "var(--text-muted)" }}>Leave this team?</span>
                        <button
                          onClick={handleLeaveTeam}
                          disabled={teamAction === "leaving"}
                          style={{
                            background: "var(--danger)", color: "white",
                            border: "none", borderRadius: 3,
                            padding: "3px 10px", fontSize: 11, fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          {teamAction === "leaving" ? "Leaving…" : "Confirm"}
                        </button>
                        <button
                          onClick={() => setLeaveConfirm(false)}
                          style={{
                            background: "none", color: "var(--text-muted)",
                            border: "1px solid var(--border)", borderRadius: 3,
                            padding: "3px 10px", fontSize: 11, cursor: "pointer",
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setLeaveConfirm(true)}
                        style={{
                          background: "none",
                          border: "1px solid var(--border)",
                          color: "var(--text-muted)",
                          borderRadius: 3,
                          padding: "4px 12px",
                          fontSize: 11,
                          cursor: "pointer",
                        }}
                        onMouseOver={e => {
                          (e.target as HTMLButtonElement).style.borderColor = "var(--danger)";
                          (e.target as HTMLButtonElement).style.color = "var(--danger)";
                        }}
                        onMouseOut={e => {
                          (e.target as HTMLButtonElement).style.borderColor = "var(--border)";
                          (e.target as HTMLButtonElement).style.color = "var(--ink-2)";
                        }}
                      >
                        Leave Team
                      </button>
                    )}
                  </div>

                  <div style={{ padding: 20 }}>
                    {/* Invite code section */}
                    <div style={{
                      background: "var(--bg-secondary)",
                      border: "1px solid var(--line)",
                      borderRadius: 3,
                      padding: "14px 16px",
                      marginBottom: 16,
                    }}>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10, fontWeight: 600, letterSpacing: 0.3 }}>
                        INVITE CODE — SHARE WITH TEAMMATES
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                        <InviteCodeDisplay code={myTeam.inviteCode} />
                        <button
                          onClick={() => copyInviteCode(myTeam.inviteCode)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                            background: copied ? "var(--success-soft)" : "var(--surface)",
                            color: copied ? "var(--success-ink)" : "var(--brand)",
                            border: `1px solid ${copied ? "var(--success)" : "var(--brand)"}`,
                            borderRadius: 3,
                            padding: "6px 14px",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                            transition: "all 0.15s",
                          }}
                        >
                          {copied ? <span style={{display:"inline-flex",alignItems:"center",gap:5}}><Check size={13} /> Copied!</span> : <span style={{display:"inline-flex",alignItems:"center",gap:5}}><Copy size={13} /> Copy Code</span>}
                        </button>
                      </div>
                    </div>

                    {/* Member count */}
                    <div style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "var(--text-primary)",
                      marginBottom: 10,
                    }}>
                      Members {memberCount} / {maxTeamSize}
                    </div>

                    {/* Member list */}
                    <div style={{ marginBottom: 8 }}>
                      {myTeam.members.map((m, i) => (
                        <div key={m.studentId} className="member-row">
                          <span style={{ fontSize: 10, color: "var(--brand)" }}>●</span>
                          <div className="mem-av" style={{ background: avatarColor(i) }}>
                            {initials(m.firstName, m.lastName)}
                          </div>
                          <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
                            {m.firstName} {m.lastName}
                          </div>
                          <span style={{
                            background: m.isCaptain ? "var(--accent-soft)" : "var(--bg-2)",
                            color: m.isCaptain ? "var(--brand)" : "var(--ink-2)",
                            borderRadius: 3,
                            padding: "1px 7px",
                            fontSize: 10,
                            fontWeight: 700,
                          }}>
                            {m.isCaptain ? <span style={{display:"inline-flex",alignItems:"center",gap:4}}><Crown size={12} color="var(--warn-ink)" /> Captain</span> : "Member"}
                          </span>
                          <div style={{ fontSize: 11, color: "var(--ink-3)", marginLeft: 6 }}>
                            {fmtRelative(m.joinedAt)}
                          </div>
                        </div>
                      ))}

                      {/* Empty slots */}
                      {Array.from({ length: Math.max(0, minTeamSize - memberCount) }).map((_, i) => (
                        <div key={`empty-${i}`} className="member-row" style={{ opacity: 0.5 }}>
                          <span style={{ fontSize: 10, color: "var(--border)" }}>○</span>
                          <div style={{
                            width: 28, height: 28, borderRadius: "50%",
                            border: "2px dashed var(--border)",
                            flexShrink: 0,
                          }} />
                          <div style={{
                            height: 10, width: 120,
                            background: "var(--bg-secondary)",
                            borderRadius: 3,
                          }} />
                        </div>
                      ))}
                    </div>

                    {/* Readiness indicator */}
                    {memberCount >= maxTeamSize ? (
                      <div className="readiness-bar readiness-ok">
                        <Check size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />Team is full and ready to compete!
                      </div>
                    ) : memberCount >= minTeamSize ? (
                      <div className="readiness-bar readiness-ok">
                        <Check size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />Team ready — you can still invite up to {maxTeamSize - memberCount} more member{maxTeamSize - memberCount !== 1 ? "s" : ""}
                      </div>
                    ) : (
                      <div className="readiness-bar readiness-warn">
                        <AlertTriangle size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />Need at least {minTeamSize} members — invite teammates via code
                      </div>
                    )}

                    {teamError && (
                      <div style={{ marginTop: 10, fontSize: 12, color: "var(--danger)" }}>{teamError}</div>
                    )}
                  </div>
                </div>
              ) : (
                /* ─── State A: no team yet ─── */
                <div className="lobby-card" style={{ marginBottom: 14 }}>
                  <div className="lobby-card-hd">
                    Join a Team
                    <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-muted)" }}>
                      Teams lock when competition starts
                    </span>
                  </div>
                  <div style={{ padding: 20 }}>
                    {teamError && (
                      <div style={{
                        marginBottom: 14,
                        padding: "8px 12px",
                        background: "var(--red-light)",
                        border: "1px solid var(--warn)",
                        borderRadius: 3,
                        fontSize: 12,
                        color: "var(--danger)",
                      }}>
                        {teamError}
                      </div>
                    )}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 0 }}>
                      {/* Create team */}
                      <form onSubmit={handleCreateTeam} style={{ paddingRight: 20 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginBottom: 10 }}>
                          Create Your Team
                        </div>
                        <input
                          className="input"
                          style={{
                            marginBottom: 10,
                            background: "var(--bg-2)",
                            border: "1px solid var(--line-2)",
                            borderRadius: 10,
                          }}
                          placeholder="Team name"
                          value={teamNameInput}
                          onChange={e => setTeamNameInput(e.target.value)}
                          maxLength={40}
                          onFocus={e => e.currentTarget.style.borderColor = "var(--accent)"}
                          onBlur={e => e.currentTarget.style.borderColor = "var(--line-2)"}
                        />
                        <button
                          type="submit"
                          disabled={!teamNameInput.trim() || teamAction !== "idle"}
                          style={{
                            width: "100%",
                            height: 40,
                            background: !teamNameInput.trim() || teamAction !== "idle" ? "var(--surface-3)" : "var(--accent)",
                            color: !teamNameInput.trim() || teamAction !== "idle" ? "var(--ink-3)" : "#0a0a0a",
                            border: "none",
                            borderRadius: 10,
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: !teamNameInput.trim() || teamAction !== "idle" ? "not-allowed" : "pointer",
                          }}
                        >
                          {teamAction === "creating" ? "Creating…" : "+ Create Team"}
                        </button>
                      </form>

                      {/* Divider */}
                      <div style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 6,
                        padding: "0 4px",
                      }}>
                        <div style={{ flex: 1, width: 1, background: "var(--border)" }} />
                        <span style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "var(--text-muted)",
                          background: "var(--bg-primary)",
                          padding: "2px 6px",
                        }}>OR</span>
                        <div style={{ flex: 1, width: 1, background: "var(--border)" }} />
                      </div>

                      {/* Join via code */}
                      <div style={{ paddingLeft: 20 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginBottom: 10 }}>
                          Join via Invite Code
                        </div>
                        <div style={{ marginBottom: 10 }}>
                          <InviteCodeInput
                            value={codeInput}
                            onChange={setCodeInput}
                            onComplete={code => handleJoinTeam(code)}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleJoinTeam()}
                          disabled={codeInput.replace(/ /g, "").length < 6 || teamAction !== "idle"}
                          style={{
                            width: "100%",
                            height: 40,
                            background: "transparent",
                            color: codeInput.replace(/ /g, "").length < 6 ? "var(--ink-3)" : "var(--ink)",
                            border: `1px solid ${codeInput.replace(/ /g, "").length < 6 ? "var(--line-2)" : "var(--accent)"}`,
                            borderRadius: 10,
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: codeInput.replace(/ /g, "").length < 6 ? "not-allowed" : "pointer",
                          }}
                        >
                          {teamAction === "joining" ? "Joining…" : "Join Team →"}
                        </button>
                      </div>
                    </div>

                    <div style={{
                      marginTop: 14,
                      padding: "8px 12px",
                      background: "var(--bg-secondary)",
                      borderRadius: 3,
                      fontSize: 12,
                      color: "var(--text-muted)",
                    }}>
                      ⓘ Teams need at least {minTeamSize} member{minTeamSize !== 1 ? "s" : ""} (max {maxTeamSize}) to compete.
                    </div>
                  </div>
                </div>
              )
            ) : (
              /* ─── Solo mode ─── */
              <div style={{
                background: "var(--green-light)",
                border: "1px solid var(--success)",
                borderRadius: 3,
                padding: "14px 18px",
                marginBottom: 14,
                fontSize: 13,
                color: "var(--success-ink)",
              }}>
                <Check size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />You are registered for this competition as a solo competitor.
                You'll be able to enter the arena when it starts.
              </div>
            )}

            {/* ── PROBLEMS PREVIEW ── */}
            <div className="lobby-card">
              <div className="lobby-card-hd">
                Problems ({lobby.problems.length})
                <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-muted)" }}>
                  {revealed ? "All problems unlocked" : "Revealed when competition starts"}
                </span>
              </div>
              {lobby.problems.length === 0 ? (
                <EmptyState
                  icon={ClipboardList}
                  title="No problems added yet"
                  description="Problems will appear here when the teacher adds them."
                  style={{ padding: "32px 16px" }}
                />
              ) : (
                <>
                  {lobby.problems.map((p, i) => (
                    <div key={i} className="prob-row">
                      <div className="prob-lbl">{labels[i] ?? i + 1}</div>
                      <div style={{ flex: 1 }}>
                        {revealed ? (
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                            {p.label || `Problem ${labels[i]}`}
                          </div>
                        ) : (
                          <div className="problem-title-hidden" aria-label="Hidden until start" />
                        )}
                      </div>
                      <span className="diff-badge" style={{
                        background: (DIFF_COLOR[p.difficultyLevel] ?? "var(--ink-2)") + "22",
                        color: DIFF_COLOR[p.difficultyLevel] ?? "var(--ink-2)",
                      }}>
                        {p.difficultyLevel}
                      </span>
                      <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600, flexShrink: 0 }}>
                        {p.points} pts
                      </span>
                      {revealed && (
                        <button
                          onClick={() => router.push(`/competitions/${competitionId}/arena`)}
                          style={{
                            background: "var(--brand)",
                            color: "white",
                            border: "none",
                            borderRadius: 3,
                            padding: "4px 12px",
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: "pointer",
                            flexShrink: 0,
                          }}
                        >
                          → Solve
                        </button>
                      )}
                    </div>
                  ))}
                  <div style={{
                    padding: "8px 14px",
                    fontSize: 11,
                    color: "var(--text-muted)",
                    borderTop: "1px solid var(--bg-2)",
                  }}>
                    Total: {totalPts.toLocaleString()} points available
                  </div>
                </>
              )}
            </div>

            {/* ── PRE-COMPETITION INFO (only when registration open) ── */}
            {!revealed && (
              <div className="lobby-card">
                <div className="lobby-card-hd">Before You Compete</div>
                <div style={{ padding: "14px 16px", fontSize: 12, color: "var(--text-muted)", lineHeight: 1.8 }}>
                  <div style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}><ClipboardList size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />Rules</div>
                  {isTeamMode ? (
                    <ul style={{ paddingLeft: 16, marginBottom: 12 }}>
                      <li>This is a team competition. Teams require {minTeamSize}–{maxTeamSize} members.</li>
                      <li>Teams are locked when the competition starts.</li>
                      <li>Only one team member needs to solve each problem.</li>
                    </ul>
                  ) : (
                    <ul style={{ paddingLeft: 16, marginBottom: 12 }}>
                      <li>This is an individual competition.</li>
                      <li>Work independently on all problems.</li>
                    </ul>
                  )}
                  <div style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}><Clock size={13} style={{verticalAlign:"-2px",marginRight:5}} />Timing</div>
                  <ul style={{ paddingLeft: 16, marginBottom: 12 }}>
                    <li>The competition runs for {lobby.durationMinutes} minutes.</li>
                    <li>All participants start at exactly the same time.</li>
                  </ul>
                  <div style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}><Trophy size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />Scoring</div>
                  <ul style={{ paddingLeft: 16 }}>
                    <li>Each problem has a maximum point value.</li>
                    {lobby.penaltyEnabled && <li>Wrong answer: +{lobby.penaltyMinutes} minute time penalty.</li>}
                    <li>Tiebreak: earlier last-accepted solve time wins.</li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT SIDEBAR ── */}
          <div>

            {/* Countdown / Enter Arena card */}
            <div
              className="lobby-card"
              style={{
                marginBottom: 14,
                border: canEnterArena ? "1px solid var(--danger)" : "1px solid var(--border)",
                background: canEnterArena ? "var(--danger-soft)" : "var(--surface)",
              }}
            >
              <div className="lobby-card-hd" style={{
                color: canEnterArena ? "var(--danger)" : "var(--ink)",
                borderBottomColor: canEnterArena ? "var(--danger-soft)" : "var(--bg-2)",
              }}>
                {canEnterArena ? "Competition is Live!" : "Starts In"}
              </div>
              <div style={{ padding: "16px" }}>
                {/* Mini countdown for sidebar */}
                {!canEnterArena && (
                  <>
                    <div style={{
                      fontFamily: "var(--font-mono), ui-monospace, monospace",
                      fontSize: 32,
                      fontWeight: 800,
                      color: countdown.isCritical ? "var(--danger)" : countdown.isUrgent ? "var(--warn)" : "var(--accent)",
                      textShadow: countdown.isCritical || countdown.isUrgent ? "none" : "0 0 14px rgba(0,200,150,.5)",
                      textAlign: "center",
                      padding: "8px 0 4px",
                      letterSpacing: 2,
                    }}>
                      {countdown.hours}:{countdown.minutes}:{countdown.seconds}
                    </div>
                    <div style={{ textAlign: "center", fontSize: 11, color: "var(--text-muted)", marginBottom: 14, letterSpacing: 0.5 }}>
                      hours · minutes · seconds
                    </div>
                  </>
                )}

                {/* Enter Arena button */}
                <button
                  className={canEnterArena ? "enter-arena-btn" : undefined}
                  disabled={!canEnterArena}
                  onClick={() => router.push(`/competitions/${competitionId}/arena`)}
                  style={!canEnterArena ? {
                    width: "100%",
                    height: 44,
                    background: "var(--bg-secondary)",
                    color: "var(--text-muted)",
                    border: "none",
                    borderRadius: 3,
                    fontSize: 13,
                    cursor: "not-allowed",
                  } : undefined}
                >
                  {canEnterArena ? "→ Enter Arena Now" : "Waiting for start…"}
                </button>

                {/* Team not ready warning when live */}
                {(isLive || countdown.isLive) && !teamReady && (
                  <div style={{
                    marginTop: 10,
                    padding: "6px 10px",
                    background: "var(--orange-light)",
                    border: "1px solid var(--warn)",
                    borderRadius: 3,
                    fontSize: 11,
                    color: "var(--text-primary)",
                    textAlign: "center",
                  }}>
                    <AlertTriangle size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />Your team needs {minTeamSize} members minimum
                  </div>
                )}

                {lobby.startTime && (
                  <div style={{ textAlign: "center", fontSize: 11, color: "var(--text-muted)", marginTop: 10 }}>
                    {fmtStartDate(lobby.startTime)}
                  </div>
                )}
              </div>
            </div>

            {/* Registered Teams */}
            {isTeamMode && (
              <div className="lobby-card" style={{ marginBottom: 14 }}>
                <div className="lobby-card-hd">
                  Teams ({lobby.teams.length})
                </div>
                {lobby.teams.length === 0 ? (
                  <div style={{ padding: "14px 16px", fontSize: 12, color: "var(--text-muted)" }}>
                    No teams registered yet. Be the first!
                  </div>
                ) : (
                  lobby.teams.map(t => (
                    <div key={t.teamId} className={`team-row ${t.isMyTeam ? "team-row-mine" : ""}`}>
                      <span style={{
                        fontWeight: t.isMyTeam ? 700 : 400,
                        color: t.isMyTeam ? "var(--brand)" : "var(--ink)",
                        fontFamily: t.isMyTeam ? "inherit" : "ui-monospace, monospace",
                        letterSpacing: t.isMyTeam ? "normal" : "1px",
                      }}>
                        {anonymizeTeamName(t.teamName, t.isMyTeam)}
                        {t.isMyTeam && <span style={{
                          marginLeft: 6,
                          fontSize: 9,
                          fontWeight: 700,
                          color: "var(--brand)",
                          background: "var(--accent-soft)",
                          borderRadius: 3,
                          padding: "1px 5px",
                          letterSpacing: 0,
                        }}>YOU</span>}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        {maxTeamSize && t.memberCount >= maxTeamSize ? (
                          <span style={{
                            fontSize: 9, fontWeight: 700,
                            background: "var(--green-light)", color: "var(--success-ink)",
                            borderRadius: 3, padding: "1px 6px",
                          }}>Full <Check size={12} style={{ verticalAlign: "-2px" }} /></span>
                        ) : t.memberCount >= minTeamSize ? (
                          <span style={{ fontSize: 9, color: "var(--success)" }}>●</span>
                        ) : (
                          <span style={{ fontSize: 9, color: "var(--warn)" }}>●</span>
                        )}
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          {t.memberCount} member{t.memberCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Solo participants count */}
            {!isTeamMode && (
              <div className="lobby-card" style={{ marginBottom: 14 }}>
                <div className="lobby-card-hd">Participants</div>
                <div style={{
                  padding: "16px",
                  textAlign: "center",
                  fontSize: 32,
                  fontWeight: 800,
                  color: "var(--brand)",
                }}>
                  {lobby.registeredCount}
                </div>
                <div style={{ textAlign: "center", fontSize: 11, color: "var(--text-muted)", paddingBottom: 14 }}>
                  registered
                </div>
              </div>
            )}

            {/* Scoring Rules */}
            <div className="lobby-card">
              <div className="lobby-card-hd">How Scoring Works</div>
              <div style={{ padding: "12px 16px", fontSize: 12, color: "var(--text-muted)", lineHeight: 1.8 }}>
                <div style={{ marginBottom: 8 }}>
                  <strong style={{ color: "var(--text-primary)", display: "block", marginBottom: 2 }}>Points</strong>
                  Each problem has a max score. Points decrease as more teams solve it.
                </div>
                {lobby.penaltyEnabled && (
                  <div style={{ marginBottom: 8 }}>
                    <strong style={{ color: "var(--text-primary)", display: "block", marginBottom: 2 }}>Penalty</strong>
                    Wrong answer = +{lobby.penaltyMinutes} min time penalty (affects solve time, not points).
                  </div>
                )}
                {isTeamMode && (
                  <div style={{ marginBottom: 8 }}>
                    <strong style={{ color: "var(--text-primary)", display: "block", marginBottom: 2 }}>Team Score</strong>
                    Best score per problem across all team members.
                  </div>
                )}
                <div>
                  <strong style={{ color: "var(--text-primary)", display: "block", marginBottom: 2 }}>Tiebreak</strong>
                  Earlier last-accepted solve time wins.
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
