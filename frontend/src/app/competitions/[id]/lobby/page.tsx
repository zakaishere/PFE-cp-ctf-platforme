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

const AVATAR_COLORS = ["#0052cc", "#6554c0", "#00875a", "#ff5630", "#ff8b00"];
const DIFF_COLOR: Record<string, string> = {
  EASY:   "#00875a",
  MEDIUM: "#ff8b00",
  HARD:   "#de350b",
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
            color: "#0052cc",
            background: "var(--bg-primary)",
            outline: "none",
            transition: "border-color 0.12s, box-shadow 0.12s",
            textTransform: "uppercase",
          }}
          onFocus={e => {
            e.currentTarget.style.borderColor = "#0052cc";
            e.currentTarget.style.boxShadow = "0 0 0 2px #0052cc33";
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
  const numColor = isCritical ? "#ff5252" : isUrgent ? "#ffc107" : "white";
  const cls = isCritical ? "countdown-critical" : isUrgent ? "countdown-urgent" : "";

  return (
    <div className={`countdown-display ${cls}`} style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
      {[{ val: h, lbl: "hours" }, { val: m, lbl: "min" }, { val: s, lbl: "sec" }].map(({ val, lbl }, i) => (
        <>
          {i > 0 && <span style={{ fontSize: 36, fontWeight: 800, color: numColor, opacity: 0.6, marginBottom: 14 }}>:</span>}
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
                toast.success("Teammate joined! 🎉", `${newMember.firstName} ${newMember.lastName} joined your team.`);
              }
              loadLobby(true);
            } else if (event.type === "MEMBER_LEFT") {
              loadLobby(true);
            } else if (event.type === "CAPTAIN_CHANGED") {
              loadLobby(true);
              if (event.team?.captainId === userId) {
                toast.info("You are now captain 👑", "The previous captain left the team.");
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
        <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
        <div style={{ color: "#de350b", fontSize: 14, fontWeight: 600 }}>{error ?? "Competition not found"}</div>
        <Link href="/competitions" style={{ color: "#0052cc", fontSize: 13, marginTop: 12, display: "inline-block" }}>
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

  const heroBg = isLive
    ? "linear-gradient(135deg, #7d0000 0%, #de350b 60%, #bf2600 100%)"
    : "linear-gradient(135deg, #172b4d 0%, #0052cc 60%, #0747a6 100%)";

  return (
    <>
      <style>{`
        /* ── countdown boxes ── */
        .countdown-box {
          background: rgba(255,255,255,0.12);
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 4px;
          padding: 8px 16px;
          min-width: 64px;
          text-align: center;
        }
        .countdown-number {
          font-size: 48px;
          font-weight: 800;
          font-family: ui-monospace, 'Cascadia Code', monospace;
          line-height: 1;
          color: white;
        }
        .countdown-label {
          font-size: 11px;
          color: rgba(255,255,255,0.55);
          margin-top: 4px;
          text-transform: lowercase;
          letter-spacing: 0.5px;
        }
        .countdown-critical .countdown-number { animation: pulse-num 0.8s ease-in-out infinite; }

        /* ── problem title shimmer ── */
        .problem-title-hidden {
          height: 14px;
          width: 160px;
          border-radius: 3px;
          background: linear-gradient(90deg, #e8e8e8 0%, #d4d4d4 40%, #e8e8e8 80%);
          background-size: 200% 100%;
          animation: shimmer 2s ease-in-out infinite;
          display: inline-block;
        }

        /* ── invite code display boxes ── */
        .invite-code-box {
          width: 44px;
          height: 52px;
          background: #f4f5f7;
          border: 2px solid var(--border);
          border-radius: 3px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          font-weight: 800;
          font-family: ui-monospace, monospace;
          color: #0052cc;
        }

        /* ── enter arena button ── */
        .enter-arena-btn {
          width: 100%;
          height: 44px;
          background: #de350b;
          color: white;
          border: none;
          border-radius: 3px;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.15s, transform 0.1s;
          animation: arena-pulse 2s ease-in-out infinite;
        }
        .enter-arena-btn:hover  { background: #bf2600; }
        .enter-arena-btn:active { transform: scale(0.98); }
        .enter-arena-btn:disabled {
          background: #b3bac5;
          cursor: not-allowed;
          animation: none;
        }

        /* ── lobby layout ── */
        .lobby-grid { display: grid; grid-template-columns: 1fr 320px; gap: 16px; }
        .lobby-card {
          background: white;
          border: 1px solid var(--border);
          border-radius: 3px;
          margin-bottom: 14px;
        }
        .lobby-card-hd {
          padding: 12px 16px;
          border-bottom: 1px solid #f4f5f7;
          font-size: 13px;
          font-weight: 700;
          color: #172b4d;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .prob-row {
          display: flex;
          align-items: center;
          padding: 10px 14px;
          border-bottom: 1px solid #f4f5f7;
          gap: 10px;
        }
        .prob-row:last-child { border-bottom: none; }
        .prob-lbl {
          width: 32px;
          height: 32px;
          border-radius: 3px;
          background: #deebff;
          color: #0052cc;
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
          border-bottom: 1px solid #f4f5f7;
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
          border-bottom: 1px solid #f4f5f7;
          font-size: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .team-row:last-child { border-bottom: none; }
        .team-row-mine {
          border-left: 3px solid #0052cc;
          background: #f0f5ff;
          padding-left: 11px;
        }
        .readiness-bar {
          margin-top: 12px;
          padding: 8px 12px;
          border-radius: 3px;
          font-size: 12px;
          font-weight: 500;
        }
        .readiness-ok   { background: #e3fcef; color: #006644; }
        .readiness-warn { background: #fffae6; color: #974f0c; }

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

      {/* ── BREADCRUMB ── */}
      <div className="breadcrumb">
        <Link href="/competitions">Competitions</Link>
        {" › "}
        <span style={{ color: "var(--text-primary)" }}>{lobby.title}</span>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* HERO BANNER                                                       */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <div style={{
        background: heroBg,
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
            <span style={{ fontSize: 22 }}>🏆</span>
            <h1 style={{
              fontSize: 24,
              fontWeight: 800,
              color: "white",
              letterSpacing: "-0.3px",
              margin: 0,
            }}>
              {lobby.title}
            </h1>
            {/* Status badge */}
            {isLive ? (
              <span style={{
                background: "rgba(255,255,255,0.2)",
                color: "white",
                border: "1px solid rgba(255,255,255,0.4)",
                borderRadius: 20,
                padding: "3px 12px",
                fontSize: 11,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}>
                <span style={{ animation: "live-blink 1s infinite", color: "#ff9999" }}>●</span>
                Live Now
              </span>
            ) : (
              <span style={{
                background: "rgba(255,255,255,0.15)",
                color: "rgba(255,255,255,0.9)",
                borderRadius: 20,
                padding: "3px 12px",
                fontSize: 11,
                fontWeight: 700,
              }}>
                {statusLabel}
              </span>
            )}
          </div>
          <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 13, display: "flex", gap: 12, flexWrap: "wrap" }}>
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
            <div style={{ color: "white" }}>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 8 }}>
                Competition is Live!
              </div>
              <div style={{ fontSize: 32, fontWeight: 800, fontFamily: "ui-monospace, monospace", color: "white" }}>
                🔴 Started
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginBottom: 10, letterSpacing: 1 }}>
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
                  border: "2px solid #0052cc",
                  marginBottom: 14,
                }}>
                  {/* Header */}
                  <div style={{
                    padding: "14px 20px",
                    borderBottom: "1px solid #e8ecf0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {myTeam.isCaptain && <span style={{ fontSize: 16 }}>👑</span>}
                      <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
                        {myTeam.teamName}
                      </span>
                      <span style={{
                        background: myTeam.isCaptain ? "#deebff" : "#f4f5f7",
                        color: myTeam.isCaptain ? "#0052cc" : "#5e6c84",
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
                            background: "#de350b", color: "white",
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
                          (e.target as HTMLButtonElement).style.borderColor = "#de350b";
                          (e.target as HTMLButtonElement).style.color = "#de350b";
                        }}
                        onMouseOut={e => {
                          (e.target as HTMLButtonElement).style.borderColor = "var(--border)";
                          (e.target as HTMLButtonElement).style.color = "#5e6c84";
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
                      border: "1px solid #e8ecf0",
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
                            background: copied ? "#e3fcef" : "white",
                            color: copied ? "#006644" : "#0052cc",
                            border: `1px solid ${copied ? "#abf5d1" : "#0052cc"}`,
                            borderRadius: 3,
                            padding: "6px 14px",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                            transition: "all 0.15s",
                          }}
                        >
                          {copied ? "✓ Copied!" : "📋 Copy Code"}
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
                          <span style={{ fontSize: 10, color: "#0052cc" }}>●</span>
                          <div className="mem-av" style={{ background: avatarColor(i) }}>
                            {initials(m.firstName, m.lastName)}
                          </div>
                          <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
                            {m.firstName} {m.lastName}
                          </div>
                          <span style={{
                            background: m.isCaptain ? "#deebff" : "#f4f5f7",
                            color: m.isCaptain ? "#0052cc" : "#5e6c84",
                            borderRadius: 3,
                            padding: "1px 7px",
                            fontSize: 10,
                            fontWeight: 700,
                          }}>
                            {m.isCaptain ? "👑 Captain" : "Member"}
                          </span>
                          <div style={{ fontSize: 11, color: "#b3bac5", marginLeft: 6 }}>
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
                        ✓ Team is full and ready to compete!
                      </div>
                    ) : memberCount >= minTeamSize ? (
                      <div className="readiness-bar readiness-ok">
                        ✓ Team ready — you can still invite up to {maxTeamSize - memberCount} more member{maxTeamSize - memberCount !== 1 ? "s" : ""}
                      </div>
                    ) : (
                      <div className="readiness-bar readiness-warn">
                        ⚠ Need at least {minTeamSize} members — invite teammates via code
                      </div>
                    )}

                    {teamError && (
                      <div style={{ marginTop: 10, fontSize: 12, color: "#de350b" }}>{teamError}</div>
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
                        border: "1px solid #ffbdad",
                        borderRadius: 3,
                        fontSize: 12,
                        color: "#de350b",
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
                          style={{ marginBottom: 10 }}
                          placeholder="Team name"
                          value={teamNameInput}
                          onChange={e => setTeamNameInput(e.target.value)}
                          maxLength={40}
                          onFocus={e => e.currentTarget.style.borderColor = "#0052cc"}
                          onBlur={e => e.currentTarget.style.borderColor = "var(--border)"}
                        />
                        <button
                          type="submit"
                          disabled={!teamNameInput.trim() || teamAction !== "idle"}
                          style={{
                            width: "100%",
                            height: 40,
                            background: !teamNameInput.trim() || teamAction !== "idle" ? "#b3bac5" : "#0052cc",
                            color: "white",
                            border: "none",
                            borderRadius: 3,
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
                            background: "var(--bg-primary)",
                            color: codeInput.replace(/ /g, "").length < 6 ? "#b3bac5" : "#0052cc",
                            border: `1px solid ${codeInput.replace(/ /g, "").length < 6 ? "var(--border)" : "#0052cc"}`,
                            borderRadius: 3,
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
                border: "1px solid #abf5d1",
                borderRadius: 3,
                padding: "14px 18px",
                marginBottom: 14,
                fontSize: 13,
                color: "#006644",
              }}>
                ✓ You are registered for this competition as a solo competitor.
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
                <div style={{ padding: "16px 14px", fontSize: 13, color: "var(--text-muted)" }}>
                  No problems added yet.
                </div>
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
                        background: (DIFF_COLOR[p.difficultyLevel] ?? "#5e6c84") + "22",
                        color: DIFF_COLOR[p.difficultyLevel] ?? "#5e6c84",
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
                            background: "#0052cc",
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
                    borderTop: "1px solid #f4f5f7",
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
                  <div style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>📋 Rules</div>
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
                  <div style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>⏱ Timing</div>
                  <ul style={{ paddingLeft: 16, marginBottom: 12 }}>
                    <li>The competition runs for {lobby.durationMinutes} minutes.</li>
                    <li>All participants start at exactly the same time.</li>
                  </ul>
                  <div style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>🏆 Scoring</div>
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
                border: canEnterArena ? "1px solid #de350b" : "1px solid var(--border)",
                background: canEnterArena ? "#fff5f5" : "white",
              }}
            >
              <div className="lobby-card-hd" style={{
                color: canEnterArena ? "#de350b" : "#172b4d",
                borderBottomColor: canEnterArena ? "#ffd5cc" : "#f4f5f7",
              }}>
                {canEnterArena ? "Competition is Live! 🔴" : "Starts In"}
              </div>
              <div style={{ padding: "16px" }}>
                {/* Mini countdown for sidebar */}
                {!canEnterArena && (
                  <>
                    <div style={{
                      fontFamily: "ui-monospace, monospace",
                      fontSize: 32,
                      fontWeight: 800,
                      color: countdown.isCritical ? "#de350b" : countdown.isUrgent ? "#ff8b00" : "#172b4d",
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
                    border: "1px solid #ffe380",
                    borderRadius: 3,
                    fontSize: 11,
                    color: "var(--text-primary)",
                    textAlign: "center",
                  }}>
                    ⚠ Your team needs {minTeamSize} members minimum
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
                        color: t.isMyTeam ? "#0052cc" : "#172b4d",
                        fontFamily: t.isMyTeam ? "inherit" : "ui-monospace, monospace",
                        letterSpacing: t.isMyTeam ? "normal" : "1px",
                      }}>
                        {anonymizeTeamName(t.teamName, t.isMyTeam)}
                        {t.isMyTeam && <span style={{
                          marginLeft: 6,
                          fontSize: 9,
                          fontWeight: 700,
                          color: "#0052cc",
                          background: "#deebff",
                          borderRadius: 3,
                          padding: "1px 5px",
                          letterSpacing: 0,
                        }}>YOU</span>}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        {maxTeamSize && t.memberCount >= maxTeamSize ? (
                          <span style={{
                            fontSize: 9, fontWeight: 700,
                            background: "var(--green-light)", color: "#006644",
                            borderRadius: 3, padding: "1px 6px",
                          }}>Full ✓</span>
                        ) : t.memberCount >= minTeamSize ? (
                          <span style={{ fontSize: 9, color: "#00875a" }}>●</span>
                        ) : (
                          <span style={{ fontSize: 9, color: "#ff8b00" }}>●</span>
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
                  color: "#0052cc",
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
