"use client";
import { findAvatar } from "./avatars";

interface UserAvatarProps {
  avatarId?: string | null;
  name?: string;
  size?: number;
  ring?: boolean;
  onClick?: () => void;
}

export function UserAvatar({ avatarId, name, size = 32, ring = false, onClick }: UserAvatarProps) {
  const avatar = findAvatar(avatarId);

  if (avatar) {
    return (
      <div
        onClick={onClick}
        style={{
          width: size, height: size, borderRadius: size * 0.22,
          overflow: "hidden", flexShrink: 0,
          cursor: onClick ? "pointer" : "default",
          border: ring ? `2px solid ${avatar.color}` : "1.5px solid var(--line-2)",
          boxShadow: ring ? `0 0 8px ${avatar.color}66` : "none",
          transition: "border-color .2s, box-shadow .2s",
        }}
        dangerouslySetInnerHTML={{ __html: avatar.svg }}
      />
    );
  }

  const initial = name?.[0]?.toUpperCase() ?? "?";
  const hue = ((name?.charCodeAt(0) ?? 0) * 37) % 360;

  return (
    <div
      onClick={onClick}
      style={{
        width: size, height: size, borderRadius: size * 0.22,
        background: `hsl(${hue}, 50%, 25%)`,
        border: "1.5px solid var(--line-2)",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, cursor: onClick ? "pointer" : "default",
        fontFamily: "var(--font-mono), monospace",
        fontSize: size * 0.38, fontWeight: 700,
        color: `hsl(${hue}, 70%, 70%)`,
      }}
    >
      {initial}
    </div>
  );
}
