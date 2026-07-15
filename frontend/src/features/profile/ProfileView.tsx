"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import {
  Shield, Code2, Trophy, BookOpen, Loader2, Pencil, UserX, X,
} from "lucide-react";
import { updateMyProfile, type UserProfile, type ProfileActivityItem } from "@/lib/api";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { AvatarPicker } from "@/components/ui/AvatarPicker";
import { useAuth } from "@/features/auth/contexts/AuthContext";

const MONO = "var(--font-mono), ui-monospace, monospace";

// ── Badge ────────────────────────────────────────────────────────────────────

const BADGE_STYLE: Record<string, { color: string; bg: string }> = {
  MASTER:       { color: "var(--violet)", bg: "var(--violet-soft)" },
  EXPERT:       { color: "var(--accent)", bg: "var(--accent-dim)" },
  INTERMEDIATE: { color: "var(--warn)",   bg: "var(--warn-soft)" },
  BEGINNER:     { color: "var(--ink-2)",  bg: "var(--surface-2)" },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

function titleCase(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

// ── Score card ───────────────────────────────────────────────────────────────

function ScoreCard({ label, score, rank, solved, color, border, glow }: {
  label: string;
  score: number;
  rank: number | null;
  solved?: number;
  color: string;
  border: string;
  glow: string;
}) {
  return (
    <div style={{
      flex: 1, minWidth: 220,
      background: "var(--surface)",
      border: `1px solid ${border}`,
      borderRadius: 16,
      padding: "24px 28px",
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: -40, right: -40,
        width: 120, height: 120, borderRadius: "50%",
        background: `radial-gradient(circle, ${glow} 0%, transparent 70%)`,
        pointerEvents: "none",
      }} />

      <p style={{
        fontSize: 11, fontWeight: 600, letterSpacing: "1px",
        textTransform: "uppercase", color: "var(--ink-3)",
        fontFamily: MONO, marginBottom: 12, marginTop: 0,
      }}>
        {label}
      </p>

      <p style={{
        fontSize: 36, fontWeight: 700, fontFamily: MONO,
        color, letterSpacing: "-1px", lineHeight: 1, margin: 0,
      }}>
        {score.toLocaleString()}
        <span style={{ fontSize: 14, color: "var(--ink-3)", marginLeft: 4 }}>pts</span>
      </p>

      {rank != null && (
        <p style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 8, marginBottom: 0 }}>
          Ranked <span style={{ color, fontWeight: 700 }}>#{rank}</span>
        </p>
      )}

      {solved !== undefined && (
        <p style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 4, marginBottom: 0 }}>
          {solved} solved
        </p>
      )}
    </div>
  );
}

// ── Activity feed ────────────────────────────────────────────────────────────

const ACTIVITY_ICON: Record<ProfileActivityItem["type"], { icon: React.ReactNode; color: string; bg: string }> = {
  ctf_solve:     { icon: <Shield size={14} />,   color: "var(--violet)", bg: "var(--violet-soft)" },
  competition:   { icon: <Trophy size={14} />,   color: "var(--warn)",   bg: "var(--warn-soft)" },
  problem_solve: { icon: <Code2 size={14} />,    color: "var(--accent)", bg: "var(--accent-dim)" },
  exam:          { icon: <BookOpen size={14} />, color: "var(--blue)",   bg: "var(--surface-2)" },
};

function ActivityRow({ item, last }: { item: ProfileActivityItem; last: boolean }) {
  const s = ACTIVITY_ICON[item.type] ?? ACTIVITY_ICON.problem_solve;
  const verb =
    item.type === "competition" ? "Captured" :
    item.type === "exam" ? "Completed" : "Solved";

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "10px 0",
      borderBottom: last ? "none" : "1px solid var(--line)",
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: s.bg, color: s.color,
      }}>
        {s.icon}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: 13, color: "var(--ink)", margin: 0,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {verb} &ldquo;{item.title}&rdquo;
        </p>
        {(item.category || item.difficulty) && (
          <p style={{ fontSize: 11, color: "var(--ink-3)", margin: "2px 0 0" }}>
            {[item.category && titleCase(item.category), item.difficulty && titleCase(item.difficulty)]
              .filter(Boolean).join(" · ")}
          </p>
        )}
      </div>

      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <p style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: "var(--accent)", margin: 0 }}>
          +{item.points} pts
        </p>
        <p style={{ fontSize: 11, color: "var(--ink-3)", margin: "2px 0 0" }}>
          {formatRelativeTime(item.timestamp)}
        </p>
      </div>
    </div>
  );
}

// ── Edit drawer ──────────────────────────────────────────────────────────────

function EditProfileDrawer({ profile, onClose, onSave }: {
  profile: UserProfile;
  onClose: () => void;
  onSave: (updated: UserProfile) => void;
}) {
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [avatarId, setAvatarId] = useState(profile.avatarId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateMyProfile({
        username: username.trim().toLowerCase(),
        bio,
        avatarId,
      });
      onSave(updated);
      onClose();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: "var(--ink-3)",
    textTransform: "uppercase", letterSpacing: "1px",
    fontFamily: MONO, display: "block", marginBottom: 8,
  };

  const fieldStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box", padding: "10px 14px", borderRadius: 10,
    background: "var(--surface-2)", border: "1px solid var(--line-2)",
    color: "var(--ink)", fontSize: 14, outline: "none",
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 999,
        background: "rgba(0,0,0,.6)",
        backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
        display: "flex", justifyContent: "flex-end",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 400, height: "100%",
          background: "var(--surface)", borderLeft: "1px solid var(--line-2)",
          boxShadow: "-24px 0 80px rgba(0,0,0,.5)",
          display: "flex", flexDirection: "column", overflowY: "auto",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "20px 24px", borderBottom: "1px solid var(--line)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Edit Profile</h2>
          <button onClick={onClose} aria-label="Close" style={{
            background: "var(--surface-2)", border: "1px solid var(--line)",
            borderRadius: 8, padding: 6, color: "var(--ink-2)", cursor: "pointer",
            display: "flex",
          }}>
            <X size={14} />
          </button>
        </div>

        {/* Fields */}
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20, flex: 1 }}>
          <div>
            <label style={labelStyle}>Username</label>
            <input
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(null); }}
              maxLength={50}
              spellCheck={false}
              autoComplete="off"
              style={{ ...fieldStyle, fontFamily: MONO }}
            />
            <p style={{ fontSize: 11, color: "var(--ink-3)", margin: "4px 0 0" }}>
              Your public URL: /profile/u/{username.trim().toLowerCase() || "…"}
            </p>
          </div>

          <div>
            <label style={labelStyle}>Bio</label>
            <textarea
              value={bio}
              onChange={(e) => { setBio(e.target.value); setError(null); }}
              maxLength={300}
              rows={4}
              style={{ ...fieldStyle, resize: "vertical" }}
            />
            <p style={{ fontSize: 11, color: "var(--ink-3)", margin: "4px 0 0" }}>
              {bio.length} / 300
            </p>
          </div>

          <AvatarPicker selected={avatarId} onChange={setAvatarId} />

          {error && (
            <p style={{
              fontSize: 13, color: "var(--danger)",
              background: "var(--danger-soft)", padding: "10px 14px",
              borderRadius: 8, border: "1px solid color-mix(in srgb, var(--danger) 20%, transparent)",
              margin: 0,
            }}>
              {error}
            </p>
          )}
        </div>

        {/* Save */}
        <div style={{ padding: 24, borderTop: "1px solid var(--line)" }}>
          <button
            onClick={handleSave}
            disabled={saving || !username.trim()}
            style={{
              width: "100%", padding: "12px 0", borderRadius: 10,
              background: saving ? "var(--surface-2)" : "var(--accent)",
              color: saving ? "var(--ink-3)" : "#0a0a0a",
              fontWeight: 700, fontSize: 14, border: "none",
              cursor: saving || !username.trim() ? "not-allowed" : "pointer",
              transition: "all .2s",
            }}
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Profile view ─────────────────────────────────────────────────────────────

export default function ProfileView({ fetchProfile, own }: {
  fetchProfile: () => Promise<UserProfile>;
  own: boolean;
}) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState(false);
  const { setAvatarId } = useAuth();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetchProfile()
      .then((p) => { if (!cancelled) setProfile(p); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fetchProfile]);

  if (loading) {
    return (
      <>
        <Navbar />
        <div style={{ minHeight: "calc(100vh - 56px)", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Loader2 size={28} style={{ animation: "spin 1s linear infinite", color: "var(--accent)" }} />
        </div>
      </>
    );
  }

  if (error || !profile) {
    return (
      <>
        <Navbar />
        <div style={{
          minHeight: "calc(100vh - 56px)", background: "var(--bg)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          color: "var(--ink-3)", gap: 12,
        }}>
          <UserX size={36} style={{ opacity: 0.4 }} />
          <p style={{ fontSize: 14, margin: 0 }}>Profile not found.</p>
        </div>
      </>
    );
  }

  const badge = BADGE_STYLE[profile.badge] ?? BADGE_STYLE.BEGINNER;

  return (
    <>
      <Navbar />

      {editing && (
        <EditProfileDrawer
          profile={profile}
          onClose={() => setEditing(false)}
          onSave={(updated) => {
            setProfile(updated);
            if (own) setAvatarId(updated.avatarId);
          }}
        />
      )}

      <div style={{ minHeight: "calc(100vh - 56px)", background: "var(--bg)", color: "var(--ink)" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "44px 24px 80px" }}>

          {/* HERO */}
          <div style={{
            display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap",
            background: "var(--surface)", border: "1px solid var(--line-2)",
            borderRadius: 16, padding: "26px 28px", marginBottom: 20,
          }}>
            <UserAvatar avatarId={profile.avatarId} name={profile.fullName} size={80} ring />

            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", margin: 0 }}>
                  {profile.fullName}
                </h1>
                <span style={{
                  fontFamily: MONO, fontSize: 10, fontWeight: 700,
                  letterSpacing: "1.5px", textTransform: "uppercase",
                  padding: "3px 10px", borderRadius: 20,
                  background: badge.bg, color: badge.color,
                  border: `1px solid color-mix(in srgb, ${badge.color} 25%, transparent)`,
                }}>
                  {profile.badge}
                </span>
              </div>
              <p style={{ fontSize: 13, color: "var(--ink-2)", margin: "6px 0 0" }}>
                <span style={{ fontFamily: MONO, color: "var(--accent)" }}>@{profile.username}</span>
                {profile.joinedAt && (
                  <> · Joined {new Date(profile.joinedAt).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</>
                )}
              </p>
              {profile.bio && (
                <p style={{ fontSize: 13, color: "var(--ink-2)", margin: "8px 0 0", lineHeight: 1.5 }}>
                  {profile.bio}
                </p>
              )}
            </div>

            {own && (
              <button
                onClick={() => setEditing(true)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  background: "var(--surface-2)", border: "1px solid var(--line-2)",
                  borderRadius: 8, padding: "8px 14px",
                  fontSize: 13, fontWeight: 600, color: "var(--ink)",
                  cursor: "pointer",
                }}
              >
                <Pencil size={13} /> Edit Profile
              </button>
            )}
          </div>

          {/* SCORE CARDS */}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
            <ScoreCard
              label="CTF Score"
              score={profile.ctfScore}
              rank={profile.ctfRank}
              solved={profile.ctfSolved}
              color="var(--violet)"
              border="color-mix(in srgb, var(--violet) 25%, transparent)"
              glow="var(--violet-soft)"
            />
            <ScoreCard
              label="CP Score"
              score={profile.cpScore}
              rank={profile.cpRank}
              solved={profile.problemsSolved}
              color="var(--accent)"
              border="var(--accent-ring)"
              glow="var(--accent-dim)"
            />
            <ScoreCard
              label="Global Score"
              score={profile.globalScore}
              rank={profile.globalRank}
              color="var(--warn)"
              border="color-mix(in srgb, var(--warn) 25%, transparent)"
              glow="var(--warn-soft)"
            />
          </div>

          {/* RECENT ACTIVITY */}
          <div style={{
            background: "var(--surface)", border: "1px solid var(--line-2)",
            borderRadius: 16, padding: "20px 24px",
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: "var(--ink-3)",
              letterSpacing: "0.08em", textTransform: "uppercase",
              fontFamily: MONO, marginBottom: 8,
            }}>
              Recent activity
            </div>

            {profile.recentActivity.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--ink-3)", padding: "18px 0", margin: 0 }}>
                No activity yet — solve a challenge or a problem to get started.
              </p>
            ) : (
              profile.recentActivity.map((item, i) => (
                <ActivityRow
                  key={`${item.timestamp}-${i}`}
                  item={item}
                  last={i === profile.recentActivity.length - 1}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
