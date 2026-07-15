"use client";
import { useState } from "react";
import { Check } from "lucide-react";
import { AVATARS } from "./avatars";
import { UserAvatar } from "./UserAvatar";

export function AvatarPicker({
  selected,
  onChange,
}: {
  selected?: string | null;
  onChange: (id: string) => void;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div>
      <p style={{
        fontSize: 11, fontWeight: 700, letterSpacing: "1px",
        textTransform: "uppercase", color: "var(--ink-3)",
        fontFamily: "var(--font-mono), monospace", marginBottom: 12,
      }}>
        Choose your warrior
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
        {AVATARS.map(avatar => {
          const isSelected = selected === avatar.id;
          const isHovered = hoveredId === avatar.id;
          return (
            <div
              key={avatar.id}
              onClick={() => onChange(avatar.id)}
              onMouseEnter={() => setHoveredId(avatar.id)}
              onMouseLeave={() => setHoveredId(null)}
              title={avatar.name}
              style={{
                position: "relative", cursor: "pointer", borderRadius: 12, overflow: "hidden",
                border: `2px solid ${isSelected ? avatar.color : isHovered ? avatar.color + "80" : "var(--line)"}`,
                transition: "border-color .15s, transform .15s, box-shadow .15s",
                transform: isSelected ? "scale(1.08)" : isHovered ? "scale(1.05)" : "scale(1)",
                boxShadow: isSelected ? `0 0 12px ${avatar.color}80` : "none",
              }}
            >
              <UserAvatar avatarId={avatar.id} size={52} />
              {isSelected && (
                <div style={{
                  position: "absolute", top: 4, right: 4, width: 16, height: 16, borderRadius: "50%",
                  background: avatar.color, display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Check size={10} color="#0a0a0a" strokeWidth={3} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selected && (
        <p style={{ marginTop: 10, fontSize: 12, color: "var(--ink-2)", textAlign: "center" }}>
          {AVATARS.find(a => a.id === selected)?.name ?? ""}
        </p>
      )}
    </div>
  );
}
