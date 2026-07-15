"use client";

import { useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Bell, Puzzle, Lightbulb, Pause, Play, Snowflake, AlertTriangle, Megaphone, Trophy, Ban, Flame,
} from "lucide-react";
import { useCTFCompetition } from "@/features/ctf/context/CTFCompetitionContext";
import type { CTFNotificationDTO, CTFNotificationType } from "@/lib/api";
import { CAT_CONFIG } from "@/features/ctf/shared/categoryConfig";

export default function NotificationsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const ctx = useCTFCompetition();

  const grouped = useMemo(() => groupByDate(ctx.notifications), [ctx.notifications]);

  const openChallengeFor = (n: CTFNotificationDTO) => {
    const cid = typeof n.metadata?.challengeId === "string" ? n.metadata.challengeId : null;
    if (!cid) return;
    // Navigate to challenges first, then open. Already on (ctf) routes — relative push.
    router.push(`/ctf/competitions/${id}/challenges`);
    setTimeout(() => ctx.openChallenge(cid), 50);
  };

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)" }}>Notifications</div>
          <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 2 }}>
            {ctx.notifications.length} total
            {ctx.unreadCount > 0 && ` · ${ctx.unreadCount} unread`}
          </div>
        </div>
        {ctx.unreadCount > 0 && (
          <button
            type="button"
            className="psp-btn psp-btn-secondary psp-btn-sm"
            onClick={ctx.markAllRead}
          >
            Mark all read
          </button>
        )}
      </div>

      {ctx.notifications.length === 0 ? (
        <div style={{
          textAlign: "center", padding: 60,
          background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: 8,
        }}>
          <Bell size={36} color="var(--ink-3)" style={{ margin: "0 auto 12px" }} />
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>No notifications yet</div>
          <div style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 4 }}>
            You'll be notified about new challenges, hints, and updates.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {grouped.map(group => (
            <div key={group.label}>
              <div style={{
                fontSize: 11, color: "var(--ink-3)",
                textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700,
                marginBottom: 8, padding: "0 4px",
              }}>
                {group.label}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {group.items.map((n, i) => (
                  <NotificationRow
                    key={n.id}
                    n={n}
                    unread={i < ctx.unreadCount && group === grouped[0]}
                    onView={() => openChallengeFor(n)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NotificationRow({ n, unread, onView }: {
  n: CTFNotificationDTO; unread: boolean; onView: () => void;
}) {
  const v = visualFor(n);
  const cid = typeof n.metadata?.challengeId === "string" ? n.metadata.challengeId : null;

  return (
    <div style={{
      display: "flex", gap: 12, padding: "12px 14px",
      background: unread ? "rgba(99,102,241,0.05)" : "var(--bg-2)",
      border: `1px solid ${unread ? "rgba(99,102,241,0.25)" : "var(--line)"}`,
      borderRadius: 8,
    }}>
      <div style={{ color: v.accent, flexShrink: 0, marginTop: 2 }}>{v.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{n.title}</span>
          <span style={{ fontSize: 11, color: "var(--ink-2)", whiteSpace: "nowrap" }}>{relTime(n.sentAt)}</span>
        </div>
        {n.body && (
          <div style={{
            fontSize: 12, color: "var(--ink-2)", marginTop: 4, lineHeight: 1.5,
            whiteSpace: "pre-wrap", wordBreak: "break-word",
            fontStyle: n.type === "CUSTOM" ? "italic" : "normal",
          }}>
            {n.body}
          </div>
        )}
        {cid && (n.type === "NEW_CHALLENGE" || n.type === "HINT_ADDED" || n.type === "CHALLENGE_UPDATED") && (
          <button
            type="button"
            onClick={onView}
            style={{
              marginTop: 8, background: "transparent",
              color: v.accent, border: `1px solid ${v.accent}55`,
              borderRadius: 4, padding: "3px 10px",
              fontSize: 11, fontWeight: 700, cursor: "pointer",
            }}
          >
            View Challenge →
          </button>
        )}
      </div>
    </div>
  );
}

// ── Visual lookup ────────────────────────────────────────────────────────────

function visualFor(n: CTFNotificationDTO): { icon: React.ReactNode; accent: string } {
  const cat = typeof n.metadata?.category === "string" ? n.metadata.category : null;
  const catAccent = cat ? CAT_CONFIG[cat]?.accent : undefined;
  switch (n.type) {
    case "NEW_CHALLENGE":          return { icon: <Puzzle size={16} />,        accent: catAccent ?? "#a78bfa" };
    case "HINT_ADDED":             return { icon: <Lightbulb size={16} />,     accent: "#fbbf24" };
    case "CHALLENGE_UPDATED":      return { icon: <Bell size={16} />,          accent: "#60a5fa" };
    case "COMPETITION_PAUSED":     return { icon: <Pause size={16} />,         accent: "#f59e0b" };
    case "COMPETITION_RESUMED":    return { icon: <Play size={16} />,          accent: "var(--success)" };
    case "COMPETITION_ENDING_SOON":return { icon: <AlertTriangle size={16} />, accent: "#f87171" };
    case "SCOREBOARD_FROZEN":      return { icon: <Snowflake size={16} />,     accent: "#22d3ee" };
    case "SCOREBOARD_UNFROZEN":    return { icon: <Flame size={16} />,         accent: "#fb923c" };
    case "COMPETITION_ENDED":      return { icon: <Trophy size={16} />,        accent: "#f59e0b" };
    case "COMPETITION_STARTED":    return { icon: <Trophy size={16} />,        accent: "var(--success)" };
    case "TEAM_DISQUALIFIED":      return { icon: <Ban size={16} />,           accent: "#f87171" };
    case "CUSTOM":                 return { icon: <Megaphone size={16} />,     accent: "var(--ink-2)" };
    default:                       return { icon: <Bell size={16} />,          accent: "var(--ink-2)" };
  }
}

function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000)     return "just now";
  if (ms < 3_600_000)  return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

interface Group { label: string; items: CTFNotificationDTO[]; }

/** Buckets notifications under "Today" / "Yesterday" / dated headings. */
function groupByDate(items: CTFNotificationDTO[]): Group[] {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yest  = new Date(today); yest.setDate(yest.getDate() - 1);

  const buckets = new Map<string, Group>();
  for (const n of items) {
    const d = new Date(n.sentAt); d.setHours(0, 0, 0, 0);
    let label: string;
    if (d.getTime() === today.getTime())      label = "Today";
    else if (d.getTime() === yest.getTime())  label = "Yesterday";
    else label = new Date(n.sentAt).toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "short" });
    if (!buckets.has(label)) buckets.set(label, { label, items: [] });
    buckets.get(label)!.items.push(n);
  }
  return Array.from(buckets.values());
}

// Suppress unused warnings (CTFNotificationType referenced via JSX import only)
export type _Reserved = CTFNotificationType;
