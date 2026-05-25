"use client";

import { useEffect, useState } from "react";
import {
  Bell, X, Lightbulb, AlertTriangle, Pause, Play, Snowflake, Flame,
  Megaphone, Trophy, Ban, Sparkles,
} from "lucide-react";
import type { CTFNotificationDTO, CTFNotificationType } from "@/lib/api";

interface Props {
  notifications: CTFNotificationDTO[];
  unreadCount:   number;
  onMarkAllRead: () => void;
}

export default function CTFNotificationBell({ notifications, unreadCount, onMarkAllRead }: Props) {
  const [open, setOpen] = useState(false);

  // Mark all read when the panel opens.
  useEffect(() => {
    if (open) onMarkAllRead();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Notifications"
        title="Notifications"
        style={{
          position: "relative",
          background: "transparent", border: "1px solid #334155",
          borderRadius: 6, padding: "6px 8px", cursor: "pointer",
          color: "#94a3b8", display: "inline-flex", alignItems: "center", gap: 4,
        }}
      >
        <Bell size={14} />
        {unreadCount > 0 && (
          <span style={{
            position: "absolute", top: -4, right: -4,
            background: "#ef4444", color: "#fff",
            fontSize: 9, fontWeight: 700, borderRadius: 10,
            padding: "1px 5px", minWidth: 16, textAlign: "center",
            border: "1px solid #0b1220",
          }}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 80,
            display: "flex", justifyContent: "flex-end",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 360, maxWidth: "92vw", height: "100vh",
              background: "#0b1220", borderLeft: "1px solid #1e293b",
              display: "flex", flexDirection: "column",
              animation: "ctf-panel-in 200ms ease",
            }}
          >
            <div style={{
              padding: "14px 16px", borderBottom: "1px solid #1e293b",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Bell size={14} color="#a78bfa" />
                <span style={{ fontSize: 14, fontWeight: 700, color: "#f8fafc" }}>Notifications</span>
                <span style={{ fontSize: 11, color: "#64748b" }}>
                  {notifications.length} total
                </span>
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: 4 }}
                aria-label="Close"
              >
                <X size={14} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
              {notifications.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 16px", color: "#475569", fontSize: 13 }}>
                  No notifications yet.
                </div>
              ) : notifications.map((n, i) => {
                const s = stylesFor(n.type);
                return (
                  <div key={n.id} style={{
                    padding: "10px 16px",
                    borderBottom: i < notifications.length - 1 ? "1px solid #0f172a" : "none",
                    display: "flex", gap: 10, alignItems: "flex-start",
                  }}>
                    <div style={{ color: s.accent, marginTop: 2, flexShrink: 0 }}>{s.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#f8fafc" }}>{n.title}</div>
                      {n.body && (
                        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2, lineHeight: 1.5,
                          fontStyle: n.type === "CUSTOM" ? "italic" : "normal",
                          whiteSpace: "pre-wrap", wordBreak: "break-word",
                        }}>
                          {n.body}
                        </div>
                      )}
                      <div style={{ fontSize: 10, color: "#475569", marginTop: 4 }}>
                        {timeAgo(n.sentAt)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <style jsx global>{`
              @keyframes ctf-panel-in {
                from { transform: translateX(40px); opacity: 0; }
                to   { transform: translateX(0); opacity: 1; }
              }
            `}</style>
          </div>
        </div>
      )}
    </>
  );
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000)       return "just now";
  if (ms < 3_600_000)    return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000)   return `${Math.floor(ms / 3_600_000)}h ago`;
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function stylesFor(t: CTFNotificationType): { icon: React.ReactNode; accent: string } {
  switch (t) {
    case "NEW_CHALLENGE":          return { icon: <Sparkles size={14} />,      accent: "#a78bfa" };
    case "HINT_ADDED":             return { icon: <Lightbulb size={14} />,     accent: "#fbbf24" };
    case "CHALLENGE_UPDATED":      return { icon: <Bell size={14} />,          accent: "#60a5fa" };
    case "COMPETITION_PAUSED":     return { icon: <Pause size={14} />,         accent: "#f59e0b" };
    case "COMPETITION_RESUMED":    return { icon: <Play size={14} />,          accent: "#22c55e" };
    case "COMPETITION_ENDING_SOON":return { icon: <AlertTriangle size={14} />, accent: "#f87171" };
    case "COMPETITION_ENDED":      return { icon: <Trophy size={14} />,        accent: "#94a3b8" };
    case "COMPETITION_STARTED":    return { icon: <Trophy size={14} />,        accent: "#22c55e" };
    case "SCOREBOARD_FROZEN":      return { icon: <Snowflake size={14} />,     accent: "#22d3ee" };
    case "SCOREBOARD_UNFROZEN":    return { icon: <Flame size={14} />,         accent: "#fb923c" };
    case "TEAM_DISQUALIFIED":      return { icon: <Ban size={14} />,           accent: "#f87171" };
    case "CUSTOM":                 return { icon: <Megaphone size={14} />,     accent: "#94a3b8" };
    default:                       return { icon: <Bell size={14} />,          accent: "#94a3b8" };
  }
}
