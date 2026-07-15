"use client";

import React from "react";
import type { LucideIcon } from "lucide-react";

/**
 * Centered instructional empty state. Icon sits in an accent-dim tile.
 */
export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  style?: React.CSSProperties;
}

export function EmptyState({ icon: Icon, title, description, action, style }: EmptyStateProps) {
  return (
    <div
      style={{
        padding: "44px 24px",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        ...style,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          display: "grid",
          placeItems: "center",
          margin: "0 auto 14px",
          background: "var(--accent-dim)",
        }}
      >
        <Icon size={22} color="var(--accent)" />
      </div>
      <h3 style={{ font: "650 15px var(--font-ui)", color: "var(--ink)", marginBottom: 6 }}>{title}</h3>
      {description && (
        <p style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.55, maxWidth: 300, marginBottom: action ? 16 : 0 }}>
          {description}
        </p>
      )}
      {action}
    </div>
  );
}

export default EmptyState;
