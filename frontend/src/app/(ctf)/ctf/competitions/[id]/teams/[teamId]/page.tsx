"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Trophy, Shield, Users, Target, Clock, Crown, Loader2 } from "lucide-react";
import { getCtfTeamProfile, type CTFTeamProfileDTO, type CTFTeamSolveEntryDTO, type CTFTeamMemberDTO } from "@/lib/api";

const CATEGORY_COLORS: Record<string, string> = {
  CRYPTO:    "var(--brand)",
  FORENSICS: "#14b8a6",
  REVERSE:   "#f59e0b",
  WEB:       "#3b82f6",
  MISC:      "var(--ink-2)",
  OSINT:     "#ec4899",
  PWN:       "#ef4444",
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function TeamProfilePage() {
  const { id: competitionId, teamId } = useParams<{ id: string; teamId: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<CTFTeamProfileDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    getCtfTeamProfile(competitionId, teamId)
      .then(setProfile)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [competitionId, teamId]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
        <Loader2 size={28} style={{ animation: "spin 1s linear infinite", color: "var(--brand)" }} />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div style={{ textAlign: "center", padding: 80, color: "var(--ink-2)" }}>
        <Shield size={48} style={{ marginBottom: 12, opacity: 0.4 }} />
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>Team not found</div>
        <div style={{ fontSize: 13 }}>This team may not exist in this competition.</div>
      </div>
    );
  }

  const rankColor = profile.rank === 1 ? "#fbbf24" : profile.rank === 2 ? "var(--ink-2)" : profile.rank === 3 ? "#fb923c" : "var(--ink-3)";

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Back button */}
      <button
        onClick={() => router.back()}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "transparent", border: "none", color: "var(--ink-2)",
          cursor: "pointer", fontSize: 13, padding: "4px 0", width: "fit-content",
        }}
      >
        <ArrowLeft size={15} /> Back
      </button>

      {/* ── Header card ── */}
      <div style={{
        background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: 12,
        padding: "28px 28px 24px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 20 }}>
          {/* Avatar */}
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: profile.avatarColor,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, fontWeight: 800, color: "#fff", flexShrink: 0,
            boxShadow: `0 0 0 3px ${profile.avatarColor}44`,
          }}>
            {profile.name.charAt(0).toUpperCase()}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)", marginBottom: 4 }}>
              {profile.name}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                background: `${rankColor}22`, color: rankColor,
                border: `1px solid ${rankColor}44`,
                borderRadius: 6, padding: "2px 10px", fontSize: 12, fontWeight: 700,
              }}>
                <Trophy size={11} />
                #{profile.rank}
              </span>
              <span style={{
                fontSize: 11, color: "var(--ink-2)",
                fontFamily: "ui-monospace, monospace",
              }}>
                {profile.members.length} member{profile.members.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          <StatCard icon={<Trophy size={16} />} label="Total Score" value={profile.totalPoints.toString()} accent="#fbbf24" />
          <StatCard icon={<Target size={16} />} label="Challenges Solved" value={profile.solveCount.toString()} accent="var(--brand)" />
          <StatCard icon={<Users size={16} />} label="Members" value={profile.members.length.toString()} accent="#14b8a6" />
        </div>
      </div>

      {/* ── Members ── */}
      <Section title="Team Members" icon={<Users size={15} />}>
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {profile.members
            .sort((a, b) => (b.pointsContributed ?? 0) - (a.pointsContributed ?? 0))
            .map(m => <MemberRow key={m.userId} m={m} isCaptain={m.userId === profile.captainId} />)
          }
        </div>
      </Section>

      {/* ── Solved challenges ── */}
      {profile.solves.length > 0 && (
        <Section title={`Solved Challenges (${profile.solves.length})`} icon={<Target size={15} />}>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {profile.solves.map((s, i) => <SolveRow key={i} s={s} />)}
          </div>
        </Section>
      )}

      {profile.solves.length === 0 && (
        <div style={{
          background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: 12,
          padding: "40px 24px", textAlign: "center", color: "var(--ink-3)",
        }}>
          <Target size={36} style={{ marginBottom: 10, opacity: 0.3 }} />
          <div style={{ fontSize: 14, color: "var(--ink-2)" }}>No challenges solved yet.</div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, accent }: {
  icon: React.ReactNode; label: string; value: string; accent: string;
}) {
  return (
    <div style={{
      background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 8,
      padding: "14px 16px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: accent, marginBottom: 6 }}>
        {icon}
        <span style={{ fontSize: 11, color: "var(--ink-2)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)", fontFamily: "ui-monospace, monospace" }}>
        {value}
      </div>
    </div>
  );
}

function Section({ title, icon, children }: {
  title: string; icon: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div style={{
      background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden",
    }}>
      <div style={{
        padding: "14px 18px", borderBottom: "1px solid var(--line)",
        display: "flex", alignItems: "center", gap: 8,
        color: "var(--ink-2)", fontWeight: 700, fontSize: 13,
      }}>
        {icon} {title}
      </div>
      {children}
    </div>
  );
}

function MemberRow({ m, isCaptain }: { m: CTFTeamMemberDTO; isCaptain: boolean }) {
  const initials = m.displayName.split(" ").map(w => w[0] ?? "").join("").slice(0, 2).toUpperCase();
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 18px", borderBottom: "1px solid var(--surface)",
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: "50%",
        background: isCaptain ? "#fbbf2422" : "var(--line)",
        border: `1px solid ${isCaptain ? "#fbbf24" : "var(--line-2)"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, fontWeight: 700, color: isCaptain ? "#fbbf24" : "var(--ink-2)",
        flexShrink: 0,
      }}>
        {initials || "?"}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontWeight: 600, color: "var(--ink)", fontSize: 14 }}>{m.displayName}</span>
          {isCaptain && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 3,
              background: "#fbbf2422", color: "#fbbf24",
              border: "1px solid #fbbf2444", borderRadius: 4,
              padding: "1px 6px", fontSize: 10, fontWeight: 700,
            }}>
              <Crown size={9} /> Captain
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 1 }}>
          Joined {new Date(m.joinedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
        </div>
      </div>

      <div style={{ display: "flex", gap: 20, flexShrink: 0 }}>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", fontFamily: "ui-monospace, monospace" }}>
            {m.pointsContributed}
          </div>
          <div style={{ fontSize: 10, color: "var(--ink-3)" }}>pts</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--brand)", fontFamily: "ui-monospace, monospace" }}>
            {m.solveCount}
          </div>
          <div style={{ fontSize: 10, color: "var(--ink-3)" }}>solves</div>
        </div>
      </div>
    </div>
  );
}

function SolveRow({ s }: { s: CTFTeamSolveEntryDTO }) {
  const catColor = CATEGORY_COLORS[s.category] ?? "var(--brand)";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "10px 18px", borderBottom: "1px solid var(--surface)",
    }}>
      <span style={{
        width: 72, flexShrink: 0, textAlign: "center",
        background: `${catColor}22`, color: catColor,
        border: `1px solid ${catColor}44`,
        borderRadius: 4, padding: "2px 0", fontSize: 10, fontWeight: 700,
        letterSpacing: "0.04em",
      }}>
        {s.category}
      </span>

      <span style={{ flex: 1, fontWeight: 600, color: "var(--ink)", fontSize: 13, minWidth: 0 }}>
        {s.challengeTitle}
      </span>

      <span style={{
        fontFamily: "ui-monospace, monospace", fontWeight: 700,
        color: "var(--brand)", fontSize: 13, flexShrink: 0,
      }}>
        +{s.currentPoints}
      </span>

      <span style={{
        display: "flex", alignItems: "center", gap: 4,
        color: "var(--ink-3)", fontSize: 11, flexShrink: 0, minWidth: 80, justifyContent: "flex-end",
      }} title={fmtDateTime(s.solvedAt)}>
        <Clock size={11} /> {timeAgo(s.solvedAt)}
      </span>
    </div>
  );
}
