"use client";

import React from "react";

/**
 * Algora avatar tile. Default: accent bg with near-black initials.
 * Pass `color` to override with a solid color or gradient string.
 */
export interface AvatarProps {
  initials: string;
  size?: "sm" | "md";
  /** Solid color or CSS gradient. Defaults to the green accent. */
  color?: string;
  style?: React.CSSProperties;
}

const DIMS: Record<NonNullable<AvatarProps["size"]>, { box: number; radius: number; font: number }> = {
  sm: { box: 26, radius: 7, font: 10 },
  md: { box: 32, radius: 9, font: 12 },
};

export function Avatar({ initials, size = "md", color, style }: AvatarProps) {
  const d = DIMS[size];
  const bg = color ?? "var(--accent)";
  return (
    <span
      style={{
        width: d.box,
        height: d.box,
        borderRadius: d.radius,
        display: "grid",
        placeItems: "center",
        background: bg,
        color: "#0a0a0a",
        font: `700 ${d.font}px var(--font-ui)`,
        flex: "none",
        ...style,
      }}
    >
      {initials.slice(0, 2).toUpperCase()}
    </span>
  );
}

export default Avatar;
